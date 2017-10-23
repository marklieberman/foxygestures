'use strict';

/**
 * Perform maintenance operations when installed or updated.
 */
(function () {

  if (browser.runtime.onInstalled) {
    browser.runtime.onInstalled.addListener(details => {
      // Wait for the first read to complete before trying to modify settings.
      modules.settings.loaded.then(() => {
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

  // Initialize the addon when first installed.
  function onInstalled (details) {
    console.log('foxy gestures installed');

    browser.storage.sync.get({
      mouseMappings: []
    }).then(results => {
      // Populate the default mouse mappings.
      if (results.mouseMappings.length === 0) {
        console.log('install: populate default mouse mappings');
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
    });
  }

  // Update the settings when the addon is updated.
  function onUpdated (details) {
    let version = modules.helpers.parseAddonVersion(details.previousVersion);
    console.log('foxy gestures update from', version);

    // Starting with version 1.0.8 settings are stored in storage.sync.
    if ((version.major === 1) && (version.minor === 0) && (version.maint <= 7)) {
      // Move settings from storage.local to storage.sync.
      console.log('update: moving settings from local to sync');
      browser.storage.local.get(null)
        .then(results => browser.storage.sync.set(results))
        .then(() => browser.storage.local.clear());
    }

    // Starting with version 1.0.9 openLinkInNewTab is split into foreground and background variants.
    if ((version.major === 1) && (version.minor === 0) && (version.maint <= 9)) {
      browser.storage.sync.get({
        insertTabIsActive: false
      }).then(results => {
        console.log('update: renaming openLinkInNewTab to foreground/background variant');

        if (results.insertTabIsActive) {
          renameCommand('openLinkInNewTab', 'openLinkInNewForegroundTab');
        } else {
          renameCommand('openLinkInNewTab', 'openLinkInNewBackgroundTab');
        }

        // Remove deprecated settings keys.
        browser.storage.sync.remove('insertTabIsActive');
      });
    }
  }

  // Rename a command in mouse, wheel, and chord mappings.
  function renameCommand (oldCommand, newCommand) {
    return browser.storage.sync.get({
      mouseMappings: [],
      wheelMappings: {},
      chordMappings: []
    }).then(results => {
      // Rename the command in mouse gesture mappings.
      results.mouseMappings.forEach(mapping => {
        if (mapping.command === oldCommand) {
          mapping.command = newCommand;
        }
      });

      // Rename the command in wheel gesture mappings.
      Object.keys(results.wheelMappings).forEach(key => {
        let mapping = results.wheelMappings[key];
        if (mapping && mapping.command === oldCommand) {
          results.wheelMappings[key].command = newCommand;
        }
      });

      // Rename the command in chord gestures mappings.
      results.chordMappings.forEach(chord => {
        let mapping = chord.mapping;
        if (mapping && mapping.command === oldCommand) {
          mapping.command = newCommand;
        }
      });

      // Persist changes to settings.
      return browser.storage.sync.set(results);
    });
  }

}());
