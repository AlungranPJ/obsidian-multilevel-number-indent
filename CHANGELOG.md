# Changelog

## 1.0.0

Initial public release.

- Plain-text hierarchical numbering: `Tab` / `Shift`+`Tab` indent and outdent an item together with its whole subtree, `Enter` starts the next sibling, `Alt`+`↑`/`↓` swaps with the adjacent sibling at the same level and the caret follows the item.
- Heading support: `Tab` / `Shift`+`Tab` change a heading's level and `Alt`+`↑`/`↓` move a whole section, both renumbering the note automatically once the note is in numbered mode.
- Commands: `Number headings in note`, `Remove heading numbers`, `Renumber nested block`, `Insert nested numbering`, `Remove nested numbering`.
- Every key is scoped to lines the plugin recognises, so Obsidian's normal `Tab` and `Enter` behaviour is untouched everywhere else.
- No build step, no dependencies, 81 unit tests over the pure core logic.
