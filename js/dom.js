/* ==========================================================================
   dom.js: small helpers for building elements
   --------------------------------------------------------------------------
   Every element in this project is created with document.createElement and
   given its attributes one at a time. Nothing is ever assembled by writing
   an HTML string into innerHTML, which means a label someone types can never
   be parsed as markup. It can only ever become text.
   ========================================================================== */

window.ISFB = window.ISFB || {};

ISFB.dom = (function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function appendChild(parent, child) {
    if (child === null || child === undefined || child === false) { return; }
    if (Array.isArray(child)) {
      child.forEach(function (one) { appendChild(parent, one); });
      return;
    }
    parent.appendChild(
      typeof child === 'string' || typeof child === 'number'
        ? document.createTextNode(String(child))
        : child
    );
  }

  /**
   * el('button', { class: 'btn', 'aria-pressed': 'false', on: { click: fn } }, 'Save')
   *
   * Keys are written as attributes, which keeps ARIA and data-* attributes
   * looking exactly the way they do in the exported markup. `true` writes an
   * empty boolean attribute; null, undefined and false leave it off entirely.
   */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);

    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) { return; }

        if (key === 'class') {
          node.className = value;
        } else if (key === 'text') {
          node.textContent = value;
        } else if (key === 'on') {
          Object.keys(value).forEach(function (type) {
            node.addEventListener(type, value[type]);
          });
        } else if (key === 'dataset') {
          Object.keys(value).forEach(function (dataKey) {
            node.dataset[dataKey] = value[dataKey];
          });
        } else if (value === true) {
          node.setAttribute(key, '');
        } else {
          node.setAttribute(key, String(value));
        }
      });
    }

    appendChild(node, children);
    return node;
  }

  /** A decorative icon: always aria-hidden, never focusable. */
  function icon(pathData, size) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('width', String(size || 16));
    svg.setAttribute('height', String(size || 16));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    var path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', pathData);
    svg.appendChild(path);
    return svg;
  }

  function clear(node) {
    while (node && node.firstChild) {
      node.removeChild(node.firstChild);
    }
    return node;
  }

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  return { el: el, icon: icon, clear: clear, qs: qs, qsa: qsa };
})();
