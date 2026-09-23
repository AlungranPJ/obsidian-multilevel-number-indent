![Multilevel Number Indent](assets/banner.svg)

[![Release](https://img.shields.io/github/v/release/AlungranPJ/obsidian-multilevel-number-indent?style=flat-square&label=release&labelColor=27272a&color=f97316)](https://github.com/AlungranPJ/obsidian-multilevel-number-indent/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/AlungranPJ/obsidian-multilevel-number-indent/ci.yml?style=flat-square&label=CI&labelColor=27272a)](https://github.com/AlungranPJ/obsidian-multilevel-number-indent/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-270_passing-f97316?style=flat-square&labelColor=27272a)](#development)
[![Obsidian](https://img.shields.io/badge/Obsidian-1.5%2B-52525b?style=flat-square&labelColor=27272a)](#compatibility)
[![License](https://img.shields.io/badge/license-MIT-52525b?style=flat-square&labelColor=27272a)](LICENSE)
[![Downloads](https://img.shields.io/github/downloads/AlungranPJ/obsidian-multilevel-number-indent/total?style=flat-square&label=downloads&labelColor=27272a&color=52525b)](https://github.com/AlungranPJ/obsidian-multilevel-number-indent/releases)

This is the multilevel list you know from Word, rebuilt around the fact that a note is a text file.

You press <kbd>Tab</kbd>, the item steps one level deeper and its whole subtree comes along. The numbers are written into the note as **real characters**, not painted on by a stylesheet, so they travel with the text: into a copy and paste, into an export, into git, into any other Markdown editor you open the file with. And when the outline has to leave the note, it leaves as something you can hand to a person: clean prose, a real nested list, or rich text with the numbering exactly as you wrote it.

![Multilevel Number Indent in Obsidian: 1. / 1.1. / 1.2.1. down to 1) and 2.1)](assets/demo.png)

## Why this one

| | |
|---|---|
| **The number format is yours** | `1.` `1.1.` `1.1.1.` `1)` `a)` `I.` `ข้อ ๑.` whatever you can build out of the placeholders. Set it in the settings tab and watch the preview rewrite itself while you type. |
| **As deep as the note needs** | Levels come and go in the settings tab, two at a minimum and twelve at a maximum. Past the last one you choose what happens: keep numbering, or let the line be body text with its indent kept. |
| **In from anywhere, out to anywhere** | Paste a list from Word or a web page and it becomes this numbering. Send it back out as clean text, rich text, or a real nested list the target app numbers itself. |
| **Moving items is a first-class thing** | <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> swaps an item with the sibling at its own level, subtree and all, and leaves the caret sitting on the item. Select a few and they move as one group. |
| **Headings run on the same engine** | `# 1 Introduction`, `## 1.1 Scope`, `#### 1) Point`. Same templates, same rules, same renumbering. |
| **It stays in your vault** | No network calls, no telemetry, no dependencies at runtime, and no build step in the shipped file. |
| **The releases are checkable** | Every asset is byte-compared against the committed file and carries a build provenance attestation. |

## New in 3.0.0

This one is about the two things that were still getting in the way: getting **text you can actually use** out of the plugin, and a settings tab that bends to the note instead of the other way round.

- **Grow or shrink the level list** right in the settings tab, and decide what a line past the last level becomes. With "leave it as text" the notes under an item stay body text and <kbd>Tab</kbd> stops politely at the edge of the outline instead of shoving items out of it.
- **Presets**, so nobody has to build `1.1(a)` by hand. Six ship with the plugin, you can save your own, and the whole set moves between machines as JSON. A saved preset with a shipped name quietly replaces it.
- **Thai number styles**: `ก` for `ก` `ข` `ค`, `๑` for `๑` `๒` `๓`. `ข้อ ๑.` is written the same way `1.1(a)` is.
- **Per-note formats** in the frontmatter, so a legal note and a workshop note can live in one vault in different shapes. The global settings come back on the next note without you touching anything.
- **`Normalize the outline`** for the note that drifted: the indent goes back to whole units, `1.text` gets its space back, the trailing whitespace goes, and every number is recomputed from the depth the indentation actually says.
- **Smart paste** for lists that arrive from somewhere else. Bullets, `1)`, `๑.`, `ก.` all become this numbering. It is opt-in and it only fires when the clipboard really looks like a list, so prose stays prose.
- **Clean text on the way out**: links become their display text, callouts keep their titles and lose their markers, comments and emphasis go. `Save the selection as a clean note` drops it into a new file.
- **Rich text on the way out** too: HTML and RTF with the numbering kept as literal text, or as a real nested list so Word and mail clients number it themselves.
- **Multi-line selections move as one group**, subtrees included, which is what you wanted every time you tried to reorder a whole section.
- **Cut and paste as a subtree**, and **Move the item to a level**, for the moves that are about structure rather than one keystroke.
- **Indent guides** (a faint rule per level, background only, so the text and the clipboard never see it) and a **status bar** that tells you which level and which number is under the cursor.

Also fixed on the way: blank lines between two siblings used to disappear when <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> swapped them, and body text written deeper than an item used to split the numbering block and restart the count. Both behave now.

![The settings tab: as many levels as the note needs, and what happens past the last one](assets/settings.png)

## The keys

| Key | On a numbered line | On a heading line |
|---|---|---|
| <kbd>Tab</kbd> | Indent the item and its whole subtree | Increase the heading level, then renumber |
| <kbd>Shift</kbd>+<kbd>Tab</kbd> | Outdent the item and its subtree | Decrease the heading level, then renumber |
| <kbd>Enter</kbd> | Start the next sibling at the same depth | Left to Obsidian |
| <kbd>Alt</kbd>+<kbd>↑</kbd> / <kbd>↓</kbd> | Swap with the adjacent sibling **at the same level** | Swap the whole section with the adjacent heading of the same level |

A selection that spans several lines moves as one group: every item keeps its subtree, and the caret stays on the first line of the group.

Every key is scoped to lines this plugin recognises. Everywhere else nothing happens, so <kbd>Tab</kbd> keeps Obsidian's normal indent behaviour and <kbd>Enter</kbd> keeps working in tables, code blocks and prose. <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> never changes depth: at the top or bottom of a level it simply does nothing, and <kbd>Tab</kbd> or <kbd>Shift</kbd>+<kbd>Tab</kbd> is how you change depth. The caret follows the item to wherever it lands.

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

Levels 1 to 3 carry the full path and end with a period: `1.` `1.1.` `1.1.1.` Level 4 and deeper restart the count and end with a bracket: `1)` `1.1)`. Two spaces of indentation per level, so the content column advances by exactly four characters each time and everything lines up on a plain grid.

The level is read from the indentation, never from the number, so indenting a line always renumbers it into the right shape. `1.1.1.` turns into `1)` when it drops to level 4, and `1)` walks back to `1.1.2.` when it comes up again. After <kbd>Tab</kbd> or <kbd>Shift</kbd>+<kbd>Tab</kbd> the caret keeps its place inside the content rather than the number: a bare `2. ` becomes `  1.1. |`, not `  1.1|. `.

`1.1.` is deliberately not a Markdown list marker, which is exactly why the numbers travel with the text. Only a root `1.` is a real list item, and `styles.css` neutralises Obsidian's list offset for the recognised lines so every level sits on the same grid.

![The same outline rendered in six number formats](assets/example.svg)

### Placeholders

**Settings → Multilevel Number Indent** holds one template per level plus the indent width, and previews the result live as you type.

| Placeholder | Renders |
|---|---|
| `1` | `1` `2` `3` … |
| `a` / `A` | `a` `b` … / `A` `B` … |
| `i` / `I` | `i` `ii` `iii` … / `I` `II` `III` … |
| `ก` | `ก` `ข` `ค` … |
| `๑` | `๑` `๒` `๓` … |

Everything else in a template is literal, so the separators and the closing mark are yours. How many placeholders a row carries decides how many trailing segments that level shows, which is how the shipped defaults restart the count at level 4:

```text
1.1.1.     ->  1.1.1.         full path, closed with a period
1)         ->  1)             one segment, so the count restarts
1.1)       ->  1.1)           two segments
a)         ->  a) b) c)       letters
I.         ->  I. II. III.    roman numerals
ข้อ ๑.     ->  ข้อ ๑.          a literal prefix
1.1(a)     ->  1.1(a)         legal style
```

A row without a placeholder is ignored and keeps whatever it had. Numbers already written in the shipped defaults are still recognised after you change the format, so nothing gets orphaned: the next <kbd>Tab</kbd> simply rewrites them into the new shape.

### Levels, and what comes after them

The level list is as long as your note needs it: **Add level** and **Remove** sit on every row. The setting just under the indent width is the one that decides how the list behaves past the end:

- **Reuse the last level** keeps numbering every depth. This is the shipped behaviour and it is what you want for a document with no natural end.
- **Leave it as text** keeps the indent but drops the number. This is the one for notes that belong to an item rather than being part of the outline: <kbd>Tab</kbd> stops working past the last level instead of pushing items out of it.

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

`formats` also takes one line: `formats: ["a.", "a.a."]`. A value that does not fit the format language is ignored rather than half applied.

### Presets

A preset is just a whole level list with a name. Six ship with the plugin: dotted then brackets, full path dots, letters, roman numerals, legal style and Thai. **Apply a preset** replaces the levels above, **Save the current list** keeps whatever you built under a name, and a saved preset carrying a shipped name takes its place.

The **Preset JSON** box is how the saved ones travel: **Export** copies them to the clipboard ready for another machine, **Import** reads the box and replaces the saved list, and anything that is not a clean list of presets is refused rather than half imported.

## Getting text you can actually use

The numbering is only half the job. What matters is the text that comes out.

| Command | What it does |
|---|---|
| `Normalize the outline` | Puts a drifted note back into shape and renumbers it from the real depth. |
| `Turn the selection into a numbered outline` | Takes a pasted list apart and rebuilds it in this numbering, foreign bullets and foreign numbers included. |
| `Copy as clean text` | The selection as prose: links become their display text, callout markers and comments and emphasis go. Ready for a report or an email. |
| `Save the selection as a clean note` | The same cleaned text, written to a new note. |
| `Copy as formatted text` | HTML and RTF on the clipboard with the numbering kept exactly as it reads in the note. |
| `Copy as a real nested list` | HTML and RTF on the clipboard as a real nested list, so Word and mail clients number it themselves. |

**Format pasted lists** in the settings tab turns the first of these on for <kbd>Ctrl</kbd>+<kbd>V</kbd> as well. It ships off, and it only fires on text that really looks like a list.

## Heading numbering

Headings use the same templates with the closing period dropped, so levels 1 to 3 read `# 1 Introduction`, `## 1.1 Scope`, `### 1.1.1 Detail`. From level 4 they follow the plain-text rule and end with a bracket: `#### 1) Point`, `##### 1.1) Detail`.

Changing a heading level or moving a section renumbers the note automatically, but only **once the note is in numbered mode**, that is, once at least one heading carries a number. A note with no numbers is left alone, so <kbd>Tab</kbd> never starts numbering a document by surprise. `Number headings in note` turns the mode on, `Remove heading numbers` turns it off.

## Commands

| Command | What it does |
|---|---|
| `Number headings in note` | Write `1` / `1.1` / `1.1.1` into every heading |
| `Remove heading numbers` | Strip the numbers from every heading |
| `Renumber multilevel block` | Recompute the plain-text numbers from the real indentation |
| `Insert multilevel numbering` | Turn a space-indented outline into a numbered one |
| `Remove multilevel numbering` | Strip the plain-text numbers, keeping the indentation |
| `Normalize the outline` | Put a drifted outline back into shape and renumber it |
| `Turn the selection into a numbered outline` | Convert pasted bullets and foreign numbers |
| `Cut the item with its subtree` | Take an item and everything under it out, ready to place |
| `Paste the cut item here` | Put it back after the current item, at that item's level |
| `Move the item to a level` | Ask for a level and move the item and its subtree there |
| `Copy as clean text` | The selection as prose, without any Markdown markers |
| `Save the selection as a clean note` | The same, written to a new note |
| `Copy as formatted text` | Rich text with the numbering kept |
| `Copy as a real nested list` | Rich text as a nested list the target numbers itself |

Each command is one editor transaction, so a single <kbd>Ctrl</kbd>+<kbd>Z</kbd> puts everything back.

## What this plugin touches

There are no network calls, no telemetry, and nothing loaded at runtime beyond what the host already provides. Two things are worth spelling out anyway.

- **The clipboard, and only when you ask for it.** `Copy as clean text`, `Copy as formatted text` and `Copy as a real nested list` write to it. `Format pasted lists` reads what you just pasted, through the paste event itself. Nothing is read or written in the background, and nothing is written anywhere but the clipboard.
- **Your notes, through the normal vault API.** Every command is one editor transaction, so one <kbd>Ctrl</kbd>+<kbd>Z</kbd> puts everything back. No file is touched outside the note you are in, except `Save the selection as a clean note`, which creates one new note that you named.

## Installation

### From the community directory

**Settings → Community plugins → Browse → Multilevel Number Indent**.

### Manually

Copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/nested-outline-numbering/`, then enable the plugin in **Settings → Community plugins**.

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

The test file stubs `require("obsidian")` and `require("@codemirror/*")` so `main.js` loads in plain Node, then runs 270 assertions over the core: numbering, subtree moves, caret placement, code-fence handling, heading counters, the number templates and their round-trips, the Thai number styles, the level and depth policy settings, presets and their JSON, per-note frontmatter, normalize, smart paste, clean text, the HTML and RTF output, multi-line moves, cut and paste as a subtree, the indent guides and the status bar.

On top of that it builds the settings tab against small doubles for `Setting`, `PluginSettingTab`, `Modal` and the container element, and checks the rows, the buttons, the preview and the validation. The first block of the suite checks the shape Obsidian's loader needs (`module.exports`, `.default`, `prototype.onload`), so a broken export cannot slip through.

There is no compilation step: `npm run build` runs that suite, which is how the build-verification check confirms the committed `main.js` behaves the way this README says it does.

## Known limitations

These are the edges I know about. They are stated here rather than hidden.

- A template's `1` `a` `A` `i` `I` `ก` `๑` are placeholders, so literal text carrying those letters renders as counters. Keep a prefix to letters outside that set, or use `ข้อ ๑.` style prefixes where the Thai letters stand for themselves.
- `formats` in the frontmatter reads a block list, or a flow list written on one line.
- A plain-text item can only be indented when an earlier sibling already exists at the same level: the first child of a level has nothing to become a child of. This is the same rule Word follows.
- Skipped heading levels get filled in with `1`, so `#` followed by `###` numbers as `1` then `1.1.1`.
- The rich clipboard writes `text/plain`, `text/html` and `text/rtf`. An application reading none of them falls back to the plain text, numbering kept.

## License

[MIT](LICENSE)
