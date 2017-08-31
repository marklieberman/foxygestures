'use strict';

/**
 * Define and extend modules that may be loaded asynchronously, such as modules in different content_script blocks.
 */
window.fg = window.fg || {};

// Register a module. If another module is waiting to extend this module, its extender function will be called after
// this module is built.
window.fg.module = function (module, builder) {
  let exports = window.fg[module] = {};
  builder(exports, window.fg);

  // Any modules waiting to extend this module can now be built.
  if (window.fg['$$' + module]) {
    window.fg['$$' + module](exports, window.fg);
    delete window.fg['$$' + module];
  }
};

// Extend an existing module. If the module does not exist, the extender function call will be deferred until the
// module has been built.
window.fg.extend = function (module, extender) {
  if (window.fg[module]) {
    extender(window.fg[module], window.fg);
  } else {
    // Queue this module extender until the module is ready.
    window.fg['$$' + module] = extender;
  }
};

// ---------------------------------------------------------------------------------------------------------------------

/**
 * Helper methods for the content scripts.
 */
window.fg.module('helpers', function (exports) {

  // Keep the given settings hash up-to-date when browser storage changes.
  exports.initModuleSettings = (settings) => {
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
  exports.distanceDelta = (data) =>
    Math.sqrt((data.dx * data.dx) + (data.dy * data.dy));

  // Generate a unique string to identify a frame.
  exports.makeScriptFrameId = () =>
    new Date().getTime() + ';' + String(window.location.href);

  // Examine each node walking up the DOM until an enclosing link is found.
  // Search up to 40 nodes before giving up.
  exports.findLinkHref = (element) => {
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
  exports.getMediaInfo = (element) => {
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

});
