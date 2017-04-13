'use strict';

/**
 * Helper methods for the background scripts. This module pattern is designed
 * to extend when other helpers are included together.
 */
var modules = modules || {};
modules.helpers = (function (module) {

  // A string substitution method that uses {} as a placeholder.
  module.format = function (/* format, [...] */) {
    if (arguments.length === 0) { return ''; }
    if (arguments.length === 1) { return arguments[0]; }

    var format = arguments[0];
    for (var i = 1; i < arguments.length; ++i) {
      var index = format.indexOf('{}');
      if (index >= 0) {
        format = format.slice(0, index) + (arguments[i] || '') + format.slice(index + 2);
      } else {
        // No more placeholders - parameters are left over.
        break;
      }
    }

    return format;
  };

  return module;

}(modules.helpers || {}));
