# Contributing

## The shape of the code

`main.js` is one file in two parts, and the split is the important thing:

- **The core** is pure string work: parsing a line, deciding the numbers, renumbering a subtree, placing the caret. It never imports Obsidian. `main.js` exports it as
  `module.exports.__core`.
- **The plugin** is everything that touches the editor: the key handlers, the commands, the settings tab, the decoration.

Everything the core needs from the editor arrives as an argument. Keep it that way; the tests depend on it, and so does anyone reading the file.

## Running it

```bash
npm ci
npm run build
```

There is no bundler and no build step. `npm run build` runs `test/core.test.js`, which stubs `require("obsidian")` and the two CodeMirror modules so that `main.js` loads in plain Node, then runs the whole assertion set.

Add assertions for behaviour you change. A keystroke handler cannot be checked by hand without driving the GUI, so the test file is the only place a regression gets caught before a user finds it.

To try a change in a real vault, copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/multilevel-number-indent/` and reload the plugin.

## Conventions

- Tabs for indentation.
- The level of a line comes from its indentation, never from its number. Deriving it from the number text ties the parser to one format and breaks every custom one.
- Indent width and number templates come from `CONFIG`, never from a literal.
- The numbers are written into the note as plain text, and stay that way. The point of the plugin is that the numbering survives a copy into another app.
- The settings tab is exercised in the test file against small doubles for `Setting` and `PluginSettingTab`. Extend those rather than leaving a settings row unchecked.
