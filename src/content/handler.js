'use strict';

/**
 * This module is responsible for coordinating gesture state between the
 * background and content scripts.
 */
window.fg.extend('mouseEvents', function (exports, fg) {

  var deltaAccumulator = new MouseDeltaAccumulator();
  var gestureDetector = new UDLRGestureDetector();

  // State for this module.
  var state = Object.assign(exports.state, {
    disableGestures: false,            // Disable gesture handlers when true.
    timeoutHandle: null,               // Gesture timeout interval handle.
    noMovementTicks: 0                 // Number of 100ms ticks without movement.
  });

  // Settings for this module.
  var settings = fg.helpers.initModuleSettings({
    drawTrails: true,
    gestureFidelity: 10,
    gestureTimeout: 2000,
    showStatusText: true
  });

  // Event listeners ---------------------------------------------------------------------------------------------------

  // Handle messages from the background script.
  browser.runtime.onMessage.addListener((message, sender) => {
    switch (message.topic) {
      case 'mg-applyState':
        // Cancel any pending state changes.
        if (state.deadTimeHandle !== null) {
          window.clearTimeout(state.deadTimeHandle);
          state.deadTimeHandle = null;
        }

        // Restore a clone of the state.
        exports.replicateState(message.data);
        break;
      case 'mg-abortGesture':
        // Cancel any in-progress gesture state using a dead-time. In this way, if a command is handled quickly such
        // that the contextmenu or other events arrive after the abort message, no contextmenu will be shown.
        exports.abortMouseGesture();
        exports.clickDeadTime({
          gestureState: exports.GESTURE_STATE.NONE,
          contextMenu: false
        }, {
          chordButtons: [],
          contextMenu: true
        }, 600);
        break;
      case 'mg-status':
        // Update the status text.
        fg.ui.status(message.data);
        break;
    }
    return false;
  });

  window.addEventListener('message', function (event) {
    if (event.data) {
      switch (event.data.topic) {
        case 'mg-status':
          fg.ui.status(event.data.data);
          break;
      }
    }
  });

  // Mouse gestures ----------------------------------------------------------------------------------------------------

  // Invoked when a mouse gesture begins.
  exports.mouseGestureStart = function (mouseData) {
    // Start tracking the gesture.
    deltaAccumulator.reset();
    gestureDetector.reset(mouseData);

    // Paint the gesture trail.
    if (settings.drawTrails) {
      fg.ui.beginTrail(mouseData);
    }
  };

  // Invoked when the mouse moves during a mouse gesture.
  exports.mouseGestureUpdate = function (mouseMove) {
    // Limit the fidelity of gesture updates to reduce gesture jitter.
    deltaAccumulator.accumulate(mouseMove);
    if (fg.helpers.distanceDelta(mouseMove) >= settings.gestureFidelity) {
      deltaAccumulator.reset();

      // Reset the number of ticks without movement.
      state.noMovementTicks = 0;

      // Start the gesture timeout interval.
      if (settings.gestureTimeout && !state.timeoutHandle) {
        state.timeoutHandle = window.setInterval(function () {
          if (++state.noMovementTicks >= (settings.gestureTimeout / 100)) {
            // Abort the mouse gesture but ensure context menu and clicks are prevented.
            exports.abortMouseGesture();
            exports.replicateState({
              gestureState: exports.GESTURE_STATE.MOUSE_TIMEOUT
            });
          }
        }, 100);
      }

      // Update the gesture.
      if (gestureDetector.addPoint(mouseMove)) {
        browser.runtime.sendMessage({
          topic: 'mg-gestureProgress',
          data: {
            gesture: gestureDetector.gesture
          }
        });
      }

      // Paint the gesture trail.
      if (settings.drawTrails) {
        fg.ui.updateTrail(mouseMove);
      }
    }
  };

  // Invoked when a mouse gesture ends.
  exports.mouseGestureFinish = function (mouseUp) {
    // Clear the gesture timeout interval.
    window.clearInterval(state.timeoutHandle);
    state.timeoutHandle = null;

    // Hide the gesture trail.
    if (settings.drawTrails) {
      fg.ui.finishTrail();
    }

    // Handle the gesture.
    var gesture = gestureDetector.gesture;
    if (gesture) {
      browser.runtime.sendMessage({
        topic: 'mg-mouseGesture',
        data: {
          context: state.mouseDownData.context,
          element: state.mouseDownData.element,
          gesture: gesture
        }
      });
    }
  };

  // Abort a mouse gesture and reset the interface.
  exports.abortMouseGesture = function () {
    // Clear the gesture timeout interval.
    if (state.timeoutHandle) {
      window.clearInterval(state.timeoutHandle);
      state.timeoutHandle = null;
    }

    // Hide the gesture trail.
    if (settings.drawTrails) {
      fg.ui.finishTrail();
    }

    // Hide the status text.
    if (settings.showStatusText) {
      fg.ui.status(null);
    }
  };

  // Wheel gestures ----------------------------------------------------------------------------------------------------

  // Get the gesture corresponding to the scroll direction.
  function getWheelDirection (wheel) {
    if (wheel.y < 0) {
      return 'up';
    } else
    if (wheel.y > 0) {
      return 'down';
    } else
    if (wheel.x < 0) {
      return 'left';
    } else
    if (wheel.x > 0) {
      return 'right';
    }
  }

  // Invoked when a wheel gesture is performed.
  exports.wheelGestureInitial = function (data) {
    if (state.disableGestures) { return; }

    // Handle the wheel gesture.
    let handler = browser.runtime.sendMessage({
      topic: 'mg-wheelGesture',
      data: {
        context: state.mouseDownData.context,
        element: state.mouseDownData.element,
        gesture: getWheelDirection(data.wheel),

        // If the wheel gesture changes the active tab, then the gesture state must be cloned to the new active tab.
        cloneState: {
          mouseDownData: state.mouseDownData,
          gestureState: exports.GESTURE_STATE.WHEEL,
          chordButtons: state.chordButtons,
          contextMenu: state.contextMenu,
          preventClick: state.preventClick
        }
      }
    });

    // Disable gesture handlers until this gesture has been processed by the background script.
    state.disableGestures = true;
    exports.abortMouseGesture();

    // Handle popup items or allow additional wheel gestures to be performed.
    handler.then(result => {
      state.disableGestures = false;

      // Handle popup items if the command is a popup type.
      if (result.popup) {
        // TODO Not implemented yet.
      } else
      // End the gesture if repetition is not allowed.
      if (!result.repeat) {
        exports.abortGesture();
      }
    });
  };

  // Invoked on subsequent scroll events during a wheel gesture.
  // TODO This will change when popups are implemented.
  exports.wheelGestureRepeat = exports.wheelGestureInitial;

  // Chord gestures ----------------------------------------------------------------------------------------------------

  // Invoked when a chord gesture is performed.
  exports.chordGesture = function (data) {
    if (state.disableGestures) { return; }

    // Handle the chord gesture.
    let handler = browser.runtime.sendMessage({
      topic: 'mg-chordGesture',
      data: {
        context: state.mouseDownData.context,
        element: state.mouseDownData.element,
        gesture: data.chord,

        // If the chord gesture changes the active tab, then the gesture state must be cloned to the new active tab.
        cloneState: {
          mouseDownData: state.mouseDownData,
          gestureState: exports.GESTURE_STATE.CHORD,
          chordButtons: state.chordButtons,
          contextMenu: state.contextMenu,
          preventClick: state.preventClick
        }
      }
    });

    // Disable gesture handlers until this gesture has been processed by the background script.
    exports.abortMouseGesture();
    state.disableGestures = true;

    // Handle popup items or allow additional chord gestures to be performed.
    handler.then(result => {
      state.disableGestures = false;

      // Handle popup items if the command is a popup type.
      if (result.popup) {
        // TODO Not implemented yet.
      } else
      // End the gesture if repetition is not allowed.
      if (!result.repeat) {
        exports.abortGesture({
          contextMenu: false
        });
      }
    });

  };

});
