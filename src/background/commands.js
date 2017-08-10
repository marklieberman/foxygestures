'use strict';

/**
 * This module is reponsible for defining and executing commands.
 */
var modules = modules || {};
modules.commands = (function (settings, helpers) {

  // An array of supported commands.
  var commands = [
    {
      id: 'closeLeftTabs',
      handler: commandCloseLeftTabs,
      label: 'Close Tabs to the Left'
    },
    {
      id: 'closeOtherTabs',
      handler: commandCloseOtherTabs,
      label: 'Close Other Tabs'
    },
    {
      id: 'closeRightTabs',
      handler: commandCloseRightTabs,
      label: 'Close Tabs to the Right'
    },
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
      id: 'duplicateTabInNewPrivateWindow',
      handler: commandDuplicateTabInNewPrivateWindow,
      label: 'Duplicate Tab in New Private Window'
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
      id: 'moveTabToNewWindow',
      handler: commandMoveTabToNewWindow,
      label: 'Move Tab to New Window'
    },
    {
      id: 'nextTab',
      handler: commandNextTab,
      label: 'Next Tab'
    },
    {
      id: 'newTab',
      handler: commandNewTab,
      label: 'New Tab'
    },
    {
      id: 'newWindow',
      handler: commandNewWindow,
      label: 'New Window'
    },
    {
      id: 'newPrivateWindow',
      handler: commandNewPrivateWindow,
      label: 'New Private Window'
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
      id: 'openLinkInPrivateWindow',
      handler: commandOpenLinkInNewPrivateWindow,
      label: 'Open Link in New Private Window'
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

  // Convert about:newtab or empty strings to null, otherwise return the URL.
  function notAboutNewTabUrl (url) {
    return (url && (url = url.trim()) !== 'about:newtab') ? url : null;
   }

  // Command implementations -------------------------------------------------------------------------------------------

  // Close tabs to the left of the active tab.
  function commandCloseLeftTabs () {
    return getCurrentWindowTabs().then(tabs => {
      let activeTabIndex = tabs.find(tab => tab.active).index;
      return browser.tabs.remove(tabs.filter(tab => tab.index < activeTabIndex).map(tab => tab.id));
    });
  }

  // Close all tabs other than the active tab.
  function commandCloseOtherTabs () {
    return getCurrentWindowTabs().then(tabs =>
      browser.tabs.remove(tabs.filter(tab => !tab.active).map(tab => tab.id)));
  }

  // Close tabs to the right of the active tab.
  function commandCloseRightTabs () {
    return getCurrentWindowTabs().then(tabs => {
      let activeTabIndex = tabs.find(tab => tab.active).index;
      return browser.tabs.remove(tabs.filter(tab => tab.index > activeTabIndex).map(tab => tab.id));
    });
  }

  // Close the active tab.
  function commandCloseTab () {
    return getActiveTab(tab => browser.tabs.remove(tab.id));
  }

  // Duplicate the active tab.
  function commandDuplicateTab () {
    return getActiveTab(tab => browser.tabs.create({ url: tab.url, index: tab.index + 1, active: false }));
  }

  // Duplicate the active tab in a new private window.
  function commandDuplicateTabInNewPrivateWindow () {
    return getActiveTab(tab => browser.windows.create({ url: tab.url, incognito: true }));
  }

  // Minimize the current window.
  function commandMinimize () {
    return getCurrentWindow().then(win => browser.windows.update(win.id, { state: "minimized" }));
  }

  // Move the active tab to a new window.
  function commandMoveTabToNewWindow () {
    return getActiveTab(tab => browser.windows.create({ tabId: tab.id }));
  }

  // Activate the next tab.
  function commandNextTab (data) {
    return getCurrentWindowTabs().then(tabs => {
      let active = tabs.find(tab => tab.active);
      if ((active.index === (tabs.length - 1)) && !modules.settings.nextTabWrap) {
        return Promise.resolve();
      } else {
        let index = (active.index + 1) % tabs.length;
        let next = tabs[index];
        return switchActiveTab(active, next, !!data.wheel);
      }
    });
  }

  // Create a new empty tab.
  function commandNewTab (data) {
    return getActiveTab(tab =>
      browser.tabs.create({ url: notAboutNewTabUrl(settings.newTabUrl), index: tab.index + 1, active: true }));
  }

  // Create a new empty window.
  function commandNewWindow (data) {
    return browser.windows.create({ url: notAboutNewTabUrl(settings.newWindowUrl) });
  }

  // Create a new empty private window.
  function commandNewPrivateWindow (data) {
    return browser.windows.create({ url: notAboutNewTabUrl(settings.newWindowUrl), incognito: true });
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
    if (data.element.linkHref) {
      return getActiveTab(tab => browser.tabs.create({ url: data.element.linkHref, index: tab.index + 1 }));
    }
  }

  // Open a link in a new window.
  function commandOpenLinkInNewWindow (data) {
    if (data.element.linkHref) {
      return browser.windows.create({ url: data.element.linkHref });
    }
  }

  // Open a link in a private window.
  function commandOpenLinkInNewPrivateWindow (data) {
    if (data.element.linkHref) {
      return browser.windows.create({ url: data.element.linkHref, incognito: true });
    }
  }

  // Activate the previous tab.
  function commandPreviousTab (data) {
    return getCurrentWindowTabs().then(tabs => {
      let active = tabs.find(tab => tab.active);
      if ((active.index === 0) && !modules.settings.nextTabWrap) {
        return Promise.resolve();
      } else {
        let index = (active.index - 1) % tabs.length;
        let previous = tabs[index < 0 ? tabs.length - 1 : index];
        return switchActiveTab(active, previous, !!data.wheel);
      }
    });
  }

  // Reload the active tab.
  function commandReload () {
    return getActiveTab(tab => browser.tabs.reload(tab.id));
  }

  // Save the media URL of the element under the gesture.
  function commandSaveMediaNow (data) {
    let mediaInfo = data.element.mediaInfo;
    if (mediaInfo) {
      return browser.downloads.download({
        url: mediaInfo.source,
        filename: helpers.suggestFilename(mediaInfo)
      });
    }
  }

  // Save the media URL of the element under the gesture.
  // Prompt for the location to save the file.
  function commandSaveMediaAs (data) {
    let mediaInfo = data.element.mediaInfo;
    console.log(mediaInfo, helpers.suggestFilename(mediaInfo));
    if (mediaInfo) {
      return browser.downloads.download({
        url: mediaInfo.source,
        filename: helpers.suggestFilename(mediaInfo),
        saveAs: true
      });
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

}(modules.settings, modules.helpers));
