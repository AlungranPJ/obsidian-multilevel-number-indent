/*
 * Multilevel Number Indent
 * Hierarchical plain-text numbering for Obsidian.
 *
 *   Level 1-3   1.  1.1.  1.1.1.
 *   Level 4+    1)  1.1)  1.1.1)     (the count restarts at level 4)
 *
 * Those are the shipped defaults. Settings -> Multilevel Number Indent holds one
 * template per level, so the shape is yours: placeholders render the counter
 * (1 arabic, a/A letters, i/I roman) and every other character is literal.
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
const { Plugin, PluginSettingTab, Setting, MarkdownView, Modal, ButtonComponent, editorInfoField } = require("obsidian");
const { Prec } = require("@codemirror/state");
const { keymap, Decoration, ViewPlugin, layer, RectangleMarker } = require("@codemirror/view");
/* eslint-enable @typescript-eslint/no-require-imports -- the host modules are imported, nothing else below needs the exception */

/* ================================ CORE ================================ */

/* ---------------------------- configuration ---------------------------- */

/* Written by the settings tab into data.json. `indent` is what gets prepended
 * per level; `formats` holds one number template per level and the last one is
 * reused for anything deeper. */
/* A level is one row in the settings tab, and the tab can add or drop rows, so
 * the outline can be as shallow or as deep as the note needs. */
const MIN_LEVELS = 2;
const MAX_LEVELS = 12;
const DEPTH_POLICIES = ["reuse-last", "unnumbered"];

const DEFAULT_SETTINGS = {
	indent: "  ",
	formats: ["1.", "1.1.", "1.1.1.", "1)", "1.1)", "1.1.1)"],
	/* What happens to a line deeper than the last configured level: keep the
	 * shape of the last level, or leave the line unnumbered as body text. */
	depthPolicy: "reuse-last",
	/* Named format sets the user saved, kept in data.json. */
	presets: [],
	/* Paste hook, off unless the user turns it on. */
	formatOnPaste: false,
	indentGuides: true,
};

/* Inside a template every placeholder becomes the counter of the next path
 * segment. How many placeholders a template carries decides how many trailing
 * segments that level shows, which is how `1)` restarts the count at level 4.
 * Every other character is literal: the separator or the closing mark. */
const STYLES = {
	1: (n) => String(n),
	a: (n) => alpha(n).toLowerCase(),
	A: (n) => alpha(n),
	i: (n) => roman(n).toLowerCase(),
	I: (n) => roman(n),
	"ก": (n) => thaiLetter(n),
	"๑": (n) => thaiDigit(n),
};

const STYLE_RE = {
	1: "\\d+",
	a: "[a-z]+",
	A: "[A-Z]+",
	i: "[ivxlcdm]+",
	I: "[IVXLCDM]+",
	"ก": "[ก-ฮ]+",
	"๑": "[๐-๙]+",
};

/* The dotted shapes this plugin shipped with are always recognised, so a note
 * written before the format was changed keeps being renumbered instead of being
 * silently abandoned, and the `0. ` placeholder written by insert/enter parses. */
const LEGACY_SHAPES = ["\\d+(?:\\.\\d+)*\\.", "\\d+(?:\\.\\d+)*\\)"];

const PREVIEW_WORDS = [
	"Introduction",
	"Scope",
	"Detail",
	"Point",
	"Sub-point",
	"Deeper detail",
	"Seventh level",
	"Eighth level",
];

function alpha(n) {
	let s = "";
	let v = Math.max(1, Math.floor(n));
	while (v > 0) {
		const r = (v - 1) % 26;
		s = String.fromCharCode(65 + r) + s;
		v = Math.floor((v - 1) / 26);
	}
	return s;
}

const ROMAN = [
	[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
	[50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

/* Thai numbering runs on the consonant alphabet for letters and on the Thai
 * digits, so a template can read `ข้อ ๑.` and still count correctly. */
const THAI_LETTERS = "กขคงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ";
const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

function thaiLetter(n) {
	let s = "";
	let v = Math.max(1, Math.floor(n));
	while (v > 0) {
		const r = (v - 1) % THAI_LETTERS.length;
		s = THAI_LETTERS[r] + s;
		v = Math.floor((v - 1) / THAI_LETTERS.length);
	}
	return s;
}

function thaiDigit(n) {
	const digits = String(Math.max(0, Math.floor(n)));
	let s = "";
	for (const ch of digits) s += THAI_DIGITS[ch.charCodeAt(0) - 48];
	return s;
}

function roman(n) {
	let s = "";
	let v = Math.max(1, Math.floor(n));
	for (const pair of ROMAN) {
		while (v >= pair[0]) {
			s += pair[1];
			v -= pair[0];
		}
	}
	return s;
}

function placeholderCount(template) {
	let n = 0;
	for (const ch of template) if (STYLES[ch]) n++;
	return n;
}

function escapeRe(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The template used at `depth`, reusing the last one for deeper levels. */
function templateFor(formats, depth) {
	return formats[Math.min(Math.max(0, depth), formats.length - 1)];
}

/**
 * True when `depth` is past the last configured level and the depth policy says
 * such a line keeps its indent but drops the number, staying body text.
 */
function stopsAt(depth, formats, policy) {
	return policy === "unnumbered" && depth >= formats.length;
}

/** A heading carries no closing dot, so drop it from the outline template. */
function headingTemplate(template) {
	return template.endsWith(".") ? template.slice(0, -1) : template;
}

/**
 * Keeps the position of every level: a template that carries no placeholder is
 * replaced by the shipped default for that level rather than being dropped,
 * which would silently shift every level below it. The list keeps the length the
 * user chose (clamped to MIN_LEVELS..MAX_LEVELS) so the tab can add or drop
 * levels instead of always showing six.
 */
function normaliseFormats(formats) {
	const src = Array.isArray(formats) ? formats : [];
	const total = Math.min(MAX_LEVELS, Math.max(src.length, MIN_LEVELS));
	const out = [];
	for (let i = 0; i < total; i++) {
		const raw = typeof src[i] === "string" ? src[i].trim() : "";
		if (raw.length > 0 && placeholderCount(raw) > 0) out.push(raw);
		else out.push(templateFor(DEFAULT_SETTINGS.formats, i));
	}
	return out;
}

function templateToRe(template) {
	let out = "";
	for (const ch of template) out += STYLES[ch] ? STYLE_RE[ch] : escapeRe(ch);
	return out;
}

function buildNumberRe(formats) {
	const alts = LEGACY_SHAPES.slice();
	for (const template of formats) {
		if (placeholderCount(template) > 0) alts.push(templateToRe(template));
	}
	/* Longest first: `1.1.` has to be tried before `1.` can swallow the line. */
	alts.sort((x, y) => y.length - x.length);
	return new RegExp("^(\\s*)((?:" + alts.join("|") + "))(\\s+)(.*)$");
}

/* Every core function reads the live values from here, which keeps the text
 * logic free of the Obsidian API. The settings tab is the only writer. */
let CONFIG = {
	indent: DEFAULT_SETTINGS.indent,
	formats: DEFAULT_SETTINGS.formats.slice(),
	depthPolicy: DEFAULT_SETTINGS.depthPolicy,
	indentGuides: DEFAULT_SETTINGS.indentGuides,
	numberRe: null,
};

function getConfig() {
	return {
		indent: CONFIG.indent,
		formats: CONFIG.formats.slice(),
		depthPolicy: CONFIG.depthPolicy,
		indentGuides: CONFIG.indentGuides,
	};
}

/** True for a non-empty run of spaces or tabs, which is all an indent may be. */
function isIndentText(s) {
	if (typeof s !== "string" || s.length === 0) return false;
	for (const ch of s) if (ch !== " " && ch !== "	") return false;
	return true;
}

function setConfig(partial) {
	const src = partial || {};
	const indent = isIndentText(src.indent) ? src.indent : CONFIG.indent;
	const formats = src.formats === undefined ? CONFIG.formats : normaliseFormats(src.formats);
	const depthPolicy = DEPTH_POLICIES.indexOf(src.depthPolicy) >= 0 ? src.depthPolicy : CONFIG.depthPolicy;
	const indentGuides = typeof src.indentGuides === "boolean" ? src.indentGuides : CONFIG.indentGuides;
	CONFIG = { indent, formats, depthPolicy, indentGuides, numberRe: buildNumberRe(formats) };
	return getConfig();
}

setConfig({});

function indentColumns(s) {
	let n = 0;
	for (let i = 0; i < s.length; i++) n += s[i] === "\t" ? 4 : 1;
	return n;
}

/** Renders one template against the counter path, using its last segments. */
function renderTemplate(template, counters, depth) {
	const need = placeholderCount(template);
	const start = Math.max(0, depth + 1 - need);
	let out = "";
	let taken = 0;
	for (const ch of template) {
		if (!STYLES[ch]) {
			out += ch;
			continue;
		}
		const value = counters[start + taken];
		out += STYLES[ch](value === undefined ? 1 : value);
		taken++;
	}
	return out;
}

/** The number a level shows, against an explicit template list. */
function renderNumber(counters, depth, formats, trailingDot) {
	const template = templateFor(formats, depth);
	return renderTemplate(trailingDot ? template : headingTemplate(template), counters, depth);
}

/**
 * The number the current settings give this level. `trailingDot` is off for
 * headings, which carry no closing dot.
 */
function formatNumber(counter, depth, trailingDot) {
	return renderNumber(counter, depth, CONFIG.formats, trailingDot);
}

/** Sample numbering for the settings preview, which works on draft values. */
function previewLines(formats, indent, count) {
	const total = Math.max(1, count || 6);
	const counters = [];
	const out = [];
	for (let d = 0; d < total; d++) {
		while (counters.length <= d) counters.push(1);
		const word = PREVIEW_WORDS[d] || "Item " + (d + 1);
		out.push(indent.repeat(d) + renderNumber(counters, d, formats, true) + " " + word);
	}
	return out;
}

/**
 * Parses a numbered line, or returns null when the line is not one. The level
 * of a line comes from its indentation, never from the number itself, so every
 * format the settings allow is parsed the same way.
 */
function parseLine(line) {
	const m = CONFIG.numberRe.exec(line);
	if (!m) return null;
	return {
		indent: m[1],
		number: m[2],
		content: m[4],
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

/**
 * A block is a run of numbered lines. Blank lines stay inside it, and so does
 * body text that sits deeper than the run: a note or a comment written under an
 * item must not split the numbering in half. Only text at the run's own level or
 * shallower ends it.
 */
function findBlock(lines, i) {
	let start = i;
	let end = i;
	let min = null;
	const note = (idx) => {
		const p = parseLine(lines[idx]);
		if (p && (min === null || p.columns < min)) min = p.columns;
	};
	note(i);
	while (start - 1 >= 0 && continuesBlock(lines[start - 1], min)) {
		start--;
		note(start);
	}
	while (end + 1 < lines.length && continuesBlock(lines[end + 1], min)) {
		end++;
		note(end);
	}
	return { start, end };
}

function continuesBlock(line, minColumns) {
	if (parseLine(line) || isBlank(line)) return true;
	/* A heading marked "keep counting past me" bridges the run instead of
	 * ending it, so the items below go on with the same count. */
	if (CONTINUE_RE.test(line)) return true;
	if (minColumns === null) return false;
	const m = /^\s*/.exec(line);
	return indentColumns(m ? m[0] : "") > minColumns;
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
		if (!q) {
			/* Body text deeper than the item belongs to that item, and has to
			 * travel with it when the item moves or gets indented. */
			const m = /^\s*/.exec(lines[i]);
			if (indentColumns(m ? m[0] : "") > p.columns) {
				end = i;
				continue;
			}
			break;
		}
		if (q.columns <= p.columns) break;
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

/** Depth of line `l` inside its own block, with the shallowest line as depth 0. */
function depthInBlock(lines, l, mask) {
	const block = findBlock(lines, l);
	const items = [];
	for (let k = block.start; k <= block.end; k++) {
		if (mask && mask[k]) continue;
		const p = parseLine(lines[k]);
		if (p) items.push({ k, p });
	}
	if (items.length === 0) return 0;
	const cols = items.map((x) => x.p.columns);
	const depths = computeDepths(cols, Math.min.apply(null, cols));
	const at = items.map((x) => x.k).indexOf(l);
	return at < 0 ? 0 : depths[at];
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
				/* Past the last configured level the policy decides: either the
				 * last level's shape is reused, or the line drops back to body
				 * text with its indent kept and no number at all. */
				const stop = stopsAt(d, CONFIG.formats, CONFIG.depthPolicy);
				const next = stop
					? baseIndent + CONFIG.indent.repeat(d) + items[n].p.content
					: baseIndent + CONFIG.indent.repeat(d) + formatNumber(counter, d, true) + " " + items[n].p.content;
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
	if (line.startsWith(CONFIG.indent)) return line.slice(CONFIG.indent.length);
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
	/* With the "unnumbered" policy the outline has a floor to its depth: Tab
	 * stops working past the last configured level instead of pushing the item
	 * into body text behind the user's back. */
	if (stopsAt(depthInBlock(lines, l, mask) + 1, CONFIG.formats, CONFIG.depthPolicy)) return null;
	const sub = subtreeRange(lines, l, mask);
	const out = lines.slice();
	for (let i = sub.start; i <= sub.end; i++) {
		if (mask[i]) continue;
		if (parseLine(out[i])) out[i] = CONFIG.indent + out[i];
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
	/* Blank lines between the two items stay between them through the swap. */
	let out;
	let caret;
	if (dir === "down") {
		const sibLength = sib.end - sibling + 1;
		const gap = lines.slice(sub.end + 1, sibling);
		out = lines.slice(0, sub.start).concat(lines.slice(sibling, sib.end + 1), gap, item, lines.slice(sib.end + 1));
		caret = sub.start + sibLength + gap.length;
	} else {
		out = lines
			.slice(0, sibling)
			.concat(item, lines.slice(sib.end + 1, sub.start), lines.slice(sibling, sib.end + 1), lines.slice(sub.end + 1));
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

/**
 * The clear-format move: the number comes off the front of every line, and off
 * every heading, while the indentation is left exactly as it was so the text can
 * be laid out again by hand. Any numbering style goes, not only this plugin's,
 * and bullets go with it. A blockquote marker is content, so that stays.
 */
function clearFormatting(lines, from, to) {
	const mask = fenceMask(lines);
	const out = lines.slice();
	let changed = false;
	for (let i = Math.max(0, from); i <= Math.min(lines.length - 1, to); i++) {
		if (mask[i] || isBlank(out[i])) continue;
		const line = out[i];
		if (parseHeading(line)) {
			const m = /^(#{1,6}\s+)(.*)$/.exec(line);
			const stripped = stripHeadingNumber(m[2]);
			if (stripped !== m[2]) {
				out[i] = m[1] + stripped;
				changed = true;
			}
			continue;
		}
		const p = parseLine(line);
		const marked = stripMarker(line);
		if (!p && (!marked || !marked.marked)) continue;
		const indent = /^(\s*)/.exec(line)[1];
		if (line.slice(indent.length).startsWith(">")) continue;
		out[i] = indent + (p ? p.content : marked.content);
		changed = true;
	}
	return changed ? out : null;
}

/* ------------------------------ headings ------------------------------ */

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const HEADING_NUMBER_RE = /^(\d+(?:\.\d+)*[.)]?)\s+/;
/* A heading can say "keep counting past me" instead of starting a fresh list at
 * 1, the way Word lets a list run on across a heading. The mark is an HTML
 * comment, so reading view and a clean export never see it. */
const CONTINUE_MARK = "<!--mni:continue-->";
const CONTINUE_RE = /\s*<!--\s*mni:continue\s*-->$/i;

/** Parses an ATX heading line, or returns null when the line is not one. The
 *  numbering mark is kept out of the title text. */
function parseHeading(line) {
	const m = HEADING_RE.exec(line);
	if (!m) return null;
	return { level: m[1].length, text: m[2].replace(CONTINUE_RE, "") };
}

/** Rewrites the heading at `l` to keep counting past it, or to start a fresh
 *  list, and renumbers the two blocks the change can reach. */
function headingContinuation(lines, l, on) {
	const target = lines[l] === undefined ? "" : lines[l];
	if (parseHeading(target) === null) return null;
	const out = lines.slice();
	const bare = target.replace(CONTINUE_RE, "").replace(/\s+$/, "");
	out[l] = on ? bare + " " + CONTINUE_MARK : bare;
	renumberRange(out, Math.max(0, l - 1), Math.min(out.length - 1, l + 1));
	return { lines: out, caretLine: l, caretCh: null };
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

/* ---------------------------- presets ---------------------------- */

/* Named format sets. Applying one replaces the level list wholesale, which is
 * how someone gets a legal or a Thai outline without learning the template
 * syntax first. The user's own sets live in data.json and travel between
 * machines as JSON. */
const BUILTIN_PRESETS = [
	{ name: "Dotted then brackets", formats: ["1.", "1.1.", "1.1.1.", "1)", "1.1)", "1.1.1)"] },
	{ name: "Full path dots", formats: ["1.", "1.1.", "1.1.1.", "1.1.1.1.", "1.1.1.1.1."] },
	{ name: "Letters", formats: ["a.", "a.a.", "a.a.a.", "a.a.a.a."] },
	{ name: "Roman numerals", formats: ["I.", "I.I.", "I.I.I.", "I.I.I.I."] },
	{ name: "Legal style", formats: ["1.", "1.1", "1.1(a)", "1.1(a)(i)"] },
	{ name: "Thai", formats: ["ข้อ ๑.", "ข้อ ๑.๑.", "(ก)", "(ก)(๑)"] },
];

/** Every preset the tab offers: the shipped ones first, then the saved ones. */
function presetList(custom) {
	const saved = Array.isArray(custom)
		? custom.filter((p) => p && typeof p.name === "string" && Array.isArray(p.formats))
		: [];
	return BUILTIN_PRESETS.concat(saved);
}

/**
 * The level list a named preset carries, or null when the name is unknown. A
 * saved preset with the same name wins over a shipped one, so the user can
 * replace a built-in shape without renaming it.
 */
function presetByName(name, custom) {
	const saved = Array.isArray(custom) ? custom : [];
	for (const preset of saved.concat(BUILTIN_PRESETS)) {
		if (preset && preset.name === name && Array.isArray(preset.formats)) return normaliseFormats(preset.formats);
	}
	return null;
}

/**
 * Parses `[{name, formats}]` from JSON. Anything else is rejected as a whole, so
 * a half-pasted document can never half-apply and leave the levels half-set.
 */
function parsePresetsJson(text) {
	let data;
	try {
		data = JSON.parse(String(text));
	} catch (e) {
		return null;
	}
	if (!Array.isArray(data)) return null;
	const out = [];
	for (const entry of data) {
		if (!entry || typeof entry.name !== "string" || entry.name.trim().length === 0) return null;
		if (!Array.isArray(entry.formats) || entry.formats.length === 0) return null;
		const rows = entry.formats.slice(0, MAX_LEVELS);
		for (const row of rows) {
			if (typeof row !== "string" || placeholderCount(row.trim()) === 0) return null;
		}
		out.push({ name: entry.name.trim(), formats: normaliseFormats(rows) });
	}
	return out;
}

/** The saved presets as JSON, ready to copy onto another machine. */
function renderPresetsJson(custom) {
	return JSON.stringify(Array.isArray(custom) ? custom : [], null, "\t");
}

/* ------------------------- per-note settings ------------------------- */

/** One YAML scalar: quoted with its escapes resolved, or taken bare. */
function parseScalar(raw) {
	const text = String(raw).trim();
	if (text.length >= 2 && (text[0] === '"' || text[0] === "'") && text[text.length - 1] === text[0]) {
		const inner = text.slice(1, -1);
		if (text[0] === "'") return inner;
		return inner.replace(/\\([\\tn"])/g, (all, ch) => (ch === "t" ? "\t" : ch === "n" ? "\n" : ch));
	}
	return text;
}

/** `[a, b]` written on one line, or null when the text is not a flow list. */
function parseFlowList(raw) {
	const text = String(raw).trim();
	if (text.length < 2 || text[0] !== "[" || text[text.length - 1] !== "]") return null;
	const inner = text.slice(1, -1).trim();
	if (inner.length === 0) return [];
	const out = [];
	for (const part of inner.split(",")) out.push(parseScalar(part));
	return out;
}

/**
 * Per-note numbering overrides from the YAML frontmatter, so one vault can hold
 * a legal note and a workshop note in different shapes:
 *
 *   numbering:
 *     indent: "\t"
 *     depth-policy: unnumbered
 *     formats:
 *       - "1."
 *       - "1.1."
 *
 * Returns {} when the note carries no `numbering:` block, so the global
 * settings stay in charge and nothing has to be undone when the note closes.
 */
function parseNoteConfig(text) {
	const head = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(String(text));
	if (!head) return {};
	const rows = head[1].split(/\r?\n/);
	let i = 0;
	while (i < rows.length && !/^numbering\s*:/.test(rows[i])) i++;
	if (i >= rows.length) return {};
	const out = {};
	const formats = [];
	let collecting = false;
	let formatsIndent = 0;
	for (i += 1; i < rows.length; i++) {
		const row = rows[i];
		if (isBlank(row)) continue;
		const indent = /^(\s*)/.exec(row)[1].length;
		if (indent === 0) break;
		const item = /^\s+-\s+(.*)$/.exec(row);
		if (item && collecting && indent > formatsIndent) {
			formats.push(parseScalar(item[1]));
			continue;
		}
		const kv = /^\s+([A-Za-z][A-Za-z-]*)\s*:\s*(.*)$/.exec(row);
		if (!kv) {
			collecting = false;
			continue;
		}
		collecting = false;
		const key = kv[1].toLowerCase();
		const value = parseScalar(kv[2]);
		if (key === "indent") {
			if (/^[ \t]+$/.test(value)) out.indent = value;
		} else if (key === "depth-policy") {
			const policy = value.toLowerCase();
			if (DEPTH_POLICIES.indexOf(policy) >= 0) out.depthPolicy = policy;
		} else if (key === "formats") {
			const flow = parseFlowList(kv[2]);
			if (flow) {
				for (const row2 of flow) formats.push(row2);
			} else if (value.length === 0) {
				collecting = true;
				formatsIndent = indent;
			}
		}
	}
	if (formats.length > 0) out.formats = normaliseFormats(formats);
	return out;
}

/* ------------------------------ clean up ------------------------------ */

/**
 * A note that drifted, back in shape: the indent becomes whole units of the
 * configured width, a number jammed against its text gets its space back, the
 * trailing whitespace goes, and every number is recomputed from the real depth.
 */
function normalizeOutline(lines, from, to) {
	const mask = fenceMask(lines);
	const out = lines.slice();
	const unit = indentColumns(CONFIG.indent) || 2;
	let changed = false;
	for (let i = Math.max(0, from); i <= Math.min(out.length - 1, to); i++) {
		if (mask[i]) continue;
		const trimmed = out[i].replace(/[ \t]+$/, "");
		if (trimmed !== out[i]) {
			out[i] = trimmed;
			changed = true;
		}
		/* `1.text` is repaired to `1. text`. The split point is found by
		 * trying every one and keeping the first that really parses, so a
		 * long number like `1.1.` is not cut in half, and prose that only
		 * happens to look like a number is left alone. */
		if (!parseLine(out[i])) {
			const indent = /^(\s*)/.exec(out[i])[1];
			const rest = out[i].slice(indent.length);
			if (/^\d/.test(rest)) {
				for (let cut = rest.length - 1; cut >= 1; cut--) {
					const candidate = indent + rest.slice(0, cut) + " " + rest.slice(cut);
					if (parseLine(candidate)) {
						out[i] = candidate;
						changed = true;
						break;
					}
				}
			}
		}
		const p = parseLine(out[i]);
		if (!p) continue;
		const depth = Math.round(p.columns / unit);
		const next = CONFIG.indent.repeat(Math.max(0, depth)) + p.number + " " + p.content;
		if (next !== out[i]) {
			out[i] = next;
			changed = true;
		}
	}
	if (renumberRange(out, Math.max(0, from - 1), Math.min(out.length - 1, to + 1))) changed = true;
	return changed ? out : null;
}

/* ------------------------------ smart paste ------------------------------ */

/* What "a list item" looks like when it arrives from Word, Docs, a web page or
 * a chat. Nothing outside these lines is touched. */
const BULLET_RE = /^(\s*)[•‣◦▪·∙○●\-\u2013\u2014*+>]\s+(.*)$/;
const COUNTED_RE = /^(\s*)(?:\((?:[0-9]+|[a-zA-Z]|[IVXLCDMivxlcdm]|[ก-ฮ]|[๐-๙])\)|(?:[0-9]+(?:\.[0-9]+)*|[a-zA-Z]|[IVXLCDMivxlcdm]|[ก-ฮ]|[๐-๙]+)[.):])\s*(.*)$/;
/* Word, Docs and chat clients write `1.1.1 text` with no closing mark. Two
 * segments or more and a space after the number is enough to call it a marker,
 * and then the number itself says how deep the item sits. One segment still
 * needs its closing mark, so a line that merely starts with `1` stays prose. */
const PATH_RE = /^(\s*)([0-9]+(?:\.[0-9]+)+)[.):]?\s+(.*)$/;

/** One line as it would be numbered: its depth, its text, and whether a
 *  foreign marker had to be taken off first. A dotted path carries its own
 *  depth in its segments; anything else is placed by the indent. */
function stripMarker(row) {
	if (isBlank(row)) return null;
	const indent = /^(\s*)/.exec(row)[1];
	const path = PATH_RE.exec(row);
	if (path) {
		return {
			columns: indentColumns(path[1]),
			content: path[3],
			marked: true,
			depth: path[2].split(".").length - 1,
		};
	}
	const hit = BULLET_RE.exec(row) || COUNTED_RE.exec(row);
	if (hit) return { columns: indentColumns(hit[1]), content: hit[2], marked: true, depth: null };
	return { columns: indentColumns(indent), content: row.slice(indent.length), marked: false, depth: null };
}

/** The smallest indent step in the text, so a 3-space or a tab outline still
 *  comes out one level per step. */
function smallestStep(steps, fallback) {
	let best = 0;
	for (const value of steps) {
		if (value > 0 && (best === 0 || value < best)) best = value;
	}
	return best > 0 ? best : fallback;
}

/**
 * Text pasted from anywhere, as this plugin's numbering: foreign bullets and
 * foreign numbers are stripped, the indent decides the depth, and the result is
 * renumbered in one pass.
 */
function ingestOutline(text) {
	const rows = String(text).replace(/\r\n?/g, "\n").split("\n");
	const items = rows.map((row) => stripMarker(row));
	const columns = [];
	for (const item of items) if (item) columns.push(item.columns);
	const base = columns.length > 0 ? Math.min.apply(null, columns) : 0;
	const unit = smallestStep(columns.filter((c) => c > base), indentColumns(CONFIG.indent) || 2);
	const out = [];
	for (let i = 0; i < rows.length; i++) {
		const item = items[i];
		if (!item) {
			out.push(rows[i]);
			continue;
		}
		/* A dotted path already knows its depth from its segments, so a drifted
		 * indent cannot push it down a level. Everything else is placed by the
		 * indent, rounded to the nearest step so a ragged indent still lands. */
		const raw = item.depth === null ? Math.round((item.columns - base) / unit) : item.depth;
		const depth = Math.max(0, Math.min(MAX_LEVELS - 1, raw));
		out.push(CONFIG.indent.repeat(depth) + "0. " + item.content);
	}
	renumberRange(out, 0, out.length - 1);
	return out;
}

/** True when the text is a list worth renumbering, which is what keeps the
 *  paste hook away from ordinary prose. */
function looksLikeOutline(text) {
	const rows = String(text).replace(/\r\n?/g, "\n").split("\n").filter((row) => !isBlank(row));
	if (rows.length < 2) return false;
	let marked = 0;
	const depths = [];
	for (const row of rows) {
		const item = stripMarker(row);
		if (!item) continue;
		depths.push(item.columns);
		if (item.marked) marked++;
	}
	if (marked >= 2) return true;
	const unique = [];
	for (const depth of depths) if (unique.indexOf(depth) < 0) unique.push(depth);
	return unique.length >= 2;
}

/* ------------------------------ clean text ------------------------------ */

/**
 * The selection as text that is ready for a report, an email or Word: wiki links
 * become their display text, callouts lose their markers and keep their titles,
 * comments and emphasis marks go, and markdown syntax is flattened to prose.
 */
function cleanForExport(text) {
	let out = String(text).replace(/\r\n?/g, "\n");
	out = out.replace(/^\uFEFF?---\n[\s\S]*?\n---\n?/, "");
	out = out.replace(/%%[\s\S]*?%%/g, "");
	out = out.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (all, target, alias) => alias || target);
	out = out.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (all, target, alias) => alias || target);
	out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1");
	out = out.replace(/^(\s*)>\s?\[!\w+\]\s*/gm, "$1");
	out = out.replace(/^(\s*)>\s?/gm, "$1");
	out = out.replace(/^(\s*)[-*+]\s+/gm, "$1");
	out = out.replace(/(\*\*|__|~~|`)/g, "");
	out = out.replace(/^#{1,6}\s+/gm, "");
	out = out.replace(/^\s*([-*_])(?:\s*\1){2,}\s*$/gm, "");
	out = out.replace(/<[^>]+>/g, "");
	out = out.replace(/[ \t]+$/gm, "");
	return out;
}

/* ---------------------------- dispatch ---------------------------- */

/* ---------------------------- rich output ---------------------------- */

/** The numbered lines of `lines` as a tree, keeping their rendered numbers. */
function outlineTree(lines) {
	const nodes = [];
	const stack = [];
	for (const line of lines) {
		const p = parseLine(line);
		if (!p) continue;
		const node = { number: p.number, content: p.content, columns: p.columns, children: [] };
		while (stack.length > 0 && stack[stack.length - 1].columns >= p.columns) stack.pop();
		if (stack.length === 0) nodes.push(node);
		else stack[stack.length - 1].node.children.push(node);
		stack.push({ columns: p.columns, node });
	}
	return nodes;
}

/**
 * The outline as nested HTML. In `keep-numbers` mode the plugin's own numbers
 * stay as literal text so the pasted copy matches the note exactly; in `list`
 * mode they become a real nested list and the target application numbers it.
 */
function buildHtmlOutline(lines, mode) {
	const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	const keep = mode !== "list";
	const tag = keep ? "ul" : "ol";
	const renderItems = (nodes) =>
		nodes
			.map((node) => {
				const text = keep ? node.number + " " + node.content : node.content;
				const kids = node.children.length > 0 ? "<" + tag + ">" + renderItems(node.children) + "</" + tag + ">" : "";
				return "<li>" + esc(text) + kids + "</li>";
			})
			.join("");
	return "<" + tag + ' class="multilevel-number-indent">' + renderItems(outlineTree(lines)) + "</" + tag + ">";
}

/** One character of text as RTF wants it. */
function rtfEscape(text) {
	let out = "";
	for (const ch of text) {
		if (ch === "\\" || ch === "{" || ch === "}") {
			out += "\\" + ch;
			continue;
		}
		const code = ch.codePointAt(0);
		out += code < 128 ? ch : "\\u" + (code > 32767 ? code - 65536 : code) + "?";
	}
	return out;
}

/**
 * Rich Text Format, which Word and Mail accept and text/plain cannot express:
 * unlike the HTML form it keeps the plugin's own numbers as text in every mode.
 */
function buildRtfOutline(lines) {
	const parts = ["{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Consolas;}}\\f0\\fs22 "];
	for (const line of lines) {
		const p = parseLine(line);
		const text = p ? p.indent + p.number + " " + p.content : line;
		parts.push(rtfEscape(text) + "\\line ");
	}
	parts.push("}");
	return parts.join("");
}

/* ------------------------- several lines at once ------------------------- */

/** Every top level item in [from, to], each with its subtree counted once. */
function rootItems(lines, from, to, mask) {
	const out = [];
	let covered = -1;
	for (let i = from; i <= to; i++) {
		if (i <= covered || (mask && mask[i])) continue;
		if (!parseLine(lines[i])) continue;
		out.push(i);
		covered = subtreeRange(lines, i, mask).end;
	}
	return out;
}

/** True when an earlier line in the same block sits at exactly `p`'s level. */
function hasEarlierSibling(lines, l, p, mask) {
	const block = findBlock(lines, l);
	for (let i = l - 1; i >= block.start; i--) {
		if (mask && mask[i]) continue;
		const q = parseLine(lines[i]);
		if (q && q.columns === p.columns) return true;
	}
	return false;
}

/** Shifts the indent of every line by `steps` whole units. */
function shiftBlockIndent(lines, steps) {
	if (steps === 0) return lines.slice();
	return lines.map((line) => {
		let out = line;
		for (let i = 0; i < steps; i++) {
			const m = /^(\s*)/.exec(out);
			out = (m ? m[1] : "") + CONFIG.indent + out.slice(m ? m[1].length : 0);
		}
		for (let i = 0; i < -steps; i++) out = removeIndentUnit(out);
		return out;
	});
}

/** The keys that move a selected group as one. */
const GROUP_KEYS = new Set(["indent", "outdent", "moveUp", "moveDown"]);

/** True when a selection starting on line `from` is a group this plugin owns:
 *  a numbered item, outside a code fence, and not a heading. */
function startsGroup(lines, from) {
	return Boolean(parseLine(lines[from])) && !fenceMask(lines)[from] && !parseHeading(lines[from]);
}

/**
 * Tab, Shift+Tab and Alt+Up/Down over a multi-line selection. Every selected
 * item keeps its subtree, so the whole group moves as one.
 */
function applyActionRange(lines, from, to, action) {
	if (to <= from) return applyAction(lines, from, 0, action);
	const mask = fenceMask(lines);
	const first = parseLine(lines[from]);
	if (!first || mask[from] || parseHeading(lines[from])) return null;
	if (action === "indent" || action === "outdent") return shiftItems(lines, from, to, action === "indent" ? 1 : -1);
	if (action === "moveUp" || action === "moveDown") return moveItems(lines, from, to, action === "moveUp");
	return null;
}

/** Tab or Shift+Tab across a group of items, one level each, in one step. */
function shiftItems(lines, from, to, dir) {
	const mask = fenceMask(lines);
	const roots = rootItems(lines, from, to, mask);
	if (roots.length === 0) return null;
	const p = parseLine(lines[roots[0]]);
	/* The whole group moves only when the guard passes for the group as a
	 * whole, the way Word does it. */
	if (dir > 0 && !hasEarlierSibling(lines, roots[0], p, mask)) return null;
	if (dir > 0 && stopsAt(depthInBlock(lines, roots[0], mask) + 1, CONFIG.formats, CONFIG.depthPolicy)) return null;
	if (dir < 0 && p.columns === 0) return null;
	/* Every subtree is measured on the untouched text, and every line moves
	 * exactly once. Measuring on the text being edited let an item that had
	 * already moved right fall into the subtree of the item above it, so it
	 * moved again: four siblings came out as a staircase of four levels. */
	const moveLine = new Array(lines.length).fill(false);
	let last = roots[0];
	for (const root of roots) {
		const sub = subtreeRange(lines, root, mask);
		for (let i = sub.start; i <= sub.end; i++) moveLine[i] = true;
		last = Math.max(last, sub.end);
	}
	const out = lines.slice();
	for (let i = 0; i < out.length; i++) {
		if (moveLine[i] && !isBlank(out[i])) out[i] = shiftBlockIndent([out[i]], dir)[0];
	}
	const block = findBlock(lines, roots[0]);
	renumberRange(out, Math.max(0, block.start - 1), Math.min(out.length - 1, last + 1));
	if (out.join("\n") === lines.join("\n")) return null;
	/* The selection stays on the same lines, so the next Tab moves the same group. */
	return { lines: out, caretLine: roots[0], caretCh: null, selectFrom: from, selectTo: Math.max(to, last) };
}

/** Alt+Up/Down across a group of items: the group swaps with the neighbouring
 *  items at the same level, subtrees and blank lines travelling with them. */
function moveItems(lines, from, to, dir) {
	const mask = fenceMask(lines);
	const roots = rootItems(lines, from, to, mask);
	if (roots.length === 0) return null;
	const p = parseLine(lines[roots[0]]);
	const first = roots[0];
	const last = subtreeRange(lines, roots[roots.length - 1], mask).end;
	const block = findBlock(lines, first);
	const other = dir ? prevSibling(lines, first, block, p, mask) : nextSibling(lines, last, block, p, mask);
	if (other < 0) return null;
	const sib = subtreeRange(lines, other, mask);
	const out = dir
		? lines
				.slice(0, other)
				.concat(lines.slice(first, last + 1), lines.slice(other, sib.end + 1), lines.slice(last + 1))
		: lines.slice(0, first).concat(lines.slice(other, sib.end + 1), lines.slice(first, last + 1), lines.slice(sib.end + 1));
	if (renumberRange(out, Math.max(0, Math.min(first, other) - 1), Math.min(out.length - 1, Math.max(last, sib.end) + 1))) {
		/* The group's new first line; the selection follows it there, so the
		 * next Alt+Up/Down or Tab moves the same group again. */
		const start = dir ? other : first + (sib.end - other + 1);
		return { lines: out, caretLine: start, caretCh: null, selectFrom: start, selectTo: start + (last - first) };
	}
	return null;
}

/* ----------------------- cut and paste as a subtree ----------------------- */

/** The item and everything under it, taken out of the document. */
function cutItem(lines, l) {
	const mask = fenceMask(lines);
	if (mask[l] || !parseLine(lines[l])) return null;
	const sub = subtreeRange(lines, l, mask);
	if (sub.start !== l) return null;
	const taken = lines.slice(sub.start, sub.end + 1);
	const out = lines.slice(0, sub.start).concat(lines.slice(sub.end + 1));
	const block = findBlock(lines, l);
	const span = sub.end - sub.start + 1;
	renumberRange(out, Math.max(0, block.start - 1), Math.min(out.length - 1, Math.max(0, block.end - span)));
	return {
		taken,
		lines: out,
		caretLine: Math.max(0, Math.min(sub.start, out.length - 1)),
		caretCh: null,
	};
}

/**
 * The block that was cut, back in the document as the next item at the target's
 * level, renumbered where it lands. Tab demotes it one more level if the user
 * wanted it nested.
 */
function pasteItem(lines, l, taken) {
	if (!Array.isArray(taken) || taken.length === 0) return null;
	const out = lines.slice();
	let at = out.length;
	let indent = "";
	if (l >= 0 && l < out.length && parseLine(out[l])) {
		const mask = fenceMask(out);
		at = subtreeRange(out, l, mask).end + 1;
		indent = parseLine(out[l]).indent;
	}
	const first = parseLine(taken[0]);
	if (!first) return null;
	const steps = Math.round((indentColumns(indent) - first.columns) / (indentColumns(CONFIG.indent) || 2));
	const moved = shiftBlockIndent(taken, steps);
	const next = out.slice(0, at).concat(moved, out.slice(at));
	const block = findBlock(next, at);
	renumberRange(next, Math.max(0, block.start - 1), Math.min(next.length - 1, block.end + 1));
	return { lines: next, caretLine: at, caretCh: null };
}

/** The item and its subtree, dropped onto `target` (0 based) within its own
 *  block, then renumbered. */
function setLevel(lines, l, target) {
	const mask = fenceMask(lines);
	if (mask[l] || !parseLine(lines[l])) return null;
	const goal = Math.max(0, Math.min(MAX_LEVELS - 1, Math.floor(target)));
	const depth = depthInBlock(lines, l, mask);
	if (depth === goal) return null;
	const sub = subtreeRange(lines, l, mask);
	const unit = indentColumns(CONFIG.indent) || 2;
	const moved = shiftBlockIndent(lines.slice(sub.start, sub.end + 1), Math.round((goal - depth) * unit) / unit);
	const out = lines.slice();
	for (let i = 0; i < moved.length; i++) out[sub.start + i] = moved[i];
	const block = findBlock(lines, l);
	renumberRange(out, Math.max(0, block.start - 1), Math.min(out.length - 1, block.end + 1));
	return out.join("\n") === lines.join("\n") ? null : { lines: out, caretLine: sub.start, caretCh: null };
}

/* ------------------------------ indent guide ------------------------------ */

/**
 * The column of the last digit of a rendered number, so a line can hang its one
 * rule on the number it actually shows. Closing marks and separators are not
 * numbers, and Thai digits count like any other.
 */
function lastNumberIndex(number) {
	for (let i = number.length - 1; i >= 0; i--) {
		const ch = number[i];
		if (ch.trim() === "" || ".:()[]".indexOf(ch) >= 0) continue;
		return i;
	}
	return -1;
}

/**
 * Where the guides go: one per numbered item that has something under it, hung
 * on the last digit of its own number and running down to the last line of its
 * subtree. `ch` is the offset of that digit inside the line, so the editor can
 * measure the real pixel position whatever the font is. An item with nothing
 * under it draws nothing, so a flat list stays clean.
 */
function guideSpans(lines) {
	const mask = fenceMask(lines);
	const out = [];
	for (let i = 0; i < lines.length; i++) {
		if (mask[i]) continue;
		const p = parseLine(lines[i]);
		if (!p) continue;
		const sub = subtreeRange(lines, i, mask);
		if (sub.end <= i) continue;
		const digit = lastNumberIndex(p.number);
		if (digit < 0) continue;
		out.push({ line: i, ch: p.indent.length + digit, end: sub.end });
	}
	return out;
}

/** Pixels kept clear between a guide and the text it runs past. */
const GUIDE_GAP = 4;

/**
 * Where one guide actually goes, in pixels. It hangs on the last digit when
 * there is room; when a long number reaches past where its children's text
 * starts (`1.1.1)` over a one-tab indent), it slides left to sit just before
 * that text instead of cutting through it. It never slides left of the start
 * of its own number. The text itself is never moved.
 */
function guideX(digitX, childTextXs, ownStartX, gap) {
	const room = childTextXs.filter((x) => typeof x === "number" && Number.isFinite(x));
	if (room.length === 0) return digitX;
	const limit = Math.min(...room) - (typeof gap === "number" ? gap : GUIDE_GAP);
	const x = Math.min(digitX, limit);
	return typeof ownStartX === "number" ? Math.max(ownStartX, x) : x;
}

/** What the status bar shows for the cursor's line: its level and its number. */
function statusFor(lines, line) {
	const target = lines[line];
	if (target === undefined) return "";
	const mask = fenceMask(lines);
	if (mask[line]) return "";
	const heading = parseHeading(target);
	if (heading) {
		const hit = headingNumbers(lines).filter((row) => row.line === line)[0];
		return "Level " + heading.level + " · " + (hit ? hit.number : "");
	}
	const p = parseLine(target);
	if (!p) return "";
	return "Level " + (depthInBlock(lines, line, mask) + 1) + " · " + p.number;
}

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
	DEFAULT_SETTINGS,
	MIN_LEVELS,
	MAX_LEVELS,
	DEPTH_POLICIES,
	BUILTIN_PRESETS,
	stopsAt,
	depthInBlock,
	thaiLetter,
	thaiDigit,
	presetList,
	presetByName,
	parsePresetsJson,
	renderPresetsJson,
	parseScalar,
	parseFlowList,
	parseNoteConfig,
	normalizeOutline,
	stripMarker,
	smallestStep,
	ingestOutline,
	looksLikeOutline,
	cleanForExport,
	outlineTree,
	buildHtmlOutline,
	rtfEscape,
	buildRtfOutline,
	rootItems,
	hasEarlierSibling,
	shiftBlockIndent,
	applyActionRange,
	shiftItems,
	moveItems,
	cutItem,
	pasteItem,
	setLevel,
	headingContinuation,
	guideSpans,
	guideX,
	lastNumberIndex,
	statusFor,
	STYLES,
	STYLE_RE,
	LEGACY_SHAPES,
	alpha,
	roman,
	placeholderCount,
	templateFor,
	headingTemplate,
	templateToRe,
	buildNumberRe,
	normaliseFormats,
	renderTemplate,
	renderNumber,
	previewLines,
	getConfig,
	setConfig,
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
	clearFormatting,
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

class MultilevelNumberIndent extends Plugin {
	async onload() {
		await this.loadSettings();
		this.syncGuideClass();
		this.register(() => this.syncGuideClass(false));

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
		this.registerEditorExtension(guideLayer);
		this.addFormatCommands();
		this.registerPasteHook();
		this.registerStatus();
		this.cutBuffer = null;
		this.globalConfig = getConfig();
		this.applyNoteConfig();

		this.addCommand({
			id: "renumber-block",
			name: "Renumber multilevel block",
			editorCallback: (editor) => this.runRange(editor, renumberRange, "renumber"),
		});
		this.addCommand({
			id: "insert-numbering",
			name: "Insert multilevel numbering",
			editorCallback: (editor) => this.runRange(editor, insertNumbering, "insert"),
		});
		this.addCommand({
			id: "remove-numbering",
			name: "Remove multilevel numbering",
			editorCallback: (editor) => this.runRange(editor, removeNumbering, "remove"),
		});
		this.addCommand({
			id: "clear-format",
			name: "Clear list markers and keep the indent",
			editorCallback: (editor) => this.runRange(editor, clearFormatting, "clear"),
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
		this.addCommand({
			id: "continue-heading-numbering",
			name: "Continue numbering past this heading",
			editorCheckCallback: (checking, editor) => this.runHeadingContinuation(editor, checking, true),
		});
		this.addCommand({
			id: "restart-heading-numbering",
			name: "Restart numbering at this heading",
			editorCheckCallback: (checking, editor) => this.runHeadingContinuation(editor, checking, false),
		});

		this.addSettingTab(new MultilevelNumberIndentSettingTab(this.app, this));
		this.registerEditorMenu();
	}

	async loadSettings() {
		const data = (await this.loadData()) || {};
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		Object.assign(this.settings, setConfig(this.settings));
	}

	async saveSettings() {
		Object.assign(this.settings, setConfig(this.settings));
		await this.saveData(this.settings);
		this.syncGuideClass();
	}

	/** While this plugin draws its guides, the host's per-step indentation
	 *  guides are hidden on numbered lines, so each item shows one rule. */
	syncGuideClass(on) {
		if (typeof document === "undefined" || !document.body) return;
		const want = on === undefined ? Boolean(this.settings && this.settings.indentGuides) : on;
		document.body.classList.toggle("multilevel-number-indent-guides-on", want);
	}

	/**
	 * Capture-phase listener on `document`. It runs before CodeMirror keymaps and
	 * before other plugins such as Obsidian Outliner, which is what lets Tab mean
	 * "indent the numbering" here while still meaning "indent the list" on every
	 * line this plugin does not recognise.
	 */
	/**
	 * A note can carry its own numbering in its frontmatter. The global settings
	 * are remembered and put back on the next note, so nothing has to be undone
	 * by hand when this note closes.
	 */
	applyNoteConfig() {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const text = view && view.editor ? view.editor.getValue() : "";
		const override = parseNoteConfig(text);
		const base = Object.keys(override).length > 0 ? Object.assign({}, this.globalConfig, override) : this.globalConfig;
		Object.assign(this.settings, setConfig(base));
	}

	/** The level and the number under the cursor, in the status bar. */
	registerStatus() {
		this.statusEl = this.addStatusBarItem();
		this.registerDomEvent(document, "selectionchange", () => this.updateStatus());
		this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.updateStatus()));
		this.updateStatus();
	}

	updateStatus() {
		if (!this.statusEl) return;
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view || !view.editor) {
			this.statusEl.textContent = "";
			return;
		}
		const editor = view.editor;
		this.statusEl.textContent = statusFor(editor.getValue().split("\n"), editor.getCursor().line);
	}

	/** Records every command as it registers, so the right-click menu can list
	 *  them all without keeping a second copy of the names. */
	addCommand(spec) {
		if (!this.commandList) this.commandList = [];
		this.commandList.push({ id: spec.id, name: spec.name });
		return super.addCommand(spec);
	}

	/** "Keep counting past this heading", or "start a fresh list at 1 here". */
	runHeadingContinuation(editor, checking, on) {
		const text = editor.getValue();
		const line = editor.getCursor().line;
		if (parseHeading(text.split("\n")[line] || "") === null) return false;
		if (checking) return true;
		const result = headingContinuation(text.split("\n"), line, on);
		if (result) this.applyResult(editor, text, result);
		return true;
	}

	/**
	 * One labelled group in the editor's right-click menu, sorted into small
	 * categories so the list stays readable. The two heading commands light up
	 * on a heading and stay hidden everywhere else.
	 */
	registerEditorMenu() {
		const groups = [
			{
				title: "Numbering",
				ids: ["renumber-block", "insert-numbering", "remove-numbering", "clear-format", "normalize-outline", "ingest-outline"],
			},
			{ title: "Moving items", ids: ["cut-item", "paste-item", "move-item-to-level"] },
			{ title: "Copying out", ids: ["copy-clean-text", "save-clean-note", "copy-formatted", "copy-list"] },
			{
				title: "Headings",
				ids: ["number-headings", "remove-heading-numbers", "continue-heading-numbering", "restart-heading-numbering"],
			},
		];
		const headingOnly = { "continue-heading-numbering": true, "restart-heading-numbering": true };
		const grouped = {};
		for (const group of groups) for (const id of group.ids) grouped[id] = true;
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) => {
				const text = editor.getValue().split("\n")[editor.getCursor().line] || "";
				const onHeading = parseHeading(text) !== null;
				const byId = {};
				for (const cmd of this.commandList || []) byId[cmd.id] = cmd;
				const run = (cmd) => (entry) =>
					entry.setTitle(cmd.name).onClick(() => {
						this.app.commands.executeCommandById(this.manifest.id + ":" + cmd.id);
					});
				const visible = (cmd) => Boolean(cmd) && (!headingOnly[cmd.id] || onHeading);
				menu.addItem((item) => {
					item.setTitle("Multilevel list section").setIcon("list-ordered");
					const target = typeof item.setSubmenu === "function" ? item.setSubmenu() : menu;
					/* The categories are labelled sections inside this one
					 * submenu, not submenus of their own. The host cannot switch
					 * between sibling submenus two levels deep: once one opens,
					 * hovering or clicking another does nothing until the whole
					 * menu is dismissed. One level with headings avoids that. */
					let first = true;
					for (const group of groups) {
						const cmds = group.ids.map((id) => byId[id]).filter(visible);
						if (cmds.length === 0) continue;
						if (!first && typeof target.addSeparator === "function") target.addSeparator();
						first = false;
						target.addItem((label) => {
							label.setTitle(group.title);
							if (typeof label.setIsLabel === "function") label.setIsLabel(true);
							if (typeof label.setDisabled === "function") label.setDisabled(true);
						});
						for (const cmd of cmds) target.addItem(run(cmd));
					}
					/* Anything the categories do not name still shows up, so a new
					 * command can never silently miss the menu. */
					const rest = (this.commandList || []).filter((cmd) => !grouped[cmd.id] && visible(cmd));
					if (rest.length > 0 && typeof target.addSeparator === "function") target.addSeparator();
					for (const cmd of rest) target.addItem(run(cmd));
				});
			})
		);
	}

	/**
	 * Paste turns a foreign list into this plugin's numbering, but only when the
	 * clipboard really looks like a list. Prose is pasted untouched.
	 */
	registerPasteHook() {
		this.registerEvent(
			this.app.workspace.on("editor-paste", (event, editor) => {
				if (event.defaultPrevented) return;
				if (!this.settings.formatOnPaste) return;
				const text = event.clipboardData ? event.clipboardData.getData("text/plain") : "";
				if (!text || !looksLikeOutline(text)) return;
				event.preventDefault();
				editor.replaceSelection(ingestOutline(text).join("\n"));
			})
		);
	}

	/**
	 * The outline on the clipboard as rich text: HTML for browsers and mail, RTF
	 * for Word, and plain text as the fallback every application can read.
	 */
	writeRich(lines, mode) {
		const plain = lines
			.map((line) => {
				const p = parseLine(line);
				return p ? p.number + " " + p.content : line;
			})
			.join("\n");
		const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : null;
		if (clipboard && clipboard.write && typeof ClipboardItem !== "undefined") {
			clipboard
				.write([
					new ClipboardItem({
						"text/plain": new Blob([plain], { type: "text/plain" }),
						"text/html": new Blob([buildHtmlOutline(lines, mode)], { type: "text/html" }),
						"text/rtf": new Blob([buildRtfOutline(lines)], { type: "text/rtf" }),
					}),
				])
				.catch(() => {});
			return;
		}
		this.app.clipboard.write(plain);
	}

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
		/* A selection that spans lines moves as one group: every item in it
		 * keeps its subtree. A cursor or a single line keeps the exact old
		 * behaviour, so nothing else has to know about selections. */
		const from = editor.getCursor("from").line;
		const to = editor.getCursor("to").line;
		const grouped = from < to ? applyActionRange(before, from, to, action) : null;
		/* A group that cannot move (no sibling to nest under, already at the
		 * top, nothing to swap with) stays exactly as it is, still selected.
		 * Falling back to the single-line move here tore the line under the
		 * caret out of the group and dropped the selection. The key is
		 * swallowed so the host's own Tab does not re-indent the raw text. */
		if (from < to && !grouped && GROUP_KEYS.has(action) && startsGroup(before, from)) return true;
		const result = grouped || applyAction(before, cursor.line, cursor.ch, action);
		if (!result) return false;
		const next = result.lines.join("\n");
		if (next === text) return false;
		const diff = minimalChange(text, next);
		const caretLine = result.caretLine === null ? cursor.line : result.caretLine;
		const lineText = result.lines[caretLine] || "";
		let caretCh = result.caretCh;
		if (caretCh === null) caretCh = caretAfter(before[cursor.line] || "", lineText, cursor.ch);
		caretCh = Math.min(caretCh, lineText.length);
		/* A selection survives every move: the group stays selected until the
		 * user clicks elsewhere, so Tab, Shift+Tab and Alt+Up/Down can be
		 * pressed again and again on the same lines. A single dragged line
		 * keeps its whole line selected the same way. */
		const hadSelection = editor.getCursor("from").line !== editor.getCursor("to").line || editor.getCursor("from").ch !== editor.getCursor("to").ch;
		const keepGroup = typeof result.selectFrom === "number" && typeof result.selectTo === "number";
		const selFrom = keepGroup ? result.selectFrom : caretLine;
		const selTo = keepGroup ? result.selectTo : caretLine;
		const selection = (keepGroup || (hadSelection && action !== "enter"))
			? { from: { line: selFrom, ch: 0 }, to: { line: selTo, ch: (result.lines[selTo] || "").length } }
			: { from: { line: caretLine, ch: caretCh }, to: { line: caretLine, ch: caretCh } };
		editor.transaction({
			changes: [{ from: offsetToPos(text, diff.from), to: offsetToPos(text, diff.to), text: diff.insert }],
			selection,
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

	/** Writes a core result back through one minimal transaction. */
	applyResult(editor, text, result) {
		const next = result.lines.join("\n");
		if (next === text) return false;
		const diff = minimalChange(text, next);
		const cursor = editor.getCursor();
		const caretLine = result.caretLine === null ? cursor.line : result.caretLine;
		const lineText = result.lines[caretLine] || "";
		const wanted = result.caretCh === null ? cursor.ch : result.caretCh;
		const caretCh = Math.min(wanted, lineText.length);
		editor.transaction({
			changes: [{ from: offsetToPos(text, diff.from), to: offsetToPos(text, diff.to), text: diff.insert }],
			selection: { from: { line: caretLine, ch: caretCh }, to: { line: caretLine, ch: caretCh } },
		});
		return true;
	}

	/** The commands behind "format this into text I can actually use". */
	addFormatCommands() {
		this.addCommand({
			id: "normalize-outline",
			name: "Normalize the outline",
			editorCallback: (editor) => {
				const text = editor.getValue();
				const lines = text.split("\n");
				const out = normalizeOutline(lines, editor.getCursor("from").line, editor.getCursor("to").line);
				if (out) this.applyResult(editor, text, { lines: out, caretLine: null, caretCh: null });
			},
		});
		this.addCommand({
			id: "ingest-outline",
			name: "Turn the selection into a numbered outline",
			editorCallback: (editor) => {
				const selected = editor.getSelection();
				if (!selected) return;
				editor.replaceSelection(ingestOutline(selected).join("\n"));
			},
		});
		this.addCommand({
			id: "copy-clean-text",
			name: "Copy as clean text",
			editorCallback: (editor) => {
				this.app.clipboard.write(cleanForExport(editor.getSelection() || editor.getValue()));
			},
		});
		this.addCommand({
			id: "save-clean-note",
			name: "Save the selection as a clean note",
			editorCallback: (editor) => {
				const selected = editor.getSelection() || editor.getValue();
				const file = this.app.workspace.getActiveFile();
				const base = (file ? file.basename + " (clean)" : "Clean copy") + ".md";
				this.app.vault.create(this.app.vault.getAvailablePath(base), cleanForExport(selected));
			},
		});
		this.addCommand({
			id: "copy-formatted",
			name: "Copy as formatted text",
			editorCallback: (editor) => {
				this.writeRich((editor.getSelection() || editor.getValue()).split("\n"), "keep-numbers");
			},
		});
		this.addCommand({
			id: "copy-list",
			name: "Copy as a real nested list",
			editorCallback: (editor) => {
				this.writeRich((editor.getSelection() || editor.getValue()).split("\n"), "list");
			},
		});
		this.addCommand({
			id: "cut-item",
			name: "Cut the item with its subtree",
			editorCallback: (editor) => {
				const text = editor.getValue();
				const cut = cutItem(text.split("\n"), editor.getCursor().line);
				if (!cut) return;
				this.cutBuffer = cut.taken;
				this.applyResult(editor, text, cut);
			},
		});
		this.addCommand({
			id: "paste-item",
			name: "Paste the cut item here",
			editorCheckCallback: (checking, editor) => {
				if (checking) return Boolean(this.cutBuffer);
				if (!this.cutBuffer) return;
				const text = editor.getValue();
				const pasted = pasteItem(text.split("\n"), editor.getCursor().line, this.cutBuffer);
				if (!pasted) return;
				this.cutBuffer = null;
				this.applyResult(editor, text, pasted);
			},
		});
		this.addCommand({
			id: "move-item-to-level",
			name: "Move the item to a level",
			editorCheckCallback: (checking, editor) => {
				if (checking) return true;
				new LevelModal(this, (depth) => {
					const text = editor.getValue();
					const moved = setLevel(text.split("\n"), editor.getCursor().line, depth);
					if (moved) this.applyResult(editor, text, moved);
				}).open();
				return true;
			},
		});
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

/**
 * A level picker. The plugin API has no prompt, so this is the one place where a
 * number is asked for rather than typed into the text itself.
 */
class LevelModal extends Modal {
	constructor(plugin, onSubmit) {
		super(plugin.app);
		this.plugin = plugin;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const levels = this.plugin.settings.formats.length;
		let value = 1;
		this.contentEl.createEl("p", { text: "Move the item to level 1 to " + levels + "." });
		new Setting(this.contentEl).setName("Level").addText((text) => {
			text.inputEl.type = "number";
			text.inputEl.min = "1";
			text.inputEl.max = String(levels);
			text.setValue("1");
			text.onChange((raw) => {
				value = Number(raw);
			});
		});
		new Setting(this.contentEl).addButton((button) => {
			button.setButtonText("Move");
			button.setCta();
			button.onClick(() => this.submit(value));
		});
	}

	/** The picked level as a 0 based depth, clamped to the configured levels. */
	submit(value) {
		const levels = this.plugin.settings.formats.length;
		this.close();
		if (this.onSubmit) this.onSubmit(Math.max(0, Math.min(levels - 1, (Math.floor(value) || 1) - 1)));
	}

	onClose() {
		this.contentEl.empty();
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
			const p = mask[index] ? null : parseLine(line.text);
			if (p) builder.add(line.from, line.from, numberingLine);
			if (line.to >= range.to) break;
			pos = line.to + 1;
		}
	}
	return builder.finish();
}

const numberingLine = Decoration.line({ class: "multilevel-number-indent-line" });

/**
 * The guides, drawn on their own layer so the text is never touched. Each one
 * is measured from the editor itself: the x of the digit it hangs on, and the
 * top and bottom of the lines it spans. That keeps it on the digit with Thai
 * text, proportional fonts and wrapped lines, where counting columns drifts.
 */
function guideMarkers(view) {
	if (!CONFIG.indentGuides) return [];
	const doc = view.state.doc;
	const first = doc.lineAt(view.viewport.from).number - 1;
	const last = doc.lineAt(view.viewport.to).number - 1;
	const rect = view.scrollDOM.getBoundingClientRect();
	const baseLeft = rect.left - view.scrollDOM.scrollLeft;
	const baseTop = rect.top - view.scrollDOM.scrollTop;
	const markers = [];
	/* Where each visible line's text starts, measured once and shared by
	 * every guide that runs past it. */
	const textStart = new Map();
	const startOf = (i) => {
		if (textStart.has(i)) return textStart.get(i);
		let x = null;
		const line = doc.line(i + 1);
		const lead = /^\s*/.exec(line.text)[0].length;
		if (lead < line.length) {
			const c = view.coordsAtPos(line.from + lead, 1);
			if (c) x = c.left;
		}
		textStart.set(i, x);
		return x;
	};
	for (const span of guideSpans(doc.toString().split("\n"))) {
		if (span.end < first || span.line > last) continue;
		const line = doc.line(span.line + 1);
		const pos = line.from + span.ch;
		const before = view.coordsAtPos(pos, 1);
		const after = view.coordsAtPos(pos + 1, -1);
		if (!before) continue;
		const digit = after && after.top === before.top ? (before.left + after.left) / 2 : before.left;
		const children = [];
		for (let i = Math.max(span.line + 1, first); i <= Math.min(span.end, last); i++) children.push(startOf(i));
		const x = guideX(digit, children, startOf(span.line), GUIDE_GAP);
		const top = view.lineBlockAt(line.from).bottom + view.documentTop - baseTop;
		const end = doc.line(Math.min(span.end, last) + 1);
		const bottom = view.lineBlockAt(end.from).bottom + view.documentTop - baseTop;
		if (bottom - top < 1) continue;
		markers.push(new RectangleMarker("multilevel-number-indent-guide", Math.round(x - baseLeft), top, null, bottom - top));
	}
	return markers;
}

/* The layer API ships with every host this plugin supports. The guard keeps
 * the plugin loading, without guides, if a host ever lacks it. */
const guideLayer =
	typeof layer === "function" && typeof RectangleMarker === "function"
		? layer({
				above: true,
				class: "multilevel-number-indent-guides",
				update: (update) =>
					update.docChanged || update.viewportChanged || update.geometryChanged || update.transactions.some((tr) => tr.reconfigured),
				markers: (view) => guideMarkers(view),
			})
		: [];

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

/* ============================ SETTINGS TAB ============================ */

class MultilevelNumberIndentSettingTab extends PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.previewEl = null;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Indent per level")
			.setDesc("Added in front of an item every time it goes one level deeper. A tab counts as four columns.")
			.addDropdown((drop) =>
				drop
					.addOption("  ", "Two spaces")
					.addOption("    ", "Four spaces")
					.addOption("\t", "One tab")
					.setValue(this.plugin.settings.indent)
					.onChange(async (value) => {
						this.plugin.settings.indent = value;
						await this.plugin.saveSettings();
						this.renderPreview();
					})
			);

		new Setting(containerEl)
			.setName("Deeper than the last level")
			.setDesc(
				"What a line past the last level above becomes. Reuse the last level keeps numbering every depth; leave it as text keeps the indent and drops the number."
			)
			.addDropdown((drop) =>
				drop
					.addOption("reuse-last", "Reuse the last level")
					.addOption("unnumbered", "Leave it as text")
					.setValue(this.plugin.settings.depthPolicy)
					.onChange(async (value) => {
						this.plugin.settings.depthPolicy = value;
						await this.plugin.saveSettings();
						this.renderPreview();
					})
			);

		new Setting(containerEl)
			.setName("Format pasted lists")
			.setDesc("Turn a list pasted from another application into this numbering. Only text that really looks like a list is touched.")
			.addToggle((toggle) =>
				toggle.setValue(Boolean(this.plugin.settings.formatOnPaste)).onChange(async (value) => {
					this.plugin.settings.formatOnPaste = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Indent guides")
			.setDesc("Draw one faint rule under the last digit of an item that has sub-items, down to its last sub-item. It is drawn on its own layer, so the text and the clipboard are never touched.")
			.addToggle((toggle) =>
				toggle.setValue(Boolean(this.plugin.settings.indentGuides)).onChange(async (value) => {
					this.plugin.settings.indentGuides = value;
					await this.plugin.saveSettings();
					const workspace = this.app && this.app.workspace;
					if (workspace && typeof workspace.updateOptions === "function") workspace.updateOptions();
				})
			);

		new Setting(containerEl).setName("Number format").setHeading();
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text:
				"One template per level. A placeholder becomes the counter of a path segment: 1 arabic, a/A letters, i/I roman numerals, ก Thai letters, ๑ Thai digits. " +
				"Every other character is literal, so it sets the separators and the closing mark, which is how ข้อ ๑. or 1.1(a) is written. " +
				"How many placeholders a row carries decides how many trailing segments that level shows, which is how the default restarts the count at level 4. " +
				"Add or drop levels with the buttons below: two at the least, twelve at the most. The last row is reused for every deeper level unless the setting above says otherwise.",
		});

		const formats = normaliseFormats(this.plugin.settings.formats);
		for (let index = 0; index < formats.length; index++) {
			const i = index;
			const baseDesc = i >= DEFAULT_SETTINGS.formats.length ? "Reused for every deeper level." : "";
			const setting = new Setting(containerEl)
				.setName("Level " + (i + 1))
				.setDesc(baseDesc)
				.addText((text) =>
					text
						.setPlaceholder(templateFor(DEFAULT_SETTINGS.formats, i))
						.setValue(formats[i])
						.onChange(async (value) => {
							const next = normaliseFormats(this.plugin.settings.formats);
							next[i] = value;
							this.plugin.settings.formats = normaliseFormats(next);
							await this.plugin.saveSettings();
							const ok = placeholderCount(value.trim()) > 0;
							setting.setDesc(ok ? baseDesc : "No placeholder here, so the previous value is kept. Try 1, a or i.");
							this.renderPreview();
						})
				)
				.addButton((button) =>
					button
						.setButtonText("Remove")
						.setTooltip("Remove this level")
						.setDisabled(formats.length <= MIN_LEVELS)
						.onClick(async () => {
							const next = normaliseFormats(this.plugin.settings.formats);
							next.splice(i, 1);
							this.plugin.settings.formats = normaliseFormats(next);
							await this.plugin.saveSettings();
							this.display();
						})
				);
		}

		new Setting(containerEl)
			.setName("Add level")
			.setDesc("The new level takes the shape the shipped defaults give that depth.")
			.addButton((button) =>
				button
					.setButtonText("Add level")
					.setDisabled(formats.length >= MAX_LEVELS)
					.onClick(async () => {
						const next = normaliseFormats(this.plugin.settings.formats);
						next.push(templateFor(DEFAULT_SETTINGS.formats, next.length));
						this.plugin.settings.formats = normaliseFormats(next);
						await this.plugin.saveSettings();
						this.display();
					})
			);

		new Setting(containerEl).setName("Presets").setHeading();
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text:
				"A preset is a whole level list. The JSON at the bottom moves the saved ones between machines, and a saved preset that carries a shipped name replaces it.",
		});

		let picked = presetList(this.plugin.settings.presets)[0].name;
		new Setting(containerEl)
			.setName("Apply a preset")
			.setDesc("Replaces every level above with the preset's own list.")
			.addDropdown((drop) => {
				for (const preset of presetList(this.plugin.settings.presets)) drop.addOption(preset.name, preset.name);
				drop.setValue(picked).onChange((value) => {
					picked = value;
				});
			})
			.addButton((button) =>
				button.setButtonText("Apply").onClick(async () => {
					const chosen = presetByName(picked, this.plugin.settings.presets);
					if (!chosen) return;
					this.plugin.settings.formats = chosen;
					await this.plugin.saveSettings();
					this.display();
				})
			);

		let presetName = "";
		new Setting(containerEl)
			.setName("Save the current list")
			.setDesc("Keeps the levels above under this name. A name that already exists is replaced.")
			.addText((text) =>
				text.setPlaceholder("My format").onChange((value) => {
					presetName = value.trim();
				})
			)
			.addButton((button) =>
				button.setButtonText("Save").onClick(async () => {
					if (presetName.length === 0) return;
					const saved = (this.plugin.settings.presets || []).filter((p) => p && p.name !== presetName);
					saved.push({ name: presetName, formats: normaliseFormats(this.plugin.settings.formats) });
					this.plugin.settings.presets = saved;
					await this.plugin.saveSettings();
					this.display();
				})
			);

		let presetJson = "";
		const jsonSetting = new Setting(containerEl)
			.setName("Preset JSON")
			.setDesc(
				"Export copies the saved presets as JSON, ready for another machine. Import reads the box and replaces the saved list, refusing anything that is not a clean list of presets."
			)
			.addTextArea((area) =>
				area.setPlaceholder('[{"name": "My format", "formats": ["1.", "1.1."] }]').onChange((value) => {
					presetJson = value;
				})
			)
			.addButton((button) =>
				button.setButtonText("Export").onClick(() => {
					const text = renderPresetsJson(this.plugin.settings.presets);
					presetJson = text;
					this.plugin.app.clipboard.write(text);
					jsonSetting.setDesc("Copied the " + (this.plugin.settings.presets || []).length + " saved presets to the clipboard.");
				})
			)
			.addButton((button) =>
				button.setButtonText("Import").onClick(async () => {
					const parsed = parsePresetsJson(presetJson);
					if (!parsed) {
						jsonSetting.setDesc("That is not a clean list of presets, so nothing was changed.");
						return;
					}
					this.plugin.settings.presets = parsed;
					await this.plugin.saveSettings();
					this.display();
				})
			);

		new Setting(containerEl).setName("Preview").setHeading();
		this.previewEl = containerEl.createEl("pre", { cls: "multilevel-number-indent-preview" });
		this.renderPreview();
	}

	renderPreview() {
		if (!this.previewEl) return;
		const settings = this.plugin.settings;
		this.previewEl.textContent = previewLines(normaliseFormats(settings.formats), settings.indent, 6).join("\n");
	}
}

module.exports = MultilevelNumberIndent;
module.exports.default = MultilevelNumberIndent;
module.exports.__core = CORE;
module.exports.__settingsTab = MultilevelNumberIndentSettingTab;
