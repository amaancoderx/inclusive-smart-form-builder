/* ==========================================================================
   builder.js: the form configuration module
   --------------------------------------------------------------------------
   The admin-side of the tool: the palette that adds fields, the list that
   reorders and removes them, and the properties editor.

   Two problems dominate an interface like this one, and both are about
   keyboard users:

     * Rebuilding the list on every change destroys focus. Every rebuild here
       records which button in which row was focused and puts focus back on
       the equivalent button afterwards.
     * A change made in one panel is invisible in another. Every action is
       narrated through the shared live region, including where focus has
       gone and how many fields are now in the form.
   ========================================================================== */

window.ISFB = window.ISFB || {};

ISFB.builder = (function () {
  'use strict';

  var dom = ISFB.dom;
  var el = dom.el;
  var Schema = ISFB.Schema;
  var store = ISFB.store;
  var a11y = ISFB.a11y;

  var ICONS = {
    up: 'M10 15.5V5M5.5 9.5 10 5l4.5 4.5',
    down: 'M10 4.5V15M5.5 10.5 10 15l4.5-4.5',
    duplicate: 'M7.5 7.5h8v8h-8zM4.5 12.5v-8h8',
    remove: 'M4.5 6h11M8 6V4.2h4V6M6.6 6l.6 9.3h5.6l.6-9.3',
    close: 'M6 6l8 8M14 6l-8 8'
  };

  /* Cached element references, filled in by init(). */
  var refs = {};

  /* Set while the editor is writing to the store, so the editor does not
     rebuild itself underneath the caret of the input being typed into. */
  var editingFromPanel = false;

  /* The most recent deletion, kept so it can be put back. */
  var lastRemoved = null;

  /* ================================================================== *
   * Palette
   * ================================================================== */

  function buildPalette() {
    var buttons = Schema.TYPES.map(function (type) {
      return el('button', {
        type: 'button',
        class: 'palette-btn',
        'data-type': type.id,
        on: {
          click: function () { addField(type); }
        }
      }, [
        el('span', { class: 'palette-btn__icon' }, dom.icon(type.icon, 17)),
        el('span', null, type.name)
      ]);
    });

    dom.clear(refs.palette);
    buttons.forEach(function (button) { refs.palette.appendChild(button); });
  }

  function addField(type) {
    var field = store.addField(type.id);
    if (!field) { return; }

    // Focus deliberately stays on the palette button: someone building a
    // five-field form wants to press Add five times without being thrown
    // somewhere else after each one. The announcement carries the outcome.
    a11y.announce(
      type.name + ' field added as field ' + store.getFields().length +
      ' of ' + store.getFields().length + '. Its properties are now open in the editor.'
    );
  }

  /* ================================================================== *
   * Field list
   * ================================================================== */

  /** Remember which control in which row has focus, before a rebuild. */
  function captureFocus() {
    var active = document.activeElement;
    if (!active || !active.closest) { return null; }

    var row = active.closest('.field-row');
    if (!row || !refs.fieldList.contains(row)) { return null; }

    return {
      id: row.getAttribute('data-id'),
      action: active.getAttribute('data-action')
    };
  }

  /** Put focus back on the same control of the same row, after a rebuild. */
  function restoreFocus(signature) {
    if (!signature) { return; }

    var row = refs.fieldList.querySelector('.field-row[data-id="' + signature.id + '"]');
    if (!row) { return; }

    var target = signature.action
      ? row.querySelector('[data-action="' + signature.action + '"]')
      : null;

    // A move button at the end of the list is disabled and cannot take
    // focus; fall back to the row's own button so focus never vanishes.
    if (!target || target.disabled) {
      target = row.querySelector('.field-row__select');
    }
    if (target) { target.focus(); }
  }

  function actionButton(config) {
    return el('button', {
      type: 'button',
      class: 'icon-btn' + (config.danger ? ' icon-btn--danger' : ''),
      'data-action': config.action,
      'aria-label': config.label,
      disabled: config.disabled === true,
      on: { click: config.onClick }
    }, dom.icon(ICONS[config.icon], 15));
  }

  function buildRow(field, index, total) {
    var type = Schema.getType(field.type);
    var typeName = type ? type.name : field.type;
    var isSelected = store.getSelectedId() === field.id;
    var label = field.label && field.label.trim() ? field.label : 'Untitled field';

    /* The name is built from the visible text with hidden text around it,
       rather than from an aria-label that would replace it. An aria-label
       here would leave a speech-input user saying "click Full name" to a
       button whose name no longer contains those words (SC 2.5.3), and it
       is exactly what axe reports as a label-in-name mismatch. */
    var selectButton = el('button', {
      type: 'button',
      class: 'field-row__select',
      'data-action': 'select',
      'aria-pressed': isSelected ? 'true' : 'false',
      on: {
        click: function () {
          store.select(field.id);
          a11y.announce('Editing ' + label + '.');
        }
      }
    }, [
      /* The single spaces between the spans are deliberate. They are
         whitespace-only children of a flex container, so they are never
         rendered and the layout is untouched, but they keep the name from
         being computed as "Full nameShort textRequired" on any engine that
         concatenates child text without inserting a separator. */
      el('span', { class: 'visually-hidden' }, 'Edit '),
      el('span', { class: 'field-row__label' }, label),
      ' ',
      el('span', { class: 'field-row__meta' }, [
        el('span', { class: 'field-row__type' }, typeName),
        field.required ? ' ' : null,
        field.required ? el('span', { class: 'field-row__required' }, 'Required') : null
      ]),
      el('span', { class: 'visually-hidden' },
        ', field ' + (index + 1) + ' of ' + total)
    ]);

    var actions = el('div', { class: 'field-row__actions' }, [
      actionButton({
        action: 'up', icon: 'up', label: 'Move ' + label + ' up',
        disabled: index === 0,
        onClick: function () { moveField(field.id, -1); }
      }),
      actionButton({
        action: 'down', icon: 'down', label: 'Move ' + label + ' down',
        disabled: index === total - 1,
        onClick: function () { moveField(field.id, 1); }
      }),
      actionButton({
        action: 'duplicate', icon: 'duplicate', label: 'Duplicate ' + label,
        onClick: function () { duplicateField(field.id); }
      }),
      actionButton({
        action: 'remove', icon: 'remove', label: 'Remove ' + label, danger: true,
        onClick: function () { removeField(field.id); }
      })
    ]);

    return el('li', {
      class: 'field-row' + (isSelected ? ' field-row--selected' : ''),
      'data-id': field.id
    }, [selectButton, actions]);
  }

  function renderFieldList() {
    var signature = captureFocus();
    var fields = store.getFields();

    dom.clear(refs.fieldList);
    fields.forEach(function (field, index) {
      refs.fieldList.appendChild(buildRow(field, index, fields.length));
    });

    refs.fieldListEmpty.hidden = fields.length > 0;
    refs.fieldList.hidden = fields.length === 0;
    refs.fieldCount.textContent = String(fields.length);
    refs.clearFields.disabled = fields.length === 0;

    restoreFocus(signature);
  }

  /* ------------------------------------------------------------------ *
   * List actions
   * ------------------------------------------------------------------ */

  function moveField(id, delta) {
    var field = store.getField(id);
    if (!field) { return; }

    var to = store.moveField(id, delta);
    if (to === -1) { return; }

    a11y.announce(
      field.label + ' moved to position ' + (to + 1) + ' of ' + store.getFields().length + '.'
    );
  }

  function duplicateField(id) {
    var copy = store.duplicateField(id);
    if (!copy) { return; }
    a11y.announce(copy.label + ' added below the original. Its properties are open in the editor.');
  }

  function removeField(id) {
    var fields = store.getFields();
    var index = store.indexOf(id);
    var field = store.getField(id);
    if (!field) { return; }

    var removed = store.removeField(id);
    if (!removed) { return; }

    lastRemoved = removed;
    showUndo(field.label);

    /* Focus would otherwise be destroyed along with the button that was
       pressed, dropping the keyboard user back at the top of the document.
       It moves to the row that took this one's place, or to the last row,
       or to the palette when the list is now empty. */
    var remaining = store.getFields();
    var focusTarget = null;

    if (remaining.length) {
      var neighbour = remaining[Math.min(index, remaining.length - 1)];
      var row = refs.fieldList.querySelector('.field-row[data-id="' + neighbour.id + '"]');
      focusTarget = row ? row.querySelector('[data-action="remove"]') : null;
    } else {
      focusTarget = refs.undoBar.hidden ? refs.palette.querySelector('.palette-btn')
                                        : refs.undoButton;
    }
    if (focusTarget) { focusTarget.focus(); }

    a11y.announce(
      field.label + ' removed. ' +
      (remaining.length
        ? remaining.length + (remaining.length === 1 ? ' field remains.' : ' fields remain.')
        : 'The form is now empty.') +
      ' An undo button is available below the field list.'
    );
  }

  function showUndo(label) {
    refs.undoText.textContent = '"' + label + '" was removed.';
    refs.undoBar.hidden = false;
  }

  function hideUndo() {
    refs.undoBar.hidden = true;
    lastRemoved = null;
  }

  function undoRemove() {
    if (!lastRemoved) { return; }

    var field = lastRemoved.field;
    var index = lastRemoved.index;
    hideUndo();
    store.insertField(field, index);

    var row = refs.fieldList.querySelector('.field-row[data-id="' + field.id + '"]');
    var target = row ? row.querySelector('.field-row__select') : null;
    if (target) { target.focus(); }

    a11y.announce(field.label + ' restored to position ' + (index + 1) + '.');
  }

  function clearAllFields() {
    if (!store.getFields().length) { return; }

    var message = 'Remove all ' + store.getFields().length +
      ' fields from this form? This cannot be undone.';
    if (!window.confirm(message)) {
      a11y.announce('Nothing was removed.');
      return;
    }

    var count = store.clearFields();
    hideUndo();
    a11y.announce(count + ' fields removed. The form is now empty.');

    var first = refs.palette.querySelector('.palette-btn');
    if (first) { first.focus(); }
  }

  /* ------------------------------------------------------------------ *
   * Keyboard reordering
   * ------------------------------------------------------------------ */

  function onListKeydown(event) {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) { return; }

    var row = event.target.closest('.field-row');
    if (!row) { return; }

    event.preventDefault();
    moveField(row.getAttribute('data-id'), event.key === 'ArrowUp' ? -1 : 1);
  }

  /* ================================================================== *
   * Properties editor
   * ================================================================== */

  function renderEditor() {
    var field = store.getSelectedField();

    refs.editorForm.hidden = !field;
    refs.editorEmpty.hidden = !!field;

    if (!field) {
      refs.editorSubject.textContent = 'Select a field from the list to edit it.';
      return;
    }

    var type = Schema.getType(field.type);
    refs.editorSubject.textContent = 'Editing ' + (field.label || 'Untitled field') +
      ' (' + (type ? type.name : field.type) + ').';

    applyTypeVisibility(field.type);

    refs.propLabel.value = field.label;
    refs.propHint.value = field.hint;
    refs.propPlaceholder.value = field.placeholder;
    refs.propRequired.checked = field.required === true;
    refs.propPrompt.value = field.prompt || '';
    refs.propMinLength.value = field.minLength === null ? '' : field.minLength;
    refs.propMaxLength.value = field.maxLength === null ? '' : field.maxLength;

    buildRuleOptions(field);
    refs.propPattern.value = field.pattern || '';
    refs.propPatternMessage.value = field.patternMessage || '';
    validatePatternInput();

    renderOptionList(field);
  }

  function applyTypeVisibility(typeId) {
    dom.qsa('[data-for]', refs.editorForm).forEach(function (node) {
      var allowed = node.getAttribute('data-for').split(',');
      node.hidden = allowed.indexOf(typeId) === -1;
    });
  }

  function buildRuleOptions(field) {
    var rules = Schema.rulesFor(field.type);
    dom.clear(refs.propRule);

    rules.forEach(function (rule) {
      refs.propRule.appendChild(el('option', { value: rule.id }, rule.name));
    });

    refs.propRule.value = field.rule || 'default';
    if (!refs.propRule.value) { refs.propRule.value = 'default'; }
    refs.propCustomWrap.hidden = refs.propRule.value !== 'custom';
  }

  /** The author's own regular expression is checked before it is trusted. */
  function validatePatternInput() {
    var source = refs.propPattern.value.trim();
    var broken = source !== '' && ISFB.validator.compilePattern(source) === null;

    refs.propPatternError.textContent = broken
      ? 'That is not a valid regular expression, so it is being ignored.'
      : '';
    refs.propPattern.setAttribute('aria-invalid', broken ? 'true' : 'false');
  }

  /* ------------------------------------------------------------------ *
   * Choices for dropdowns and radio groups
   * ------------------------------------------------------------------ */

  function renderOptionList(field) {
    dom.clear(refs.optionList);
    if (!Schema.supports(field, 'options')) { return; }

    field.options.forEach(function (option, index) {
      var input = el('input', {
        type: 'text',
        class: 'control__input',
        value: option.label,
        'aria-label': 'Choice ' + (index + 1),
        autocomplete: 'off',
        on: {
          input: function () {
            var options = field.options.slice();
            // The stored value is derived from the label, which keeps the
            // exported JSON readable without a second box to fill in.
            options[index] = {
              label: input.value,
              value: Schema.slugify(input.value)
            };
            update(field.id, { options: options }, { redrawEditor: false });
          }
        }
      });

      var remove = el('button', {
        type: 'button',
        class: 'icon-btn icon-btn--danger',
        'aria-label': 'Remove choice ' + (index + 1) +
          (option.label ? ', ' + option.label : ''),
        on: {
          click: function () { removeOption(field, index); }
        }
      }, dom.icon(ICONS.close, 14));

      refs.optionList.appendChild(el('li', { class: 'option-row' }, [input, remove]));
    });
  }

  function addOption() {
    var field = store.getSelectedField();
    if (!field) { return; }

    var options = field.options.concat([{ label: '', value: '' }]);
    update(field.id, { options: options }, { redrawEditor: false });

    renderOptionList(store.getSelectedField());
    var inputs = dom.qsa('input', refs.optionList);
    var last = inputs[inputs.length - 1];
    if (last) { last.focus(); }

    a11y.announce('Choice ' + options.length + ' added. Type its text.');
  }

  function removeOption(field, index) {
    var label = field.options[index] && field.options[index].label;
    var options = field.options.slice();
    options.splice(index, 1);

    update(field.id, { options: options }, { redrawEditor: false });
    renderOptionList(store.getSelectedField());

    // Focus the choice that took its place, then the one before it, then
    // the button that adds a new choice.
    var removeButtons = dom.qsa('.icon-btn', refs.optionList);
    var target = removeButtons[Math.min(index, removeButtons.length - 1)] || refs.addOption;
    if (target) { target.focus(); }

    a11y.announce((label ? label : 'Choice ' + (index + 1)) + ' removed. ' +
      options.length + ' remaining.');
  }

  /* ------------------------------------------------------------------ *
   * Writing editor changes into the store
   * ------------------------------------------------------------------ */

  function update(id, patch, options) {
    var redraw = !options || options.redrawEditor !== false;
    editingFromPanel = !redraw;
    store.updateField(id, patch);
    editingFromPanel = false;
  }

  /** Wire one editor input to one property of the selected field. */
  function bindProperty(input, property, transform, eventName) {
    input.addEventListener(eventName || 'input', function () {
      var field = store.getSelectedField();
      if (!field) { return; }

      var patch = {};
      patch[property] = transform ? transform(input, field) : input.value;
      update(field.id, patch, { redrawEditor: false });
    });
  }

  function toNumberOrNull(input) {
    var raw = input.value.trim();
    if (raw === '') { return null; }
    var parsed = parseInt(raw, 10);
    return isNaN(parsed) || parsed < 0 ? null : parsed;
  }

  function bindEditor() {
    bindProperty(refs.propLabel, 'label');
    bindProperty(refs.propHint, 'hint');
    bindProperty(refs.propPlaceholder, 'placeholder');
    bindProperty(refs.propPrompt, 'prompt');
    bindProperty(refs.propPatternMessage, 'patternMessage');
    bindProperty(refs.propMinLength, 'minLength', toNumberOrNull);
    bindProperty(refs.propMaxLength, 'maxLength', toNumberOrNull);

    refs.propPattern.addEventListener('input', function () {
      var field = store.getSelectedField();
      if (!field) { return; }
      validatePatternInput();
      update(field.id, { pattern: refs.propPattern.value }, { redrawEditor: false });
    });

    refs.propRequired.addEventListener('change', function () {
      var field = store.getSelectedField();
      if (!field) { return; }
      update(field.id, { required: refs.propRequired.checked }, { redrawEditor: false });
      a11y.announce(field.label + ' is now ' +
        (refs.propRequired.checked ? 'required.' : 'optional.'));
    });

    refs.propRule.addEventListener('change', function () {
      var field = store.getSelectedField();
      if (!field) { return; }
      var value = refs.propRule.value;
      refs.propCustomWrap.hidden = value !== 'custom';
      update(field.id, { rule: value }, { redrawEditor: false });

      if (value === 'custom') {
        a11y.announce('Custom pattern selected. A pattern box is now shown below.');
        refs.propPattern.focus();
      }
    });

    refs.addOption.addEventListener('click', addOption);

    refs.duplicateField.addEventListener('click', function () {
      var field = store.getSelectedField();
      if (field) { duplicateField(field.id); }
    });

    refs.deleteField.addEventListener('click', function () {
      var field = store.getSelectedField();
      if (field) { removeField(field.id); }
    });

    // The editor never submits; it writes straight through to the store.
    refs.editorForm.addEventListener('submit', function (event) {
      event.preventDefault();
    });
  }

  /* ================================================================== *
   * Form-level settings
   * ================================================================== */

  function bindFormSettings() {
    refs.formTitle.addEventListener('input', function () {
      store.setForm({ title: refs.formTitle.value });
    });
    refs.formDescription.addEventListener('input', function () {
      store.setForm({ description: refs.formDescription.value });
    });
    refs.formSubmitText.addEventListener('input', function () {
      store.setForm({ submitText: refs.formSubmitText.value });
    });
  }

  function syncFormSettings() {
    var form = store.getForm();
    if (document.activeElement !== refs.formTitle) { refs.formTitle.value = form.title; }
    if (document.activeElement !== refs.formDescription) {
      refs.formDescription.value = form.description;
    }
    if (document.activeElement !== refs.formSubmitText) {
      refs.formSubmitText.value = form.submitText;
    }
  }

  /* ================================================================== *
   * Setup
   * ================================================================== */

  function collectRefs() {
    refs = {
      palette: dom.qs('#palette'),
      fieldList: dom.qs('#field-list'),
      fieldListEmpty: dom.qs('#field-list-empty'),
      fieldCount: dom.qs('#field-count'),
      clearFields: dom.qs('#clear-fields'),
      undoBar: dom.qs('#undo-bar'),
      undoText: dom.qs('#undo-bar-text'),
      undoButton: dom.qs('#undo-remove'),

      editorForm: dom.qs('#editor-form'),
      editorEmpty: dom.qs('#editor-empty'),
      editorSubject: dom.qs('#editor-subject'),
      propLabel: dom.qs('#prop-label'),
      propHint: dom.qs('#prop-hint'),
      propPlaceholder: dom.qs('#prop-placeholder'),
      propRequired: dom.qs('#prop-required'),
      propRule: dom.qs('#prop-rule'),
      propCustomWrap: dom.qs('#prop-custom-wrap'),
      propPattern: dom.qs('#prop-pattern'),
      propPatternError: dom.qs('#prop-pattern-error'),
      propPatternMessage: dom.qs('#prop-pattern-message'),
      propMinLength: dom.qs('#prop-minlength'),
      propMaxLength: dom.qs('#prop-maxlength'),
      propPrompt: dom.qs('#prop-prompt'),
      optionList: dom.qs('#option-list'),
      addOption: dom.qs('#add-option'),
      duplicateField: dom.qs('#duplicate-field'),
      deleteField: dom.qs('#delete-field'),

      formTitle: dom.qs('#form-title'),
      formDescription: dom.qs('#form-description'),
      formSubmitText: dom.qs('#form-submit-text')
    };
  }

  function init() {
    collectRefs();
    buildPalette();
    bindEditor();
    bindFormSettings();

    refs.fieldList.addEventListener('keydown', onListKeydown);
    refs.clearFields.addEventListener('click', clearAllFields);
    refs.undoButton.addEventListener('click', undoRemove);

    store.subscribe(function (state, meta) {
      renderFieldList();

      // Typing in the editor must not rebuild the editor: that would reset
      // the caret to the end of the box on every keystroke.
      if (!editingFromPanel && meta.reason !== 'update') {
        renderEditor();
      } else if (meta.reason === 'update') {
        var field = store.getSelectedField();
        if (field) {
          var type = Schema.getType(field.type);
          refs.editorSubject.textContent = 'Editing ' +
            (field.label || 'Untitled field') + ' (' +
            (type ? type.name : field.type) + '.';
        }
      }

      if (meta.reason === 'load' || meta.reason === 'form') { syncFormSettings(); }
      if (meta.reason === 'load' || meta.reason === 'clear') { hideUndo(); }
    });

    syncFormSettings();
    renderFieldList();
    renderEditor();
  }

  return { init: init };
})();
