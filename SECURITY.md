# Security policy

## Reporting a vulnerability

Use [GitHub's private report form](https://github.com/AlungranPJ/obsidian-nested-outline-numbering/security/advisories/new).
An ordinary issue is public, and a report about a plugin that edits notes should not be
public before it is fixed.

Include the plugin version, the Obsidian version, and the smallest note that shows the
problem.

## What the plugin can reach

`main.js` imports three modules, all supplied by the host application:

- `obsidian`
- `@codemirror/state`
- `@codemirror/view`

Settings are read and written through Obsidian's own plugin data API (`loadData` and
`saveData`, which is `data.json` inside the plugin folder). There is no network access,
no telemetry, no filesystem API, no child process, and no third-party dependency.

Everything the plugin does is a text edit in an editor Obsidian owns. Obsidian decides
when that edit reaches disk.

## In scope

- A note's content, or a number template, causing the plugin to run code, read a file, or
  send anything anywhere.
- Note content being lost beyond the edit that was asked for.
- A template or a pasted line making the plugin write outside the line it was working on.

## Out of scope

- Numbering that comes out wrong, or a key that does not respond. Those are ordinary
  bugs: please open an issue.
- Anything that requires a modified copy of the plugin, or a modified Obsidian.
