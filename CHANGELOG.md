# Changelog

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
