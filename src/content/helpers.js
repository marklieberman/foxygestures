'use strict';

/**
 * Helper methods for the content scripts.
 */
var modules = modules || {};
modules.helpers = (function (module) {

  // Keep the given settings hash up-to-date when browser storage changes.
  module.initModuleSettings = (settings) => {
    // Update default values from storage.
    browser.storage.sync.get(settings).then(results => {
      Object.keys(settings).forEach(key => {
        settings[key] = results[key];
      });
    });

    // Listen for changes to settings.
    browser.storage.onChanged.addListener((changes, area) => {
      Object.keys(settings).forEach(key => {
        if (changes[key]) {
          settings[key] = changes[key].newValue;
        }
      });
    });

    return settings;
  };

  // Calculate the magnitude of the vector (dx,dy).
  module.distanceDelta = (data) =>
    Math.sqrt((data.dx * data.dx) + (data.dy * data.dy));

  // Generate a unique string to identify a frame.
  module.makeScriptFrameId = () =>
    new Date().getTime() + ';' + String(window.location.href);

  // Examine each node walking up the DOM until an enclosing link is found.
  // Search up to 40 nodes before giving up.
  module.findLinkHref = (element) => {
    for (let i = 0; !!element && (i < 40); i++) {
      if ((element.tagName === 'A') && element.href) {
        // Ignore inline javascript links.
        let href = element.href.toLowerCase();
        if (href.startsWith('javascript')) {
          return null;
        }

        // Found an acceptable link href.
        return element.href;
      } else {
        // No link; look to the parent node.
        element = element.parentNode;
      }
    }
    return null;
  };

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
