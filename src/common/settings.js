'use strict';

/**
 * This module is responsible for centralized access to settings. It presents itself as a hash of settings. However,
 * the values are automatically updated when storage is modified.
 */
var modules = modules || {};
modules.settings = (function () {

  // Default status template snippet.
  var STATUS_TEMPLATE =
    '<div style="position: fixed; bottom: 0; right: 0; z-index: 99999">\r\n' +
    '  <div style="background: #fff; border: 1px solid #ccc; color: #333; font-family: sans-serif; font-size: 12px; padding: 2px" data-mg-status></div>\r\n' +
    '</div>';

  // Settings for the extension.
  var settings = {
    gestureButton: 2,     // The button to start a gesture.
    gestureTimeout: 400,  // Movement timeout to cancel a gesture.
    gestureFidelity: 10,  // Fidelity of mouse events in gestures.
    drawTrails: true,     // Draw gesture trails when enabled.
    trailFidelity: 10,    // Minimum size of gesture trial segments.
    trailWidth: 2,        // The width of the gesture trail.
    trailColor: 'purple', // The color of the gesture trail.
    showStatusText: true, // Show status text when enabled.
    statusTimeout: 2000,  // Timeout to hide the status text.
    mouseMappings: [],    // Array of gesture mappings.
    userScripts: [],      // Array of user scripts.

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

      var promise = Promise.resolve();

      // Initialize the mouse mappings if empty. This can only be done if the
      // commands module is available, such as in background page context.
      if (modules.commands && !settings.mouseMappings.length) {
        promise = promise.then(() => initializeMouseMappings());
      }

      return promise.then(() => settings);
    })
  });

  // Event listeners ---------------------------------------------------------------------------------------------------

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
    var mappings = modules.commands
      // Ignore commands without a default gesture.
      .filter(command => !!command.defaults.gesture)
      // Generate a mapping for the command.
      .map(command => ({
        command: command.id,
        gesture: command.defaults.gesture
      }));

    return browser.storage.local.set({
      'mouseMappings': mappings
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
