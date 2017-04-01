'use strict';

/**
 * This module is responsible for painting the gesture trail.
 */
var modules = modules || {};
modules.trails = (function () {

  // State for this module.
  var state = {
    // Is this body a frameset?
    isFrameset: (document.body && document.body.tagName === 'FRAMESET'),

    // Canvas element and its drawing context.
    canvas: null,
    ctx: null,

    // Coordinates of the mouse on the canvas.
    x: 0,
    y: 0
  };

  // Settings for this module.
  var settings = {
    trailFidelity: 10,
    trailWidth: 2,
    trailColor: '#6666cc'
  };

  var deltaAccumulator = new MouseDeltaAccumulator();

  // Load settings from storage.
  browser.storage.local.get(settings).then(results => {
    settings = results;
  });

  // Listen for changes to settings.
  browser.storage.onChanged.addListener((changes, area) => {
    Object.keys(settings).forEach(key => {
      if (changes[key]) {
        settings[key] = changes[key].newValue;
      }
    });
  });

  // ---------------------------------------------------------------------------

  function getBodyElement () {
    return (state.isFrameset) ? document.body.parentNode : document.body;
  }

  function createCanvas () {
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
    getBodyElement().appendChild(state.canvas);

    // Initialize the drawing context.
    state.ctx = state.canvas.getContext('2d');
    state.ctx.lineWidth = settings.trailWidth;
    state.ctx.strokeStyle = settings.trailColor;
    state.ctx.lineCap = "round";
  }

  function begin (mouseDown) {
    // Set the initial mouse position.
    state.x = mouseDown.x;
    state.y = mouseDown.y;
  }

  function update (mouseMove) {
    // Require a minimum distance travelled before painting will occur.
    deltaAccumulator.accumulate(mouseMove);
    if (modules.helpers.distanceDelta(mouseMove) >= settings.trailFidelity) {
      deltaAccumulator.reset();

      // Create the canvas if this is the first paint.
      if (!state.canvas) {
        createCanvas();
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

  // Remvoe the canvas element used to paint the state.
  function finish () {
    if (state.canvas) {
      deltaAccumulator.reset();
      getBodyElement().removeChild(state.canvas);
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
