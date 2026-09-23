/*
 * Unit tests for the pure core of Nested Outline Numbering.
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
	add(kind, cb) {
		this.kind = kind;
		this.component = new FakeComponent();
		cb(this.component);
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
check("a blank row takes the default for its level", core.normaliseFormats(["1.", "", "1.1.1."]), [
	"1.",
	"1.1.",
	"1.1.1.",
	"1)",
	"1.1)",
	"1.1.1)",
]);
check("a row without a placeholder is replaced, never dropped", core.normaliseFormats(["a.", "..."]), [
	"a.",
	"1.1.",
	"1.1.1.",
	"1)",
	"1.1)",
	"1.1.1)",
]);
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

/* ---------------------------- settings tab ---------------------------- */

/* The tab is regular code, so it can be built against the doubles above and
 * inspected. That is the only way to check it without driving the app. */
const tabWork = (async () => {
	console.log("the settings tab builds the expected rows");

	const DEFAULTS = core.DEFAULT_SETTINGS;
	const plugin = {
		settings: { indent: DEFAULTS.indent, formats: DEFAULTS.formats.slice() },
		saves: 0,
		async saveSettings() {
			this.saves += 1;
			Object.assign(this.settings, core.setConfig(this.settings));
		},
	};
	const tab = new entry.__settingsTab({}, plugin);
	tab.display();

	const children = tab.containerEl.children;
	const settings = children.filter((c) => c instanceof FakeSetting);
	const rows = settings.filter((s) => s.kind === "text");
	const dropdown = settings.find((s) => s.kind === "dropdown");
	const headings = settings.filter((s) => s.isHeading).map((s) => s.name);
	const preview = children.find((c) => c.tag === "pre");

	check("headings go through setHeading, not raw html", headings, ["Number format", "Preview"]);
	check("the indent dropdown offers three widths", Object.keys(dropdown.component.options).length, 3);
	check("the indent dropdown shows the current value", dropdown.component.value, DEFAULTS.indent);
	check("one text row per level", rows.length, DEFAULTS.formats.length);
	check("each row starts at the current template", rows.map((r) => r.component.value), DEFAULTS.formats);
	check("each row hints the shipped template", rows.map((r) => r.component.placeholder), DEFAULTS.formats);
	check("the preview element exists", preview !== undefined, true);
	check("the preview renders the current settings", preview.textContent, core.previewLines(DEFAULTS.formats, DEFAULTS.indent, 6).join("\n"));

	console.log("editing a template updates the preview");
	await rows[0].component.change("a)");
	check("the change is saved", plugin.saves > 0, true);
	check("the new template is kept", plugin.settings.formats[0], "a)");
	check("the preview follows the change", preview.textContent.split("\n")[0], "a) Introduction");
	check("a valid row keeps an empty description", rows[0].desc, "");

	console.log("an invalid row is refused without shifting the levels");
	await rows[1].component.change("...");
	check("a row without a placeholder keeps the previous value", plugin.settings.formats[1], DEFAULTS.formats[1]);
	check("the row says why", rows[1].desc.includes("No placeholder"), true);
	check("the preview falls back to the default for that level", preview.textContent.split("\n")[1], "  1.1. Scope");

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
