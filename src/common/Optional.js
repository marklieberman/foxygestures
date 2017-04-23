'use strict';

/**
 * Simple Optional implementation for JavaScript.
 */
class Optional {
  constructor (value) {
    this.value = (value !== undefined) ? value : null;
  }

  isPresent () {
    return (this.value !== null);
  }

  get () {
    if (this.isPresent()) {
      return this.value;
    } else {
      throw 'optional is empty';
    }
  }

  map (mapper) {
    if (this.isPresent()) {
      var newValue = mapper(this.value);
      return (newValue instanceof Optional) ? newValue : new Optional(newValue);
    }
    return this;
  }

  ifPresent (callback) {
    if (this.isPresent()) {
      callback(this.value);
    }
  }

  or (optional) {
    if (this.isPresent()) {
      return this;
    }

    // Accept a function so that the OR condition may be evaluated lazily.
    if (typeof optional === 'function') {
      optional = optional();
    }

    if (optional instanceof Optional) {
      return optional;
    }

    throw 'argument not an optional';
  }

  orElse (orElse) {
    if (typeof orElse === 'function') {
      return orElse();
    } else {
      return orElse;
    }
  }

  static of (value) {
    return (value === undefined || value === null) ? Optional.EMPTY : new Optional(value);
  }
}

Optional.EMPTY = new Optional();
