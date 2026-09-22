/* ==========================================================================
   validator.js: the accessible validation module
   --------------------------------------------------------------------------
   Two halves:
     * the rules:     pure functions that turn (field, value) into a message
     * the behaviour: when validation runs, where the message is written,
                       and what a screen reader hears when it appears.

   The behaviour is the part that matters for accessibility, and the choices
   made here are deliberate:

   1. An error message lives in a permanent, initially empty element that the
      control points at with aria-describedby. An empty element contributes
      nothing to the accessible description, so the link can be made once at
      render time and never rewired.
   2. aria-invalid on the control is the single source of truth for the error
      state. The red border is a CSS rule reading that attribute, so the
      visual and the programmatic state cannot drift apart.
   3. Validation on blur never fires an announcement: focus has already left,
      and interrupting the user's next field is hostile. On a failed submit
      an error summary is built and focused, which both announces the problem
      and gives a keyboard user a direct link to every field involved.
   4. While a field is being corrected, it is re-validated on every keystroke
      so the error disappears the moment it is fixed. New errors are never
      raised mid-typing. Nobody wants "invalid email" after one character.
   ========================================================================== */

window.ISFB = window.ISFB || {};

ISFB.validator = (function () {
  'use strict';

  var Schema = ISFB.Schema;
  var dom = ISFB.dom;
  var a11y = ISFB.a11y;

  /* ------------------------------------------------------------------ *
   * Message helpers
   * ------------------------------------------------------------------ */

  /* A label is written either as a thing ("Email address") or as a question
     ("How should we confirm your place?"). The two need different sentences:
     "Enter how should we confirm your place" is not English. Every message
     below picks its wording from which kind of label it was given, because a
     message nobody can parse fails WCAG 3.3.3 just as surely as no message. */

  function isQuestion(label) {
    return /\?\s*$/.test(String(label || ''));
  }

  function quoted(label) {
    return '“' + String(label).trim() + '”';
  }

  /** "Email address" -> "email address", so it reads inside a sentence. */
  function phrase(label) {
    var text = String(label || 'this field').replace(/[:?*\s]+$/, '');
    if (!text) { return 'this field'; }
    // Leave acronyms and names that are fully capitalised alone.
    if (text.length > 1 && text === text.toUpperCase()) { return text; }
    return text.charAt(0).toLowerCase() + text.slice(1);
  }

  /** What to call the field inside a sentence about its contents. */
  function subject(field) {
    return isQuestion(field.label) ? 'your answer' : phrase(field.label);
  }

  /* A quoted question already ends in "?", so no full stop is added after it. */
  function sentence(text) {
    return /[.?!”]$/.test(text) ? text : text + '.';
  }

  function requiredMessage(field) {
    var question = isQuestion(field.label);

    switch (field.type) {
      case 'dropdown':
        return question
          ? sentence('Select an answer to ' + quoted(field.label))
          : 'Select ' + phrase(field.label) + ' from the list.';
      case 'radio':
        return question
          ? sentence('Select an answer to ' + quoted(field.label))
          : 'Select one option for ' + phrase(field.label) + '.';
      case 'checkbox':
        // Named rather than called "this box", so the entry in the error
        // summary still says which checkbox when a form has several.
        return sentence('Select ' + quoted(field.label) + ' to continue');
      case 'email':
        return 'Enter your email address.';
      case 'phone':
        return 'Enter your phone number.';
      default:
        return question
          ? sentence('Answer ' + quoted(field.label))
          : 'Enter ' + phrase(field.label) + '.';
    }
  }

  function countDigits(value) {
    var digits = value.replace(/\D/g, '');
    return digits.length;
  }

  /* ------------------------------------------------------------------ *
   * The rules
   * ------------------------------------------------------------------ */

  /**
   * Validate one field against one value.
   * @returns {{valid: boolean, message: string}}
   */
  function validateField(field, value) {
    var ok = { valid: true, message: '' };

    /* --- presence ------------------------------------------------- */
    var isEmpty;
    if (field.type === 'checkbox') {
      isEmpty = value !== true;
    } else {
      isEmpty = String(value === null || value === undefined ? '' : value).trim() === '';
    }

    if (isEmpty) {
      return field.required
        ? { valid: false, message: requiredMessage(field) }
        : ok;                       // empty and optional: nothing more to check
    }

    if (field.type === 'checkbox' || field.type === 'radio' || field.type === 'dropdown') {
      return ok;                    // presence is the only rule these can fail
    }

    var text = String(value).trim();

    /* --- length --------------------------------------------------- */
    if (Schema.supports(field, 'length')) {
      if (field.minLength !== null && text.length < field.minLength) {
        return {
          valid: false,
          message: capitalise(subject(field)) + ' must be ' + field.minLength +
            ' characters or more. You have entered ' + text.length + '.'
        };
      }
      if (field.maxLength !== null && text.length > field.maxLength) {
        return {
          valid: false,
          message: capitalise(subject(field)) + ' must be ' + field.maxLength +
            ' characters or fewer. You have entered ' + text.length + '.'
        };
      }
    }

    /* --- pattern -------------------------------------------------- */
    var rule = field.rule || 'default';

    if (rule === 'custom') {
      var custom = compilePattern(field.pattern);
      if (custom && !custom.test(text)) {
        return {
          valid: false,
          message: field.patternMessage ||
            'Enter ' + subject(field) + ' in the format this field expects.'
        };
      }
      return ok;
    }

    if (rule !== 'default') {
      var named = Schema.getRule(rule);
      if (named && named.pattern && !named.pattern.test(text)) {
        return { valid: false, message: named.message };
      }
      return ok;
    }

    /* --- the type's own standard check ---------------------------- */
    if (field.type === 'email' && !Schema.PATTERNS.email.test(text)) {
      return {
        valid: false,
        message: 'Enter an email address in the format name@example.com.'
      };
    }

    if (field.type === 'phone') {
      if (!Schema.PATTERNS.phone.test(text)) {
        return {
          valid: false,
          message: 'Enter a phone number using digits, spaces, brackets or a leading plus sign.'
        };
      }
      var digits = countDigits(text);
      if (digits < 7 || digits > 15) {
        return {
          valid: false,
          message: 'Enter a phone number with 7 to 15 digits. You have entered ' + digits + '.'
        };
      }
    }

    return ok;
  }

  function capitalise(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /** A pattern typed by the form author may be nonsense; never let it throw. */
  function compilePattern(source) {
    if (!source) { return null; }
    try {
      return new RegExp('^(?:' + source + ')$');
    } catch (err) {
      return null;
    }
  }

  /* ------------------------------------------------------------------ *
   * Reading values out of the rendered form
   * ------------------------------------------------------------------ */

  function controlsFor(field, formEl) {
    if (field.type === 'radio') {
      return dom.qsa('input[type="radio"][name="' + field.id + '"]', formEl);
    }
    var single = formEl.querySelector('#' + cssId(field.id));
    return single ? [single] : [];
  }

  /* Field ids are generated by this application ("field-7"), so they are
     always valid selectors, but escaping keeps that assumption honest. */
  function cssId(id) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(id);
    }
    return String(id).replace(/([^\w-])/g, '\\$1');
  }

  function readValue(field, formEl) {
    var controls = controlsFor(field, formEl);
    if (!controls.length) { return field.type === 'checkbox' ? false : ''; }

    if (field.type === 'checkbox') { return controls[0].checked === true; }

    if (field.type === 'radio') {
      for (var i = 0; i < controls.length; i += 1) {
        if (controls[i].checked) { return controls[i].value; }
      }
      return '';
    }

    return controls[0].value;
  }

  /* ------------------------------------------------------------------ *
   * Writing the error into the DOM
   * ------------------------------------------------------------------ */

  /**
   * Which element carries aria-invalid for a field.
   *
   * For a radio group that is the group itself, not the individual radios:
   * no single option is invalid, the unanswered question is, and marking
   * every option would have a screen reader say "invalid" on each one as the
   * user arrows through them.
   */
  function invalidTargets(field, formEl) {
    if (field.type === 'radio') {
      var group = formEl.querySelector(
        '.field[data-field-id="' + field.id + '"] [role="radiogroup"]'
      );
      return group ? [group] : [];
    }
    return controlsFor(field, formEl);
  }

  function setFieldError(field, formEl, message) {
    var errorEl = formEl.querySelector('#' + cssId(field.id + '-error'));
    var invalid = !!message;

    invalidTargets(field, formEl).forEach(function (target) {
      target.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    });

    if (errorEl) {
      // An empty element drops out of the accessible description and out of
      // the layout (form.css hides :empty), so no attribute rewiring is needed.
      errorEl.textContent = message || '';
    }

    return invalid;
  }

  function clearAllErrors(fields, formEl) {
    fields.forEach(function (field) { setFieldError(field, formEl, ''); });
    removeSummary(formEl);
    removeSuccess(formEl);
  }

  function removeSummary(formEl) {
    var existing = formEl.querySelector('.error-summary');
    if (existing) { existing.parentNode.removeChild(existing); }
  }

  function removeSuccess(formEl) {
    var existing = formEl.parentNode && formEl.parentNode.querySelector('.form-success');
    if (existing) { existing.parentNode.removeChild(existing); }
  }

  /* ------------------------------------------------------------------ *
   * The error summary
   * ------------------------------------------------------------------ */

  function buildSummary(problems, formEl) {
    var titleId = 'error-summary-title';

    var list = dom.el('ul', { class: 'error-summary__list' }, problems.map(function (problem) {
      var link = dom.el('a', {
        class: 'error-summary__link',
        href: '#' + problem.focusId,
        on: {
          click: function (event) {
            // The target may be a radio inside a group, so move focus
            // explicitly rather than relying on the fragment jump.
            event.preventDefault();
            var target = formEl.querySelector('#' + cssId(problem.focusId));
            a11y.focusElement(target);
          }
        }
      }, problem.message);

      return dom.el('li', null, link);
    }));

    /* Focus is moved to this container after it is inserted. That focus move
       is what makes a screen reader read the summary, which is why there is
       no role="alert" here as well. The two together cause the content to
       be announced twice on several screen reader and browser pairings.
       role="group" is what allows the container to carry a name at all: a
       plain <div> resolves to role="generic", on which ARIA prohibits
       aria-labelledby, and the heading would be dropped from the name. */
    return dom.el('div', {
      class: 'error-summary',
      role: 'group',
      tabindex: '-1',
      'aria-labelledby': titleId
    }, [
      dom.el('h3', { class: 'error-summary__title', id: titleId }, 'There is a problem'),
      dom.el('p', { class: 'error-summary__intro' },
        problems.length === 1
          ? 'Fix the following before submitting this form.'
          : 'Fix the following ' + problems.length + ' problems before submitting this form.'),
      list
    ]);
  }

  /** The element a summary link should send focus to. */
  function focusTargetId(field) {
    return field.type === 'radio' ? field.id + '-option-0' : field.id;
  }

  /* ------------------------------------------------------------------ *
   * Validating the whole form
   * ------------------------------------------------------------------ */

  function validateAll(fields, formEl) {
    var problems = [];

    fields.forEach(function (field) {
      var result = validateField(field, readValue(field, formEl));
      setFieldError(field, formEl, result.valid ? '' : result.message);
      if (!result.valid) {
        problems.push({
          field: field,
          message: result.message,
          focusId: focusTargetId(field)
        });
      }
    });

    return problems;
  }

  /* ------------------------------------------------------------------ *
   * Wiring a rendered form up to all of the above
   * ------------------------------------------------------------------ */

  /**
   * Attach live validation to a form the renderer has just built.
   * @param {HTMLFormElement} formEl
   * @param {Array} fields  the configuration the form was rendered from
   */
  function attach(formEl, fields) {
    // Fields that have already failed once. Only these are re-checked while
    // the user types, which is what keeps the feedback helpful instead of
    // punishing someone halfway through typing their address.
    var touched = Object.create(null);

    function fieldFromEvent(event) {
      var owner = event.target.closest('[data-field-id]');
      if (!owner) { return null; }
      var id = owner.getAttribute('data-field-id');
      for (var i = 0; i < fields.length; i += 1) {
        if (fields[i].id === id) { return fields[i]; }
      }
      return null;
    }

    function check(field, options) {
      var wasInvalid = touched[field.id] === true;
      var result = validateField(field, readValue(field, formEl));
      setFieldError(field, formEl, result.valid ? '' : result.message);
      touched[field.id] = !result.valid;

      // A correction is the one thing worth announcing mid-edit: the error
      // text vanishing is otherwise a silent event for a screen reader user.
      if (wasInvalid && result.valid && options && options.announceFix) {
        a11y.announce(quoted(field.label) + ' is now valid.');
      }
      return result.valid;
    }

    /* --- blur: the main real-time check --------------------------- */
    formEl.addEventListener('focusout', function (event) {
      var field = fieldFromEvent(event);
      if (!field) { return; }

      // Moving between the radios of one group is not leaving the field.
      if (field.type === 'radio' && event.relatedTarget &&
          event.relatedTarget.name === field.id) {
        return;
      }
      check(field, { announceFix: false });
    });

    /* --- typing: clear an error as soon as it is fixed ------------ */
    formEl.addEventListener('input', function (event) {
      var field = fieldFromEvent(event);
      if (!field || touched[field.id] !== true) { return; }
      check(field, { announceFix: true });
    });

    /* --- choosing: selects, radios and checkboxes check at once --- */
    formEl.addEventListener('change', function (event) {
      var field = fieldFromEvent(event);
      if (!field) { return; }
      if (field.type === 'dropdown' || field.type === 'radio' || field.type === 'checkbox') {
        check(field, { announceFix: true });
      }
    });

    /* --- submit --------------------------------------------------- */
    formEl.addEventListener('submit', function (event) {
      // Everything happens in the page; the form never navigates.
      event.preventDefault();

      removeSummary(formEl);
      removeSuccess(formEl);

      var problems = validateAll(fields, formEl);
      problems.forEach(function (problem) { touched[problem.field.id] = true; });

      if (problems.length) {
        // Placed after the form's heading, so the summary is read and seen
        // in the context of the form it belongs to rather than ahead of it.
        var summary = buildSummary(problems, formEl);
        var header = formEl.querySelector('.gen-form__header');
        formEl.insertBefore(summary, header ? header.nextSibling : formEl.firstChild);
        a11y.focusElement(summary);
        return;
      }

      fields.forEach(function (field) { touched[field.id] = false; });
      showSuccess(formEl, fields);
    });
  }

  /* ------------------------------------------------------------------ *
   * A successful submit
   * ------------------------------------------------------------------ */

  function displayValue(field, value) {
    if (field.type === 'checkbox') { return value ? 'Yes' : 'No'; }
    if (!String(value).length) { return 'Not answered'; }

    if (field.type === 'dropdown' || field.type === 'radio') {
      for (var i = 0; i < field.options.length; i += 1) {
        if (field.options[i].value === value) { return field.options[i].label; }
      }
    }
    return String(value);
  }

  function showSuccess(formEl, fields) {
    var rows = [];
    fields.forEach(function (field) {
      var value = readValue(field, formEl);
      rows.push(dom.el('dt', null, field.label));
      rows.push(dom.el('dd', null, displayValue(field, value)));
    });

    var panel = dom.el('div', { class: 'form-success', tabindex: '-1' }, [
      dom.el('h3', { class: 'form-success__title' }, 'Form submitted successfully'),
      dom.el('p', { class: 'form-success__body' },
        'Every field passed validation. This build has no server, so the values ' +
        'collected are listed below instead of being sent anywhere.'),
      rows.length ? dom.el('dl', { class: 'form-success__data' }, rows) : null
    ]);

    formEl.parentNode.insertBefore(panel, formEl);
    a11y.focusElement(panel);
  }

  return {
    validateField: validateField,
    validateAll: validateAll,
    readValue: readValue,
    setFieldError: setFieldError,
    clearAllErrors: clearAllErrors,
    compilePattern: compilePattern,
    attach: attach
  };
})();
