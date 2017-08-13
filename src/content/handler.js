'use strict';

/**
 * This module is responsible for coordinating gesture state between the
 * background and content scripts.
 */
var modules = modules || {};
modules.handler = (function () {

  var deltaAccumulator = new MouseDeltaAccumulator();
  var gestureDetector = new UDLRGestureDetector();

  // State for this module.
  var state = {
    timeoutHandle: null, // Gesture timeout interval handle.
    noMovementTicks: 0,  // Number of 100ms ticks without movement.
    mouseDown: null      // Mouse event at the start of gesture.
  };

  // Settings for this module.
  var settings = modules.helpers.initModuleSettings({
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
          mouseEvents: modules.mouseEvents.cloneState()
        });
      case 'mg-restoreState':
        // Restore a clone of the state.
        let clone = message.data;
        restoreState(clone.handler);
        modules.mouseEvents.restoreState(clone.mouseEvents);
        break;
      case 'mg-status':
        // Update the status text.
        modules.interface.status(message.data);
        break;
    }
    return false;
  });

  window.addEventListener('message', function (event) {
    if (event.data) {
      switch (event.data.topic) {
        case 'mg-status':
          modules.interface.status(event.data.data);
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
  function mouseGestureStart (mouseDown) {
    // Start tracking the gesture.
    deltaAccumulator.reset();
    gestureDetector.reset(mouseDown);
    state.mouseDown = mouseDown;

    // Paint the gesture trail.
    if (settings.drawTrails) {
      modules.interface.beginTrail(mouseDown);
    }
  }

  // Invoked when the mouse moves during a mouse gesture.
  function mouseGestureUpdate (mouseMove) {
    // Limit the fidelity of gesture updates to reduce gesture jitter.
    deltaAccumulator.accumulate(mouseMove);
    if (modules.helpers.distanceDelta(mouseMove) >= settings.gestureFidelity) {
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
        modules.interface.updateTrail(mouseMove);
      }
    }
  }

  // Invoked when a mouse gesture ends.
  function mouseGestureFinish (mouseUp) {
    // Clear the gesture timeout interval.
    window.clearInterval(state.timeoutHandle);
    state.timeoutHandle = null;

    // Hide the gesture trail.
    if (settings.drawTrails) {
      modules.interface.finishTrail();
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
  }

  // Abort a mouse gesture and reset the interface.
  function abortMouseGesture (resetState) {
    // Clear the gesture timeout interval.
    window.clearInterval(state.timeoutHandle);
    state.timeoutHandle = null;

    // Hide the gesture trail.
    if (settings.drawTrails) {
      modules.interface.finishTrail();
    }

    // Hide the status text.
    if (settings.showStatusText) {
      modules.interface.status(null);
    }

    // Optionally reset the low level gesture state.
    if (resetState) {
      modules.mouseEvents.resetState();
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
  function wheelGestureStart (data) {
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
        modules.mouseEvents.resetState();
      } else
      if (result.popup)  {
        // TODO Not implemented yet.
      }
    });
  }

  // Invoked on subsequent scroll events during a wheel gesture.
  function wheelGestureUpdate (data) {
    // TODO This will change when popups are implemented.
    wheelGestureStart(data);
  }

  return {
    mouseGestureStart: mouseGestureStart,
    mouseGestureUpdate: mouseGestureUpdate,
    mouseGestureFinish: mouseGestureFinish,
    wheelGestureStart: wheelGestureStart,
    wheelGestureUpdate: wheelGestureUpdate
  };

}());
