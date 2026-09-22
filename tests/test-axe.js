/* Runs axe-core over the live DOM in three states, including the one
   Lighthouse never reaches: the form after a failed submit. */
const fs = require('fs');
const path = require('path');
const { bootReady } = require('./harness');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const OPTIONS = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
  // jsdom has no layout engine, so these three cannot be evaluated here.
  // colour contrast was checked by Lighthouse in a real browser instead.
  rules: {
    'color-contrast': { enabled: false },
    'target-size': { enabled: false },
    'scrollable-region-focusable': { enabled: false }
  }
};

main();
async function main() {
  const { window, doc } = await bootReady();
  window.eval(AXE);
  const ISFB = window.ISFB;

  let total = 0;

  async function scan(stateName) {
    const results = await window.axe.run(doc, OPTIONS);
    const violations = results.violations;
    total += violations.length;

    console.log(`\n== ${stateName} ==`);
    console.log(`   rules passed: ${results.passes.length}   violations: ${violations.length}   incomplete: ${results.incomplete.length}`);
    violations.forEach(v => {
      console.log(`   VIOLATION [${v.impact}] ${v.id}: ${v.help}`);
      v.nodes.slice(0, 3).forEach(n => console.log('      ' + n.html.slice(0, 120)));
    });
    if (results.incomplete.length) {
      console.log('   needs review: ' + results.incomplete.map(i => i.id).join(', '));
    }
    return results;
  }

  const first = await scan('1. builder as it loads, sample form in the preview');

  // State 2: a failed submit, with the error summary and every inline message present.
  const form = doc.querySelector('#generated-form');
  doc.querySelector('#field-2').value = 'not-an-email';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  console.log('\n   (submitted empty: ' +
    doc.querySelectorAll('.error-summary__link').length + ' errors raised, ' +
    doc.querySelectorAll('[aria-invalid="true"]').length + ' controls marked invalid)');
  await scan('2. after a failed submit, summary and inline errors on screen');

  // State 3: every field type at once, high contrast, large text.
  doc.querySelector('#toggle-contrast').click();
  doc.querySelector('#toggle-text-size').click();
  ISFB.store.clearFields();
  ISFB.Schema.TYPES.forEach(t => ISFB.store.addField(t.id));
  await scan('3. every field type, high contrast and large text on');

  // State 4: the export panels, which are hidden until their tab is chosen.
  doc.querySelector('#tab-json').click();
  await scan('4. JSON export panel open');
  doc.querySelector('#tab-audit').click();
  await scan('5. checks panel open');

  console.log('\nRules exercised in state 1: ' +
    first.passes.map(p => p.id).sort().join(', '));

  console.log('\n' + (total ? total + ' TOTAL VIOLATIONS' : 'axe-core: no violations in any state'));
  process.exit(total ? 1 : 0);
}
