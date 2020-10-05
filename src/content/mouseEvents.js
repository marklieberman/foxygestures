'use strict';

/**
 * This module is responsible for seamlessly unifying mouse events from all frames in a tab.
 */
window.fg.module('mouseEvents', function (exports, fg) {

  // Enum of buttons in event.button.
  // See: https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
  const BUTTON = exports.BUTTON = {
    LEFT: 0,
    MIDDLE: 1,
    RIGHT: 2,
    BUTTON4: 3,
    BUTTON5: 4
  };

  // Enum of buttons event.buttons.
  // See: https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons
  const BUTTONS_MASK = exports.BUTTONS_MASK = {
    NONE: 0x0,
    LEFT: 0x1,
    MIDDLE: 0x4,
    RIGHT: 0x2,
    BUTTON4: 0x8,
    BUTTON5: 0x10,
  };

  // Retrieve the buttons mask for button by indexing the array.
  const GET_BUTTONS_MASK = [
    BUTTONS_MASK.LEFT,
    BUTTONS_MASK.MIDDLE,
    BUTTONS_MASK.RIGHT,
    BUTTONS_MASK.BUTTON4,
    BUTTONS_MASK.BUTTON5
  ];

  // Enum of states in gesture state machine.
  const GESTURE_STATE = exports.GESTURE_STATE = {
    // No gesture in progress.
    NONE: 0,
    // Mouse down on the gesture button has occurred.
    MOUSE_DOWN: 1,
    // Mouse has moved with the gesture button pressed.
    MOUSE_MOVE: 2,
    // Mouse gesture has timed out.
    MOUSE_TIMEOUT: 3,
    // A wheel gesture was performed.
    WHEEL: 4,
    // A chord gesture was performed.
    CHORD: 5
  };

  // Enum of types of devices that generate input.
  // See: MouseEvent.mozInputSource
  const INPUT_SOURCE = exports.INPUT_SOURCE = {
    UNKNOWN: 0,
    MOUSE: 1,
    PEN: 2,
    ERASER: 3,
    CURSOR: 4,
    TOUCH: 5,
    KEYBOARD: 6
  };

  // A unique identifier for this frame.
  // Used by commands to target a specific nested frame.
  exports.scriptFrameId = fg.helpers.makeScriptFrameId();

  // State for this module.
  const state = (exports.state = {
    isNested: (window !== window.top), // Is this frame nested?
    nestedFrames: [],                  // Array of all nested frames.
    frameScrolling: null,              // Scrolling attribute for this frame.
    listenersInstalled: false,         // Are event listeners installed?
    isUnloading: false,                // Is the page is unloading?
    gestureState: GESTURE_STATE.NONE,  // Gesture state machine state.
    chordButtons: [],                  // Buttons in the chord gesture.
    contextMenu: false,                // Context menu is enabled?
    preventClick: false,               // Prevent handling of clicks when truthy.
    deadTimeHandle: null,              // Timeout for click preventing dead time.
    lastContextMenu: 0,                // Time of last contextmenu event.
    stickyEventCount: 0                // Number of consecutive sticky mousemove events.
  });

  // Settings for this module.
  const settings = fg.helpers.initModuleSettings({
    gestureButton: BUTTON.RIGHT,
    gestureFidelity: 10,
    disableOnAlt: true,
    disableOnShift: true,
    canSelectStart: false,
    wheelGestures: false,
    chordGestures: false,
    deadTimeMillis: 300
  }, 'local');

  if (state.isNested) {
    // Notify the parent script instance that a nested frame has loaded.
    postTo(window.parent, 'loadFrame', { id: exports.scriptFrameId });
  }

  // Event listeners ---------------------------------------------------------------------------------------------------

  // Need to handle messages to establish the frame hierarchy.
  window.addEventListener('message', onMessage);

  // Install native event listeners in this frame and all nested frames.
  exports.installEventListeners = function () {
    if (!state.listenersInstalled) {
      window.addEventListener('unload', onUnload);
      window.addEventListener('mousedown', onMouseDown, true);
      window.addEventListener('mouseup', onMouseUp, true);
      window.addEventListener('mousemove', onMouseMove, true);
      window.addEventListener('touchstart', onTouchStart, true);
      window.addEventListener('wheel', onWheel, true);
      window.addEventListener('click', onClick, true);
      window.addEventListener('dblclick', onDblClick, true);
      window.addEventListener('contextmenu', onContextMenu, true);
      window.addEventListener('selectstart', onSelectStart);
      window.addEventListener('dragstart', onDragStart);
    }
    state.listenersInstalled = true;

    // Ensure nested frames install listeners as well.
    exports.broadcast('installEventListeners');
  };

  // Remove native event listeners in this frame and all nested frames.
  exports.removeEventListeners = function () {
    if (state.listenersInstalled) {
      window.removeEventListener('unload', onUnload);
      window.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('mouseup', onMouseUp, true);
      window.removeEventListener('mousemove', onMouseMove, true);
      window.removeEventListener('touchstart', onTouchStart, true);
      window.removeEventListener('wheel', onWheel, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('dblclick', onDblClick, true);
      window.removeEventListener('contextmenu', onContextMenu, true);
      window.removeEventListener('selectstart', onSelectStart);
      window.removeEventListener('dragstart', onDragStart);
    }
    state.listenersInstalled = false;

    // Ensure nested frames remove listeners as well.
    exports.broadcast('removeEventListeners');
  };

  function onMessage (event) {
    if (event.data) {
      switch (event.data.topic) {
        case 'mg-installEventListeners':
          exports.installEventListeners();
          break;
        case 'mg-removeEventListeners':
          exports.removeEventListeners();
          break;
        case 'mg-stateUpdate':
          // State replication messages should only go down the hierarchy.
          if (event.source.window === window.parent) {
            exports.replicateState(event.data.data);
          }
          break;

        // Frame hierarchy.
        case 'mg-loadFrame':
          onLoadFrame(event.data.data, event.source);
          break;
        case 'mg-unloadFrame':
          onUnloadFrame(event.data.data, event.source);
          break;
        case 'mg-frameInfo':
          onFrameInfo(event.data.data, event.source);
          break;

        // Messages that may bubble up from nested frames and require applyFrameOffset() to be applied.
        case 'mg-mousedown':
          // This should never be dispatched from a frame above.
          if ((event.source.window !== window.parent) && (event.source.window !== window.top)) {
            // Offset the x,y-coordinates by the source element's position.
            applyFrameOffset(event.data.data, event.source);
            if (state.isNested) {
              // Refer this event up the hierarchy.
              postTo(window.parent, 'mousedown', event.data.data);
            } else {
              onBubbledMouseDown(event.data.data);
            }
          }
          break;
        case 'mg-mouseup':
          // This should never be dispatched from a frame above.
          if ((event.source.window !== window.parent) && (event.source.window !== window.top)) {
            // Offset the x,y-coordinates by the source element's position.
            applyFrameOffset(event.data.data, event.source);
            if (state.isNested) {
              // Refer this event up the hierarchy.
              postTo(window.parent, 'mouseup', event.data.data);
            } else {
              onBubbledMouseUp(event.data.data);
            }
          }
          break;

        // Note: applyFrameOffset() is not required as the following messages are posted directly to window.top.
        case 'mg-mousemove':
          onBubbledMouseMove(event.data.data);
          break;
        case 'mg-touchstart':
          onBubbledTouchStart(event.data.data);
          break;
        case 'mg-wheel':
          onBubbledWheel(event.data.data);
          break;
        case 'mg-contextmenu':
          onBubbledContextMenu(event.data.data);
          break;

        // Async content work handlers for nested frames.
        case 'mg-getCanvasImage':
          exports.onGetCanvasImage(event.data.data);
          break;
        case 'mg-getSelectedLinks':
          exports.onGetSelectedLinks(event.data.data);
          break;
      }
    }
  }

  function onMouseDown (event) {
    // Ignore untrusted events, events while Alt/Shift are pressed, and events that need not be handled.
    if (shouldIgnoreEvent(event) || ignoreButtonNotUsedByGesture(event)) { return; }

    // Record the original mouse event.
    state.mouseDown = event;

    // Prevent handling of mousedown events during a gesture.
    if (state.gestureState) {
      event.preventDefault();
      event.stopPropagation();
    }

    var data = getMouseData(event, true);
    if (state.isNested) {
      // Post to parent - must apply frame offsets.
      postTo(window.parent, 'mousedown', data);
    } else {
      onBubbledMouseDown(data);
    }
  }

  function onMouseUp (event) {
    // Ignore untrusted events, events while Alt/Shift are pressed, and events that need not be handled.
    if (shouldIgnoreEvent(event) || ignoreButtonNotUsedByGesture(event)) { return; }

    // Prevent handling of mouseup events during a gesture.
    if (state.gestureState &&
        (state.gestureState !== GESTURE_STATE.MOUSE_DOWN)
    ) {
      event.preventDefault();
      event.stopPropagation();
    }

    var data = getMouseData(event, true);
    if (state.isNested) {
      // Post to parent - must apply frame offsets.
      postTo(window.parent, 'mouseup', data);
    } else {
      onBubbledMouseUp(data);
    }
  }

  function onMouseMove (event) {
    // Ignore untrusted events and events when Alt is pressed.
    if (shouldIgnoreEvent(event)) { return; }

    // Only handle mousemove events during a gesture.
    if (state.gestureState) {
      var data = getMouseData(event);
      if (state.isNested) {
        // Send directly to top.
        postTo(window.top, 'mousemove', data);
      } else {
        onBubbledMouseMove(data);
      }
    }
  }

  function onTouchStart (event) {
    var data = getMouseData(event);
    if (state.isNested) {
      // Send directly to top.
      postTo(window.top, 'mousemove', data);
    } else {
      onBubbledTouchStart(data);
    }
  }

  function onWheel (event) {
    // Ignore untrusted events and events when Alt is pressed.
    if (shouldIgnoreEvent(event)) { return; }

    // Only handle wheel events (if enabled) during a gesture.
    if (settings.wheelGestures && state.gestureState) {
      // Cancel scrolling.
      event.preventDefault();

      var data = getMouseData(event);
      if (state.isNested) {
        // Send directly to top.
        postTo(window.top, 'wheel', data);
      } else {
        onBubbledWheel(data);
      }
    }
  }

  function onClick (event) {
    // Ignore untrusted events and events when Alt is pressed.
    if (shouldIgnoreEvent(event)) { return; }

    // Prevent default actions for all clicks on any button during a gesture.
    if (state.preventClick ||
      (state.gestureState !== GESTURE_STATE.NONE) &&
      (state.gestureState !== GESTURE_STATE.MOUSE_DOWN)
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function onDblClick (event) {
    // Ignore untrusted events and events when Alt is pressed.
    if (shouldIgnoreEvent(event)) { return; }

    // Prevent double clicks during chord gestures. These sometimes happen due to the initial mousedown "leaking"
    // since a gesture hasn't started. This is really annoying if it takes a HTML5 video to fullscreen.
    if (state.preventClick || state.gestureState) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function onContextMenu (event) {
    // Disable the context menu event after a gesture.
    if (!state.contextMenu ||
      (state.gestureState !== GESTURE_STATE.NONE) &&
      (state.gestureState !== GESTURE_STATE.MOUSE_DOWN)
    ) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (settings.chordGestures) {
      // See: #307 - without this device type check, context menu is broken on touch screens.
      if (event.mozInputSource === INPUT_SOURCE.MOUSE) {
        // When the gesture button is left or middle on Linux/OSX, context fires on mousedown. Only do the following
        // check if the contextmenu event is fired on mouseup.
        if (settings.gestureButton === BUTTON.RIGHT) {
          // Suppress context menu if one or more buttons are pressed. This reduces the chance of showing the context
          // menu when restoring tabs with chord gestures. For example, when repeating Undo Close command.
          if (event.buttons !== BUTTONS_MASK.NONE) {
            event.preventDefault();
            event.stopPropagation();
          }
        }
      }
    }

    if (state.isNested) {
      // Send directly to top.
      postTo(window.top, 'contextmenu');
    } else {
      onBubbledContextMenu();
    }
  }

  function onSelectStart (event) {
    // Prevent a selection from starting during a gesture.
    // Allow text selection if explicitly enabled by settings.
    if (!settings.canSelectStart &&
      (state.gestureState !== GESTURE_STATE.NONE)
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function onDragStart (event) {
    // Prevent a drag and drop from starting during a gesture.
    if (state.gestureState !== GESTURE_STATE.NONE) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function onUnload (event) {
    state.isUnloading = true;
    if (state.isNested) {
      postTo(window.parent, 'unloadFrame');
    }
  }

  // Functions ---------------------------------------------------------------------------------------------------------

  // True if an event must not be handled by the addon, otherwise false.
  function shouldIgnoreEvent (event) {
    return (
      // Ignore untrusted or synthetic events.
      !event.isTrusted ||
      // Ignore events when Alt or Shift are configured to disable gestures.
      (settings.disableOnAlt && event.altKey) || (settings.disableOnShift && event.shiftKey) ||
      // Ignore events during unload.
      state.isUnloading
    );
  }

  // True if the event does not need to be handled because no enabled gesture type can handle it, otherwise false.
  function ignoreButtonNotUsedByGesture (event) {
    if (event.button == BUTTON.RIGHT) {
      // See #329 - must handle the right button to enable the context menu.
      return false;
    }

    if (!settings.chordGestures) {
      // Ignore the non-gesture button if chord gestures are disabled.
      return (event.button !== settings.gestureButton);      
    }

    return false;
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
  exports.broadcast = function (topic, data) {
    state.nestedFrames.forEach(tuple => {
      try {
        tuple.source.postMessage({
          topic: 'mg-' + topic,
          data: data || {}
        }, '*');
      } catch (err) {}
    });
  };

  // Modify the state and replicate the changes to nested frames.
  exports.replicateState = function (newState) {
    // Refer this event down the hierarchy.
    Object.assign(state, newState);
    exports.broadcast('stateUpdate', newState);
  };

  // Reset all state associated with gestures.
  exports.abortGesture = function (extraState) {
    // Cancel any pending state changes.
    if (state.deadTimeHandle !== null) {
      window.clearTimeout(state.deadTimeHandle);
    }

    exports.replicateState(Object.assign({
      gestureState: GESTURE_STATE.NONE,
      chordButtons: [],
      contextMenu: true,
      preventClick: false
    }, extraState || {}));
  };

  // Invoke preventDefault() on click events for the given number of milliseconds.
  exports.clickDeadTime = function (beforeState, afterState, millis) {
    // Prevent clicks and contextmenu event from being handled.
    exports.replicateState(Object.assign({
      preventClick: true
    }, beforeState || {}));

    // Re-enable clicks and contextmenu events after the timeout.
    if (state.deadTimeHandle !== null) {
      window.clearTimeout(state.deadTimeHandle);
    }
    state.deadTimeHandle = window.setTimeout(() => {
      exports.replicateState(Object.assign({
        preventClick: false
      }, afterState || {}));
      state.deadTimeHandle = null;
    }, millis || settings.deadTimeMillis || 300);
  };

  // This is a catch-all handler for sticky gesture scenarios. Every gesture requires at least one button to be
  // pressed. Therefore, if no buttons are pressed during a gesture state it must be a sticky gesture scenario.
  // This happens most often when the mouse leaves the DOM during a gesture and some mouse events are not able to
  // be handled.
  // Note: OSX will occasionally fire a mousemove event with buttons = 0 at the moment a button is released, just
  // before the mouseup event. This is handled by requiring two consecutive sticky mousemove events to trigger the
  // sticky gesture.
  function stickyGestureCheck (data) {
    if (data.buttons === BUTTONS_MASK.NONE) {
      // Sticky gesture detected.
      if (state.stickyEventCount++ > 1) {
        console.log('sticky gesture detected', state.gestureState);
        exports.abortGesture();
        return true;
      }
    } else {
      // Gesture is not sticky.
      state.stickyEventCount = 0;
      return false;
    }
  }

  // Get the relevant parts of the mouse event as an object.
  // The return value must be serializeable for compatabiltiy with postMessage() and sendMessage().
  function getMouseData (event, detailed) {
    // Xray Vision considers this data object to be cross origin when it originates in a frame.
    // You cannot attach object or array properties to cross-origin objects.
    // This can impact handlers in parent frames, so you can stub empty properties here.
    var data = {
      button: event.button,
      buttons: event.buttons,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      chord: [],
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
        originFrameId: exports.scriptFrameId,
        frameUrl: String(window.location.href)
      };

      // Information about the target element: tag, href, etc.
      // Note: not necessarily properties of the element itself.
      // These can be properties of enclosing elements.
      data.element = {
        tag: event.target.tagName
      };

      // Search for a media URL related to the element.
      let mediaInfo = fg.helpers.getMediaInfo(event.target);
      if (mediaInfo) {
        data.element.mediaSource = mediaInfo.source;
        data.element.mediaType = mediaInfo.type;
      }

      // Collect information about the enclosing link if present.
      let linkElement = fg.helpers.findLinkElement(event.target);
      if (linkElement) {
        data.element.linkHref = linkElement.href;
        data.element.linkText = fg.helpers.gatherTextUnder(linkElement);
      }

      // Collect selected text if present.
      let selectedText = fg.helpers.selectedText(event.target);
      if (selectedText) {
        data.element.selectedText = selectedText;
      }
    }

    return data;
  }

  // Nested frames -----------------------------------------------------------------------------------------------------

  // Remember nested frames when their DOM is parsed.
  // Invoked when the nested frame posts an event at document_start.
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
      // Attempt to get the computed styles for the frame.
      let style = window.getComputedStyle(frame) || {
        paddingTop: 0,
        paddingLeft: 0
      };

      state.nestedFrames.push({
        scriptFrameId: data.id,
        source: source,
        element: frame,
        // Record properties that can affect the offset calculation.
        // Padding introduces an offset when drawing the trails.
        paddingTop: parseFloat(style.paddingTop) || 0,
        paddingLeft: parseFloat(style.paddingLeft) || 0,
      });

      // Ensure that the nested frame installs listeners when enabled.
      if (state.listenersInstalled) {
        postTo(source, 'installEventListeners');
      }

      // Report some frame attributes back to the script in the nested frame.
      // Be careful not to leak anything inappropriate like URLs.
      postTo(source, 'frameInfo', {
        frameScrolling: frame.getAttribute('scrolling')
      });
    }

    // The browserAction title/icon gets reset when a frame loads in a tab even if the tab hasn't navigated.
    // Ensure that it remains in sync with the actual listener status.
    if (!state.isNested) {
      window.setTimeout(() => exports.resetBrowserAction(), 0);
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

  // The parent script will post back some useful frame attributes.
  // Invoked as a response to the mg-loadFrame event.
  function onFrameInfo (data, source) {
    // The scolling attribute is useful for scroll commands.
    state.frameScrolling = data.frameScrolling;
  }

  // Offset the x,y-coordinates of a mouse event by the x,y position of the frame element containing the source window.
  function applyFrameOffset (data, source) {
    var tuple = state.nestedFrames.find(tuple => tuple.source === source);
    if (!!tuple) {
      var bounds = tuple.element.getBoundingClientRect();
      data.x += bounds.x + tuple.paddingLeft;
      data.y += bounds.y + tuple.paddingTop;
    }
  }

  // Bubbled event handlers --------------------------------------------------------------------------------------------

  // Invoked by the mousedown event.
  // The event may have bubbled up from nested frames.
  function onBubbledMouseDown (data, event) {
    // Keep a reference to the data for this mousedown event.
    state.mouseDownData = data;

    // Set the script frame ID of the top level frame.
    data.context.topFrameId = exports.scriptFrameId;

    // Handle or update the chord gesture state when enabled.
    if (settings.chordGestures && buttonDownChordGesture(data)) { return; }

    // Start a mouse gesture if the gesture button was pressed.
    if (data.button === settings.gestureButton) {
      exports.replicateState({
        gestureState: GESTURE_STATE.MOUSE_DOWN,
        contextMenu: true
      });
      exports.mouseGestureStart(data);

      // Reset the accumulated mouse delta on mouse down.
      state.mouseAccumulator.reset();
    } else
    // Ensure the context menu is enabled for non-gestures.
    if (data.button === BUTTON.RIGHT) {
      exports.replicateState({
        contextMenu: true
      });
    }
  }

  // Support chord gestures by handling mousedown events.
  // This method is called by onBubbledMouseDown().
  // Return false to end handling of the mouse down event.
  function buttonDownChordGesture (data) {
    // Add the pressed button to the chord on mouse down.
    // Do not allow duplicates which may occur during tab changes or from missed events.
    if (!state.chordButtons.some(button => button === data.button)) {
      state.chordButtons.push(data.button);
    }

    // Remove any button that is not currently pressed which may occur due to the above.
    state.chordButtons = state.chordButtons.filter(button => data.buttons & GET_BUTTONS_MASK[button]);

    // Handle this mousedown event once two or more buttons are pressed..
    if (state.chordButtons.length >= 2) {
      // Switch state to chord gesture mode.
      exports.replicateState({
        gestureState: GESTURE_STATE.CHORD,
        contextMenu: false,
        lastContextMenu: 0 // Right-clicks should not count towards the double right-click contextmenu.
      });

      // Copy the chord into the event data.
      data.chord.push(...state.chordButtons);

      // Handle a chord gesture.
      window.setTimeout(() => exports.chordGesture(data), 0);

      // Cancel further handling of the mousedown event.
      return true;
    }
  }

  // Invoked by the mouseup event.
  // The event may have bubbled up from nested frames.
  function onBubbledMouseUp (data) {
    // Handle or update the chord gesture state when enabled.
    if (settings.chordGestures && buttonUpChordGesture(data)) { return; }

    // Set the script frame ID of the top level frame.
    data.context.topFrameId = exports.scriptFrameId;

    // End a mouse gesture if the gesture button was released.
    if (data.button === settings.gestureButton) {
      switch (state.gestureState) {
        case GESTURE_STATE.MOUSE_DOWN:
          exports.abortMouseGesture();
          exports.replicateState({
            gestureState: GESTURE_STATE.NONE
          });
          break;
        case GESTURE_STATE.MOUSE_MOVE:
          // Finish a mouse gesture.
          exports.mouseGestureFinish(data);
          /* falls through */
        case GESTURE_STATE.WHEEL:
        case GESTURE_STATE.MOUSE_TIMEOUT:
          // Finish a wheel gesture.
          exports.clickDeadTime({
            gestureState: GESTURE_STATE.NONE,
            // Prevent the context menu if the gesture button is right.
            contextMenu: (settings.gestureButton !== BUTTON.RIGHT)
          });
          break;
      }
    }
  }

  // Support chord gestures by handling mouseup events.
  // This method is called by onBubbledMouseUp().
  // Return false to end handling of the mouse up event.
  function buttonUpChordGesture (data) {
    // Remove any button that is not currently pressed.
    state.chordButtons = state.chordButtons.filter(button => data.buttons & GET_BUTTONS_MASK[button]);

    // Handle this mouseup event during a chord gesture.
    if (state.gestureState === GESTURE_STATE.CHORD) {
      // End the chord gesture once all buttons have been released.
      if (state.chordButtons.length === 0) {
        // Exit the gesture state and impose a click handling dead time. The contextmenu event may or may not fire for
        // certain button combinations, so use dead-time as a best effort prevention.
        exports.clickDeadTime({
          gestureState: GESTURE_STATE.NONE,
          contextMenu: false
        }, {
          contextMenu: true
        });
      }

      // Cancel further handling of the mouse up event.
      return true;
    }
  }

  // Invoked by the mousemove event.
  // The event may have bubbled up from nested frames.
  function onBubbledMouseMove (data) {
    // Perform a check on gesture state and buttons.
    if (!stickyGestureCheck(data)) {
      // Limit the fidelity of gesture updates. This has two effects: 1) a gesture will not start until gestureFidelity
      // pixels in distance are covered, and 2) movements are smoothed to avoid rapid changes in gesture direction. The
      // mouse accumulator instance is added to the state by handler.js, so it only exists in the top window/frame.
      state.mouseAccumulator.accumulate(data);
      if (fg.helpers.distanceDelta(data) >= settings.gestureFidelity) {
        // Reset the accumulated mouse delta.
        state.mouseAccumulator.reset();

        // Start or update a mouse gesture.
        switch (state.gestureState) {
          case GESTURE_STATE.MOUSE_DOWN:
            // The mouse has moved while the gesture button is pressed.
            exports.replicateState({
              gestureState: GESTURE_STATE.MOUSE_MOVE,
              lastContextMenu: 0 // Right-clicks should not count towards the double right-click contextmenu.
            });
            /* falls through */
          case GESTURE_STATE.MOUSE_MOVE:
            // Update the mouse gesture.
            exports.mouseGestureUpdate(data);
            break;
        }
      }
    }
  }

  // Invoked by the touchstart event.
  // The event may have bubbled up from nested frames.
  function onBubbledTouchStart (data) {
    // Enable the context menu when a touch starts, otherwise long-press context menu will fail to appear.
    exports.replicateState({
      contextMenu: true
    });
  }

  // Invoked by the wheel event.
  // The event may have bubbled up from nested frames.
  function onBubbledWheel (data) {
    // Perform a check on gesture state and buttons.
    if (settings.wheelGestures && !stickyGestureCheck(data)) {
      // Start or update a wheel gesture.
      switch (state.gestureState) {
        case GESTURE_STATE.MOUSE_DOWN:
        case GESTURE_STATE.MOUSE_MOVE:
        case GESTURE_STATE.CHORD:
          // Transition gesture state to wheel gesture.
          exports.replicateState({
            gestureState: GESTURE_STATE.WHEEL
          });

          // Handle a wheel gesture.
          exports.wheelGestureInitial(data);
          break;
        case GESTURE_STATE.WHEEL:
          // Update the wheel gesture.
          exports.wheelGestureRepeat(data);
          break;
      }
    }
  }

  // Invoked by the contextmenu event.
  // The event may have bubbled up from nested frames.
  function onBubbledContextMenu () {
    // Re-enable the context menu for subsequent clicks. The event listener will call preventDefault() on the native
    // event while contextMenu is false.
    if (!state.contextMenu) {
      exports.replicateState({
        contextMenu: true
      });
    }
  }

  // Content work handlers ---------------------------------------------------------------------------------------------

  // Setup a promise to be resolved with data from a possibly nested frame. Then recursively broadcast a message to
  // invoke handler in the origin frame. The first argument to handler() is a resolver to be invoked with a result.
  function broadcastContentWork (data, work, handler) {
    // Expect to find the canvas in the origin frame.
    if (data.context.originFrameId === exports.scriptFrameId) {
      let result = false;
      handler(value => {
        // Either resolve immediately or post up to the top frame.
        if (state.isNested) {
          postTo(window.top, 'gotContentResolve', value);
        } else {
          result = Promise.resolve(value);
        }
      });
      return result;
    } else
    if (state.isNested) {
      // The originFrameId didn't match so keep searching the hierarchy of frames.
      exports.broadcast(work, data);
    } else {
      // This case is only reached in the top frame when the originFrameId doesn't match.
      // Return a promise that is resolved when any nested frame locates the canvas.
      return new Promise((resolve, reject) => {
        // Store a reference to the resolver function for later.
        state.getContentResolve = resolve;
        exports.broadcast(work, data);
      });
    }
  }

  // Get the image data from a canvas.
  exports.onGetCanvasImage = function (data) {
    return broadcastContentWork(data, 'getCanvasImage', resolve => {
      // Locate the referenced canvas.
      let canvas = document.querySelector('canvas[data-fg-ref="' + data.element.mediaSource + '"]');
      if (canvas) {
        // Replace the canvas reference with actual image data.
        data.element.mediaSource = canvas.toDataURL();
        data.element.mediaType = 'image/png';
        resolve(data);
      } else {
        // Canvas cannot be located.
        data.element.mediaSource = null;
        data.element.mediaType = null;
        resolve(data);
      }
    });
  };

  // Get all links in the selection.
  exports.onGetSelectedLinks = function (data) {
    return broadcastContentWork(data, 'getSelectedLinks', resolve => {
      // Find all the selected links in the frame with href attributes.
      let selection = window.getSelection();
      let links = Array.from(document.getElementsByTagName('a'))
        .filter(a => !!a.href && selection.containsNode(a, true))
        .map(a => a.href);

      // Discard duplicate links in the selection.
      resolve(Array.from(links.reduce((set, href) => set.add(href), new Set())));
    });
  };

});
