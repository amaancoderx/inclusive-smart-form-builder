/* ==========================================================================
   main.js: start-up and wiring
   --------------------------------------------------------------------------
   Brings the modules together: restores the saved configuration (or loads the
   sample form on a first visit), keeps the preview and the checks in step
   with the store, and owns the reset control.
   ========================================================================== */

(function () {
  'use strict';

  var dom = ISFB.dom;
  var store = ISFB.store;
  var a11y = ISFB.a11y;

  /* ------------------------------------------------------------------ *
   * The sample form. It uses every supported field type, so the tool has
   * something worth reading on a first visit and a demonstration that does
   * not depend on anyone having built something first.
   * ------------------------------------------------------------------ */
  function sampleConfig() {
    return {
      version: 1,
      form: {
        title: 'Workshop registration',
        description: 'Sessions are limited to 40 seats. We only use these details to confirm your place.',
        submitText: 'Submit registration'
      },
      fields: [
        {
          id: 'field-1', type: 'text', label: 'Full name', required: true,
          hint: 'As it should appear on your certificate.', minLength: 2, maxLength: 60
        },
        {
          id: 'field-2', type: 'email', label: 'Email address', required: true,
          hint: 'We send the joining link here.', placeholder: 'name@example.com'
        },
        {
          id: 'field-3', type: 'phone', label: 'Mobile number', required: false,
          hint: 'Optional. Include the country code, for example +91 98765 43210.'
        },
        {
          id: 'field-4', type: 'dropdown', label: 'Which session do you want?', required: true,
          prompt: 'Select a session',
          options: [
            { label: 'Morning, 9:00 to 11:00', value: 'morning' },
            { label: 'Afternoon, 14:00 to 16:00', value: 'afternoon' },
            { label: 'Evening, 18:00 to 20:00', value: 'evening' }
          ]
        },
        {
          id: 'field-5', type: 'radio', label: 'How should we confirm your place?',
          required: true, hint: 'Choose one.',
          options: [
            { label: 'Email', value: 'email' },
            { label: 'Text message', value: 'sms' },
            { label: 'Phone call', value: 'call' }
          ]
        },
        {
          id: 'field-6', type: 'textarea', label: 'Anything we should know?',
          required: false, maxLength: 300,
          hint: 'Access requirements, dietary needs, or anything else. 300 characters at most.'
        },
        {
          id: 'field-7', type: 'checkbox',
          label: 'I agree to the workshop code of conduct', required: true
        }
      ]
    };
  }

  /* ------------------------------------------------------------------ *
   * Preview and checks
   * ------------------------------------------------------------------ */

  var refs = {};
  var renderedForm = null;

  function refreshOutput(state) {
    renderedForm = ISFB.renderer.render(refs.stage, state);

    var results = ISFB.audit.run(state, renderedForm);
    ISFB.audit.render(refs.auditList, results);

    var problems = ISFB.audit.countProblems(results);
    refs.auditBadge.hidden = problems === 0;
    refs.auditBadge.textContent = problems ? String(problems) : '';

    // The badge is a number in a coloured circle; the tab's name spells out
    // what that number means, so it is not information only a sighted user
    // receives (WCAG 1.1.1 and 1.4.1).
    refs.auditTab.setAttribute('aria-label', problems
      ? 'Checks, ' + problems + (problems === 1 ? ' problem found' : ' problems found')
      : 'Checks, no problems found');
  }

  /* ------------------------------------------------------------------ *
   * Reset
   * ------------------------------------------------------------------ */

  function resetToSample() {
    if (!window.confirm('Discard this form and load the sample registration form again?')) {
      a11y.announce('Reset cancelled. Your form is unchanged.');
      return;
    }

    store.forget();
    store.loadConfig(sampleConfig());
    a11y.announce('The sample registration form has been loaded. It has ' +
      store.getFields().length + ' fields.');

    var firstRow = dom.qs('.field-row__select');
    if (firstRow) { firstRow.focus(); }
  }

  /* ------------------------------------------------------------------ *
   * Start
   * ------------------------------------------------------------------ */

  function init() {
    refs = {
      stage: dom.qs('#preview-stage'),
      auditList: dom.qs('#audit-list'),
      auditBadge: dom.qs('#audit-badge'),
      auditTab: dom.qs('#tab-audit'),
      storageNote: dom.qs('#storage-note'),
      resetButton: dom.qs('#reset-app')
    };

    a11y.setupDisplayModes();
    ISFB.builder.init();
    ISFB.exporter.init();

    store.subscribe(function (state, meta) {
      // Moving the editor's selection changes nothing about the form itself,
      // so the preview is left alone and keeps whatever has been typed into it.
      if (meta.reason === 'select') { return; }
      refreshOutput(state);
    });

    refs.resetButton.addEventListener('click', resetToSample);

    // Tell the user the truth about persistence rather than promising it.
    if (!a11y.storage.write('probe', '1')) {
      refs.storageNote.textContent =
        'This browser is not storing anything, so your form will be gone after a reload. ' +
        'Use the JSON tab to keep a copy.';
    } else {
      a11y.storage.remove('probe');
    }

    if (!store.restore()) {
      store.loadConfig(sampleConfig());
    }

    refreshOutput(store.getState());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
