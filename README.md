# Foxy Gestures

A mouse gestures extension for Firefox. This project was started as a web
extensions alternative to FireGestures. Unfortunately, FireGestures will stop
working when XUL/XPCOM add-ons are fully deprecated in Firefox 57.

#### Feature Requests

FireGestures is a very mature plugin with a huge number of features. Although I used it for many years, I probably didn't use it in the exact same way as you. Some features maybe have been unintentionally ignored or forgotten by me. I am slowly implementing features in Foxy Gestures as my time allows. [This wiki article contains a list of supported commands vs FireGestures](https://github.com/marklieberman/foxygestures/wiki/Supported-Commands-vs.-FireGestures). The list is not exhaustive and you can request features using GitHub issues even if they are not currently planned.

#### Limitations

As a web extension, this add-on will never be as powerful as FireGestures.
This extension does not integrate into about:home, view-source:, etc. Nor will
it work on addons.mozilla.com, since web extensions are forbidden from
interacting with the add-on store.

More importantly, the __mouse gestures will not work until the document body of
the website you are visiting has parsed__. In other words, the DOM must be
parsed but content does not have to be loaded. This limitation also applies to
frames within the website. This is an inherent limitation of web extensions
at the moment, because there is no API to get mouse events from browser chrome.

#### Working Principle

This extension hooks into DOM mouse events. However, each frame in a website
is a separate DOM often with a separate origin. In a naïve implementation the
mouse gesture would stop tracking whenever the mouse passed over an iframe.

The solution is to have the web extension inject _mouseEvents.js_ into every
frame. Each time the script loads it will determine if it has been framed. If
the script has been framed, it will establish communication with its parent
frame (also running _mouseEvents.js_) via `postMessage()`. Nested instances of
the script will relay mouse events up the hierarchy. As the message bubbles up
the hierarchy, each script applies a coordinate offset based on the position of
the nested &lt;frame&gt; or &lt;iframe&gt; element. In this way, the top-most
script sees all mouse events in the coordinate space of the top-most DOM.
_mouseEvents.js_ also maintains a small amount of state. To keep all instances
of the script in sync, this state is replicated by passing messages down the
hierarchy. Ultimately, this setup provides the extension with a seamless view
of mouse events across all frames upon which to build the rest of the extension.

It is worth noting that DOM references cannot be shared via post message. As a
result, a reference to the element under the mouse gesture is only available in
_mouseEvents.js_ in the frame which generated the event. To support features
that need information about the element, attributes are collected a priori and
bundled with mouse event data for mouse up/down events. To support situations
that require access to the live DOM, _mouseEvents.js_ assigns a unique
identifier to each frame in which it loads. Messages may be addressed to a
specific frame using the unique frame ID.

##### OSX/Linux Gesture Button Limitation

Note: this issue is resolved from FF58 and FG1.1.0 due to API changes landing in Firefox. ~~In OSX and Linux, the context menu is shown on mouse down. (Context menu on
mouse up is the default for Windows.) When FireGestures is installed on OSX/Linux,
it changes the context menu to be shown on mouse up. Web extensions cannot
replicate this functionality. Due to the issue described in
[#4](https://github.com/marklieberman/foxygestures/issues/4) right-button
gestures work poorly in OSX/Linux.~~

#### Changelog

Version 1.1.0
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

Version 1.0.15
 - Fix right-click in gestures counts towards double right-click.
 - Fix OSX mouse event oddity causing false sticky gesture detection.
 - Fix some missing i18n strings.

Version 1.0.14
 - Added option for double right click mode OSX/Linux.
 - Added support for localization with locales to come.
 - Fixed Closed Tab command not repeatable.
 - Fixed handling of containers on new tabs, windows, etc. to be more like default Firefox behaviour.
 - Fixed specify openerTabId on new tabs (for compatibility with Tab Tree, etc.)

Version 1.0.13
 - Fixed an XSS security bug.

Version 1.0.11
 - Added preference to enable text selection when gesture button is 'Left'.
 - Added request for 'clipboardWrite' permission due to user request.
 - Fixed mouse movement accumulator not reset on mouse down.
 - Fixed some chord/wheel gestures not resetting correctly.

Version 1.0.10
 - Fix issue with previous release that broke options page.

Version 1.0.9
 - Added chord gesture support.
 - Added option to disable gestures when Alt is pressed.
 - Added command to pin and unpin the current tab.
 - Fix backup settings button broken on some platforms.
 - Mouse gesture will not start unless the mouse moves 10 pixels. This helps to avoid swallowing button clicks when the mouse moves slightly such as when pressing middle button.

Version 1.0.8
 - Added commands: reload (bypass cache), scroll up, scroll down, zoom in, zoom out, zoom reset.
 - Improved duplicate tab command.
 - Fixed sticky gesture state from wheel gestures.
 - Fixed containers not preserved by open link in new tab and related commands.
 - Moved settings page to a tab until [1385548](https://bugzilla.mozilla.org/show_bug.cgi?id=1385548) is fixed.

Version 1.0.7
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

Version 1.0.6
 - Minor bug fixes

Version 1.0.5
 - Added commands: duplicate tab in new private window, move tab to new window,
   new tab, new window, new private window, open link in new private window,
   close tabs to the left, close tabs to the right, close other tabs.

Version 1.0.3
 - Implement support for wheel gestures.
 - Implement support for user scripts.
 - Added commands: next tab, previous tab, show only this frame.

Version 1.0.2
 - Implement status text for gestures.

Version 1.0.1
 - Scripts injected at document_start for slightly faster loading in some cases.

Version 1.0.0
 - Initial release
