'use strict';

/**
 * Implements detectors for various gesture styles.
 */
class GestureDetector {
  constructor (settings) {
    // Assign the implementation for the gesture style.
    this.styleImpl = this[settings.style || 'cardinal'];
    if (!this.styleImpl) {
      throw 'Gesture style is not implemented';
    }

    this.gesture = '';  // The currently detected gesture.
    this.lastMove = ''; // last move appended to the gesture.
    this.prevMove = ''; // Previous move given mouse input.
  }

  /**
   * Add a point to the gesture.
   * @return {Boolean} True if the gesture changed, otherwise false.
   */
  addPoint (mouseMove) {
    return this.styleImpl(mouseMove);
  }

  /**
   * Require two consecutive moves in the same direction before adding the move to the gesture.
   * This eliminates spurious direction changes often due to the mouse delta accumulator.
   * @return {Boolean} True if a move was appended to the gesture, otherwise false.
   */
  twoConsecutiveMoves (move) {
    let result = false;
    if (move) {
      // Must be same move as previous move.
      // Must not be same move as last move added to gesture.
      if ((move === this.prevMove) && (move !== this.lastMove)) {
        // Add the move to the gesture.
        this.gesture += move;
        this.lastMove = move;
        result = true;
      }
      this.prevMove = move;
    }
    return result;
  }

  /**
   * Gesture implementation for cardinal direction only.
   * Coordinate grid is divided into 4 slices of 90deg: U,D,L,R.
   */
  cardinal (mouseMove) {
    let move = null;
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

    return this.twoConsecutiveMoves(move);
  }

  /**
   * Gesture implementation for intercardinal directions with 45deg slices.
   * Coordinate grid is divided into 8 slices of 45deg: U, D, L, R, Lu, Ld, Ru, Rd.
   */
  intercardinal45 (mouseMove) {
    let move = null;
    let deg = (180 / Math.PI) * Math.atan2(mouseMove.dy, mouseMove.dx);
    if (deg >= 22.5 && deg < 67.5) {
      move = 'Rd';
    } else
    if (deg >= 67.5 && deg < 112.5) {
      move = 'D';
    } else
    if (deg >= 112.5 && deg < 157.5) {
      move = 'Ld';
    } else
    if (deg >= -22.5 && deg < 22.5) {
      move = 'R';
    } else
    if (deg >= -67.5 && deg < -22.5) {
      move = 'Ru';
    } else
    if (deg >= -112.5 && deg < -67.5) {
      move = 'U';
    } else
    if (deg >= -157.5 && deg < -112.5) {
      move = 'Lu';
    } else
    if (deg >= 157.5 || deg < -157.5) {
      move = 'L';
    }

    return this.twoConsecutiveMoves(move);
  }

  /**
   * Gesture implementation for intercardinal directions with 60deg slices.
   * Coordinate grid is divided into 4 slices of 30deg for U, D, L, R and 4 slices of 60deg for Lu, Ld, Ru, Rd.
   * This should be more forgiving when performing diagonal gestures.
   */
  intercardinal60 (mouseMove) {
    let move = null;
    let deg = (180 / Math.PI) * Math.atan2(mouseMove.dy, mouseMove.dx);
    if (deg >= 15 && deg < 75) {
      move = 'Rd';
    } else
    if (deg >= 75 && deg < 105) {
      move = 'D';
    } else
    if (deg >= 105 && deg < 165) {
      move = 'Ld';
    } else
    if (deg >= -15 && deg < 15) {
      move = 'R';
    } else
    if (deg >= -75 && deg < -15) {
      move = 'Ru';
    } else
    if (deg >= -105 && deg < -75) {
      move = 'U';
    } else
    if (deg >= -165 && deg < -105) {
      move = 'Lu';
    } else
    if (deg >= 165 || deg < -165) {
      move = 'L';
    }

    return this.twoConsecutiveMoves(move);
  }
}
