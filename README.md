# Foxy Gestures

A mouse gestures extension for Firefox. This project was started as a web
extensions alternative to FireGestures. Unfortunately, FireGestures will stop
working when XUL/XPCOM add-ons are fully deprecated in Firefox 57.

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

##### OSX/Linux Gesture Button Limitation

In OSX and Linux, the context menu is shown on mouse down. (Context menu on
mouse up is the default for Windows.) When FireGestures is installed on OSX/Linux,
it changes the context menu to be shown on mouse up. Web extensions cannot
replicate this functionality. Due to the issue described in
[#4](https://github.com/marklieberman/foxygestures/issues/4) right-button
gestures work poorly in OSX/Linux.

An option to use a modifier key to start or ignore gestures is being developed.
If you want to see a proper solution to this issue, please support
[this Bugzilla entry](https://bugzilla.mozilla.org/show_bug.cgi?id=1360278).
Update: the bug was accepted and is awaiting a user contributed patch. If you
are available to help write this patch please contact me.

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

#### Changelog

Version 1.0.6 released on _2017-06-11_
 - Minor bug fixes

Version 1.0.5 released on _2017-05-24_
 - Added commands: duplicate tab in new private window, move tab to new window,
   new tab, new window, new private window, open link in new private window,
   close tabs to the left, close tabs to the right, close other tabs.

Version 1.0.3 released on _2017-05-09_
 - Implement support for wheel gestures.
 - Implement support for user scripts.
 - Added commands: next tab, previous tab, show only this frame.

Version 1.0.2 released on _2017-04-13_
 - Implement status text for gestures.

Version 1.0.1 released on _2017-04-08_
 - Scripts injected at document_start for slightly faster loading in some cases.

Version 1.0.0 released on _2017-04-07_
 - Initial release
