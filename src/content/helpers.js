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

  // A monotonically increasing value used to identify elements with data-fg-ref attribute.
  var dataFgRef = 1;

  // Keep the given settings hash up-to-date when storage changes.
  exports.initModuleSettings = (settings, area) => {
    // Update default values from storage.
    let promise = browser.storage[area].get(settings).then(results => {
      Object.keys(settings).forEach(key => {
        settings[key] = results[key];
      });
    });

    // Listen for changes to settings.
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (area === areaName) {
        Object.keys(settings).forEach(key => {
          if (changes[key]) {
            settings[key] = changes[key].newValue;
          }
        });
      }
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
  exports.findLinkElement = (element) => {
    for (let i = 0; !!element && (i < 40); i++) {
      if ((element.tagName === 'A') && element.href) {
        // Ignore inline javascript links.
        let href = element.href.toLowerCase();
        if (href.startsWith('javascript')) {
          return null;
        }

        // Found an acceptable link href.
        return element;
      } else {
        // No link; look to the parent node.
        element = element.parentNode;
      }
    }
    return null;
  };

  // Gather the text under or around an element - typically a link.
  exports.gatherTextUnder = (element) => {
		let text = '', node = element.firstChild, depth = 1;
		while (node && depth > 0) {
      // Append text nodes and alt text.
			if (node.nodeType == window.Node.TEXT_NODE) {
				text += ' ' + node.data;
			} else
      if (node instanceof window.HTMLImageElement) {
				let altText = node.getAttribute('alt');
				if (altText && altText !== '') {
					text += ' ' + altText;
        }
			}

      // Search child nodes, siblings, children of siblings, etc.
      // Depth starts at 1 so parent nodes get processed too.
			if (node.hasChildNodes()) {
				node = node.firstChild;
				depth++;
			} else {
				while (depth > 0 && !node.nextSibling) {
					node = node.parentNode;
					depth--;
				}
				if (node.nextSibling) {
					node = node.nextSibling;
        }
			}
		}

    // Try some alternative text sources if the text is empty.
		text = text.trim().replace(/\s+/g, ' ');
		if (!text || !text.match(/\S/)) {
			text = element.getAttribute('title');
			if (!text || !text.match(/\S/)) {
				text = element.getAttribute('alt');
				if (!text || !text.match(/\S/)) {
          let linkElement = exports.findLinkElement(element);
          if (linkElement) {
            return linkElement.href;
          }
				}
			}
		}
    return text;
  };

  // Find a URL for the image, video, or audio of a DOM element. The function currently looks for image source, HTML5
  // video or audio sources, and CSS nearby background images.
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
        let sources = Array.prototype.slice.call(element.children)
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
      // Get or create a unqiue reference to identify this canvas.
      let elementRef = element.getAttribute('data-fg-ref');
      if (!elementRef) {
        elementRef = dataFgRef++;
        element.setAttribute('data-fg-ref', elementRef);
      }

      // The background scripts can asynchronously get the data later.
      return {
        source: elementRef,
        type: 'canvasRef'
      };
    } else {
      // TODO Search up to DOM hierarchy for a CSS background image.
    }
    return null;
  };

  // grab the user selected text or text from input fields
  // this is expected to be used typically for searching or with the clipboard.
  exports.selectedText = (element) => {
    // include text selected in textarea and input elements
    if (element instanceof window.HTMLInputElement || element instanceof window.HTMLTextAreaElement) {
      // substring only works with types textarea, text, password, search, tel, url
      let text = element.value.substring(element.selectionStart, element.selectionEnd);
      // for other input types like email and number,
      // or if no substring is selected in selectable type (ex. search, textarea, etc.),
      // use entire field value
      if (!text) {
        text = element.value;
      }
      return text;
    } else {
      return document.getSelection().toString();
    }
  };
});
