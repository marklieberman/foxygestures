'use strict';

/**
 * Executes commands that need to happen in the content script on behalf of the background script.
 */
(function () {

  // Hash of handler functions for supported commands.
  var commandHandlers = {
    'historyBack'    : commandHistoryBack,
    'historyForward' : commandHistoryForward,
    'pageUp'         : commandPageUp,
    'pageDown'       : commandPageDown,
    'reloadFrame'    : commandReloadFrame,
    'scrollTop'      : commandScrollTop,
    'scrollBottom'   : commandScrollBottom,
    'userScript'     : commandUserScript
  };

  // Event listeners ---------------------------------------------------------------------------------------------------

  browser.runtime.onMessage.addListener(onMessage);

  function onMessage (message, sender) {
    switch (message.topic) {
      case 'mg-delegateCommand':
        // Execute a command on behalf of the background script.
        onDelegateCommand(message.data);
        break;
    }
    return false;
  }

  window.addEventListener('message', function (event) {
    if (event.data) {
      switch (event.data.topic) {
        case 'mg-delegateCommand':
          // Execute the delegated command or pass it down the frame hierachy.
          onDelegateCommand(event.data.data);
          break;
      }
    }
  });

  // Execute the delegated command or pass it down the frame hierachy.
  function onDelegateCommand (data, sender) {
    // Check if the command should be handled by this frame.
    if (data.context.scriptFrameId && (modules.mouseEvents.scriptFrameId !== data.context.scriptFrameId)) {
      // This is not the correct frame.
      modules.mouseEvents.broadcast('delegateCommand', data);
    } else {
      // Execute the delegated command in this frame.
      commandHandlers[data.command](data);
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  // Post a message to the given window with the given topic.
  // Typically used to send messages up the frame/window hierarchy.
  function postTo (targetWindow, topic, data) {
    targetWindow.postMessage({
      topic: 'mg-' + topic,
      data: data || {}
    }, '*');
  }

  // Modify the page number parameter in a URL.
  // Tries each replacer stategy in turn until one is successful.
  function alterPageNumber (callback) {
    var replacers = [
      // Match common pagination query parameters.
      url => url.replace(
        /\b(page|p)=(\d+)\b/i,
        (match, p1, p2, offset) => p1 + '=' + callback(Number(p2))
      ),
      // Match a numeric directory in the path.
      url => url.replace(
        /\/(\d+)([/?#]|$)/,
        (match, p1, p2, offset) => ('/' + callback(Number(p1)) + p2)
      )
    ];

    // Ignore the origin component of the URL.
    var origin = String(window.location.origin);
    var noOriginPart = String(window.location.href).substring(origin.length);

    for (var i = 0; i < replacers.length; i++) {
      var newPart = replacers[i](noOriginPart);
      if (newPart !== noOriginPart) {
        window.location.href = origin + newPart;
        return;
      }
    }
  }

  // Function adapted from:
  // https://github.com/danro/jquery-easing/blob/master/jquery.easing.js
  function easeOutQuad (time, initial, change, duration) {
    return -change * (time /= duration) * (time - 2) + initial;
  }

  // Smoothly scroll the window to the given offset using requestAnimationFrame().
  function scrollYEase (scrollTo, duration) {
    let start = window.performance.now();
    let initial = window.scrollY;
    let change = scrollTo - initial;
    return new Promise((resolve, reject) => {
      // Animation function to scroll based on easing function.
      function animate (step) {
        let time = (step - start);
        let value = easeOutQuad(time, initial, change, duration);
        if (time < duration) {
          // Schedule the next animation frame.
          window.scrollTo(0, value);
          window.requestAnimationFrame(animate);
        } else {
          // Finish by scrolling to the exact amount.
          window.scrollTo(0, scrollTo);
          resolve();
        }
      }

      if (duration > 0) {
        // Schedule the first animation frame.
        window.requestAnimationFrame(animate);
      } else {
        // Animation is disabled.
        window.scrollTo(0, scrollTo);
        resolve();
      }
    });
  }

  // Command implementations -------------------------------------------------------------------------------------------

  // Navigate back in history.
  function commandHistoryBack (data) {
    window.history.back();
  }

  // Navigate forward in history.
  function commandHistoryForward (data) {
    window.history.forward();
  }

  // Increment the page/number in the URL.
  function commandPageUp (data) {
    alterPageNumber(p => p + 1);
  }

  // Decrement the page/number in the URL.
  function commandPageDown (data) {
    // Clamp page down at zero.
    alterPageNumber(p => (p > 0) ? (p - 1) : 0);
  }

  // Reload the frame in the active tab.
  function commandReloadFrame (data) {
    window.location.reload();
  }

  // Scroll to the top of the frame or page.
  function commandScrollTop (data) {
    // TODO Scroll easing duration as a preference
    return scrollYEase(0, 1000);
  }

  // Scroll to the bottom of the frame or page.
  function commandScrollBottom (data) {
    // TODO Scroll easing duration as a preference
    return scrollYEase(document.documentElement.scrollHeight - document.documentElement.clientHeight, 1000);
  }

  // Execute a user script.
  function commandUserScript (data) {
    /* jshint evil:true */
    try {
      var mouseDown = modules.mouseEvents.getMouseDown();
      eval(data.userScript.script);
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

}());
