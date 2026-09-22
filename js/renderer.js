/* ==========================================================================
   renderer.js: the dynamic rendering engine
   --------------------------------------------------------------------------
   Turns the configuration array into real form controls. Every element is
   built with createElement and wired up in the same pass, so the accessible
   markup is not something added afterwards. It is the only way this file
   knows how to build a field.

   The contract each field is rendered against:

     * a real <label for> (or a <legend> for a group), never a placeholder
       standing in for a label
     * aria-required mirroring the configured required flag
     * aria-invalid present from the start, so the state is explicit rather
       than appearing out of nowhere on the first error
     * aria-describedby pointing at the help text and at a permanently
       present, initially empty error element
     * an autocomplete token when the field's purpose can be identified
       (WCAG 2.1 SC 1.3.5)
   ========================================================================== */

window.ISFB = window.ISFB || {};

ISFB.renderer = (function () {
  'use strict';

  var dom = ISFB.dom;
  var Schema = ISFB.Schema;

  var FORM_ID = 'generated-form';
  var TITLE_ID = 'generated-form-title';
  var DESC_ID = 'generated-form-description';

  /* ------------------------------------------------------------------ *
   * Identifying input purpose (SC 1.3.5)
   * A label of "Email address" should let the browser offer the address it
   * already knows. The map is small and only fires on a confident match.
   * ------------------------------------------------------------------ */
  var AUTOCOMPLETE_HINTS = [
    [/\b(full\s*name|your\s*name)\b/i, 'name'],
    [/\b(first\s*name|given\s*name)\b/i, 'given-name'],
    [/\b(last\s*name|surname|family\s*name)\b/i, 'family-name'],
    [/\be-?mail\b/i, 'email'],
    [/\b(mobile|phone|telephone|contact\s*number)\b/i, 'tel'],
    [/\b(organisation|organization|company|employer)\b/i, 'organization'],
    [/\b(address|street)\b/i, 'street-address'],
    [/\b(city|town)\b/i, 'address-level2'],
    [/\b(post\s*code|postal\s*code|zip|pin\s*code)\b/i, 'postal-code'],
    [/\bcountry\b/i, 'country-name'],
    [/\b(date\s*of\s*birth|birthday)\b/i, 'bday'],
    [/\b(job\s*title|designation|role)\b/i, 'organization-title']
  ];

  function autocompleteFor(field) {
    var type = Schema.getType(field.type);
    if (type && type.autocomplete && type.autocomplete !== 'off') {
      return type.autocomplete;
    }
    for (var i = 0; i < AUTOCOMPLETE_HINTS.length; i += 1) {
      if (AUTOCOMPLETE_HINTS[i][0].test(field.label || '')) {
        return AUTOCOMPLETE_HINTS[i][1];
      }
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   * Shared pieces
   * ------------------------------------------------------------------ */

  function hintId(field) { return field.id + '-hint'; }
  function errorId(field) { return field.id + '-error'; }

  /**
   * The describedby list is built once and never changed. The error element
   * is always in it, and is simply empty until there is something to say.
   */
  function describedBy(field) {
    var ids = [];
    if (field.hint) { ids.push(hintId(field)); }
    ids.push(errorId(field));
    return ids.join(' ');
  }

  function buildHint(field) {
    if (!field.hint) { return null; }
    return dom.el('p', { class: 'field__hint', id: hintId(field) }, field.hint);
  }

  function buildError(field) {
    // Empty on purpose. It is referenced by aria-describedby from the first
    // render, and an empty element adds nothing to the description.
    return dom.el('p', { class: 'field__error', id: errorId(field) });
  }

  /**
   * The visible "(required)" marker is hidden from assistive technology,
   * because aria-required already conveys the same thing. Exposing both
   * makes a screen reader say "required" twice for every field.
   */
  function buildMarker(field, markOptional) {
    if (field.required) {
      return dom.el('span', { class: 'field__required', 'aria-hidden': 'true' }, '(required)');
    }
    if (markOptional) {
      return dom.el('span', { class: 'field__optional', 'aria-hidden': 'true' }, '(optional)');
    }
    return null;
  }

  function labelText(field) {
    return field.label && field.label.trim() ? field.label : 'Untitled field';
  }

  /* ------------------------------------------------------------------ *
   * Field builders, one per rendering strategy
   * ------------------------------------------------------------------ */

  function buildTextual(field, type, markOptional) {
    var tag = type.render === 'textarea' ? 'textarea' : 'input';

    var attrs = {
      class: 'field__control',
      id: field.id,
      name: field.id,
      'aria-required': field.required ? 'true' : 'false',
      'aria-invalid': 'false',
      'aria-describedby': describedBy(field)
    };

    if (tag === 'input') {
      attrs.type = type.inputType || 'text';
    } else {
      attrs.rows = '4';
    }
    if (type.inputmode) { attrs.inputmode = type.inputmode; }
    if (field.placeholder) { attrs.placeholder = field.placeholder; }

    var auto = autocompleteFor(field);
    if (auto) { attrs.autocomplete = auto; }

    // minlength / maxlength are checked in JavaScript instead of being set as
    // attributes: the native maxlength silently refuses further typing, which
    // gives no explanation to anyone and none at all to a screen reader user.
    if (field.minLength !== null) { attrs['data-minlength'] = String(field.minLength); }
    if (field.maxLength !== null) { attrs['data-maxlength'] = String(field.maxLength); }

    return [
      dom.el('label', { class: 'field__label', for: field.id }, [
        labelText(field),
        buildMarker(field, markOptional)
      ]),
      buildHint(field),
      dom.el(tag, attrs),
      buildError(field)
    ];
  }

  function buildSelect(field, markOptional) {
    var options = [];

    // An empty-valued first option keeps "nothing chosen" a real state that
    // the required check can detect, instead of silently pre-selecting.
    options.push(dom.el('option', { value: '' }, field.prompt || 'Select an option'));

    field.options.forEach(function (option) {
      options.push(dom.el('option', { value: option.value }, option.label));
    });

    var select = dom.el('select', {
      class: 'field__control',
      id: field.id,
      name: field.id,
      'aria-required': field.required ? 'true' : 'false',
      'aria-invalid': 'false',
      'aria-describedby': describedBy(field),
      autocomplete: autocompleteFor(field)
    }, options);

    return [
      dom.el('label', { class: 'field__label', for: field.id }, [
        labelText(field),
        buildMarker(field, markOptional)
      ]),
      buildHint(field),
      select,
      buildError(field)
    ];
  }

  function buildCheckbox(field) {
    var input = dom.el('input', {
      class: 'field__check',
      type: 'checkbox',
      id: field.id,
      name: field.id,
      value: 'yes',
      'aria-required': field.required ? 'true' : 'false',
      'aria-invalid': 'false',
      'aria-describedby': describedBy(field)
    });

    return [
      dom.el('div', { class: 'field__checkbox-wrap' }, [
        input,
        dom.el('label', { class: 'field__label', for: field.id }, [
          labelText(field),
          field.required
            ? dom.el('span', { class: 'field__required', 'aria-hidden': 'true' }, '(required)')
            : null
        ])
      ]),
      buildHint(field),
      buildError(field)
    ];
  }

  /**
   * A radio group needs its question announced before the choices. The
   * fieldset carries role="radiogroup" so it can take aria-required and
   * aria-invalid, and aria-labelledby points at the legend explicitly so the
   * group keeps its name once the native role has been overridden.
   */
  function buildRadioGroup(field, markOptional) {
    var legendId = field.id + '-legend';

    var choices = field.options.map(function (option, index) {
      var optionId = field.id + '-option-' + index;
      return dom.el('div', { class: 'field__choice' }, [
        dom.el('input', {
          class: 'field__check',
          type: 'radio',
          id: optionId,
          name: field.id,
          value: option.value
        }),
        dom.el('label', { class: 'field__choice-label', for: optionId }, option.label)
      ]);
    });

    var fieldset = dom.el('fieldset', {
      class: 'field__group',
      role: 'radiogroup',
      'aria-labelledby': legendId,
      'aria-required': field.required ? 'true' : 'false',
      'aria-invalid': 'false',
      'aria-describedby': describedBy(field)
    }, [
      dom.el('legend', { class: 'field__group-legend', id: legendId }, [
        labelText(field),
        buildMarker(field, markOptional)
      ]),
      buildHint(field),
      choices.length
        ? dom.el('div', { class: 'field__choices' }, choices)
        : dom.el('p', { class: 'field__hint' }, 'This group has no choices yet.'),
      buildError(field)
    ]);

    return [fieldset];
  }

  /* ------------------------------------------------------------------ *
   * One field
   * ------------------------------------------------------------------ */

  function buildField(field, markOptional) {
    var type = Schema.getType(field.type);
    if (!type) { return null; }

    var contents;
    switch (type.render) {
      case 'select':   contents = buildSelect(field, markOptional); break;
      case 'checkbox': contents = buildCheckbox(field); break;
      case 'radio':    contents = buildRadioGroup(field, markOptional); break;
      default:         contents = buildTextual(field, type, markOptional); break;
    }

    // data-field-id lets one delegated listener on the form find the
    // configuration behind whichever control the event came from.
    return dom.el('div', {
      class: 'field field--' + type.id,
      'data-field-id': field.id,
      'data-field-type': type.id
    }, contents);
  }

  /* ------------------------------------------------------------------ *
   * The whole form
   * ------------------------------------------------------------------ */

  /**
   * Build the form as a detached element. Used both for the live preview and
   * for the HTML export, so what is exported is exactly what is rendered.
   */
  function buildForm(state) {
    var form = state.form;
    var fields = state.fields;

    var requiredCount = fields.filter(function (f) { return f.required; }).length;
    // Only label the optional fields when there is a distinction worth
    // drawing; if nothing is required, "(optional)" everywhere is just noise.
    var markOptional = requiredCount > 0 && requiredCount < fields.length;

    var header = [];
    var describedByIds = [];

    if (form.title) {
      header.push(dom.el('h3', { class: 'gen-form__title', id: TITLE_ID }, form.title));
    }
    if (form.description) {
      header.push(dom.el('p', { class: 'gen-form__description', id: DESC_ID }, form.description));
      describedByIds.push(DESC_ID);
    }
    if (requiredCount === fields.length && fields.length > 0) {
      header.push(dom.el('p', { class: 'gen-form__legend-note' }, 'All fields are required.'));
    }

    var fieldNodes = fields.map(function (field) {
      return buildField(field, markOptional);
    }).filter(Boolean);

    var formEl = dom.el('form', {
      class: 'gen-form',
      id: FORM_ID,
      // Native bubble validation is switched off so the messages below are
      // the only ones shown: they are consistent, styled and, unlike the
      // native bubbles, properly associated with the field they describe.
      novalidate: true,
      'aria-labelledby': form.title ? TITLE_ID : null,
      'aria-describedby': describedByIds.length ? describedByIds.join(' ') : null
    }, [
      header.length ? dom.el('div', { class: 'gen-form__header' }, header) : null,
      dom.el('div', { class: 'gen-form__fields' }, fieldNodes),
      dom.el('div', { class: 'gen-form__footer' }, [
        dom.el('button', { type: 'submit', class: 'btn gen-form__submit' },
          form.submitText || 'Submit')
      ])
    ]);

    return formEl;
  }

  /* ------------------------------------------------------------------ *
   * Mounting, without throwing away what the visitor has typed
   * ------------------------------------------------------------------ */

  function captureValues(stage, fields) {
    var saved = {};
    var existing = stage.querySelector('#' + FORM_ID);
    if (!existing) { return saved; }

    fields.forEach(function (field) {
      try {
        saved[field.id] = ISFB.validator.readValue(field, existing);
      } catch (err) { /* the field may not exist in the previous render */ }
    });
    return saved;
  }

  function restoreValues(formEl, fields, saved) {
    fields.forEach(function (field) {
      if (!(field.id in saved)) { return; }
      var value = saved[field.id];

      if (field.type === 'checkbox') {
        var box = formEl.querySelector('#' + field.id);
        if (box) { box.checked = value === true; }
        return;
      }

      if (field.type === 'radio') {
        if (!value) { return; }
        dom.qsa('input[name="' + field.id + '"]', formEl).forEach(function (radio) {
          if (radio.value === value) { radio.checked = true; }
        });
        return;
      }

      var control = formEl.querySelector('#' + field.id);
      if (!control) { return; }
      if (field.type === 'dropdown') {
        // Only restore a choice that still exists after an options edit.
        var stillThere = Array.prototype.some.call(control.options, function (option) {
          return option.value === value;
        });
        if (!stillThere) { return; }
      }
      control.value = value;
    });
  }

  /**
   * Render the configuration into the preview stage and wire up validation.
   * Re-rendering is a full rebuild, which keeps the DOM an honest reflection
   * of the configuration; typed values are carried across so editing a label
   * does not wipe out what someone was part-way through filling in.
   */
  function render(stage, state) {
    var saved = captureValues(stage, state.fields);
    dom.clear(stage);

    if (!state.fields.length) {
      stage.appendChild(dom.el('div', { class: 'preview-empty' }, [
        dom.el('strong', null, 'Nothing to preview yet'),
        'Add a field on the left and the accessible form appears here immediately.'
      ]));
      return null;
    }

    var formEl = buildForm(state);
    stage.appendChild(formEl);
    restoreValues(formEl, state.fields, saved);
    ISFB.validator.attach(formEl, state.fields);
    return formEl;
  }

  return {
    render: render,
    buildForm: buildForm,
    buildField: buildField,
    autocompleteFor: autocompleteFor,
    FORM_ID: FORM_ID
  };
})();
