'use strict';

/**
 * Helper methods for the background scripts. This module pattern is designed
 * to extend when other helpers are included together.
 */
var modules = modules || {};
modules.helpers = (function (module) {

  // MIME type to extension map.
  // Not an exhaustive list but contains most common mime types.
  // See: https://developer.mozilla.org/en-US/docs/Web/HTML/Supported_media_formats
  var mimeToExtensionMap = {
    // Video
    'video/mp4': '.mp4',
    'video/ogg': '.ogg',
    'video/webm': '.webm',
    // Audio
    'audio/flac': '.flac',
    'audio/x-flac': '.flac',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/wave': '.wav',
    'audio/webm': '.webm'
  };

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

  // Attempt to determine the filename from a media URL. If the media source does not contain a file extension but the
  // mime type is known, select the extension automatically.
  module.suggestFilename = (mediaInfo) => {
    // Extract the filename from the URL.
    let match = /\/([^\/?#]+)($|\?|#)/i.exec(mediaInfo.source);
    if (match && match[1]) {
      // Try to determine if the filename has an extension.
      let filename = match[1];
      let dot = filename.indexOf('.');
      if ((dot === -1) || ((dot >= 0) && (dot < (filename.length - 4)))) {
        // Try to guess the extension from the type.
        return filename + (mimeToExtensionMap[mediaInfo.type] || '');
      } else {
        // Filename seems to have an extension
        return filename;
      }
    }

    // Couldn't determine the filename; let the browser guess.
    return null;
  };

  return module;

}(modules.helpers || {}));
