/*
 * Nested Outline Numbering
 * Hierarchical plain-text numbering for Obsidian.
 *
 *   Level 1-3   1.  1.1.  1.1.1.
 *   Level 4+    1)  1.1)  1.1.1)     (the count restarts at level 4)
 *
 *   Tab            indent the item and its whole subtree by one level
 *   Shift + Tab    outdent the item and its subtree (at the top level: drop the number)
 *   Enter          next sibling at the same depth
 *   Alt + Up/Down  move the item and its subtree past its sibling
 *
 * A line is only ever touched when it carries a recognised number, so Tab keeps
 * Obsidian's normal indent behaviour on every other line.
 *
 * The CORE section below is pure text logic with no Obsidian dependency, so it
 * can be unit tested with plain Node. See test/core.test.js.
 */
"use strict";

/* Obsidian's plugin loader evaluates this file as CommonJS, so require() is the
 * only way to reach the host modules. There is no bundler and no import syntax. */
/* eslint-disable @typescript-eslint/no-require-imports -- require() is the only way to reach the host modules in a CommonJS Obsidian plugin */
const { Plugin, MarkdownView, editorInfoField } = require("obsidian");
const { Prec } = require("@codemirror/state");
const { keymap, Decoration, ViewPlugin } = require("@codemirror/view");
/* eslint-enable @typescript-eslint/no-require-imports -- the host modules are imported, nothing else below needs the exception */

/* ================================ CORE ================================ */

const INDENT_UNIT = "  ";
/* Levels 1-3 carry the full path and end with a dot (`1.` / `1.1.` / `1.1.1.`).
 * From level 4 the number restarts and ends with a bracket (`1)` / `1.1)`), the
 * way formal outlines are written. */
const DOT_LEVELS = 3;
const NUMBER_RE = /^(\s*)(\d+(?:\.\d+)*)([.)])(\s+)(.*)$/;

function indentColumns(s) {
	let n = 0;
	for (let i = 0; i < s.length; i++) n += s[i] === "	" ? 4 : 1;
	return n;
}

/**
 * `1` / `1.1` / `1.1.1` while `depth` is under DOT_LEVELS, then `1)` / `1.1)`
 * counted from level 4 again. `trailingDot` is off for headings, which carry no
 * closing dot.
 */
function formatNumber(counter, depth, trailingDot) {
	const local = depth < DOT_LEVELS ? counter.slice(0, depth + 1) : counter.slice(DOT_LEVELS, depth + 1);
	const body = local.join(".");
	if (depth < DOT_LEVELS) return trailingDot ? body + "." : body;
	return body + ")";
}

/** Parses a numbered line, or returns null when the line is not one. */
function parseLine(line) {
	const m = NUMBER_RE.exec(line);
	if (!m) return null;
	const segments = m[2].split(".").map(Number);
	return {
		indent: m[1],
		number: m[2] + m[3],
		content: m[5],
		segments,
		level: m[3] === ")" ? DOT_LEVELS + segments.length : segments.length,
		columns: indentColumns(m[1]),
	};
}

function isBlank(line) {
	return line.trim().length === 0;
}

/** Marks every line that sits inside a fenced code block. */
function fenceMask(lines) {
	const mask = new Array(lines.length).fill(false);
	let open = null;
	for (let i = 0; i < lines.length; i++) {
		if (open) {
			mask[i] = true;
			const close = /^\s*(`+|~+)\s*$/.exec(lines[i]);
			if (close && close[1][0] === open.ch && close[1].length >= open.len) open = null;
			continue;
		}
		const m = /^\s*(`{3,}|~{3,})(.*)$/.exec(lines[i]);
		if (!m) continue;
		if (m[1][0] === "`" && m[2].includes("`")) continue;
		mask[i] = true;
		open = { ch: m[1][0], len: m[1].length };
	}
	return mask;
}

/** A block is a run of numbered lines, optionally separated by blank lines. */
function findBlock(lines, i) {
	let start = i;
	let end = i;
	while (start - 1 >= 0 && (parseLine(lines[start - 1]) || isBlank(lines[start - 1]))) start--;
	while (end + 1 < lines.length && (parseLine(lines[end + 1]) || isBlank(lines[end + 1]))) end++;
	return { start, end };
}

/** [l, last line whose indent is deeper than line l's] */
function subtreeRange(lines, l, mask) {
	const p = parseLine(lines[l]);
	if (!p) return { start: l, end: l };
	let end = l;
	for (let i = l + 1; i < lines.length; i++) {
		if (mask && mask[i]) continue;
		if (isBlank(lines[i])) continue;
		const q = parseLine(lines[i]);
		if (!q || q.columns <= p.columns) break;
		end = i;
	}
	return { start: l, end };
}

/** Relative depth of every column, where `base` is depth 0. */
function computeDepths(cols, base) {
	const out = [];
	const stack = [];
	for (let i = 0; i < cols.length; i++) {
		const c = cols[i];
		if (stack.length === 0 || c <= base) {
			stack.length = 0;
			out.push(0);
			stack.push({ column: c, depth: 0 });
			continue;
		}
		while (stack.length > 0 && stack[stack.length - 1].column >= c) stack.pop();
		const d = stack.length > 0 ? stack[stack.length - 1].depth + 1 : 0;
		out.push(d);
		stack.push({ column: c, depth: d });
	}
	return out;
}

/** Rewrites every number in the blocks that overlap [from, to]. */
function renumberRange(lines, from, to) {
	const mask = fenceMask(lines);
	let changed = false;
	for (let i = Math.max(0, from); i <= Math.min(lines.length - 1, to); i++) {
		if (mask[i] || !parseLine(lines[i])) continue;
		const block = findBlock(lines, i);
		const items = [];
		for (let k = block.start; k <= block.end; k++) {
			if (mask[k]) continue;
			const p = parseLine(lines[k]);
			if (p) items.push({ k, p });
		}
		if (items.length > 0) {
			const cols = items.map((x) => x.p.columns);
			const base = Math.min.apply(null, cols);
			const baseIndent = items[cols.indexOf(base)].p.indent;
			const depths = computeDepths(cols, base);
			const counter = [];
			let prev = 0;
			for (let n = 0; n < items.length; n++) {
				const d = depths[n];
				if (d > prev) {
					while (counter.length <= d) counter.push(0);
					counter[d] = 1;
				} else {
					counter.length = d + 1;
					counter[d] = (counter[d] || 0) + 1;
				}
				prev = d;
				const next = baseIndent + INDENT_UNIT.repeat(d) + formatNumber(counter, d, true) + " " + items[n].p.content;
				if (lines[items[n].k] !== next) {
					lines[items[n].k] = next;
					changed = true;
				}
			}
		}
		i = block.end;
	}
	return changed;
}

function removeIndentUnit(line) {
	if (line.startsWith(INDENT_UNIT)) return line.slice(INDENT_UNIT.length);
	if (line.startsWith("\t")) return line.slice(1);
	const m = /^\s+/.exec(line);
	return m ? line.slice(m[0].length) : line;
}

/**
 * Indent the item on line `l` plus its subtree. Returns null when the line is
 * not numbered, or when there is no earlier sibling at the same level (there is
 * nothing to become a child of, so the key must fall through untouched).
 */
function indentItem(lines, l) {
	const p = parseLine(lines[l]);
	if (!p) return null;
	const mask = fenceMask(lines);
	if (mask[l]) return null;
	const block = findBlock(lines, l);
	let hasSibling = false;
	for (let i = l - 1; i >= block.start; i--) {
		if (mask[i] || isBlank(lines[i])) continue;
		const q = parseLine(lines[i]);
		if (!q) break;
		if (q.columns === p.columns) {
			hasSibling = true;
			break;
		}
		if (q.columns < p.columns) break;
	}
	if (!hasSibling) return null;
	const sub = subtreeRange(lines, l, mask);
	const out = lines.slice();
	for (let i = sub.start; i <= sub.end; i++) {
		if (mask[i]) continue;
		if (parseLine(out[i])) out[i] = INDENT_UNIT + out[i];
	}
	renumberRange(out, Math.max(0, block.start - 1), Math.min(out.length - 1, sub.end + 1));
	return out.join("\n") === lines.join("\n") ? null : { lines: out, caretLine: l, caretCh: null };
}

/** Outdent the item and its subtree. At the top level there is nothing to
 *  outdent, so the key falls through to Obsidian's own behaviour. */
function outdentItem(lines, l) {
	const p = parseLine(lines[l]);
	if (!p) return null;
	const mask = fenceMask(lines);
	if (mask[l]) return null;
	if (p.columns === 0) return null;
	const block = findBlock(lines, l);
	const sub = subtreeRange(lines, l, mask);
	const out = lines.slice();
	for (let i = sub.start; i <= sub.end; i++) {
		if (mask[i]) continue;
		if (!parseLine(out[i])) continue;
		out[i] = removeIndentUnit(out[i]);
	}
	renumberRange(out, Math.max(0, block.start - 1), Math.min(out.length - 1, sub.end + 1));
	return out.join("\n") === lines.join("\n") ? null : { lines: out, caretLine: l, caretCh: null };
}

/** Enter: split into a new sibling at the same depth, or leave the block. */
function newSibling(lines, l, ch) {
	const raw = lines[l];
	const p = parseLine(raw);
	if (!p) return null;
	const mask = fenceMask(lines);
	if (mask[l]) return null;
	const prefixLength = raw.length - p.content.length;
	const offset = Math.max(0, Math.min(p.content.length, ch - prefixLength));
	const head = p.content.slice(0, offset);
	const tail = p.content.slice(offset);
	const out = lines.slice();
	if (p.content.trim().length === 0) {
		out[l] = "";
		return { lines: out, caretLine: l, caretCh: 0 };
	}
	out[l] = head.length === 0 ? p.indent + p.number + " " : p.indent + p.number + " " + head;
	out.splice(l + 1, 0, p.indent + "0. " + tail);
	const block = findBlock(out, l + 1);
	renumberRange(out, Math.max(0, block.start - 1), Math.min(out.length - 1, block.end + 1));
	const caretCh = Math.max(0, out[l + 1].length - tail.length);
	return { lines: out, caretLine: l + 1, caretCh };
}

/**
 * Alt+Up / Alt+Down: swap the item and its subtree with the adjacent sibling
 * **at the same level**. Nothing else happens at the edges of a level, so the
 * key never changes an item's depth. Returns the caret on the item's new line.
 */
function moveItem(lines, l, dir) {
	const p = parseLine(lines[l]);
	if (!p) return null;
	const mask = fenceMask(lines);
	if (mask[l]) return null;
	const block = findBlock(lines, l);
	const sub = subtreeRange(lines, l, mask);
	const item = lines.slice(sub.start, sub.end + 1);
	const sibling = dir === "down" ? nextSibling(lines, sub.end, block, p, mask) : prevSibling(lines, sub.start, block, p, mask);
	if (sibling < 0) return null;
	const sib = subtreeRange(lines, sibling, mask);
	let out;
	let caret;
	if (dir === "down") {
		const sibLength = sib.end - sibling + 1;
		out = lines.slice(0, sub.start).concat(lines.slice(sibling, sib.end + 1), item, lines.slice(sib.end + 1));
		caret = sub.start + sibLength;
	} else {
		out = lines.slice(0, sibling).concat(item, lines.slice(sibling, sib.end + 1), lines.slice(sub.end + 1));
		caret = sibling;
	}
	renumberRange(out, Math.max(0, block.start - 1), Math.min(out.length - 1, block.end + 1));
	return out.join("\n") === lines.join("\n") ? null : { lines: out, caretLine: caret, caretCh: null };
}

function nextSibling(lines, from, block, p, mask) {
	for (let i = from + 1; i <= block.end; i++) {
		if (mask[i] || isBlank(lines[i])) continue;
		const q = parseLine(lines[i]);
		if (!q) return -1;
		if (q.columns === p.columns) return i;
		if (q.columns < p.columns) return -1;
	}
	return -1;
}

function prevSibling(lines, from, block, p, mask) {
	for (let i = from - 1; i >= block.start; i--) {
		if (mask[i] || isBlank(lines[i])) continue;
		const q = parseLine(lines[i]);
		if (!q) return -1;
		if (q.columns === p.columns) return i;
		if (q.columns < p.columns) return -1;
	}
	return -1;
}

function insertNumbering(lines, from, to) {
	const mask = fenceMask(lines);
	const out = lines.slice();
	let changed = false;
	for (let i = Math.max(0, from); i <= Math.min(lines.length - 1, to); i++) {
		if (mask[i] || parseLine(out[i]) || isBlank(out[i])) continue;
		const m = /^(\s*)/.exec(out[i]);
		const indent = m ? m[1] : "";
		out[i] = indent + "0. " + out[i].slice(indent.length);
		changed = true;
	}
	if (!changed) return null;
	renumberRange(out, Math.max(0, from - 1), Math.min(out.length - 1, to + 1));
	return out;
}

function removeNumbering(lines, from, to) {
	const mask = fenceMask(lines);
	const out = lines.slice();
	let changed = false;
	for (let i = Math.max(0, from); i <= Math.min(lines.length - 1, to); i++) {
		if (mask[i]) continue;
		const p = parseLine(out[i]);
		if (!p) continue;
		out[i] = p.indent + p.content;
		changed = true;
	}
	return changed ? out : null;
}

/* ------------------------------ headings ------------------------------ */

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const HEADING_NUMBER_RE = /^(\d+(?:\.\d+)*[.)]?)\s+/;

/** Parses an ATX heading line, or returns null when the line is not one. */
function parseHeading(line) {
	const m = HEADING_RE.exec(line);
	if (!m) return null;
	return { level: m[1].length, text: m[2] };
}

function stripHeadingNumber(text) {
	return text.replace(HEADING_NUMBER_RE, "");
}

/** True once any heading in the note carries a number, i.e. numbering is on. */
function headingsAreNumbered(lines) {
	const mask = fenceMask(lines);
	for (let i = 0; i < lines.length; i++) {
		if (mask[i]) continue;
		const h = parseHeading(lines[i]);
		if (h && HEADING_NUMBER_RE.test(h.text)) return true;
	}
	return false;
}

/** Number of every heading in the note, in document order. */
function headingNumbers(lines) {
	const mask = fenceMask(lines);
	const counters = [];
	const result = [];
	for (let i = 0; i < lines.length; i++) {
		if (mask[i]) continue;
		const h = parseHeading(lines[i]);
		if (!h) continue;
		const lvl = h.level - 1;
		if (counters.length === 0) {
			for (let k = 0; k < lvl; k++) counters[k] = 1;
			counters[lvl] = 1;
		} else if (lvl >= counters.length) {
			for (let k = counters.length; k <= lvl; k++) counters[k] = 1;
			counters[lvl] = 1;
		} else {
			counters.length = lvl + 1;
			counters[lvl] += 1;
		}
		result.push({ line: i, level: h.level, number: formatNumber(counters, lvl, false) });
	}
	return result;
}

/** Writes `1` / `1.1` / `1.1.1` into every heading of the note. */
function numberHeadings(lines) {
	const out = lines.slice();
	let changed = false;
	for (const entry of headingNumbers(lines)) {
		const h = parseHeading(lines[entry.line]);
		const next = "#".repeat(entry.level) + " " + entry.number + " " + stripHeadingNumber(h.text);
		if (out[entry.line] !== next) {
			out[entry.line] = next;
			changed = true;
		}
	}
	return changed ? out : null;
}

function removeHeadingNumbers(lines) {
	const out = lines.slice();
	let changed = false;
	for (let i = 0; i < lines.length; i++) {
		const h = parseHeading(lines[i]);
		if (!h || !HEADING_NUMBER_RE.test(h.text)) continue;
		out[i] = "#".repeat(h.level) + " " + stripHeadingNumber(h.text);
		changed = true;
	}
	return changed ? out : null;
}

/** The heading on line `l` plus everything under it, up to the next same-or-shallower heading. */
function headingBlockRange(lines, l, mask) {
	const h = parseHeading(lines[l]);
	let end = l;
	for (let i = l + 1; i < lines.length; i++) {
		if (mask[i]) continue;
		const o = parseHeading(lines[i]);
		if (o && o.level <= h.level) break;
		end = i;
	}
	return { start: l, end };
}

function headingSibling(lines, l, dir, mask) {
	const h = parseHeading(lines[l]);
	const block = headingBlockRange(lines, l, mask);
	if (dir === "down") {
		for (let i = block.end + 1; i < lines.length; i++) {
			if (mask[i]) continue;
			const o = parseHeading(lines[i]);
			if (!o) continue;
			return o.level === h.level ? i : -1;
		}
		return -1;
	}
	for (let i = l - 1; i >= 0; i--) {
		if (mask[i]) continue;
		const o = parseHeading(lines[i]);
		if (!o) continue;
		return o.level === h.level ? i : -1;
	}
	return -1;
}

/** Tab / Shift+Tab on a heading: change the level, then keep the numbering correct. */
function shiftHeadingLevel(lines, l, dir) {
	const h = parseHeading(lines[l]);
	if (!h) return null;
	const mask = fenceMask(lines);
	if (mask[l]) return null;
	const level = Math.min(6, Math.max(1, h.level + dir));
	if (level === h.level) return null;
	const out = lines.slice();
	out[l] = "#".repeat(level) + " " + h.text;
	const numbered = headingsAreNumbered(lines) ? numberHeadings(out) : null;
	return { lines: numbered || out, caretLine: l, caretCh: null };
}

/** Alt+Up / Alt+Down on a heading: swap with the adjacent heading of the same level. */
function moveHeading(lines, l, dir) {
	const h = parseHeading(lines[l]);
	if (!h) return null;
	const mask = fenceMask(lines);
	if (mask[l]) return null;
	const block = headingBlockRange(lines, l, mask);
	const sibling = headingSibling(lines, l, dir, mask);
	if (sibling < 0) return null;
	const sibBlock = headingBlockRange(lines, sibling, mask);
	const item = lines.slice(block.start, block.end + 1);
	const other = lines.slice(sibBlock.start, sibBlock.end + 1);
	let out;
	let caret;
	if (dir === "down") {
		out = lines.slice(0, block.start).concat(other, item, lines.slice(sibBlock.end + 1));
		caret = block.start + other.length;
	} else {
		out = lines.slice(0, sibling).concat(item, other, lines.slice(block.end + 1));
		caret = sibling;
	}
	const numbered = headingsAreNumbered(lines) ? numberHeadings(out) : null;
	return { lines: numbered || out, caretLine: caret, caretCh: null };
}

/* ---------------------------- dispatch ---------------------------- */

function applyAction(lines, line, ch, action) {
	if (line < 0 || line >= lines.length) return null;
	const onHeading = parseHeading(lines[line]) !== null;
	switch (action) {
		case "indent":
			return onHeading ? shiftHeadingLevel(lines, line, 1) : indentItem(lines, line);
		case "outdent":
			return onHeading ? shiftHeadingLevel(lines, line, -1) : outdentItem(lines, line);
		case "enter":
			return onHeading ? null : newSibling(lines, line, ch);
		case "moveUp":
			return onHeading ? moveHeading(lines, line, "up") : moveItem(lines, line, "up");
		case "moveDown":
			return onHeading ? moveHeading(lines, line, "down") : moveItem(lines, line, "down");
		default:
			return null;
	}
}

/** Smallest single edit that turns `a` into `b`. */
function minimalChange(a, b) {
	let start = 0;
	const min = Math.min(a.length, b.length);
	while (start < min && a[start] === b[start]) start++;
	let endA = a.length;
	let endB = b.length;
	while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
		endA--;
		endB--;
	}
	return { from: start, to: endA, insert: b.slice(start, endB) };
}

/**
 * Length of the `indent + number + space` prefix that sits in front of the
 * content, for numbered lines and for numbered headings alike. Null when the
 * line carries no number at all.
 */
function prefixLength(line) {
	const p = parseLine(line);
	if (p) return line.length - p.content.length;
	const h = parseHeading(line);
	if (!h) return null;
	const m = HEADING_NUMBER_RE.exec(h.text);
	return line.length - h.text.length + (m ? m[0].length : 0);
}

/**
 * Where the caret goes once a line has been renumbered: the same spot inside
 * the content. Carrying the raw offset over instead would drop it in the middle
 * of the new number whenever the indent or the number changes length.
 */
function caretAfter(oldLine, newLine, ch) {
	const was = prefixLength(oldLine);
	const now = prefixLength(newLine);
	if (was === null || now === null) return ch;
	return now + Math.max(0, ch - was);
}

function offsetToPos(text, offset) {
	let line = 0;
	let ch = 0;
	for (let i = 0; i < offset && i < text.length; i++) {
		if (text.charCodeAt(i) === 10) {
			line++;
			ch = 0;
		} else {
			ch++;
		}
	}
	return { line, ch };
}

const CORE = {
	INDENT_UNIT,
	DOT_LEVELS,
	NUMBER_RE,
	formatNumber,
	parseLine,
	fenceMask,
	findBlock,
	subtreeRange,
	renumberRange,
	indentItem,
	outdentItem,
	newSibling,
	moveItem,
	insertNumbering,
	removeNumbering,
	parseHeading,
	stripHeadingNumber,
	headingsAreNumbered,
	headingNumbers,
	numberHeadings,
	removeHeadingNumbers,
	headingBlockRange,
	shiftHeadingLevel,
	moveHeading,
	applyAction,
	minimalChange,
	prefixLength,
	caretAfter,
	offsetToPos,
};

/* =============================== PLUGIN =============================== */

class NestedOutlineNumbering extends Plugin {
	onload() {
		const handler = (ev) => this.handleKeydown(ev);
		document.addEventListener("keydown", handler, true);
		this.register(() => document.removeEventListener("keydown", handler, true));

		this.registerEditorExtension(
			Prec.highest(
				keymap.of([
					{ key: "Tab", run: (view) => this.fromCm(view, "indent") },
					{ key: "Shift-Tab", run: (view) => this.fromCm(view, "outdent") },
					{ key: "Enter", run: (view) => this.fromCm(view, "enter") },
					{ key: "Alt-ArrowUp", run: (view) => this.fromCm(view, "moveUp") },
					{ key: "Alt-ArrowDown", run: (view) => this.fromCm(view, "moveDown") },
				])
			)
		);

		this.registerEditorExtension(numberingLineDecorations);

		this.addCommand({
			id: "renumber-block",
			name: "Renumber nested block",
			editorCallback: (editor) => this.runRange(editor, renumberRange, "renumber"),
		});
		this.addCommand({
			id: "insert-numbering",
			name: "Insert nested numbering",
			editorCallback: (editor) => this.runRange(editor, insertNumbering, "insert"),
		});
		this.addCommand({
			id: "remove-numbering",
			name: "Remove nested numbering",
			editorCallback: (editor) => this.runRange(editor, removeNumbering, "remove"),
		});
		this.addCommand({
			id: "number-headings",
			name: "Number headings in note",
			editorCallback: (editor) => this.runWholeNote(editor, numberHeadings),
		});
		this.addCommand({
			id: "remove-heading-numbers",
			name: "Remove heading numbers",
			editorCallback: (editor) => this.runWholeNote(editor, removeHeadingNumbers),
		});
	}

	/**
	 * Capture-phase listener on `document`. It runs before CodeMirror keymaps and
	 * before other plugins such as Obsidian Outliner, which is what lets Tab mean
	 * "indent the numbering" here while still meaning "indent the list" on every
	 * line this plugin does not recognise.
	 */
	handleKeydown(ev) {
		if (ev.isComposing) return;
		const plain = !ev.altKey && !ev.ctrlKey && !ev.metaKey;
		let action = null;
		if (plain && ev.key === "Tab") action = ev.shiftKey ? "outdent" : "indent";
		else if (plain && ev.key === "Enter" && !ev.shiftKey) action = "enter";
		else if (ev.altKey && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey && ev.key === "ArrowUp") action = "moveUp";
		else if (ev.altKey && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey && ev.key === "ArrowDown") action = "moveDown";
		if (!action) return;
		if (!ev.target || typeof ev.target.closest !== "function" || !ev.target.closest(".cm-editor")) return;
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;
		if (this.runAction(view.editor, action)) {
			ev.preventDefault();
			ev.stopPropagation();
			ev.stopImmediatePropagation();
		}
	}

	fromCm(view, action) {
		const info = view.state.field(editorInfoField, false);
		const editor = info && info.editor;
		if (!editor) return false;
		return this.runAction(editor, action);
	}

	runAction(editor, action) {
		const text = editor.getValue();
		const cursor = editor.getCursor();
		const before = text.split("\n");
		const result = applyAction(before, cursor.line, cursor.ch, action);
		if (!result) return false;
		const next = result.lines.join("\n");
		if (next === text) return false;
		const diff = minimalChange(text, next);
		const caretLine = result.caretLine === null ? cursor.line : result.caretLine;
		const lineText = result.lines[caretLine] || "";
		let caretCh = result.caretCh;
		if (caretCh === null) caretCh = caretAfter(before[cursor.line] || "", lineText, cursor.ch);
		caretCh = Math.min(caretCh, lineText.length);
		editor.transaction({
			changes: [{ from: offsetToPos(text, diff.from), to: offsetToPos(text, diff.to), text: diff.insert }],
			selection: { from: { line: caretLine, ch: caretCh }, to: { line: caretLine, ch: caretCh } },
		});
		return true;
	}

	runWholeNote(editor, fn) {
		const text = editor.getValue();
		const out = fn(text.split("\n"));
		if (!out) return false;
		const next = out.join("\n");
		if (next === text) return false;
		const diff = minimalChange(text, next);
		editor.transaction({
			changes: [{ from: offsetToPos(text, diff.from), to: offsetToPos(text, diff.to), text: diff.insert }],
		});
		return true;
	}

	runRange(editor, fn, kind) {
		const text = editor.getValue();
		const lines = text.split("\n");
		const from = editor.getCursor("from").line;
		const to = editor.getCursor("to").line;
		let out = null;
		if (kind === "renumber") {
			out = lines.slice();
			if (!renumberRange(out, from, to)) out = null;
		} else {
			out = fn(lines, from, to);
		}
		if (!out) return false;
		const next = out.join("\n");
		if (next === text) return false;
		const diff = minimalChange(text, next);
		editor.transaction({
			changes: [{ from: offsetToPos(text, diff.from), to: offsetToPos(text, diff.to), text: diff.insert }],
		});
		return true;
	}
}

const numberingLineDecorations = ViewPlugin.fromClass(
	class {
		constructor(view) {
			this.decorations = buildDecorations(view);
		}
		update(update) {
			if (update.docChanged || update.viewportChanged) this.decorations = buildDecorations(update.view);
		}
	},
	{ decorations: (v) => v.decorations }
);

function buildDecorations(view) {
	const lines = view.state.doc.toString().split("\n");
	const mask = fenceMask(lines);
	const builder = new RangeSetBuilderLike();
	for (const range of view.visibleRanges) {
		let pos = range.from;
		while (pos <= range.to) {
			const line = view.state.doc.lineAt(pos);
			const index = line.number - 1;
			if (!mask[index] && parseLine(line.text)) builder.add(line.from, line.from, numberingLine);
			if (line.to >= range.to) break;
			pos = line.to + 1;
		}
	}
	return builder.finish();
}

const numberingLine = Decoration.line({ class: "nested-outline-numbering-line" });

/** Tiny ordered range builder, avoids importing RangeSetBuilder. */
class RangeSetBuilderLike {
	constructor() {
		this.items = [];
	}
	add(from, to, value) {
		this.items.push({ from, to, value });
	}
	finish() {
		return Decoration.set(
			this.items.map((x) => x.value.range(x.from, x.to)),
			true
		);
	}
}

module.exports = NestedOutlineNumbering;
module.exports.default = NestedOutlineNumbering;
module.exports.__core = CORE;
