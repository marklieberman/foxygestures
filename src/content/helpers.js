'use strict';

/**
 * Helper methods for the content scripts. This module pattern is designed to
 * extend when other helpers are included together.
 */
var modules = modules || {};
modules.helpers = (function (module) {

  // Calculate the magnitude of the vector (dx,dy).
  module.distanceDelta = (data) =>
    Math.sqrt((data.dx * data.dx) + (data.dy * data.dy));

  // Generate a unique string to identify a frame.
  module.makeScriptFrameId = () =>
    new Date().getTime() + ';' + String(window.location.href);

  // Find a URL for the image, video, or audio of a DOM element. The function
  // currently looks for image source, HTML5 video or audio sources, and CSS
  // nearby background images.
  module.getMediaInfo = (element) => {
    if (element instanceof window.HTMLImageElement) {
      return {
        source: String(element.src),
        type: null
      };
    } else
    if (element instanceof window.HTMLVideoElement ||
        element instanceof window.HTMLAudioElement) {
      if (element.src) {
        // Source is on the media element.
        return {
          source: String(element.src),
          type: element.getAttribute('type')
        };
      } else {
        // Look for embedded <source> tags.
        var sources = Array.prototype.slice.call(element.children)
          .filter(function (child) {
            return child.tagName === 'SOURCE';
          });
        if (sources.length) {
          let element = sources[0];
          return {
            source: String(element.src),
            type: element.getAttribute('type')
          };
        }
      }
    } else
    if (element instanceof window.HTMLCanvasElement) {
      return {
        source: element.toDataURL(),
        type: 'image/png'
      };
    } else {
      // TODO Search up to DOM hierarchy for a CSS background image.
    }
    return null;
  };

  return module;

}(modules.helpers || {}));
