# Project summary: Multilevel Number Indent

Working notes for picking this project up again. The public docs live in `README.md`,
`docs/README.th.md` and `CHANGELOG.md`; this file is about how the code fits together.

## Identity

| | |
|---|---|
| Repo | `AlungranPJ/obsidian-multilevel-number-indent` (local `D:\HermesAgentFolder\obsidian-nested-outline`) |
| Plugin id | `nested-outline-numbering` (permanent, never change it) |
| Display name | Multilevel Number Indent |
| Test vault | `E:\Betimes\BT-note` → `.obsidian/plugins/nested-outline-numbering/` |
| Obsidian | `D:\obsidian\Obsidian.exe` 1.13.x |

## The idea

Word-style multilevel numbering in the Markdown source: `1.` / `1.1.` / `1.1.1.` / `1)` / `1.1)`.
The numbers are **plain text in the file**, not CSS. The level of a line comes from its
**indent columns** (a tab counts as 4), never from the number. Every edit renumbers the block.

## Files

| File | What it is |
|---|---|
| `main.js` | The whole plugin, hand-written CommonJS, no build step. Pure `CORE` block first, then the `Plugin` class, the settings tab and the CodeMirror pieces. |
| `styles.css` | Guide rule, menu labels, settings preview, hides Obsidian's per-step indent guides on numbered lines. |
| `scripts/build.js` | `npm run build`: no bundler, so it only checks the release files (main.js parses and loads as a plugin class, manifest fields, versions agree, styles.css present). No dependencies. |
| `test/core.test.js` | Stubs `obsidian` and `@codemirror/*`, loads `main.js` in plain Node, runs assertions (`node test/core.test.js`). Also builds the settings tab, the editor menu and `runAction` against doubles. |
| `assets/context-menu.png` | Screenshot of the right-click menu used in both READMEs. |
| `scratch/` | Release notes drafts. Git-ignored. |

## `main.js` map (search by name, line numbers drift)

**Config.** `DEFAULT_SETTINGS`, `CONFIG`, `setConfig`, `getConfig`, `buildNumberRe`, `templateFor`, `stopsAt` (depth policy), `renderNumber`/`formatNumber`.

**Structure.** `parseLine` (indent, number, content, columns) · `fenceMask` (code fences are never touched) ·
`findBlock` · `subtreeRange` · `computeDepths` / `depthInBlock` · `renumberRange` (rewrites every number in a block;
indent is rebuilt as `baseIndent + CONFIG.indent.repeat(depth)`).

**Moves on one item.** `indentItem` (Tab), `outdentItem` (Shift+Tab), `newSibling` (Enter), `moveItem` (Alt+Up/Down),
dispatched by `applyAction`. Indent distances come from the note itself:
`earlierSibling`, `childColumn` (column the sibling's children already use), `parentColumn`, `shiftColumns`
(move one line by N columns). This is what keeps a space-indented note right under a tab setting.

**Moves on a selection.** `applyActionRange` → `shiftItems` (Tab/Shift+Tab: every subtree measured on the untouched
text, every line moved exactly once, one shared delta) and `moveItems` (Alt+Up/Down). Both return `selectFrom`/`selectTo`
so the selection stays on the group. `GROUP_KEYS` + `startsGroup`: a blocked key on a group is swallowed and the
group stays put and selected.

**Other commands.** `insertNumbering`, `removeNumbering`, `clearFormatting` (all markers + bullets + heading numbers,
indent kept), `normalizeOutline`, `ingestOutline` (smart placement: a dotted number carries its own depth),
`cutItem`/`pasteItem`, `setLevel`, headings (`parseHeading`, `numberHeadings`, `removeHeadingNumbers`,
`headingContinuation` with `CONTINUE_MARK = "<!--mni:continue-->"`), presets, per-note frontmatter
(`parseNoteConfig`), export (`cleanForExport`, `buildHtmlOutline`, `buildRtfOutline`).

**Guides.** `guideSpans` (one per item with sub-items, on the last digit, `lastNumberIndex`) and `guideX`
(slides left to just before the children's text when a long number reaches past it, `GUIDE_GAP = 4`).
Drawn by `guideMarkers` on a CodeMirror `layer` with `RectangleMarker`, measured with `coordsAtPos`.

**Plugin class** `MultilevelNumberIndent`. `onload`: settings, `addCommand` override records `commandList`,
keymap at `Prec.highest` plus a capture-phase `keydown` on `document` (`handleKeydown`) so Tab wins over
Obsidian Outliner. `runAction` applies a result as one editor transaction (one Ctrl+Z) and sets the selection.
`registerEditorMenu`: one **Multilevel list section** submenu, categories as labels (`setIsLabel` + `setDisabled`)
with separators. Never nest submenus two levels deep, Obsidian's menu cannot switch between them.

## Rules the user set

- Numbers stay plain text. Tab on an un-numbered line is a normal indent. Enter on a heading is left alone.
- A dragged group moves side by side on Tab, never as a staircase, and stays selected through Tab, Shift+Tab and Alt+Up/Down until the user clicks elsewhere.
- After Shift+Tab takes a group up, the next sibling below becomes its child (Word behaviour, confirmed by the user).
- One guide per numbered item, on the last digit, never through the text.
- UI text in sentence case (obsidianmd lint). The manifest description must not contain "Obsidian".

## Release routine

1. `node --check main.js` · `node test/core.test.js` (must end `N passed, 0 failed`) · `npx eslint main.js` (0 errors; 8 known warnings).
2. Bump `manifest.json` and `package.json`, add a `CHANGELOG.md` section, update both READMEs (test count badge, feature text).
3. `git commit` + `git push`, then `gh release create <ver> main.js manifest.json styles.css --notes-file scratch/rel-<ver>.md`.
4. Copy `main.js styles.css manifest.json` into the vault plugin folder, `taskkill /IM Obsidian.exe /F`, relaunch, confirm the loaded version.

Live checks run Obsidian with `--remote-debugging-port=9333` and drive it over CDP from scripts in the Hermes scratch dir.
A throwaway note must be detached, waited on, deleted, and the vault folder checked on disk afterwards.

## Open items

- Community directory: listing image 3, Save not confirmed, scorecard after 3.x not checked.
- 8 eslint warnings are the accepted CommonJS ones (`require`/`module` not defined, settings search definitions).

## Writing into the editor

Every edit goes through `writeEdit(editor, change, selection)`: a CodeMirror dispatch with `filter: false`, because Obsidian's **Smart lists** change filter rewrites a freshly nested list number (a new sub-list's `1)` became `4)`). Never call `editor.transaction` or `replaceSelection` directly. A transaction selection is resolved against the document after the change.

Smart lists also rewrites numbers while the user types, which `filter: false` cannot reach. `numberGuard` (a `Prec.highest` transaction filter) pairs each changed line with its old line and calls the pure `guardNumbers`: a line that kept its depth, whose number changed while the caret was in its text, gets the plugin's number back (number only, indent and text untouched). Edits tagged `input.mni`, undo and redo pass through.
