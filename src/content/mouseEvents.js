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
  // The mouse wheel was scrolled during a gesture.
  // Context menu will not be displayed following the gesture.
  var PROGRESS_WHEEL = 3;

  // State for this module.
  var state = {
    // A unique identifier for this frame.
    // Used by commands to target a specific nested frame.
    scriptFrameId: modules.helpers.makeScriptFrameId(),
    gestureState: PROGRESS_NONE,       // Gesture state machine state.
    contextMenu: false,                // Context menu is enabled?
    isNested: (window !== window.top), // Is this frame nested?
    nestedFrames: [],                  // Array of all nested frames.
    isUnloading: false                 // Is the page is unloading?
  };

  // Settings for this module.
  var settings = {
    gestureButton: 2,
    wheelGestures: false
  };

  // Load settings from storage.
  browser.storage.local.get(settings).then(results => settings = results);

  if (state.isNested) {
    // Notify the parent script instance that a nested frame has loaded.
    postTo(window.parent, 'loadFrame', { id: state.scriptFrameId });
  }

  // Event listeners ---------------------------------------------------------------------------------------------------

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
          // Note: applyFrameOffset() is not required and messages are posted directly to top window.
          onMouseMove(event.data.data);
          break;
        case 'mg-wheel':
          // Note: applyFrameOffset() is not required and messages are posted directly to top window.
          onWheel(event.data.data);
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
    state.mouseDown = event;
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

  window.addEventListener('wheel', function (event) {
    if (settings.wheelGestures && state.gestureState) {
      // Cancel scrolling.
      event.preventDefault();

      var data = getMouseData(event);
      if (state.isNested) {
        // Send directly to top.
        postTo(window.top, 'wheel', data);
      } else {
        onWheel(data);
      }
    }
  }, true);

  window.addEventListener('contextmenu', function (event) {
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

  // Functions ---------------------------------------------------------------------------------------------------------

  // Reset the gesture state.
  function resetState () {
    // Replicate state to nested frames.
    replicateState({
      gestureState: PROGRESS_NONE
    });
  }

  // Get a partial copy of the state; enough to restore this state in another tab.
  function cloneState () {
    return {
      gestureState: state.gestureState,
      contextMenu: state.contextMenu
    };
  }

  // Restore a partial copy of the state for this module.
  function restoreState (clone) {
    replicateState(clone);
  }

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
    if (document.body && document.body.tagName === 'FRAMESET') {
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
  // The return value must be serializeable for compatabiltiy with postMessage() and sendMessage().
  function getMouseData (event, detailed) {
    var data = {
      button: event.button,
      x: event.clientX,
      y: event.clientY,
      dx: event.movementX,
      dy: event.movementY
    };

    if (event instanceof window.WheelEvent) {
      data.wheel = {
        x: event.deltaX,
        y: event.deltaY,
        z: event.deltaZ,
        mode: event.deltaMode
      };
    }

    if (detailed) {
      // Information about the event context: script ID, frame URL, etc.
      data.context = {
        nested: state.isNested,
        scriptFrameId: state.scriptFrameId,
        frameUrl: String(window.location.href)
      };

      // Information about the target element: tag, href, etc.
      // Note: not necessarily properties of the element itself.
      // These can be properties of enclosing elements.
      data.element = {
        tag: event.target.tagName,

        // Search for a link href on or around the element.
        linkHref: modules.helpers.findLinkHref(event.target),

        // Search for a media URL related to the element.
        mediaInfo: modules.helpers.getMediaInfo(event.target)
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

  // Invoked by the mousedown event.
  // The event may have bubbled up from nested frames.
  function onMouseDown (data, event) {
    if (data.button === settings.gestureButton && !state.isUnloading) {
      // Replicate state to nested frames.
      replicateState({
        gestureState: PROGRESS_MOUSE_DOWN,
        contextMenu: true
      });

      // Start a mouse gesture.
      modules.handler.mouseGestureStart(data);
    }
  }

  // Invoked by the mouseup event.
  // The event may have bubbled up from nested frames.
  function onMouseUp (data) {
    if (data.button === settings.gestureButton && state.gestureState) {
      switch (state.gestureState) {
        case PROGRESS_MOUSE_DOWN:
        case PROGRESS_MOUSE_MOVE:
          // Finish a mouse gesture.
          modules.handler.mouseGestureFinish(data);
          break;
      }

      // Replicate state to nested frames.
      replicateState({
        gestureState: PROGRESS_NONE
      });
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
        /* falls through */
      case PROGRESS_MOUSE_MOVE:
        // Update a mouse gesture.
        modules.handler.mouseGestureUpdate(data);
        break;
    }
  }

  // Invoked by the wheel event.
  // The event may have bubbled up from nested frames.
  function onWheel (data) {
    if (settings.wheelGestures) {
      switch (state.gestureState) {
        case PROGRESS_MOUSE_DOWN:
        case PROGRESS_MOUSE_MOVE:
          replicateState({
            gestureState: PROGRESS_WHEEL,
            contextMenu: false
          });

          // Switch handler to wheel gesture mode.
          modules.handler.wheelGestureStart(data);
          break;
        case PROGRESS_WHEEL:
          // Update a wheel gesture.
          modules.handler.wheelGestureUpdate(data);
          break;
      }
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
    // Context
    scriptFrameId: state.scriptFrameId,
    // State management
    resetState: resetState,
    cloneState: cloneState,
    restoreState: restoreState,
    broadcast: broadcast,
    //
    getMouseDown: () => state.mouseDown
  };

}());
