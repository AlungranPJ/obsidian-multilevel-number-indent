# Multilevel list section, and a list that can run on

This release is about where the commands live, and where a list starts.

- **A right-click menu of its own.** Every command is grouped under **Multilevel list section** in the editor's context menu, so the plugin's commands read as its own instead of being scattered through the menu.
- **`Continue numbering past this heading`** and **`Restart numbering at this heading`**, the two things Word lets you do with a list at a heading. Continue runs the count straight on across the heading. Restart starts again at `1.`. The choice rides on the heading line as an HTML comment, which reading view and `Copy as clean text` both drop.
- **Smart placement for pasted numbers.** `1.1 text` and `1.1.1 text`, written without the closing mark, are now taken off whole instead of leaving the last segment behind in the text, and the number's own segments say how deep the item sits. A ragged indent can no longer push an item down a level.
- Fixed: a line indented four spaces is read by the host as an indented code block, and that block's tint and its top and bottom rules showed up as odd lines around a deep item. They are cleared now.