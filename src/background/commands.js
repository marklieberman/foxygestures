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
      label: browser.i18n.getMessage('commandCloseLeftTabs')
    },
    {
      id: 'closeOtherTabs',
      handler: commandCloseOtherTabs,
      label: browser.i18n.getMessage('commandCloseOtherTabs')
    },
    {
      id: 'closeRightTabs',
      handler: commandCloseRightTabs,
      label: browser.i18n.getMessage('commandCloseRightTabs')
    },
    {
      id: 'closeTab',
      handler: commandCloseTab,
      label: browser.i18n.getMessage('commandCloseTab'),
      defaultGesture: 'DR'
    },
    {
      id: 'duplicateTab',
      handler: commandDuplicateTab,
      label: browser.i18n.getMessage('commandDuplicateTab'),
      defaultGesture: 'UR'
    },
    {
      id: 'duplicateTabInNewPrivateWindow',
      handler: commandDuplicateTabInNewPrivateWindow,
      label: browser.i18n.getMessage('commandDuplicateTabInNewPrivateWindow'),
      tooltip: browser.i18n.getMessage('commandDuplicateTabInNewPrivateWindowTooltip')
    },
    {
      id: 'historyBack',
      handler: data => {
        commands.executeInContent('historyBack', data, false);
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
      },
      label: browser.i18n.getMessage('commandHistoryBack'),
      defaultGesture: 'L'
    },
    {
      id: 'historyForward',
      handler: data => {
        commands.executeInContent('historyForward', data, false);
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
      },
      label: browser.i18n.getMessage('commandHistoryForward'),
      defaultGesture: 'R'
    },
    {
      id: 'minimize',
      handler: commandMinimize,
      label: browser.i18n.getMessage('commandMinimize'),
      defaultGesture: 'DL'
    },
    {
      id: 'moveTabToNewWindow',
      handler: commandMoveTabToNewWindow,
      label: browser.i18n.getMessage('commandMoveTabToNewWindow')
    },
    {
      id: 'nextTab',
      handler: commandNextTab,
      label: browser.i18n.getMessage('commandNextTab')
    },
    {
      id: 'newTab',
      handler: commandNewTab,
      label: browser.i18n.getMessage('commandNewTab')
    },
    {
      id: 'newWindow',
      handler: commandNewWindow,
      label: browser.i18n.getMessage('commandNewWindow')
    },
    {
      id: 'newPrivateWindow',
      handler: commandNewPrivateWindow,
      label: browser.i18n.getMessage('commandNewPrivateWindow')
    },
    {
      id: 'openFrameInNewTab',
      handler: commandOpenFrameInNewTab,
      label: browser.i18n.getMessage('commandOpenFrameInNewTab')
    },
    {
      id: 'openFrameInNewWindow',
      handler: commandOpenFrameInNewWindow,
      label: browser.i18n.getMessage('commandOpenFrameInNewWindow')
    },
    {
      id: 'openLinkInNewBackgroundTab',
      handler: commandOpenLinkInNewBackgroundTab,
      label: browser.i18n.getMessage('commandOpenLinkInNewBackgroundTab')
    },
    {
      id: 'openLinkInNewForegroundTab',
      handler: commandOpenLinkInNewForegroundTab,
      label: browser.i18n.getMessage('commandOpenLinkInNewForegroundTab')
    },
    {
      id: 'openLinkInNewWindow',
      handler: commandOpenLinkInNewWindow,
      label: browser.i18n.getMessage('commandOpenLinkInNewWindow')
    },
    {
      id: 'openLinkInPrivateWindow',
      handler: commandOpenLinkInNewPrivateWindow,
      label: browser.i18n.getMessage('commandOpenLinkInNewPrivateWindow')
    },
    {
      id: 'pageDown',
      handler: data => commands.executeInContent('pageDown', data),
      label: browser.i18n.getMessage('commandPageDown'),
      tooltip: browser.i18n.getMessage('commandPageDownTooltip'),
      defaultGesture: 'DRD'
    },
    {
      id: 'pageUp',
      handler: data => commands.executeInContent('pageUp', data),
      label: browser.i18n.getMessage('commandPageUp'),
      tooltip: browser.i18n.getMessage('commandPageUpTooltip'),
      defaultGesture: 'URU'
    },
    {
      id: 'previousTab',
      handler: commandPreviousTab,
      label: browser.i18n.getMessage('commandPreviousTab')
    },
    {
      id: 'pinUnpinTab',
      handler: commandPinUnpinTab,
      label: browser.i18n.getMessage('commandPinUnpinTab')
    },
    {
      id: 'reload',
      handler: commandReload,
      label: browser.i18n.getMessage('commandReload'),
      defaultGesture: 'RDLU'
    },
    {
      id: 'reloadBypassCache',
      handler: commandReloadBypassCache,
      label: browser.i18n.getMessage('commandReloadBypassCache')
    },
    {
      id: 'reloadFrame',
      handler: data => commands.executeInContent('reloadFrame', data),
      label: browser.i18n.getMessage('commandReloadFrame')
    },
    {
      id: 'saveMediaNow',
      handler: commandSaveMediaNow,
      label: browser.i18n.getMessage('commandSaveMediaNow'),
      tooltip: browser.i18n.getMessage('commandSaveMediaNowTooltip')
    },
    {
      id: 'saveMediaAs',
      handler: commandSaveMediaAs,
      label: browser.i18n.getMessage('commandSaveMediaAs'),
      tooltip: browser.i18n.getMessage('commandSaveMediaAsTooltip')
    },
    {
      id: 'scrollBottom',
      handler: data => {
        commands.executeInContent('scrollBottom', data);
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
      },
      label: browser.i18n.getMessage('commandScrollBottom'),
      defaultGesture: 'DLR'
    },
    {
      id: 'scrollDown',
      handler: data => {
        commands.executeInContent('scrollDown', data);
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
      },
      label: browser.i18n.getMessage('commandScrollDown')
    },
    {
      id: 'scrollTop',
      handler: data => {
        commands.executeInContent('scrollTop', data);
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
      },
      label: browser.i18n.getMessage('commandScrollTop'),
      defaultGesture: 'ULR'
    },
    {
      id: 'scrollUp',
      handler: data => {
        commands.executeInContent('scrollUp', data);
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
      },
      label: browser.i18n.getMessage('commandScrollUp'),
    },
    {
      id: 'showOnlyThisFrame',
      handler: commandShowOnlyThisFrame,
      label: browser.i18n.getMessage('commandShowOnlyThisFrame')
    },
    {
      id: 'undoClose',
      handler: commandUndoClose,
      label: browser.i18n.getMessage('commandUndoClose'),
      defaultGesture: 'RLR'
    },
    {
      id: 'zoomIn',
      handler: commandZoomIn,
      label: browser.i18n.getMessage('commandZoomIn')
    },
    {
      id: 'zoomOut',
      handler: commandZoomOut,
      label: browser.i18n.getMessage('commandZoomOut')
    },
    {
      id: 'zoomReset',
      handler: commandZoomReset,
      label: browser.i18n.getMessage('commandZoomReset'),
      tooltip: browser.i18n.getMessage('commandZoomResetTooltip')
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
