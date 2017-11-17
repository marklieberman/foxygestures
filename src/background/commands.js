'use strict';

/**
 * This module is reponsible for defining and executing commands.
 *
 * Mouse gesture commands do not require a response from the command handler.
 *
 * Wheel and chord gesture commands may return a response object with the following properties:
 *   repeat {Boolean}: Allow the gesture type to be repeated. (e.g.: additional wheel scrolls without releasing the
 *                     gesture button. Do not enable for commands the change the active tab/window or the gesture
 *                     state may be "stuck on" in the current tab.
 *   popup {Object}:   Popup items for popup wheel gestures. Not yet implemented.
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
      label: 'Duplicate Tab in New Private Window',
      tooltip: 'The duplicated tab\'s history is not preserved in the private window'
    },
    {
      id: 'historyBack',
      handler: data => {
        commands.executeInContent('historyBack', data, false);
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
      },
      label: 'History Back',
      defaultGesture: 'L'
    },
    {
      id: 'historyForward',
      handler: data => {
        commands.executeInContent('historyForward', data, false);
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
      },
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
      id: 'openLinkInNewBackgroundTab',
      handler: commandOpenLinkInNewBackgroundTab,
      label: 'Open Link in New Background Tab'
    },
    {
      id: 'openLinkInNewForegroundTab',
      handler: commandOpenLinkInNewForegroundTab,
      label: 'Open Link in New Foreground Tab'
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
      tooltip: 'Decrement the page number in the URL using matching heuristics',
      defaultGesture: 'DRD'
    },
    {
      id: 'pinUnpinTab',
      handler: commandPinUnpinTab,
      label: 'Pin/Un-pin Tab'
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
      id: 'reloadBypassCache',
      handler: commandReloadBypassCache,
      label: 'Reload (Bypass Cache)'
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
      id: 'scrollBottom',
      handler: data => {
        commands.executeInContent('scrollBottom', data);
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
      },
      label: 'Scroll to Bottom',
      defaultGesture: 'DLR'
    },
    {
      id: 'scrollDown',
      handler: data => {
        commands.executeInContent('scrollDown', data);
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
      },
      label: 'Scroll Down'
    },
    {
      id: 'scrollTop',
      handler: data => {
        commands.executeInContent('scrollTop', data);
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
      },
      label: 'Scroll to Top',
      defaultGesture: 'ULR'
    },
    {
      id: 'scrollUp',
      handler: data => {
        commands.executeInContent('scrollUp', data);
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
      },
      label: 'Scroll Up'
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
    },
    {
      id: 'zoomIn',
      handler: commandZoomIn,
      label: 'Zoom In'
    },
    {
      id: 'zoomOut',
      handler: commandZoomOut,
      label: 'Zoom Out'
    },
    {
      id: 'zoomReset',
      handler: commandZoomReset,
      label: 'Reset Zoom',
      tooltip: 'Reset tab zoom factor to default'
    }
  ];

  // -------------------------------------------------------------------------------------------------------------------

  // Find a command by ID.
  commands.findById = (id) => Optional.of(commands.find(command => command.id === id));

  // Delegate a command to the content script.
  // The command may need access to the DOM or other window state.
  // The message is broadcast to all handlers in the sender tab. Use the script frame IDs to address a specific frame.
  commands.executeInContent = (command, data, delegateToFrame) => {
    if (delegateToFrame === false) {
      // Tell the top frame to handle this command.
      data.context.targetFrameId = data.context.topFrameId;
    } else {
      // Tell the origin frame to handle this command.
      data.context.targetFrameId = data.context.originFrameId;
    }

    data.command = command;
    return browser.tabs.sendMessage(data.sender.tab.id, {
      topic: 'mg-delegateCommand',
      data: data
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
  function transitionGesture (from, to, state) {
    if (state) {
      // Always disable the gesture state in the de-activating tab because the de-activating tab may not be the tab
      // that generated the wheel gesture. (e.g.: rapidly scrolling the wheel through Next Tab commands.)
      return browser.tabs.sendMessage(to.id, { topic: 'mg-applyState', data: state })
        // Disable the gesture state after transitioning to the new tab or window.
        .then(() => browser.tabs.sendMessage(from.id, { topic: 'mg-abortGesture' }))
        // If the tab being activated is internal to the browser, a channel exception will be thrown.
        .catch(t => {});
    } else {
      return Promise.resolve();
    }
  }

  // Convert about:newtab or empty strings to null, otherwise return the URL.
  function notAboutNewTabUrl (url) {
    return (url && (url = url.trim()) !== 'about:newtab') ? url : null;
   }

  // Command implementations -------------------------------------------------------------------------------------------

  // Close tabs to the left of the active tab.
  function commandCloseLeftTabs () {
    return getCurrentWindowTabs()
      .then(tabs => {
        let activeTabIndex = tabs.find(tab => tab.active).index;
        return browser.tabs.remove(tabs.filter(tab => tab.index < activeTabIndex).map(tab => tab.id));
      })
      // Allow the wheel or chord gesture to repeat.
      .then(() => ({ repeat: true }));
  }

  // Close all tabs other than the active tab.
  function commandCloseOtherTabs () {
    return getCurrentWindowTabs()
      .then(tabs => {
        return browser.tabs.remove(tabs.filter(tab => !tab.active).map(tab => tab.id));
      })
      // Allow the wheel or chord gesture to repeat.
      .then(() => ({ repeat: true }));
  }

  // Close tabs to the right of the active tab.
  function commandCloseRightTabs () {
    return getCurrentWindowTabs()
      .then(tabs => {
        let activeTabIndex = tabs.find(tab => tab.active).index;
        return browser.tabs.remove(tabs.filter(tab => tab.index > activeTabIndex).map(tab => tab.id));
      })
      // Allow the wheel or chord gesture to repeat.
      .then(() => ({ repeat: true }));
  }

  // Close the active tab.
  function commandCloseTab () {
    return getActiveTab(tab => browser.tabs.remove(tab.id));
  }

  // Duplicate the active tab.
  function commandDuplicateTab () {
    return getActiveTab(tab => browser.tabs.duplicate(tab.id));
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
        // Transition the gesture into the new tab using state cloning.
        let index = (active.index + 1) % tabs.length;
        let next = tabs[index];
        return transitionGesture(active, next, data.cloneState)
          .then(() => browser.tabs.update(next.id, { active: true }));
      }
    });
  }

  // Create a new empty tab.
  function commandNewTab (data) {
    return getActiveTab(tab => {
      // Firefox default is for new tabs to be active and inserted at the end of the tab bar.
      let tabOptions = {};
      tabOptions.url = notAboutNewTabUrl(settings.newTabUrl);
      tabOptions.active = true;
      tabOptions.cookieStoreId = tab.cookieStoreId;
      return browser.tabs.create(tabOptions);
    });
  }

  // Create a new empty window.
  function commandNewWindow (data) {
    return getActiveTab(tab => {
      // Firefox default is for new tabs to be active and inserted at the end of the tab bar.
      let tabOptions = {};
      tabOptions.url = notAboutNewTabUrl(settings.newTabUrl);
      tabOptions.cookieStoreId = tab.cookieStoreId;
      return browser.tabs.create(tabOptions);
    }).then(tab => {
      return browser.windows.create({ tabId: tab.id });
    });
  }

  // Create a new empty private window.
  function commandNewPrivateWindow (data) {
    return browser.windows.create({ url: notAboutNewTabUrl(settings.newWindowUrl), incognito: true });
  }

  // Open a frame in a new tab.
  function commandOpenFrameInNewTab (data) {
    if (data.context.frameUrl) {
      return getActiveTab(tab => {
        let tabOptions = {};
        tabOptions.url = data.context.frameUrl;
        tabOptions.active = true;
        tabOptions.cookieStoreId = tab.cookieStoreId;
        if (settings.insertRelatedTab) {
          tabOptions.index = tab.index + 1;
        }
        return browser.tabs.create(tabOptions);
      });
    }
  }

  // Open a frame in a new window.
  function commandOpenFrameInNewWindow (data) {
    if (data.context.frameUrl) {
      return getActiveTab(tab => {
        let tabOptions = {};
        tabOptions.url = data.context.frameUrl;
        tabOptions.cookieStoreId = tab.cookieStoreId;
        return browser.tabs.create(tabOptions);
      }).then(tab => {
        return browser.windows.create({ tabId: tab.id });
      });
    }
  }

  // Open a link in a new background tab.
  function commandOpenLinkInNewBackgroundTab (data) {
    let promise = Promise.resolve();

    if (data.element.linkHref) {
      promise = getActiveTab(tab => {
        let tabOptions = {};
        tabOptions.url = data.element.linkHref;
        tabOptions.active = false;
        tabOptions.cookieStoreId = tab.cookieStoreId;
        if (settings.insertRelatedTab) {
          tabOptions.index = tab.index + 1;
        }
        return browser.tabs.create(tabOptions);
      });
    }

    // Allow the wheel or chord gesture to repeat.
    return promise.then(() => ({ repeat: true }));
  }

  // Open a link in a new foreground tab.
  function commandOpenLinkInNewForegroundTab (data) {
    if (data.element.linkHref) {
      return getActiveTab(tab => {
        let tabOptions = {};
        tabOptions.url = data.element.linkHref;
        tabOptions.active = true;
        tabOptions.cookieStoreId = tab.cookieStoreId;
        if (settings.insertRelatedTab) {
          tabOptions.index = tab.index + 1;
        }
        return browser.tabs.create(tabOptions);
      });
    }
  }

  // Open a link in a new window.
  function commandOpenLinkInNewWindow (data) {
    if (data.element.linkHref) {
      return getActiveTab(tab => {
        let tabOptions = {};
        tabOptions.url = data.element.linkHref;
        tabOptions.cookieStoreId = tab.cookieStoreId;
        return browser.tabs.create(tabOptions);
      }).then(tab => {
        return browser.windows.create({ tabId: tab.id });
      });
    }
  }

  // Open a link in a private window.
  function commandOpenLinkInNewPrivateWindow (data) {
    if (data.element.linkHref) {
      return browser.windows.create({ url: data.element.linkHref, incognito: true });
    }
  }

  // Pin or unpin the current tab.
  function commandPinUnpinTab (data) {
    return getActiveTab(tab => browser.tabs.update({ pinned: !tab.pinned }))
      // Allow the wheel or chord gesture to repeat.
      .then(() => ({ repeat: true }));
  }

  // Activate the previous tab.
  function commandPreviousTab (data) {
    return getCurrentWindowTabs().then(tabs => {
      let active = tabs.find(tab => tab.active);
      if ((active.index === 0) && !modules.settings.nextTabWrap) {
        return Promise.resolve();
      } else {
        // Transition the gesture into the new tab using state cloning.
        let index = (active.index - 1) % tabs.length;
        let previous = tabs[index < 0 ? tabs.length - 1 : index];
        return transitionGesture(active, previous, data.cloneState)
          .then(() => browser.tabs.update(previous.id, { active: true }));
      }
    });
  }

  // Reload the active tab.
  function commandReload () {
    return getActiveTab(tab => browser.tabs.reload(tab.id));
  }

  // Reload the active tab and bypass the cache.
  function commandReloadBypassCache () {
    return getActiveTab(tab => browser.tabs.reload(tab.id, { bypassCache: true }));
  }

  // Save the media URL of the element under the gesture.
  function commandSaveMediaNow (data) {
    let promise = Promise.resolve();

    let mediaInfo = data.element.mediaInfo;
    if (mediaInfo) {
      promise = browser.downloads.download({
        url: mediaInfo.source,
        filename: helpers.suggestFilename(mediaInfo)
      });
    }

    // Allow the wheel or chord gesture to repeat.
    return promise.then(() => ({ repeat: true }));
  }

  // Save the media URL of the element under the gesture.
  // Prompt for the location to save the file.
  function commandSaveMediaAs (data) {
    let promise = Promise.resolve();

    let mediaInfo = data.element.mediaInfo;
    if (mediaInfo) {
      promise = browser.downloads.download({
        url: mediaInfo.source,
        filename: helpers.suggestFilename(mediaInfo),
        saveAs: true
      });
    }

    // Allow the wheel or chord gesture to repeat.
    return promise.then(() => ({ repeat: true }));
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

  // Increase the zoom factor of the active tab.
  function commandZoomIn () {
    return browser.tabs.getZoom()
      .then(amount => {
        // Clamp amount between 0.3 and 3.
        amount = Math.max(0.3, Math.min(3, amount + settings.zoomStep));
        return browser.tabs.setZoom(amount);
      })
      // Allow the wheel or chord gesture to repeat.
      .then(() => ({ repeat: true }));
  }

  // Decrease the zoom factor of the active tab.
  function commandZoomOut () {
    return browser.tabs.getZoom()
      .then(amount => {
        // Clamp amount between 0.3 and 3.
        amount = Math.max(0.3, Math.min(3, amount - settings.zoomStep));
        return browser.tabs.setZoom(amount);
      })
      // Allow the wheel or chord gesture to repeat.
      .then(() => ({ repeat: true }));
  }

  // Reset the zoom factor of the active tab.
  function commandZoomReset () {
    return browser.tabs.setZoom(0)
      // Allow the wheel or chord gesture to repeat.
      .then(() => ({ repeat: true }));
  }

  return commands;

}(modules.settings, modules.helpers));
