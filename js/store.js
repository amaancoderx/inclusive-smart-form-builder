/* ==========================================================================
   store.js: application state
   --------------------------------------------------------------------------
   One object holds the form settings, the ordered list of fields and the id
   of the field currently open in the editor. Every change goes through a
   function here, and every change notifies the subscribers, which is what
   keeps the field list, the live preview, the JSON, the HTML and the checks
   in step with one another without any of them knowing about the others.
   ========================================================================== */

window.ISFB = window.ISFB || {};

ISFB.store = (function () {
  'use strict';

  var Schema = ISFB.Schema;
  var storage = ISFB.a11y.storage;

  var STORAGE_KEY = 'config';
  var CONFIG_VERSION = 1;

  var state = {
    form: {
      title: 'Workshop registration',
      description: 'Tell us how to reach you. Fields marked required must be filled in.',
      submitText: 'Submit registration'
    },
    fields: [],
    selectedId: null
  };

  var subscribers = [];
  var saveTimer = null;
  var persistEnabled = true;

  /* ------------------------------------------------------------------ *
   * Subscriptions
   * ------------------------------------------------------------------ */

  function subscribe(callback) {
    subscribers.push(callback);
    return function unsubscribe() {
      var index = subscribers.indexOf(callback);
      if (index !== -1) { subscribers.splice(index, 1); }
    };
  }

  /**
   * `meta.reason` lets a subscriber react proportionately: the preview
   * rebuilds on any change, while the editor only redraws itself when the
   * selection moves, so typing in the label box does not fight the caret.
   */
  function notify(reason, detail) {
    var meta = { reason: reason, detail: detail || null };
    subscribers.forEach(function (callback) { callback(state, meta); });
    schedulePersist();
  }

  /* ------------------------------------------------------------------ *
   * Reading
   * ------------------------------------------------------------------ */

  function getState() { return state; }
  function getFields() { return state.fields; }
  function getForm() { return state.form; }
  function getSelectedId() { return state.selectedId; }

  function indexOf(id) {
    for (var i = 0; i < state.fields.length; i += 1) {
      if (state.fields[i].id === id) { return i; }
    }
    return -1;
  }

  function getField(id) {
    var index = indexOf(id);
    return index === -1 ? null : state.fields[index];
  }

  function getSelectedField() {
    return getField(state.selectedId);
  }

  /* ------------------------------------------------------------------ *
   * Writing
   * ------------------------------------------------------------------ */

  function setForm(patch) {
    Object.keys(patch).forEach(function (key) {
      state.form[key] = patch[key];
    });
    notify('form');
  }

  function select(id) {
    if (state.selectedId === id) { return; }
    state.selectedId = id;
    notify('select', { id: id });
  }

  function addField(typeId) {
    var field = Schema.createField(typeId);
    if (!field) { return null; }
    state.fields.push(field);
    state.selectedId = field.id;
    notify('add', { id: field.id });
    return field;
  }

  function updateField(id, patch) {
    var field = getField(id);
    if (!field) { return null; }
    Object.keys(patch).forEach(function (key) {
      field[key] = patch[key];
    });
    notify('update', { id: id });
    return field;
  }

  function duplicateField(id) {
    var index = indexOf(id);
    if (index === -1) { return null; }

    var copy = JSON.parse(JSON.stringify(state.fields[index]));
    copy.id = Schema.nextId();
    copy.label = state.fields[index].label + ' (copy)';

    state.fields.splice(index + 1, 0, copy);
    state.selectedId = copy.id;
    notify('add', { id: copy.id });
    return copy;
  }

  function removeField(id) {
    var index = indexOf(id);
    if (index === -1) { return null; }

    var removed = state.fields.splice(index, 1)[0];
    if (state.selectedId === id) {
      // Keep the editor on a neighbour rather than emptying it, so the
      // keyboard user is not dropped back to the top of the page.
      var next = state.fields[index] || state.fields[index - 1] || null;
      state.selectedId = next ? next.id : null;
    }
    notify('remove', { id: id, index: index });
    return { field: removed, index: index };
  }

  /** Put a field back at a known position, used to undo a delete. */
  function insertField(field, index) {
    var at = Math.max(0, Math.min(index, state.fields.length));
    state.fields.splice(at, 0, field);
    state.selectedId = field.id;
    notify('add', { id: field.id });
    return at;
  }

  /**
   * Move a field by one position. Returns the new index, or -1 when the
   * field is already at the end it was asked to move towards.
   */
  function moveField(id, delta) {
    var from = indexOf(id);
    if (from === -1) { return -1; }

    var to = from + delta;
    if (to < 0 || to >= state.fields.length) { return -1; }

    var moved = state.fields.splice(from, 1)[0];
    state.fields.splice(to, 0, moved);
    notify('move', { id: id, from: from, to: to });
    return to;
  }

  function clearFields() {
    if (!state.fields.length) { return 0; }
    var count = state.fields.length;
    state.fields = [];
    state.selectedId = null;
    notify('clear');
    return count;
  }

  /* ------------------------------------------------------------------ *
   * Import and export
   * ------------------------------------------------------------------ */

  /** Drop properties that do not apply to a field's type, so the exported
      JSON documents the field rather than the data structure. */
  function serialiseField(field) {
    var out = {
      id: field.id,
      type: field.type,
      label: field.label,
      required: field.required
    };

    if (field.hint) { out.hint = field.hint; }
    if (Schema.supports(field, 'placeholder') && field.placeholder) {
      out.placeholder = field.placeholder;
    }
    if (Schema.supports(field, 'rule') && field.rule && field.rule !== 'default') {
      out.rule = field.rule;
      if (field.rule === 'custom') {
        out.pattern = field.pattern;
        if (field.patternMessage) { out.patternMessage = field.patternMessage; }
      }
    }
    if (Schema.supports(field, 'length')) {
      if (field.minLength !== null) { out.minLength = field.minLength; }
      if (field.maxLength !== null) { out.maxLength = field.maxLength; }
    }
    if (Schema.supports(field, 'prompt') && field.prompt) { out.prompt = field.prompt; }
    if (Schema.supports(field, 'options')) { out.options = field.options; }

    return out;
  }

  function toConfig() {
    return {
      version: CONFIG_VERSION,
      generator: 'Inclusive Smart Form Builder',
      form: {
        title: state.form.title,
        description: state.form.description,
        submitText: state.form.submitText
      },
      fields: state.fields.map(serialiseField)
    };
  }

  function toJSON() {
    return JSON.stringify(toConfig(), null, 2);
  }

  /**
   * Replace everything with an imported configuration.
   * Throws a message written for a person, not a stack trace, because the
   * import panel shows it directly.
   */
  function loadConfig(raw) {
    if (raw === null || typeof raw !== 'object') {
      throw new Error('That is not a form configuration object.');
    }
    if (!Array.isArray(raw.fields)) {
      throw new Error('The configuration needs a "fields" array.');
    }

    var fields = [];
    var skipped = 0;

    raw.fields.forEach(function (rawField) {
      var field = Schema.normaliseField(rawField);
      if (field) { fields.push(field); } else { skipped += 1; }
    });

    if (!fields.length && raw.fields.length) {
      throw new Error('None of the fields in that configuration used a supported type.');
    }

    var form = raw.form && typeof raw.form === 'object' ? raw.form : {};
    state.form = {
      title: typeof form.title === 'string' ? form.title : state.form.title,
      description: typeof form.description === 'string' ? form.description : '',
      submitText: typeof form.submitText === 'string' && form.submitText
        ? form.submitText
        : 'Submit'
    };
    state.fields = fields;
    state.selectedId = fields.length ? fields[0].id : null;

    notify('load');
    return { loaded: fields.length, skipped: skipped };
  }

  /* ------------------------------------------------------------------ *
   * Persistence: the work in progress survives a reload.
   * ------------------------------------------------------------------ */

  function schedulePersist() {
    if (!persistEnabled) { return; }
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(function () {
      storage.write(STORAGE_KEY, toJSON());
    }, 250);
  }

  function restore() {
    var saved = storage.read(STORAGE_KEY);
    if (!saved) { return false; }
    try {
      persistEnabled = false;
      loadConfig(JSON.parse(saved));
      return true;
    } catch (err) {
      storage.remove(STORAGE_KEY);
      return false;
    } finally {
      persistEnabled = true;
    }
  }

  function forget() {
    storage.remove(STORAGE_KEY);
  }

  return {
    subscribe: subscribe,
    notify: notify,

    getState: getState,
    getFields: getFields,
    getForm: getForm,
    getField: getField,
    getSelectedId: getSelectedId,
    getSelectedField: getSelectedField,
    indexOf: indexOf,

    setForm: setForm,
    select: select,
    addField: addField,
    updateField: updateField,
    duplicateField: duplicateField,
    removeField: removeField,
    insertField: insertField,
    moveField: moveField,
    clearFields: clearFields,

    serialiseField: serialiseField,
    toConfig: toConfig,
    toJSON: toJSON,
    loadConfig: loadConfig,
    restore: restore,
    forget: forget
  };
})();
