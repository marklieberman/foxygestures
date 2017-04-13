'use strict';

/**
 * Detects up, down, left, and right mouse movements.
 */
class UDLRGestureDetector {
  constructor () {
    this.reset();
  }

  // Reset the gesture.
  reset () {
    this.prevMove = this._gesture = '';
  }

  // Add a point to the gesture.
  addPoint (mouseMove) {
    var move = null;
    if (mouseMove.dx > 0) {
      if (mouseMove.dy > 0) {
        move = (mouseMove.dy > mouseMove.dx) ? 'D' : 'R';
      } else {
        move = (-mouseMove.dy > mouseMove.dx) ? 'U' : 'R';
      }
    } else {
      if (mouseMove.dy > 0) {
        move = (mouseMove.dy > -mouseMove.dx) ? 'D' : 'L';
      } else {
        move = (-mouseMove.dy > -mouseMove.dx) ? 'U' : 'L';
      }
    }
    if (move !== this.prevMove) {
      this._gesture += move;
      this.prevMove = move;
      return true;
    }
    return false;
  }

  // Get the gesture.
  get gesture () {
    return this._gesture;
  }
}
