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
    timeoutHandle: null, // Gesture timeout interval handle.
    noMovementTicks: 0,  // Number of 100ms ticks without movement.
    mouseDown: null      // Mouse event at the start of gesture.
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
        // Restore a clone of the state.
        exports.replicateState(message.data);
        break;
      case 'mg-abortGesture':
        // Cancel any in-progress gesture state.
        exports.abortMouseGesture(true);
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
  exports.mouseGestureStart = function (mouseDown) {
    // Start tracking the gesture.
    deltaAccumulator.reset();
    gestureDetector.reset(mouseDown);
    state.mouseDown = mouseDown;

    // Paint the gesture trail.
    if (settings.drawTrails) {
      fg.ui.beginTrail(mouseDown);
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
            exports.abortMouseGesture(true);
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
          context: state.mouseDown.context,
          element: state.mouseDown.element,
          gesture: gesture
        }
      });
    }
  };

  // Abort a mouse gesture and reset the interface.
  exports.abortMouseGesture = function (resetState) {
    // Clear the gesture timeout interval.
    window.clearInterval(state.timeoutHandle);
    state.timeoutHandle = null;

    // Hide the gesture trail.
    if (settings.drawTrails) {
      fg.ui.finishTrail();
    }

    // Hide the status text.
    if (settings.showStatusText) {
      fg.ui.status(null);
    }

    // Optionally reset the low level gesture state.
    if (resetState) {
      exports.replicateState({
        gestureState: exports.GESTURE_STATE.NONE
      });
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

  // Invoked when a mouse gesture transitions to a wheel gesture.
  exports.wheelGestureStart = function (data) {
    // Abort the mouse gesture.
    exports.abortMouseGesture(false);

    // Handle the wheel gesture.
    let gesture = getWheelDirection(data.wheel);
    let handler = browser.runtime.sendMessage({
      topic: 'mg-wheelGesture',
      data: {
        context: state.mouseDown.context,
        element: state.mouseDown.element,
        gesture: gesture,

        // If the wheel gesture changes the active tab, then the gesture state must be cloned to the new active tab.
        cloneState: {
          gestureState: state.gestureState,
          contextMenu: state.contextMenu,
          mouseDown: state.mouseDown
        }
      }
    });

    handler.then(result => {
      if (!result) {
        // Do nothing.
      } else
      if (result.cleanup) {
        // Cleanup the gesture state.
        exports.abortMouseGesture(true);
      } else
      if (result.popup)  {
        // TODO Not implemented yet.
      }
    });
  };

  // Invoked on subsequent scroll events during a wheel gesture.
  // TODO This will change when popups are implemented.
  exports.wheelGestureUpdate = exports.wheelGestureStart;

});
