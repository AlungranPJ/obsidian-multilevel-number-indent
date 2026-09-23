"""Generate assets/example.svg from the real renderer output.

The lines come from main.js's own previewLines(), loaded through the same stubs
the test suite uses, so the card can never drift from what the plugin actually
writes. Run from the repository root:

    python scripts/make-example-card.py
"""

import json
import pathlib
import subprocess

CARDS = [
    ("1.  1.1.  1.1.1.", ["1.", "1.1.", "1.1.1.", "1)"]),
    ("1)  1.1)", ["1)", "1.1)", "1.1.1)", "1.1.1.1)"]),
    ("I.  I.I.", ["I.", "I.I.", "I.I.I.", "I.I.I.I."]),
    ("a)  a.a)", ["a)", "a.a)", "a.a.a)", "a.a.a.a)"]),
    ("ข้อ ๑.", ["ข้อ ๑.", "ข้อ ๑.๑.", "ข้อ ๑.๑.๑.", "(๑)"]),
    ("1.1(a)  legal", ["1.", "1.1", "1.1(a)", "1.1(a)(i)"]),
]
WORDS = ["Introduction", "Scope", "Detail", "Point"]

# Load main.js the way Obsidian does, then ask the plugin itself for the preview.
JS = r"""
const Module = require("module");
const orig = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "obsidian") return { Plugin: class {}, PluginSettingTab: class {}, Setting: class {}, Modal: class {}, ButtonComponent: class {}, MarkdownRenderer: { render() {} }, sanitizeHTMLToDom: (h) => ({ h }) };
  if (request === "@codemirror/view") { const d = (spec) => ({ spec }); return { EditorView: { decorations: { of: () => ({}) }, pluginClass: { of: () => ({}) }, baseTheme: { of: () => ({}) } }, ViewPlugin: { fromClass: () => ({}) }, Decoration: { line: d, widget: d, mark: d, set: (i) => i } }; }
  if (request === "@codemirror/state") return { StateField: { define: (v) => v }, RangeSetBuilder: class {} };
  return orig.call(this, request, parent, isMain);
};
const core = require(process.argv[1]).__core;
const cards = JSON.parse(process.argv[2]);
const depth = JSON.parse(process.argv[3]);
const out = cards.map((formats) => core.previewLines(formats, core.getConfig().indent, depth));
process.stdout.write(JSON.stringify(out));
"""


def render_all():
    """The preview lines for every card, straight from the plugin."""
    cards = [formats for _, formats in CARDS]
    raw = subprocess.run(
        ["node", "-e", JS, str(pathlib.Path("main.js").resolve()), json.dumps(cards), json.dumps(len(WORDS))],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return json.loads(raw)


# Consolas advances 0.55em per character; every line is monospace.
FONT = 17
CHAR = FONT * 0.55
MONO = "Consolas, 'Noto Sans Mono', 'Leelawadee UI', Tahoma, ui-monospace, monospace"
SANS = "'Segoe UI', 'Leelawadee UI', ui-sans-serif, -apple-system, Roboto, Helvetica, Arial, sans-serif"

W, H = 1200, 700
CARD_TOP = 60
COL_X = [72, 452, 832]
ROW_STEP = 250
LABEL_Y = 178
RULE_Y = 190
FIRST_LINE_Y = 236
LINE_STEP = 34


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def line_svg(line, x, y, level):
    """One preview line. The content is always the known word, so the number is
    whatever stands in front of it: that keeps `ข้อ ๑.` in one piece."""
    indent = len(line) - len(line.lstrip(" "))
    stripped = line.lstrip(" ")
    word = WORDS[level - 1]
    number = stripped[: len(stripped) - len(word) - 1]
    nx = x + indent * CHAR
    cx = nx + len(number) * CHAR
    number_fill = "#f97316" if level == 4 else "#e4e4e7"
    return (
        f'    <text x="{nx:.1f}" y="{y}" fill="{number_fill}">{esc(number)}</text>\n'
        f'    <text x="{cx:.1f}" y="{y}" fill="#71717a">{esc(word)}</text>'
    )


previews = render_all()

parts = [
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
    'role="img" aria-label="The same outline in six number formats">',
    "  <defs>",
    '    <linearGradient id="card" x1="0" y1="0" x2="0.3" y2="1">',
    '      <stop offset="0" stop-color="#1d1d21"/>',
    '      <stop offset="1" stop-color="#141417"/>',
    "    </linearGradient>",
    "  </defs>",
    "",
    f'  <rect x="0" y="0" width="{W}" height="{H}" rx="22" fill="url(#card)"/>',
    f'  <rect x="0" y="0" width="{W}" height="{CARD_TOP}" rx="22" fill="#27272a"/>',
    f'  <rect x="0" y="{CARD_TOP - 24}" width="{W}" height="24" fill="#27272a"/>',
    '  <circle cx="36" cy="30" r="7" fill="#52525b"/>',
    '  <circle cx="60" cy="30" r="7" fill="#52525b"/>',
    '  <circle cx="84" cy="30" r="7" fill="#3f3f46"/>',
    f'  <text x="112" y="37" font-family="{MONO}" font-size="18" fill="#71717a">outline.md</text>',
    "",
    f'  <text x="72" y="118" font-family="{SANS}" font-size="21" fill="#a1a1aa">'
    "The same outline, six number formats. The level reads the indentation, not the number.</text>",
    "",
]

for index, ((label, formats), lines) in enumerate(zip(CARDS, previews)):
    x = COL_X[index % len(COL_X)]
    y0 = (index // len(COL_X)) * ROW_STEP
    parts.append('  <g font-family="%s">' % MONO)
    parts.append(f'    <text x="{x}" y="{LABEL_Y + y0}" font-size="16" fill="#f97316">{esc(label)}</text>')
    parts.append(
        f'    <rect x="{x}" y="{RULE_Y + y0}" width="52" height="3" rx="1.5" fill="#f97316" opacity="0.45"/>'
    )
    for step, line in enumerate(lines, start=1):
        parts.append(line_svg(line, x, FIRST_LINE_Y + y0 + (step - 1) * LINE_STEP, step).rstrip("\n"))
    parts.append("  </g>")
    parts.append("")

parts += [
    f'  <text x="72" y="{H - 38}" font-family="{SANS}" font-size="18" fill="#52525b">'
    "Every format is set per level in Settings, and previewed as you type.</text>",
    "</svg>",
    "",
]

out = pathlib.Path("assets/example.svg")
out.write_text("\n".join(parts), encoding="utf-8", newline="\n")
print("wrote", out, out.stat().st_size, "bytes")
for (label, _), lines in zip(CARDS, previews):
    print("  " + label)
    for line in lines:
        print("     |" + line + "|")
