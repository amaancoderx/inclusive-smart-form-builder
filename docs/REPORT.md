# Project Report: Inclusive Smart Form Builder

**PBL 10 · Web Technologies · II Year B.Tech · Woxsen University**

---

## 1. Problem statement

Build an accessibility-first, entirely client-side dynamic form tool. A user configures a
form by adding, removing and reordering fields of different types. The tool renders that
configuration into a live form through DOM manipulation, giving every control proper
semantic markup, a real label and the correct ARIA attributes, and validates it in real
time with inline error messages that a screen reader can associate with the field they
belong to. Everything happens in the page, with no reload and no server.

### Why the accessibility framing matters

Accessible form design is no longer an optional polish step. The European Accessibility
Act applies from June 2025, and in India the Rights of Persons with Disabilities Act
already requires accessible digital services. Forms are where inaccessible sites fail
hardest: an unlabelled input is not merely awkward for a screen reader user, it is
unusable, and an error shown only as a red border is invisible to someone who cannot see
the border or cannot distinguish the colour.

The interesting part of this project is therefore not "can JavaScript create an input
element". It is *what the generated markup has to contain* for the resulting form to
actually work for everyone, and what the validation has to do beyond turning things red.

---

## 2. Objectives

1. Design a field-configuration data structure that fully describes a form.
2. Build a configuration panel that adds, removes, reorders and edits fields, usable with
   the mouse or the keyboard alone.
3. Write a rendering engine that builds the form with semantic HTML, correct labels and
   correct ARIA attributes.
4. Implement real-time validation per field type, writing errors into an ARIA-linked
   message region.
5. Test with keyboard-only navigation and an accessibility audit tool, and document it.

Each maps to a milestone in section 9.

---

## 3. Technologies used

| Area | Choice |
| --- | --- |
| Markup | HTML5, semantic sectioning and native form elements |
| Styling | CSS3: custom properties, grid, flexbox, `:focus-visible`, media queries |
| Scripting | Vanilla JavaScript (ES6), no libraries or frameworks |
| Editor | Visual Studio Code |
| Testing | Chrome DevTools Accessibility panel, Lighthouse, axe-core, keyboard-only walkthrough |

No build step, no bundler, no dependencies. The whole project is 14 source files, about
5,100 lines, that run by opening `index.html`.

**One deliberate constraint:** the scripts are classic `<script>` tags rather than ES
modules. ES modules are subject to CORS and are blocked on `file://`, so using them would
have meant the project could not be demonstrated by simply double-clicking the HTML file.
Module separation is instead achieved with the revealing-module pattern, where each file is an
IIFE that attaches one object to a single `ISFB` namespace.

---

## 4. Architecture

```
                 ┌──────────────┐
   palette,      │              │        renderer.js ──▶ live preview
   field list,   │   store.js   │──────▶ exporter.js ──▶ JSON + HTML views
   editor    ───▶│  (the field  │        audit.js    ──▶ checks panel
   (builder.js)  │    array)    │        builder.js  ──▶ field list + editor
                 └──────────────┘
                        │
                        └──▶ localStorage (debounced)
```

`store.js` holds the single source of truth: the form settings, the ordered array of
fields, and which field is open in the editor. Every mutation goes through a function
there, and every mutation notifies subscribers. The preview, the JSON, the HTML, the
checks panel and the field list are all just subscribers. None of them knows the others
exist, and nothing can fall out of step because there is only ever one array.

Subscribers receive a `reason` alongside the state, so they can react proportionately. The
preview rebuilds on any change but ignores `select`, because moving the editor's selection
does not change the form. The properties editor ignores `update`, because rebuilding its
own inputs while the user is typing into them would reset the caret on every keystroke.

---

## 5. The field configuration data structure

A form is `{ form: {...}, fields: [...] }`, and a field is a plain object:

```js
{
  id: 'field-2',              // stable for the session; also the control's DOM id
  type: 'email',              // one of seven supported types
  label: 'Email address',     // the <label> text and the accessible name
  hint: 'We send the joining link here.',
  placeholder: 'name@example.com',
  required: true,
  rule: 'default',            // default | letters | digits | custom
  pattern: '',                // regular expression source, when rule is 'custom'
  patternMessage: '',
  minLength: null,
  maxLength: null,
  prompt: 'Select an option', // the empty first option of a dropdown
  options: [{ label: 'Email', value: 'email' }]
}
```

Three design points are worth calling out.

**The id is the DOM id.** Field ids are generated from a monotonic counter (`field-1`,
`field-2`, …) and the rendered control uses the same string as its `id` attribute.
Everything the ARIA wiring needs (the label's `for`, the hint id, the error id, the radio
option ids) is derived from it. This is why importing a configuration calls
`Schema.reserveId()` to push the counter past any numeric suffix it sees: an imported
`field-9` must never collide with a later generated one.

**The type registry drives the editor.** `schema.js` declares each type with a `supports`
array (`['placeholder', 'hint', 'required', 'rule', 'length']`). The properties editor
shows or hides each row by matching the selected type against a `data-for` attribute in the
markup, so adding a new field type is a matter of adding one object to the registry rather
than editing the editor's logic.

**Export is not a dump of the internal object.** `serialiseField()` strips properties that
do not apply to the field's type, so the exported JSON documents the *form* rather than
the data structure. A checkbox does not export an empty `options` array or a `minLength`
of `null`.

---

## 6. The modules

### 6.1 Form configuration module (`builder.js`)

The palette builds one button per registered type. The field list renders one row per
field, each with a select-and-edit button and four action buttons: move up, move down,
duplicate, remove. They are real `<button>` elements, so keyboard operability is native
rather than reimplemented. Reordering also has a shortcut: <kbd>Alt</kbd>+<kbd>↑</kbd> and
<kbd>Alt</kbd>+<kbd>↓</kbd> move the field your focus is inside.

The hard problem in this module is **focus**. The list is rebuilt from scratch on every
change, which destroys whatever had focus and drops a keyboard user back at the top of the
document. Two mechanisms handle it:

```js
// before a rebuild: remember which control of which row had focus
function captureFocus() {
  var row = document.activeElement.closest('.field-row');
  return row ? { id: row.getAttribute('data-id'),
                 action: document.activeElement.getAttribute('data-action') } : null;
}
```

and after the rebuild, focus is restored to the equivalent button in the same row, with a
fallback, because a "move up" button on a field that is now first is disabled and cannot
take focus.

Deletion is handled separately, because the focused button no longer exists at all. Focus
moves to the row that took the deleted one's place, or to the last row, or to the palette
when the list becomes empty. A deletion also reveals an **Undo** button and announces that
it is there, because deleting a field with several configured choices is easy to do by
accident and expensive to redo (WCAG 3.3.4 Error Prevention).

### 6.2 Dynamic rendering engine (`renderer.js`)

Every field is built with `createElement`, never by assembling an HTML string. The
contract each field is rendered against:

- a real `<label for>`, or a `<legend>` for a group, and never a placeholder standing in
  for a label;
- `aria-required` mirroring the configured required flag;
- `aria-invalid` present from the very first render;
- `aria-describedby` pointing at the help text and at a permanently present error element;
- an `autocomplete` token when the field's purpose can be identified.

The resulting markup for a required email field:

```html
<div class="field field--email" data-field-id="field-2" data-field-type="email">
  <label class="field__label" for="field-2">Email address
    <span class="field__required" aria-hidden="true">(required)</span>
  </label>
  <p class="field__hint" id="field-2-hint">We send the joining link here.</p>
  <input class="field__control" id="field-2" name="field-2" type="email"
         inputmode="email" placeholder="name@example.com" autocomplete="email"
         aria-required="true" aria-invalid="false"
         aria-describedby="field-2-hint field-2-error">
  <p class="field__error" id="field-2-error"></p>
</div>
```

### 6.3 Accessible validation module (`validator.js`)

Split into pure rule functions. `validateField(field, value)` returns
`{ valid, message }` and touches no DOM. Then comes the behaviour that decides when validation
runs and what the user hears.

Per type: presence for everything required; RFC-pragmatic email matching; phone character
set plus a separate 7-to-15 digit count; minimum and maximum length; named rules (letters
only, digits only); and author-supplied custom regular expressions.

### 6.4 Preview and export module (`exporter.js`)

Four tab panels: the live preview, the configuration as JSON, the generated markup as
HTML, and the built-in checks. The HTML view is produced by serialising the very element
the preview renders, so the exported markup cannot drift from what the tool actually
produces. Download gives a complete standalone page with a compact stylesheet embedded.

JSON can be copied, downloaded, pasted back, or loaded from a file. Import is defensive:
every incoming field is rebuilt property by property by `Schema.normaliseField()`, unknown
types are rejected and counted rather than guessed at, and failures produce a sentence
written for a person rather than a stack trace.

### 6.5 Built-in checks (`audit.js`)

Two kinds of check. **Configuration checks** catch authoring mistakes: an empty label, two
fields sharing a label, a dropdown with no choices, a minimum length above the maximum, a
custom pattern that will not compile, a placeholder that merely repeats its label.

**Structural checks** run against the DOM that was actually rendered. They walk the live
form and confirm that every control resolves to an accessible name, that every
`aria-describedby` reference points at an element that exists, and that every
`aria-required` value agrees with the configuration. These assert what the renderer claims
to do rather than trusting it, which is what makes the panel worth reading next to a
Lighthouse score rather than a restatement of it.

---

## 7. Design decisions and why they were made

This is the substance of the project. Each decision below had an alternative that would
have been easier.

### 7.1 The error element is always present and always empty

The obvious approach is to create an error element when validation fails and add
`aria-describedby` at the same time. It is unreliable: some screen readers do not
re-read a description that is added after the control was last focused.

Instead the error element is rendered once, empty, and `aria-describedby` points at it
permanently. An empty element contributes nothing to the accessible description, so the
link costs nothing while the field is valid, and writing text into it is picked up
immediately. `.field__error:empty { display: none }` keeps it out of the visual layout for
free.

### 7.2 `aria-invalid` is the single source of truth for the error state

The red border is a CSS rule reading the attribute:

```css
.field__control[aria-invalid="true"] { border-color: var(--danger); border-width: 2px; }
```

Not a class. If the styling is driven by the same attribute the assistive technology
reads, the visual state and the programmatic state cannot drift apart. You cannot make a
field look invalid without it *being* invalid.

### 7.3 Validation timing: blur raises errors, typing only clears them

Validating on every keystroke means telling someone their email is invalid after they have
typed one character. Validating only on submit means letting them fill in twelve fields
before mentioning the second one was wrong.

The compromise implemented here: a field is validated when focus leaves it, and on submit.
Once a field has failed, and only then, it is re-validated on every keystroke so the error
disappears the moment it is fixed. New errors are never raised mid-typing. A `touched` map
tracks which fields have failed at least once.

### 7.4 What gets announced, and what deliberately does not

Making the error element a live region would announce every error as it appeared, and
would also make screen readers read the message twice, once from the live region and once
as part of the field's description.

So the per-field error element is **not** a live region. Announcements come from three
places instead:

- **On blur:** nothing. Focus has already moved on; interrupting the user in their next
  field is hostile, and the message is waiting for them when they return.
- **On a failed submit:** the error summary takes focus, which is what causes a screen
  reader to read it.
- **On a correction:** a short polite announcement, `"Email address" is now valid.`,
  because the error text silently vanishing is otherwise a non-event for someone who
  cannot see it.

Builder actions (adding, moving, deleting a field) go through one shared polite live
region. That region is cleared and refilled on a timer, because setting it to the same
sentence twice in a row produces no second announcement at all. The text node never
changes.

### 7.5 The error summary takes focus and does not use `role="alert"`

Both mechanisms announce the summary. Using both announces it *twice* on several screen
reader and browser pairings. Moving focus is the more robust of the two, and it has a
second benefit: the summary's links then sit directly in the user's tab path, so a
keyboard user can reach any failing field in one keystroke.

The summary carries `role="group"` with `aria-labelledby` pointing at its heading. This is
not decoration: a plain `<div>` resolves to `role="generic"`, on which ARIA *prohibits*
`aria-labelledby`, so without the role the heading would be dropped from the accessible
name. axe-core flagged exactly this during testing, and `role="group"` is what resolved it.

### 7.6 The visible "(required)" marker is hidden from assistive technology

`aria-required="true"` already conveys the state. If the visible `(required)` text is also
exposed, a screen reader says "Email address required, required". So the marker carries
`aria-hidden="true"` and the attribute does the work for assistive technology.

It is spelled out as the word "(required)" rather than an asterisk, because an asterisk is
a convention that has to be learned and is often announced as "star".

Optional fields are labelled `(optional)` only when the form contains a mix of required and
optional fields. If every field is required the form says so once at the top instead, and
if none are, marking them all would be noise.

### 7.7 Radio groups: `fieldset` + `legend` + `role="radiogroup"`

A radio group's question has to be announced before the options, and a `<fieldset>` with a
`<legend>` is the only reliable native way to tie them together. But a `<fieldset>` maps to
`role="group"`, which does not carry the radio semantics, and the group needs to hold
`aria-required` and `aria-invalid` for the whole question.

The solution: a real `<fieldset>` and `<legend>`, with `role="radiogroup"` on the fieldset
and `aria-labelledby` pointing explicitly at the legend's id, because once the native role
is overridden, the implicit legend-to-fieldset naming can no longer be relied on.

`aria-invalid` goes on the **group**, not on each radio. No single option is invalid; the
unanswered question is. Marking every option would have a screen reader say "invalid" on
each one as the user arrows through them.

### 7.8 `novalidate`, and no `maxlength` attribute

The form carries `novalidate`, which turns off the browser's native validation bubbles.
Those bubbles are inconsistent between browsers, cannot be styled, disappear on their own,
and are not associated with the field in a way the custom error messaging could match.

Similarly, `minLength`/`maxLength` are stored in the configuration and checked in
JavaScript, but never written as a native `maxlength` attribute. Native `maxlength`
silently refuses further typing: it gives no explanation to anyone, and no indication at
all to a screen reader user, who simply finds that the keyboard has stopped working. The
JavaScript check instead says *"Your answer must be 300 characters or fewer. You have
entered 301."*

### 7.9 Error messages are written to be read aloud

A message like `Invalid input` fails WCAG 3.3.3 Error Suggestion. It says there is a
problem without saying how to fix it. Every message here names the expected format:
*"Enter an email address in the format name@example.com."*, *"Enter a phone number with 7
to 15 digits. You have entered 3."*

Labels come in two grammatical shapes, and the messages adapt to both. A label written as
a thing (`Email address`) folds into a sentence, as in *"Enter your email address."* A label
written as a question (`How should we confirm your place?`) does not: *"Enter how should we
confirm your place"* is not English. Question labels are quoted instead, as in *"Select an
answer to “How should we confirm your place?”"*, and length messages switch their subject
to "Your answer". The checkbox message names the box it refers to, so an entry in the
error summary is unambiguous when a form has several checkboxes.

### 7.10 Accessible names are built from visible text, never from `aria-label`

The field list's row buttons show the label, the type and the required state. The first
implementation gave them a tidy `aria-label` of
`"Edit Full name, Short text, required, field 1 of 7"`. Lighthouse flagged it: the visible
text was no longer contained in the accessible name, which breaks WCAG 2.5.3 Label in Name
and means a speech-input user saying "click Full name" addresses a button that is no longer
called that.

The fix was to stop replacing the name and start extending it. The visible spans stay, and
visually hidden spans add "Edit" before and ", field 1 of 7" after. The name now contains
the visible text by construction. Icon-only buttons keep `aria-label`, which is correct,
since they have no visible text to contradict.

### 7.11 Colour is never the only signal

Every state is carried by something other than colour (WCAG 1.4.1):

| State | Colour | Also carried by |
| --- | --- | --- |
| Field has an error | red border and text | ⚠ icon, bold message text, `aria-invalid` |
| Field is required | red marker | the word "(required)", `aria-required` |
| Tab is selected | blue text | a 2px underline, `aria-selected` |
| Display mode is on | filled pill | a ✓ glyph, `aria-pressed` |
| Field row is selected | tinted background | a 3px left bar, `aria-pressed` |
| Check result | green / amber / red | ✓ △ ✕ glyph plus a visually hidden "Passed:" / "Warning:" / "Problem:" prefix |

### 7.12 Three display modes, each one attribute

`data-theme`, `data-contrast` and `data-text-size` on `<html>`. Each starts by following
the operating system, through `prefers-color-scheme` and `prefers-contrast`, and switches to the
user's own choice once they make one, which is then remembered. High contrast is a separate
axis from dark mode rather than a fourth theme, so it layers onto either. Large text works
because every size in the stylesheet is in `rem`, so one change to the root font size
scales the whole interface rather than just the body copy.

`prefers-reduced-motion` is honoured globally.

### 7.13 Nothing is ever built from an HTML string

`dom.el()` creates elements and sets attributes one at a time; there is no `innerHTML`
anywhere in the project. This is partly cleanliness and partly correctness: a label someone
types can then only ever become text. Typing `<img src=x onerror="alert(1)">` as a field
label renders those characters literally, and the HTML export escapes them. This is
verified by a test.

---

## 8. Testing

Summarised here; the full results, the keyboard walkthrough and reproduction instructions
are in **[ACCESSIBILITY-AUDIT.md](ACCESSIBILITY-AUDIT.md)**.

| Tool | Result |
| --- | --- |
| Lighthouse (Chrome 153, Lighthouse 13.5) | **Accessibility 100** under both mobile and desktop emulation. 30 audits passed, 0 failed |
| axe-core 4.13, WCAG 2.0/2.1/2.2 A + AA + best practice | **0 violations across 5 UI states**, including after a failed submit |
| Keyboard-only walkthrough | 22 steps, every function reachable, no focus trap, no lost focus |
| Responsive measurement | 9 widths (320 to 1366px) x 3 display states: no horizontal scroll, no target under 24px |
| Automated regression suite | 144 assertions across 3 suites, all passing |

Four defects were found by this testing and fixed rather than documented around. Two came
from the regression suite:

1. **The radio group was never marked invalid.** `aria-invalid` was being set on the radio
   inputs returned by the value lookup, while the element that carries the group's ARIA
   state is the fieldset. Caught by an assertion, fixed by separating "which element holds
   the value" from "which element holds the invalid state".
2. **A too-short phone number produced the wrong message.** The phone pattern encoded both
   the allowed characters and a length range, so `12345` failed on length but was reported
   as a format problem. The pattern now describes only the character set, and the digit
   count is a separate check with its own message.

and two came from the audit tools: Lighthouse caught the Label-in-Name problem described in
7.10, and axe-core caught the `aria-labelledby`-on-`role=generic` problem described in 7.5,
in the post-submit state that Lighthouse never reaches on its own. All four are written up
in [ACCESSIBILITY-AUDIT.md](ACCESSIBILITY-AUDIT.md) section 6.

---

## 9. Milestones

| Milestone | Where it lives | Status |
| --- | --- | --- |
| Design the field-configuration data structure | `js/schema.js`, `js/store.js`, section 5 | Done |
| Build the configuration panel with add / remove / reorder | `js/builder.js`, section 6.1 | Done |
| Implement the dynamic rendering engine with labels and ARIA | `js/renderer.js`, section 6.2 | Done |
| Implement real-time validation with ARIA-linked errors | `js/validator.js`, sections 6.3 and 7.1 to 7.9 | Done |
| Test with keyboard and an audit tool, and document it | `docs/ACCESSIBILITY-AUDIT.md` | Done |

## 10. Expected outcomes

| Outcome | Evidence |
| --- | --- |
| A working builder that generates genuinely accessible forms | The tool runs from `index.html`; the generated form scores 100 in Lighthouse and 0 axe violations |
| Correct DOM manipulation together with ARIA, not just visual styling | `renderer.js`; the HTML tab shows the produced markup with every attribute |
| Real-time inline validation programmatically associated with its field | `validator.js`; `aria-describedby` → error element, `aria-invalid` on the control |
| A report including an accessibility audit and an explanation of design choices | This document, section 7, plus `ACCESSIBILITY-AUDIT.md` and `lighthouse-report.html` |

## 11. Stretch goals

Both optional goals are implemented:

- **High-contrast and large-text modes**, as dynamic attribute changes on `<html>`
  (section 7.12), plus a dark theme that was not asked for.
- **JSON export of the field configuration**, with copy, download, paste-back and
  load-from-file, so a form can be saved and reloaded later. The configuration is also
  persisted to `localStorage` so work in progress survives a reload.

Beyond the brief: an HTML export of the generated markup, a standalone-page download, the
built-in accessibility checks panel, and undo for field deletion.

---

## 12. Limitations and what would come next

- **No real screen reader test.** The ARIA here follows the WAI-ARIA Authoring Practices
  and is verified structurally by axe-core and Lighthouse, but structural correctness is
  not the same as a good experience. Running the generated form through NVDA and VoiceOver
  is the honest next step, and some of the announcement choices in 7.4 would likely be
  tuned as a result.
- **Automated tools cover roughly a third of WCAG.** A 100 Lighthouse score means no
  *detectable* failures, not that the form is accessible. The keyboard walkthrough and the
  design decisions in section 7 are doing more of the work than the score is.
- **Choice values are derived from choice labels.** It keeps the editor uncluttered, but
  renaming a choice changes its stored value, so a previously selected answer can be
  dropped. The renderer handles this safely; a separate value field would remove the
  problem.
- **No conditional logic.** Fields cannot yet depend on the answer to another field, which
  is where the ARIA gets considerably harder. Revealing a field is a change a screen
  reader user has to be told about.
- **Contrast is verified for the palette, not for arbitrary content.** The token pairs were
  chosen against WCAG ratios and confirmed by Lighthouse, but nothing stops a future theme
  from breaking them; a contrast assertion in the test suite would catch that.
