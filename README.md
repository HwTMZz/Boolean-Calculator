# Boolean Calculator — organized JavaScript files

Open `index.html` in a browser. Keep `style.css` and the `scripts/` folder in the same directory as `index.html`.

## Folder structure

```text
boolean_calculator/
├── index.html
├── style.css
└── scripts/
    ├── app/
    │   ├── state.js
    │   ├── expression.js
    │   ├── main-screen.js
    │   └── init.js
    ├── core/
    │   ├── parser.js
    │   ├── boolean-engine.js
    │   ├── truth-table-engine.js
    │   └── bitwise-engine.js
    └── features/
        ├── input-controls.js
        ├── keyboard.js
        ├── truth-table.js
        ├── how-come.js
        ├── result-window.js
        ├── solving-steps.js
        ├── simplification.js
        └── kmap.js
```

## What each file does

### Core engine
- `parser.js` — tokenization, parsing, AST utilities, and expression formatting helpers.
- `boolean-engine.js` — Boolean AST analysis and Boolean evaluation with traces.
- `truth-table-engine.js` — generates the truth-table data model and rows.
- `bitwise-engine.js` — binary/decimal conversion and bitwise evaluation.

### Features
- `input-controls.js` — expression input, delete/reset, mode switching, and variable assignments.
- `keyboard.js` — Boolean, binary, and decimal keypad rendering.
- `truth-table.js` — full truth-table page and column filters.
- `how-come.js` — step-by-step explanation of how the truth table is generated.
- `result-window.js` — result overlay, preview table, simplification summary, and K-map preview.
- `solving-steps.js` — Boolean trace, simplification, and binary/decimal solving screens.
- `simplification.js` — Quine–McCluskey simplification engine.
- `kmap.js` — Gray-code and Karnaugh map data generation.

### App
- `state.js` — shared application state and configuration.
- `expression.js` — expression display and parsing of the current input.
- `main-screen.js` — main screen and its UI rendering.
- `init.js` — starts the application with `render()`.

## Important note

The files are intentionally loaded as ordered classic scripts, not `type="module"`. This preserves the current global function names used by inline `onclick` handlers and avoids changing the existing UI behavior while separating the code by responsibility. Keep the script order in `index.html` unless you also update the dependencies.
