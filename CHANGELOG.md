# Changelog

### Version 1.2.4
 - Fixed a broken command Undo Close Tab.

### Version 1.2.3
 - Fixed a bug in Go to Previous Tab when wrapping to last tab.

### Version 1.2.2
 - No changes. An AMO reviewer mistakenly disabled 1.2.1 and required a version bump to re-instate the addon.

### Version 1.2.1
 - Excluding content scripts on duosecurity.com due to Duo/FG interaction causing an infinite redirect loop. See [#257](https://github.com/marklieberman/foxygestures/issues/257)

### Version 1.2.0
 - Added support for diagonal gestures.
 - Added hybrid command History Back or Close Tab.
 - Added hybrid command Open Link in New Tab/Window or Open New Tab/Window.
 - Added command Save Link As.
 - Added commands Undo Close Tab and Undo Close Window (in addition to existing Undo Close command.)
 - Fixed save media now failing for some URLs.
 - Fixed handling of hidden tabs.

This version requires FF61+ dues to changes related to hidden tabs.

### Version 1.1.1
 - Implemented a blacklist to disable gestures by default for matching URLs.
 - Added a browserAction to enable/disable gestures per tab.
 - Undo Close command is better at suppressing context menu and being repeatable.
 - Fixed scrolling commands not working in many situations.
 - Added command Open Links in Selection.
 - Added command Parent Directory.
 - Fixed poor performance on canvas-based websites like Google maps.
 - Added commands Close Tab and Activate Left/Right.
 - Fixed filename is URL encoded when saving from some URLs.
 - Implemented optional permissions for: bookmarks, clipboardWrite, and downloads.
 - Added command Reload All Tabs.
 - Fixed command Close Other Tabs closes pinned tabs.
 - Deprecated data.element.mediaInfo (use data.element.mediaSource and data.element.mediaType instead.)

This version requires FF60+ because of optional_permissions use of 'downloads' permission.

Note: if you are upgrading, you can use the More Preferences tab to revoke optional permissions that were previously
required.

### Version 1.1.0
 - Fix for OSX/Linux context menu issue due to API landing in FF58.
 - Added command to open Foxy Gestures options.
 - Added stop command.
 - Added home command.
 - Added got to first/last tab commands.
 - Added setting to select active tab (left/right/recent) after close tab command.
 - Added go to recent tab command.
 - Added bookmark/unbookmark URL command.
 - Added maximize and fullscreen commands.
 - Added button to reset settings.
 - Added close window command.
 - Added view page/frame source commands.
 - Re-enabled support for gestures on about:blank.

This version requires FF58+ because browserSettings.contextMenuShowEvent was introduced.

### Version 1.0.15
 - Fix right-click in gestures counts towards double right-click.
 - Fix OSX mouse event oddity causing false sticky gesture detection.
 - Fix some missing i18n strings.

### Version 1.0.14
 - Added option for double right click mode OSX/Linux.
 - Added support for localization with locales to come.
 - Fixed Closed Tab command not repeatable.
 - Fixed handling of containers on new tabs, windows, etc. to be more like default Firefox behaviour.
 - Fixed specify openerTabId on new tabs (for compatibility with Tab Tree, etc.)

### Version 1.0.13
 - Fixed an XSS security bug.

### Version 1.0.11
 - Added preference to enable text selection when gesture button is 'Left'.
 - Added request for 'clipboardWrite' permission due to user request.
 - Fixed mouse movement accumulator not reset on mouse down.
 - Fixed some chord/wheel gestures not resetting correctly.

### Version 1.0.10
 - Fix issue with previous release that broke options page.

### Version 1.0.9
 - Added chord gesture support.
 - Added option to disable gestures when Alt is pressed.
 - Added command to pin and unpin the current tab.
 - Fix backup settings button broken on some platforms.
 - Mouse gesture will not start unless the mouse moves 10 pixels. This helps to avoid swallowing button clicks when the mouse moves slightly such as when pressing middle button.

### Version 1.0.8
 - Added commands: reload (bypass cache), scroll up, scroll down, zoom in, zoom out, zoom reset.
 - Improved duplicate tab command.
 - Fixed sticky gesture state from wheel gestures.
 - Fixed containers not preserved by open link in new tab and related commands.
 - Moved settings page to a tab until [1385548](https://bugzilla.mozilla.org/show_bug.cgi?id=1385548) is fixed.

### Version 1.0.7
 - Fixed context menu appearing in certain situations.
 - Fixed breakage in frameset pages.
 - Fixed settings not working in 56+.
 - Improved the Page Up and Page Down commands.
 - Improved Open Link in XX commands.
 - Improved Scroll to Top/Bottom command in some situations.
 - Added validation feedback to settings
 - Added preference for new tab placement in tab bar.
 - Added preference for new tab focus.
 - Added backup and restore settings buttons to settings.
 - Settings are now stored in storage.sync.

### Version 1.0.6
 - Minor bug fixes

### Version 1.0.5
 - Added commands: duplicate tab in new private window, move tab to new window,
   new tab, new window, new private window, open link in new private window,
   close tabs to the left, close tabs to the right, close other tabs.

### Version 1.0.3
 - Implement support for wheel gestures.
 - Implement support for user scripts.
 - Added commands: next tab, previous tab, show only this frame.

### Version 1.0.2
 - Implement status text for gestures.

### Version 1.0.1
 - Scripts injected at document_start for slightly faster loading in some cases.

### Version 1.0.0
 - Initial release
