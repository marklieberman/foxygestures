'use strict';

/**
 * This module is reponsible for defining and executing commands.
 */
var modules = modules || {};
modules.commands = (function (settings) {

  // An array of supported commands.
  var commands = [
    {
      id: 'closeTab',
      handler: commandCloseTab,
      label: 'Close Tab',
      defaultGesture: 'DR'
    },
    {
      id: 'duplicateTab',
      handler: commandDuplicateTab,
      label: 'Duplicate Tab',
      defaultGesture: 'UR'
    },
    {
      id: 'historyBack',
      handler: data => commands.executeInContent('historyBack', data, false),
      label: 'History Back',
      defaultGesture: 'L'
    },
    {
      id: 'historyForward',
      handler: data => commands.executeInContent('historyForward', data, false),
      label: 'History Forward',
      defaultGesture: 'R'
    },
    {
      id: 'minimize',
      handler: commandMinimize,
      label: 'Minimize Window',
      defaultGesture: 'DL'
    },
    {
      id: 'nextTab',
      handler: commandNextTab,
      label: 'Next Tab'
    },
    {
      id: 'openFrameInNewTab',
      handler: commandOpenFrameInNewTab,
      label: 'Open Frame in New Tab'
    },
    {
      id: 'openFrameInNewWindow',
      handler: commandOpenFrameInNewWindow,
      label: 'Open Frame in New Window'
    },
    {
      id: 'openLinkInNewTab',
      handler: commandOpenLinkInNewTab,
      label: 'Open Link in New Tab'
    },
    {
      id: 'openLinkInNewWindow',
      handler: commandOpenLinkInNewWindow,
      label: 'Open Link in New Window'
    },
    {
      id: 'pageUp',
      handler: data => commands.executeInContent('pageUp', data),
      label: 'Page Up',
      tooltip: 'Increment the page number in the URL using matching heuristics',
      defaultGesture: 'URU'
    },
    {
      id: 'pageDown',
      handler: data => commands.executeInContent('pageDown', data),
      label: 'Page Down',
      tooltip: 'Increment the page number in the URL using matching heuristics',
      defaultGesture: 'DRD'
    },
    {
      id: 'previousTab',
      handler: commandPreviousTab,
      label: 'Previous Tab'
    },
    {
      id: 'reload',
      handler: commandReload,
      label: 'Reload',
      defaultGesture: 'RDLU'
    },
    {
      id: 'reloadFrame',
      handler: data => commands.executeInContent('reloadFrame', data),
      label: 'Reload Frame'
    },
    {
      id: 'saveMediaNow',
      handler: commandSaveMediaNow,
      label: 'Save Media Now',
      tooltip: 'Save an image or HTML5 audio/video to the downloads folder'
    },
    {
      id: 'saveMediaAs',
      handler: commandSaveMediaAs,
      label: 'Save Media As',
      tooltip: 'Save an image or HTML5 audio/video'
    },
    {
      id: 'scrollTop',
      handler: data => commands.executeInContent('scrollTop', data),
      label: 'Scroll to Top',
      defaultGesture: 'ULR'
    },
    {
      id: 'scrollBottom',
      handler: data => commands.executeInContent('scrollBottom', data),
      label: 'Scroll to Bottom',
      defaultGesture: 'DLR'
    },
    {
      id: 'showOnlyThisFrame',
      handler: commandShowOnlyThisFrame,
      label: 'Show Only This Frame'
    },
    {
      id: 'undoClose',
      handler: commandUndoClose,
      label: 'Undo Close',
      defaultGesture: 'RLR'
    }
  ];

  // -------------------------------------------------------------------------------------------------------------------

  // Find a command by ID.
  commands.findById = (id) => Optional.of(commands.find(command => command.id === id));

  // Delegate a command to the content script.
  // The command may need access to the DOM or other window state.
  commands.executeInContent = (command, data, delegateToFrame) => {
    if (delegateToFrame === false) {
      delete data.context.scriptFrameId;
    }

    data.command = command;
    browser.tabs.sendMessage(data.sender.tab.id, {
      topic: 'mg-delegateCommand',
      data: data
    }, {
      frameId: data.sender.frameId
    });
  };

  // Execute a JavaScript function and return the result in a promise.
  // This supports the executeInBackground() method in user scripts.
  commands.executeInBackground = (data) => {
    /* jshint evil:true */
    try {
      return Promise.resolve(eval(data.func).apply(null, data.args));
    } catch (err) {
      return Promise.reject(err);
    }
  };

  // Get the current window.
  function getCurrentWindow () {
    return browser.windows.getCurrent();
  }

  // Get the tabs in the current window.
  function getCurrentWindowTabs () {
    return browser.tabs.query({ currentWindow: true });
  }

  // Receive a callback with the active tab.
  function getActiveTab (callback) {
    return getCurrentWindowTabs().then(tabs => {
      return callback(tabs.find(tab => tab.active), tabs);
    });
  }

  // Clone the gesture state from one tab to another.
  function transitionGesture (from, to, skip) {
    if (!!skip) {
      return Promise.resolve();
    } else {
      return browser.tabs.sendMessage(from.id, { topic: 'mg-cloneState' })
        .then(state => browser.tabs.sendMessage(to.id, { topic: 'mg-restoreState', data: state }))
        // If the tab being activated is internal to the browser, a channel exception will be thrown.
        .catch(t => {});
    }
  }

  // Switch the active tab and clone the gesture state if necessary.
  function switchActiveTab (from, to, transition) {
    return transitionGesture(from, to, !transition)
      .then(unused => browser.tabs.update(to.id, { active: true }))
      // Ensure the gesture state in the de-activated tab is cleaned up.
      .then(() => ({ cleanup: true }));
  }

  // Command implementations -------------------------------------------------------------------------------------------

  // Close the active tab.
  function commandCloseTab () {
    return getActiveTab(tab => browser.tabs.remove(tab.id));
  }

  // Duplicate the active tab.
  function commandDuplicateTab () {
    return getActiveTab(tab => browser.tabs.create({ url: tab.url, index: tab.index + 1, active: false }));
  }

  // Minimize the current window.
  function commandMinimize () {
    return getCurrentWindow().then(win => browser.windows.update(win.id, { state: "minimized" }));
  }

  // Activate the next tab.
  function commandNextTab (data) {
    return getCurrentWindowTabs().then(tabs => {
      let active = tabs.find(tab => tab.active);
      let index = (active.index + 1) % tabs.length;
      let next = tabs[index];
      return switchActiveTab(active, next, !!data.wheel);
    });
  }

  // Open a frame in a new tab.
  function commandOpenFrameInNewTab (data) {
    if (data.context.frameUrl) {
      return getActiveTab(tab =>
        browser.tabs.create({ url: data.context.frameUrl, index: tab.index + 1, active: false }));
    }
  }

  // Open a frame in a new window.
  function commandOpenFrameInNewWindow (data) {
    if (data.context.frameUrl) {
      return browser.windows.create({ url: data.context.frameUrl });
    }
  }

  // Open a link in a new tab.
  function commandOpenLinkInNewTab (data) {
    if (data.element.href) {
      return getActiveTab(tab => browser.tabs.create({ url: data.element.href, index: tab.index + 1 }));
    }
  }

  // Open a link in a new window.
  function commandOpenLinkInNewWindow (data) {
    if (data.element.href) {
      return browser.windows.create({ url: data.element.href });
    }
  }

  // Activate the previous tab.
  function commandPreviousTab (data) {
    return getCurrentWindowTabs().then(tabs => {
      let active = tabs.find(tab => tab.active);
      let index = (active.index - 1) % tabs.length;
      let previous = tabs[index < 0 ? tabs.length - 1 : index];
      return switchActiveTab(active, previous, !!data.wheel);
    });
  }

  // Reload the active tab.
  function commandReload () {
    return getActiveTab(tab => browser.tabs.reload(tab.id));
  }

  // Save the media URL of the element under the gesture.
  function commandSaveMediaNow (data) {
    if (data.element.mediaUrl) {
      return browser.downloads.download({ url: data.element.mediaUrl });
    }
  }

  // Save the media URL of the element under the gesture.
  // Prompt for the location to save the file.
  function commandSaveMediaAs (data) {
    if (data.element.mediaUrl) {
      return browser.downloads.download({ url: data.element.mediaUrl, saveAs: true });
    }
  }

  // Navigate to the URL of the frame.
  function commandShowOnlyThisFrame (data) {
    if (data.context.nested && data.context.frameUrl) {
      return getActiveTab(tab => browser.tabs.update(tab.id, { url: data.context.frameUrl }));
    }
  }

  // Restore the most recently closed tab or window.
  function commandUndoClose () {
    return browser.sessions.getRecentlyClosed({ maxResults: 1 }).then(sessions => {
      if (sessions.length) {
        let sessionId = sessions[0].tab ? sessions[0].tab.sessionId : sessions[0].window.sessionId;
        return browser.sessions.restore(sessionId);
      }
    });
  }

  return commands;

}(modules.settings));
