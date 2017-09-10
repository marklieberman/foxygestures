'use strict';

/**
 * This module is responsible for centralized access to settings. It presents itself as a hash of settings. However,
 * the values are automatically updated when storage is modified.
 */
var modules = modules || {};
modules.settings = (function () {

  // Default status template snippet.
  var STATUS_TEMPLATE =
    '<div style="display: block; position: fixed; bottom: 0; right: 0; z-index: 2147483647">\r\n' +
    '  <div style="background: #fff; border: 1px solid #ccc; color: #333; font-family: sans-serif; font-size: 12px; padding: 2px" data-mg-status></div>\r\n' +
    '</div>';

  // Settings for the extension.
  var settings = {
    // Addon settings
    showStatusText: true,      // Show status text when enabled.
    statusTimeout: 2000,       // Timeout to hide the status text.

    // Mouse gestures
    gestureButton: 2,          // The button to start a gesture.
    gestureTimeout: 2000,      // Movement timeout to cancel a gesture.
    gestureFidelity: 10,       // Fidelity of mouse events in gestures.
    drawTrails: true,          // Draw gesture trails when enabled.
    trailFidelity: 10,         // Minimum size of gesture trial segments.
    trailWidth: 2,             // The width of the gesture trail.
    trailColor: 'purple',      // The color of the gesture trail.
    mouseMappings: [],         // Array of gesture mappings.

    // Wheel gestures
    wheelGestures: false,      // Enable wheel gestures?
    wheelMappings: {           // Mappings for wheel gestures.
      up: null,
      down: null,
      left: null,
      right: null
    },

    // Chord gestures
    chordGestures: false,      // Enable chord gestures
    chordMappings: [           // Mappings for chord gestures.
      { chord: [ 0, 2 ], mapping: null },
      { chord: [ 2, 0 ], mapping: null }
    ],

    // User scripts
    userScripts: [],           // Array of user scripts.
    sawXSSWarning: false,      // Did the user read the XSS warning?

    // Command settings
    scrollDuration: 500,       // Animation duration from scroll commands.
    scrollAmount: 100,         // Scroll amount for scroll up/down in vh units.
    nextTabWrap: true,         // Next/prev tab command wraps at end?
    newTabUrl: null,           // Default URL for tabs opened with New Tab.
    newWindowUrl: null,        // Default URL for windows opened with New Window.
    newPrivateWindowUrl: null, // Default URL for private windows opened with New Private Window.
    useRelPrevNext: true,      // Use <a rel="prev|next"> hint for page up and down.
    insertTabIsActive: false,  // Immediately switch focus to new tabs.
    insertRelatedTab: true,    // New tabs are inserted adjacent to the active tab.
    zoomStep: 0.1,             // Amount to change zoom factor for zoom commands.

    // Templates
    statusTemplate: STATUS_TEMPLATE
  };

  // Read settings from storage.
  var loadPromise = browser.storage.sync.get(settings).then(results => {
    Object.keys(results).forEach(key => settings[key] = results[key]);
    return settings;
  });

  // Event listeners ---------------------------------------------------------------------------------------------------

  // Listen for changes to settings.
  browser.storage.onChanged.addListener((changes, area) => {
    Object.keys(settings)
      .filter(key => changes[key] !== undefined)
      .forEach(key => settings[key] = changes[key].newValue);
  });

  // Perform maintenance operations when installed or updated.
  if (browser.runtime.onInstalled) {
    browser.runtime.onInstalled.addListener(details => {
      // Wait for the first read to complete before trying to modify settings.
      loadPromise.then(() => {
        switch (details.reason) {
          case 'install':
            onInstalled(details);
            break;
          case 'update':
            onUpdated(details);
            break;
        }
      });
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  // Initialize the addon when first installed.
  function onInstalled (details) {
    console.log('foxy gestures installed');

    // Populate the default mouse mappings.
    if (!settings.mouseMappings.length) {
      browser.storage.sync.set({
        mouseMappings: modules.commands
          // Ignore commands without a default gesture.
          .filter(command => !!command.defaultGesture)
          // Generate a mapping for the command.
          .map(command => ({
            command: command.id,
            gesture: command.defaultGesture
          }))
      });
    }
  }

  // Update the settings when the addon is updated.
  function onUpdated (details) {
    let version = modules.helpers.parseAddonVersion(details.previousVersion);
    console.log('foxy gestures update from', version);

    // Starting with version 1.0.8 settings are stored in storage.sync.
    if ((version.major === 1) && (version.minor === 0) && (version.maint <= 7)) {
      // Move settings from storage.local to storage.sync.
      browser.storage.local.get(null).then(results => {
        console.log('moving settings from local to sync');

        Object.keys(settings)
          .filter(key => results[key] !== undefined)
          .forEach(key => settings[key] = results[key]);

        browser.storage.sync.set(settings);
        browser.storage.local.clear();
      });
    }
  }

  // -------------------------------------------------------------------------------------------------------------------
  // Callable properties will throw a DataCloneError when persisting the settings object. Therefore, methods on the
  // settings object cannot be enumerable.

  // Load settings from storage.
  // This is exposed as the non-enumerable loaded property.
  Object.defineProperty(settings, 'loaded', {
    enumerable: false,
    value: loadPromise
  });

  // Get the default value for template settings.
  Object.defineProperty(settings, 'getDefaultTemplates', {
    enumerable: false,
    value: () => ({
      statusTemplate: STATUS_TEMPLATE
    })
  });

  // Find a user script by ID.
  Object.defineProperty(settings, 'findUserScriptById', {
    enumerable: false,
    value: (id) => Optional.of(settings.userScripts.find(userScript => userScript.id === id))
  });

  return settings;

}());
