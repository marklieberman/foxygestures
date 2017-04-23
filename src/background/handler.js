'use strict';

/**
 * This module is responsible for coordinating gesture state between the
 * background and content scripts.
 */
(function (settings, helpers, commands) {

  // Reply to a sender with a topic message.
  function replyTo (sender, topic, data) {
    browser.tabs.sendMessage(sender.tab.id, {
      topic: topic,
      data: data
    });
  }

  // Get the mapping for a mouse gesture.
  function withMouseMappingForGesture (gesture) {
    return browser.storage.local.get('mouseMappings').then(results =>
      new Optional(results.mouseMappings.find(mapping => mapping.gesture === gesture)));
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
        onWheelGesture(data);
        break;
      case 'mg-backgroundExec':
        // This function will reply via a promise.
        return onBackgroundExec(data);
    }
    return false;
  });

  // Update the interface to reflect the gesture progress.
  function onGestureProgress (data) {
    if (settings.showStatusText) {
      withMouseMappingForGesture(data.gesture).then(mapping => {
        let assigned = Optional.EMPTY;
        if (mapping.isPresent()) {
          assigned = assigned
            // Check user scripts for a matching user script ID.
            .or(() => settings.findUserScriptById(mapping.get().userScript))
            // Check commands for a matching command ID.
            .or(() => mapping.map(value => commands.findById(value.command)));
        }

        if (assigned.isPresent()) {
          replyTo(data.sender, 'mg-status', helpers.format(
            'Gesture: {} ({})', data.gesture, assigned.get().label || 'User Script'
          ));
        } else {
          replyTo(data.sender, 'mg-status', helpers.format(
            'Gesture: {}', data.gesture
          ));
        }
      });
    }
  }

  // Execute the mapped command for a mouse gesture.
  function onMouseGesture (data) {
    withMouseMappingForGesture(data.gesture).then(mapping => {
      let assigned = Optional.EMPTY;
      if (mapping.isPresent()) {
        if ((assigned = settings.findUserScriptById(mapping.get().userScript)).isPresent()) {
          data.userScript = assigned.get();
          commands.executeInContent('userScript', data, true);
          return;
        }

        if ((assigned = mapping.map(value => commands.findById(value.command))).isPresent()) {
          assigned.get().handler(data);
          return;
        }
      }

      if (settings.showStatusText) {
        // Mapping for this gesture not found.
        replyTo(data.sender, 'mg-status', helpers.format(
          'Unknown Gesture: {}', data.gesture
        ));
      }
    });
  }

  // Execute the mapped command for a wheel gesture.
  function onWheelGesture (data) {
    replyTo(data.sender, 'mg-status', null);
  }

  // User script API functions -----------------------------------------------------------------------------------------
  // These are functions that primarily exist for use with user scripts.

  // Execute a JavaScript function and return the result in a promise.
  // This supports the backgroundExec() method in user scripts.
  function onBackgroundExec (data) {
    /* jshint evil:true */
    try {
      return Promise.resolve(eval(data.func).apply(null, data.args));
    } catch (err) {
      return Promise.reject(err);
    }
  }

}(modules.settings, modules.helpers, modules.commands));
