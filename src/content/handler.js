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
      case 'mg-cloneState':
        // Return a clone of the state.
        return Promise.resolve({
          handler: cloneState(),
          mouseEvents: fg.mouseEvents.cloneState()
        });
      case 'mg-restoreState':
        // Restore a clone of the state.
        let clone = message.data;
        restoreState(clone.handler);
        fg.mouseEvents.restoreState(clone.mouseEvents);
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

  // Functions ---------------------------------------------------------------------------------------------------------

  // Get a partial copy of the state; enough to restore this state in another tab.
  function cloneState () {
    return {
      mouseDown: state.mouseDown
    };
  }

  // Restore a partial copy of the state for this module.
  function restoreState (clone) {
    Object.assign(state, clone);
  }

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
            abortMouseGesture(true);
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
  function abortMouseGesture (resetState) {
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
      fg.mouseEvents.resetState();
    }
  }

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
    abortMouseGesture(false);

    // Handle the wheel gesture.
    let gesture = getWheelDirection(data.wheel);
    let handler = browser.runtime.sendMessage({
      topic: 'mg-wheelGesture',
      data: {
        context: state.mouseDown.context,
        element: state.mouseDown.element,
        gesture: gesture
      }
    });

    handler.then(result => {
      if (!result) {
        // Do nothing.
      } else
      if (result.cleanup) {
        // Cleanup the gesture state.
        fg.mouseEvents.resetState();
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
