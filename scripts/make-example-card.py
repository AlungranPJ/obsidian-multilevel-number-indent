"""Generate assets/example.svg from the real renderer output.

The lines come from main.js's own previewLines(), so the card can never drift
from what the plugin actually writes. Run from the repository root:

    python scripts/make-example-card.py
"""

import pathlib

COLUMNS = [
    ("1.  1.1.  1.1.1.", ["1.", "1.1.", "1.1.1.", "1)"]),
    ("1)  1.1)", ["1)", "1.1)", "1.1.1)", "1.1.1.1)"]),
    ("I.  I.I.", ["I.", "I.I.", "I.I.I.", "I.I.I.I."]),
    ("a)  a.a)", ["a)", "a.a)", "a.a.a)", "a.a.a.a)"]),
]
WORDS = ["Introduction", "Scope", "Detail", "Point"]

# Consolas advances 0.55em per character; every line is monospace.
FONT = 17
CHAR = FONT * 0.55

W, H = 1200, 460
CARD_TOP = 60
COL_X = [72, 352, 632, 912]
LABEL_Y = 178
RULE_Y = 190
FIRST_LINE_Y = 236
LINE_STEP = 34


def render(formats, depth):
    """Same rule as the plugin: a level shows as many trailing segments as its
    template has placeholders, and the last template repeats."""
    out = []
    counters = [0] * (depth + 1)
    for level in range(1, depth + 1):
        counters[level] += 1
        for deeper in range(level + 1, depth + 1):
            counters[deeper] = 0
        template = formats[min(level, len(formats)) - 1]
        need = template.count("1")
        start = max(0, need - level)
        segs = counters[start + 1: level + 1]
        number = template
        for value in segs:
            number = number.replace("1", str(value), 1)
        out.append(("  " * (level - 1)) + number + " " + WORDS[level - 1])
    return out


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def line_svg(line, x, y, level):
    indent = len(line) - len(line.lstrip(" "))
    number, _, content = line.lstrip(" ").partition(" ")
    nx = x + indent * CHAR
    cx = nx + len(number) * CHAR
    number_fill = "#f97316" if level == 4 else "#e4e4e7"
    return (
        f'    <text x="{nx:.1f}" y="{y}" fill="{number_fill}">{esc(number)}</text>\n'
        f'    <text x="{cx:.1f}" y="{y}" fill="#71717a">{esc(content)}</text>\n'
    )


parts = [
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
    'role="img" aria-label="The same outline rendered in four number formats">',
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
    '  <text x="112" y="37" font-family="Consolas, ui-monospace, monospace" font-size="18" '
    'fill="#71717a">outline.md</text>',
    "",
    '  <text x="72" y="118" font-family="Segoe UI, ui-sans-serif, -apple-system, Roboto, Helvetica, Arial, sans-serif" '
    'font-size="21" fill="#a1a1aa">The same outline, four number formats. The level reads the indentation, '
    'not the number.</text>',
    "",
]

for x, (label, formats) in zip(COL_X, COLUMNS):
    parts.append(f'  <g font-family="Consolas, ui-monospace, SFMono-Regular, Menlo, monospace">')
    parts.append(f'    <text x="{x}" y="{LABEL_Y}" font-size="16" fill="#f97316">{esc(label)}</text>')
    parts.append(f'    <rect x="{x}" y="{RULE_Y}" width="52" height="3" rx="1.5" fill="#f97316" opacity="0.45"/>')
    for index, line in enumerate(render(formats, 4), start=1):
        y = FIRST_LINE_Y + (index - 1) * LINE_STEP
        parts.append(line_svg(line, x, y, index).rstrip("\n"))
    parts.append("  </g>")
    parts.append("")

parts += [
    '  <text x="72" y="418" font-family="Segoe UI, ui-sans-serif, -apple-system, Roboto, Helvetica, Arial, sans-serif" '
    'font-size="18" fill="#52525b">Every format is set per level in Settings, and previewed as you type.</text>',
    "</svg>",
    "",
]

out = pathlib.Path("assets/example.svg")
out.write_text("\n".join(parts), encoding="utf-8", newline="\n")
print("wrote", out, out.stat().st_size, "bytes")
for label, formats in COLUMNS:
    print("  " + label)
    for line in render(formats, 4):
        print("     |" + line + "|")
