'use strict';

/**
 * This module is responsible for coordinating gesture state between the
 * background and content scripts.
 */

 var modules = modules || {};
 modules.handler = (function (module, settings, helpers, commands) {

  // State for this module.
  const state = module.state = {
    restoreStates: {},         // Pending gesture state for restored tabs.
    blacklistTabIds: new Set() // Tabs in which gestures are disabled.
  };

  // Internationalization constants and formatter strings.
  const i18n = {
    // No Placeholders
    userScriptNoName: browser.i18n.getMessage('userScriptNoName'),
    browserActionEnableGestures: browser.i18n.getMessage('browserActionEnableGestures'),
    browserActionDisableGestures: browser.i18n.getMessage('browserActionDisableGestures'),
    // Placeholders
    statusGestureProgress: (gesture) => browser.i18n.getMessage('statusGestureProgress', [ gesture ]),
    statusGestureUnknown: (gesture) => browser.i18n.getMessage('statusGestureUnknown', [ gesture ]),
    statusGestureKnown: (gesture, label) => browser.i18n.getMessage('statusGestureKnown', [ gesture, label ])
  };

  // Reply to a sender with a topic message.
  function replyTo (sender, topic, data) {
    return browser.tabs.sendMessage(sender.tab.id, {
      topic,
      data
    });
  }

  // Compare two chords for equality.
  function compareChords (a, b) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }

  // Get the mapping for a mouse gesture.
  function findMouseMappingForGesture (gesture) {
    return browser.storage.sync.get({ 'mouseMappings': [] }).then(results =>
      Optional.of(results.mouseMappings.find(mapping => mapping.gesture === gesture)));
  }

  // Get the mapping for a wheel gesture.
  function findWheelMappingForGesture (gesture) {
    return browser.storage.sync.get({ 'wheelMappings': {} }).then(results =>
      Optional.of(results.wheelMappings[gesture]));
  }

  // Get the mapping for a chord gesture.
  function findChordMappingForGesture (gesture) {
    return browser.storage.sync.get({ 'chordMappings': [] }).then(results =>
      Optional.of(results.chordMappings.find(chordMapping =>
        !!chordMapping.mapping && compareChords(gesture, chordMapping.chord)))
        .map(value => value.mapping));
  }

  // Update the status text for a gesture.
  function updateStatusForGesture (sender, gesture, label) {
    if (settings.showStatusText) {
      if (label === false) {
        return replyTo(sender, 'mg-status', i18n.statusGestureUnknown(gesture));
      }

      if (label === null) {
        return replyTo(sender, 'mg-status', i18n.statusGestureProgress(gesture));
      }

      return replyTo(sender, 'mg-status', i18n.statusGestureKnown(gesture, label));
    } else {
      return Promise.resolve();
    }
  }

  // Execute the mapped command for a gesture and update the status text.
  function executeCommandForGesture (mapping, data, gesturePreview) {
    let assigned = Optional.EMPTY;

    // Check user scripts for a matching user script ID.
    if ((assigned = settings.findUserScriptById(mapping.get().userScript)).isPresent()) {
      let label = assigned.get().label || i18n.userScriptNoName;
      return updateStatusForGesture(data.sender, gesturePreview, label).then(() => {
        data.userScript = assigned.get();
        return commands.executeInContent('userScript', data, true).then(result => {
          // Allow user scripts to be repeatable by default.
          return result || { repeat: true };
        });
      });
    }

    // Check commands for a matching command ID.
    if ((assigned = mapping.map(value => commands.findById(value.command))).isPresent()) {
      let label = assigned.get().label;
      return updateStatusForGesture(data.sender, gesturePreview, label).then(() => {
        // The command output may contain popup items.
        data.wheel = true;
        return assigned.get().handler(data);
      });
    }
  }

  // Event listeners ---------------------------------------------------------------------------------------------------

  // Handle messages from the content script.
  browser.runtime.onMessage.addListener((message, sender) => {
    let data = Object.assign({}, message.data, { sender: sender });
    switch (message.topic) {
      // Get the initial state for a tab.
      case 'mg-getInitialState':
        return getInitialState(sender.tab.id, data);

      // Gesture progress and completion handlers.
      case 'mg-gestureProgress':
        onGestureProgress(data);
        break;
      case 'mg-mouseGesture':
        onMouseGesture(data);
        break;
      case 'mg-wheelGesture':
        return onWheelGesture(data);
      case 'mg-chordGesture':
        return onChordGesture(data);

      // Execute a function in the background on behalf of a user script.
      case 'mg-executeInBackground':
        return commands.executeInBackground(data);

      // Set the browserAction icon/title for a tab.
      case 'mg-browserAction':
        setBrowserAction(sender.tab.id, data.enabled);
        break;
    }
    return false;
  });

  // Update the interface to reflect the gesture progress.
  function onGestureProgress (data) {
    if (settings.showStatusText) {
      findMouseMappingForGesture(data.gesture).then(mapping => {
        let assigned = Optional.EMPTY;
        if (mapping.isPresent()) {
          assigned = assigned
            // Check user scripts for a matching user script ID.
            .or(() => settings.findUserScriptById(mapping.get().userScript))
            // Check commands for a matching command ID.
            .or(() => mapping.map(value => commands.findById(value.command)));
        }

        updateStatusForGesture(data.sender, data.gesture, assigned
          .map(value => value.label || i18n.userScript)
          .orElse(null));
      });
    }
  }

  // Execute the mapped command for a mouse gesture.
  function onMouseGesture (data) {
    findMouseMappingForGesture(data.gesture).then(mapping => {
      if (mapping.isPresent()) {
        executeCommandForGesture(mapping, data, data.gesture);
      } else {
        // Mapping for this gesture not found.
        updateStatusForGesture(data.sender, data.gesture, false);
      }
    });
  }

  // Execute the mapped command for a wheel gesture.
  function onWheelGesture (data) {
    // Return a promise which may contain popup items.
    return findWheelMappingForGesture(data.gesture).then(mapping => {
      if (mapping.isPresent()) {
        return executeCommandForGesture(mapping, data, data.gesture);
      } else {
        // If nothing is mapped it is safe to repeat.
        return { repeat: true };
      }
    });
  }

  // Execute the mapped command for a wheel gesture.
  function onChordGesture (data) {
    // Return a promise which may contain popup items.
    return findChordMappingForGesture(data.gesture).then(mapping => {
      if (mapping.isPresent()) {
        return executeCommandForGesture(mapping, data, helpers.getChordPreview(data.gesture));
      } else {
        // If nothing is mapped it is safe to repeat.
        return { repeat: true };
      }
    });
  }

  // Listener for clicks on the browserAction button.
  browser.browserAction.onClicked.addListener((tab) => {
    // Toggle event listeners installed in the tab.
    browser.tabs.sendMessage(tab.id, {
      topic: 'mg-toggleEventListeners'
    }).then(data => {
      // Add or remove the tab ID from the baclist.
      if (data.enabled) {
        state.blacklistTabIds.delete(tab.id);
      } else {
        state.blacklistTabIds.add(tab.id);
      }

      // Update the browserAction icon/title.
      setBrowserAction(tab.id, data.enabled);
    });
  });

  // -------------------------------------------------------------------------------------------------------------------

  // Promise that resolves to true if gestures are disabled by tab ID or URL pattern blacklist, otherwise false.
  function isBlacklistedTabOrUrl (tabId, url) {
    if (state.blacklistTabIds.has(tabId)) {
      return Promise.resolve(true);
    } else {
      // Check the URL pattern blacklist.
      return browser.storage.sync.get({
        blacklistUrlPatterns: [],
        whitelistMode: false
      }).then(results => {
        // Invert the result when whitelist mode is enabled.
        return results.whitelistMode ^ results.blacklistUrlPatterns.some(glob => helpers.globMatches(glob, url));
      });
    }
  }

  // Get the initial state of gestures for a tab.
  function getInitialState (tabId, data) {
    // Determine if the tab is blacklisted.
    return isBlacklistedTabOrUrl(tabId, data.url).then(blacklisted => ({
      blacklisted,
      restoreState: state.restoreStates[tabId]
    }));
  }

  // Store a gesture state to be restored to a tab.
  // At the moment, the use case for this is restoring closed tabs and windows.
  module.addRestoreState = function (tabId, cloneState) {
    state.restoreStates[tabId] = cloneState;

    // Do not need to remember these states indefinitely, but they may be fetched multiple times.
    // Sometimes a restored tab will load and inject about:blank before the real location appears.
    window.setTimeout(() => { delete state.restoreStates[tabId]; }, 2000);
  };

  // Update the title and icon for the browserAction button.
  function setBrowserAction (tabId, enabled) {
    if (enabled) {
      browser.browserAction.setTitle({
        title: i18n.browserActionDisableGestures,
        tabId
      });
      browser.browserAction.setIcon({
        path: 'icons/on.svg',
        tabId
      });
    } else {
      browser.browserAction.setTitle({
        title: i18n.browserActionEnableGestures,
        tabId
      });
      browser.browserAction.setIcon({
        path: 'icons/off.svg',
        tabId
      });
    }
  }

  return module;

}(modules.handler || {}, modules.settings, modules.helpers, modules.commands));
