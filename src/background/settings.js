'use strict';

/**
 * This module is responsible for centralized access to settings. It presents itself as a hash of settings. However,
 * the values are automatically updated when storage is modified.
 */
var modules = modules || {};
modules.settings = (function () {

  // Default status template snippet.
  const STATUS_TEMPLATE =
    '<div style="all: initial; display: block; position: fixed; bottom: 0; right: 0; z-index: 2147483647">\r\n' +
    '  <div style="all: initial; background: #fff; border: 1px solid #ccc; color: #333; font-family: sans-serif; font-size: 12px; padding: 2px" data-mg-status></div>\r\n' +
    '</div>';

  // Default settings for the extension.
  const DEFAULT_SETTINGS = {
    // Addon settings
    showStatusText: true,              // Show status text when enabled.
    statusTimeout: 2000,               // Timeout to hide the status text.

    // Mouse gestures
    gestureButton: 2,                  // The button to start a gesture.
    gestureTimeout: 2000,              // Movement timeout to cancel a gesture.
    gestureFidelity: 10,               // Fidelity of mouse events in gestures.
    drawTrails: true,                  // Draw gesture trails when enabled.
    trailFidelity: 10,                 // Minimum size of gesture trial segments.
    trailWidth: 2,                     // The width of the gesture trail.
    trailColor: 'purple',              // The color of the gesture trail.
    mouseMappings: [                   // Array of gesture mappings.
      { gesture: 'DR', command: 'closeTab' },
      { gesture: 'UR', command: 'duplicateTab' },
      { gesture: 'L', command: 'historyBack' },
      { gesture: 'R', command: 'historyForward' },
      { gesture: 'DL', command: 'minimize' },
      { gesture: 'DRD', command: 'pageDown' },
      { gesture: 'URU', command: 'pageUp' },
      { gesture: 'RDLU', command: 'reload' },
      { gesture: 'DLR', command: 'scrollBottom' },
      { gesture: 'ULR', command: 'scrollTop' },
      { gesture: 'RLR', command: 'undoClose' },
      { gesture: 'ULD', command: 'openOptions' }
    ],
    disableOnAlt: true,                // Disable gestures when Alt is pressed.
    disableOnShift: true,              // Disable gestures when Shift is pressed.
    canSelectStart: false,             // Allow selectstart event during gesture.

    // Wheel gestures
    wheelGestures: false,              // Enable wheel gestures?
    wheelMappings: {                   // Mappings for wheel gestures.
      up: null,
      down: null,
      left: null,
      right: null
    },

    // Chord gestures
    chordGestures: false,              // Enable chord gestures
    chordMappings: [                   // Mappings for chord gestures.
      { chord: [ 0, 2 ], mapping: null },
      { chord: [ 2, 0 ], mapping: null }
    ],

    // User scripts
    userScripts: [],                   // Array of user scripts.
    sawXSSWarning: false,              // Did the user read the XSS warning?

    // Command settings
    scrollDuration: 500,               // Animation duration from scroll commands.
    scrollAmount: 100,                 // Scroll amount for scroll up/down in vh units.
    nextTabWrap: true,                 // Next/prev tab command wraps at end?
    newTabUrl: null,                   // Default URL for tabs opened with New Tab.
    newWindowUrl: null,                // Default URL for windows opened with New Window.
    newPrivateWindowUrl: null,         // Default URL for private windows opened with New Private Window.
    useRelPrevNext: true,              // Use <a rel="prev|next"> hint for page up and down.
    insertRelatedTab: true,            // New tabs are inserted adjacent to the active tab.
    zoomStep: 0.1,                     // Amount to change zoom factor for zoom commands.
    activeTabAfterClose: 'default',    // Tab to activate after closing the current tab.

    // Templates
    statusTemplate: STATUS_TEMPLATE
  };

  // Current settings for the extension.
  const settings = {};

  // Read settings from storage.
  var promise = browser.storage.sync.get(DEFAULT_SETTINGS).then(results => {
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

  // -------------------------------------------------------------------------------------------------------------------
  // Callable properties will throw a DataCloneError when persisting the settings object. Therefore, methods on the
  // settings object cannot be enumerable.

  // Load settings from storage.
  // This is exposed as the non-enumerable loaded property.
  Object.defineProperty(settings, 'loaded', {
    enumerable: false,
    value: promise
  });

  // Reset settings for the extension to default.
  Object.defineProperty(settings, 'reset', {
    enumerable: false,
    value: () => browser.storage.sync.set(DEFAULT_SETTINGS)
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
