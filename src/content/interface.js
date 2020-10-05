'use strict';

/**
 * This module is responsible for painting the gesture trail.
 * No attempt is made to draw a trail if the document body is not loaded.
 */
window.fg.module('ui', function (exports, fg) {

  var MAX_SAFE_Z_INDEX = 2147483647;

  // State for this module.
  var state = {
    body: null,           // Element in which to append the canvas.
    canvas: null,         // The canvas element on which to draw.
    ctx: null,            // 2D drawing context from the canvas.
    x: 0,                 // The last mouse position.
    y: 0,
    trailMoves: [],       // Pending gesture trail movements to draw.
    animFrameHandle: 0,   // Handles of the requestAnimationFrame callback.
    status: {
      outerElement: null, // Status text outer element.
      innerElement: null, // Status text inner element.
      handle: null        // Status timeout handle.
    },
    popup: {
                          // TODO Not implemented yet.
    }
  };

  // Settings for this module.
  var settings = fg.helpers.initModuleSettings({
    trailColor: 'purple',
    trailWidth: 2,
    showStatusText: false,
    statusTemplate: null,
    statusTimeout: 2000
  }, 'local');

  // -------------------------------------------------------------------------------------------------------------------
  // Gesture trails

  /**
   * Locate the element to treat as the body.
   */
  function findBody () {
    if (!state.body) {
      if (document.body) {
        // Use the HTML node for framesets. Placing the canvas under the HTML node is of questionable validity but it 
        // works.
        state.body = (document.body.tagName === 'FRAMESET') ?
          document.body.parentNode : document.body;
      } else {
        // Document body is not loaded yet.
        return false;
      }
    }
    return true;
  }

  /**
   * Get or create the canvas element on which trails are drawn.
   */
  function getOrCreateTrailCanvas () {
    if (!findBody()) {
      // DOM is not ready.
      return null;
    }
    if (!state.canvas) {
      state.canvas = document.createElement('canvas');

      // Use fixed positioning and match the window size.
      state.canvas.setAttribute('width', window.innerWidth);
      state.canvas.setAttribute('height', window.innerHeight);
      state.canvas.style.display = 'block';
      state.canvas.style.position = 'fixed';
      state.canvas.style.top = 0;
      state.canvas.style.left = 0;
      state.canvas.style.zIndex = MAX_SAFE_Z_INDEX;
      state.canvas.style.pointerEvents = 'none';
      state.canvas.style.backgroundColor = 'transparent';
      state.canvas.style.margin = 0;
      state.canvas.style.padding = 0;
      state.canvas.style.border = 'none';
      state.body.appendChild(state.canvas);

      // Initialize the drawing context.
      state.ctx = state.canvas.getContext('2d');
      state.ctx.lineWidth = settings.trailWidth;
      state.ctx.strokeStyle = settings.trailColor;
      state.ctx.lineCap = "round";
    }
    return state.canvas;
  }

  /**
   * Create a trail that begins at the mouse down position.
   */
  function beginTrail (mouseDown) {
    // Set the initial mouse position.
    state.x = mouseDown.x;
    state.y = mouseDown.y;
  }

  /**
   * Accumulate mouse moves to paint as part of the gesture trail.
   * Request an animation frame to do the actual paining.
   */
  function updateTrail (mouseMove) {
    state.trailMoves.push(mouseMove);

    // Request an animation frame if none is pending.
    if (!state.animFrameHandle) {
      state.animFrameHandle = window.requestAnimationFrame(paintTrail);
    }
  }

  /**
   * Draw the accumulated mouse movements on the gesture canvas.
   */
  function paintTrail () {
    // Clear the animation frame handle.
    state.animFrameHandle = 0;

    if (getOrCreateTrailCanvas()) {          
      // Draw the pending segments of the gesture trail.
      for (let i = 0; i < state.trailMoves.length; i++) {
        state.ctx.beginPath();
        state.ctx.moveTo(state.x, state.y);
        state.x += state.trailMoves[i].dx;
        state.y += state.trailMoves[i].dy;
        state.ctx.lineTo(state.x, state.y);
        state.ctx.stroke();
      }
      state.trailMoves.length = 0;
    }
  }

  /**
   * Clear the accumulated mouse moves.
   * Cancel any pending animation frame callback.
   */
  function cancelPaintTrail () {
    state.trailMoves.length = 0;
    if (state.animFrameHandle) {
      window.cancelAnimationFrame(state.animFrameHandle);
      state.animFrameHandle = 0;
    }
  }

  /**
   * Remove the canvas element used to paint the gesture.
   */
  function finishTrail () {
    // Remove the gesture canvas from the DOM.
    cancelPaintTrail();
    if (state.canvas) {
      state.body.removeChild(state.canvas);
      state.canvas = null;
      state.ctx = null;
    }
  }

  // -------------------------------------------------------------------------------------------------------------------
  // Status text

  // Insert the HTML fragment for a status message.
  function insertStatusMarkup () {
    var template = document.createElement('template');
    template.innerHTML = settings.statusTemplate;

    // Get references to the container and span elements.
    state.status.outerElement = template.content.firstChild;
    state.status.innerElement = state.status.outerElement.querySelector('[data-mg-status]');
    state.body.appendChild(state.status.outerElement);
  }

  // Set the status text.
  function status (content) {
    if (!findBody() || !settings.showStatusText) {
      return;
    }

    if (content) {
      // Create the status element if not present.
      if (!state.status.outerElement) {
        insertStatusMarkup();
      }

      // Update the status.
      state.status.innerElement.innerHTML = content;

      // Reset the status timeout.
      resetStatusTimeout();
    } else {
      // Clear the status.
      onStatusTimeout();
    }
  }

  // Clear the status timeout and start a new one.
  function resetStatusTimeout () {
    window.clearTimeout(state.status.handle);
    state.status.handle = window.setTimeout(onStatusTimeout,
      settings.statusTimeout);
  }

  // Remove the status element.
  function onStatusTimeout () {
    if (state.status.outerElement) {
      state.body.removeChild(state.status.outerElement);
    }

    state.status.outerElement = null;
    state.status.innerElement = null;
    state.status.handle = null;
  }

  exports.beginTrail = beginTrail;
  exports.updateTrail = updateTrail;
  exports.finishTrail = finishTrail;
  exports.status = status;

});
