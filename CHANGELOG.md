# Changelog

## 3.3.0

The guides get quieter and the menu gets shorter.

- **One rule per numbered line, on the number itself.** A line used to draw one rule per indent step, so a deep item left a fan of lines hanging in the margin. Now every numbered line draws exactly one faint rule, aligned with the last digit of its own number: `5.1.1.` hangs its rule on the final `1`, and `1)` hangs its rule on the `1`. Thai numbers and numbered headings line up the same way, and the rule is still a background, so the text stays clean for copy and paste.
- **The right-click menu is split into four categories** under **Multilevel list section**: **Numbering**, **Moving items**, **Copying out** and **Headings**. What was one column of fifteen commands now scans in one look, and the two heading commands still only show up on a heading.

## 3.2.0

A small release with one new move in it, and the pasting rules written down at last.

- **`Clear list markers and keep the indent`** is the clear-format move. Numbers and bullets come off the front of the lines, numbers come off the headings, and the indentation is left exactly as it was, so the text can be laid out again by hand. Any numbering style goes, including `1.1 text` and `1.1.1)` the way Word and chat clients write them. A blockquote marker is content, so it stays put.
- **Smart placement is documented now**, in the README and the Thai guide: a dotted number carries its own depth in its segments, so `1.1 text` lands at level 2 whatever the indent says, and only a line that merely starts with `1` is placed by its indent like everything else.
- The README now carries a picture of the right-click menu with the **Multilevel list section** group open.

## 3.1.0

This release is about where the commands live, and where a list starts.

- **A right-click menu of its own.** Every command is grouped under **Multilevel list section** in the editor's context menu, so the plugin's commands read as its own instead of being scattered through the menu.
- **`Continue numbering past this heading`** and **`Restart numbering at this heading`**, the two things Word lets you do with a list at a heading. Continue runs the count straight on across the heading. Restart starts again at `1.`. The choice rides on the heading line as an HTML comment, which reading view and `Copy as clean text` both drop.
- **Smart placement for pasted numbers.** `1.1 text` and `1.1.1 text`, written without the closing mark, are now taken off whole instead of leaving the last segment behind in the text, and the number's own segments say how deep the item sits. A ragged indent can no longer push an item down a level.
- Fixed: a line indented four spaces is read by the host as an indented code block, and that block's tint and its top and bottom rules showed up as odd lines around a deep item. They are cleared now.

## 3.0.0

The release is about one thing: formatting that leaves you with text you can use, and a settings tab that fits the note instead of the other way round.

- **As many levels as the note needs.** `Add level` and `Remove` sit on every row of the settings tab, two at the least and twelve at the most. A new setting decides what a line deeper than the last level becomes: reuse the last level's shape, or leave it as body text with its indent kept and no number. With the second choice <kbd>Tab</kbd> stops working past the last level instead of pushing items out of the outline.
- **Presets.** Six ship with the plugin: dotted then brackets, full path dots, letters, roman numerals, legal style and Thai. Save the current level list under a name, and move the saved ones between machines as JSON. A saved preset that carries a shipped name replaces it.
- **Thai number styles.** `ก` renders `ก` `ข` `ค` and `๑` renders `๑` `๒` `๓`, so `ข้อ ๑.` or `(ก)` are written the same way `1.1(a)` is.
- **Per-note formats** from the note's frontmatter, under a `numbering:` block: `indent`, `depth-policy` and `formats`. The global settings are restored on the next note.
- **`Normalize the outline`** puts a drifted note back into shape: the indent becomes whole units of the configured width, a jammed `1.text` gets its space back, trailing whitespace goes, and every number is recomputed from the real depth.
- **Smart paste** turns a list from Word, Docs, a web page or a chat into this numbering, foreign bullets and foreign numbers included. Opt-in through `Format pasted lists`, and it only fires on text that really looks like a list. `Turn the selection into a numbered outline` does the same for a selection.
- **Text that is ready to use.** `Copy as clean text` strips links, callout markers, comments and emphasis. `Save the selection as a clean note` writes it to a new file. `Copy as formatted text` and `Copy as a real nested list` put HTML and RTF on the clipboard, so Word and a mail client see the numbering or a real list instead of raw Markdown.
- **Multi-line selections** move as one group: <kbd>Tab</kbd>, <kbd>Shift</kbd>+<kbd>Tab</kbd> and <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> work over several items at once, subtrees included, and the caret stays on the first line of the group.
- **`Cut the item with its subtree`**, **`Paste the cut item here`** and **`Move the item to a level`**, for the moves that are about structure rather than one keystroke.
- **Indent guides**, one faint rule per level drawn as a background so the text and the clipboard are never touched, and a **status bar** that names the level and the number under the cursor.
- Fixed: blank lines between two siblings were dropped when <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> swapped them. They stay between the two items now.
- Body text written deeper than an item no longer splits the numbering block, so an item keeps its own count across its notes.

## 2.0.1

Changes made in response to the community directory review.

- The plugin id went back to `nested-outline-numbering`, the id the directory entry is registered under. The display name stays **Multilevel Number Indent** and the repository stays `obsidian-multilevel-number-indent`.
- The manifest description no longer names Obsidian, which the directory style guide rules out.

## 2.0.0

- Renamed to **Multilevel Number Indent**.
- The three core commands read `Renumber multilevel block`, `Insert multilevel numbering` and `Remove multilevel numbering`.
- New banner and example artwork, and a CI workflow that checks the entry file parses and the shipped shape is intact.
- `.gitattributes` keeps every text file at LF, so a fresh clone produces the same bytes as the release assets.

## 1.2.0

- **Settings tab.** One number template per level, plus the indent width, with a live preview of the result. Placeholders render the counter (`1` arabic, `a`/`A` letters, `i`/`I` roman numerals) and every other character is literal, so the separators and the closing mark are yours to choose.
- The shipped format is unchanged: levels 1 to 3 stay `1.` / `1.1.` / `1.1.1.` and levels 4 and deeper stay `1)` / `1.1)`. Set templates such as `1.1.1.1.` or `a)` to change it.
- A number written with the shipped format is still recognised after you change the format, so a note is renumbered into the new shape instead of being abandoned.
- Heading numbers follow the same templates with the closing period dropped.
- A template with no placeholder is ignored and keeps the value that level had, so a half-typed row never shifts the levels below it.
- Levels are never derived from the number text any more; a level always comes from the indentation, which is what lets any format parse.

## 1.1.0

- Levels 4 and deeper now restart the count and close with a bracket: `1.` / `1.1.` / `1.1.1.` / `1)` / `1.1)`. The same rule applies to heading numbers (`#### 1) Point`).
- Fixed the caret jumping inside the number after <kbd>Tab</kbd> and <kbd>Shift</kbd>+<kbd>Tab</kbd>. A bare `2. ` used to become `  1.1|. `; it now becomes `  1.1. |`. The caret keeps its offset inside the content instead.

## 1.0.1

Changes made in response to the community directory review.

- CSS lint: `styles.css` no longer uses override flags. Obsidian reads its list offsets from CSS variables, so the plugin now resets `--list-padding-inline-start`, `--list-marker-space`, `--list-indent` and `--list-indent-editing` on the lines it recognises instead of forcing declarations.
- Build verification: added `package-lock.json` so the dependency tree is reproducible.
- Releases: added a GitHub Actions workflow that checks the published release assets are byte-identical to the committed files and attaches build provenance attestations to `main.js` and `styles.css`.

## 1.0.0

Initial public release.

- Plain-text hierarchical numbering: `Tab` / `Shift`+`Tab` indent and outdent an item together with its whole subtree, `Enter` starts the next sibling, `Alt`+`↑`/`↓` swaps with the adjacent sibling at the same level and the caret follows the item.
- Heading support: `Tab` / `Shift`+`Tab` change a heading's level and `Alt`+`↑`/`↓` move a whole section, both renumbering the note automatically once the note is in numbered mode.
- Commands: `Number headings in note`, `Remove heading numbers`, `Renumber nested block`, `Insert nested numbering`, `Remove nested numbering`.
- Every key is scoped to lines the plugin recognises, so Obsidian's normal `Tab` and `Enter` behaviour is untouched everywhere else.
- No build step, no dependencies, 81 unit tests over the pure core logic.
