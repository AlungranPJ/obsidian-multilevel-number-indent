// The build for a plugin with no bundler.
//
// main.js is hand-written CommonJS and is shipped exactly as committed, so the
// "build" is a check that the files a release carries are ready to ship: main.js
// parses and exports a plugin class, manifest.json and package.json agree on the
// version, and styles.css is present. Nothing is generated, fetched or installed,
// and it needs no dependencies, so it runs the same on any machine with Node.
// Byte-for-byte, the release assets are the committed main.js, manifest.json and
// styles.css. The assertions live in `npm test`.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Module = require("module");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const fail = (msg) => {
	console.error("build failed: " + msg);
	process.exit(1);
};

for (const name of ["main.js", "manifest.json", "styles.css"]) {
	if (!fs.existsSync(path.join(root, name))) fail(name + " is missing");
}

const source = read("main.js");
try {
	new vm.Script(source, { filename: "main.js" });
} catch (e) {
	fail("main.js does not parse: " + e.message);
}

/* Load it the way the host does, with the host modules stubbed, and make sure
 * the default export is a plugin class. */
/* Anything read, called or constructed on a host module gives back another
 * stub, so load-time calls such as ViewPlugin.fromClass(...) or Prec.highest(...)
 * succeed without a real editor. Plain classes stand in for the ones main.js
 * extends, so `class X extends Plugin` gets a real prototype chain. */
const classes = {};
const deep = () =>
	new Proxy(function () {}, {
		get: (_, key) => {
			if (key === "__esModule") return false;
			if (typeof key === "symbol" || key === "then") return undefined;
			if (key === "prototype") return {};
			return deep();
		},
		apply: () => deep(),
		construct: () => deep(),
	});
const stub = new Proxy(
	{},
	{
		get: (_, key) => {
			if (key === "__esModule") return false;
			if (typeof key === "symbol") return undefined;
			if (/^[A-Z]/.test(key) && !["Prec", "ViewPlugin", "Decoration", "EditorView", "EditorState", "StateField", "StateEffect", "Facet", "RangeSetBuilder", "RectangleMarker", "keymap"].includes(key)) {
				if (!classes[key]) classes[key] = class {};
				return classes[key];
			}
			return deep();
		},
	}
);
const mod = new Module(path.join(root, "main.js"));
mod.filename = path.join(root, "main.js");
mod.paths = Module._nodeModulePaths(root);
const load = Module._load;
Module._load = (req, ...rest) => (req === "obsidian" || req.startsWith("@codemirror/") ? stub : load(req, ...rest));
try {
	mod._compile(source, mod.filename);
} catch (e) {
	fail("main.js throws on load: " + e.message);
} finally {
	Module._load = load;
}
if (typeof mod.exports !== "function" || typeof mod.exports.prototype.onload !== "function") {
	fail("main.js does not export a plugin class");
}

const manifest = JSON.parse(read("manifest.json"));
const pkg = JSON.parse(read("package.json"));
for (const key of ["id", "name", "version", "minAppVersion", "description"]) {
	if (!manifest[key]) fail("manifest.json has no " + key);
}
if (manifest.version !== pkg.version) fail("manifest.json " + manifest.version + " and package.json " + pkg.version + " disagree");

console.log("build ok: main.js, manifest.json and styles.css " + manifest.version + " are ready to ship as committed");
