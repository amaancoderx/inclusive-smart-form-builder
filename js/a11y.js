/* ==========================================================================
   a11y.js: the shared accessibility services
   --------------------------------------------------------------------------
   Two jobs:
     1. announce(): a single polite live region that narrates every builder
                      action, because adding, moving or deleting a field
                      changes the page silently for a screen reader user.
     2. display modes: dark theme, high contrast and large text, each stored
                      as one attribute on <html> and remembered per browser.
   ========================================================================== */

window.ISFB = window.ISFB || {};

ISFB.a11y = (function () {
  'use strict';

  var STORAGE_PREFIX = 'isfb.';
  var statusRegion = null;
  var clearTimer = null;
  var repeatTimer = null;

  /* ------------------------------------------------------------------ *
   * Local storage, guarded. Browsers block it in some privacy modes and
   * for some file:// origins, and a failure there must never stop the app.
   * ------------------------------------------------------------------ */

  function readStored(key) {
    try {
      return window.localStorage.getItem(STORAGE_PREFIX + key);
    } catch (err) {
      return null;
    }
  }

  function writeStored(key, value) {
    try {
      window.localStorage.setItem(STORAGE_PREFIX + key, value);
      return true;
    } catch (err) {
      return false;
    }
  }

  function removeStored(key) {
    try {
      window.localStorage.removeItem(STORAGE_PREFIX + key);
    } catch (err) { /* nothing we can do, and nothing that matters */ }
  }

  /* ------------------------------------------------------------------ *
   * The live region
   * ------------------------------------------------------------------ */

  /**
   * Announce a message politely, after the current screen reader utterance.
   *
   * The region is emptied first and refilled on the next tick. Without that,
   * announcing the same sentence twice in a row (deleting two fields called
   * "Email address", say) produces no second announcement at all, because
   * the text node never changes.
   */
  function announce(message) {
    if (!statusRegion) {
      statusRegion = document.getElementById('sr-status');
      if (!statusRegion) { return; }
    }

    window.clearTimeout(clearTimer);
    window.clearTimeout(repeatTimer);
    statusRegion.textContent = '';

    repeatTimer = window.setTimeout(function () {
      statusRegion.textContent = message;
      // Empty it again later so a screen reader moving through the page
      // does not read a stale status out of context.
      clearTimer = window.setTimeout(function () {
        statusRegion.textContent = '';
      }, 8000);
    }, 60);
  }

  /** Move focus to an element, adding a temporary tabindex if it needs one. */
  function focusElement(element, options) {
    if (!element) { return; }
    if (!element.hasAttribute('tabindex') && !isNativelyFocusable(element)) {
      element.setAttribute('tabindex', '-1');
    }
    try {
      element.focus(options || { preventScroll: false });
    } catch (err) {
      element.focus();
    }
  }

  function isNativelyFocusable(element) {
    return /^(a|button|input|select|textarea|summary)$/i.test(element.tagName) ||
      element.tabIndex >= 0;
  }

  /* ------------------------------------------------------------------ *
   * Display modes
   * ------------------------------------------------------------------ */

  var MODES = [
    {
      key: 'theme',
      attribute: 'data-theme',
      on: 'dark',
      off: 'light',
      button: 'toggle-theme',
      onMessage: 'Dark theme on.',
      offMessage: 'Dark theme off.',
      prefers: '(prefers-color-scheme: dark)'
    },
    {
      key: 'contrast',
      attribute: 'data-contrast',
      on: 'high',
      off: 'normal',
      button: 'toggle-contrast',
      onMessage: 'High contrast on.',
      offMessage: 'High contrast off.',
      prefers: '(prefers-contrast: more)'
    },
    {
      key: 'textSize',
      attribute: 'data-text-size',
      on: 'large',
      off: 'normal',
      button: 'toggle-text-size',
      onMessage: 'Large text on.',
      offMessage: 'Large text off.'
    }
  ];

  function prefersOn(query) {
    return !!query && window.matchMedia && window.matchMedia(query).matches;
  }

  function applyMode(mode, isOn, announceChange) {
    document.documentElement.setAttribute(mode.attribute, isOn ? mode.on : mode.off);

    var button = document.getElementById(mode.button);
    if (button) {
      button.setAttribute('aria-pressed', isOn ? 'true' : 'false');
    }
    if (announceChange) {
      announce(isOn ? mode.onMessage : mode.offMessage);
    }
  }

  function setupDisplayModes() {
    MODES.forEach(function (mode) {
      var stored = readStored(mode.key);
      // No stored choice means we follow the operating system, which is what
      // a user who has already asked for dark or high contrast expects.
      var isOn = stored === null ? prefersOn(mode.prefers) : stored === mode.on;

      applyMode(mode, isOn, false);

      var button = document.getElementById(mode.button);
      if (!button) { return; }

      button.addEventListener('click', function () {
        var nowOn = button.getAttribute('aria-pressed') !== 'true';
        applyMode(mode, nowOn, true);
        writeStored(mode.key, nowOn ? mode.on : mode.off);
      });
    });
  }

  return {
    announce: announce,
    focusElement: focusElement,
    setupDisplayModes: setupDisplayModes,
    storage: { read: readStored, write: writeStored, remove: removeStored }
  };
})();
