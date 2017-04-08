'use strict';

/**
 * This module is responsible for tracking the mouse gesture.
 */
 var modules = modules || {};
modules.gesture = (function () {

  // State for this module.
  var state = {
    timeoutHandle: null, // Gesture timeout interval handle.
    noMovementTicks: 0,  // Number of 100ms ticks without movement.
    mouseDown: null      // Mouse event at the start of gesture.
  };

  // Settings for this module.
  var settings = {
    gestureTimeout: 400,
    gestureFidelity: 10,
    drawTrails: true
  };

  var deltaAccumulator = new MouseDeltaAccumulator();
  var gestureAccumulator = new UDLRGestureDetector();

  // Load settings from storage.
  browser.storage.local.get(settings).then(results => settings = results);

  // Event listeners -----------------------------------------------------------

  // Listen for changes to settings.
  browser.storage.onChanged.addListener((changes, area) => {
    Object.keys(settings).forEach(key => {
      if (changes[key]) {
        settings[key] = changes[key].newValue;
      }
    });
  });

  // ---------------------------------------------------------------------------

  // Invoked when a gesture begins by mouse down.
  function begin (mouseDown) {
    // Start tracking the gesture.
    deltaAccumulator.reset();
    gestureAccumulator.reset(mouseDown);
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
      modules.trails.begin(mouseDown);
    }
  }

  // Invoked when the mouse moves during a gesture.
  function update (mouseMove) {
    // Limit the fidelity of gesture updates to reduce gesture jitter.
    deltaAccumulator.accumulate(mouseMove);
    if (modules.helpers.distanceDelta(mouseMove) >= settings.gestureFidelity) {
      deltaAccumulator.reset();

      // Update the gesture.
      gestureAccumulator.addPoint(mouseMove);

      // Reset the number of ticks without movement.
      state.noMovementTicks = 0;

      // Paint the gesture trail.
      if (settings.drawTrails) {
        modules.trails.update(mouseMove);
      }
    }
  }

  // Invoked when a gesture ends by mouse up.
  function finish (mouseUp) {
    // Clear the gesture timeout interval.
    window.clearInterval(state.timeoutHandle);

    // Hide the gesture trail.
    if (settings.drawTrails) {
      modules.trails.finish();
    }

    // Handle the gesture.
    var gesture = gestureAccumulator.gesture;
    if (gesture) {
      browser.runtime.sendMessage({
        topic: 'mg-gesture',
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
      modules.trails.finish();
    }
  }

  return {
    begin: begin,
    update: update,
    finish: finish
  };

}());
