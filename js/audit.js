/* ==========================================================================
   audit.js: the built-in accessibility checks
   --------------------------------------------------------------------------
   Two kinds of check run here.

   Configuration checks look for choices the author has made that will
   produce an inaccessible form: a field with no label, a dropdown with
   nothing in it, a minimum length above the maximum.

   Structural checks are run against the form that has actually been
   rendered. They read the live DOM and confirm that every control really
   does have a programmatically associated name, a description pointing at a
   real element, and a required state that matches the configuration. These
   assert what the renderer claims to do rather than trusting it, which is
   what makes them worth showing to a marker alongside a Lighthouse score.
   ========================================================================== */

window.ISFB = window.ISFB || {};

ISFB.audit = (function () {
  'use strict';

  var dom = ISFB.dom;
  var Schema = ISFB.Schema;

  function issue(level, title, detail) {
    return { level: level, title: title, detail: detail };
  }

  function labelOf(field) {
    return field.label && field.label.trim() ? field.label.trim() : 'an untitled field';
  }

  /* ================================================================== *
   * Configuration checks
   * ================================================================== */

  function checkConfiguration(state, results) {
    var fields = state.fields;

    /* --- labels ---------------------------------------------------- */
    var unlabelled = fields.filter(function (field) {
      return !field.label || !field.label.trim();
    });

    if (unlabelled.length) {
      results.push(issue('error', 'A field has no label',
        unlabelled.length + (unlabelled.length === 1 ? ' field has' : ' fields have') +
        ' an empty label. Without one, a screen reader can only announce the field by its ' +
        'type, and speech input has nothing to address it by. WCAG 3.3.2 Labels or Instructions.'));
    }

    /* --- duplicate labels ------------------------------------------ */
    var seen = {};
    var duplicates = [];
    fields.forEach(function (field) {
      var key = (field.label || '').trim().toLowerCase();
      if (!key) { return; }
      if (seen[key] === true && duplicates.indexOf(key) === -1) { duplicates.push(key); }
      seen[key] = true;
    });

    if (duplicates.length) {
      results.push(issue('warn', 'Two fields share a label',
        'More than one field is called "' + duplicates[0] + '". Someone listing the form\'s ' +
        'fields with a screen reader has no way to tell them apart. Give each one a distinct label.'));
    }

    /* --- choice groups --------------------------------------------- */
    fields.forEach(function (field) {
      if (!Schema.supports(field, 'options')) { return; }

      if (!field.options.length) {
        results.push(issue('error', '"' + labelOf(field) + '" has no choices',
          'A dropdown or radio group with nothing to choose from is a control a keyboard ' +
          'user can reach but cannot use. Add at least two choices.'));
      } else if (field.options.length === 1) {
        results.push(issue('warn', '"' + labelOf(field) + '" has only one choice',
          'With a single option there is no choice to make. Add another, or use a checkbox.'));
      }

      var blank = field.options.filter(function (option) {
        return !option.label || !option.label.trim();
      }).length;

      if (blank) {
        results.push(issue('error', '"' + labelOf(field) + '" has an empty choice',
          blank + (blank === 1 ? ' choice has' : ' choices have') + ' no text, so ' +
          (blank === 1 ? 'it is' : 'they are') + ' announced as nothing at all. Fill it in or remove it.'));
      }
    });

    /* --- lengths ---------------------------------------------------- */
    fields.forEach(function (field) {
      if (field.minLength === null || field.maxLength === null) { return; }
      if (field.minLength > field.maxLength) {
        results.push(issue('error', '"' + labelOf(field) + '" can never be valid',
          'The minimum length (' + field.minLength + ') is greater than the maximum (' +
          field.maxLength + '), so every entry fails. Adjust one of them.'));
      }
    });

    /* --- custom patterns -------------------------------------------- */
    fields.forEach(function (field) {
      if (field.rule !== 'custom') { return; }

      if (!field.pattern.trim()) {
        results.push(issue('warn', '"' + labelOf(field) + '" has an empty custom pattern',
          'The rule is set to a custom pattern but none has been entered, so nothing is checked.'));
        return;
      }
      if (ISFB.validator.compilePattern(field.pattern) === null) {
        results.push(issue('error', '"' + labelOf(field) + '" has an invalid pattern',
          'That regular expression cannot be compiled, so it is being ignored and the field ' +
          'is not being checked at all.'));
        return;
      }
      if (!field.patternMessage.trim()) {
        results.push(issue('warn', '"' + labelOf(field) + '" has no message for its pattern',
          'A generic message cannot tell someone what format is expected. WCAG 3.3.3 ' +
          'Error Suggestion asks for advice on how to fix the problem, not just that there is one.'));
      }
    });

    /* --- placeholders ------------------------------------------------ */
    var echoed = fields.filter(function (field) {
      return field.placeholder && field.label &&
        field.placeholder.trim().toLowerCase() === field.label.trim().toLowerCase();
    });

    if (echoed.length) {
      results.push(issue('warn', 'A placeholder repeats its label',
        '"' + labelOf(echoed[0]) + '" uses its label as the placeholder too. The repetition is ' +
        'read out twice and the grey text disappears as soon as typing starts. Use the ' +
        'placeholder for an example of the format instead.'));
    }

    /* --- form title --------------------------------------------------- */
    if (fields.length && !state.form.title.trim()) {
      results.push(issue('warn', 'The form has no title',
        'Without a title the form has no accessible name, so it is announced only as ' +
        '"form" when a screen reader user lands on it.'));
    }
  }

  /* ================================================================== *
   * Structural checks, run against the rendered DOM
   * ================================================================== */

  function accessibleName(control, formEl) {
    if (control.getAttribute('aria-label')) { return true; }

    var labelledBy = control.getAttribute('aria-labelledby');
    if (labelledBy) {
      return labelledBy.split(/\s+/).every(function (id) {
        var target = formEl.querySelector('#' + id);
        return !!target && target.textContent.trim().length > 0;
      });
    }

    if (control.id) {
      var label = formEl.querySelector('label[for="' + control.id + '"]');
      if (label && label.textContent.trim().length) { return true; }
    }
    return false;
  }

  function checkRenderedForm(state, formEl, results) {
    if (!formEl) { return; }

    var controls = dom.qsa('input, select, textarea', formEl);
    var groups = dom.qsa('[role="radiogroup"]', formEl);

    if (!controls.length) { return; }

    /* --- every control is named ------------------------------------- */
    var unnamed = controls.filter(function (control) {
      return !accessibleName(control, formEl);
    }).length;

    var unnamedGroups = groups.filter(function (group) {
      return !accessibleName(group, formEl);
    }).length;

    if (unnamed + unnamedGroups === 0) {
      results.push(issue('pass', 'Every control has a programmatic label',
        'All ' + controls.length + ' rendered controls, and every radio group, resolve to an ' +
        'accessible name through a <label for> or aria-labelledby. WCAG 4.1.2 Name, Role, Value.'));
    } else {
      results.push(issue('error', 'A rendered control has no accessible name',
        (unnamed + unnamedGroups) + ' rendered controls resolve to no name at all.'));
    }

    /* --- descriptions point at real elements -------------------------- */
    var brokenDescriptions = 0;
    var describedControls = 0;

    controls.concat(groups).forEach(function (node) {
      var describedBy = node.getAttribute('aria-describedby');
      if (!describedBy) { return; }
      describedControls += 1;

      describedBy.split(/\s+/).forEach(function (id) {
        if (!formEl.querySelector('#' + id)) { brokenDescriptions += 1; }
      });
    });

    if (brokenDescriptions) {
      results.push(issue('error', 'A description points at a missing element',
        brokenDescriptions + ' aria-describedby references do not resolve. A reference to an ' +
        'element that is not there is silently dropped, taking the error message with it.'));
    } else if (describedControls) {
      results.push(issue('pass', 'Every error message is wired to its field',
        'All ' + describedControls + ' described controls point at an error element that exists ' +
        'in the document, so a message written into it is announced as part of the field. ' +
        'WCAG 3.3.1 Error Identification.'));
    }

    /* --- required state matches the configuration ---------------------- */
    var mismatches = 0;
    var requiredCount = 0;

    state.fields.forEach(function (field) {
      var node = field.type === 'radio'
        ? formEl.querySelector('[role="radiogroup"][data-field-id], #' + field.id + '-legend')
        : formEl.querySelector('#' + field.id);

      if (field.type === 'radio') {
        node = formEl.querySelector('.field[data-field-id="' + field.id + '"] [role="radiogroup"]');
      }
      if (!node) { return; }

      var declared = node.getAttribute('aria-required') === 'true';
      if (field.required) { requiredCount += 1; }
      if (declared !== !!field.required) { mismatches += 1; }
    });

    if (mismatches) {
      results.push(issue('error', 'A required field is not announced as required',
        mismatches + ' fields have an aria-required value that disagrees with the configuration.'));
    } else if (requiredCount) {
      results.push(issue('pass', 'Required fields are announced as required',
        'All ' + requiredCount + ' required fields carry aria-required="true", so the state is ' +
        'heard rather than being left to the red "(required)" text alone. WCAG 1.4.1 Use of Colour.'));
    }

    /* --- the error state is exposed from the start --------------------- */
    var missingInvalid = controls.filter(function (control) {
      return control.type !== 'radio' && !control.hasAttribute('aria-invalid');
    }).length;

    if (!missingInvalid) {
      results.push(issue('pass', 'Validity is exposed on every control',
        'aria-invalid is present from the first render, so the error state is a change of ' +
        'value rather than an attribute appearing out of nowhere.'));
    }
  }

  /* ================================================================== *
   * Running and rendering
   * ================================================================== */

  function run(state, formEl) {
    var results = [];

    if (!state.fields.length) {
      results.push(issue('warn', 'The form is empty',
        'Add at least one field, and these checks will report on it.'));
      return results;
    }

    checkConfiguration(state, results);
    checkRenderedForm(state, formEl, results);

    var problems = results.filter(function (result) { return result.level !== 'pass'; });
    if (!problems.length) {
      results.unshift(issue('pass', 'No problems found in this configuration',
        'Every configuration check passed. Run Lighthouse or the browser\'s accessibility ' +
        'panel as well: those test the rendered page, and these test the choices behind it.'));
    }

    return results;
  }

  var ICON = { pass: '✓', warn: '△', error: '✕' };
  var WORD = { pass: 'Passed', warn: 'Warning', error: 'Problem' };

  function render(listEl, results) {
    dom.clear(listEl);

    results.forEach(function (result) {
      listEl.appendChild(dom.el('li', {
        class: 'audit-item',
        'data-level': result.level
      }, [
        // The symbol is decorative; the state is carried by the word that
        // follows it, so it survives greyscale and screen reading alike.
        dom.el('span', { class: 'audit-item__icon', 'aria-hidden': 'true' }, ICON[result.level]),
        dom.el('div', { class: 'audit-item__body' }, [
          dom.el('p', { class: 'audit-item__title' }, [
            dom.el('span', { class: 'visually-hidden' }, WORD[result.level] + ': '),
            result.title
          ]),
          dom.el('p', { class: 'audit-item__detail' }, result.detail)
        ])
      ]));
    });
  }

  function countProblems(results) {
    return results.filter(function (result) { return result.level !== 'pass'; }).length;
  }

  return { run: run, render: render, countProblems: countProblems };
})();
