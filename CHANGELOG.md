# Changelog

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
