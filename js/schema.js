/* ==========================================================================
   schema.js: the field configuration data structure
   --------------------------------------------------------------------------
   The whole application is driven by one array of plain field objects. This
   module owns the shape of those objects: the supported field types, the
   validation rules each type can use, and the functions that create and
   sanitise a field. Nothing here touches the DOM.
   ========================================================================== */

window.ISFB = window.ISFB || {};

ISFB.Schema = (function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Patterns used by the built-in validation rules.
   * ------------------------------------------------------------------ */
  var PATTERNS = {
    // Deliberately permissive: anything with a single @, a dot in the domain
    // and no spaces. Over-strict email regexes reject valid addresses.
    email: /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/,
    // Accepts +country codes, spaces, hyphens, brackets. This says only which
    // characters are allowed; how many digits there must be is a separate
    // check, so a number that is merely too short gets a message that says so
    // rather than a vague complaint about its format.
    phone: /^\+?[0-9()\-.\s]+$/,
    letters: /^[A-Za-zÀ-ɏ' \-]+$/,
    digits: /^[0-9]+$/
  };

  /* ------------------------------------------------------------------ *
   * Validation rules offered in the properties editor.
   * `appliesTo` keeps the list relevant to the selected field type.
   * ------------------------------------------------------------------ */
  var RULES = [
    {
      id: 'default',
      name: 'Standard for this field type',
      appliesTo: ['text', 'email', 'phone', 'textarea']
    },
    {
      id: 'letters',
      name: 'Letters, spaces, hyphens and apostrophes only',
      appliesTo: ['text'],
      pattern: PATTERNS.letters,
      message: 'Use letters only. Numbers and symbols are not allowed here.'
    },
    {
      id: 'digits',
      name: 'Digits only',
      appliesTo: ['text'],
      pattern: PATTERNS.digits,
      message: 'Use digits only, with no spaces or symbols.'
    },
    {
      id: 'custom',
      name: 'Custom pattern',
      appliesTo: ['text', 'email', 'phone', 'textarea']
    }
  ];

  /* ------------------------------------------------------------------ *
   * Field types.
   *   supports: which properties the editor shows for this type
   *   render:   how the rendering engine builds it
   *   icon:     SVG path data for the palette button
   * ------------------------------------------------------------------ */
  var TYPES = [
    {
      id: 'text',
      name: 'Short text',
      render: 'input',
      inputType: 'text',
      autocomplete: 'off',
      defaultLabel: 'Full name',
      defaultHint: '',
      supports: ['placeholder', 'hint', 'required', 'rule', 'length'],
      icon: 'M3 7h14M3 11h14M3 15h8'
    },
    {
      id: 'email',
      name: 'Email address',
      render: 'input',
      inputType: 'email',
      autocomplete: 'email',
      inputmode: 'email',
      defaultLabel: 'Email address',
      defaultHint: 'We use this to send your confirmation.',
      supports: ['placeholder', 'hint', 'required', 'rule'],
      icon: 'M2.5 5.5h15v9h-15zM2.5 6l7.5 5 7.5-5'
    },
    {
      id: 'phone',
      name: 'Phone number',
      render: 'input',
      inputType: 'tel',
      autocomplete: 'tel',
      inputmode: 'tel',
      defaultLabel: 'Phone number',
      defaultHint: 'Include the country code, for example +91.',
      supports: ['placeholder', 'hint', 'required', 'rule'],
      icon: 'M6.5 2.5h7v15h-7zM8.7 15.4h2.6'
    },
    {
      id: 'textarea',
      name: 'Long text',
      render: 'textarea',
      defaultLabel: 'Your message',
      defaultHint: '',
      supports: ['placeholder', 'hint', 'required', 'rule', 'length'],
      icon: 'M3 5h14M3 9h14M3 13h14M3 17h6'
    },
    {
      id: 'dropdown',
      name: 'Dropdown',
      render: 'select',
      defaultLabel: 'Country',
      defaultHint: '',
      supports: ['hint', 'required', 'options', 'prompt'],
      icon: 'M3 5.5h14v9H3zM7 8.5l3 3 3-3'
    },
    {
      id: 'radio',
      name: 'Radio group',
      render: 'radio',
      defaultLabel: 'How should we contact you?',
      defaultHint: 'Choose one option.',
      supports: ['hint', 'required', 'options'],
      icon: 'M5.5 6.5a2 2 0 1 0 0 .01M5.5 13.5a2 2 0 1 0 0 .01M10 6.5h6M10 13.5h6'
    },
    {
      id: 'checkbox',
      name: 'Checkbox',
      render: 'checkbox',
      defaultLabel: 'I agree to the privacy notice',
      defaultHint: '',
      supports: ['hint', 'required'],
      icon: 'M4 4.5h12v11H4zM7 10l2.2 2.2L13.5 8'
    }
  ];

  var typeIndex = {};
  TYPES.forEach(function (t) { typeIndex[t.id] = t; });

  /* Monotonic counter, so every field gets a DOM id that is stable for the
     lifetime of the session and unique even after deletes and imports. */
  var seq = 0;

  function nextId() {
    seq += 1;
    return 'field-' + seq;
  }

  /* Imported configurations may carry ids we have already used, or ids in a
     different format. Bumping the counter past any numeric suffix keeps the
     generator from ever colliding with them. */
  function reserveId(id) {
    var match = /(\d+)$/.exec(String(id || ''));
    if (match) {
      var n = parseInt(match[1], 10);
      if (n > seq) { seq = n; }
    }
  }

  function getType(typeId) {
    return typeIndex[typeId] || null;
  }

  function supports(field, feature) {
    var type = getType(field && field.type);
    return !!type && type.supports.indexOf(feature) !== -1;
  }

  function rulesFor(typeId) {
    return RULES.filter(function (rule) {
      return rule.appliesTo.indexOf(typeId) !== -1;
    });
  }

  function getRule(ruleId) {
    for (var i = 0; i < RULES.length; i += 1) {
      if (RULES[i].id === ruleId) { return RULES[i]; }
    }
    return null;
  }

  /* Default choices, so a dropdown or radio group is never born empty. */
  function defaultOptions(typeId) {
    if (typeId === 'dropdown') {
      return [
        { label: 'India', value: 'india' },
        { label: 'United Kingdom', value: 'uk' },
        { label: 'United States', value: 'us' }
      ];
    }
    if (typeId === 'radio') {
      return [
        { label: 'Email', value: 'email' },
        { label: 'Phone call', value: 'phone' }
      ];
    }
    return [];
  }

  /**
   * Build a new field of the given type, already filled with sensible
   * defaults so the preview is meaningful the moment it is added.
   */
  function createField(typeId) {
    var type = getType(typeId);
    if (!type) { return null; }

    return {
      id: nextId(),
      type: type.id,
      label: type.defaultLabel,
      hint: type.defaultHint || '',
      placeholder: '',
      required: typeId !== 'checkbox',
      rule: 'default',
      pattern: '',
      patternMessage: '',
      minLength: null,
      maxLength: null,
      prompt: typeId === 'dropdown' ? 'Select an option' : '',
      options: defaultOptions(type.id)
    };
  }

  /* ------------------------------------------------------------------ *
   * Import safety: anything arriving from a pasted or uploaded JSON file
   * is rebuilt property by property, so an unexpected key can never reach
   * the renderer.
   * ------------------------------------------------------------------ */

  function toText(value, fallback) {
    if (typeof value === 'string') { return value; }
    if (typeof value === 'number') { return String(value); }
    return fallback === undefined ? '' : fallback;
  }

  function toCount(value) {
    var n = parseInt(value, 10);
    if (isNaN(n) || n < 0) { return null; }
    return n;
  }

  function normaliseOption(raw, index) {
    if (raw === null || typeof raw !== 'object') {
      var text = toText(raw, 'Option ' + (index + 1));
      return { label: text, value: slug(text) };
    }
    var label = toText(raw.label, 'Option ' + (index + 1));
    return { label: label, value: toText(raw.value, '') || slug(label) };
  }

  function slug(text) {
    return String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'option';
  }

  /**
   * Turn an arbitrary object into a valid field, or return null if it
   * cannot be understood. Unknown types are rejected rather than guessed at.
   */
  function normaliseField(raw) {
    if (raw === null || typeof raw !== 'object') { return null; }
    var type = getType(toText(raw.type));
    if (!type) { return null; }

    var field = createField(type.id);

    if (raw.id) {
      reserveId(raw.id);
      field.id = toText(raw.id, field.id);
    }

    field.label = toText(raw.label, type.defaultLabel);
    field.hint = toText(raw.hint, '');
    field.placeholder = toText(raw.placeholder, '');
    field.required = raw.required === true;
    field.prompt = toText(raw.prompt, field.prompt);

    var rule = getRule(toText(raw.rule));
    field.rule = rule && rule.appliesTo.indexOf(type.id) !== -1 ? rule.id : 'default';
    field.pattern = toText(raw.pattern, '');
    field.patternMessage = toText(raw.patternMessage, '');

    field.minLength = toCount(raw.minLength);
    field.maxLength = toCount(raw.maxLength);

    if (Array.isArray(raw.options)) {
      field.options = raw.options.map(normaliseOption);
    } else if (!supports(field, 'options')) {
      field.options = [];
    }

    return field;
  }

  function slugify(text) { return slug(text); }

  return {
    TYPES: TYPES,
    RULES: RULES,
    PATTERNS: PATTERNS,
    createField: createField,
    normaliseField: normaliseField,
    getType: getType,
    getRule: getRule,
    rulesFor: rulesFor,
    supports: supports,
    nextId: nextId,
    reserveId: reserveId,
    slugify: slugify
  };
})();
