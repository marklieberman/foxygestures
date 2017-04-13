'use strict';

/**
 * Simple Optional implementation for JavaScript.
 */
class Optional {
  constructor (nullable) {
    this.value = (nullable !== undefined) ? nullable : null;
  }

  isPresent () {
    return (this.value !== null);
  }

  get () {
    return this.value;
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

  orElse (orElse) {
    if (typeof orElse === 'function') {
      return orElse();
    } else {
      return orElse;
    }
  }

  static empty() {
    return new Optional();
  }
}
