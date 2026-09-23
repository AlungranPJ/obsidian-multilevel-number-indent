# Request -> reviewed plan: multi-line selection support

- Artifact: `D:\HermesAgentFolder\obsidian-nested-outline\.omh\plans\multiline-selection-support.md`
- Workflow: OMH ralplan (`ulw-plan`) - request to handoff
- State: **prepared_not_observed** - nothing here is implementation, review, CI, merge or merge-readiness.
- Date of facts: 2026-09-22 (all commands below were run in this session)
- Planner: Hermes (Neko-chan), planning lane only - no repo file was edited.

## 0. Scope assumption (person has not confirmed it yet)

The request was "safely add a feature to this repo" with no feature named, and no person was
available to answer the intake questions. Two assumptions were taken, both reversible:

- Target repo: `D:\HermesAgentFolder\obsidian-nested-outline` (the only repo inside the session
  workspace that belongs to the user; `jev-ultrafast` next to it is a clone of an upstream
  project). Session cwd `D:\HermesAgentFolder` is not a git repo at all.
- Feature: **multi-line selection support for Tab / Shift+Tab** (and heading selections),
  i.e. the first item under "Known limitations" in the repo's own `README.md:105`.
  No open issue or PR asks for anything else: `gh issue list --state all` and
  `gh pr list --state all` both return empty.

If either assumption is wrong, stages 3-5 of this plan hold their shape and only their content
changes; nothing in the repo was modified to produce this plan.

## 1. Goal

Selecting several numbered lines and pressing Tab (or Shift+Tab) indents (outdents) every
top-level item in the selection, exactly once, with its subtree, in a single undo step, and
leaves every item outside the selection's moved set numerically and textually unchanged.

Non-goals for this change: Enter on a multi-line selection (stays host behaviour), the
plain-text format itself (`2` spaces, trailing period), the indent unit, a settings tab,
mobile key support, and any new dependency.

## 2. Observed facts (evidence, not assumptions)

Repo / build:

- `git log --oneline -6` -> HEAD `df5a0b1 1.0.1: address community directory review`, branch
  `main`, working tree clean, no other branches, `origin` = `alungranpj/obsidian-nested-outline-numbering` (public).
- Tracked files: `main.js` (745 lines, hand-written CommonJS, the build artifact itself),
  `test/core.test.js` (334 lines, 81 assertions), `manifest.json`, `package.json`,
  `styles.css`, `CHANGELOG.md`, `README.md`, `docs/README.th.md`, `docs/INSTALL.th.md`,
  `.github/workflows/attest.yml`, `eslint.config.mjs`, `package-lock.json`.
- Baseline test run: `npm test` -> `81 passed, 0 failed`, node `v22.23.2`, npm `10.9.8`.
  `package.json` maps both `test` and `build` to `node test/core.test.js`.
- `main.js` has no bundler and no runtime deps; `require("obsidian")` and `require("@codemirror/*")`
  are the only imports and are stubbed by `test/core.test.js:12-26` so the CORE section loads in plain Node.
- CORE and PLUGIN are separated: pure functions (`indentItem`, `outdentItem`, `newSibling`,
  `moveItem`, `numberHeadings`, `shiftHeadingLevel`, `moveHeading`, ...) are exported through
  `module.exports.__core` (`main.js:527-553`), and the `Plugin` subclass applies one
  `editor.transaction({changes, selection})` per key (`main.js:653-657`).

Where the single-line assumption lives (the change surface):

- `NestedOutlineNumbering.runAction` (`main.js:636`) reads `editor.getCursor()` - the active
  end only - and calls `applyAction(text.split("\n"), cursor.line, cursor.ch, action)`.
  No `getCursor("from") / getCursor("to")` on this path.
- `applyAction` (`main.js:480`) takes one line index and dispatches to the per-line core
  functions. There is no range-shaped core entry: `typeof core.indentRange` is `undefined`.
- `runRange` (`main.js:673`) already uses `editor.getCursor("from").line` / `getCursor("to").line`,
  so the range API is available and already relied on by the three range commands.

Reproduced limitation (command run in this session, no file written):

```
DOC:  0: 1. alpha / 1: "  1.1. beta" / 2: "  1.2. gamma" / 3: "    1.2.1. delta" / 4: "  1.3. zeta" / 5: 2. eta
[A] selection lines 2..4, head = line 2, Tab (indent):
    ["1. alpha","  1.1. beta","    1.1.1. gamma","      1.1.1.1. delta","  1.2. zeta","2. eta"]
    line 4 (was 1.3. zeta) changed? true
[B] Tab on line 1 (1.1., no earlier sibling at its level): null
```

Reading of that output: with a 3-line selection the plugin moves only the head item's subtree
and then renumbers the whole block, so a line the user never moved (`1.3. zeta`, line 4) has
its **number rewritten while its indentation stays put**. The selection is applied partially
and silently. Case B confirms the second half: when the head line has nothing to become a child
of, the core returns `null`, the key is not consumed, and Obsidian's own Tab runs instead
(native indent, no renumbering).

Publishing and verification surface:

- The plugin is **live in the Obsidian community directory**: the entry
  `{"id":"nested-outline-numbering", ..., "repo":"alungranpj/obsidian-nested-outline-numbering"}`
  is present in `obsidianmd/obsidian-releases/community-plugins.json`.
- `.github/workflows/attest.yml` downloads the published release assets and runs `cmp` against
  the committed `main.js`, `manifest.json`, `styles.css`, then `npm run build`, then attests
  provenance. So a code change without a version bump + new release with matching assets fails
  that job; the release assets for `1.0.1` are exactly `main.js`, `manifest.json`, `styles.css`.
- `manifest.json` and `package.json` both say `1.0.1`; `CHANGELOG.md` has a `1.0.1` section
  (community-directory review fixes).
- Test vault available: `E:\Betimes\BT-note` (the only vault in `AppData\Roaming\obsidian\obsidian.json`),
  plugin enabled in `.obsidian/community-plugins.json`, installed `main.js` **byte-identical**
  to repo HEAD (`diff -q` clean), version `1.0.1`. Other key-owning plugins are installed
  alongside it: `obsidian-outliner`, `nested-ordered-numbering`, `number-headings-obsidian`.
- Lint is **not** reproducible right now: `eslint.config.mjs` imports `eslint-plugin-obsidianmd`,
  but `package.json` has no devDependencies and there is no `node_modules`; `npx --no-install eslint .`
  fails with `npx canceled due to missing packages`. Needs a network install, or it stays an
  evidence gap for the release check.

## 3. Options and rejected alternatives

**O1 - chosen: split the transform from the renumber, then add one range entry to CORE.**
Add `indentRange(lines, from, to)` / `outdentRange(lines, from, to)` (and the heading mirror)
that (a) collect the top-level eligible lines in `[from, to]` - a line is top-level when it is
numbered, not inside a fence, and no earlier eligible line inside the range is shallower than it,
(b) apply the pure indent/outdent transform to each item's subtree as one union set, and
(c) run a single `renumberRange` over the union of the affected blocks. The existing
`indentItem` / `outdentItem` keep their exact current output for one line (they become
"transform + renumber" built from the same pieces), so the 81 existing assertions are untouched.
Then `runAction` passes the selection range when `getCursor("from").line !== getCursor("to").line`,
and the transaction restores a real selection instead of collapsing to one caret.
Cost: a small, tested refactor of CORE. Benefit: one renumber pass, so lines outside the moved
set keep their numbers - which is exactly the defect reproduced in section 2.

**O2 - rejected: loop the existing per-line functions over the selection, bottom-up.**
Smallest diff (plugin-only, no CORE signature change), but every iteration renumbers the whole
block, so untouched siblings inside the selection keep getting rewritten between steps, the
intermediate states are visible to the user's undo stack window, and the O(n^2) pass can settle
on numbers that depend on iteration order. It cannot satisfy requirement R5.

**O3 - rejected: with a multi-line selection, never consume the key (always fall through).**
Documented and trivially safe, but the numbers would then no longer match the indentation
(native Tab changes indentation without renumbering), which breaks the plugin's central promise
("the numbers travel with the text") and leaves the README limitation open.

**O4 - rejected: settings tab with per-selection behaviour options.**
Scope creep: the plugin has no settings surface today, and adding one drags in state
persistence, migration and community-review surface for a decision that the README's model
already answers. Revisit only if the person asks for configurable behaviour.

## 4. Risk register

| ID | Risk | Mitigation | Rollback |
|---|---|---|---|
| RK1 | Single-line path regresses | Existing per-line functions keep byte-identical output; `node test/core.test.js` must stay at 81 passing with new range assertions added on top | `git checkout -- main.js test/core.test.js` |
| RK2 | Caret/selection is lost or drifts after a range action | Set a real selection range in the transaction; if the multi-line selection cannot be restored reliably, fall back to caret-on-head-line and say so | same |
| RK3 | Renumbering escapes the moved set (reproduced in section 2) | Single `renumberRange` over the union span, plus a dedicated regression assertion for the `1.3. zeta` case | same |
| RK4 | Key capture fights another plugin (Outliner is installed in the same vault) | Keep the fall-through rule: return `false` and do not `preventDefault` whenever the range action changed nothing | same |
| RK5 | Live plugin: a broken `main.js` reaches users | Version bump in `manifest.json` + `package.json`, `CHANGELOG.md` entry, tag/release with `main.js`/`manifest.json`/`styles.css` uploaded, `attest.yml` green | re-publish previous tag; `gh release download 1.0.1` assets are the rollback artifact |
| RK6 | Doc drift: Thai docs and the keys table describe the old behaviour | Update `README.md` keys table / Known limitations **and** `docs/README.th.md` in the same change | same |
| RK7 | Lint cannot be run (no devDependencies, no `node_modules`) | Add `eslint` + `eslint-plugin-obsidianmd` as devDependencies with a lockfile, or record the skip explicitly in the release notes | n/a |
| RK8 | Mobile (`isDesktopOnly: false`, `minAppVersion 1.5.0`) | Use only APIs already present in the file (`Editor.getCursor("from"|"to")`, `editor.transaction`) | same |

Unverified app-level claims (declared, not evidence): that `editor.transaction({selection: {from, to}})`
restores a multi-line selection as expected, and that Obsidian consumes the event order the way
`handleKeydown` assumes. Both need a check inside the app (AC4) before the change is called done.

## 5. Acceptance criteria

- AC1 `node test/core.test.js` exits 0 with `0 failed`, the 81 existing assertions still present and passing, plus new range assertions.
- AC2 New assertions cover, at minimum: two sibling items selected -> both subtrees indent exactly one level and numbers recompute; Shift+Tab on the same selection returns the exact original lines; the `1.3. zeta` case (selected line outside the moved set keeps its number); a non-numbered line inside the selection stays untouched; selection inside a fence returns `null`; heading selection changes every level by one and keeps numbering consistent; no eligible item in the range returns `null` (fall-through).
- AC3 `git diff --stat` shows `main.js` and `test/core.test.js` only (plus docs/version files at release time); no unrelated cleanup.
- AC4 Manual, in `E:\Betimes\BT-note` (plugin already enabled, `main.js` identical to HEAD): select three numbered lines, Tab -> all three items move one level, numbers correct, one Ctrl+Z restores everything, selection still usable; Shift+Tab -> back to the original text. Same for a selection of headings. Then confirm Outliner still indents on non-numbered lines.
- AC5 `npx eslint .` clean, or a recorded decision that lint was skipped (currently blocked by AC5's own prerequisites; see RK7).
- AC6 Release: `manifest.json` + `package.json` at `1.1.0`, `CHANGELOG.md` entry written, tag `1.1.0` published with the three assets, `attest.yml` job green.

## 6. Verification commands

Run from `D:\HermesAgentFolder\obsidian-nested-outline`:

```sh
node test/core.test.js          # baseline verified today: 81 passed, 0 failed
npm test                        # same suite, verified today
npm run build                   # same suite; also what attest.yml runs
git status --short              # must stay clean apart from the intended files
diff -q "E:/Betimes/BT-note/.obsidian/plugins/nested-outline-numbering/main.js" main.js   # vault parity check
npx eslint .                    # BLOCKED today: eslint + eslint-plugin-obsidianmd not installed
gh release view 1.1.0 --json assets                                                     # after release
```

Copy `main.js`, `manifest.json`, `styles.css` into the vault plugin folder for AC4, and copy
them back out of the release before AC6.

## 7. Lanes for the handoff

- **L1 - CORE range entry** - TASK: add `indentRange` / `outdentRange` (+ heading range mirror)
  by splitting transform from renumber in `main.js` CORE. DELIVERABLE: new CORE exports and the
  per-line functions still producing their current output. SCOPE: `main.js` CORE section only.
  VERIFY: `node test/core.test.js` stays 81/81 unchanged. STOP WHEN: existing suite is green
  with the refactor and no test was edited. depends_on: none.
- **L2 - tests first for the range cases** - TASK: write the AC2 assertions against the new
  range entry. DELIVERABLE: new assertions in `test/core.test.js`. SCOPE: `test/core.test.js`.
  VERIFY: assertions fail before L1 lands and pass after. STOP WHEN: AC2 list covered.
  depends_on: L1 (for the final green run; the assertions may be written first).
- **L3 - plugin dispatch and selection restore** - TASK: `runAction` uses the selection range,
  keeps the fall-through rule, restores the selection. DELIVERABLE: changed PLUGIN section.
  SCOPE: `main.js` PLUGIN section. VERIFY: AC4 by hand in the vault; CORE suite untouched.
  STOP WHEN: AC4 passes for list and heading selections. depends_on: L1, L2.
- **L4 - version, docs, release** - TASK: bump versions, changelog, README + Thai README,
  publish `1.1.0` with assets. DELIVERABLE: release `1.1.0`, green `attest.yml`.
  SCOPE: `manifest.json`, `package.json`, `CHANGELOG.md`, `README.md`, `docs/README.th.md`.
  VERIFY: AC6 commands. STOP WHEN: attest job green and the directory entry still resolves.
  depends_on: L3.

## 8. Handoff (prepared, not started)

Executor choice is deliberately open: this OMH install is configured `default_executor: "choose"`
with `dispatch_policy: "ask_before_dispatch"` (`~/.omh/setup-profile.json`), so the person picks
the executor before anything is dispatched. Options on this machine: the `codex` CLI
(`C:\Users\aimze\AppData\Local\Programs\OpenAI\Codex\bin\codex`), `claude-code`, `opencode`, or
Hermes editing the repo directly - recommended for a change this size, because the test suite is
the whole build and the file is 745 lines.

Per OMH rules the follow-on engine (or executor dispatch) starts only on the person's explicit
go-ahead in this conversation. Plan acceptance approves content, not execution.

## 9. Open items and evidence gaps

1. Scope assumption in section 0 is unconfirmed (no person available at intake).
2. `omh hermes plan --record` / `plan-accept` are **not available on this machine** (no `omh`
   executable on PATH, no `omh` Python module, no plan tool in the OMH plugin surface), so this
   file was written directly as the plan record and acceptance is tracked only as a chat decision.
3. `npx eslint .` cannot run (RK7).
4. App-level selection behaviour is unverified until AC4 is done inside Obsidian.
5. `.omh/` is not in the repo's `.gitignore`, so this artifact shows up as untracked in
   `git status` for that repo - intended (plan artifacts live under `<repo>/.omh/plans/`), and it
   never affects the release assets.

## 10. Rejected ideas (kept out of accepted scope)

- O2 (loop per-line functions over the selection), O3 (never consume the key), O4 (settings tab).
- Enter on a multi-line selection; changing the two-space indent format; mobile key bindings.
- Committing anything in the repo, or touching the release/public surface, from the planning run.
