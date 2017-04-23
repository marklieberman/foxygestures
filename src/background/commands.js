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
      group: 'tabs',
      defaults: {
        gesture: 'DR'
      }
    },
    {
      id: 'duplicateTab',
      handler: commandDuplicateTab,
      label: 'Duplicate Tab',
      group: 'tabs',
      defaults: {
        gesture: 'UR'
      }
    },
    {
      id: 'historyBack',
      handler: data => executeInContent('historyBack', data, false),
      label: 'History Back',
      group: 'navigation',
      defaults: {
        gesture: 'L'
      }
    },
    {
      id: 'historyForward',
      handler: data => executeInContent('historyForward', data, false),
      label: 'History Forward',
      group: 'navigation',
      defaults: {
        gesture: 'R'
      }
    },
    {
      id: 'minimize',
      handler: commandMinimize,
      label: 'Minimize Window',
      group: 'tabs',
      defaults: {
        gesture: 'DL'
      }
    },
    {
      id: 'openFrameInNewTab',
      handler: commandOpenFrameInNewTab,
      label: 'Open Frame in New Tab',
      group: 'frames',
      defaults: {
        gesture: ''
      }
    },
    {
      id: 'openFrameInNewWindow',
      handler: commandOpenFrameInNewWindow,
      label: 'Open Frame in New Window',
      group: 'frames',
      defaults: {
        gesture: ''
      }
    },
    {
      id: 'openLinkInNewTab',
      handler: commandOpenLinkInNewTab,
      label: 'Open Link in New Tab',
      group: 'navigation',
      defaults: {
        gesture: ''
      }
    },
    {
      id: 'openLinkInNewWindow',
      handler: commandOpenLinkInNewWindow,
      label: 'Open Link in New Window',
      group: 'navigation',
      defaults: {
        gesture: ''
      }
    },
    {
      id: 'pageUp',
      handler: data => executeInContent('pageUp', data),
      label: 'Page Up',
      tooltip: 'Increment the page number in the URL using matching heuristics',
      group: 'navigation',
      defaults: {
        gesture: 'URU'
      }
    },
    {
      id: 'pageDown',
      handler: data => executeInContent('pageDown', data),
      label: 'Page Down',
      tooltip: 'Increment the page number in the URL using matching heuristics',
      group: 'navigation',
      defaults: {
        gesture: 'DRD'
      }
    },
    {
      id: 'reload',
      handler: commandReload,
      label: 'Reload',
      group: 'navigation',
      defaults: {
        gesture: 'RDLU'
      }
    },
    {
      id: 'reloadFrame',
      handler: data => executeInContent('reloadFrame', data),
      label: 'Reload Frame',
      group: 'frames',
      defaults: {
        gesture: ''
      }
    },
    {
      id: 'saveNow',
      handler: commandSaveNow,
      label: 'Save Now',
      group: 'other',
      defaults: {
        gesture: ''
      }
    },
    {
      id: 'saveAs',
      handler: commandSaveAs,
      label: 'Save As',
      group: 'other',
      defaults: {
        gesture: ''
      }
    },
    {
      id: 'scrollTop',
      handler: data => executeInContent('scrollTop', data),
      label: 'Scroll to Top',
      group: 'navigation',
      defaults: {
        gesture: 'ULR'
      }
    },
    {
      id: 'scrollBottom',
      handler: data => executeInContent('scrollBottom', data),
      label: 'Scroll to Bottom',
      group: 'navigation',
      defaults: {
        gesture: 'DLR'
      }
    },
    {
      id: 'undoClose',
      handler: commandUndoClose,
      label: 'Undo Close',
      group: 'tabs',
      defaults: {
        gesture: 'RLR'
      }
    }
  ];

  // -------------------------------------------------------------------------------------------------------------------

  // Find a command by ID.
  commands.findById = (id) => Optional.of(commands.find(command => command.id === id));

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

  // Delegate a command to the content script.
  // The command may need access to the DOM or other window state.
  function executeInContent (command, data, delegateToFrame) {
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
  }

  commands.executeInContent = executeInContent;

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
  function commandSaveNow (data, saveAs) {
    if (data.element.mediaUrl) {
      browser.downloads.download({
        url: data.element.mediaUrl,
        saveAs: saveAs
      });
    }
  }

  // Save the media URL of the element under the gesture.
  // Prompt for the location to save the file.
  function commandSaveAs (data, saveAs) {
    commandSaveNow(data, true);
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
