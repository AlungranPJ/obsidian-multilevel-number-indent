# Nested Outline Numbering

Hierarchical numbering for Obsidian outlines, written into the note as real text.

Press <kbd>Tab</kbd> and an item goes one level deeper, carrying its whole subtree with it:

```text
1. Introduction
  1.1. Scope          ← Tab on this line
  1.2. Method
2. Summary
```

```text
1. Introduction
  1.1. Scope
    1.1.1. Scope          ← becomes a child of the line above, renumbered
  1.2. Method
2. Summary
```

Because the numbers are plain characters in the file, not a rendering trick, they survive copy and paste, export, sync, and any other Markdown editor.

The same keys work on Markdown headings, so a note can be numbered as `1` / `1.1` / `1.1.1` / `1)` in both styles.

## Keys

| Key | On a numbered line | On a heading line |
|---|---|---|
| <kbd>Tab</kbd> | Indent the item and its whole subtree | Increase the heading level, then renumber |
| <kbd>Shift</kbd>+<kbd>Tab</kbd> | Outdent the item and its subtree | Decrease the heading level, then renumber |
| <kbd>Enter</kbd> | Start the next sibling at the same depth | Left to Obsidian |
| <kbd>Alt</kbd>+<kbd>↑</kbd> / <kbd>↓</kbd> | Swap with the adjacent sibling **at the same level** | Swap the whole section with the adjacent heading of the same level |

Every key is scoped. A line the plugin does not recognise is never touched, so <kbd>Tab</kbd> keeps Obsidian's normal indent behaviour everywhere else, and <kbd>Enter</kbd> keeps working normally in tables, code blocks and prose.

<kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> never changes an item's depth. At the top or bottom of a level it does nothing; use <kbd>Tab</kbd> or <kbd>Shift</kbd>+<kbd>Tab</kbd> to change depth. The caret follows the item to its new line.

## The plain-text format

```
^[ \t]*(\d+(?:\.\d+)*)[.)][ \t]+
```

- **Levels 1 to 3** carry the full path and end with a period: `1.` `1.1.` `1.1.1.`
- **Level 4 and deeper** restart the count and end with a bracket: `1)` `1.1)`
- Two spaces of indentation per level, so the content column advances by exactly four characters each time.

```text
1. Introduction
  1.1. Scope
    1.1.1. Detail
      1) First point
        1.1) Detail of the first point
      2) Second point
2. Summary
```

The level is read from the indentation, not from the number, so indenting a line always renumbers it into the right shape — `1.1.1.` becomes `1)` when it drops to level 4, and `1)` walks back to `1.1.2.` when it comes up again.

After <kbd>Tab</kbd> or <kbd>Shift</kbd>+<kbd>Tab</kbd> the caret keeps its place inside the content, never inside the number: a bare `2. ` becomes `  1.1. |`, not `  1.1|. `.

`1.1.` is not a Markdown list marker, which is exactly why the numbers travel with the text. Only a root `1.` is a real list item, and `styles.css` neutralises Obsidian's list offset for the recognised lines so every level lines up.

## Heading numbering

Headings use the same counters without a trailing period on levels 1 to 3: `# 1 Introduction`, `## 1.1 Scope`, `### 1.1.1 Detail`. From level 4 they follow the plain-text rule and end with a bracket: `#### 1) Point`, `##### 1.1) Detail`.

Changing a heading level or moving a section renumbers the note automatically **once the note is in numbered mode**, that is, once at least one heading carries a number. A note with no numbers is left alone, so <kbd>Tab</kbd> never starts numbering a document by surprise. Turn the mode on with `Number headings in note` and off with `Remove heading numbers`.

## Commands

| Command | What it does |
|---|---|
| `Number headings in note` | Write `1` / `1.1` / `1.1.1` into every heading |
| `Remove heading numbers` | Strip the numbers from every heading |
| `Renumber nested block` | Recompute the plain-text numbers from the real indentation |
| `Insert nested numbering` | Turn a space-indented outline into a numbered one |
| `Remove nested numbering` | Strip the plain-text numbers, keeping the indentation |

Each command is a single editor transaction, so one <kbd>Ctrl</kbd>+<kbd>Z</kbd> restores everything.

## Installation

### From the community directory

Once published: **Settings → Community plugins → Browse → Nested Outline Numbering**.

### Manually

Copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/nested-outline-numbering/`, then enable the plugin in **Settings → Community plugins**.

## Compatibility

Other plugins that bind <kbd>Tab</kbd> in the editor (for example Obsidian Outliner) are not a problem: this plugin listens on the capture phase of `keydown` and stops the event only when it actually changed the text, so Outliner keeps indenting lists while this plugin handles numbered lines.

Do not run two plugins that claim the same keys on the same kind of line. If you are migrating from a similar plugin, disable it first.

## How it works

`main.js` is a single hand-written CommonJS file with no build step and no dependencies. It only requires `obsidian` and `@codemirror/*`, both provided by the host.

The file is split into two parts:

- **CORE** — pure text transformations (`indentItem`, `outdentItem`, `newSibling`, `moveItem`, `shiftHeadingLevel`, `moveHeading`, `numberHeadings`, …). No Obsidian API is touched here, which is what makes the logic testable outside the app.
- **PLUGIN** — the `Plugin` subclass that wires the keys to the core and applies each result as one minimal editor transaction.

## Development

```bash
node test/core.test.js
```

The test file stubs `require("obsidian")` and `require("@codemirror/*")` so `main.js` can be loaded in plain Node, then runs 106 assertions over the core: numbering, subtree moves, caret placement, code-fence handling, heading counters and round-trips.

There is no compilation step. `npm run build` runs that suite, so the build-verification check confirms the committed `main.js` behaves as documented.

## Known limitations

- <kbd>Tab</kbd> and <kbd>Shift</kbd>+<kbd>Tab</kbd> act on the line under the cursor; multi-line selections are not handled yet.
- A plain-text item can only be indented when an earlier sibling already exists at the same level — the first child of a level has nothing to become a child of. This matches Word.
- Skipped heading levels are filled in with `1`, so `#` followed by `###` numbers as `1` then `1.1.1`.

## License

[MIT](LICENSE)
