'use strict';

/**
 * This module is responsible for coordinating gesture state between the
 * background and content scripts.
 */
(function (settings, helpers, commands) {

  // Internationalization constants and formatter strings.
  const i18n = {
    // No Placeholders
    userScriptNoName: browser.i18n.getMessage('userScriptNoName'),
    // Placeholders
    statusGestureProgress: (gesture) =>
      browser.i18n.getMessage('statusGestureProgress', [ gesture ]),
    statusGestureUnknown: (gesture) =>
      browser.i18n.getMessage('statusGestureUnknown', [ gesture ]),
    statusGestureKnown: (gesture, label) =>
      browser.i18n.getMessage('statusGestureKnown', [ gesture, label ])
  };

  // Reply to a sender with a topic message.
  function replyTo (sender, topic, data) {
    return browser.tabs.sendMessage(sender.tab.id, {
      topic: topic,
      data: data
    });
  }

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

  // Event listeners ---------------------------------------------------------------------------------------------------

  // Handle messages from the content script.
  browser.runtime.onMessage.addListener((message, sender) => {
    let data = Object.assign({}, message.data, { sender: sender });
    switch (message.topic) {
      case 'mg-gestureProgress':
        onGestureProgress(data);
        break;
      case 'mg-mouseGesture':
        onMouseGesture(data);
        break;
      case 'mg-wheelGesture':
        // This function will reply via a promise.
        return onWheelGesture(data);
      case 'mg-chordGesture':
        // This function will reply via a promise.
        return onChordGesture(data);
      case 'mg-executeInBackground':
        // This function will reply via a promise.
        return commands.executeInBackground(data);
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
      let assigned = Optional.EMPTY;
      if (mapping.isPresent()) {
        // Check user scripts for a matching user script ID.
        if ((assigned = settings.findUserScriptById(mapping.get().userScript)).isPresent()) {
          let label = assigned.get().label || i18n.userScriptNoName;
          return updateStatusForGesture(data.sender, data.gesture, label).then(() => {
            data.userScript = assigned.get();
            commands.executeInContent('userScript', data, true);
          });
        }

        // Check commands for a matching command ID.
        if ((assigned = mapping.map(value => commands.findById(value.command))).isPresent()) {
          let label = assigned.get().label;
          return updateStatusForGesture(data.sender, data.gesture, label).then(() => {
            assigned.get().handler(data);
          });
        }
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
      let assigned = Optional.EMPTY;
      if (mapping.isPresent()) {
        // Check user scripts for a matching user script ID.
        if ((assigned = settings.findUserScriptById(mapping.get().userScript)).isPresent()) {
          let label = assigned.get().label || i18n.userScriptNoName;
          return updateStatusForGesture(data.sender, data.gesture, label).then(() => {
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
          return updateStatusForGesture(data.sender, data.gesture, label).then(() => {
            // The command output may contain popup items.
            data.wheel = true;
            return assigned.get().handler(data);
          });
        }
      }

      // If nothing is mapped it is safe to repeat.
      return { repeat: true };
    });
  }

  // Execute the mapped command for a wheel gesture.
  function onChordGesture (data) {
    // Return a promise which may contain popup items.
    return findChordMappingForGesture(data.gesture).then(mapping => {
      let assigned = Optional.EMPTY;
      if (mapping.isPresent()) {
        let gesture = helpers.getChordPreview(data.gesture);

        // Check user scripts for a matching user script ID.
        if ((assigned = settings.findUserScriptById(mapping.get().userScript)).isPresent()) {
          let label = assigned.get().label || i18n.userScriptNoName;
          return updateStatusForGesture(data.sender, gesture, label).then(() => {
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
          return updateStatusForGesture(data.sender, gesture, label).then(() => {
            // The command output may contain popup items.
            data.wheel = true;
            return assigned.get().handler(data);
          });
        }
      }

      // If nothing is mapped it is safe to repeat.
      return { repeat: true };
    });
  }

}(modules.settings, modules.helpers, modules.commands));
