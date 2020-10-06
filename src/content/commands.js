'use strict';

/**
 * Executes commands that need to happen in the content script on behalf of the background script.
 */
window.fg.module('commands', function (exports, fg) {

  // Hash of handler functions for supported commands.
  var commandHandlers = {
    'goOrigin': commandGoOrigin,
    'historyBack': commandHistoryBack,
    'historyBackOrCloseTab': commandHistoryBackOrCloseTab,
    'historyForward': commandHistoryForward,    
    'pageUp': commandPageUp,
    'pageDown': commandPageDown,
    'parentDirectory': commandParentDirectory,
    'reloadFrame': commandReloadFrame,
    'scrollBottom': commandScrollBottom,
    'scrollDown': commandScrollDown,
    'scrollTop': commandScrollTop,
    'scrollUp': commandScrollUp,
    'stop': commandStop,
    'userScript': commandUserScript
  };

  // Settings for this module.
  var settings = fg.helpers.initModuleSettings({
    insertRelatedTab: true,
    scrollDuration: 1000,
    scrollAmount: 100,
    useRelPrevNext: true
  }, 'local');

  // Promise to ensure that repeated scroll commands are executed in order.
  // Note: this only works within a frame as the promise does not exist if the command bubbles.
  var scrollYPromise = Promise.resolve();

  // Event listeners ---------------------------------------------------------------------------------------------------

  browser.runtime.onMessage.addListener((message, sender) => {
    switch (message.topic) {
      case 'mg-contentCommand':
        // Execute a command on behalf of the background script.
        // Check if the command should be handled by this frame.
        if (fg.mouseEvents.scriptFrameId === message.data.context.targetFrameId) {
          // Execute the delegated command in this frame.
          return commandHandlers[message.data.command](message.data);
        }
    }
    return false;
  });

  window.addEventListener('message', event => {
    // These commands should never be dispatched from a frame above.
    if ((event.source.window !== window.parent) && (event.source.window !== window.top)) {
      switch (event.data.topic) {
        case 'mg-commandScrollBottom':
          commandScrollBottom(event.data.data);
          break;
        case 'mg-commandScrollDown':
          commandScrollDown(event.data.data);
          break;
        case 'mg-commandScrollTop':
          commandScrollTop(event.data.data);
          break;
        case 'mg-commandScrollUp':
          commandScrollUp(event.data.data);
          break;
      }
    }
  });

  // -------------------------------------------------------------------------------------------------------------------

  // Post a message to the given window with the given topic.
  // Typically used to send messages up the frame/window hierarchy.
  function postTo (targetWindow, topic, data) {
    targetWindow.postMessage({
      topic: 'mg-' + topic,
      data: data || {}
    }, '*');
  }

  // Attempt to format the given value similarly to the original value.
  function padSame (original, newValue) {
    // Look for leading zeros to determine padding size.
    // This will fail in some case, for example: 100 -> 99 or 099?
	  return (original[0] === '0') ? newValue.padStart(original.length, '0') : newValue;
  }

  // Modify the page number parameter in a URL.
  // Tries each replacer stategy in turn until one is successful.
  // JSFiddle to debug this algorithm: https://jsfiddle.net/Lrdgcxcs/1/
  function alterPageNumber (callback) {
    var replacers = [
      // Match common pagination query parameters.
      url => url.replace(
        /\b(page|p)=(\d+)\b/i,
        (match, p1, p2, offset) => p1 + '=' + padSame(p2, String(callback(Number(p2))))
      ),
      // Match pageXX or page/XX in the URL.
      url => url.replace(
        /\b(page\/?)(\d+)\b/i,
        (match, p1, p2, offset) => p1 + padSame(p2, String(callback(Number(p2))))
      ),
      // Generic find and replace numbers in the URL.
      // - Try to scan for numbers in the path from end to start.
      // - Try to scan for number in the query or fragment from start to end.
      url => {
        // Split the URL each time a number is enountered.
        let segments = url.split(/([\d]+)/);

        // Find the last segment of the path component.
        let lastPathSegment = segments.reduce((n, segment, i) => {
          return !!~segment.indexOf('?') || !!~segment.indexOf('#') ? Math.min(n, i) : n;
        }, segments.length - 1);

        // Look for a number in the path first.
        // Scan from end to start and increment the last number in the path.
        let done = false;
        for (let i = lastPathSegment; i >= 0; i--) {
          let value = segments[i].length ? Number(segments[i]) : Number.NaN;
          if (value >= 0) {
            segments[i] = padSame(segments[i], String(callback(value)));
            done = true;
            break;
          }
        }

        if (!done) {
          // Look for a number in query as fallback.
          // Scan from start to end and increment the first number in the query or fragment.
          for (let i = lastPathSegment; i < segments.length; i++) {
            let value = segments[i].length ? Number(segments[i]) : Number.NaN;
            if (value >= 0) {
              segments[i] = padSame(segments[i], String(callback(value)));
              break;
            }
          }
        }

        // Assemble the segments.
        return segments.join('');
      }
    ];

    // Ignore the origin component of the URL.
    var origin = String(window.location.origin);
    var noOriginPart = String(window.location.href).substring(origin.length);

    for (var i = 0; i < replacers.length; i++) {
      var newPart = replacers[i](noOriginPart);
      if (newPart !== noOriginPart) {
        window.location.href = origin + newPart;
        return true;
      }
    }
    return false;
  }

  // Follow the last rel=next or rel=prev link in the page.
  function goRelNextPrev (next) {
    let list = document.querySelectorAll(next ? 'a[rel~=next]' : 'a[rel~=prev]');
    let href = list.length && list[list.length - 1].href;
    if (href) {
      window.location.href = href;
      return true;
    }
    return false;
  }

  // Get a target from which the search for a scrollable element can begin. Returns in order: a nested frame
  // identified in data.initialScrollFrameId, the mouseDown target, or the document.scrollingElement.
  function getInitialScrollTarget (data) {
    let state = fg.mouseEvents.state;
    if (data.initialScrollFrameId) {
      // Command was referred up the hierachy.
      // Look for a scrollable node begining from the parent of the nested iframe.
      let nestedFrame = state.nestedFrames.find(tuple => tuple.scriptFrameId === data.initialScrollFrameId);
      if (nestedFrame) {
        return nestedFrame.element.parentNode;
      }
    } else
    if (state.mouseDown) {
      // Can only be present for non-referred commands.
      // Use the mouseDown target if available.
      return state.mouseDown.target;
    }

    // Default to the document scrolling element.
    return document.scrollingElement;
  }

  // Bubble the scroll command up the frame hierachy if the frame cannot scroll. The following bubble logic is
  // attempting to copy native Firefox behaviour. One notable difference is that Firefox scrolls from the active
  // element when you press Page Up/Down. Mouse gestures always activate the element below the mouse on mousedown
  // which causes scroll commands to always focus and scroll iframes.
  function bubblingScrollTarget (data, command, handler) {
    if (!handler(getInitialScrollTarget(data))) {
      // Failed to find an acceptable scrolling node in this frame.
      if (fg.mouseEvents.state.isNested) {
        // Bubble up if scrolling is disabled...
        if ((fg.mouseEvents.state.frameScrolling === 'no') ||
          // ..or the frame does not have scroll bars.
          (document.scrollingElement.scrollHeight <= document.scrollingElement.clientHeight)
        ) {
          // Set the initialScrollFrameId so that getInitialScrollTarget() in the parent window will target the frame.
          data.initialScrollFrameId = fg.mouseEvents.scriptFrameId;
          postTo(window.parent, command, data);
        }
      }
    }
  }

  // Find the first scrollable node or ancestor that isn't at the top.
  function findScrollingUpNode (node) {
    let state = fg.mouseEvents.state;
    while (node) {
      // Node must not be scrolled to the top.
      if ((node.scrollTop > 0) &&
        // Node must not have overflow:hidden style.
        (window.getComputedStyle(node).overflowY !== 'hidden') &&
        // Node must not be HTML and have scrolling=no attribute.
        ((node.tagName !== 'HTML') || (state.frameScrolling !== 'no'))
      ) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  // Find the first scrollable node or ancestor that isn't at the bottom.
  function findScrollingDownNode (node) {
    let state = fg.mouseEvents.state;
    while (node) {
      // Node must not be scrolled to the bottom.
      if ((node.scrollTop < node.scrollTopMax) &&
        // Node must not have overflow:hidden style.
        (window.getComputedStyle(node).overflowY !== 'hidden') &&
        // Node must not be HTML and have scrolling=no attribute.
        ((node.tagName !== 'HTML') || (state.frameScrolling !== 'no'))
      ) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  // Function adapted from:
  // https://github.com/danro/jquery-easing/blob/master/jquery.easing.js
  function easeOutQuad (time, initial, change, duration) {
    return -change * (time /= duration) * (time - 2) + initial;
  }

  // Smoothly scroll the window to the given offset using requestAnimationFrame().
  function scrollYEase (node, scrollTo, duration) {
    return new Promise((resolve, reject) => {
      let start = window.performance.now();
      let initial = (typeof node.scrollY !== 'undefined') ? node.scrollY : node.scrollTop;
      let change = scrollTo - initial;

      // Animation function to scroll based on easing function.
      function animate (step) {
        let time = (step - start);
        let value = easeOutQuad(time, initial, change, duration);
        if (time < duration) {
          // Schedule the next animation frame.
          node.scrollTo(0, value);
          window.requestAnimationFrame(animate);
        } else {
          // Finish by scrolling to the exact amount.
          node.scrollTo(0, scrollTo);
          resolve();
        }
      }

      if (duration > 0) {
        // Schedule the first animation frame.
        window.requestAnimationFrame(animate);
      } else {
        // Animation is disabled.
        node.scrollTo(0, scrollTo);
        resolve();
      }
    });
  }

  // Command implementations -------------------------------------------------------------------------------------------

  // Navigate to the origin of the current URL.
  function commandGoOrigin (data) {
    window.location.href = window.location.origin;
  }

  // Navigate back in history.
  function commandHistoryBack (data) {
    window.history.back();
  }

  // Navigate back in history or close the tab if there are no previous states.
  function commandHistoryBackOrCloseTab (data) {
    let originalUrl = window.location.href;
    window.history.back();

    // Using a timeout to kill the current tab if the content script is not unloaded was suggested by @kafene.
    // Also check if the URL changed to catch push-state on single page applications.
    // If the application is lagging a short timeout could potentially close a tab with more history.
    const closeTabTimeoutMs = 300;
    window.setTimeout(function () {
      if (originalUrl === window.location.href) {
        // URL hasn't changed and script was not killed so lose the current tab.
        return executeInBackground(data => {
          return browser.windows.getAll().then(windows => {
            // Do not close the browser; keep the tab if it is the last one.
            let keepLastTab = (windows.length === 1);
            return commandCloseTab(data, keepLastTab); // jshint ignore:line
          });
        }, [ data ]); 
      }
    }, closeTabTimeoutMs);
  }

  // Navigate forward in history.
  function commandHistoryForward (data) {
    window.history.forward();
  }

  // Increment the page/number in the URL.
  function commandPageUp (data) {
    if (!(settings.useRelPrevNext && goRelNextPrev(true))) {
      alterPageNumber(p => p + 1);
    }
  }

  // Decrement the page/number in the URL.
  function commandPageDown (data) {
    if (!(settings.useRelPrevNext && goRelNextPrev(false))) {
      // Clamp page down at zero.
      alterPageNumber(p => (p > 0) ? (p - 1) : 0);
    }
  }

  // Go to the parent directory or domain.
  function commandParentDirectory (data) {
    if (window.location.pathname === '/') {
      // Remove one subdomain, but try to detect when only the TLD remains.
      let domainParts = window.location.hostname.split('.').slice(1);
      if ((domainParts.length === 1) || ((domainParts.length === 2) && (domainParts[0] === 'co'))) {
        // Suspected TLD so don't go up.
        return;
      } else {
        window.location.hostname = domainParts.join('.');
      }
    } else {
      // Go up one directory.
      window.location.href = (window.location.href.endsWith('/') ? '..' : './');
    }
  }

  // Reload the frame in the active tab.
  function commandReloadFrame (data) {
    window.location.reload();
  }

  // Scroll to the bottom of the frame or page.
  function commandScrollBottom (data) {
    bubblingScrollTarget(data, 'commandScrollBottom', node => {
      node = findScrollingDownNode(node);
      return node ? scrollYEase(node, node.scrollHeight - node.clientHeight, settings.scrollDuration) : false;
    });
  }

  // Scroll the viewport down.
  function commandScrollDown (data) {
    // This chaining ensures the previous scroll command is done.
    scrollYPromise = scrollYPromise.then(() => {
      bubblingScrollTarget(data, 'commandScrollDown', node => {
        node = findScrollingDownNode(node);
        if (node) {
          // This chaining ensures the scrolling animation is done.
          scrollYPromise = scrollYPromise.then(() => {
            let scrollAmount = node.clientHeight * (settings.scrollAmount / 100);
            let scrollTo = Math.min(node.scrollTop + scrollAmount, node.scrollTopMax);
            return scrollYEase(node, scrollTo, settings.scrollDuration);
          });
          return true;
        }
        return false;
      });
    });
  }

  // Scroll to the top of the frame or page.
  function commandScrollTop (data) {
    bubblingScrollTarget(data, 'commandScrollTop', node => {
      node = findScrollingUpNode(node);
      return node ? scrollYEase(node, 0, settings.scrollDuration) : false;
    });
  }

  // Scroll the viewport up.
  function commandScrollUp (data) {
    // This chaining ensures the previous scroll command is done.
    scrollYPromise = scrollYPromise.then(() => {
      bubblingScrollTarget(data, 'commandScrollUp', node => {
        node = findScrollingUpNode(node);
        if (node) {
          // This chaining ensures the scrolling animation is done.
          scrollYPromise = scrollYPromise.then(() => {
            let scrollAmount = node.clientHeight * (settings.scrollAmount / 100);
            let scrollTo = Math.max(node.scrollTop - scrollAmount, 0);
            return scrollYEase(node, scrollTo, settings.scrollDuration);
          });
          return true;
        }
        return false;
      });
    });
  }

  // Stop loading the current document.
  function commandStop (data) {
    window.stop();
  }

  // Execute a user script.
  function commandUserScript (data) {
    // TODO Remove this in next version.
    if (data.element.mediaSource) {
      data.element.mediaInfo = {
        source: data.element.mediaSource,
        type: data.element.mediaType
      };
    }

    /* jshint evil:true */
    try {
      var mouseDown = fg.mouseEvents.state.mouseDown;
      return Promise.resolve(eval(data.userScript.script));
    } catch (err) {
      // Report any error with the user script.
      let label =  data.userScript.label || 'User Script';
      setStatus(label + ' error: ' + err.message);
      console.log(label, 'error', err);
    }
  }

  // User script API functions -----------------------------------------------------------------------------------------
  // These are functions that primarily exist for use with user scripts.

  // Serialize a function and send it to the background script for execution.
  // This is a mechanism for user scripts to execute code in the priviledged background context.
  function executeInBackground (func, args) {
    return browser.runtime.sendMessage({
      topic: 'mg-executeInBackground',
      data: {
        args: args || [],
        func: func.toString()
      }
    });
  }

  // Set the status text.
  function setStatus (status) {
    postTo(window.top, 'status', status);
  }

});
