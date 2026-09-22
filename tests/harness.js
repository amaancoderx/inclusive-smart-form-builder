/* ==========================================================================
   harness.js: boots the builder in jsdom so it can be driven from Node
   --------------------------------------------------------------------------
   index.html is read from disk, parsed, and the ten scripts are evaluated in
   the order the page lists them. Nothing in the application is stubbed or
   modified: the tests drive the same code the browser runs.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');

/* The order index.html loads them in. */
const SCRIPTS = ['dom', 'schema', 'a11y', 'store', 'validator', 'renderer',
                 'builder', 'exporter', 'audit', 'main'];

function boot() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const errors = [];

  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: 'http://localhost/'
  });

  const { window } = dom;

  window.addEventListener('error', (e) => errors.push('window error: ' + e.message));
  window.confirm = () => true;          // the tests always accept confirmations
  window.alert = () => {};

  for (const name of SCRIPTS) {
    const code = fs.readFileSync(path.join(ROOT, 'js', name + '.js'), 'utf8');
    try {
      window.eval(code);
    } catch (err) {
      errors.push(`${name}.js threw: ${err.message}\n${err.stack}`);
    }
  }

  return { dom, window, doc: window.document, errors };
}

/* main.js waits for DOMContentLoaded, which jsdom fires after our eval
   returns, so the tests wait a tick before touching anything. */
async function bootReady() {
  const context = boot();
  await new Promise((resolve) => context.window.setTimeout(resolve, 60));
  return context;
}

module.exports = { boot, bootReady, ROOT };
