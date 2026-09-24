/*
 * Unit tests for the pure core of Multilevel Number Indent.
 * Run with:  node test/core.test.js
 *
 * Obsidian and CodeMirror are stubbed so main.js can be required in plain Node.
 */
"use strict";

const Module = require("module");
const path = require("path");

/* Small doubles for the Obsidian UI surface, so the settings tab can be built
 * and inspected in Node. Only the methods the tab actually calls are here. */
class FakeEl {
	constructor(tag, o) {
		const options = o || {};
		this.tag = tag;
		this.attrs = Object.assign({}, options);
		this.children = [];
		this.textContent = options.text || "";
	}
	empty() {
		this.children.length = 0;
	}
	createEl(tag, o) {
		const el = new FakeEl(tag, o);
		this.children.push(el);
		return el;
	}
	createDiv(o) {
		return this.createEl("div", o);
	}
}

class FakeComponent {
	constructor() {
		this.inputEl = {};
	}
	setValue(value) {
		this.value = value;
		return this;
	}
	setPlaceholder(placeholder) {
		this.placeholder = placeholder;
		return this;
	}
	addOption(value, label) {
		if (!this.options) this.options = {};
		this.options[value] = label;
		return this;
	}
	onChange(fn) {
		this.change = fn;
		return this;
	}
}

class FakeButton {
	setButtonText(text) {
		this.text = text;
		return this;
	}
	setTooltip(tooltip) {
		this.tooltip = tooltip;
		return this;
	}
	setCta() {
		this.cta = true;
		return this;
	}
	setDisabled(disabled) {
		this.disabled = disabled;
		return this;
	}
	onClick(fn) {
		this.click = fn;
		return this;
	}
}

class FakeModal {
	constructor(app) {
		this.app = app;
		this.contentEl = new FakeEl("div");
		this.closed = false;
	}
	open() {
		this.onOpen();
	}
	close() {
		this.closed = true;
		this.onClose();
	}
	empty() {
		this.contentEl.empty();
	}
}

class FakeSetting {
	constructor(container) {
		this.container = container;
		this.name = null;
		this.desc = "";
		this.isHeading = false;
		this.kind = null;
		this.component = null;
		container.children.push(this);
	}
	setName(name) {
		this.name = name;
		return this;
	}
	setDesc(desc) {
		this.desc = desc;
		return this;
	}
	setHeading() {
		this.isHeading = true;
		return this;
	}
	addDropdown(cb) {
		return this.add("dropdown", cb);
	}
	addText(cb) {
		return this.add("text", cb);
	}
	addToggle(cb) {
		return this.add("toggle", cb);
	}
	addTextArea(cb) {
		return this.add("textarea", cb);
	}
	addButton(cb) {
		return this.add("button", cb);
	}
	/* A setting row can carry more than one component, so they are kept per
	 * kind in the order they were added. `kind` and `component` stay on the
	 * first one, which is what the row is identified by. */
	add(kind, cb) {
		if (!this.kind) this.kind = kind;
		const component = kind === "button" ? new FakeButton() : new FakeComponent();
		if (!this.component) this.component = component;
		if (!this.parts) this.parts = {};
		if (!this.parts[kind]) this.parts[kind] = [];
		this.parts[kind].push(component);
		cb(component);
		return this;
	}
}

class FakePluginSettingTab {
	constructor(app, plugin) {
		this.app = app;
		this.plugin = plugin;
		this.containerEl = new FakeEl("div");
	}
}

const stub = {
	Plugin: class {},
	PluginSettingTab: FakePluginSettingTab,
	Setting: FakeSetting,
	MarkdownView: class {},
	Modal: FakeModal,
	ButtonComponent: FakeButton,
	editorInfoField: {},
	Prec: { highest: (x) => x, high: (x) => x },
	keymap: { of: (x) => x },
	Decoration: { line: (spec) => ({ spec }), set: (items) => items },
	ViewPlugin: { fromClass: () => ({}) },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
	if (request === "obsidian" || request.startsWith("@codemirror/")) return stub;
	return originalLoad.call(this, request, parent, isMain);
};

const core = require(path.join(__dirname, "..", "main.js")).__core;

/* ------------------------------ harness ------------------------------ */

let passed = 0;
const failures = [];

function check(name, actual, expected) {
	const a = JSON.stringify(actual);
	const e = JSON.stringify(expected);
	if (a === e) {
		passed++;
		console.log("  ok   " + name);
	} else {
		failures.push(name);
		console.log("  FAIL " + name);
		console.log("       expected: " + e);
		console.log("       actual:   " + a);
	}
}

const doc = [
	"1. alpha",
	"  1.1. beta",
	"  1.2. gamma",
	"    1.2.1. delta",
	"    1.2.2. epsilon",
	"  1.3. zeta",
	"2. eta",
];

const lines = (r) => (r === null ? null : r.lines);

/* --------------------------- module shape --------------------------- */

/* Obsidian's loader reads the plugin class off module.exports. Nothing else in
 * this file would notice if that changed, so check it here too. */
console.log("module exports (how Obsidian's loader reads the file)");
const entry = require(path.join(__dirname, "..", "main.js"));
check("main.js exports a constructor", typeof entry, "function");
check("module.exports.default is set too", typeof entry.default, "function");
check("default is the same class", entry.default === entry, true);
check("the class can be loaded by the host", typeof entry.prototype.onload, "function");
check("__core is exposed for these tests", typeof entry.__core, "object");
check("__core is the same object on both require paths", entry.__core === core, true);

/* ------------------------------ parse ------------------------------ */

console.log("parseLine");
check("root item", core.parseLine("1. alpha"), {
	indent: "",
	number: "1.",
	content: "alpha",
	columns: 0,
});
check("nested item", core.parseLine("  1.2. gamma").columns, 2);
check("deep item", core.parseLine("    1.2.3.4. x").number, "1.2.3.4.");
check("level 3 columns", core.parseLine("    1.2.3. x").columns, 4);
check("level 4 restarts with a bracket", core.parseLine("      1) x"), {
	indent: "      ",
	number: "1)",
	content: "x",
	columns: 6,
});
check("level 5 keeps the local path", core.parseLine("        1.1) x").number, "1.1)");
check("a bracket number is owned even at the margin", core.parseLine("1) x").number, "1)");
check("the level comes from the indent, not the number", core.parseLine("      1.1.9. x").columns, 6);
check("a bracket without a space is ignored", core.parseLine("1)x"), null);
check("no trailing dot is ignored", core.parseLine("1.1 beta"), null);
check("heading is ignored", core.parseLine("## beta"), null);
check("bullet is ignored", core.parseLine("- beta"), null);
check("plain text is ignored", core.parseLine("beta"), null);

/* ------------------------------ indent ------------------------------ */

console.log("indentItem");
check("first child cannot indent (nothing to be a child of)", core.indentItem(doc, 1), null);
check("first grandchild cannot indent either", core.indentItem(["1. a", "  1.1. b", "    1.1.1. c"], 2), null);
check("a later sibling can indent under the one above it", lines(core.indentItem(doc, 5)), [
	"1. alpha",
	"  1.1. beta",
	"  1.2. gamma",
	"    1.2.1. delta",
	"    1.2.2. epsilon",
	"    1.2.3. zeta",
	"2. eta",
]);
check("second sibling indents and takes its subtree", lines(core.indentItem(doc, 2)), [
	"1. alpha",
	"  1.1. beta",
	"    1.1.1. gamma",
	"      1) delta",
	"      2) epsilon",
	"  1.2. zeta",
	"2. eta",
]);
check("level 3 indents into a bracket number", lines(core.indentItem(["1. a", "  1.1. b", "  1.2. c", "    1.2.1. d", "    1.2.2. e"], 4)), [
	"1. a",
	"  1.1. b",
	"  1.2. c",
	"    1.2.1. d",
	"      1) e",
]);

/* ------------------------------ outdent ------------------------------ */

console.log("outdentItem");
const indented = lines(core.indentItem(doc, 2));
check("outdent undoes the indent", lines(core.outdentItem(indented, 2)), doc);
check("outdent at the top level falls through", core.outdentItem(doc, 0), null);
check("outdent ignores a plain line", core.outdentItem(["plain"], 0), null);
check("outdent turns 1) back into the dotted level 3", lines(core.outdentItem(["1. a", "  1.1. b", "    1.1.1. c", "      1) d"], 3)), [
	"1. a",
	"  1.1. b",
	"    1.1.1. c",
	"    1.1.2. d",
]);

/* ------------------------------- enter ------------------------------- */

console.log("newSibling");
const entered = core.newSibling(doc, 2, "  1.2. gamma".length);
check("enter makes the next sibling at the same depth", entered.lines, [
	"1. alpha",
	"  1.1. beta",
	"  1.2. gamma",
	"  1.3. ",
	"    1.3.1. delta",
	"    1.3.2. epsilon",
	"  1.4. zeta",
	"2. eta",
]);
check("caret lands after the new prefix", entered.caretCh, "  1.3. ".length);
check("enter on a prefix-only line leaves the block", lines(core.newSibling(["1. a", "  1.1. "], 1, 7)), ["1. a", ""]);
check("enter splits at the caret", lines(core.newSibling(["1. alpha"], 0, 3)), ["1. ", "2. alpha"]);
check("enter ignores a plain line", core.newSibling(["plain"], 0, 5), null);

/* ------------------------------- move ------------------------------- */

console.log("moveItem");
check("move down swaps with the next sibling", lines(core.moveItem(doc, 2, "down")), [
	"1. alpha",
	"  1.1. beta",
	"  1.2. zeta",
	"  1.3. gamma",
	"    1.3.1. delta",
	"    1.3.2. epsilon",
	"2. eta",
]);
check("move up swaps with the previous sibling", lines(core.moveItem(doc, 2, "up")), [
	"1. alpha",
	"  1.1. gamma",
	"    1.1.1. delta",
	"    1.1.2. epsilon",
	"  1.2. beta",
	"  1.3. zeta",
	"2. eta",
]);
check("move up at the top of a level does nothing", core.moveItem(doc, 1, "up"), null);
check("move down at the end of a level does nothing", core.moveItem(doc, 5, "down"), null);
check("first root item cannot move up", core.moveItem(doc, 0, "up"), null);
check("last root item cannot move down", core.moveItem(doc, 6, "down"), null);
check("move ignores a plain line", core.moveItem(["plain"], 0, "down"), null);

console.log("moveItem keeps the caret on the moved item");
const movedDown = core.moveItem(doc, 2, "down");
check("caret follows a downward move", movedDown.lines[movedDown.caretLine], "  1.3. gamma");
const movedUp = core.moveItem(doc, 2, "up");
check("caret follows an upward move", movedUp.lines[movedUp.caretLine], "  1.1. gamma");
check("caret never lands on the swapped sibling", movedUp.lines[movedUp.caretLine].includes("gamma"), true);

/* --------------------------- fall-through --------------------------- */

console.log("fall-through (the key must reach Obsidian untouched)");
for (const action of ["indent", "outdent", "enter", "moveUp", "moveDown"]) {
	check(action + " on plain text", core.applyAction(["hello", "world"], 0, 2, action), null);
}
check("indent inside a code fence", core.indentItem(["```", "1. inside", "```", "1. outside"], 1), null);
check("enter inside a code fence", core.newSibling(["```", "1. inside", "```"], 1, 10), null);
check("item without the trailing dot is not owned", core.applyAction(["1.1 beta"], 0, 2, "indent"), null);

/* ---------------------------- renumber ---------------------------- */

console.log("renumberRange");
const messy = ["3. a", "  9.9. b", "    9.9.9. c"];
core.renumberRange(messy, 0, messy.length - 1);
check("normalises every level", messy, ["1. a", "  1.1. b", "    1.1.1. c"]);

const gapped = ["1. a", "  1.1. b", "    1.1.1. c", "1.2. d"];
core.renumberRange(gapped, 0, gapped.length - 1);
check("a shallower line ends the nested run", gapped, ["1. a", "  1.1. b", "    1.1.1. c", "2. d"]);

const withBlank = ["1. a", "", "  1.1. b"];
core.renumberRange(withBlank, 0, 2);
check("blank lines stay inside the block", withBlank, ["1. a", "", "  1.1. b"]);

const separated = ["1. a", "", "plain text", "", "1. b"];
core.renumberRange(separated, 0, 4);
check("plain text starts a new block", separated, ["1. a", "", "plain text", "", "1. b"]);

const fenced = ["1. a", "```", "9.9. not ours", "```", "1. b"];
core.renumberRange(fenced, 0, 4);
check("code fences are never renumbered", fenced, ["1. a", "```", "9.9. not ours", "```", "1. b"]);

const deep = ["1. a", "  1.1. b", "    1.1.1. c", "      1.1.1.1. d", "      1.1.1.2. e", "        1.1.1.2.1. f"];
core.renumberRange(deep, 0, deep.length - 1);
check("level 4 restarts at 1) and level 5 follows it", deep, [
	"1. a",
	"  1.1. b",
	"    1.1.1. c",
	"      1) d",
	"      2) e",
	"        2.1) f",
]);

const reBracketed = ["1. a", "  1.1. b", "  1) c", "  2) d"];
core.renumberRange(reBracketed, 0, 3);
check("a bracket number at level 2 is normalised to the dotted form", reBracketed, [
	"1. a",
	"  1.1. b",
	"  1.2. c",
	"  1.3. d",
]);

/* --------------------------- block helpers --------------------------- */

console.log("insertNumbering / removeNumbering");
const outline = ["alpha", "  beta", "    gamma", "  delta"];
const numbered = core.insertNumbering(outline, 0, 3);
check("insert turns an indented outline into numbering", numbered, [
	"1. alpha",
	"  1.1. beta",
	"    1.1.1. gamma",
	"  1.2. delta",
]);
check("remove strips the numbers again", core.removeNumbering(numbered, 0, 3), outline);
check("insert ignores a line that already has a number", core.insertNumbering(["1. a"], 0, 0), null);

console.log("clearFormatting");
const foreign = ["1.1 alpha", "    1.1.1) beta", "      - gamma", "      > a quote", "## 1.2. Title"];
check("clear takes every number off and keeps the indent", core.clearFormatting(foreign, 0, 4), [
	"alpha",
	"    beta",
	"      gamma",
	"      > a quote",
	"## Title",
]);
check("clear keeps the indent of a deep item", core.clearFormatting(["    1.1. deep"], 0, 0), ["    deep"]);
check("clear takes a bullet but not a blockquote", core.clearFormatting(["- one", "> two"], 0, 1), ["one", "> two"]);
check("clear leaves prose alone", core.clearFormatting(["plain words"], 0, 0), null);
check("clear takes the number off a heading", core.clearFormatting(["# 2026 Report"], 0, 0), ["# Report"]);

/* ------------------------------ headings ------------------------------ */

console.log("parseHeading");
check("h2", core.parseHeading("## Title"), { level: 2, text: "Title" });
check("h6", core.parseHeading("###### deep").level, 6);
check("seven hashes is not a heading", core.parseHeading("####### x"), null);
check("no space after the hashes is not a heading", core.parseHeading("#Title"), null);
check("a numbered line is not a heading", core.parseHeading("1. item"), null);

console.log("headingNumbers");
const note = ["# Alpha", "body", "## Beta", "### Gamma", "## Delta", "# Epsilon"];
check("counters per level", core.headingNumbers(note).map((x) => x.number), ["1", "1.1", "1.1.1", "1.2", "2"]);
check("a skipped level is filled in", core.headingNumbers(["# A", "### C"]).map((x) => x.number), ["1", "1.1.1"]);
check("a note that starts at h2", core.headingNumbers(["## B", "## C"]).map((x) => x.number), ["1.1", "1.2"]);
check("headings inside code fences are skipped", core.headingNumbers(["# A", "```", "# not a heading", "```", "## B"]).map((x) => x.number), ["1", "1.1"]);
check("level 4 headings restart with a bracket", core.headingNumbers(["# A", "## B", "### C", "#### D", "##### E"]).map((x) => x.number), [
	"1",
	"1.1",
	"1.1.1",
	"1)",
	"1.1)",
]);

console.log("numberHeadings / removeHeadingNumbers");
const plainNote = ["# Alpha", "text", "## Beta", "### Gamma", "## Delta", "# Epsilon"];
const numberedNote = core.numberHeadings(plainNote);
check("numbers get written into the file", numberedNote, [
	"# 1 Alpha",
	"text",
	"## 1.1 Beta",
	"### 1.1.1 Gamma",
	"## 1.2 Delta",
	"# 2 Epsilon",
]);
check("remove strips them again", core.removeHeadingNumbers(numberedNote), plainNote);
check("numbering twice changes nothing", core.numberHeadings(numberedNote), null);
check("a deep heading gets a bracket number", core.numberHeadings(["# A", "### C", "#### D"]), [
	"# 1 A",
	"### 1.1.1 C",
	"#### 1) D",
]);
check("a bracket number is stripped from a heading", core.stripHeadingNumber("1) Title"), "Title");

console.log("shiftHeadingLevel");
const shiftable = ["# 1 Alpha", "## 1.1 Beta", "text under beta", "# 2 Epsilon"];
const deepened = core.shiftHeadingLevel(shiftable, 0, 1);
check("tab deepens the heading and renumbers the note", deepened.lines, [
	"## 1.1 Alpha",
	"## 1.2 Beta",
	"text under beta",
	"# 2 Epsilon",
]);
check("shift+tab lifts it back", core.shiftHeadingLevel(deepened.lines, 0, -1).lines, shiftable);
check("h1 cannot go shallower", core.shiftHeadingLevel(shiftable, 0, -1), null);
check("h6 cannot go deeper", core.shiftHeadingLevel(["###### deep"], 0, 1), null);
check("nothing is renumbered while the note has no numbers", core.shiftHeadingLevel(["# Alpha", "## Beta"], 0, 1).lines, ["## Alpha", "## Beta"]);

console.log("moveHeading");
const sections = ["# 1 A", "body a", "## 1.1 A1", "## 1.2 A2", "# 2 B"];
const sectionMove = core.moveHeading(sections, 2, "down");
check("alt+down swaps two sections", sectionMove.lines, ["# 1 A", "body a", "## 1.1 A2", "## 1.2 A1", "# 2 B"]);
check("the caret follows to the moved heading", sectionMove.lines[sectionMove.caretLine], "## 1.2 A1");
check("alt+up swaps back", core.moveHeading(sections, 3, "up").lines, ["# 1 A", "body a", "## 1.1 A2", "## 1.2 A1", "# 2 B"]);
check("the first heading of a level cannot move up", core.moveHeading(sections, 2, "up"), null);
check("the last heading of a level cannot move down", core.moveHeading(sections, 3, "down"), null);

/* ---------------------------- scenario ---------------------------- */

console.log("scenario: typing a fresh outline");
let doc2 = ["1. alpha"];
const step = (action, line, ch) => {
	const r = core.applyAction(doc2, line, ch, action);
	if (r) doc2 = r.lines;
	return doc2;
};
step("enter", 0, "1. alpha".length);
check("enter starts the next sibling", doc2, ["1. alpha", "2. "]);
doc2[1] = "2. beta";
step("enter", 1, "2. beta".length);
check("enter again", doc2, ["1. alpha", "2. beta", "3. "]);
doc2[2] = "3. gamma";
step("indent", 2, "3. gamma".length);
check("tab makes it a child of the line above", doc2, ["1. alpha", "2. beta", "  2.1. gamma"]);
step("enter", 2, "  2.1. gamma".length);
check("enter inside the child level", doc2, ["1. alpha", "2. beta", "  2.1. gamma", "  2.2. "]);
doc2[3] = "  2.2. delta";
step("indent", 3, "  2.2. delta".length);
check("tab again nests one deeper", doc2, [
	"1. alpha",
	"2. beta",
	"  2.1. gamma",
	"    2.1.1. delta",
]);
step("moveDown", 1, 0);
check("alt+down on the last root item does nothing", doc2, [
	"1. alpha",
	"2. beta",
	"  2.1. gamma",
	"    2.1.1. delta",
]);
step("moveDown", 2, 0);
check("alt+down on a last child does nothing either", doc2, [
	"1. alpha",
	"2. beta",
	"  2.1. gamma",
	"    2.1.1. delta",
]);
step("outdent", 3, 0);
check("shift+tab pulls delta up one level", doc2, [
	"1. alpha",
	"2. beta",
	"  2.1. gamma",
	"  2.2. delta",
]);
step("moveUp", 3, 0);
check("alt+up swaps the two children and the caret follows", doc2, [
	"1. alpha",
	"2. beta",
	"  2.1. delta",
	"  2.2. gamma",
]);
check("caret is on the moved line", doc2[2], "  2.1. delta");

/* --------------------------- caret placement --------------------------- */

console.log("prefixLength");
check("numbered line", core.prefixLength("  1.1. text"), "  1.1. ".length);
check("prefix-only line", core.prefixLength("  1.1. "), "  1.1. ".length);
check("bracket line", core.prefixLength("      1) x"), "      1) ".length);
check("numbered heading", core.prefixLength("### 1.1.1 Title"), "### 1.1.1 ".length);
check("heading without a number", core.prefixLength("### Title"), "### ".length);
check("plain line", core.prefixLength("hello"), null);

console.log("caretAfter");
/* The reported bug: Tab used to add only the indent to the old offset, so the
 * caret landed inside the new number (`1.1|.` instead of `1.1. |`). */
const tabDoc = ["1. a", "2. ", "3. c"];
const tabbed = core.indentItem(tabDoc, 1);
check("tab deepens a bare number", tabbed.lines[1], "  1.1. ");
check("the caret ends up after the whole new number", core.caretAfter(tabDoc[1], tabbed.lines[1], tabDoc[1].length), "  1.1. ".length);
check("a bracket line keeps the caret at its end", core.caretAfter("    1.2.2. ", "      1) ", 11), "      1) ".length);
check("the caret stays inside the content", core.caretAfter("1. hello", "  1.1. hello", 8), "  1.1. hello".length);
check("a caret parked in the prefix moves to the content start", core.caretAfter("1. hello", "  1.1. hello", 1), "  1.1. ".length);
check("a heading keeps the caret after its number", core.caretAfter("## 1.1 Title", "### 1.1.1 Title", 7), "### 1.1.1 ".length);
check("an unnumbered line is left alone", core.caretAfter("hello", "world", 3), 3);

/* ---------------------------- minimalChange ---------------------------- */
console.log("minimalChange");
check("single character insert", core.minimalChange("abc", "abXc"), { from: 2, to: 2, insert: "X" });
check("replace in the middle", core.minimalChange("1. a\n2. b", "1. a\n3. b"), { from: 5, to: 6, insert: "3" });
check("no change", core.minimalChange("same", "same"), { from: 4, to: 4, insert: "" });
check("offsetToPos", core.offsetToPos("ab\ncd", 4), { line: 1, ch: 1 });

/* ---------------------------- number formats ---------------------------- */

console.log("placeholder styles");
check("placholder count", core.placeholderCount("1.1.1."), 3);
check("placeholder count ignores literals", core.placeholderCount("1)"), 1);
check("letters start at A", core.alpha(1), "A");
check("letters roll over", core.alpha(27), "AA");
check("letters keep rolling", core.alpha(28), "AB");
check("roman", core.roman(1990), "MCMXC");
check("arabic style", core.renderTemplate("1", [7], 0), "7");
check("lower letters style", core.renderTemplate("a)", [2], 0), "b)");
check("upper letters style", core.renderTemplate("A)", [27], 0), "AA)");
check("lower roman style", core.renderTemplate("i.", [4], 0), "iv.");
check("upper roman style", core.renderTemplate("I.", [4], 0), "IV.");
check("literal separators survive", core.renderTemplate("1-1-", [1, 2], 1), "1-2-");
check("a template without a placeholder renders its literals", core.renderTemplate("--", [1], 0), "--");
check("a heading drops the closing dot", core.headingTemplate("1.1."), "1.1");
check("a heading keeps a closing bracket", core.headingTemplate("1.1)"), "1.1)");
check("templateFor reuses the last level", core.templateFor(["1.", "1.1."], 9), "1.1.");

console.log("normaliseFormats / setConfig");
check("the shipped defaults", core.getConfig().formats, ["1.", "1.1.", "1.1.1.", "1)", "1.1)", "1.1.1)"]);
/* Contract change in 3.0.0: the list keeps the length the user chose (2..12)
 * instead of always padding to six, so the tab can add or drop levels. The
 * position guarantee is unchanged: a blank row still takes the default for its
 * own level instead of shifting every level below it. */
check("a blank row takes the default for its level", core.normaliseFormats(["1.", "", "1.1.1."]), [
	"1.",
	"1.1.",
	"1.1.1.",
]);
check("a row without a placeholder is replaced, never dropped", core.normaliseFormats(["a.", "..."]), [
	"a.",
	"1.1.",
]);
check("the length the user chose is kept", core.normaliseFormats(["1.", "1.1."]).length, 2);
check("a single row is lifted to the two level minimum", core.normaliseFormats(["1."]).length, 2);
check("the list is capped at the maximum", core.normaliseFormats(new Array(40).fill("1.")).length, 12);
check("an empty list falls back to two usable levels", core.normaliseFormats([]), ["1.", "1.1."]);
check("a non-whitespace indent is refused", core.setConfig({ indent: "x" }).indent, "  ");
check("a tab indent is accepted", core.setConfig({ indent: "\t" }).indent, "\t");
core.setConfig({ indent: "  " });

console.log("a custom format drives the numbering");
core.setConfig({ formats: ["1.", "1.1.", "1.1.1.", "1.1.1.1.", "1.1.1.1.1.", "1.1.1.1.1.1."] });
const allDotted = ["9. a", "  9.9. b", "    9.9.9. c", "      9.9.9.9. d", "        9.9.9.9.9. e"];
core.renumberRange(allDotted, 0, allDotted.length - 1);
check("a deep level keeps the dotted shape when told to", allDotted, [
	"1. a",
	"  1.1. b",
	"    1.1.1. c",
	"      1.1.1.1. d",
	"        1.1.1.1.1. e",
]);

core.setConfig({ formats: ["1)", "1.1)", "1.1.1)", "1.1.1.1)", "1.1.1.1.1)"] });
const allBracket = ["1. a", "  1.1. b", "    1.1.1. c", "      1.1.1.1. d", "        1.1.1.1.1. e"];
core.renumberRange(allBracket, 0, allBracket.length - 1);
check("an all-bracket format", allBracket, [
	"1) a",
	"  1.1) b",
	"    1.1.1) c",
	"      1.1.1.1) d",
	"        1.1.1.1.1) e",
]);

core.setConfig({ formats: ["a.", "a.a.", "a.a.a."] });
const lettered = ["5. a", "  5.5. b", "    5.5.5. c"];
core.renumberRange(lettered, 0, lettered.length - 1);
check("letters", lettered, ["a. a", "  a.a. b", "    a.a.a. c"]);

core.setConfig({ formats: ["I.", "I.I.", "I.I.I.", "I.I.I.I."] });
const romans = ["5. a", "  5.5. b", "    5.5.5. c", "      5.5.5.5. d"];
core.renumberRange(romans, 0, romans.length - 1);
check("roman numerals", romans, ["I. a", "  I.I. b", "    I.I.I. c", "      I.I.I.I. d"]);

console.log("a custom indent");
core.setConfig({ indent: "    ", formats: core.DEFAULT_SETTINGS.formats });
check("indenting uses the configured unit", lines(core.indentItem(["1. a", "  1.1. b", "  1.2. c"], 2)), [
	"1. a",
	"    1.1. b",
	"        1.1.1. c",
]);
core.setConfig({ indent: "  " });

console.log("recognition survives a format change");
core.setConfig({ formats: ["a.", "a.a."] });
check("the configured format is owned", core.parseLine("b. text") !== null, true);
check("a dotted number from before the change is still owned", core.parseLine("1.1. legacy") !== null, true);
core.setConfig({ indent: "  ", formats: core.DEFAULT_SETTINGS.formats });
check("a letter number is not owned while the format is dotted", core.parseLine("b. text"), null);

console.log("previewLines");
check("the preview spells out the shipped defaults", core.previewLines(core.DEFAULT_SETTINGS.formats, "  ", 6), [
	"1. Introduction",
	"  1.1. Scope",
	"    1.1.1. Detail",
	"      1) Point",
	"        1.1) Sub-point",
	"          1.1.1) Deeper detail",
]);
check("the preview follows a custom indent", core.previewLines(["1."], "\t", 2), ["1. Introduction", "\t1. Scope"]);
check("the settings are back to the defaults", core.getConfig().formats, core.DEFAULT_SETTINGS.formats);

/* --------------------------- 3.0.0 features --------------------------- */

console.log("Thai number styles");
check("Thai digits render", core.thaiDigit(21), "๒๑");
check("Thai zero renders", core.thaiDigit(0), "๐");
check("Thai letters render", core.thaiLetter(1), "ก");
check("the last Thai letter in the set", core.thaiLetter(41), "ฮ");
check("Thai letters roll over at the end of the set", core.thaiLetter(42), "กก");
check("a Thai template renders a path", core.renderNumber([1, 2], 1, ["ข้อ ๑.", "ข้อ ๑.๑."], true), "ข้อ ๑.๒.");
check("a Thai heading drops the closing dot", core.renderNumber([1, 2], 1, ["ข้อ ๑.", "ข้อ ๑.๑."], false), "ข้อ ๑.๒");
check("a Thai template recognises its own text", new RegExp(core.templateToRe("ข้อ ๑.๑.")).test("ข้อ ๑.๒. เรื่อง"), true);

console.log("the number of levels is a setting now");
check("the list keeps a short shape", core.normaliseFormats(["1.", "1.1.", "1.1.1."]).length, 3);
check("the list grows to the level asked for", core.normaliseFormats(new Array(8).fill("1.1.")).length, 8);
/* The preview is one line per level, so a short list shows what the deeper
 * levels become: the last configured template is reused. */
check("the preview reuses the last template below the levels", core.previewLines(["1.", "1.1."], "  ", 4), [
	"1. Introduction",
	"  1.1. Scope",
	"    1.1. Detail",
	"      1.1. Point",
]);

/* renumberRange works in place on the lines it is given. */
function v3Renumber(rows) {
	const out = rows.slice();
	core.renumberRange(out, 0, out.length - 1);
	return out;
}

console.log("the depth policy decides what a deeper line becomes");
check("reuse-last reuses the last template", core.stopsAt(4, ["1.", "1.1."], "reuse-last"), false);
check("unnumbered stops at the last level", core.stopsAt(2, ["1.", "1.1."], "unnumbered"), true);
check("unnumbered does not stop inside the levels", core.stopsAt(1, ["1.", "1.1."], "unnumbered"), false);
core.setConfig({ formats: ["1.", "1.1."], depthPolicy: "unnumbered" });
const stopped = v3Renumber(["1. alpha", "  9.9. beta", "    9.9.9. gamma"]);
check("a deeper line drops back to body text", stopped, ["1. alpha", "  1.1. beta", "    gamma"]);
check("Tab stops at the last level too", core.indentItem(["1. alpha", "  1.1. beta", "  1.2. gamma"], 2), null);
core.setConfig({ depthPolicy: "reuse-last" });
const reused = v3Renumber(["1. alpha", "  9.9. beta", "    9.9.9. gamma"]);
check("reuse-last keeps numbering every level", reused, ["1. alpha", "  1.1. beta", "    1.1. gamma"]);
check("an unknown policy is refused", core.setConfig({ depthPolicy: "sideways" }).depthPolicy, "reuse-last");
core.setConfig({ formats: core.DEFAULT_SETTINGS.formats, depthPolicy: core.DEFAULT_SETTINGS.depthPolicy });

console.log("presets");
check("the shipped presets are listed first", core.presetList([]).slice(0, core.BUILTIN_PRESETS.length), core.BUILTIN_PRESETS);
check("a saved preset joins the list", core.presetList([{ name: "Mine", formats: ["1."] }]).length, core.BUILTIN_PRESETS.length + 1);
check("a preset is found by name", core.presetByName("Legal style", []), ["1.", "1.1", "1.1(a)", "1.1(a)(i)"]);
check("an unknown preset is not found", core.presetByName("Nope", []), null);
check("a saved preset overrides a shipped one with the same name", core.presetByName("Thai", [{ name: "Thai", formats: ["1."] }]), ["1.", "1.1."]);
check("a valid JSON preset list is accepted", core.parsePresetsJson('[{"name":"Mine","formats":["a.","a.a."] }]').length, 1);
check("a valid list keeps the level count", core.parsePresetsJson('[{"name":"Mine","formats":["a.","a.a."] }]')[0].formats.length, 2);
check("bad JSON is refused as a whole", core.parsePresetsJson("{ nope"), null);
check("a nameless entry is refused", core.parsePresetsJson('[{"formats":["1."] }]'), null);
check("a row without a placeholder is refused", core.parsePresetsJson('[{"name":"Mine","formats":["nope"] }]'), null);
check("a half pasted document applies nothing", core.parsePresetsJson('[{"name":"Mine","formats":["1."] }, 5]'), null);
check("saved presets round trip through JSON", core.renderPresetsJson([{ name: "Mine", formats: ["1."] }]), '[\n\t{\n\t\t"name": "Mine",\n\t\t"formats": [\n\t\t\t"1."\n\t\t]\n\t}\n]');

console.log("per-note settings from the frontmatter");
check("a note without frontmatter has no overrides", core.parseNoteConfig("1. alpha\n"), {});
check("a note without a numbering block has no overrides", core.parseNoteConfig("---\ntitle: x\n---\n1. alpha\n"), {});
const noteCfg = core.parseNoteConfig('---\nnumbering:\n  indent: "\\t"\n  depth-policy: unnumbered\n  formats:\n    - "1."\n    - "1.1."\n---\n');
check("the indent is read", noteCfg.indent, "\t");
check("the depth policy is read", noteCfg.depthPolicy, "unnumbered");
check("the formats are read as a block list", noteCfg.formats, ["1.", "1.1."]);
const flowCfg = core.parseNoteConfig('---\nnumbering:\n  formats: ["a.", "a.a.", "a.a.a."]\n---\n');
check("a flow list works too", flowCfg.formats, ["a.", "a.a.", "a.a.a."]);
const badCfg = core.parseNoteConfig('---\nnumbering:\n  indent: "x"\n  depth-policy: sideways\n  formats:\n    - "nope."\n---\n');
check("an unusable indent is ignored", badCfg.indent, undefined);
check("an unknown policy is ignored", badCfg.depthPolicy, undefined);
check("a row without a placeholder falls back to the default", badCfg.formats, ["1.", "1.1."]);
check("a quoted tab is unescaped", core.parseScalar('"\\t"'), "\t");
check("a single quoted scalar keeps its text", core.parseScalar("'a\\t'"), "a\\t");
check("a bare scalar is trimmed", core.parseScalar("  ok  "), "ok");

console.log("normalize");
check("trailing whitespace goes", core.normalizeOutline(["1. alpha   "], 0, 0), ["1. alpha"]);
check("a jammed number gets its space back", core.normalizeOutline(["1.alpha"], 0, 0), ["1. alpha"]);
check("a long jammed number keeps its whole prefix", core.normalizeOutline(["1. alpha", "  1.1.beta"], 0, 1), ["1. alpha", "  1.1. beta"]);
check("an indent shorter than a unit grows into one", core.normalizeOutline(["1. alpha", " 1.1. beta"], 0, 1), ["1. alpha", "  1.1. beta"]);
check("the numbers follow the depth, not what was typed", core.normalizeOutline(["9. alpha", "  9.9. beta"], 0, 1), ["1. alpha", "  1.1. beta"]);
check("a note already in shape is left alone", core.normalizeOutline(["1. alpha"], 0, 0), null);
check("text without a number is never invented", core.normalizeOutline(["plain"], 0, 0), null);

console.log("smart paste");
check("bullets become numbers", core.ingestOutline("• alpha\n• beta"), ["1. alpha", "2. beta"]);
check("word numbers are taken off", core.ingestOutline("(1) alpha\n(2) beta"), ["1. alpha", "2. beta"]);
check("Thai markers are taken off", core.ingestOutline("๑. alpha\n๒. beta"), ["1. alpha", "2. beta"]);
check("a nested pasted list keeps its shape", core.ingestOutline("1. alpha\n   1.1. beta\n   1.2. gamma"), [
	"1. alpha",
	"  1.1. beta",
	"  1.2. gamma",
]);
check("a dotted path with no closing mark is taken off whole", core.ingestOutline("1. alpha\n 1.1 beta\n  1.1.1 gamma"), [
	"1. alpha",
	"  1.1. beta",
	"    1.1.1. gamma",
]);
check("the number's own depth places the item", core.ingestOutline("1. a\n 1.1 b\n 1.1.1 c"), [
	"1. a",
	"  1.1. b",
	"    1.1.1. c",
]);
check("a line that merely starts with a number stays prose", core.ingestOutline("1 alpha\n1. beta"), [
	"1. 1 alpha",
	"2. beta",
]);

console.log("restart and continue at a heading");
check("a heading splits the count by default", core.headingContinuation(["1. alpha", "2. beta", "## Two", "1. gamma", "2. delta"], 2, false), {
	lines: ["1. alpha", "2. beta", "## Two", "1. gamma", "2. delta"],
	caretLine: 2,
	caretCh: null,
});
check("continue runs the count on across a heading", core.headingContinuation(["1. alpha", "2. beta", "## Two", "1. gamma", "2. delta"], 2, true), {
	lines: ["1. alpha", "2. beta", "## Two <!--mni:continue-->", "3. gamma", "4. delta"],
	caretLine: 2,
	caretCh: null,
});
check("the mark never shows in the heading text", core.parseHeading("## Two <!--mni:continue-->"), { level: 2, text: "Two" });
check("continuing twice leaves one mark", core.headingContinuation(["1. alpha", "## Two <!--mni:continue-->", "2. beta"], 1, true), {
	lines: ["1. alpha", "## Two <!--mni:continue-->", "2. beta"],
	caretLine: 1,
	caretCh: null,
});
check("restart takes the mark back off", core.headingContinuation(["## Two <!--mni:continue-->", "3. gamma"], 0, false), {
	lines: ["## Two", "1. gamma"],
	caretLine: 0,
	caretCh: null,
});
check("a non-heading line is left alone", core.headingContinuation(["1. alpha"], 0, true), null);
check("blank lines survive the paste", core.ingestOutline("• alpha\n\n• beta"), ["1. alpha", "", "2. beta"]);
check("a plain list is still a list", core.ingestOutline("alpha\nbeta"), ["1. alpha", "2. beta"]);
check("one line of prose is not a list", core.looksLikeOutline("just one line of text"), false);
check("two bullets are a list", core.looksLikeOutline("• alpha\n• beta"), true);
check("two depths are a list", core.looksLikeOutline("alpha\n  beta"), true);

console.log("clean text");
check("a wiki link becomes its text", core.cleanForExport("see [[Note]] here"), "see Note here");
check("an alias wins", core.cleanForExport("[[Note|the note]]"), "the note");
check("an image keeps its alias", core.cleanForExport("![[pic.png|a picture]]"), "a picture");
check("a callout keeps its title", core.cleanForExport("> [!note] The title\n> body"), "The title\nbody");
check("a comment goes", core.cleanForExport("a %%hidden%% b"), "a  b");
check("emphasis goes", core.cleanForExport("**bold** and `code`"), "bold and code");
check("a heading mark goes", core.cleanForExport("## Title"), "Title");
check("a bullet goes", core.cleanForExport("- item"), "item");

console.log("rich output");
const v3Rows = ["1. alpha", "  1.1. beta & co"];
check("a nested list is real html", core.buildHtmlOutline(v3Rows, "list"), '<ol class="multilevel-number-indent"><li>alpha<ol><li>beta &amp; co</li></ol></li></ol>');
check("keeping the numbers puts them in the text", core.buildHtmlOutline(v3Rows, "keep-numbers"), '<ul class="multilevel-number-indent"><li>1. alpha<ul><li>1.1. beta &amp; co</li></ul></li></ul>');
check("rtf ends every line", core.buildRtfOutline(["1. alpha"]).endsWith("\\line }"), true);
check("rtf escapes braces", core.rtfEscape("a{b"), "a\\{b");

console.log("several lines at once");
const v3Group = ["1. alpha", "  1.1. one", "  1.2. beta", "    1.2.1. kid", "  1.3. gamma", "2. delta"];
const v3Indented = core.applyActionRange(v3Group, 2, 3, "indent");
check("a group indents one level with its subtree", v3Indented.lines, [
	"1. alpha",
	"  1.1. one",
	"    1.1.1. beta",
	"      1) kid",
	"  1.2. gamma",
	"2. delta",
]);
check("the caret stays on the first line of the group", v3Indented.caretLine, 2);
const v3Outdented = core.applyActionRange(v3Indented.lines, 2, 3, "outdent");
check("a group outdents one level", v3Outdented.lines, v3Group);
check("a group with no earlier sibling does not indent", core.applyActionRange(v3Group, 1, 2, "indent"), null);

/* Four siblings selected together, the case that used to fan out into a
 * staircase (1.1.4. / 1) / 1.1) / 1.1.1)). They must all move one level,
 * side by side, and the selection must stay on them for the next Tab. */
const v3Siblings = [
	"2. top",
	"  2.1. section",
	"    2.1.1. a",
	"    2.1.2. b",
	"  2.2. Agent orchestrator",
	"  2.3. Task manager engine",
	"  2.4. Context engine",
	"  2.5. Skill library",
	"  2.6. after",
];
const v3Row = core.applyActionRange(v3Siblings, 4, 7, "indent");
check("four selected siblings indent together, not as a staircase", v3Row.lines, [
	"1. top",
	"  1.1. section",
	"    1.1.1. a",
	"    1.1.2. b",
	"    1.1.3. Agent orchestrator",
	"    1.1.4. Task manager engine",
	"    1.1.5. Context engine",
	"    1.1.6. Skill library",
	"  1.2. after",
]);
check("the selection stays on the moved group", [v3Row.selectFrom, v3Row.selectTo], [4, 7]);
const v3Back = core.applyActionRange(v3Row.lines, 4, 7, "outdent");
check("Shift+Tab brings the same group back in one row", v3Back.lines.slice(4, 8), [
	"  1.2. Agent orchestrator",
	"  1.3. Task manager engine",
	"  1.4. Context engine",
	"  1.5. Skill library",
]);
const v3Kids = core.applyActionRange(["1. top", "  1.1. s", "  1.2. A", "    1.2.1. a1", "  1.3. B", "  1.4. C", "2. end"], 2, 5, "indent");
check("siblings with their own children keep their shape", v3Kids.lines, [
	"1. top",
	"  1.1. s",
	"    1.1.1. A",
	"      1) a1",
	"    1.1.2. B",
	"    1.1.3. C",
	"2. end",
]);

console.log("a group swaps with its neighbours");
const v3Swapped = core.applyActionRange(["1. alpha", "  1.1. a", "  1.2. b", "    1.2.1. c", "  1.3. d", "2. e"], 1, 2, "moveDown");
check("the whole group moves as one", v3Swapped.lines, [
	"1. alpha",
	"  1.1. d",
	"  1.2. a",
	"  1.3. b",
	"    1.3.1. c",
	"2. e",
]);
check("the caret follows the group", v3Swapped.lines[v3Swapped.caretLine], "  1.2. a");
check("the selection follows the group down", [v3Swapped.selectFrom, v3Swapped.selectTo], [2, 4]);

/* The selection survives every key: drag over a group, then Tab, Shift+Tab,
 * Alt+Down, Alt+Up in a row, and the same lines stay selected each time. The
 * editor here is a double that applies the transaction to a string. */
console.log("a selection stays on the group through every key");
function fakeEditor(lines, from, to) {
	let text = lines.join("\n");
	let sel = { from, to };
	const lineStart = (t, n) => t.split("\n").slice(0, n).reduce((a, l) => a + l.length + 1, 0);
	return {
		getValue: () => text,
		getCursor: (which) => (which === "to" ? sel.to : sel.from),
		transaction(tx) {
			for (const c of tx.changes) {
				const a = lineStart(text, c.from.line) + c.from.ch;
				const b = lineStart(text, c.to.line) + c.to.ch;
				text = text.slice(0, a) + c.text + text.slice(b);
			}
			if (tx.selection) sel = tx.selection;
		},
		lines: () => text.split("\n"),
		selected: () => {
			const all = text.split("\n");
			return all.slice(sel.from.line, sel.to.line + 1).map((l) => l.trim().replace(/^\S+\s/, ""));
		},
		isRange: () => sel.from.line !== sel.to.line || sel.from.ch !== sel.to.ch,
	};
}
const keyEd = fakeEditor(
	["1. top", "  1.1. first", "  1.2. A", "  1.3. B", "  1.4. last", "2. end"],
	{ line: 2, ch: 3 },
	{ line: 3, ch: 5 },
);
const keyPlugin = Object.create(entry.prototype);
const keyTrail = [];
for (const action of ["indent", "outdent", "moveDown", "moveUp", "moveUp"]) {
	const ok = keyPlugin.runAction(keyEd, action);
	keyTrail.push([action, ok, keyEd.isRange(), keyEd.selected().join("+")]);
}
check("Tab, Shift+Tab, Alt+Down and Alt+Up keep A and B selected", keyTrail, [
	["indent", true, true, "A+B"],
	["outdent", true, true, "A+B"],
	["moveDown", true, true, "A+B"],
	["moveUp", true, true, "A+B"],
	["moveUp", true, true, "A+B"],
]);
check("after the round trip the group sits above its old neighbour", keyEd.lines(), [
	"1. top",
	"  1.1. A",
	"  1.2. B",
	"  1.3. first",
	"  1.4. last",
	"2. end",
]);
const oneEd = fakeEditor(["1. top", "  1.1. a", "  1.2. b", "2. end"], { line: 2, ch: 0 }, { line: 2, ch: 7 });
keyPlugin.runAction(oneEd, "moveUp");
check("a single dragged line stays selected after Alt+Up", [oneEd.isRange(), oneEd.selected().join("+")], [true, "b"]);
const caretEd = fakeEditor(["1. top", "  1.1. a", "  1.2. b", "2. end"], { line: 2, ch: 7 }, { line: 2, ch: 7 });
keyPlugin.runAction(caretEd, "moveUp");
check("a plain caret stays a caret", caretEd.isRange(), false);

/* The case the live keystroke test caught: after one Tab the group has no
 * sibling above it to nest under, so a second Tab must leave it alone, still
 * selected, instead of pulling the caret's line out on its own. */
const stuckEd = fakeEditor(["1. top", "  1.1. first", "  1.2. A", "  1.3. B", "2. end"], { line: 2, ch: 3 }, { line: 3, ch: 6 });
keyPlugin.runAction(stuckEd, "indent");
const stuckBefore = stuckEd.lines().join("\n");
const stuckOk = keyPlugin.runAction(stuckEd, "indent");
check("a group that cannot go deeper stays put", stuckEd.lines().join("\n"), stuckBefore);
check("the blocked key is swallowed and the group stays selected", [stuckOk, stuckEd.selected().join("+")], [true, "A+B"]);
keyPlugin.runAction(stuckEd, "outdent");
check("the next key still moves the whole group", stuckEd.selected().join("+"), "A+B");
const topEd = fakeEditor(["1. top", "  1.1. A", "  1.2. B", "  1.3. c", "2. end"], { line: 1, ch: 0 }, { line: 2, ch: 4 });
check("Alt+Up at the top of the block keeps the group selected", [keyPlugin.runAction(topEd, "moveUp"), topEd.selected().join("+")], [true, "A+B"]);
const plainEd = fakeEditor(["plain one", "plain two", "1. item"], { line: 0, ch: 0 }, { line: 1, ch: 3 });
check("a selection over plain text is left to the host", keyPlugin.runAction(plainEd, "indent"), false);

console.log("cut and paste as a subtree");
const v3Cut = core.cutItem(["1. alpha", "  1.1. beta", "    1.1.1. gamma", "  1.2. delta"], 1);
check("a cut takes the item and its subtree", v3Cut.taken, ["  1.1. beta", "    1.1.1. gamma"]);
check("the block is renumbered after a cut", v3Cut.lines, ["1. alpha", "  1.1. delta"]);
const v3Pasted = core.pasteItem(["1. alpha", "  1.1. delta"], 0, ["2. moved", "  2.1. child"]);
check("a paste lands after the target subtree at its level", v3Pasted.lines, [
	"1. alpha",
	"  1.1. delta",
	"2. moved",
	"  2.1. child",
]);
check("the caret lands on the pasted item", v3Pasted.caretLine, 2);

console.log("move to a level");
const v3Levelled = core.setLevel(["1. alpha", "  1.1. beta", "    1.1.1. gamma", "  1.2. delta"], 2, 1);
check("moving to a level moves the subtree", v3Levelled.lines, ["1. alpha", "  1.1. beta", "  1.2. gamma", "  1.3. delta"]);
check("an item already at that level is left alone", core.setLevel(["1. alpha"], 0, 0), null);

console.log("indent guide and status bar");
const guideNote = ["5. top", "  5.1. mid", "    5.1.1. deep", "      body under deep", "    5.1.2. leaf", "6. flat"];
check("one guide per item with sub-items, on the last digit", core.guideSpans(guideNote), [
	{ line: 0, ch: 0, end: 4 },
	{ line: 1, ch: 4, end: 4 },
	{ line: 2, ch: 8, end: 3 },
]);
check("a flat list draws no guides", core.guideSpans(["1. a", "2. b", "3. c"]), []);
check("a bracket number hangs on its digit", core.guideSpans(["1. a", "  1.1. b", "    1) c", "      1.1) d"])[2], { line: 2, ch: 4, end: 3 });
check("a code fence draws no guide", core.guideSpans(["```", "1. a", "  1.1. b", "```"]), []);
check("the last digit of a dotted number sets the column", core.lastNumberIndex("5.1.1."), 4);
check("a closing mark is not a number", core.lastNumberIndex("1)"), 0);
check("a Thai digit counts too", core.lastNumberIndex("\u0e02\u0e49\u0e2d \u0e51."), 4);
check("the status names the level and the number", core.statusFor(["1. alpha", "  1.1. beta"], 1), "Level 2 · 1.1.");
check("a plain line says nothing", core.statusFor(["plain"], 0), "");

/* ---------------------------- settings tab ---------------------------- */

/* The tab is regular code, so it can be built against the doubles above and
 * inspected. That is the only way to check it without driving the app. */
const tabWork = (async () => {
	console.log("the settings tab builds the expected rows");

	const DEFAULTS = core.DEFAULT_SETTINGS;
	const plugin = {
		settings: {
			indent: DEFAULTS.indent,
			formats: DEFAULTS.formats.slice(),
			depthPolicy: DEFAULTS.depthPolicy,
			presets: [],
			formatOnPaste: false,
			indentGuides: true,
		},
		app: { clipboard: { write() {} } },
		saves: 0,
		async saveSettings() {
			this.saves += 1;
			Object.assign(this.settings, core.setConfig(this.settings));
		},
	};
	const tab = new entry.__settingsTab({}, plugin);
	tab.display();

	const children = tab.containerEl.children;
	const read = () => tab.containerEl.children.filter((c) => c instanceof FakeSetting);
	const isLevel = (s) => typeof s.name === "string" && s.name.startsWith("Level ");
	const settings = read();
	const rows = settings.filter(isLevel);
	const dropdown = settings.find((s) => s.kind === "dropdown");
	const headings = settings.filter((s) => s.isHeading).map((s) => s.name);
	const preview = children.find((c) => c.tag === "pre");

	check("headings go through setHeading, not raw html", headings, ["Number format", "Presets", "Preview"]);
	check("the indent dropdown offers three widths", Object.keys(dropdown.component.options).length, 3);
	check("the indent dropdown shows the current value", dropdown.component.value, DEFAULTS.indent);
	check("one text row per level", rows.length, DEFAULTS.formats.length);
	check("each row starts at the current template", rows.map((r) => r.component.value), DEFAULTS.formats);
	check("each row hints the shipped template", rows.map((r) => r.component.placeholder), DEFAULTS.formats);
	check("the preview element exists", preview !== undefined, true);
	check("the preview renders the current settings", preview.textContent, core.previewLines(DEFAULTS.formats, DEFAULTS.indent, 6).join("\n"));

	console.log("the tab can add and drop levels");
	check("every level row can be dropped", rows.every((r) => r.parts.button && r.parts.button.length === 1), true);
	check("no row is dropped below the minimum", rows.every((r) => r.parts.button[0].disabled === (DEFAULTS.formats.length <= 2)), true);
	const addRow = settings.find((s) => s.name === "Add level");
	check("the add level row is offered", addRow !== undefined, true);
	await addRow.parts.button[0].click();
	check("adding a level lengthens the list", read().filter(isLevel).length, DEFAULTS.formats.length + 1);
	check("the new level takes the shipped shape", plugin.settings.formats[DEFAULTS.formats.length], core.templateFor(DEFAULTS.formats, DEFAULTS.formats.length));
	await read().filter(isLevel).pop().parts.button[0].click();
	check("dropping a level shortens the list", read().filter(isLevel).length, DEFAULTS.formats.length);
	check("the list is back to the shipped ones", plugin.settings.formats, DEFAULTS.formats);

	console.log("the tab carries the new behaviour settings");
	const policyRow = read().find((s) => s.name === "Deeper than the last level");
	check("the depth policy offers two choices", Object.keys(policyRow.component.options).length, 2);
	check("the depth policy shows the current value", policyRow.component.value, DEFAULTS.depthPolicy);
	const pasteRow = read().find((s) => s.name === "Format pasted lists");
	check("pasted lists are formatted only when asked", pasteRow.component.value, false);
	const guideRow = read().find((s) => s.name === "Indent guides");
	check("the guides are on by default", guideRow.component.value, true);
	await guideRow.component.change(false);
	check("turning the guides off is saved", plugin.settings.indentGuides, false);

	console.log("presets can be applied and saved");
	const applyRow = read().find((s) => s.name === "Apply a preset");
	check("every shipped preset is offered", Object.keys(applyRow.component.options).length, core.BUILTIN_PRESETS.length);
	await applyRow.component.change("Legal style");
	await applyRow.parts.button[0].click();
	check("applying a preset replaces the levels", plugin.settings.formats, ["1.", "1.1", "1.1(a)", "1.1(a)(i)"]);
	const saveRow = read().find((s) => s.name === "Save the current list");
	await saveRow.component.change("Mine");
	await saveRow.parts.button[0].click();
	check("saving keeps the current list under a name", plugin.settings.presets.length, 1);
	check("the saved preset carries the levels", plugin.settings.presets[0].formats, ["1.", "1.1", "1.1(a)", "1.1(a)(i)"]);
	const jsonRow = read().find((s) => s.name === "Preset JSON");
	check("import and export are both offered", jsonRow.parts.button.map((b) => b.text), ["Export", "Import"]);
	await jsonRow.component.change("nope");
	await jsonRow.parts.button[1].click();
	check("a bad import changes nothing", plugin.settings.presets.length, 1);
	await jsonRow.component.change('[{"name": "Two", "formats": ["a.", "a.a."] }]');
	await jsonRow.parts.button[1].click();
	check("a good import replaces the saved list", plugin.settings.presets.map((p) => p.name), ["Two"]);

	/* Put the shipped formats back before the editing checks below, which
	 * describe them, and read the rows again: the tab rebuilt itself above. */
	core.setConfig({ indent: DEFAULTS.indent, formats: DEFAULTS.formats, depthPolicy: DEFAULTS.depthPolicy });
	plugin.settings.formats = DEFAULTS.formats.slice();
	plugin.settings.depthPolicy = DEFAULTS.depthPolicy;
	plugin.settings.indentGuides = true;
	tab.display();
	const liveRows = read().filter(isLevel);
	const livePreview = tab.containerEl.children.find((c) => c.tag === "pre");

	console.log("editing a template updates the preview");
	await liveRows[0].component.change("a)");
	check("the change is saved", plugin.saves > 0, true);
	check("the new template is kept", plugin.settings.formats[0], "a)");
	check("the preview follows the change", livePreview.textContent.split("\n")[0], "a) Introduction");
	check("a valid row keeps an empty description", liveRows[0].desc, "");

	console.log("an invalid row is refused without shifting the levels");
	await liveRows[1].component.change("...");
	check("a row without a placeholder keeps the previous value", plugin.settings.formats[1], DEFAULTS.formats[1]);
	check("the row says why", liveRows[1].desc.includes("No placeholder"), true);
	check("the preview falls back to the default for that level", livePreview.textContent.split("\n")[1], "  1.1. Scope");

	/* leave the core exactly as it was found */
	core.setConfig({ indent: DEFAULTS.indent, formats: DEFAULTS.formats });
})();

/* -------------------------------- done -------------------------------- */

function summary() {
	console.log("");
	console.log(passed + " passed, " + failures.length + " failed");
	if (failures.length > 0) {
		console.log("failed: " + failures.join(", "));
		process.exit(1);
	}
}

tabWork.then(summary, (err) => {
	console.log("");
	console.log("the settings tab threw: " + (err && err.stack ? err.stack : err));
	process.exit(1);
});
