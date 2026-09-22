# Accessibility Audit

**Inclusive Smart Form Builder, PBL 10, Web Technologies, Woxsen University**

This is the milestone-5 deliverable: the generated form tested with keyboard-only
navigation and with browser audit tooling, and the results written down, including the
things the tooling cannot tell you.

---

## 1. Summary

| Method | Scope | Result |
| --- | --- | --- |
| Lighthouse 13.5.0 (Chrome 153, headless) | The whole page, mobile **and** desktop emulation | **Accessibility 100 in both** · Best Practices 100 · SEO 100 |
| Lighthouse accessibility audits | 30 applicable | **30 passed, 0 failed** (10 further audits are manual-only, 36 not applicable) |
| axe-core 4.13.0, WCAG 2.0/2.1/2.2 A + AA + best practice | 5 UI states | **0 violations**, 42 rules exercised |
| Tab-order enumeration in Chrome | Whole interface | 71 stops, **0 elements with a positive `tabindex`**, no orphaned focus |
| Responsive measurement | 9 widths x 3 states | No horizontal scroll at any width down to 320px; no target under 24px |
| Keyboard behaviour | 22 interactions | Every one reaches its target; focus never lands on `<body>` |
| Regression suite | 144 assertions, 3 suites | All passing |

Four defects were found by this testing and fixed. They are listed in section 7, because
an audit that reports only successes is not an audit.

---

## 2. Lighthouse

**Run:** Lighthouse 13.5.0, headless Chrome 153, against the project served over local
HTTP, with the sample seven-field registration form in the preview. Run twice: once under
Lighthouse's default mobile emulation and once under its desktop preset. **Both score 100
for accessibility, with 30 audits passed and none failed.**

The full report is saved as **[lighthouse-report.html](lighthouse-report.html)**. Open it
in a browser to see every audit.

### Scores

```
  Accessibility     100
  Best Practices    100
  SEO               100
```

### The 30 accessibility audits that passed

```
aria-allowed-attr            aria-conditional-attr        aria-deprecated-role
aria-hidden-body             aria-hidden-focus            aria-prohibited-attr
aria-required-attr           aria-required-children       aria-required-parent
aria-roles                   aria-valid-attr              aria-valid-attr-value
autocomplete-valid           button-name                  color-contrast
document-title               heading-order                html-has-lang
html-lang-valid              label                        label-content-name-mismatch
landmark-one-main            link-name                    list
listitem                     meta-viewport                select-name
skip-link                    tabindex                     target-size
```

The ones that matter most for this project:

- **`label`**: every form control has an associated label. This is the audit the whole
  rendering engine exists to satisfy.
- **`color-contrast`**: every text/background pair in the palette meets 4.5:1. Verified by
  a real browser with real computed styles, which is why this rule was left to Lighthouse
  rather than axe-in-jsdom.
- **`label-content-name-mismatch`**: visible text is contained in the accessible name
  (WCAG 2.5.3). This one initially *failed*; see section 7.
- **`aria-prohibited-attr`**: no ARIA attribute is used on a role that forbids it. Also
  initially a problem; see section 7.
- **`target-size`**: interactive targets are large enough (WCAG 2.2, 2.5.8).
- **`aria-required-children` / `aria-required-parent`**: the `role="radiogroup"` on the
  fieldset is structurally valid, with its radios as children.

Performance was not an objective of this PBL and is not claimed here. The page loads three
stylesheets and ten scripts from disk with no network requests, no images and no fonts.

---

## 3. axe-core

Lighthouse audits a page as it loads. That is a real limitation for a form: the loaded
state has no errors in it, so none of the error-handling markup (the summary, the inline
messages, `aria-invalid="true"`) is ever examined.

So axe-core was also run directly against the live DOM in five states, via
`tests/test-axe.js`:

| # | State | Rules passed | Violations |
| --- | --- | --- | --- |
| 1 | Builder as it loads, sample form in the preview | 42 | **0** |
| 2 | **After a failed submit**, with the error summary and five inline messages on screen, five controls marked invalid | 42 | **0** |
| 3 | All seven field types at once, high contrast and large text both on | 42 | **0** |
| 4 | JSON export panel open | 41 | **0** |
| 5 | Checks panel open | 41 | **0** |

Rule set: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`.

### Rules exercised

```
aria-allowed-attr              aria-allowed-role             aria-conditional-attr
aria-deprecated-role           aria-hidden-body              aria-hidden-focus
aria-prohibited-attr           aria-required-attr            aria-required-children
aria-required-parent           aria-roles                    aria-valid-attr
aria-valid-attr-value          autocomplete-valid            button-name
bypass                         document-title                duplicate-id-aria
empty-heading                  form-field-multiple-labels    heading-order
html-has-lang                  html-lang-valid               label
label-title-only               landmark-banner-is-top-level  landmark-contentinfo-is-top-level
landmark-main-is-top-level     landmark-no-duplicate-banner  landmark-no-duplicate-contentinfo
landmark-no-duplicate-main     landmark-unique               link-name
list                           listitem                      meta-viewport
meta-viewport-large            nested-interactive            region
select-name                    summary-name                  tabindex
```

### Three rules were disabled, and why

`color-contrast`, `target-size` and `scrollable-region-focusable` all require a layout
engine to compute boxes and colours. jsdom has none, so axe cannot evaluate them there and
would report them as "incomplete" rather than as passes. **All three are covered by the
Lighthouse run instead**, in a real browser, where they pass. Disabling them in jsdom is a
statement about the test environment, not a way of avoiding the rules.

Two further items are reported by axe as "needs review" in jsdom and are also artefacts of
the missing layout engine: `landmark-one-main` and `page-has-heading-one`. Lighthouse
confirms `landmark-one-main` passes in Chrome, and the page has exactly one `<h1>`.

---

## 4. Keyboard-only testing

### 4.1 Tab order

Enumerated in headless Chrome by collecting every element that is enabled, rendered, not
inside a `hidden` ancestor, and has a non-negative `tabIndex`, which is what the browser
itself walks.

```
71 tab stops
 0 elements with a positive tabindex
```

The order follows the document, and the document follows the visual layout: skip link →
display-mode toggles → form details → field palette → field list → properties editor →
tab strip → the generated form → footer.

Three things are worth pointing out in that list:

- **The skip link is first.** It is visually hidden until focused, then slides into view.
- **Only one of the four tabs is a stop.** The tab strip uses a roving `tabindex`, so
  <kbd>Tab</kbd> passes over the whole strip in one press and the arrow keys move within
  it, following the ARIA Authoring Practices tab pattern.
- **The three radios of a group are one stop in practice.** The enumeration lists all
  three because each has `tabIndex === 0`, but native radio-group behaviour means
  <kbd>Tab</kbd> enters the group once and the arrow keys move within it.

No element uses a positive `tabindex`, so the tab order cannot diverge from the reading
order. Nothing is reachable by mouse but not by keyboard, and there is no keyboard trap:
every interactive element is a native `<button>`, `<a>`, `<input>`, `<select>`,
`<textarea>` or `<summary>`.

### 4.2 Interaction walkthrough

Each row is an interaction, its expected outcome, and how that outcome is verified. The
"verified by" column names an assertion in `tests/test-behaviour.js` unless stated
otherwise. These are run on every change rather than checked once by hand.

| # | Action | Expected | Verified |
| --- | --- | --- | --- |
| 1 | <kbd>Tab</kbd> on a fresh page | Skip link appears and is first | Tab-order enumeration |
| 2 | Activate a palette button | Field added; **focus stays on the palette button** so it can be pressed again | `focus stayed on the palette button for repeat adds` |
| 3 | Same | The new field opens in the properties editor | `new field opened in the editor` |
| 4 | Same | The preview gains the field | `preview grew` |
| 5 | Activate a row's "move down" | Field moves; **focus follows it** to the same button in its new position | `focus followed the moved field` |
| 6 | <kbd>Alt</kbd>+<kbd>↑</kbd> inside a row | Field moves up one position | `Alt+ArrowUp moved it back` |
| 7 | Activate "move up" on the first row | Button is disabled, nothing happens | `first row up button disabled` (smoke) |
| 8 | Activate a row's "remove" | Field removed; **focus moves to the row that replaced it**, never to `<body>` | `focus moved to a real element, not the body` |
| 9 | Same | An Undo button appears and is announced | `undo bar shown` |
| 10 | Activate Undo | Field returns **to its original index**, focus moves to it | `restored to its original position`, `focus moved to the restored row` |
| 11 | Type in the Label box | Row label, preview label and form all update live | `label change reached the preview`, `… the field list` |
| 12 | Same | **The editor does not rebuild**, so the caret is not thrown to the end | `editor caret box was not rebuilt` |
| 13 | Same | Anything typed into the preview survives the rebuild | `preview kept the typed value` |
| 14 | <kbd>→</kbd> on the tab strip | Next tab selected, focused, panel swapped | `ArrowRight selects the next tab`, `… moves focus too` |
| 15 | <kbd>End</kbd> then <kbd>→</kbd> | Jumps to last tab, then wraps to the first | `End jumps to the last tab`, `arrow keys wrap around` |
| 16 | Submit the form empty | Error summary appears **after the form heading** and takes focus | `summary received focus` |
| 17 | Same | One link per failing field | `one link per required field (5)` |
| 18 | Activate a summary link | Focus moves into the named field | `clicking the email link focuses the email input` |
| 19 | Same, for a radio group | Focus moves to the **first radio**, not the group | `radio link focuses the first radio in the group` |
| 20 | Leave a field with bad input | Inline message appears, `aria-invalid="true"`, **nothing is announced** | `bad email rejected on blur` |
| 21 | Correct it while typing | Message clears immediately and the fix is announced | `error clears mid-typing once fixed` |
| 22 | Submit a valid form | Success panel appears and takes focus | `success panel received focus` |

### 4.3 What this does not cover

No screen reader was used. The ARIA here follows the WAI-ARIA Authoring Practices and is
verified structurally, but structural correctness is not the same as a good listening
experience. The announcement choices described in `REPORT.md` section 7.4, particularly
staying silent on blur and speaking on correction, are reasoned, not measured, and are
the first thing that should be re-examined with NVDA and VoiceOver.

---

## 5. Responsive testing

Reflow (WCAG 1.4.10) says content must work at 320 CSS pixels wide without requiring
horizontal scrolling. That is not a separate concern from accessibility. It is the same
criterion that covers someone zoomed to 400% on a laptop.

Each width below was loaded in a same-origin iframe in Chrome and measured with real
computed geometry, in three states: as loaded, with a failed submit on screen, and with
large text and high contrast both switched on.

| Width | Represents | Layout | Result in all three states |
| --- | --- | --- | --- |
| 320 | Smallest phone / 400% zoom | 1 column | No horizontal scroll, nothing outside the viewport |
| 360 | Android baseline | 1 column | Clean |
| 390 | iPhone 14 | 1 column | Clean |
| 414 | Large phone | 1 column | Clean |
| 600 | Small tablet, portrait | 1 column | Clean |
| 768 | iPad portrait | 1 column | Clean |
| 834 | iPad Air | 1 column | Clean |
| 1024 | Tablet landscape / small laptop | 2 columns | Clean |
| 1366 | Laptop | 3 columns | Clean |
| 1680+ | Desktop | 3 columns, centred | Clean |

27 measurements in total (9 widths × 3 states). In every one:

- `document.scrollWidth` equals the viewport width, so there is **no horizontal page scroll anywhere**
- no element extends past the right edge
- no interactive target is smaller than 24 × 24 CSS pixels (WCAG 2.5.8)

Lighthouse was also run under both its mobile emulation (the default, a throttled Moto
G Power) and its desktop preset. **Accessibility scores 100 in both.**

### What changes at each breakpoint

- **1200px**: the three panels become two columns, with the generated form spanning
  the full width beneath.
- **800px**: a single column; the panels stack in their document order, so the reading
  order and the focus order stay identical to the visual order.
- **620px**: the tab labels shrink.
- **560px**: field rows wrap so the label takes a full line and its four controls take
  the next, the two length boxes stop sharing a row, the submit button goes full width,
  and the padding tightens.
- **420px**: the tab strip becomes a 2 x 2 grid. A sideways-scrolling strip would have
  put the Checks tab somewhere nobody would find it; this keeps all four reachable.
- **380px**: the field palette drops to one column.
- **`pointer: coarse`** (any touch device, at any width): icon buttons grow from 30px to
  44px, and the tabs and pills gain padding to match. This is keyed off the input device
  rather than the screen width, so a touchscreen laptop gets the larger targets too.

---

## 6. WCAG success criteria addressed

| Criterion | Level | How |
| --- | --- | --- |
| 1.3.1 Info and Relationships | A | Real `<label for>`, `<fieldset>`/`<legend>`, `<ol>` for the ordered field list, headings in order |
| 1.3.5 Identify Input Purpose | AA | `autocomplete` tokens inferred from field type and label (`name`, `email`, `tel`, `postal-code`, …) |
| 1.4.1 Use of Colour | A | Every state also carried by an icon, a word, or an ARIA attribute. See the table in `REPORT.md` 7.11 |
| 1.4.3 Contrast (Minimum) | AA | Token pairs chosen against 4.5:1; confirmed by Lighthouse `color-contrast` |
| 1.4.4 Resize Text | AA | All sizes in `rem`; the large-text mode scales the root, plus a dedicated toggle |
| 1.4.10 Reflow | AA | No horizontal scrolling at 320px, verified in three display states. See section 5 |
| 2.1.1 Keyboard | A | Native controls throughout; 71 tab stops; no mouse-only affordance |
| 2.1.2 No Keyboard Trap | A | No custom focus containment anywhere |
| 2.3.3 Animation from Interactions | AAA | `prefers-reduced-motion` honoured globally |
| 2.4.1 Bypass Blocks | A | Skip link to `<main>` |
| 2.4.3 Focus Order | A | Document order matches visual order; no positive `tabindex` |
| 2.4.6 Headings and Labels | AA | Descriptive panel headings; labels describe purpose |
| 2.4.7 Focus Visible | AA | One high-contrast 3px ring, with a `:focus` fallback where `:focus-visible` is unsupported |
| 2.5.3 Label in Name | A | Accessible names extend the visible text rather than replacing it |
| 2.5.8 Target Size (Minimum) | AA (2.2) | Controls at least 24px; form inputs 44px tall |
| 3.2.2 On Input | A | No control changes context on its own; nothing auto-submits |
| 3.3.1 Error Identification | A | Errors in text, `aria-invalid`, linked by `aria-describedby` |
| 3.3.2 Labels or Instructions | A | Every field labelled; help text linked; required state marked visibly and programmatically |
| 3.3.3 Error Suggestion | AA | Every message states the expected format, not just that something is wrong |
| 3.3.4 Error Prevention | AA | Undo for field deletion; a confirmation before clear-all and reset |
| 4.1.2 Name, Role, Value | A | Correct roles; `aria-pressed`, `aria-selected`, `aria-required`, `aria-invalid` maintained in step with state |
| 4.1.3 Status Messages | AA | One polite live region for builder actions; the error summary announced via focus |

---

## 7. Defects found by this testing, and fixed

An audit is only worth reading if it changed something.

**1. The radio group was never marked invalid.**
`setFieldError()` was setting `aria-invalid` on the elements returned by the *value*
lookup, which for a radio group is the radio inputs, while the element carrying the
group's ARIA state is the fieldset. A required radio group left empty therefore looked
invalid (its message appeared) but never reported itself as invalid.
*Fix:* separated "which element holds the value" from "which element holds the invalid
state", and put `aria-invalid` on the group only, not on each radio, which would make a
screen reader say "invalid" on every option as the user arrows through them.
*Found by:* an assertion in `test-behaviour.js`.

**2. A too-short phone number produced the wrong message.**
The phone pattern encoded both the allowed characters and a length range, so `12345`
failed the regular expression and was reported as *"Enter a phone number using digits,
spaces, brackets or a leading plus sign"*, describing a format problem the user did not
have.
*Fix:* the pattern now describes only the character set; the digit count is a separate
check with its own message: *"Enter a phone number with 7 to 15 digits. You have entered
5."*
*Found by:* an assertion in `test-behaviour.js`.

**3. `label-content-name-mismatch`, WCAG 2.5.3 Label in Name.**
Each field row's button had a tidy `aria-label` of
`"Edit Full name, Short text, required, field 1 of 7"`. Because `aria-label` *replaces*
the name rather than extending it, the visible text was no longer contained in the
accessible name, so a speech-input user saying "click Full name" would be addressing a
button no longer called that.
*Fix:* removed the `aria-label` and built the name from the visible spans plus visually
hidden text before and after, so the visible text is contained by construction.
*Found by:* Lighthouse.

**4. `aria-labelledby` on an element that prohibits it.**
The error summary was a plain `<div>` with `tabindex="-1"` and `aria-labelledby` pointing
at its heading. A `<div>` with no role resolves to `role="generic"`, on which ARIA
prohibits naming, so the heading was silently dropped from the accessible name.
*Fix:* gave the summary `role="group"`, which legitimately carries a name.
*Found by:* axe-core, in the post-submit state that Lighthouse never reaches.

---

## 8. Reproducing all of this

### Lighthouse

```
python -m http.server 8000          # Lighthouse needs http, not file://
npx lighthouse http://127.0.0.1:8000/index.html --view
```

Or, without installing anything: open `index.html` in Chrome, then DevTools → Lighthouse →
tick Accessibility → Analyze page load. DevTools → Elements → Accessibility also shows the
computed name, role and description for any control in the generated form, which is the
quickest way to confirm the `aria-describedby` wiring by hand.

### axe-core and the regression suites

```
npm install        # jsdom and axe-core, dev dependencies only
npm test           # all four suites
npm run test:axe   # the five-state axe scan on its own
```

### The keyboard walkthrough

Open `index.html`, put the mouse away, and work through the table in section 4.2.
