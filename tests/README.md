# Tests

These are a verification harness, not part of the application. The builder itself has no
dependencies and runs by opening `index.html`; nothing here is loaded by the page.

## Running them

```
npm install      # jsdom and axe-core, dev dependencies only
npm test
```

Node 18 or newer.

## What each suite covers

| Suite | Assertions | Covers |
| --- | --- | --- |
| `test-smoke.js` | 32 | Boot without errors, the palette and field list render, and the generated form's structure: a `<label for>` on every control, every `aria-describedby` resolving, `aria-required` matching the configuration, the radio group's `fieldset`/`legend`/`radiogroup` wiring, autocomplete tokens, and the JSON and HTML exports |
| `test-behaviour.js` | 78 | The whole interactive surface: submitting empty, the error summary and its focus behaviour, summary links moving focus into the field, per-type validation messages, errors clearing mid-typing, a successful submit, typed values surviving a re-render, reordering by button and by <kbd>Alt</kbd>+arrow, focus after each action, delete and undo, the tab strip's keyboard pattern, the JSON round-trip, the display modes, and clear-all |
| `test-edge.js` | 34 | The awkward cases: a label containing HTML being rendered as text and escaped on export, a custom regular expression that will not compile, a dropdown whose selected option is deleted, duplicate ids, the `localStorage` round-trip, an untitled field, and every field type rendering and validating |
| `test-axe.js` | 5 scans | axe-core against the live DOM in five states, including after a failed submit |

144 assertions in total, plus the five axe scans.

## Notes on the axe run

`test-axe.js` disables three rules that a layout engine is required to evaluate and that
jsdom therefore cannot run: `color-contrast`, `target-size` and
`scrollable-region-focusable`. All three were checked separately by Lighthouse in a real
Chrome, where they pass. See `docs/ACCESSIBILITY-AUDIT.md`.
