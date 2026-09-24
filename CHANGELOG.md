# Changelog

## 3.3.8

A guide to the right-click menu. No change to how the plugin behaves.

- **The right-click menu, item by item.** A new section in both READMEs walks through every entry under **Multilevel list section**: when you would reach for it, and what it does to the note. It starts with the one rule that explains most of the menu (select first, then right-click) and says which commands fall back to the whole note.
- **Pasting a list that already has numbers.** Written down plainly: switch on **Format pasted lists** and <kbd>Ctrl</kbd>+<kbd>V</kbd> lays a list out straight away, or paste as usual and pick **Turn the selection into a numbered outline**. Either way the old numbers do not have to be cleared first. The one thing it cannot guess (an unindented `a)` under `1)`) is spelled out, with the one-key fix.

## 3.3.7

For notes that are indented one way while the setting says another.

- **Tab, Shift+Tab, paste and move to a level read the indent off the note.** Before, each move added or removed one unit of the *setting's* indent. A note indented with two spaces under a one-tab setting then went wrong: Tab under a sibling that already had children dropped the item a level too deep (`1.1.1.` came out as `1)`), Shift+Tab could throw an item all the way out to the top level, and a pasted item landed one level too deep. Now an item that is indented goes to the column its new siblings already use, one that is outdented goes back onto its parent's column, a paste lands on its target's column, and a jump of several levels uses the step the block itself uses. The block is still renumbered in the setting's indent afterwards, the same as before.
- Eight new tests cover both directions (a space-indented note under a tab setting, and a tab-indented note under a space setting). Five of them fail against 3.3.6.
- Two lint warnings gone (an unused import and an unused catch binding).
- A `project_summary.md` in the repo maps how `main.js` fits together, for anyone picking the code up.

## 3.3.6

The guides step out of the way of the text.

- **A guide no longer cuts through a line.** A guide hangs on the last digit of its number, but a long number such as `1.1.1)` or `1.1.` over a one-tab indent reaches further right than where its children's text starts, so the rule ran straight through the first letters of the line below. Now each guide checks where the text of every line it passes begins, and when the digit is too far right it slides left to sit just before that text, with a few pixels clear. It never slides left of the start of its own number. The text itself is not moved, so nothing in the note changes.
- Measured in the app on a real note: every guide now keeps at least 3.5 px clear of the text it runs past, where two of them used to overlap it by up to 12 px.
- Five new tests for where a guide lands.

## 3.3.5

The right-click menu, fixed so you can actually move around in it.

- **The categories no longer get stuck.** In 3.3.0 each category was its own submenu, two levels deep. Obsidian's menu cannot switch between sibling submenus at that depth: once **Headings** opened, hovering or clicking **Copying out** did nothing until you clicked somewhere empty and started over. Now the categories are small headings inside the one **Multilevel list section** submenu, set off by separators, so every command is one hover and one click away and the pointer can slide straight from one category to the next.
- **A new picture of the menu** in both READMEs, taken from the real app with the submenu open on a heading line.
- Six new tests build the menu against a double and check its shape: no submenu inside the group, four labels that cannot be clicked, fifteen commands. Five of them fail against 3.3.4.

## 3.3.4

The rest of the selection fix, found by pressing real keys in the app.

- **A key with nowhere to go no longer breaks the group apart.** Press <kbd>Tab</kbd> twice on a selected group: the second press has no sibling to nest under, and 3.3.3 then fell back to moving just the line under the caret, which pulled that one line out on its own and dropped the selection. The same happened with <kbd>Alt</kbd>+<kbd>↑</kbd> at the top of a block. Now the group stays exactly where it is, still selected, and the next key that can move it moves all of it.
- A selection over plain text, with no numbered item at its start, is still left to Obsidian.
- Five new tests; two of them fail against 3.3.3.

## 3.3.3

The selection stays put.

- **A dragged selection now survives every move key.** 3.3.2 kept it after <kbd>Tab</kbd> and <kbd>Shift</kbd>+<kbd>Tab</kbd>, but <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> still dropped it to a caret, so the second press moved one line instead of the group. Now the selection travels with the group through any mix of the four keys, and only goes away when you click somewhere else. Walk a block into place with as many presses as it takes.
- A single dragged line stays selected the same way. A plain caret stays a plain caret, and <kbd>Enter</kbd> behaves as before.
- Five new tests press the keys in a row on an editor double, and four of them fail against 3.3.2.

## 3.3.2

A fix for Tab over a selection.

- **A selected group now steps in together.** Drag over four sibling items, `2.2.` to `2.5.`, and press <kbd>Tab</kbd>: they used to fan out into a staircase, `2.1.4.` then `1)` then `1.1)` then `1.1.1)`, each one a level deeper than the last. Each item was measured after the one above it had already moved, so it fell into that item's subtree and moved a second time. Every subtree is now measured on the untouched text and every line moves exactly once, so the four land side by side as `2.1.4.` to `2.1.7.`.
- **The selection stays on the group** after <kbd>Tab</kbd> or <kbd>Shift</kbd>+<kbd>Tab</kbd>, so pressing it again moves the same lines again.
- Four new tests cover it, and they fail against 3.3.1, which is how the old suite let it through: it only ever selected one item with its child.

## 3.3.1

The guide fix from 3.3.0, done properly.

- **The rule really sits on the digit now.** 3.3.0 placed it by counting columns, and a proportional font or Thai text drifts off that count, so the rule landed beside the number instead of under it. The rule is now measured from the editor itself: the x of the last digit, `5.1.1.` hangs on its final `1`, to the pixel, in any font.
- **One rule per item, running down its subtree.** An item with sub-items draws one rule from under its own number to its last sub-item. An item with nothing under it draws nothing, so a flat list stays clean.
- **The host's own indentation guides are hidden on numbered lines** while this plugin's guides are on. They are what drew a rule at every indent step, the fan of lines beside a deep item. Every other line keeps them, and switching **Indent guides** off brings them back.

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
