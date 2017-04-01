'use strict';

var modules = modules || {};
modules.helpers = (function () {

  // Calculate the magnitude of the vector (dx,dy).
  function distanceDelta (data) {
    return Math.sqrt((data.dx * data.dx) + (data.dy * data.dy));
  }

  // Generate a unique string to identify a frame.
  function makeScriptFrameId () {
    return new Date().getTime() + ';' + String(window.location.href);
  }

  // Find a URL for the image, video, or audio of a DOM element. The function
  // currently looks for image source, HTML5 video or audio sources, and CSS
  // nearby background images.
  function getMediaUrl (element) {
    if (element instanceof window.HTMLImageElement) {
      return String(element.src);
    } else
    if (element instanceof window.HTMLVideoElement ||
        element instanceof window.HTMLAudioElement) {
      if (element.src) {
        return element.src;
      } else {
        // Look for embedded <source> tags.
        var sources = Array.prototype.slice.call(element.children)
          .filter(function (child) {
            return child.tagName === 'SOURCE';
          });
        if (sources.length) {
          return sources[0].src;
        }
      }
    } else
    if (element instanceof window.HTMLCanvasElement) {
      return element.toDataURL();
    } else {
      // TODO Search up to DOM hierarchy for a CSS background image.
    }
    return null;
  }

  function format (/* format, [...] */) {
    if (arguments.length === 0) {
      return '';
    }

    if (arguments.length === 1) {
      return arguments[0];
    }

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
  }

  return {
    distanceDelta: distanceDelta,
    makeScriptFrameId: makeScriptFrameId,
    getMediaUrl: getMediaUrl,
    format: format
  };

}());
