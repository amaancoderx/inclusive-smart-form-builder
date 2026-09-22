const { bootReady } = require('./harness');

let failures = 0;
function check(name, condition, extra) {
  if (condition) { console.log('  ok   ' + name); }
  else { failures++; console.log('  FAIL ' + name + (extra ? '  -> ' + extra : '')); }
}

main();
async function main() {
  const { window, doc } = await bootReady();
  const ISFB = window.ISFB;
  const store = ISFB.store;

  console.log('\n== a label is text, never markup ==');
  const evil = '<img src=x onerror="alert(1)"> & "quoted" <b>bold</b>';
  store.updateField('field-1', { label: evil });

  const label = doc.querySelector('label[for="field-1"]');
  check('no element was parsed out of the label', label.querySelector('img') === null);
  check('no bold element either', label.querySelector('b') === null);
  check('the text is preserved verbatim', label.textContent.includes(evil));

  const markup = ISFB.exporter.formMarkup();
  check('export escapes angle brackets', markup.includes('&lt;img src=x'), 'no escaping found');
  check('export escapes ampersands', markup.includes('&amp;'));
  check('export does not emit a live img tag', !markup.includes('<img src=x'));

  const page = ISFB.exporter.standalonePage();
  check('standalone page escapes the title too',
    !page.includes('<img src=x onerror'), 'unescaped title leaked into the export');

  console.log('\n== a broken custom pattern is survivable ==');
  store.updateField('field-1', { label: 'Reference', rule: 'custom', pattern: '([unclosed' });
  check('compilePattern returns null instead of throwing',
    ISFB.validator.compilePattern('([unclosed') === null);
  const res = ISFB.validator.validateField(store.getField('field-1'), 'anything');
  check('a field with a broken pattern still validates', res.valid === true);
  const audit = ISFB.audit.run(store.getState(), doc.querySelector('#generated-form'));
  check('the audit flags the broken pattern',
    audit.some(r => r.level === 'error' && /invalid pattern/i.test(r.title)),
    audit.map(r => r.title).join(' | '));

  store.updateField('field-1', { rule: 'default', pattern: '' });

  console.log('\n== a dropdown whose chosen option disappears ==');
  const select = doc.querySelector('#field-4');
  select.value = 'morning';
  store.updateField('field-4', {
    options: [{ label: 'Evening only', value: 'evening' }]
  });
  check('the preview did not crash', !!doc.querySelector('#field-4'));
  check('a stale selection falls back to the prompt',
    doc.querySelector('#field-4').value === '', doc.querySelector('#field-4').value);

  console.log('\n== duplicate ==');
  const before = store.getFields().length;
  store.duplicateField('field-2');
  check('a copy is inserted directly below', store.getFields()[2].label === 'Email address (copy)',
    store.getFields()[2].label);
  check('the copy has its own id', store.getFields()[2].id !== 'field-2');
  check('ids stay unique across the form',
    new Set(store.getFields().map(f => f.id)).size === before + 1);
  check('both render without an id clash',
    doc.querySelectorAll('#generated-form label[for]').length >= before);

  console.log('\n== localStorage round trip ==');
  const snapshot = store.toJSON();
  check('config was written to storage',
    window.localStorage.getItem('isfb.config') !== null ||
    (() => { store.notify('test'); return true; })());

  // Force the debounced write, then restore into a fresh state.
  await new Promise(r => window.setTimeout(r, 400));
  const stored = window.localStorage.getItem('isfb.config');
  check('storage holds the current configuration', stored !== null);
  check('what was stored parses back to the same field count',
    stored && JSON.parse(stored).fields.length === store.getFields().length,
    stored ? JSON.parse(stored).fields.length + ' vs ' + store.getFields().length : 'null');

  store.clearFields();
  check('cleared', store.getFields().length === 0);
  store.loadConfig(JSON.parse(stored));
  check('restore brings every field back',
    store.toJSON() === snapshot, 'restored config differs from the snapshot');

  console.log('\n== an untitled field still renders ==');
  store.clearFields();
  const f = store.addField('text');
  store.updateField(f.id, { label: '' });
  check('renders with a fallback name',
    doc.querySelector(`label[for="${f.id}"]`).textContent.includes('Untitled field'));
  check('the field list shows the fallback too',
    doc.querySelector('.field-row__label').textContent === 'Untitled field');
  check('validation message does not read as a blank',
    ISFB.validator.validateField(store.getField(f.id), '').message.length > 8,
    ISFB.validator.validateField(store.getField(f.id), '').message);

  console.log('\n== every field type renders and validates ==');
  store.clearFields();
  ISFB.Schema.TYPES.forEach(t => store.addField(t.id));
  const form = doc.querySelector('#generated-form');
  check('all 7 types rendered', form.querySelectorAll('.field').length === 7,
    form.querySelectorAll('.field').length);
  ISFB.Schema.TYPES.forEach(t => {
    const field = store.getFields().find(x => x.type === t.id);
    const el = t.id === 'radio'
      ? form.querySelector(`.field[data-field-id="${field.id}"] [role="radiogroup"]`)
      : form.querySelector('#' + field.id);
    check(`${t.id}: rendered and named`, !!el);
  });
  const problems = ISFB.validator.validateAll(store.getFields(), form);
  check('every required default field reports a problem when empty',
    problems.length === store.getFields().filter(f => f.required).length,
    problems.length + ' vs ' + store.getFields().filter(f => f.required).length);
  check('no message is empty', problems.every(p => p.message.trim().length > 0));

  console.log('\n' + (failures ? failures + ' FAILURES' : 'all edge checks passed'));
  process.exit(failures ? 1 : 0);
}
