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
  function callOnActiveTab (callback) {
    return getCurrentWindowTabs().then((tabs) => {
      for (var tab of tabs) {
        if (tab.active) {
          callback(tab, tabs);
          return;
        }
      }
    });
  }

  // Command implementations -------------------------------------------------------------------------------------------

  // Close the active tab.
  function commandCloseTab (data) {
    callOnActiveTab(tab => {
      browser.tabs.remove(tab.id);
    });
  }

  // Duplicate the active tab.
  function commandDuplicateTab (data) {
    callOnActiveTab(tab => {
      browser.tabs.create({
        url: tab.url,
        index: tab.index + 1,
        active: false
      });
    });
  }

  // Minimize the current window.
  function commandMinimize (data) {
    getCurrentWindow().then(win => {
      browser.windows.update(win.id, {
        state: "minimized"
      });
    });
  }

  // Open a frame in a new tab.
  function commandOpenFrameInNewTab (data) {
    if (data.context.frameUrl) {
      callOnActiveTab(tab => {
        browser.tabs.create({
          url: data.context.frameUrl,
          index: tab.index + 1,
          active: false
        });
      });
    }
  }

  // Open a frame in a new window.
  function commandOpenFrameInNewWindow (data) {
    if (data.context.frameUrl) {
      browser.windows.create({
        url: data.context.frameUrl,
        focused: true
      });
    }
  }

  // Open a link in a new tab.
  function commandOpenLinkInNewTab (data) {
    if (data.element.href) {
      callOnActiveTab(tab => {
        browser.tabs.create({
          url: data.element.href,
          index: tab.index + 1
        });
      });
    }
  }

  // Open a link in a new window.
  function commandOpenLinkInNewWindow (data) {
    if (data.element.href) {
      browser.windows.create({
        url: data.element.href,
        focused: true
      });
    }
  }

  // Reload the active tab.
  function commandReload (data) {
    callOnActiveTab(tab => {
      browser.tabs.reload(tab.id);
    });
  }

  // Save the media URL of the element under the gesture.
  function commandSaveMediaNow (data, saveAs) {
    if (data.element.mediaUrl) {
      browser.downloads.download({
        url: data.element.mediaUrl,
        saveAs: saveAs
      });
    }
  }

  // Save the media URL of the element under the gesture.
  // Prompt for the location to save the file.
  function commandSaveMediaAs (data, saveAs) {
    commandSaveMediaNow(data, true);
  }

  // Restore the most recently closed tab or window.
  function commandUndoClose (data) {
    browser.sessions.getRecentlyClosed({ maxResults: 1 }).then(sessions => {
      if (sessions.length) {
        var closed = sessions[0];
        if (closed.tab) {
          browser.sessions.restore(closed.tab.sessionId);
        } else {
          browser.sessions.restore(closed.window.sessionId);
        }
      }
    });
  }

  return commands;

}(modules.settings));
