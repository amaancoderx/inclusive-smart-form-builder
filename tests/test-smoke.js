const { bootReady } = require('./harness');

main();
async function main() {
const { window, doc, errors } = await bootReady();
const ISFB = window.ISFB;

let failures = 0;
function check(name, condition, extra) {
  if (condition) { console.log('  ok   ' + name); }
  else { failures++; console.log('  FAIL ' + name + (extra ? '  -> ' + extra : '')); }
}

console.log('\n== boot ==');
check('no script errors', errors.length === 0, errors.join('\n'));
check('ISFB namespace present', !!ISFB);
check('sample form loaded (7 fields)', ISFB.store.getFields().length === 7,
      'got ' + ISFB.store.getFields().length);

console.log('\n== palette ==');
const paletteButtons = doc.querySelectorAll('#palette .palette-btn');
check('7 palette buttons', paletteButtons.length === 7, 'got ' + paletteButtons.length);

console.log('\n== field list ==');
const rows = doc.querySelectorAll('#field-list .field-row');
check('7 rows rendered', rows.length === 7, 'got ' + rows.length);
check('first row up button disabled', rows[0].querySelector('[data-action="up"]').disabled);
check('last row down button disabled', rows[6].querySelector('[data-action="down"]').disabled);
check('field count badge = 7', doc.querySelector('#field-count').textContent === '7');
check('empty state hidden', doc.querySelector('#field-list-empty').hidden);

console.log('\n== rendered form ==');
const form = doc.querySelector('#generated-form');
check('form exists', !!form);
check('form has novalidate', form.hasAttribute('novalidate'));
check('form labelled by title', form.getAttribute('aria-labelledby') === 'generated-form-title');

const controls = [...form.querySelectorAll('input, select, textarea')];
check('controls rendered', controls.length > 0, 'got ' + controls.length);

// every non-radio control has a <label for>
const nonRadio = controls.filter(c => c.type !== 'radio');
const unlabelled = nonRadio.filter(c => !form.querySelector(`label[for="${c.id}"]`));
check('every control has label[for]', unlabelled.length === 0,
      unlabelled.map(c => c.id).join(', '));

// aria-describedby resolves
const broken = [];
form.querySelectorAll('[aria-describedby]').forEach(node => {
  node.getAttribute('aria-describedby').split(/\s+/).forEach(id => {
    if (!form.querySelector('#' + id)) broken.push(node.id + ' -> ' + id);
  });
});
check('all aria-describedby resolve', broken.length === 0, broken.join(', '));

// aria-required matches config
let mismatch = [];
ISFB.store.getFields().forEach(f => {
  const node = f.type === 'radio'
    ? form.querySelector(`.field[data-field-id="${f.id}"] [role="radiogroup"]`)
    : form.querySelector('#' + f.id);
  if (!node) { mismatch.push(f.id + ' missing'); return; }
  const declared = node.getAttribute('aria-required') === 'true';
  if (declared !== f.required) mismatch.push(f.id);
});
check('aria-required matches config', mismatch.length === 0, mismatch.join(', '));

check('radio group is a fieldset with role=radiogroup',
  form.querySelector('fieldset[role="radiogroup"]') !== null);
check('radio group labelled by legend',
  form.querySelector('fieldset[role="radiogroup"]').getAttribute('aria-labelledby') === 'field-5-legend');
check('legend exists', !!form.querySelector('#field-5-legend'));

check('email field has autocomplete=email',
  form.querySelector('#field-2').getAttribute('autocomplete') === 'email');
check('full name gets autocomplete=name',
  form.querySelector('#field-1').getAttribute('autocomplete') === 'name');
check('no maxlength attribute set (validated in JS instead)',
  form.querySelectorAll('[maxlength]').length === 0);
check('dropdown has empty-valued prompt option',
  form.querySelector('#field-4').options[0].value === '');

console.log('\n== audit ==');
const results = ISFB.audit.run(ISFB.store.getState(), form);
const problems = results.filter(r => r.level !== 'pass');
check('sample form has no audit problems', problems.length === 0,
      problems.map(p => p.level + ': ' + p.title).join(' | '));
check('audit reports passes', results.some(r => r.level === 'pass'));
check('audit badge hidden', doc.querySelector('#audit-badge').hidden);

console.log('\n== export ==');
const json = ISFB.store.toJSON();
check('JSON parses', (() => { try { JSON.parse(json); return true; } catch { return false; } })());
check('JSON textarea populated', doc.querySelector('#json-output').value.length > 50);
const markup = ISFB.exporter.formMarkup();
check('HTML export mentions aria-describedby', markup.includes('aria-describedby'));
check('HTML export mentions aria-required', markup.includes('aria-required'));
check('HTML export has no stray innerHTML artifacts', !markup.includes('[object'));
check('standalone page is a full document',
  ISFB.exporter.standalonePage().startsWith('<!DOCTYPE html>'));

console.log('\n' + (failures ? failures + ' FAILURES' : 'all smoke checks passed'));
process.exit(failures ? 1 : 0);
}
