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
      new Optional(results.mouseMappings.find(mapping =>
        mapping.gesture === gesture)));
  }

  // Event listeners -----------------------------------------------------------

  // Handle messages from the content script.
  browser.runtime.onMessage.addListener((message, sender) => {
    var data;
    switch (message.topic) {
      case 'mg-gestureProgress':
        data = Object.assign(message.data, { sender: sender });
        onGestureProgress(data);
        break;
      case 'mg-mouseGesture':
        data = Object.assign(message.data, { sender: sender });
        onMouseGesture(data);
        break;
      case 'mg-wheelGesture':
        data = Object.assign(message.data, { sender: sender });
        onWheelGesture(data);
        break;
    }
    return false;
  });

  // Update the interface to reflect the gesture progress.
  function onGestureProgress (data) {
    if (settings.showStatusText) {
      withMouseMappingForGesture(data.gesture).then(mapping => {
        // Find the associated command if the mapping is valid.
        var command = mapping.map(value => commands.findById(value.command));

        // Generate a progress status message for the gesture.
        if (mapping.isPresent() && command.isPresent()) {
          replyTo(data.sender, 'mg-status', helpers.format(
            'Gesture: {} ({})', data.gesture, command.get().label
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
      // Find the associated command if the mapping is valid.
      var command = mapping.map(value => commands.findById(value.command));

      if (mapping.isPresent() && command.isPresent()) {
        // Execute the command handler.
        command.get().handler(data);
      } else
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

}(modules.settings, modules.helpers, modules.commands));
