'use strict';

/**
 * This module is responsible for painting the gesture trail.
 * No attempt is made to draw a trail if the document body is not loaded.
 */
var modules = modules || {};
modules.trails = (function () {

  // State for this module.
  var state = {
    body: null,   // Element in which to append the canvas.
    canvas: null, // The canvas element on which to draw.
    ctx: null,    // 2D drawing context from the canvas.
    x: 0, y: 0    // The last mouse position.
  };

  // Settings for this module.
  var settings = {
    trailFidelity: 10,
    trailWidth: 2,
    trailColor: '#6666cc'
  };

  var deltaAccumulator = new MouseDeltaAccumulator();

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

  // Store the initial position of the mouse.
  function begin (mouseDown) {
    // Set the initial mouse position.
    state.x = mouseDown.x;
    state.y = mouseDown.y;
  }

  // Start or continue painting the gesture trail.
  function update (mouseMove) {
    // Require a minimum distance travelled before painting will occur.
    deltaAccumulator.accumulate(mouseMove);
    if (modules.helpers.distanceDelta(mouseMove) >= settings.trailFidelity) {
      deltaAccumulator.reset();

      // Determine which the body element if unset.
      if (!state.body) {
        if (document.body) {
          // Use the HTML node for framesets. Placing the canvas under the HTML
          // node is of questionable validity but it works.
          state.body = (document.body.tagName === 'FRAMESET') ?
            document.body.parentNode : document.body;
        } else {
          // Document body is not loaded yet.
          return;
        }
      }

      // Create the canvas if this is the first paint.
      if (!state.canvas) {
        // Create the canvas on the first mouse move event.
        state.canvas = document.createElement('canvas');

        // Use fixed positioning and match the window size.
        state.canvas.setAttribute('width', window.innerWidth);
        state.canvas.setAttribute('height', window.innerHeight);
        state.canvas.style.position = 'fixed';
        state.canvas.style.top = 0;
        state.canvas.style.left = 0;
        state.canvas.style.zIndex = 99999;
        state.canvas.style.pointerEvents = 'none';
        state.body.appendChild(state.canvas);

        // Initialize the drawing context.
        state.ctx = state.canvas.getContext('2d');
        state.ctx.lineWidth = settings.trailWidth;
        state.ctx.strokeStyle = settings.trailColor;
        state.ctx.lineCap = "round";
      }

      // Draw a segment of the mouse gesture line.
      state.ctx.beginPath();
      state.ctx.moveTo(state.x, state.y);
      state.x += mouseMove.dx;
      state.y += mouseMove.dy;
      state.ctx.lineTo(state.x, state.y);
      state.ctx.stroke();
    }
  }

  // Remove the canvas element used to paint the gesture.
  function finish () {
    if (!!state.canvas) {
      deltaAccumulator.reset();
      state.body.removeChild(state.canvas);
      state.canvas = null;
      state.ctx = null;
    }
  }

  return {
    begin: begin,
    update: update,
    finish: finish
  };

}());
