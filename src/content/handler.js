'use strict';

/**
 * This module is responsible for coordinating gesture state between the
 * background and content scripts.
 */
var modules = modules || {};
modules.handler = (function (settings) {

  // State for this module.
  var state = {
    timeoutHandle: null, // Gesture timeout interval handle.
    noMovementTicks: 0,  // Number of 100ms ticks without movement.
    mouseDown: null      // Mouse event at the start of gesture.
  };

  var deltaAccumulator = new MouseDeltaAccumulator();
  var gestureDetector = new UDLRGestureDetector();

  // Event listeners -----------------------------------------------------------

  // Handle messages from the background script.
  browser.runtime.onMessage.addListener((message, sender) => {
    switch (message.topic) {
      case 'mg-status':
        modules.interface.status(message.data);
        break;
    }
    return false;
  });

  // ---------------------------------------------------------------------------

  // Invoked when a gesture begins by mouse down.
  function begin (mouseDown) {
    // Start tracking the gesture.
    deltaAccumulator.reset();
    gestureDetector.reset(mouseDown);
    state.mouseDown = mouseDown;

    // Start the gesture timeout interval.
    if (settings.gestureTimeout) {
      state.noMovementTicks = 0;
      state.timeoutHandle = window.setInterval(function () {
        if (++state.noMovementTicks >= (settings.gestureTimeout / 100)) {
          timeout();
        }
      }, 100);
    }

    // Paint the gesture trail.
    if (settings.drawTrails) {
      modules.interface.beginTrail(mouseDown);
    }
  }

  // Invoked when the mouse moves during a gesture.
  function update (mouseMove) {
    // Limit the fidelity of gesture updates to reduce gesture jitter.
    deltaAccumulator.accumulate(mouseMove);
    if (modules.helpers.distanceDelta(mouseMove) >= settings.gestureFidelity) {
      deltaAccumulator.reset();

      // Update the gesture.
      if (gestureDetector.addPoint(mouseMove)) {
        browser.runtime.sendMessage({
          topic: 'mg-gestureProgress',
          data: {
            gesture: gestureDetector.gesture
          }
        });
      }

      // Reset the number of ticks without movement.
      state.noMovementTicks = 0;

      // Paint the gesture trail.
      if (settings.drawTrails) {
        modules.interface.updateTrail(mouseMove);
      }
    }
  }

  // Invoked when a gesture ends by mouse up.
  function finish (mouseUp) {
    // Clear the gesture timeout interval.
    window.clearInterval(state.timeoutHandle);

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

  // Invoked when the gesture timeout has elapsed.
  function timeout () {
    // Cancel the gesture (low-level.)
    modules.mouseEvents.cancelGesture();

    // Clear the gesture timeout interval.
    window.clearInterval(state.timeoutHandle);

    // Hide the gesture trail.
    if (settings.drawTrails) {
      modules.interface.finishTrail();
    }

    // Hide the status text.
    if (settings.showStatusText) {
      modules.interface.status(null);
    }
  }

  return {
    begin: begin,
    update: update,
    finish: finish
  };

}(modules.settings));
