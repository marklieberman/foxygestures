'use strict';

/**
 * This module is responsible for seamlessly unifying mouse events from all
 * frames in a tab.
 */
var modules = modules || {};
modules.mouseEvents = (function () {

  // States for the mouse gesture state machine.
  // No gesture in progress.
  var PROGRESS_NONE = 0;
  // Mouse down has occurred but not movement.
  // Context menu is displayed if immediately followed by a mouse up.
  var PROGRESS_MOUSE_DOWN = 1;
  // Mouse movement has occurred.
  // Context menu will not be displayed following the gesture.
  var PROGRESS_MOUSE_MOVE = 2;

  // State for this module.
  var state = {
    // A unique identifier for this frame.
    // Used by commands to target a specific nested frame.
    scriptFrameId: modules.helpers.makeScriptFrameId(),
    gestureState: PROGRESS_NONE,       // Gesture state machine state.
    contextMenu: true,                 // Context menu is enabled?
    isNested: (window !== window.top), // Is this frame nested?
    nestedFrames: [],                  // Array of all nested frames.
    isUnloading: false                 // Is the page is unloading?
  };

  // Settings for this module.
  var settings = {
    gestureButton: 2
  };

  // Load settings from storage.
  browser.storage.local.get(settings).then(results => settings = results);

  if (state.isNested) {
    // Notify the parent script instance that a nested frame has loaded.
    postTo(window.parent, 'loadFrame', { id: state.scriptFrameId });
  }

  // Event listeners -----------------------------------------------------------

  // Listen for changes to settings.
  browser.storage.onChanged.addListener((changes, area) => {
    Object.keys(settings).forEach(key => {
      if (changes[key]) {
        settings[key] = changes[key].newValue;
      }
    });
  });

  window.addEventListener('message', function (event) {
    if (event.data) {
      switch (event.data.topic) {
        case 'mg-stateUpdate':
          replicateState(event.data.data);
          break;
        case 'mg-loadFrame':
          onLoadFrame(event.data.data, event.source);
          break;
        case 'mg-unloadFrame':
          onUnloadFrame(event.data.data, event.source);
          break;
        case 'mg-mousedown':
          // Offset the x,y-coordinates by the source element's position.
          applyFrameOffset(event.data.data, event.source);
          if (state.isNested) {
            // Refer this event up the hierarchy.
            postTo(window.parent, 'mousedown', event.data.data);
          } else {
            onMouseDown(event.data.data);
          }
          break;
        case 'mg-mouseup':
          // Offset the x,y-coordinates by the source element's position.
          applyFrameOffset(event.data.data, event.source);
          if (state.isNested) {
            // Refer this event up the hierarchy.
            postTo(window.parent, 'mouseup', event.data.data);
          } else {
            onMouseUp(event.data.data);
          }
          break;
        case 'mg-mousemove':
          // Note: As an optimization, do not call applyFrameOffset(). We only
          // care for dx,dy which require no correction.
          // Note: As an optimization mouse move events are posted directly to
          // the top window, so no bubbling is required.
          onMouseMove(event.data.data);
          break;
        case 'mg-contextmenu':
          if (state.isNested) {
            // Refer this event up the hierarchy.
            postTo(window.parent, 'contextmenu', event.data.data);
          } else {
            onContextMenu(event.data.data);
          }
          break;
      }
    }
  });

  window.addEventListener('unload', function () {
    if (state.isNested) {
      postTo(window.parent, 'unloadFrame');
    } else {
      state.isUnloading = true;
    }
  });

  window.addEventListener('mousedown', function (event) {
    var data = getMouseData(event, true);
    if (state.isNested) {
      // Post to parent - must apply frame offsets.
      postTo(window.parent, 'mousedown', data);
    } else {
      onMouseDown(data);
    }
  }, true);

  window.addEventListener('mouseup', function (event) {
    var data = getMouseData(event);
    if (state.isNested) {
      // Post to parent - must apply frame offsets.
      postTo(window.parent, 'mouseup', data);
    } else {
      onMouseUp(data);
    }
  }, true);

  window.addEventListener('mousemove', function (event) {
    if (state.gestureState) {
      var data = getMouseData(event);
      if (state.isNested) {
        // Send directly to top.
        postTo(window.top, 'mousemove', data);
      } else {
        onMouseMove(data);
      }
    }
  }, true);

  window.addEventListener('contextmenu', function (event) {
    // Prevent the context menu if necessary.
    if (!state.contextMenu) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (state.isNested) {
      // Send directly to top.
      postTo(window.top, 'contextmenu');
    } else {
      onContextMenu();
    }
  }, true);

  // Functions -----------------------------------------------------------------

  // Post a message to the given window with the given topic.
  // Typically used to send messages up the frame/window hierarchy.
  function postTo (targetWindow, topic, data) {
    targetWindow.postMessage({
      topic: 'mg-' + topic,
      data: data || {}
    }, '*');
  }

  // Post a mesage to all nested frames known to the script.
  // Typically used to send messages down the frame/window hierarchy.
  function broadcast (topic, data) {
    state.nestedFrames.forEach(tuple => tuple.source.postMessage({
      topic: 'mg-' + topic,
      data: data || {}
    }, '*'));
  }

  // Modify the state and replicate the changes to nested frames.
  function replicateState (newState) {
    // Refer this event down the hierarchy.
    Object.assign(state, newState);
    broadcast('stateUpdate', newState);
  }

  // Remember nested frames when their DOM is parsed.
  // Invoked when the nested frame posts an event at document_end. (i.e.: when
  // this script is laoded.)
  function onLoadFrame (data, source) {
    // Compile a list of frames on the page.
    var iframes = document.getElementsByTagName('iframe');
    var allFrames = Array.from(iframes);
    if (document.body.tagName === 'FRAMESET') {
      var framesetFrames = document.getElementsByTagName('frame');
      allFrames = allFrames.concat(Array.from(framesetFrames));
    }

    // Find the element containing the source window.
    var frame = allFrames.find(frame => frame.contentWindow === source);
    if (!!frame) {
      state.nestedFrames.push({
        source: source,
        element: frame
      });
    }
  }

  // Forget nested frames when their DOM is unloaded.
  // Invoked when the nested frame posts an event on DOM unload event.
  function onUnloadFrame (data, source) {
    // Remove the frame tuple if we know about it.
    var index = state.nestedFrames.findIndex(tuple => tuple.source === source);
    if (index >= 0) {
      state.nestedFrames.splice(index, 1);
    }
  }

  // Get the relevant parts of the mouse event as an object.
  function getMouseData (event, elementInfo) {
    var data = {
      button: event.button,
      x: event.clientX,
      y: event.clientY,
      dx: event.movementX,
      dy: event.movementY
    };

    data.context = {
      scriptFrameId: state.scriptFrameId,
      frameUrl: String(window.location.href)
    };

    var target = event.target;
    if (elementInfo && target) {
      // Collect information about the target element. This object must be
      // serializeable for compatabiltiy with postMessage() and sendMessage().
      data.element = {
        tag: target.tagName,
        href: target.href,

        // Search for a media URL related to the element.
        mediaUrl: modules.helpers.getMediaUrl(target)
      };
    }

    return data;
  }

  // Offset the x,y-coordinates of a mouse event by the x,y position of the
  // frame element containing the source window.
  function applyFrameOffset (data, source) {
    var tuple = state.nestedFrames.find(tuple => tuple.source === source);
    if (!!tuple) {
      var bounds = tuple.element.getBoundingClientRect();
      data.x += bounds.x;
      data.y += bounds.y;
    }
  }

  // Cancel any in progress gesture.
  function cancelGesture () {
    // Replicate state to nested frames.
    replicateState({
      gestureState: PROGRESS_NONE
    });
  }

  // Invoked by the mousedown event.
  // The event may have bubbled up from nested frames.
  function onMouseDown (data) {
    if (data.button === settings.gestureButton && !state.isUnloading) {
      // Replicate state to nested frames.
      replicateState({
        gestureState: PROGRESS_MOUSE_DOWN,
        contextMenu: true
      });

      // Start a gesture.
      modules.handler.begin(data);
    }
  }

  // Invoked by the mouseup event.
  // The event may have bubbled up from nested frames.
  function onMouseUp (data) {
    if ((data.button === settings.gestureButton) && state.gestureState) {
      // Replicate state to nested frames.
      replicateState({
        gestureState: PROGRESS_NONE
      });

      // Finish a gesture.
      modules.handler.finish(data);
    }
  }

  // Invoked by the mousemove event.
  // The event may have bubbled up from nested frames.
  function onMouseMove (data) {
    switch (state.gestureState) {
      case PROGRESS_MOUSE_DOWN:
        // Replicate state to nested frames.
        replicateState({
          gestureState: PROGRESS_MOUSE_MOVE,
          contextMenu: false
        });
        /* falls through*/
      case PROGRESS_MOUSE_MOVE:
        // Update a gesture.
        modules.handler.update(data);
        break;
    }
  }

  // Invoked by the contextmenu event.
  // The event may have bubbled up from nested frames.
  function onContextMenu () {
    // The event listener will call preventDefault() on the native event when
    // necessary since it must be done synchronously.

    // Re-enable the context menu for subsequent clicks.
    if (!state.contextMenu) {
      replicateState({
        contextMenu: true
      });
    }
  }

  return {
    scriptFrameId: state.scriptFrameId,
    broadcast: broadcast,
    cancelGesture: cancelGesture
  };

}());
