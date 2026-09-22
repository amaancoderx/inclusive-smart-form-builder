<div align="center">

<h1>Inclusive Smart Form Builder</h1>

<div align="center">
    <strong>An accessibility-first, client-side form builder. Configure fields, render them
    with correct labels and ARIA attributes, and validate them in real time with
    screen-reader-friendly inline errors.
    </strong>
    <br />
    <br />
</div>

[![WCAG 2.2](https://img.shields.io/badge/WCAG%202.2-AA-0a7c42?style=flat-square)](docs/ACCESSIBILITY-AUDIT.md)
[![Lighthouse Accessibility](https://img.shields.io/badge/Lighthouse%20a11y-100-0a7c42?style=flat-square)](docs/ACCESSIBILITY-AUDIT.md#2-lighthouse)
[![axe-core](https://img.shields.io/badge/axe--core-0%20violations-0a7c42?style=flat-square)](docs/ACCESSIBILITY-AUDIT.md#3-axe-core)
[![Vanilla JS](https://img.shields.io/badge/vanilla-JavaScript%20ES6-f7df1e?style=flat-square)](#tech-stack)
[![Dependencies](https://img.shields.io/badge/runtime%20dependencies-0-blue?style=flat-square)](package.json)
[![Tests](https://img.shields.io/badge/tests-144%20passing-blue?style=flat-square)](tests/)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

<br />

**[Quick start](#quick-start)** &nbsp;&middot;&nbsp;
**[Features](#features)** &nbsp;&middot;&nbsp;
**[Accessibility](#accessibility)** &nbsp;&middot;&nbsp;
**[Project report](docs/REPORT.md)** &nbsp;&middot;&nbsp;
**[Audit results](docs/ACCESSIBILITY-AUDIT.md)**

<br />

**Mohammed Amaan Khan** &nbsp;&middot;&nbsp; 25WU0101075 &nbsp;&middot;&nbsp; CSE Rhinos

Woxsen University &nbsp;&middot;&nbsp; PBL 10 &nbsp;&middot;&nbsp; Web Technologies &nbsp;&middot;&nbsp; II Year B.Tech

</div>

<br />

## Table of Contents

| | | |
|---|---|---|
| [Overview](#overview) | [Accessibility](#accessibility) | [Project structure](#project-structure) |
| [Quick start](#quick-start) | [Responsive design](#responsive-design) | [Data structure](#data-structure) |
| [Features](#features) | [Verification](#verification) | [Documentation](#documentation) |
| [Tech stack](#tech-stack) | [Keyboard reference](#keyboard-reference) | [Author](#author) |

<br />

## Overview

Forms are where inaccessible websites fail hardest. An unlabelled input is not merely
awkward for someone using a screen reader, it is unusable, and an error shown only as a red
border is invisible to anyone who cannot see the border or tell the colour apart.

This project is a form builder that treats that as the hard problem. You add fields to a
list, and a rendering engine turns that list into a live form built entirely through DOM
manipulation, giving every control a real label, the right ARIA attributes, and validation
whose error messages are programmatically tied to the field they belong to.

Nothing is left to styling alone. Every state is carried by markup first and reinforced with
colour second.

<br />

## Quick start

Open `index.html` in a browser. That is the whole setup.

```bash
git clone https://github.com/amaancoderx/inclusive-smart-form-builder.git
cd inclusive-smart-form-builder
```

Then double-click `index.html`, or serve it over HTTP if you want to run Lighthouse against it:

```bash
python -m http.server 8000
```

| What | Where |
|------|-------|
| The app | `index.html` |
| Served locally | `http://127.0.0.1:8000/index.html` |
| Project report | [`docs/REPORT.md`](docs/REPORT.md) |
| Audit results | [`docs/ACCESSIBILITY-AUDIT.md`](docs/ACCESSIBILITY-AUDIT.md) |
| Lighthouse run | [`docs/lighthouse-report.html`](docs/lighthouse-report.html) |

There is no build step, no bundler and no runtime dependency. The scripts are loaded as
classic `<script>` tags rather than ES modules on purpose, because ES modules are blocked by
CORS on `file://` and would have forced a local server just to view the page.

Tested in Chrome, Edge and Firefox.

<br />

## Features

<details open>
<summary><h3 style="display:inline">Form configuration</h3></summary>

- **Seven field types** (short text, email, phone, long text, dropdown, radio group, checkbox)
- **Reorder** by button or with <kbd>Alt</kbd> and the arrow keys
- **Duplicate and delete**, with undo after a delete
- **Properties editor** for label, help text, placeholder, required state, validation rule, length limits and choices
- **Focus is never lost.** The list is rebuilt on every change, so each rebuild records which control was focused and restores it afterwards

</details>

<details open>
<summary><h3 style="display:inline">Dynamic rendering engine</h3></summary>

Every field is built with `createElement`, never by assembling an HTML string. The contract
each field is rendered against:

- a real `<label for>`, or a `<legend>` for a group, and never a placeholder standing in for a label
- `aria-required` mirroring the configured required flag
- `aria-invalid` present from the first render, so the error state is a change of value rather than an attribute appearing from nowhere
- `aria-describedby` pointing at the help text and at a permanently present error element
- an `autocomplete` token when the field's purpose can be identified (WCAG 1.3.5)

</details>

<details open>
<summary><h3 style="display:inline">Accessible validation</h3></summary>

- Validation on blur and on submit, with a field re-checked on every keystroke once it has failed, so the error clears the moment it is fixed
- New errors are never raised mid-typing, because nobody wants to be told their email is invalid after one character
- An **error summary** on a failed submit that takes focus and links to every field with a problem
- Messages that state the expected format, not just that something is wrong: *"Enter a phone number with 7 to 15 digits. You have entered 3."*
- Messages that adapt to the label's grammar, because *"Enter how should we confirm your place"* is not English

</details>

<details open>
<summary><h3 style="display:inline">Preview and export</h3></summary>

- **Live preview** that rebuilds on every configuration change, carrying across anything already typed into it
- **JSON export** with copy, download, paste-back and load-from-file
- **HTML export** of the generated markup, including every ARIA attribute, downloadable as a complete standalone page
- **Built-in checks** that audit the configuration and then inspect the rendered DOM to confirm the accessible names, descriptions and required states really are there

</details>

<details open>
<summary><h3 style="display:inline">Display modes</h3></summary>

- **Dark theme**
- **High contrast**, as a separate axis that layers on top of either theme
- **Large text**, which scales the whole interface because every size is in `rem`

Each one follows the operating system setting until you override it, and the override is
remembered. `prefers-reduced-motion` is honoured globally.

</details>

<br />

## Tech stack

| Area | Choice |
|------|--------|
| Markup | HTML5, semantic sectioning and native form elements |
| Styling | CSS3 with custom properties, grid, flexbox, `:focus-visible` and media queries |
| Scripting | Vanilla JavaScript (ES6), no libraries or frameworks |
| Editor | Visual Studio Code |
| Testing | Chrome DevTools Accessibility panel, Lighthouse, axe-core, jsdom |

About 5,300 lines across 14 source files. Zero runtime dependencies. The only dev
dependencies are `jsdom` and `axe-core`, used by the test suites.

<br />

## Accessibility

This is the point of the project, so the decisions are documented rather than assumed.
[`docs/REPORT.md`](docs/REPORT.md) section 7 explains each one. A few of the less obvious
ones:

<details>
<summary><h3 style="display:inline">The error element is always present and always empty</h3></summary>

Creating an error element only when validation fails, and wiring `aria-describedby` at the
same moment, is unreliable: some screen readers do not re-read a description added after the
control was last focused.

Instead the error element is rendered once, empty, and `aria-describedby` points at it
permanently. An empty element contributes nothing to the accessible description, so the link
costs nothing while the field is valid, and writing text into it is picked up immediately.

</details>

<details>
<summary><h3 style="display:inline">aria-invalid is the single source of truth</h3></summary>

The red border is a CSS rule reading the attribute, not a class:

```css
.field__control[aria-invalid="true"] { border-color: var(--danger); border-width: 2px; }
```

If the styling is driven by the same attribute assistive technology reads, the visual state
and the programmatic state cannot drift apart. You cannot make a field look invalid without
it being invalid.

</details>

<details>
<summary><h3 style="display:inline">What gets announced, and what deliberately does not</h3></summary>

Making the error element a live region would announce every error as it appeared, and would
also make screen readers read each message twice, once from the live region and once as part
of the field's description.

So the per-field error element is **not** a live region. Announcements come from three places
instead:

- **On blur:** nothing. Focus has already moved on, and interrupting someone in their next field is hostile.
- **On a failed submit:** the error summary takes focus, which is what causes a screen reader to read it.
- **On a correction:** a short polite announcement, because the error text silently vanishing is otherwise a non-event for someone who cannot see it.

</details>

<details>
<summary><h3 style="display:inline">No maxlength attribute, and no native validation bubbles</h3></summary>

The form carries `novalidate`. Native bubbles are inconsistent between browsers, cannot be
styled, disappear on their own, and are not associated with the field in a way the custom
messaging could match.

Length limits are checked in JavaScript and never written as a native `maxlength`. Native
`maxlength` silently refuses further typing, which gives no explanation to anyone and no
indication at all to a screen reader user, who simply finds that the keyboard has stopped
working.

</details>

<details>
<summary><h3 style="display:inline">Colour is never the only signal</h3></summary>

| State | Colour | Also carried by |
|-------|--------|-----------------|
| Field has an error | red border and text | warning icon, bold message, `aria-invalid` |
| Field is required | red marker | the word "(required)", `aria-required` |
| Tab is selected | blue text | a 2px underline, `aria-selected` |
| Display mode is on | filled pill | a check glyph, `aria-pressed` |
| Field row is selected | tinted background | a 3px left bar, `aria-pressed` |
| Check result | green, amber, red | a glyph plus a visually hidden "Passed", "Warning" or "Problem" prefix |

</details>

<br />

## Responsive design

Verified by measurement at nine viewport widths, in three display states each (as loaded,
with a failed submit on screen, and with large text and high contrast both on). No horizontal
page scrolling at any width, nothing outside the viewport, and no interactive target under
24 by 24 pixels.

| Breakpoint | What changes |
|-----------|--------------|
| 1200px | Three panels become two columns |
| 800px | A single column, stacked in document order so reading order and focus order stay identical |
| 620px | Tab labels shrink |
| 560px | Field rows wrap, length boxes stop sharing a row, submit goes full width |
| 420px | The tab strip becomes a 2 by 2 grid, so no tab is hidden behind a sideways scroll |
| 380px | The field palette drops to one column |
| `pointer: coarse` | Icon buttons grow from 30px to 44px on any touch device, at any width |

<br />

## Verification

| Method | Result |
|--------|--------|
| Lighthouse 13.5, mobile and desktop emulation | **Accessibility 100 in both**, 30 audits passed, 0 failed |
| axe-core 4.13, WCAG 2.0 / 2.1 / 2.2 A and AA | **0 violations across 5 UI states**, including after a failed submit |
| Tab-order enumeration in Chrome | 71 stops, 0 elements with a positive `tabindex` |
| Responsive measurement | 9 widths by 3 states, all clean |
| Regression suites | **144 assertions**, all passing |

Automated tools only cover part of WCAG, so a score of 100 means no detectable failures
rather than a guarantee. Four real defects were found by this testing and fixed, and they are
written up in [`docs/ACCESSIBILITY-AUDIT.md`](docs/ACCESSIBILITY-AUDIT.md) section 7.

### Running the tests

The application has no dependencies. The tests do:

```bash
npm install
npm test
```

| Suite | Covers |
|-------|--------|
| `test-smoke.js` | Boot, structure, and the ARIA wiring of the generated form |
| `test-behaviour.js` | Validation, focus management, reordering, undo, tabs, JSON round-trip |
| `test-edge.js` | Escaping, broken patterns, storage, every field type |
| `test-axe.js` | axe-core across five UI states |

<br />

## Keyboard reference

Everything is reachable and operable from the keyboard alone.

| Keys | What happens |
|------|--------------|
| <kbd>Tab</kbd> / <kbd>Shift</kbd> + <kbd>Tab</kbd> | Move through the interface |
| <kbd>Alt</kbd> + <kbd>Up</kbd> / <kbd>Alt</kbd> + <kbd>Down</kbd> | Reorder the field your focus is inside |
| <kbd>Left</kbd> / <kbd>Right</kbd> | Move between the Preview, JSON, HTML and Checks tabs |
| <kbd>Home</kbd> / <kbd>End</kbd> | Jump to the first or last tab |
| <kbd>Enter</kbd> / <kbd>Space</kbd> | Activate any button |

The first <kbd>Tab</kbd> press reveals a "Skip to main content" link.

<br />

## Project structure

```
index.html              markup shell: the three panels, the tab strip, the live region
css/
  tokens.css            design tokens, the three display modes, reset, focus, utilities
  app.css               the builder shell: header, panels, palette, field list, tabs
  form.css              the generated form, its error states and the error summary
js/
  dom.js                element construction helpers, nothing here uses innerHTML
  schema.js             field types, validation rules, and the field data structure
  a11y.js               the live-region announcer and the display-mode toggles
  store.js              application state, subscriptions, JSON import and export
  validator.js          the validation rules and the accessible validation behaviour
  renderer.js           the dynamic rendering engine: labels, ARIA, autocomplete
  builder.js            the configuration panel and the field properties editor
  exporter.js           the tab strip, JSON round-trip, HTML serialiser
  audit.js              the built-in configuration and DOM accessibility checks
  main.js               start-up, the sample form, and the reset control
docs/
  REPORT.md             the project report: design decisions and why they were made
  ACCESSIBILITY-AUDIT.md  keyboard test log, Lighthouse, axe-core, responsive matrix
  lighthouse-report.html  the Lighthouse run itself, openable in a browser
tests/                  verification harness, not loaded by the page
```

<br />

## Data structure

The whole application is driven by one array of plain objects. `store.js` owns it, and every
change notifies its subscribers, which is how the field list, the preview, the JSON, the HTML
and the checks panel stay in step without any of them knowing the others exist.

```js
{
  id: 'field-2',              // stable for the session, and also the control's DOM id
  type: 'email',              // text | email | phone | textarea | dropdown | radio | checkbox
  label: 'Email address',     // becomes the <label> and the accessible name
  hint: 'We send the joining link here.',
  placeholder: 'name@example.com',
  required: true,
  rule: 'default',            // default | letters | digits | custom
  pattern: '',                // a regular expression, when rule is 'custom'
  patternMessage: '',         // what to say when that pattern does not match
  minLength: null,
  maxLength: null,
  prompt: 'Select an option', // the empty first option of a dropdown
  options: [{ label: 'Email', value: 'email' }]
}
```

The generated markup for a required email field:

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

<br />

## Documentation

| Document | What is in it |
|----------|---------------|
| [Project report](docs/REPORT.md) | Problem statement, architecture, data structure, every design decision and the reasoning behind it, milestones, limitations |
| [Accessibility audit](docs/ACCESSIBILITY-AUDIT.md) | Lighthouse and axe-core results, keyboard walkthrough, responsive matrix, WCAG criteria mapping, the defects this testing found |
| [Lighthouse report](docs/lighthouse-report.html) | The raw Lighthouse run, openable in a browser |
| [Test suites](tests/README.md) | What each suite covers and how to run it |

<br />

## A note on the scope of automated testing

Automated tools detect roughly a third of WCAG failures. A Lighthouse score of 100 means no
detectable failures, not that a page is accessible. No screen reader was used in this
project: the ARIA follows the WAI-ARIA Authoring Practices and is verified structurally, but
structural correctness is not the same as a good listening experience. Running the generated
form through NVDA and VoiceOver is the honest next step.

That limitation, and four others, are recorded in
[`docs/REPORT.md`](docs/REPORT.md) section 12 rather than left out.

<br />

## Author

**Mohammed Amaan Khan**

| | |
|---|---|
| Roll number | 25WU0101075 |
| Section | CSE Rhinos |
| Programme | B.Tech Computer Science and Engineering, II Year |
| Institution | Woxsen University, School of Technology |
| GitHub | [@amaancoderx](https://github.com/amaancoderx) |

<br />

## License

[MIT](LICENSE)
