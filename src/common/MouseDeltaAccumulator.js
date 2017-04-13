'use strict';

/**
 * A utility to aggregate dx and dy in mouse events. This is used to throttle
 * processing of mouse move events.
 */
class MouseDeltaAccumulator {
  constructor () {
    this.reset();
  }

  // Reset the accumulated deltas.
  reset () {
    this.dx1 = this.dy1 = 0;
  }

  // Accumulate the mouse deltas in a mouse event.
  accumulate (mouseMove) {
    mouseMove.dx = (this.dx1 += mouseMove.dx);
    mouseMove.dy = (this.dy1 += mouseMove.dy);
    return mouseMove;
  }
}
