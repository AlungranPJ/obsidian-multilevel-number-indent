![Multilevel Number Indent](assets/banner.svg)

[![Release](https://img.shields.io/github/v/release/AlungranPJ/obsidian-multilevel-number-indent?style=flat-square&label=release&labelColor=27272a&color=f97316)](https://github.com/AlungranPJ/obsidian-multilevel-number-indent/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/AlungranPJ/obsidian-multilevel-number-indent/ci.yml?style=flat-square&label=CI&labelColor=27272a)](https://github.com/AlungranPJ/obsidian-multilevel-number-indent/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-160_passing-f97316?style=flat-square&labelColor=27272a)](#development)
[![Obsidian](https://img.shields.io/badge/Obsidian-1.5%2B-52525b?style=flat-square&labelColor=27272a)](#compatibility)
[![License](https://img.shields.io/badge/license-MIT-52525b?style=flat-square&labelColor=27272a)](LICENSE)
[![Downloads](https://img.shields.io/github/downloads/AlungranPJ/obsidian-multilevel-number-indent/total?style=flat-square&label=downloads&labelColor=27272a&color=52525b)](https://github.com/AlungranPJ/obsidian-multilevel-number-indent/releases)

Numbering for Obsidian outlines, written into the note as **real text**, in whatever number format you set.

Press <kbd>Tab</kbd> on an item and it steps one level deeper, carrying its whole subtree with it. The numbers are plain characters in the file, not a rendering trick, so they survive copy and paste, export, sync, and any other Markdown editor.

![Multilevel Number Indent in Obsidian: 1. / 1.1. / 1.2.1. down to 1) and 2.1)](assets/demo.png)

## What sets it apart

| | |
|---|---|
| **Any number format, per level** | `1.` `1.1.` `1.1.1.` `1)` `a)` `I.` and anything you build from them. Set it in the settings tab, with a live preview. |
| **The count can restart at any depth** | The shipped default drops the full path at level 4 and restarts: `1)` `2)` `3)`. |
| **Move an item, not just indent it** | <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> swaps an item with its sibling at the same level, takes the subtree along, and leaves the caret on the item. |
| **Headings use the same engine** | `# 1 Introduction`, `## 1.1 Scope`, `#### 1) Point`, numbered and renumbered by the same rules. |
| **Nothing leaves your vault** | No network calls, no telemetry, no runtime dependencies, and no build step in the shipped file. |
| **Verifiable releases** | Every release asset is byte-compared against the committed file and carries a build provenance attestation. |

## Keys

| Key | On a numbered line | On a heading line |
|---|---|---|
| <kbd>Tab</kbd> | Indent the item and its whole subtree | Increase the heading level, then renumber |
| <kbd>Shift</kbd>+<kbd>Tab</kbd> | Outdent the item and its subtree | Decrease the heading level, then renumber |
| <kbd>Enter</kbd> | Start the next sibling at the same depth | Left to Obsidian |
| <kbd>Alt</kbd>+<kbd>↑</kbd> / <kbd>↓</kbd> | Swap with the adjacent sibling **at the same level** | Swap the whole section with the adjacent heading of the same level |

Every key is scoped. A line the plugin does not recognise is never touched, so <kbd>Tab</kbd> keeps Obsidian's normal indent behaviour everywhere else, and <kbd>Enter</kbd> keeps working normally in tables, code blocks and prose.

<kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> never changes an item's depth. At the top or bottom of a level it does nothing; use <kbd>Tab</kbd> or <kbd>Shift</kbd>+<kbd>Tab</kbd> to change depth. The caret follows the item to its new line.

## The number format

Out of the box the numbering looks like this:

```text
1. Introduction
  1.1. Scope
    1.1.1. Detail
      1) First point
        1.1) Detail of the first point
      2) Second point
2. Summary
```

- **Levels 1 to 3** carry the full path and end with a period: `1.` `1.1.` `1.1.1.`
- **Level 4 and deeper** restart the count and end with a bracket: `1)` `1.1)`
- Two spaces of indentation per level, so the content column advances by exactly four characters each time.

The level is read from the indentation, not from the number, so indenting a line always renumbers it into the right shape — `1.1.1.` becomes `1)` when it drops to level 4, and `1)` walks back to `1.1.2.` when it comes up again.

![The same outline rendered in four number formats](assets/example.svg)

After <kbd>Tab</kbd> or <kbd>Shift</kbd>+<kbd>Tab</kbd> the caret keeps its place inside the content, never inside the number: a bare `2. ` becomes `  1.1. |`, not `  1.1|. `.

`1.1.` is not a Markdown list marker, which is exactly why the numbers travel with the text. Only a root `1.` is a real list item, and `styles.css` neutralises Obsidian's list offset for the recognised lines so every level lines up.

## Settings

**Settings → Multilevel Number Indent** holds one number template per level plus the indent width, and previews the result live as you type.

| Placeholder | Renders |
|---|---|
| `1` | `1` `2` `3` … |
| `a` / `A` | `a` `b` … / `A` `B` … |
| `i` / `I` | `i` `ii` `iii` … / `I` `II` `III` … |

Everything else in a template is literal, so it sets the separators and the closing mark. How many placeholders a row carries decides how many trailing segments that level shows, which is how the defaults restart the count at level 4:

```text
1.1.1.     ->  1.1.1.         full path, closed with a period
1)         ->  1)             one segment, so the count restarts
1.1)       ->  1.1)           two segments
a)         ->  a) b) c)       letters
I.         ->  I. II. III.    roman numerals
```

A row without a placeholder is ignored and keeps the value it had, and the last row is reused for every deeper level. Numbers already written with the shipped defaults are still recognised after you change the format, so nothing gets orphaned — the next <kbd>Tab</kbd> rewrites them into the new shape.

## Heading numbering

Headings use the same templates with the closing period dropped, so levels 1 to 3 read `# 1 Introduction`, `## 1.1 Scope`, `### 1.1.1 Detail`. From level 4 they follow the plain-text rule and end with a bracket: `#### 1) Point`, `##### 1.1) Detail`.

Changing a heading level or moving a section renumbers the note automatically **once the note is in numbered mode**, that is, once at least one heading carries a number. A note with no numbers is left alone, so <kbd>Tab</kbd> never starts numbering a document by surprise. Turn the mode on with `Number headings in note` and off with `Remove heading numbers`.

## Commands

| Command | What it does |
|---|---|
| `Number headings in note` | Write `1` / `1.1` / `1.1.1` into every heading |
| `Remove heading numbers` | Strip the numbers from every heading |
| `Renumber multilevel block` | Recompute the plain-text numbers from the real indentation |
| `Insert multilevel numbering` | Turn a space-indented outline into a numbered one |
| `Remove multilevel numbering` | Strip the plain-text numbers, keeping the indentation |

Each command is a single editor transaction, so one <kbd>Ctrl</kbd>+<kbd>Z</kbd> restores everything.

## Installation

### From the community directory

**Settings → Community plugins → Browse → Multilevel Number Indent**.

### Manually

Copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/multilevel-number-indent/`, then enable the plugin in **Settings → Community plugins**.

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
npm ci
npm run build
```

The test file stubs `require("obsidian")` and `require("@codemirror/*")` so `main.js` can be loaded in plain Node, then runs 160 assertions over the core: numbering, subtree moves, caret placement, code-fence handling, heading counters, the number templates and round-trips. It also builds the settings tab against small doubles for `Setting`, `PluginSettingTab` and the container element, and checks the rows, the preview and the validation. The first block checks the shape Obsidian's loader needs (`module.exports`, `.default`, `prototype.onload`), so a broken export cannot pass the suite.

There is no compilation step. `npm run build` runs that suite, so the build-verification check confirms the committed `main.js` behaves as documented.

## Known limitations

- <kbd>Tab</kbd> and <kbd>Shift</kbd>+<kbd>Tab</kbd> act on the line under the cursor; multi-line selections are not handled yet.
- A plain-text item can only be indented when an earlier sibling already exists at the same level — the first child of a level has nothing to become a child of. This matches Word.
- Skipped heading levels are filled in with `1`, so `#` followed by `###` numbers as `1` then `1.1.1`.

## License

[MIT](LICENSE)
