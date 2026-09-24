![Multilevel Number Indent](assets/banner.svg)

[![Release](https://img.shields.io/github/v/release/AlungranPJ/obsidian-multilevel-number-indent?style=flat-square&label=release&labelColor=27272a&color=f97316)](https://github.com/AlungranPJ/obsidian-multilevel-number-indent/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/AlungranPJ/obsidian-multilevel-number-indent/ci.yml?style=flat-square&label=CI&labelColor=27272a)](https://github.com/AlungranPJ/obsidian-multilevel-number-indent/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-308_passing-f97316?style=flat-square&labelColor=27272a)](#development)
[![License](https://img.shields.io/badge/license-MIT-52525b?style=flat-square&labelColor=27272a)](LICENSE)
[![Downloads](https://img.shields.io/github/downloads/AlungranPJ/obsidian-multilevel-number-indent/total?style=flat-square&label=downloads&labelColor=27272a&color=52525b)](https://github.com/AlungranPJ/obsidian-multilevel-number-indent/releases)

The multilevel list you know from Word, rebuilt around the fact that a note is a text file.

Press <kbd>Tab</kbd> and the item steps one level deeper, subtree and all. The numbers are **real characters in the file**, not a stylesheet trick, so they travel with the text: into a copy, into an export, into git, into any other Markdown editor. And when the outline has to leave the note, it leaves as something you can hand to a person: clean prose, a real nested list, or rich text with the numbering exactly as you wrote it.

![Multilevel Number Indent in Obsidian: 1. / 1.1. / 1.2.1. down to 1) and 2.1)](assets/demo.png)

<details>
<summary><strong>Contents</strong></summary>

- [Why this one](#why-this-one)
- [The keys](#the-keys)
- [The number format](#the-number-format)
- [Settings](#settings)
- [Getting text out](#getting-text-out)
- [Heading numbering](#heading-numbering)
- [Commands](#commands)
- [What this plugin touches](#what-this-plugin-touches)
- [Installation](#installation)
- [Compatibility](#compatibility)
- [How it works](#how-it-works)
- [Development](#development)
- [Known limitations](#known-limitations)

</details>

## Why this one

| | |
|---|---|
| **The number format is yours** | `1.` `1.1.` `1)`, `a)`, `I.`, `ข้อ ๑.` — anything you can build from the placeholders. The preview rewrites itself while you type. |
| **As deep as the note needs** | Grow or shrink the level list from two to twelve. Past the last level you choose: keep numbering, or leave the line as body text with its indent kept. |
| **In from anywhere, out to anywhere** | Paste a list from Word or a web page and it becomes this numbering. Send it back out as clean text, rich text, or a real nested list the target app numbers itself. |
| **Moving items is a first-class thing** | <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> swaps an item with the sibling at its own level, subtree and all, and leaves the caret on the item. Select a few and they move as one group. |
| **Headings run on the same engine** | `# 1 Introduction`, `## 1.1 Scope`, `#### 1) Point`. Same templates, same rules, same renumbering. |
| **It stays in your vault** | No network calls, no telemetry, no dependencies at runtime, and no build step in the shipped file. |
| **The releases are checkable** | Every asset is byte-compared against the committed file and carries a build provenance attestation. |

<details>
<summary><strong>What's new in 3.3.0</strong>: one quiet rule per line, and a menu that scans</summary>

- **One rule per item, on its number.** The margin used to show a rule at every indent step, a fan of lines next to a deep item. Now an item with sub-items draws exactly one faint rule, measured from the editor so it sits under the last digit of its own number (`5.1.1.` hangs on the final `1`) and runs down to its last sub-item. Obsidian's own per-step guides step aside on numbered lines while this is on. Switch it off in the settings tab whenever you like.
- **The right-click menu is sorted into categories** under **Multilevel list section**: **Numbering**, **Moving items**, **Copying out** and **Headings**. Fifteen items in one column became four short lists.
</details>

<details>
<summary><strong>What's new in 3.2.0</strong>: the clear-format move, and the pasting rules written down</summary>

- **`Clear list markers and keep the indent`** is the clear-format move: numbers and bullets come off the front of the lines, numbers come off the headings, and the indentation is left exactly as it was, so you can lay the text out again by hand. Any numbering style goes, `1.1 text` included. Blockquotes are content and stay put.
- **Smart placement, written down.** A pasted number carries its own depth in its segments: `1.1 text` lands at level 2 and `1.1.1 text` at level 3, whatever the indent in front of it says. That is what `Turn the selection into a numbered outline` does, and it is spelled out under [Smart placement](#smart-placement).
- **A picture of the right-click menu**, with the **Multilevel list section** group open, so the menu is easy to find the first time.
</details>

<details>
<summary><strong>What's new in 3.1.0</strong>: the right-click menu, and a list that can run on across a heading</summary>

- **One labelled group in the right-click menu.** Every command sits under **Multilevel list section**, so they read as this plugin's instead of being scattered through the editor menu.
- **Restart or continue the numbering at a heading**, the way Word does it. Right-click the heading and pick **Continue numbering past this heading** to keep the count running on, or **Restart numbering at this heading** to start again at `1.`. The choice is an HTML comment on the heading line, so it never shows in reading view or in an exported copy.
- **Pasted numbers without a closing mark** (`1.1 text`, `1.1.1 text`) are taken off whole now, and the number itself says how deep the item sits, so a ragged indent cannot push an item down a level.
- **No more stray rules around a deep item.** A four-space indent makes the host read the line as an indented code block, and that block's tint and its top and bottom rules were the odd lines people were seeing in the editor.
</details>

<details>
<summary><strong>What's new in 3.0.0</strong> — the settings tab bends to the note, and the text that comes out is ready to use</summary>

- **Grow or shrink the level list** in the settings tab, and decide what a line past the last level becomes.
- **Presets**, so nobody has to build `1.1(a)` by hand. Six come with the plugin, you can save your own, and the set travels between machines as JSON.
- **Thai number styles**: `ก` for `ก` `ข` `ค`, `๑` for `๑` `๒` `๓`. `ข้อ ๑.` is written the same way `1.1(a)` is.
- **Per-note formats** in the frontmatter, so a legal note and a workshop note can live in one vault in different shapes.
- **`Normalize the outline`** puts a drifted note back: whole-unit indents, the space back after `1.text`, trailing whitespace gone, every number recomputed.
- **Smart paste** turns foreign bullets and numbers into this numbering. Opt-in, and it only fires when the clipboard really looks like a list.
- **Clean text on the way out**: links become their display text, callouts keep their titles and lose their markers, comments and emphasis go.
- **Rich text on the way out**: HTML and RTF with the numbering kept, or as a real nested list so Word and mail clients number it themselves.
- **Multi-line selections move as one group**, subtrees included.
- **Cut and paste as a subtree**, and **Move the item to a level**, for the moves that are about structure rather than one keystroke.
- **Indent guides** and a **status bar** that names the level and the number under the cursor.

Also fixed: blank lines between two siblings no longer disappear when <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> swaps them, and body text written deeper than an item no longer restarts the count. [Full changelog](CHANGELOG.md)

</details>

## The keys

| Key | On a numbered line | On a heading line |
|---|---|---|
| <kbd>Tab</kbd> | Indent the item and its whole subtree | Increase the heading level, then renumber |
| <kbd>Shift</kbd>+<kbd>Tab</kbd> | Outdent the item and its subtree | Decrease the heading level, then renumber |
| <kbd>Enter</kbd> | Start the next sibling at the same depth | Left to Obsidian |
| <kbd>Alt</kbd>+<kbd>↑</kbd> / <kbd>↓</kbd> | Swap with the adjacent sibling **at the same level** | Swap the whole section with the adjacent heading of the same level |

A selection that spans several lines moves as one group. Drag over four sibling items and press <kbd>Tab</kbd>: all four step in one level, side by side, each keeping its own subtree, and they stay selected. The same goes for <kbd>Shift</kbd>+<kbd>Tab</kbd> and <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd>: the selection rides along with the group until you click somewhere else, so you can keep pressing keys to walk it into place. A key that has nowhere to go (a group already at the top, or with no sibling to nest under) leaves the group where it is, still selected.

Every key is scoped to lines this plugin recognises. Everywhere else nothing happens: <kbd>Tab</kbd> keeps Obsidian's normal indent behaviour, <kbd>Enter</kbd> keeps working in tables, code blocks and prose, and <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> never changes depth. The caret follows the item to wherever it lands.

## The number format

Out of the box it looks like this:

```text
1. Introduction
  1.1. Scope
    1.1.1. Detail
      1) First point
        1.1) Detail of the first point
      2) Second point
2. Summary
```

Levels 1 to 3 show the full path and end with a period: `1.` `1.1.` `1.1.1.` Level 4 and deeper restart the count and end with a bracket: `1)` `1.1)`. Each level adds two spaces of indent, so the text always starts four columns further right and lines up on a plain grid.

The level comes from the indentation, never from the number. That is why <kbd>Tab</kbd> rewrites the number instead of only moving the line: `1.1.1.` becomes `1)` at level 4, and `1)` becomes `1.1.2.` when it moves back up. The caret stays in the text, never in the middle of a number.

`1.1.` is deliberately not a Markdown list marker. That is the whole trick: the numbers are plain text, so they travel with the note. A root `1.` is the one exception, and `styles.css` undoes Obsidian's list indent on the recognised lines so every level stays on the same grid.

![The same outline rendered in six number formats](assets/example.svg)

### Placeholders

| Placeholder | Renders |
|---|---|
| `1` | `1` `2` `3` … |
| `a` / `A` | `a` `b` … / `A` `B` … |
| `i` / `I` | `i` `ii` `iii` … / `I` `II` `III` … |
| `ก` | `ก` `ข` `ค` … |
| `๑` | `๑` `๒` `๓` … |

Everything else in a template is a plain character you typed, so the separators and the closing mark are yours. What the placeholders decide is how much of the path a level shows: one placeholder means one segment, three mean the full path. That is why the shipped defaults restart the count at level 4, where the row is `1)`.

```text
1.1.1.     ->  1.1.1.         full path, closed with a period
1)         ->  1)             one segment, so the count restarts
1.1)       ->  1.1)           two segments
a)         ->  a) b) c)       letters
I.         ->  I. II. III.    roman numerals
ข้อ ๑.     ->  ข้อ ๑.          a literal prefix
1.1(a)     ->  1.1(a)         legal style
```

A row with no placeholder is ignored, and that level keeps the value it had. Changing the format later is safe: numbers in the old shape are still recognised, and the next <kbd>Tab</kbd> rewrites them into the new one.

### Levels, and what comes after them

Every row in the level list has **Add level** and **Remove**. What happens past the last level is a separate setting, **Deeper than the last level**:

- **Reuse the last level** keeps numbering at every depth, however deep the note goes. This is the shipped setting.
- **Leave it as text** keeps the indent and drops the number. Use it for notes that belong to an item rather than being part of the outline: <kbd>Tab</kbd> then stops at the last level instead of pushing those notes out of the outline.

### Per-note formats

Any note can carry its own numbering in its frontmatter. The global settings come back on the next note automatically, so there is nothing to undo.

```yaml
---
numbering:
  indent: "\t"
  depth-policy: unnumbered
  formats:
    - "1."
    - "1.1."
---
```

`formats` also fits on one line: `formats: ["a.", "a.a."]`. A value that is not a valid template is ignored instead of being half applied.

### Presets

A preset is a whole level list saved under a name. Six come with the plugin: dotted then brackets, full path dots, letters, roman numerals, legal style and Thai. **Apply a preset** replaces the level list, **Save the current list** saves what you built, and saving under a name that already exists replaces the old one.

**Preset JSON** is how the saved ones travel: **Export** copies them to the clipboard for another machine, **Import** reads the box and replaces the saved list. Anything that is not a clean list of presets is refused rather than half imported.

## Settings

Everything lives in one tab, **Settings → Multilevel Number Indent**.

![The settings tab: as many levels as the note needs, and what happens past the last one](assets/settings.png)

| Section | What is in it |
|---|---|
| **Indent per level** | Two spaces, four spaces, or one tab |
| **Deeper than the last level** | Reuse the last level, or leave the line as text |
| **Format pasted lists** | Converts pasted lists on <kbd>Ctrl</kbd>+<kbd>V</kbd>. Ships switched off |
| **Indent guides** | One faint rule per item with sub-items, under the last digit of its number and down to its last sub-item. Obsidian's own guides step aside on numbered lines while it is on |
| **Number format** | One template per level, with **Add level** and **Remove**, and a live preview |
| **Presets** | Six built in, save your own, and **Preset JSON** to move the set between machines |

## Getting text out

The numbering is only half the job. What matters is the text that comes out.

![The same text, three states: pasted from Word, numbered in your note, out as clean text](assets/flow.svg)

| Command | What it does |
|---|---|
| `Normalize the outline` | Puts a drifted note back into shape and renumbers it from the real depth |
| `Turn the selection into a numbered outline` | Takes a pasted list apart and rebuilds it in this numbering, foreign bullets and foreign numbers included |
| `Copy as clean text` | The selection as prose: links become their display text, callout markers and comments and emphasis go |
| `Save the selection as a clean note` | The same cleaned text, written to a new note |
| `Copy as formatted text` | HTML and RTF with the numbering kept exactly as it reads in the note |
| `Copy as a real nested list` | HTML and RTF as a real nested list, so Word and mail clients number it themselves |

**Format pasted lists** in the settings tab does that first conversion automatically on <kbd>Ctrl</kbd>+<kbd>V</kbd>. It ships switched off, and it only fires on text that really looks like a list.

### Smart placement

When a list comes in from Word, a web page or a chat, the numbers usually know more than the indents do. So the number says how deep the item goes: `1.1 text` is level 2 and `1.1.1 text` is level 3, whatever indentation sits in front of it. Only a dotted number gets that say (`1.1`, `1.1.1`, `1.1.1)`); a line that merely starts with `1` is prose and is placed by its indent like everything else. A drifted indent therefore cannot push an item down a level, and a ragged outline comes out level.

It is the same move through either door: `Turn the selection into a numbered outline` on a selection, or <kbd>Ctrl</kbd>+<kbd>V</kbd> with **Format pasted lists** switched on. Right-click the text and it is in the menu too, under **Multilevel list section**. That is the whole thing: select the lines, right-click, pick the command, and the list lays itself out.

The smallest indent step in the text decides what one level is worth, so a three-space or a tab outline still comes out one level per step. And the numbers are counted, never copied: `1.2.4` written under `1.2.1` comes out `1.2.2`, because the count always follows the real depth.

## Heading numbering

Headings use the same templates with the closing period dropped: `# 1 Introduction`, `## 1.1 Scope`, `### 1.1.1 Detail`. From level 4 they follow the plain-text rule and end with a bracket: `#### 1) Point`, `##### 1.1) Detail`.

Changing a heading level or moving a section renumbers the note automatically, but only **once the note is in numbered mode**, that is, once at least one heading carries a number. A note with no numbers is left alone, so <kbd>Tab</kbd> never starts numbering a document by surprise. `Number headings in note` turns the mode on, `Remove heading numbers` turns it off.

A heading normally starts a fresh list: the items under it count from `1.` again. When you want the count to run on instead, the way Word lets a list continue across a heading, right-click the heading and pick **Continue numbering past this heading**. **Restart numbering at this heading** puts it back. The choice rides on the heading line as an HTML comment, so reading view and `Copy as clean text` never show it.

## Commands

| Command | What it does |
|---|---|
| `Number headings in note` | Write `1` / `1.1` / `1.1.1` into every heading |
| `Remove heading numbers` | Strip the numbers from every heading |
| `Renumber multilevel block` | Recompute the plain-text numbers from the real indentation |
| `Insert multilevel numbering` | Turn a space-indented outline into a numbered one |
| `Remove multilevel numbering` | Strip the plain-text numbers, keeping the indentation |
| `Clear list markers and keep the indent` | The clear-format move: numbers and bullets of any style off the lines, numbers off the headings too, the indentation left exactly as it was |
| `Normalize the outline` | Put a drifted outline back into shape and renumber it |
| `Turn the selection into a numbered outline` | Convert pasted bullets and foreign numbers |
| `Cut the item with its subtree` | Take an item and everything under it out, ready to place |
| `Paste the cut item here` | Put it back after the current item, at that item's level |
| `Move the item to a level` | Ask for a level and move the item and its subtree there |
| `Continue numbering past this heading` | Let the list run on across the heading instead of starting again at `1.` |
| `Restart numbering at this heading` | Start a fresh count at `1.` under this heading |
| `Copy as clean text` | The selection as prose, without any Markdown markers |
| `Save the selection as a clean note` | The same, written to a new note |
| `Copy as formatted text` | Rich text with the numbering kept |
| `Copy as a real nested list` | Rich text as a nested list the target numbers itself |

Each command is one editor transaction, so a single <kbd>Ctrl</kbd>+<kbd>Z</kbd> puts everything back.

Right-click in the editor and every one of these is also under **Multilevel list section**, one labelled group of its own, sorted under four small headings: **Numbering**, **Moving items**, **Copying out** and **Headings**. The headings are just labels inside that one submenu, so every command is one hover and one click away and you can slide straight from one category to the next. The two heading commands ride along in **Headings**, and they only show up when the cursor is on a heading.

![The right-click menu, with the plugin's commands under Multilevel list section](assets/context-menu.png)

## What this plugin touches

No network calls, no telemetry, and nothing loaded at runtime beyond what the host already provides. Two things are worth spelling out anyway.

- **The clipboard, and only when you ask for it.** `Copy as clean text`, `Copy as formatted text` and `Copy as a real nested list` write to it. `Format pasted lists` reads what you just pasted, through the paste event itself. Nothing is read or written in the background.
- **Your notes, through the normal vault API.** Every command is one editor transaction, so one <kbd>Ctrl</kbd>+<kbd>Z</kbd> puts everything back. No file is touched outside the note you are in, except `Save the selection as a clean note`, which creates one new note that you named.

## Installation

**From the community directory:** **Settings → Community plugins → Browse → Multilevel Number Indent**.

**Manually:** copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/nested-outline-numbering/`, then enable the plugin in **Settings → Community plugins**.

## Compatibility

Other plugins that bind <kbd>Tab</kbd> in the editor (Obsidian Outliner, say) are not a problem. This one listens on the capture phase of `keydown` and only stops the event when it actually changed the text, so Outliner keeps indenting its lists while this plugin looks after the numbered lines.

What you should not do is run two plugins claiming the same keys on the same kind of line. If you are migrating from a similar plugin, turn it off first.

## How it works

`main.js` is one hand-written CommonJS file. No build step, no dependencies at runtime, and nothing beyond `obsidian` and `@codemirror/*`, both of which the host provides.

It is split in two, on purpose:

- **CORE** is pure text transformations (`indentItem`, `outdentItem`, `newSibling`, `moveItem`, `normalizeOutline`, `ingestOutline`, `cleanForExport`, `buildHtmlOutline`, `cutItem`, `pasteItem`, `setLevel`, `shiftHeadingLevel`, `moveHeading`, `numberHeadings`, …). It never touches the Obsidian API, which is the whole reason it can be tested outside the app.
- **PLUGIN** is the `Plugin` subclass that wires the keys and the commands onto that core and applies each result as one minimal editor transaction.

## Development

```bash
npm ci
npm run build
```

The test file stubs `require("obsidian")` and `require("@codemirror/*")` so `main.js` loads in plain Node, then runs 308 assertions over the core: numbering, subtree moves, caret placement, code-fence handling, heading counters, the number templates and their round-trips, the Thai number styles, the level and depth policy settings, presets and their JSON, per-note frontmatter, normalize, smart paste, clean text, the HTML and RTF output, multi-line moves, cut and paste as a subtree, the right-click menu, the indent guides and the status bar.

On top of that it builds the settings tab against small doubles for `Setting`, `PluginSettingTab`, `Modal` and the container element, and checks the rows, the buttons, the preview and the validation. The first block of the suite checks the shape Obsidian's loader needs (`module.exports`, `.default`, `prototype.onload`), so a broken export cannot slip through.

There is no compilation step: `npm run build` runs that suite, which is how the build-verification check confirms the committed `main.js` behaves the way this README says it does.

## Known limitations

These are the edges I know about. They are stated here rather than hidden.

- Inside a template the letters `1` `a` `A` `i` `I` `ก` `๑` are placeholders, so a literal word that contains one of them renders as a counter. Build prefixes out of other letters, or write them like `ข้อ ๑.`, where only the Thai numeral is a placeholder and `ข้อ ` is literal.
- `formats` in the frontmatter reads a block list, or a flow list written on one line.
- A plain-text item can only be indented when an earlier item at that level exists for it to become a child of. This is the same rule Word follows.
- Skipped heading levels get filled in with `1`, so `#` followed by `###` numbers as `1` then `1.1.1`.
- The rich clipboard writes `text/plain`, `text/html` and `text/rtf`. An application that reads none of them still gets the plain text, with the numbering kept.

## License

[MIT](LICENSE)
