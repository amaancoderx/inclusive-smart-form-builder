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

  const fire = (node, type, init = {}) =>
    node.dispatchEvent(new window.Event(type, { bubbles: true, cancelable: true, ...init }));

  const form = () => doc.querySelector('#generated-form');
  const errorOf = (id) => doc.querySelector('#' + id + '-error').textContent;

  /* ---------------------------------------------------------------- */
  console.log('\n== submit with everything empty ==');
  fire(form(), 'submit');

  const summary = form().querySelector('.error-summary');
  check('error summary inserted', !!summary);
  check('summary sits directly after the form heading',
    form().querySelector('.gen-form__header').nextElementSibling === summary);
  check('summary received focus', doc.activeElement === summary);
  check('summary is focusable but not in the tab order',
    summary.getAttribute('tabindex') === '-1');
  check('summary has no role=alert (focus does the announcing)',
    summary.getAttribute('role') !== 'alert');
  check('summary is a named group, so its heading forms its name',
    summary.getAttribute('role') === 'group' &&
    summary.getAttribute('aria-labelledby') === 'error-summary-title');

  const links = summary.querySelectorAll('.error-summary__link');
  const requiredCount = store.getFields().filter(f => f.required).length;
  check(`one link per required field (${requiredCount})`, links.length === requiredCount,
    'got ' + links.length);

  check('required text field marked invalid',
    doc.querySelector('#field-1').getAttribute('aria-invalid') === 'true');
  check('optional phone field NOT marked invalid',
    doc.querySelector('#field-3').getAttribute('aria-invalid') === 'false');
  check('inline message written for field-1', errorOf('field-1') === 'Enter full name.');
  check('checkbox message names the box it refers to',
    errorOf('field-7') === 'Select “I agree to the workshop code of conduct” to continue.',
    errorOf('field-7'));
  check('no stray full stop after a quoted question',
    !/”\.$/.test(errorOf('field-4')), errorOf('field-4'));
  check('radio group marked invalid',
    form().querySelector('[role="radiogroup"]').getAttribute('aria-invalid') === 'true');
  check('individual radios are not each marked invalid',
    form().querySelectorAll('input[type="radio"][aria-invalid]').length === 0);
  check('question-style label produces readable text',
    /Select an answer to /.test(errorOf('field-5')), errorOf('field-5'));
  check('question-style dropdown too',
    /Select an answer to /.test(errorOf('field-4')), errorOf('field-4'));

  console.log('\n== summary link moves focus to the field ==');
  const emailLink = [...links].find(a => a.getAttribute('href') === '#field-2');
  fire(emailLink, 'click');
  check('clicking the email link focuses the email input',
    doc.activeElement === doc.querySelector('#field-2'));

  const radioLink = [...links].find(a => a.getAttribute('href') === '#field-5-option-0');
  fire(radioLink, 'click');
  check('radio link focuses the first radio in the group',
    doc.activeElement === doc.querySelector('#field-5-option-0'));

  /* ---------------------------------------------------------------- */
  console.log('\n== per-type validation ==');
  const email = doc.querySelector('#field-2');
  email.value = 'not-an-email';
  fire(email, 'focusout');
  check('bad email rejected on blur',
    errorOf('field-2') === 'Enter an email address in the format name@example.com.',
    errorOf('field-2'));

  email.value = 'student@woxsen.edu.in';
  fire(email, 'input');
  check('error clears mid-typing once fixed', errorOf('field-2') === '');
  check('aria-invalid returns to false', email.getAttribute('aria-invalid') === 'false');
  check('the fix is announced', doc.querySelector('#sr-status') !== null);

  const phone = doc.querySelector('#field-3');
  phone.value = '12345';
  fire(phone, 'focusout');
  check('too-few-digits phone rejected', /7 to 15 digits/.test(errorOf('field-3')),
    errorOf('field-3'));
  phone.value = '+91 98765 43210';
  fire(phone, 'focusout');
  check('valid phone accepted', errorOf('field-3') === '', errorOf('field-3'));

  const name = doc.querySelector('#field-1');
  name.value = 'A';
  fire(name, 'focusout');
  check('minLength enforced', /2 characters or more/.test(errorOf('field-1')), errorOf('field-1'));

  const message = doc.querySelector('#field-6');
  message.value = 'x'.repeat(301);
  fire(message, 'focusout');
  check('maxLength enforced in JS', /300 characters or fewer/.test(errorOf('field-6')),
    errorOf('field-6'));
  check('question-style label reads as "Your answer"',
    /^Your answer must be/.test(errorOf('field-6')), errorOf('field-6'));
  message.value = 'Step-free access please.';
  fire(message, 'focusout');
  check('valid long text accepted', errorOf('field-6') === '');

  console.log('\n== optional fields stay optional ==');
  phone.value = '';
  fire(phone, 'focusout');
  check('empty optional field raises no error', errorOf('field-3') === '');

  /* ---------------------------------------------------------------- */
  console.log('\n== successful submit ==');
  name.value = 'Amaan Khan';
  fire(name, 'focusout');
  doc.querySelector('#field-4').value = 'morning';
  fire(doc.querySelector('#field-4'), 'change');
  doc.querySelector('#field-5-option-0').checked = true;
  fire(doc.querySelector('#field-5-option-0'), 'change');
  doc.querySelector('#field-7').checked = true;
  fire(doc.querySelector('#field-7'), 'change');

  fire(form(), 'submit');
  check('error summary removed', !form().querySelector('.error-summary'));
  const success = doc.querySelector('.form-success');
  check('success panel shown', !!success);
  check('success panel received focus', doc.activeElement === success);
  check('submitted values listed', success.querySelectorAll('dd').length === 7,
    'got ' + (success ? success.querySelectorAll('dd').length : 0));
  check('dropdown shown by its label not its value',
    [...success.querySelectorAll('dd')].some(d => d.textContent === 'Morning, 9:00 to 11:00'));
  check('checkbox shown as Yes',
    [...success.querySelectorAll('dd')].some(d => d.textContent === 'Yes'));

  /* ---------------------------------------------------------------- */
  console.log('\n== typed values survive a config change ==');
  const before = doc.querySelector('#field-1').value;
  const labelBox = doc.querySelector('#prop-label');
  doc.querySelector('.field-row__select').click();
  labelBox.value = 'Your full name';
  fire(labelBox, 'input');
  check('preview kept the typed value', doc.querySelector('#field-1').value === before,
    doc.querySelector('#field-1').value);
  check('label change reached the preview',
    doc.querySelector('label[for="field-1"]').textContent.includes('Your full name'));
  check('label change reached the field list',
    doc.querySelector('.field-row__label').textContent === 'Your full name');
  check('editor caret box was not rebuilt', doc.querySelector('#prop-label').value === 'Your full name');

  /* ---------------------------------------------------------------- */
  console.log('\n== reordering ==');
  const rowsNow = () => [...doc.querySelectorAll('.field-row')].map(r => r.getAttribute('data-id'));
  const orderBefore = rowsNow();
  const downBtn = doc.querySelector('.field-row [data-action="down"]');
  downBtn.focus();
  downBtn.click();
  const orderAfter = rowsNow();
  check('field moved down one position',
    orderAfter[0] === orderBefore[1] && orderAfter[1] === orderBefore[0],
    orderAfter.join(','));
  check('focus followed the moved field',
    doc.activeElement.getAttribute('data-action') === 'down' &&
    doc.activeElement.closest('.field-row').getAttribute('data-id') === orderBefore[0]);

  console.log('\n== keyboard reordering (Alt+ArrowUp) ==');
  const target = doc.querySelector(`.field-row[data-id="${orderBefore[0]}"] [data-action="up"]`);
  target.focus();
  target.dispatchEvent(new window.KeyboardEvent('keydown',
    { key: 'ArrowUp', altKey: true, bubbles: true, cancelable: true }));
  check('Alt+ArrowUp moved it back', rowsNow()[0] === orderBefore[0], rowsNow().join(','));

  /* ---------------------------------------------------------------- */
  console.log('\n== remove and undo ==');
  const countBefore = store.getFields().length;
  const victim = store.getFields()[1];
  doc.querySelector(`.field-row[data-id="${victim.id}"] [data-action="remove"]`).click();
  check('field removed', store.getFields().length === countBefore - 1);
  check('undo bar shown', !doc.querySelector('#undo-bar').hidden);
  check('focus moved to a real element, not the body',
    doc.activeElement !== doc.body && doc.activeElement !== null,
    doc.activeElement && doc.activeElement.tagName);

  doc.querySelector('#undo-remove').click();
  check('undo restored the field', store.getFields().length === countBefore);
  check('restored to its original position', store.getFields()[1].id === victim.id);
  check('undo bar hidden again', doc.querySelector('#undo-bar').hidden);
  check('focus moved to the restored row',
    doc.activeElement.closest('.field-row').getAttribute('data-id') === victim.id);

  /* ---------------------------------------------------------------- */
  console.log('\n== adding from the palette ==');
  const addCount = store.getFields().length;
  const paletteBtn = doc.querySelector('.palette-btn[data-type="textarea"]');
  paletteBtn.focus();
  paletteBtn.click();
  check('field added', store.getFields().length === addCount + 1);
  check('focus stayed on the palette button for repeat adds',
    doc.activeElement === paletteBtn);
  check('new field opened in the editor',
    store.getSelectedId() === store.getFields()[store.getFields().length - 1].id);
  check('preview grew', doc.querySelectorAll('#generated-form .field').length === addCount + 1);

  /* ---------------------------------------------------------------- */
  console.log('\n== audit reacts to a bad configuration ==');
  const badId = store.getSelectedId();
  store.updateField(badId, { label: '' });
  const badResults = ISFB.audit.run(store.getState(), form());
  check('empty label raises an error',
    badResults.some(r => r.level === 'error' && /no label/i.test(r.title)),
    badResults.map(r => r.title).join(' | '));
  check('badge is now visible', !doc.querySelector('#audit-badge').hidden);
  check('badge count is in the tab name',
    /problem/.test(doc.querySelector('#tab-audit').getAttribute('aria-label')),
    doc.querySelector('#tab-audit').getAttribute('aria-label'));
  store.updateField(badId, { label: 'Notes' });

  /* ---------------------------------------------------------------- */
  console.log('\n== tabs ==');
  const tabs = [...doc.querySelectorAll('[role="tab"]')];
  check('only the selected tab is in the tab order',
    tabs.filter(t => t.tabIndex === 0).length === 1);
  tabs[0].focus();
  tabs[0].dispatchEvent(new window.KeyboardEvent('keydown',
    { key: 'ArrowRight', bubbles: true, cancelable: true }));
  check('ArrowRight selects the next tab', tabs[1].getAttribute('aria-selected') === 'true');
  check('ArrowRight moves focus too', doc.activeElement === tabs[1]);
  check('its panel is revealed', !doc.querySelector('#tabpanel-json').hidden);
  check('the previous panel is hidden', doc.querySelector('#tabpanel-preview').hidden);

  tabs[1].dispatchEvent(new window.KeyboardEvent('keydown',
    { key: 'End', bubbles: true, cancelable: true }));
  check('End jumps to the last tab', tabs[3].getAttribute('aria-selected') === 'true');
  tabs[3].dispatchEvent(new window.KeyboardEvent('keydown',
    { key: 'ArrowRight', bubbles: true, cancelable: true }));
  check('arrow keys wrap around', tabs[0].getAttribute('aria-selected') === 'true');

  /* ---------------------------------------------------------------- */
  console.log('\n== JSON round trip ==');
  const exported = store.toJSON();
  const importBox = doc.querySelector('#json-import');

  importBox.value = 'this is not json';
  doc.querySelector('#load-json').click();
  check('invalid JSON reports an error',
    doc.querySelector('#json-import-status').getAttribute('data-tone') === 'error');

  importBox.value = JSON.stringify({ fields: [{ type: 'nope', label: 'x' }] });
  doc.querySelector('#load-json').click();
  check('unknown field types are rejected with a message',
    doc.querySelector('#json-import-status').getAttribute('data-tone') === 'error',
    doc.querySelector('#json-import-status').textContent);

  importBox.value = exported;
  doc.querySelector('#load-json').click();
  check('valid config loads',
    doc.querySelector('#json-import-status').getAttribute('data-tone') === 'ok',
    doc.querySelector('#json-import-status').textContent);
  check('round trip preserves the field count',
    store.toJSON() === exported, 'export differs after re-import');
  check('import box cleared after success', importBox.value === '');

  /* ---------------------------------------------------------------- */
  console.log('\n== display modes ==');
  const contrast = doc.querySelector('#toggle-contrast');
  contrast.click();
  check('high contrast attribute set',
    doc.documentElement.getAttribute('data-contrast') === 'high');
  check('aria-pressed updated', contrast.getAttribute('aria-pressed') === 'true');
  contrast.click();
  check('toggles back', doc.documentElement.getAttribute('data-contrast') === 'normal');

  const textSize = doc.querySelector('#toggle-text-size');
  textSize.click();
  check('large text attribute set',
    doc.documentElement.getAttribute('data-text-size') === 'large');
  textSize.click();

  /* ---------------------------------------------------------------- */
  console.log('\n== clear all ==');
  window.confirm = () => true;
  doc.querySelector('#clear-fields').click();
  check('all fields removed', store.getFields().length === 0);
  check('empty state shown', !doc.querySelector('#field-list-empty').hidden);
  check('preview shows its empty message', !!doc.querySelector('.preview-empty'));
  check('editor shows its empty message', !doc.querySelector('#editor-empty').hidden);
  check('clear button disabled when there is nothing to clear',
    doc.querySelector('#clear-fields').disabled);
  check('audit warns that the form is empty',
    ISFB.audit.run(store.getState(), null).some(r => /empty/i.test(r.title)));

  console.log('\n' + (failures ? failures + ' FAILURES' : 'all behaviour checks passed'));
  process.exit(failures ? 1 : 0);
}
