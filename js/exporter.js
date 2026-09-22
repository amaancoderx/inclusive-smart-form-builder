/* ==========================================================================
   exporter.js: output views, JSON round-trip and HTML export
   --------------------------------------------------------------------------
   The tab strip follows the ARIA Authoring Practices tab pattern with
   automatic activation: one Tab press reaches the strip, the arrow keys move
   between tabs and switch panels as they go, Home and End jump to the ends,
   and a second Tab press moves into the open panel. Rebuilding a panel is
   cheap here, so automatic activation costs nothing and saves a keypress.

   The HTML export is serialised from the very element the preview renders,
   so it cannot drift away from what the tool actually produces.
   ========================================================================== */

window.ISFB = window.ISFB || {};

ISFB.exporter = (function () {
  'use strict';

  var dom = ISFB.dom;
  var store = ISFB.store;
  var a11y = ISFB.a11y;

  var VOID_ELEMENTS = ['input', 'br', 'hr', 'img', 'meta', 'link', 'source'];
  var refs = {};

  /* ================================================================== *
   * Tabs
   * ================================================================== */

  function tabButtons() {
    return dom.qsa('[role="tab"]', refs.tablist);
  }

  function selectTab(tab, moveFocus) {
    tabButtons().forEach(function (button) {
      var isSelected = button === tab;
      button.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      // Roving tabindex: only the selected tab is in the tab order, so Tab
      // steps past the whole strip rather than through every tab in it.
      button.tabIndex = isSelected ? 0 : -1;

      var panel = document.getElementById(button.getAttribute('aria-controls'));
      if (panel) { panel.hidden = !isSelected; }
    });

    if (moveFocus) { tab.focus(); }
  }

  function onTablistKeydown(event) {
    var buttons = tabButtons();
    var current = buttons.indexOf(document.activeElement);
    if (current === -1) { return; }

    var next = -1;
    switch (event.key) {
      case 'ArrowRight': next = (current + 1) % buttons.length; break;
      case 'ArrowLeft':  next = (current - 1 + buttons.length) % buttons.length; break;
      case 'Home':       next = 0; break;
      case 'End':        next = buttons.length - 1; break;
      default: return;
    }

    event.preventDefault();
    selectTab(buttons[next], true);
  }

  function setupTabs() {
    tabButtons().forEach(function (button) {
      button.addEventListener('click', function () { selectTab(button, true); });
    });
    refs.tablist.addEventListener('keydown', onTablistKeydown);
  }

  /* ================================================================== *
   * Serialising the rendered form back to readable HTML
   * ================================================================== */

  function escapeText(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttribute(value) {
    return escapeText(value).replace(/"/g, '&quot;');
  }

  function openingTag(element) {
    var parts = [element.tagName.toLowerCase()];

    Array.prototype.forEach.call(element.attributes, function (attribute) {
      // Boolean attributes are printed bare, the way they are written by hand.
      if (attribute.value === '') {
        parts.push(attribute.name);
      } else {
        parts.push(attribute.name + '="' + escapeAttribute(attribute.value) + '"');
      }
    });

    return '<' + parts.join(' ') + '>';
  }

  function hasOnlyText(element) {
    return Array.prototype.every.call(element.childNodes, function (node) {
      return node.nodeType === 3;
    });
  }

  function serialise(node, depth) {
    var pad = new Array(depth + 1).join('  ');

    if (node.nodeType === 3) {                      // text
      var text = node.nodeValue.replace(/\s+/g, ' ').trim();
      return text ? pad + escapeText(text) : '';
    }
    if (node.nodeType !== 1) { return ''; }         // comments and the rest

    var tag = node.tagName.toLowerCase();
    var open = openingTag(node);

    if (VOID_ELEMENTS.indexOf(tag) !== -1) {
      return pad + open;
    }

    if (hasOnlyText(node)) {
      var inline = node.textContent.replace(/\s+/g, ' ').trim();
      return pad + open + escapeText(inline) + '</' + tag + '>';
    }

    var lines = [pad + open];
    Array.prototype.forEach.call(node.childNodes, function (child) {
      var rendered = serialise(child, depth + 1);
      if (rendered) { lines.push(rendered); }
    });
    lines.push(pad + '</' + tag + '>');

    return lines.join('\n');
  }

  function formMarkup() {
    if (!store.getFields().length) {
      return '<!-- Add a field to generate markup. -->';
    }
    return serialise(ISFB.renderer.buildForm(store.getState()), 0);
  }

  /* A compact stylesheet travels with the downloaded page, so the exported
     form is readable and keyboard-visible on its own. */
  var EXPORT_CSS = [
    ':root{--ink:#131720;--ink-2:#4a5464;--line:#bfc6d2;--accent:#1d4ed8;--danger:#b42318}',
    '*{box-sizing:border-box}',
    'body{margin:0;padding:2.5rem 1.25rem;background:#f1f3f7;color:var(--ink);',
    'font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
    '.gen-form{max-width:34rem;margin:0 auto;padding:2rem;background:#fff;',
    'border:1px solid #dee2e9;border-radius:14px;display:flex;flex-direction:column;gap:1.5rem}',
    '.gen-form__title{margin:0;font-size:1.375rem}',
    '.gen-form__description{margin:.5rem 0 0;color:var(--ink-2)}',
    '.gen-form__fields{display:flex;flex-direction:column;gap:1.5rem}',
    '.field{display:flex;flex-direction:column}',
    '.field__label,.field__group-legend{font-weight:600;margin-bottom:.25rem}',
    '.field__required{color:var(--danger);font-size:.8125rem;margin-left:.35rem}',
    '.field__optional{color:var(--ink-2);font-size:.8125rem;margin-left:.35rem}',
    '.field__hint{margin:0 0 .5rem;color:var(--ink-2);font-size:.8125rem}',
    '.field__control{width:100%;min-height:2.75rem;padding:.55rem .75rem;',
    'border:1px solid var(--line);border-radius:6px;font:inherit}',
    '.field__control[aria-invalid="true"]{border:2px solid var(--danger);background:#fdf1f0}',
    '.field__error{margin:.5rem 0 0;color:var(--danger);font-size:.8125rem;font-weight:600}',
    '.field__error:empty{display:none}',
    '.field__group{border:0;padding:0;margin:0}',
    '.field__choices{display:flex;flex-direction:column;gap:.5rem;margin-top:.5rem}',
    '.field__choice{display:flex;align-items:center;gap:.75rem;padding:.55rem .75rem;',
    'border:1px solid #dee2e9;border-radius:6px}',
    '.field__checkbox-wrap{display:flex;gap:.75rem;padding:.75rem;',
    'border:1px solid var(--line);border-radius:6px}',
    '.gen-form__footer{padding-top:1rem;border-top:1px solid #dee2e9}',
    '.btn{padding:.6rem 1.25rem;border:0;border-radius:6px;background:var(--accent);',
    'color:#fff;font:inherit;font-weight:600;cursor:pointer}',
    ':focus-visible{outline:3px solid var(--accent);outline-offset:2px}'
  ].join('');

  function standalonePage() {
    var form = store.getForm();
    var title = form.title || 'Generated form';

    return [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head>',
      '  <meta charset="utf-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1">',
      '  <title>' + escapeText(title) + '</title>',
      '  <style>' + EXPORT_CSS + '</style>',
      '</head>',
      '<body>',
      indentBlock(formMarkup(), 1),
      '</body>',
      '</html>',
      ''
    ].join('\n');
  }

  function indentBlock(text, depth) {
    var pad = new Array(depth + 1).join('  ');
    return text.split('\n').map(function (line) {
      return line ? pad + line : line;
    }).join('\n');
  }

  /* ================================================================== *
   * Copy and download
   * ================================================================== */

  function copyText(text, button, describeAs) {
    function done(success) {
      var original = button.getAttribute('data-label') || button.textContent;
      button.setAttribute('data-label', original);
      button.textContent = success ? 'Copied' : 'Press Ctrl+C';

      a11y.announce(success
        ? describeAs + ' copied to the clipboard.'
        : 'Copying was blocked by the browser. The text is selected, so press Control and C to copy it.');

      window.setTimeout(function () { button.textContent = original; }, 2200);
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done(true); },
                                              function () { done(fallbackCopy(text)); });
      return;
    }
    // Pages opened straight from the file system are not a secure context,
    // so the clipboard API is unavailable and the old path is needed.
    done(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    var scratch = dom.el('textarea', {
      'aria-hidden': 'true',
      tabindex: '-1',
      style: 'position:fixed;top:0;left:-9999px;opacity:0'
    });
    scratch.value = text;
    document.body.appendChild(scratch);
    scratch.select();

    var copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (err) {
      copied = false;
    }
    document.body.removeChild(scratch);
    return copied;
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);

    var link = dom.el('a', { href: url, download: filename });
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    a11y.announce(filename + ' downloaded.');
  }

  function fileSlug() {
    var title = store.getForm().title || 'form';
    return ISFB.Schema.slugify(title);
  }

  /* ================================================================== *
   * Import
   * ================================================================== */

  function setImportStatus(message, tone) {
    refs.importStatus.textContent = message;
    refs.importStatus.setAttribute('data-tone', tone);
  }

  function applyImport(text, source) {
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      setImportStatus('That is not valid JSON. ' + err.message, 'error');
      a11y.announce('Import failed. That is not valid JSON.');
      return false;
    }

    var result;
    try {
      result = store.loadConfig(parsed);
    } catch (err) {
      setImportStatus(err.message, 'error');
      a11y.announce('Import failed. ' + err.message);
      return false;
    }

    var message = result.loaded + (result.loaded === 1 ? ' field loaded' : ' fields loaded') +
      (source ? ' from ' + source : '') +
      (result.skipped ? ', ' + result.skipped + ' skipped because the type was not recognised' : '') + '.';

    setImportStatus(message, 'ok');
    a11y.announce(message + ' The preview has been rebuilt.');
    return true;
  }

  function loadFromTextarea() {
    var text = refs.jsonImport.value.trim();
    if (!text) {
      setImportStatus('Paste a configuration into the box first.', 'error');
      refs.jsonImport.focus();
      return;
    }
    if (applyImport(text, null)) {
      refs.jsonImport.value = '';
    }
  }

  function loadFromFile(file) {
    if (!file) { return; }

    var reader = new FileReader();
    reader.onload = function () { applyImport(String(reader.result), file.name); };
    reader.onerror = function () {
      setImportStatus('That file could not be read.', 'error');
      a11y.announce('That file could not be read.');
    };
    reader.readAsText(file);
  }

  /* ================================================================== *
   * Keeping the output panels current
   * ================================================================== */

  function refresh() {
    refs.jsonOutput.value = store.toJSON();
    refs.htmlOutput.value = formMarkup();
  }

  function collectRefs() {
    refs = {
      tablist: dom.qs('.tablist'),
      jsonOutput: dom.qs('#json-output'),
      htmlOutput: dom.qs('#html-output'),
      jsonImport: dom.qs('#json-import'),
      importStatus: dom.qs('#json-import-status'),
      copyJson: dom.qs('#copy-json'),
      downloadJson: dom.qs('#download-json'),
      copyHtml: dom.qs('#copy-html'),
      downloadHtml: dom.qs('#download-html'),
      loadJson: dom.qs('#load-json'),
      jsonFile: dom.qs('#json-file')
    };
  }

  function init() {
    collectRefs();
    setupTabs();

    refs.copyJson.addEventListener('click', function () {
      copyText(store.toJSON(), refs.copyJson, 'The field configuration');
    });
    refs.downloadJson.addEventListener('click', function () {
      download(fileSlug() + '-config.json', store.toJSON(), 'application/json');
    });

    refs.copyHtml.addEventListener('click', function () {
      copyText(formMarkup(), refs.copyHtml, 'The generated markup');
    });
    refs.downloadHtml.addEventListener('click', function () {
      download(fileSlug() + '.html', standalonePage(), 'text/html');
    });

    refs.loadJson.addEventListener('click', loadFromTextarea);
    refs.jsonFile.addEventListener('change', function (event) {
      loadFromFile(event.target.files && event.target.files[0]);
      event.target.value = '';     // allow the same file to be chosen twice
    });

    store.subscribe(refresh);
    refresh();
  }

  return { init: init, formMarkup: formMarkup, standalonePage: standalonePage };
})();
