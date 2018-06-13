'use strict';

/**
 * Detects up, down, left, and right mouse movements.
 */
class GestureDetector {
  constructor (settings) {
    this.prevMove = '';
    this._gesture = '';

    // Set the method used to detect gestures.
    this.styleImpl = this[settings.style || 'cardinal'];
  }

  // Add a point to the gesture.
  addPoint (mouseMove) {
    let move = this.styleImpl(mouseMove);
    if (move !== this.prevMove) {
      this._gesture += move;
      this.prevMove = move;
      return true;
    }
    return false;
  }

  // Coordinate grid is divided into 4 slices of 90deg: U,D,L,R.
  cardinal (mouseMove) {
    if (mouseMove.dx > 0) {
      if (mouseMove.dy > 0) {
        return (mouseMove.dy > mouseMove.dx) ? 'D' : 'R';
      } else {
        return (-mouseMove.dy > mouseMove.dx) ? 'U' : 'R';
      }
    } else {
      if (mouseMove.dy > 0) {
        return (mouseMove.dy > -mouseMove.dx) ? 'D' : 'L';
      } else {
        return (-mouseMove.dy > -mouseMove.dx) ? 'U' : 'L';
      }
    }
  }

  // Coordinate grid is divided into 8 slices of 45deg: U,D,L,Ld,Lu,R,Rd,Ru.
  intercardinal (mouseMove) {
    var move = null;
    var deg = (180 / Math.PI) * Math.atan2(mouseMove.dy, mouseMove.dx);
    if (deg >= 22.5 && deg < 67.5) {
      return 'Rd';
    } else
    if (deg >= 67.5 && deg < 112.5) {
      return 'D';
    } else
    if (deg >= 112.5 && deg < 157.5) {
      return 'Ld';
    } else
    if (deg >= -22.5 && deg < 22.5) {
      return 'R';
    } else
    if (deg >= -67.5 && deg < -22.5) {
      return 'Ru';
    } else
    if (deg >= -112.5 && deg < -67.5) {
      return 'U';
    } else
    if (deg >= -157.5 && deg < -112.5) {
      return 'Lu';
    } else
    if (deg >= 157.5 || deg < -157.5) {
      return 'L';
    }
  }

  // Get the gesture.
  get gesture () {
    return this._gesture;
  }
}
