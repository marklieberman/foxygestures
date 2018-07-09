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

  // Array of groups to organize commands.
  const groups = {
    navigation: {
      order: 0,
      id: 'navigation',
      label: browser.i18n.getMessage('groupCommandsNavigation')
    },
    tabs: {
      order: 1,
      id: 'tabs',
      label: browser.i18n.getMessage('groupCommandsTabs')
    },
    windows: {
      order: 2,
      id: 'windows',
      label: browser.i18n.getMessage('groupCommandsWindows')
    },
    hybrid: {
      order: 3,
      id: 'hybrid',
      label: browser.i18n.getMessage('groupCommandsHybrid')
    },
    other: {
      order: 100,
      id: 'other',
      label: browser.i18n.getMessage('groupCommandsOther')
    }
  };

  // An array of supported commands.
  const commands = [
    {
      id: 'activateFirstTab',
      handler: commandActivateFirstTab,
      label: browser.i18n.getMessage('commandActivateFirstTab'),
      group: groups.tabs
    },
    {
      id: 'activateLastTab',
      handler: commandActivateLastTab,
      label: browser.i18n.getMessage('commandActivateLastTab'),
      group: groups.tabs
    },
    {
      id: 'activateRecentTab',
      handler: commandActivateRecentTab,
      label: browser.i18n.getMessage('commandActivateRecentTab'),
      tooltip: browser.i18n.getMessage('commandActivateRecentTabTooltip'),
      group: groups.tabs
    },
    {
      id: 'bookmarkUrl',
      handler: commandBookmarkUrl,
      label: browser.i18n.getMessage('commandBookmarkUrl'),
      tooltip: browser.i18n.getMessage('commandBookmarkUrlTooltip'),
      group: groups.other,
      permissions: [ 'bookmarks' ]
    },
    {
      id: 'closeLeftTabs',
      handler: commandCloseLeftTabs,
      label: browser.i18n.getMessage('commandCloseLeftTabs'),
      group: groups.tabs
    },
    {
      id: 'closeOtherTabs',
      handler: commandCloseOtherTabs,
      label: browser.i18n.getMessage('commandCloseOtherTabs'),
      group: groups.tabs
    },
    {
      id: 'closeRightTabs',
      handler: commandCloseRightTabs,
      label: browser.i18n.getMessage('commandCloseRightTabs'),
      group: groups.tabs
    },
    {
      id: 'closeTab',
      handler: commandCloseTab,
      label: browser.i18n.getMessage('commandCloseTab'),
      group: groups.tabs
    },
    {
      id: 'closeTabActivateLeft',
      handler: commandCloseTabActivateLeft,
      label: browser.i18n.getMessage('commandCloseTabActivateLeft'),
      group: groups.tabs
    },
    {
      id: 'closeTabActivateRight',
      handler: commandCloseTabActivateRight,
      label: browser.i18n.getMessage('commandCloseTabActivateRight'),
      group: groups.tabs
    },
    {
      id: 'closeWindow',
      handler: commandCloseWindow,
      label: browser.i18n.getMessage('commandCloseWindow'),
      group: groups.windows
    },
    {
      id: 'duplicateTab',
      handler: commandDuplicateTab,
      label: browser.i18n.getMessage('commandDuplicateTab'),
      group: groups.tabs
    },
    {
      id: 'duplicateTabInNewPrivateWindow',
      handler: commandDuplicateTabInNewPrivateWindow,
      label: browser.i18n.getMessage('commandDuplicateTabInNewPrivateWindow'),
      tooltip: browser.i18n.getMessage('commandDuplicateTabInNewPrivateWindowTooltip'),
      group: groups.tabs
    },
    {
      id: 'fullscreen',
      handler: commandFullscreen,
      label: browser.i18n.getMessage('commandFullscreen'),
      group: groups.windows
    },
    {
      id: 'goHome',
      handler: commandGoHome,
      label: browser.i18n.getMessage('commandGoHome'),
      group: groups.navigation
    },
    {
      id: 'historyBack',
      handler: data => {
        commands.executeInContent('historyBack', data, false);
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
      },
      label: browser.i18n.getMessage('commandHistoryBack'),
      group: groups.navigation
    },
    {
      id: 'historyBackOrCloseTab',
      handler: data => {
        commands.executeInContent('historyBackOrCloseTab', data, false);
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
      },
      label: browser.i18n.getMessage('commandHistoryBackOrCloseTab'),
      tooltip: browser.i18n.getMessage('commandHistoryBackOrCloseTabTooltip'),
      group: groups.hybrid
    },
    {
      id: 'historyForward',
      handler: data => {
        commands.executeInContent('historyForward', data, false);
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
      },
      label: browser.i18n.getMessage('commandHistoryForward'),
      group: groups.navigation
    },
    {
      id: 'maximize',
      handler: commandMaximize,
      label: browser.i18n.getMessage('commandMaximize'),
      group: groups.windows
    },
    {
      id: 'minimize',
      handler: commandMinimize,
      label: browser.i18n.getMessage('commandMinimize'),
      group: groups.windows
    },
    {
      id: 'moveTabToNewWindow',
      handler: commandMoveTabToNewWindow,
      label: browser.i18n.getMessage('commandMoveTabToNewWindow'),
      group: groups.tabs
    },
    {
      id: 'nextTab',
      handler: commandActivateNextTab,
      label: browser.i18n.getMessage('commandActivateNextTab'),
      group: groups.tabs
    },
    {
      id: 'newTab',
      handler: commandNewTab,
      label: browser.i18n.getMessage('commandNewTab'),
      group: groups.tabs
    },
    {
      id: 'newWindow',
      handler: commandNewWindow,
      label: browser.i18n.getMessage('commandNewWindow'),
      group: groups.windows
    },
    {
      id: 'newPrivateWindow',
      handler: commandNewPrivateWindow,
      label: browser.i18n.getMessage('commandNewPrivateWindow'),
      group: groups.windows
    },
    {
      id: 'openFrameInNewTab',
      handler: commandOpenFrameInNewTab,
      label: browser.i18n.getMessage('commandOpenFrameInNewTab'),
      group: groups.navigation
    },
    {
      id: 'openFrameInNewWindow',
      handler: commandOpenFrameInNewWindow,
      label: browser.i18n.getMessage('commandOpenFrameInNewWindow'),
      group: groups.navigation
    },
    {
      id: 'openLinkInNewBackgroundTab',
      handler: commandOpenLinkInNewBackgroundTab,
      label: browser.i18n.getMessage('commandOpenLinkInNewBackgroundTab'),
      group: groups.navigation
    },
    {
      id: 'openLinkInNewForegroundTab',
      handler: commandOpenLinkInNewForegroundTab,
      label: browser.i18n.getMessage('commandOpenLinkInNewForegroundTab'),
      group: groups.navigation
    },
    {
      id: 'openLinkInNewForegroundTab|newTab',
      handler: (data) => ((data.element.linkHref) ? commandOpenLinkInNewForegroundTab : commandNewTab)(data),
      label: browser.i18n.getMessage('commandOpenLinkInNewForegroundTab|newTab'),
      tooltip: browser.i18n.getMessage('commandOpenLinkInNewForegroundTab|newTabTooltip'),
      group: groups.hybrid
    },
    {
      id: 'openLinkInNewWindow',
      handler: commandOpenLinkInNewWindow,
      label: browser.i18n.getMessage('commandOpenLinkInNewWindow'),
      group: groups.navigation
    },
    {
      id: 'openLinkInNewWindow|newWindow',
      handler: (data) => ((data.element.linkHref) ? commandOpenLinkInNewWindow : commandNewWindow)(data),
      label: browser.i18n.getMessage('commandOpenLinkInNewWindow|newWindow'),
      tooltip: browser.i18n.getMessage('commandOpenLinkInNewWindow|newWindowTooltip'),
      group: groups.hybrid
    },
    {
      id: 'openLinkInPrivateWindow',
      handler: commandOpenLinkInNewPrivateWindow,
      label: browser.i18n.getMessage('commandOpenLinkInNewPrivateWindow'),
      group: groups.navigation
    },
    {
      id: 'openLinksInSelection',
      handler: commandOpenLinksInSelection,
      label: browser.i18n.getMessage('commandOpenLinksInSelection'),
      tooltip: browser.i18n.getMessage('commandOpenLinksInSelectionTooltip'),
      group: groups.navigation
    },
    {
      id: 'openOptions',
      handler: commandOpenOptions,
      label: browser.i18n.getMessage('commandOpenOptions'),
      group: groups.other
    },
    {
      id: 'reloadAllTabs',
      handler: commandReloadAllTabs,
      label: browser.i18n.getMessage('commandReloadAllTabs'),
      tooltip: browser.i18n.getMessage('commandReloadAllTabsTooltip'),
      group: groups.tabs
    },
    {
      id: 'pageDown',
      handler: data => commands.executeInContent('pageDown', data),
      label: browser.i18n.getMessage('commandPageDown'),
      tooltip: browser.i18n.getMessage('commandPageDownTooltip'),
      group: groups.navigation
    },
    {
      id: 'pageUp',
      handler: data => commands.executeInContent('pageUp', data),
      label: browser.i18n.getMessage('commandPageUp'),
      tooltip: browser.i18n.getMessage('commandPageUpTooltip'),
      group: groups.navigation
    },
    {
      id: 'parentDirectory',
      handler: data => commands.executeInContent('parentDirectory', data),
      label: browser.i18n.getMessage('commandParentDirectory'),
      tooltip: browser.i18n.getMessage('commandParentDirectoryTooltip'),
      group: groups.navigation
    },
    {
      id: 'previousTab',
      handler: commandActivatePreviousTab,
      label: browser.i18n.getMessage('commandActivatePreviousTab'),
      group: groups.tabs
    },
    {
      id: 'pinUnpinTab',
      handler: commandPinUnpinTab,
      label: browser.i18n.getMessage('commandPinUnpinTab'),
      group: groups.tabs
    },
    {
      id: 'reload',
      handler: commandReload,
      label: browser.i18n.getMessage('commandReload'),
      group: groups.navigation
    },
    {
      id: 'reloadBypassCache',
      handler: commandReloadBypassCache,
      label: browser.i18n.getMessage('commandReloadBypassCache'),
      group: groups.navigation
    },
    {
      id: 'reloadFrame',
      handler: data => commands.executeInContent('reloadFrame', data),
      label: browser.i18n.getMessage('commandReloadFrame'),
      group: groups.navigation
    },
    {
      id: 'saveLinkAs',
      handler: commandSaveLinkAs,
      label: browser.i18n.getMessage('commandSaveLinkAs'),
      group: groups.other,
      permissions: [ 'downloads' ]
    },
    {
      id: 'saveMediaNow',
      handler: commandSaveMediaNow,
      label: browser.i18n.getMessage('commandSaveMediaNow'),
      tooltip: browser.i18n.getMessage('commandSaveMediaNowTooltip'),
      group: groups.other,
      permissions: [ 'downloads' ]
    },
    {
      id: 'saveMediaAs',
      handler: commandSaveMediaAs,
      label: browser.i18n.getMessage('commandSaveMediaAs'),
      tooltip: browser.i18n.getMessage('commandSaveMediaAsTooltip'),
      group: groups.other,
      permissions: [ 'downloads' ]
    },
    {
      id: 'scrollBottom',
      handler: data => {
        commands.executeInContent('scrollBottom', data);
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
      },
      label: browser.i18n.getMessage('commandScrollBottom'),
      group: groups.navigation
    },
    {
      id: 'scrollDown',
      handler: data => {
        commands.executeInContent('scrollDown', data);
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
      },
      label: browser.i18n.getMessage('commandScrollDown'),
      group: groups.navigation
    },
    {
      id: 'scrollTop',
      handler: data => {
        commands.executeInContent('scrollTop', data);
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
      },
      label: browser.i18n.getMessage('commandScrollTop'),
      group: groups.navigation
    },
    {
      id: 'scrollUp',
      handler: data => {
        commands.executeInContent('scrollUp', data);
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
      },
      label: browser.i18n.getMessage('commandScrollUp'),
      group: groups.navigation
    },
    {
      id: 'showOnlyThisFrame',
      handler: commandShowOnlyThisFrame,
      label: browser.i18n.getMessage('commandShowOnlyThisFrame'),
      group: groups.navigation
    },
    {
      id: 'stop',
      handler: data => {
        commands.executeInContent('stop', data);
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
      },
      label: browser.i18n.getMessage('commandStop'),
      group: groups.navigation
    },
    {
      id: 'undoClose',
      handler: commandUndoClose,
      label: browser.i18n.getMessage('commandUndoClose'),
      tooltip: browser.i18n.getMessage('commandUndoCloseTooltip'),
      group: groups.tabs
    },
    {
      id: 'undoCloseTab',
      handler: commandUndoCloseTab,
      label: browser.i18n.getMessage('commandUndoCloseTab'),
      tooltip: browser.i18n.getMessage('commandUndoCloseTabTooltip'),
      group: groups.tabs
    },
    {
      id: 'undoCloseWindow',
      handler: commandUndoCloseWindow,
      label: browser.i18n.getMessage('commandUndoCloseWindow'),
      tooltip: browser.i18n.getMessage('commandUndoCloseWindowTooltip'),
      group: groups.tabs
    },
    {
      id: 'viewFrameSource',
      handler: commandViewFrameSource,
      label: browser.i18n.getMessage('commandViewFrameSource'),
      tooltip: browser.i18n.getMessage('commandViewSourceTooltip'),
      group: groups.other
    },
    {
      id: 'viewPageSource',
      handler: commandViewPageSource,
      label: browser.i18n.getMessage('commandViewPageSource'),
      tooltip: browser.i18n.getMessage('commandViewSourceTooltip'),
      group: groups.other
    },
    {
      id: 'zoomIn',
      handler: commandZoomIn,
      label: browser.i18n.getMessage('commandZoomIn'),
      group: groups.tabs
    },
    {
      id: 'zoomOut',
      handler: commandZoomOut,
      label: browser.i18n.getMessage('commandZoomOut'),
      group: groups.tabs
    },
    {
      id: 'zoomReset',
      handler: commandZoomReset,
      label: browser.i18n.getMessage('commandZoomReset'),
      tooltip: browser.i18n.getMessage('commandZoomResetTooltip'),
      group: groups.tabs
    }
  ];

  // Keep track of the sequence in which tabs are activated in each window.
  const activeTabHistory = {};

  // Remember the window state for each window when going fullscreen.
  const windowStateHistory = {};

  // Event listeners ---------------------------------------------------------------------------------------------------

  // Remember the sequence in which tabs were activated for each window.
  browser.tabs.onActivated.addListener(info => {
    var sequence = activeTabHistory[info.windowId];
    if (sequence) {
      // Move the activated tab to the end of the sequence.
      let index = sequence.indexOf(info.tabId);
      if (index >= 0) {
        sequence.splice(index, 1);
      }
      sequence.push(info.tabId);
    } else {
      // Create a new sequence for the new window.
      sequence = [ info.tabId ];
      activeTabHistory[info.windowId] = sequence;
    }
  });

  // Remove closed tabs from the tab activation sequences.
  browser.tabs.onRemoved.addListener((tabId, info) => {
    let sequence = activeTabHistory[info.windowId];
    if (sequence) {
      let index = sequence.indexOf(tabId);
      if (index >= 0) {
        sequence.splice(index, 1);
      }
    }
  });

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
      topic: 'mg-contentCommand',
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

  // Clone the gesture state from one tab to another.
  function transitionGesture (from, to, state) {
    if (state) {
      // Always disable the gesture state in the de-activating tab because the de-activating tab may not be the tab
      // that generated the wheel gesture. (e.g.: rapidly scrolling the wheel through Next Tab commands.)
      return browser.tabs.sendMessage(to.id, { topic: 'mg-applyState', data: state })
        // Disable the gesture state after transitioning to the new tab or window.
        .then(() => (from !== null) ? browser.tabs.sendMessage(from.id, { topic: 'mg-abortGesture' }) : false)
        // If the tab being activated is internal to the browser, a channel exception will be thrown.
        .catch(t => {});
    } else {
      return Promise.resolve();
    }
  }

  // Close the current tab and activate the given, left, or right tab with gesture transition.
  function activateTabThenClose (data, tabs, next, active) {
    // Determine the active tab if not provided.
    active = active || tabs.find(tab => tab.active);

    // Find the largest index less than the active index.
    let left = tabs.reduce((left, tab) => {
      return (tab.index < active.index) && (tab.index > left.index) ? tab : left;
    }, { index: Number.MIN_SAFE_INTEGER, initial: true });

    // Find the smallest index greater than the active index.
    let right = tabs.reduce((right, tab) => {
      return (tab.index > active.index) && (tab.index < right.index) ? tab : right;
    }, { index: Number.MAX_SAFE_INTEGER, initial: true });

    // Determine the next tab to activate: given, left, or right.
    // Find the right/left tab with fallback to the left/right tab.
    if (next === 'left') {
      next = left.initial ? right : left;
    } else
    if (next === 'right' || !next) {
      next = right.initial ? left : right;
    }

    // Activate the next tab, then close the previous tab.
    return browser.tabs.update(next.id, { active: true })
      .then(() => transitionGesture(null, next, data.cloneState))
      .then(() => browser.tabs.remove(active.id));
  }

  // Get the previously active tab for a window.
  function getRecentlyActiveTab (windowId, tabs) {
    // The last tab in the sequence is the active tab for the window; find the second from last tab.
    let sequence = activeTabHistory[windowId];
    if (sequence && (sequence.length >= 2)) {
      let id = sequence[sequence.length - 2];
      return tabs.find(tab => tab.id === id);
    }

    // Unable to determine recently active tab.
    return null;
  }

  // Close the current tab and activate the left, right, recent, or Firefox's choice of tab.
  function closeTabTransition (data, direction) {
    return browser.tabs.query({ currentWindow: true, hidden: false }).then(tabs => {
      let active = tabs.find(tab => tab.active);
      if (active.pinned) {
        // Pinned tabs cannot be closed by a gesture.
        return { repeat: true };
      }
      if (tabs.length === 1) {
        // Don't care about tab being activated if the window is closing.
        return browser.tabs.remove(active.id);
      }

      switch (direction) {
        case 'right':
          // Activate the right tab before closing.
          return activateTabThenClose(data, tabs, 'right', active);
        case 'left':
          // Activate the left tab before closing.
          return activateTabThenClose(data, tabs, 'left', active);
        case 'recent':
          // Activately the recently active tab before closing.
          let recent = getRecentlyActiveTab(tabs[0].windowId, tabs);
          return activateTabThenClose(data, tabs, recent, active);
        default:
          // Let Firefox activate a tab, then transition to it.
          return browser.tabs.remove(active.id)
            .then(() => browser.tabs.query({ currentWindow: true, active: true }))
            .then(tabs => transitionGesture(null, tabs[0], data.cloneState));
      }
    });
  }

  // Restore a tab or window and attempt a gesture state transition to the restored tab.
  function undoCloseSession (data, session) {
    if (session.tab) {
      return browser.sessions.restore(session.tab.sessionId).then(() => {
        // Transition the gesture into the restored tab using state cloning.
        modules.handler.addRestoreState(session.tab.id, data.cloneState);
      });
    } else
    if (session.window) {
      return browser.sessions.restore(session.window.sessionId).then(() => {
        // Find the active tab in the restored window.
        return browser.tabs.query({ windowId: session.window.id, active: true }).then(tabs => {
          // Transition the gesture into the restored tab using state cloning.
          modules.handler.addRestoreState(tabs[0].id, data.cloneState);
        });
      });
    }
  }

  // Convert about:newtab or empty strings to null, otherwise return the URL.
  function notAboutNewTabUrl (url) {
    return (url && (url = url.trim()) !== 'about:newtab') ? url : null;
  }

  // Command implementations -------------------------------------------------------------------------------------------

  // Activate the first tab in the window.
  function commandActivateFirstTab (data) {
    return browser.tabs.query({ currentWindow: true, hidden: false }).then(tabs => {
      let active = tabs.find(tab => tab.active);
      let first = tabs.reduce((first, tab) => (tab.index < first.index) ? tab : first,
        { index: Number.MAX_SAFE_INTEGER });
      if (active === first) {
        // Already on the first tab.
        return { repeat: true };
      } else {
        // Transition the gesture into the first tab using state cloning.
        return transitionGesture(active, first, data.cloneState)
          .then(() => browser.tabs.update(first.id, { active: true }));
      }
    });
  }

  // Activate the last tab in the window.
  function commandActivateLastTab (data) {
    return browser.tabs.query({ currentWindow: true, hidden: false }).then(tabs => {
      let active = tabs.find(tab => tab.active);
      let last = tabs.reduce((last, tab) => (tab.index > last.index) ? tab : last,
        { index: Number.MIN_SAFE_INTEGER });
      if (active === last) {
        // Already on the last tab.
        return { repeat: true };
      } else {
        // Transition the gesture into the first tab using state cloning.
        return transitionGesture(active, last, data.cloneState)
          .then(() => browser.tabs.update(last.id, { active: true }));
      }
    });
  }

  // Activate the next tab.
  function commandActivateNextTab (data) {
    return browser.tabs.query({ currentWindow: true, hidden: false }).then(tabs => {
      let active = tabs.find(tab => tab.active);
      let last = tabs.reduce((last, tab) => (tab.index > last.index) ? tab : last,
        { index: Number.MIN_SAFE_INTEGER });
      if (active.index === last.index) {
        if (modules.settings.nextTabWrap) {
          // Last tab and wrapping is enabled.
          let first = tabs.reduce((first, tab) => (tab.index < first.index) ? tab : first,
            { index: Number.MAX_SAFE_INTEGER });

          return transitionGesture(active, first, data.cloneState)
            .then(() => browser.tabs.update(first.id, { active: true }));
        } else {
          // Last tab and wrapping is disabled.
          // Allow the wheel or chord gesture to repeat.
          return { repeat: true };
        }
      } else {
        // Transition the gesture into the next tab using state cloning.
        // Find the smallest index greater than the active index.
        let next = tabs.reduce((next, tab) => {
          return (tab.index > active.index) && (tab.index < next.index) ? tab : next;
        }, last);

        return transitionGesture(active, next, data.cloneState)
          .then(() => browser.tabs.update(next.id, { active: true }));
      }
    });
  }

  // Activate the previous tab.
  function commandActivatePreviousTab (data) {
    return browser.tabs.query({ currentWindow: true, hidden: false }).then(tabs => {
      let active = tabs.find(tab => tab.active);
      let first = tabs.reduce((first, tab) => (tab.index < first.index) ? tab : first,
        { index: Number.MAX_SAFE_INTEGER });
      if (active.index === first.index) {
        if (modules.settings.nextTabWrap) {
          // First tab and wrapping is enabled.
          let last = tabs.reduce((last, tab) => (tab.index > last.index) ? tab : last,
            { index: Number.MIN_SAFE_INTEGER });

          return transitionGesture(active, first, data.cloneState)
            .then(() => browser.tabs.update(last.id, { active: true }));
        } else {
          // First tab and wrapping is disabled.
          // Allow the wheel or chord gesture to repeat.
          return { repeat: true };
        }
      } else {
        // Transition the gesture into the next tab using state cloning.
        // Find the largest index less than the active index.
        let previous = tabs.reduce((previous, tab) => {
          return (tab.index < active.index) && (tab.index > previous.index) ? tab : previous;
        }, first);

        return transitionGesture(active, previous, data.cloneState)
          .then(() => browser.tabs.update(previous.id, { active: true }));
      }
    });
  }

  // Activate the recent tab.
  function commandActivateRecentTab (data) {
    return browser.tabs.query({ currentWindow: true }).then(tabs => {
      let active = tabs.find(tab => tab.active);
      let recent = getRecentlyActiveTab(tabs[0].windowId, tabs);
      if (recent) {
        return transitionGesture(active, recent, data.cloneState)
          .then(() => browser.tabs.update(recent.id, { active: true }));
      } else {
        return { repeat: true };
      }
    });
  }

  // Bookmark the URL in the active tab.
  function commandBookmarkUrl (data) {
    return browser.tabs.query({ currentWindow: true, active: true })
      .then(tabs => {
        let active = tabs[0];
        return browser.bookmarks.search({ url: active.url }).then(bookmarks => {
          if (bookmarks.length === 0) {
            return browser.bookmarks.create({ url: active.url, title: active.title });
          } else
          if (bookmarks.length === 1) {
            return browser.bookmarks.remove(bookmarks[0].id);
          }
        });
      })
      // Allow the wheel or chord gesture to repeat.
      .then(() => ({ repeat: true }));
  }

  // Close tabs to the left of the active tab.
  function commandCloseLeftTabs () {
    return browser.tabs.query({ currentWindow: true, hidden: false })
      .then(tabs => {
        let activeTabIndex = tabs.find(tab => tab.active).index;
        return browser.tabs.remove(tabs.filter(tab => {
          return (tab.index < activeTabIndex) && !tab.pinned;
        }).map(tab => tab.id));
      })
      // Allow the wheel or chord gesture to repeat.
      .then(() => ({ repeat: true }));
  }

  // Close all tabs other than the active tab.
  function commandCloseOtherTabs () {
    return browser.tabs.query({ currentWindow: true, hidden: false })
      .then(tabs => {
        return browser.tabs.remove(tabs.filter(tab => !tab.active && !tab.pinned).map(tab => tab.id));
      })
      // Allow the wheel or chord gesture to repeat.
      .then(() => ({ repeat: true }));
  }

  // Close tabs to the right of the active tab.
  function commandCloseRightTabs () {
    return browser.tabs.query({ currentWindow: true, hidden: false })
      .then(tabs => {
        let activeTabIndex = tabs.find(tab => tab.active).index;
        return browser.tabs.remove(tabs.filter(tab => {
           return (tab.index > activeTabIndex) && !tab.pinned;
        }).map(tab => tab.id));
      })
      // Allow the wheel or chord gesture to repeat.
      .then(() => ({ repeat: true }));
  }

  // Close the active tab.
  function commandCloseTab (data) {
    return closeTabTransition(data, modules.settings.activeTabAfterClose);
  }

  // Close the current tab and activate the tab to the left.
  function commandCloseTabActivateLeft (data) {
    return closeTabTransition(data, 'left');
  }

  // Close the current tab and activate the tab to the left.
  function commandCloseTabActivateRight (data) {
    return closeTabTransition(data, 'right');
  }

  // Close the current window,
  function commandCloseWindow () {
    return browser.windows.getCurrent().then(window => browser.windows.remove(window.id));
  }

  // Duplicate the active tab.
  function commandDuplicateTab () {
    return browser.tabs.query({ currentWindow: true, active: true }).then(tabs => {
      return browser.tabs.duplicate(tabs[0].id);
    });
  }

  // Duplicate the active tab in a new private window.
  function commandDuplicateTabInNewPrivateWindow () {
    return browser.tabs.query({ currentWindow: true, active: true }).then(tabs => {
      return browser.windows.create({ url: tabs[0].url, incognito: true });
    });
  }

  // Toggle between fullscreen and last known window state.
  // Not: There is currently no onChanged event for windows, so we are unable to determine the previous window state
  // if the user goes fullscreen with F11.
  function commandFullscreen () {
    return browser.windows.getCurrent({})
      .then(win => {
        if (win.state !== 'fullscreen') {
          // Remember the current state and go fullscreen.
          windowStateHistory[win.id] = win.state;
          return browser.windows.update(win.id, { state: 'fullscreen' });
        } else {
          // Try to restore the previous state of the window.
          let oldState = windowStateHistory[win.id] || 'maximize';
          delete windowStateHistory[win.id];
          return browser.windows.update(win.id, { state: oldState });
        }
      })
      // Allow the wheel or chord gesture to repeat.
      .then(() => ({ repeat: true }));
  }

  // Go to the first URL in the user's home page setting.
  function commandGoHome () {
    return browser.browserSettings.homepageOverride.get({}).then(result => {
      let pipe = result.value.indexOf('|');
      let homePage = (pipe >= 0) ? result.value.substring(0, pipe) : result.value;
      return browser.tabs.update({ url: homePage });
    });
  }

  // Maximzie/restore the current window.
  function commandMaximize () {
    return browser.windows.getCurrent()
      .then(win => {
        let newState = (win.state === 'maximized') ? 'normal' : 'maximized';
        return browser.windows.update(win.id, { state: newState });
      })
      // Allow the wheel or chord gesture to repeat.
      .then(() => ({ repeat: true }));
  }

  // Minimize the current window.
  function commandMinimize () {
    return browser.windows.getCurrent()
      .then(win => browser.windows.update(win.id, { state: "minimized" }));
  }

  // Move the active tab to a new window.
  function commandMoveTabToNewWindow () {
    return browser.tabs.query({ currentWindow: true, active: true })
      .then(tabs => browser.windows.create({ tabId: tabs[0].id }));
  }

  // Create a new empty tab.
  function commandNewTab (data) {
    // In Firefox the New Tab button does not preserve the container.
    // Firefox's default is for new tabs to be active and inserted at the end of the tab bar.
    let tabOptions = {};
    tabOptions.url = notAboutNewTabUrl(settings.newTabUrl);
    tabOptions.active = true;
    return browser.tabs.create(tabOptions);
  }

  // Create a new empty window.
  function commandNewWindow (data) {
    // In Firefox a New Window does not preserve the container.
    return browser.windows.create({ url: notAboutNewTabUrl(settings.newWindowUrl) });
  }

  // Create a new empty private window.
  function commandNewPrivateWindow (data) {
    return browser.windows.create({ url: notAboutNewTabUrl(settings.newWindowUrl), incognito: true });
  }

  // Open a frame in a new tab.
  function commandOpenFrameInNewTab (data) {
    if (data.context.frameUrl) {
      return browser.tabs.query({ currentWindow: true, active: true }).then(tabs => {
        let tabOptions = {};
        tabOptions.url = data.context.frameUrl;
        tabOptions.active = true;
        tabOptions.openerTabId = tabs[0].id;
        // Preserve the container when opening a new tab from a link/frame.
        tabOptions.cookieStoreId = tabs[0].cookieStoreId;
        if (settings.insertRelatedTab) {
          tabOptions.index = tabs[0].index + 1;
        }
        return browser.tabs.create(tabOptions);
      });
    }
  }

  // Open a frame in a new window.
  function commandOpenFrameInNewWindow (data) {
    // In Firefox a New Window does not preserve the container.
    if (data.context.frameUrl) {
      return browser.windows.create({ url: data.context.frameUrl });
    }
  }

  // Open a link in a new background tab.
  function commandOpenLinkInNewBackgroundTab (data, url) {
    let promise = Promise.resolve();

    if (url || data.element.linkHref) {
      promise = browser.tabs.query({ currentWindow: true, active: true }).then(tabs => {
        let tabOptions = {};
        tabOptions.url = url || data.element.linkHref;
        tabOptions.active = false;
        tabOptions.openerTabId = tabs[0].id;
        // Preserve the container when opening a new tab from a link/frame.
        tabOptions.cookieStoreId = tabs[0].cookieStoreId;
        if (settings.insertRelatedTab) {
          tabOptions.index = tabs[0].index + 1;
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
      return browser.tabs.query({ currentWindow: true, active: true }).then(tabs => {
        let tabOptions = {};
        tabOptions.url = data.element.linkHref;
        tabOptions.active = true;
        tabOptions.openerTabId = tabs[0].id;
        // Preserve the container when opening a new tab from a link/frame.
        tabOptions.cookieStoreId = tabs[0].cookieStoreId;
        if (settings.insertRelatedTab) {
          tabOptions.index = tabs[0].index + 1;
        }
        return browser.tabs.create(tabOptions);
      });
    }
  }

  // Open a link in a new window.
  function commandOpenLinkInNewWindow (data) {
    // In Firefox a New Window does not preserve the container.
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

  // Open all links in the selection in background tabs.
  function commandOpenLinksInSelection (data) {
    // Get the links that appear in the selection.
    return browser.tabs.sendMessage(data.sender.tab.id, {
      topic: 'mg-getSelectedLinks',
      data
    }).then(links => {
      // When insertRelatedTab is true, new tabs are placed adjacent to the current tab.
      // Reversing the array opens the tabs in the same order as the links appear in the DOM.
      if (settings.insertRelatedTab) {
        links.reverse();
      }

      // Open each link in a background tab.
      links.forEach(link => commandOpenLinkInNewBackgroundTab(data, link));

      // Allow the wheel or chord gesture to repeat.
      return { repeat: true };
    });
  }

  // Open the options page in a new tab.
  function commandOpenOptions (data) {
    browser.management.getSelf().then(selfInfo => {
      return browser.tabs.query({ currentWindow: true, active: true }).then(tabs => {
        let tabOptions = {};
        tabOptions.url = selfInfo.optionsUrl;
        tabOptions.active = true;
        if (settings.insertRelatedTab) {
          tabOptions.index = tabs[0].index + 1;
        }
        return browser.tabs.create(tabOptions);
      });
    });
  }

  // Reload all tabs in the current window.
  function commandReloadAllTabs () {
    return browser.tabs.query({ currentWindow: true, hidden: false }).then(tabs => {
      tabs.forEach(tab => browser.tabs.reload(tab.id));
      // Allow the wheel or chord gesture to repeat.
      return { repeat: true };
    });
  }

  // Pin or unpin the current tab.
  function commandPinUnpinTab (data) {
    return browser.tabs.query({ currentWindow: true, active: true }).then(tabs => {
      return browser.tabs.update({ pinned: !tabs[0].pinned })
        // Allow the wheel or chord gesture to repeat.
        .then(() => ({ repeat: true }));
    });
  }

  // Reload the active tab.
  function commandReload () {
    return browser.tabs.query({ currentWindow: true, active: true }).then(tabs => {
      return browser.tabs.reload(tabs[0].id);
    });
  }

  // Reload the active tab and bypass the cache.
  function commandReloadBypassCache () {
    return browser.tabs.query({ currentWindow: true, active: true }).then(tabs => {
      return browser.tabs.reload(tabs[0].id, { bypassCache: true });
    });
  }

  // Save the link href under the gesture.
  // Prompt for the location to save the file.
  function commandSaveLinkAs (data) {
    let promise;
    if (data.element.linkHref) {
      // Start the download.
      promise = browser.downloads.download({
        url: data.element.linkHref,
        saveAs: true
      });
    } else {
      promise = Promise.resolve(data);
    }

    // Allow the wheel or chord gesture to repeat.
    return promise.then(() => ({ repeat: true }));
  }

  // Save the media URL of the element under the gesture.
  function commandSaveMediaNow (data, saveAs) {
    let promise = Promise.resolve(data);
    if (data.element.mediaSource) {
      // Due to the performance impact of capturing canvas data it is no longer collected a priori.
      // Instead the canvas element is tagged with a data-fg-ref attribute so it can be located later.
      if (data.element.mediaType === 'canvasRef') {
        // Replace the canvas reference with the canvas data.
        promise = browser.tabs.sendMessage(data.sender.tab.id, {
          topic: 'mg-getCanvasImage',
          data
        });
      }

      promise = promise.then(data => {
        if (data.element.mediaSource) {
          // Convert data URLs to blob as a workaround for:
          // https://bugzilla.mozilla.org/show_bug.cgi?id=1318564
          let url = data.element.mediaSource;
          if (url.startsWith('data:')) {
            url = URL.createObjectURL(helpers.dataURItoBlob(url));
          }

          // Start the download.
          return browser.downloads.download({
            url,
            filename: helpers.suggestFilename(data.element.mediaSource, data.element.mediaType),
            saveAs
          });
        }
      });
    }

    // Allow the wheel or chord gesture to repeat.
    return promise.then(() => ({ repeat: true }));
  }

  // Save the media URL of the element under the gesture.
  // Prompt for the location to save the file.
  function commandSaveMediaAs (data) {
    return commandSaveMediaNow(data, true);
  }

  // Navigate to the URL of the frame.
  function commandShowOnlyThisFrame (data) {
    if (data.context.nested && data.context.frameUrl) {
      return browser.tabs.query({ currentWindow: true, active: true }).then(tabs => {
        return browser.tabs.update(tabs[0].id, { url: data.context.frameUrl });
      });
    }
  }

  // View the source of a page.
  function commandViewFrameSource (data) {
    if (data.context.frameUrl) {
      return browser.tabs.query({ currentWindow: true, active: true }).then(tabs => {
        let tabOptions = {};
        tabOptions.url = 'view-source:' + data.context.frameUrl;
        tabOptions.active = true;
        tabOptions.openerTabId = tabs[0].id;
        // Preserve the container when opening a new tab from a link/frame.
        tabOptions.cookieStoreId = tabs[0].cookieStoreId;
        if (settings.insertRelatedTab) {
          tabOptions.index = tabs[0].index + 1;
        }
        return browser.tabs.create(tabOptions);
      });
    }
  }

  // View the source of a frame.
  function commandViewPageSource (data) {
    return browser.tabs.query({ currentWindow: true, active: true }).then(tabs => {
      let tabOptions = {};
      tabOptions.url = 'view-source:' + tabs[0].url;
      tabOptions.active = true;
      tabOptions.openerTabId = tabs[0].id;
      // Preserve the container when opening a new tab from a link/frame.
      tabOptions.cookieStoreId = tabs[0].cookieStoreId;
      if (settings.insertRelatedTab) {
        tabOptions.index = tabs[0].index + 1;
      }
      return browser.tabs.create(tabOptions);
    });
  }

  // Restore the most recently closed tab or window.
  function commandUndoClose (data) {
    return browser.sessions.getRecentlyClosed({ maxResults: 1 }).then(sessions => {
      if (sessions.length) {
        // Disable the gesture state in the current tab.
        browser.tabs.sendMessage(data.sender.tab.id, { topic: 'mg-abortGesture' });

        // Restore the tab or window.
        return undoCloseSession(data, sessions[0]);
      } else {
        // Nothing to restore.
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
      }
    });
  }

  // Restore the most recently closed tab in the current window.
  function commandUndoCloseTab (data) {
    return browser.windows.getCurrent().then(window => {
      return browser.sessions.getRecentlyClosed().then(sessions => {
        let tabSession = sessions.find(session => session.tab && (session.tab.windowId = window.id));
        if (tabSession) {
          // Disable the gesture state in the current tab.
          browser.tabs.sendMessage(data.sender.tab.id, { topic: 'mg-abortGesture' });

          // Restore the tab.
          return undoCloseSession(data, tabSession);
        } else {
          // Nothing to restore.
          // Allow the wheel or chord gesture to repeat.
          return { repeat: true };
        }
      });
    });
  }

  // Restore the most recently closed window.
  function commandUndoCloseWindow (data) {
    return browser.sessions.getRecentlyClosed().then(sessions => {
      let windowSession = sessions.find(session => session.window);
      if (windowSession) {
        // Disable the gesture state in the current tab.
        browser.tabs.sendMessage(data.sender.tab.id, { topic: 'mg-abortGesture' });

        // Restore the window.
        return undoCloseSession(data, windowSession);
      } else {
        // Nothing to restore.
        // Allow the wheel or chord gesture to repeat.
        return { repeat: true };
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

  // Deprecated --------------------------------------------------------------------------------------------------------
  // Leaving these functions here in case someone is using them in user scripts.

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

  return commands;

}(modules.settings, modules.helpers));
