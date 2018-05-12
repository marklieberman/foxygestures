# Foxy Gestures

A mouse gestures extension for Firefox. This project was started as a web extensions alternative to FireGestures.
Unfortunately, FireGestures will stop working when XUL/XPCOM add-ons are fully deprecated in Firefox 57.

#### Feature Requests

FireGestures is a very mature plugin with a huge number of features. Although I used it for many years, I probably
didn't use it in the exact same way as you. Some features maybe have been unintentionally ignored or forgotten by me.
I am slowly implementing features in Foxy Gestures as my time allows. [This wiki article contains a list of supported
commands vs FireGestures](https://github.com/marklieberman/foxygestures/wiki/Supported-Commands-vs.-FireGestures). The
list is not exhaustive and you can request features using GitHub issues even if they are not currently planned.

#### Limitations

As a web extension, this add-on will never be as powerful as FireGestures. __This extension does not integrate into
about:home, about:newtab, view-source:, moz-extension:, etc. Nor will it work on addons.mozilla.com__, since web
extensions are forbidden from interacting with the add-on store.

More importantly, the __mouse gestures will not work until the document body of the website you are visiting has
parsed__. In other words, the DOM must be at least partially parsed but content does not have to be loaded. This
limitation also applies to frames within the website. This is an inherent limitation of web extensions at the moment,
because there is no API to get mouse events from browser chrome. In practice this is rarely an issue as mouse events
are typically available very quickly.

#### Working Principle

This extension hooks into DOM mouse events. However, each frame in a website is a separate DOM often with a separate
origin. In a naïve implementation the mouse gesture would stop tracking whenever the mouse passed over an iframe.

The solution is to have the web extension inject _mouseEvents.js_ into every frame. Each time the script loads it will
determine if it has been framed. If the script has been framed, it will establish communication with its parent frame
(also running _mouseEvents.js_) via `postMessage()`. Nested instances of the script will relay mouse events up the
hierarchy. As the message bubbles up the hierarchy, each script applies a coordinate offset based on the position of
the nested &lt;frame&gt; or &lt;iframe&gt; element. In this way, the top-most script sees all mouse events in the
coordinate space of the top-most DOM. _mouseEvents.js_ also maintains a small amount of state. To keep all instances
of the script in sync, this state is replicated by passing messages down the hierarchy. Ultimately, this setup provides
the extension with a seamless view of mouse events across all frames upon which to build the rest of the extension.

It is worth noting that DOM references cannot be shared via post message. As a result, a reference to the element under
the mouse gesture is only available in _mouseEvents.js_ in the frame which generated the event. To support features
that need information about the element, attributes are collected a priori and bundled with mouse event data for mouse
up/down events. To support situations that require access to the live DOM, _mouseEvents.js_ assigns a unique identifier
to each frame in which it loads. Messages may be addressed to a specific frame using the unique frame ID.

##### OSX/Linux Gesture Button Limitation

Note: this issue is resolved from FF58 and FG1.1.0 due to API changes landing in Firefox. ~~In OSX and Linux, the
context menu is shown on mouse down. (Context menu on mouse up is the default for Windows.) When FireGestures is
installed on OSX/Linux, it changes the context menu to be shown on mouse up. Web extensions cannot replicate this
functionality. Due to the issue described in [#4](https://github.com/marklieberman/foxygestures/issues/4) right-button
gestures work poorly in OSX/Linux.~~
