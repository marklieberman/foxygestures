'use strict';

/**
 * This module is responsible for centralized access to settings. It presents itself as a hash of settings. However,
 * the values are automatically updated when storage is modified.
 */
var modules = modules || {};
modules.settings = (function () {

  // Default status template snippet.
  var STATUS_TEMPLATE =
    '<div style="position: fixed; bottom: 0; right: 0; z-index: 2147483647">\r\n' +
    '  <div style="background: #fff; border: 1px solid #ccc; color: #333; font-family: sans-serif; font-size: 12px; padding: 2px" data-mg-status></div>\r\n' +
    '</div>';

  // Settings for the extension.
  var settings = {
    gestureButton: 2,          // The button to start a gesture.
    gestureTimeout: 400,       // Movement timeout to cancel a gesture.
    gestureFidelity: 10,       // Fidelity of mouse events in gestures.
    drawTrails: true,          // Draw gesture trails when enabled.
    trailFidelity: 10,         // Minimum size of gesture trial segments.
    trailWidth: 2,             // The width of the gesture trail.
    trailColor: 'purple',      // The color of the gesture trail.
    showStatusText: true,      // Show status text when enabled.
    statusTimeout: 2000,       // Timeout to hide the status text.
    mouseMappings: [],         // Array of gesture mappings.
    userScripts: [],           // Array of user scripts.
    sawXSSWarning: false,      // Did the user read the XSS warning?
    wheelGestures: false,      // Enable wheel gestures?
    wheelMappings: {           // Mappings for wheel gestures.
      up: null,
      down: null,
      left: null,
      right: null
    },
    scrollDuration: 500,       // Animation duration from scroll commands.
    nextTabWrap: true,         // Next tab command wraps at end?
    newTabUrl: null,           // Default URL for tabs opened with New Tab.
    newWindowUrl: null,        // Default URL for windows opened with New Window.
    newPrivateWindowUrl: null, // Default URL for private windows opened with New Private Window.

    // Templates
    statusTemplate: STATUS_TEMPLATE
  };

  // Load settings from storage.
  // This is exposed as the non-enumerable loaded property.
  Object.defineProperty(settings, 'loaded', {
    enumerable: false,
    value: browser.storage.local.get(settings).then(results => {
      // Assign values from storage into the module reference.
      Object.keys(results)
        .filter(key => typeof settings[key] !== 'function')
        .forEach(key => settings[key] = results[key]);

      return settings;
    })
  });

  // Event listeners ---------------------------------------------------------------------------------------------------

  // Guard for cases when settings is included from content scripts.
  if (browser.runtime.onInstalled) {
    // Initialize settings on install but after default settings are retrieved.
    browser.runtime.onInstalled.addListener(details => settings.loaded.then(() => {
      switch (details.reason) {
        case 'install':
          // Do not initialize the mouse mappingd when reloading a temporary addon.
          if (!settings.mouseMappings.length) {
            initializeMouseMappings();
          }
          break;
        case 'update':
          break;
      }
    }));
  }

  // Listen for changes to settings.
  browser.storage.onChanged.addListener((changes, area) => {
    Object.keys(settings)
      .filter(key => changes[key] !== undefined)
      .filter(key => typeof settings[key] !== 'function')
      .forEach(key => settings[key] = changes[key].newValue);
  });

  // -------------------------------------------------------------------------------------------------------------------

  // Initialize the mouse mappings from the commands array.
  function initializeMouseMappings () {
    console.log('initializing mouse mappings');
    return browser.storage.local.set({
      'mouseMappings': modules.commands
        // Ignore commands without a default gesture.
        .filter(command => !!command.defaultGesture)
        // Generate a mapping for the command.
        .map(command => ({
          command: command.id,
          gesture: command.defaultGesture
        }))
    });
  }

  // Get the default value for template settings.
  settings.getDefaultTemplates = () => ({
    statusTemplate: STATUS_TEMPLATE
  });

  // Find a user script by ID.
  settings.findUserScriptById = (id) => Optional.of(settings.userScripts.find(userScript => userScript.id === id));

  return settings;

}());
