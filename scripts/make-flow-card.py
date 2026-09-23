"""Generate assets/flow.svg — the before/after flow card for the README.

Three columns, one story: text pasted from Word with foreign markers, the same
text in the note with multilevel numbers, and the clean text output. Same
visual conventions as scripts/make-example-card.py. Run from the repository
root:

    python scripts/make-flow-card.py
"""

import pathlib

# Consolas advances 0.55em per character; every line is monospace.
FONT = 17
CHAR = FONT * 0.55
MONO = "Consolas, 'Noto Sans Mono', 'Leelawadee UI', Tahoma, ui-monospace, monospace"
SANS = "'Segoe UI', 'Leelawadee UI', ui-sans-serif, -apple-system, Roboto, Helvetica, Arial, sans-serif"

ORANGE = "#f97316"
NUMBER_FILL = "#e4e4e7"
WORD_FILL = "#71717a"
CLEAN_FILL = "#a1a1aa"

W, H = 1200, 420
CARD_TOP = 60
COL_X = [72, 452, 832]
LABEL_Y = 178
RULE_Y = 190
FIRST_LINE_Y = 236
LINE_STEP = 34
SPACES_PER_LEVEL = 2  # one indent step, as in the note

# (label, word fill, rows) with each row (level, marker, word, marker fill).
# \u25e6 is the white bullet (◦) and \u2022 the bullet (•) Word hands over.
COLUMNS = [
    (
        "Pasted from Word",
        WORD_FILL,
        [
            (1, "", "Introduction", None),
            (2, "\u25e6", "Scope", ORANGE),
            (3, "\u25e6", "Detail", ORANGE),
            (4, "\u2022", "First point", ORANGE),
        ],
    ),
    (
        "In your note",
        WORD_FILL,
        [
            (1, "1.", "Introduction", NUMBER_FILL),
            (2, "1.1.", "Scope", NUMBER_FILL),
            (3, "1.1.1.", "Detail", NUMBER_FILL),
            (4, "1)", "First point", ORANGE),
        ],
    ),
    (
        "Out as clean text",
        CLEAN_FILL,
        [
            (1, "", "Introduction", None),
            (2, "", "Scope", None),
            (3, "", "Detail", None),
            (4, "", "First point", None),
        ],
    ),
]


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def line_svg(row, x, y, word_fill):
    """One preview line: indent, then the marker (if any) and the word."""
    level, marker, word, marker_fill = row
    nx = x + (level - 1) * SPACES_PER_LEVEL * CHAR
    out = []
    if marker:
        out.append(f'    <text x="{nx:.1f}" y="{y}" fill="{marker_fill}">{esc(marker)}</text>')
        cx = nx + (len(marker) + 1) * CHAR
    else:
        cx = nx
    out.append(f'    <text x="{cx:.1f}" y="{y}" fill="{word_fill}">{esc(word)}</text>')
    return "\n".join(out)


def line_chars(row):
    level, marker, word, _ = row
    return (level - 1) * SPACES_PER_LEVEL + len(marker) + (1 if marker else 0) + len(word)


def arrow_svg(ax, ay):
    """A simple orange arrow, shaft plus head."""
    return (
        '  <g stroke="#f97316" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none">\n'
        f'    <path d="M {ax - 16:.1f} {ay:.1f} H {ax + 12:.1f}"/>\n'
        f'    <path d="M {ax + 2:.1f} {ay - 9:.1f} L {ax + 13:.1f} {ay:.1f} L {ax + 2:.1f} {ay + 9:.1f}"/>\n'
        "  </g>"
    )


parts = [
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
    'role="img" aria-label="The same text, three states: pasted from Word, in the note, out as clean text">',
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
    f'  <text x="112" y="37" font-family="{MONO}" font-size="18" fill="#71717a">flow.md</text>',
    "",
    f'  <text x="72" y="118" font-family="{SANS}" font-size="21" fill="#a1a1aa">'
    "The same text, three states. This is what the plugin is for.</text>",
    "",
]

for x, (label, word_fill, rows) in zip(COL_X, COLUMNS):
    parts.append(f'  <g font-family="{MONO}">')
    parts.append(f'    <text x="{x}" y="{LABEL_Y}" font-size="16" fill="{ORANGE}">{esc(label)}</text>')
    parts.append(
        f'    <rect x="{x}" y="{RULE_Y}" width="52" height="3" rx="1.5" fill="{ORANGE}" opacity="0.45"/>'
    )
    for step, row in enumerate(rows):
        parts.append(line_svg(row, x, FIRST_LINE_Y + step * LINE_STEP, word_fill))
    parts.append("  </g>")
    parts.append("")

# Arrows sit in the whitespace between the columns, centered on the text block.
last_y = FIRST_LINE_Y + (len(COLUMNS[0][2]) - 1) * LINE_STEP
arrow_y = (FIRST_LINE_Y + last_y) / 2 - 5.5
for i in range(len(COL_X) - 1):
    end = COL_X[i] + max(line_chars(row) for row in COLUMNS[i][2]) * CHAR
    ax = (end + COL_X[i + 1]) / 2
    parts.append(arrow_svg(ax, arrow_y))
    parts.append("")

parts += [
    "</svg>",
    "",
]

out = pathlib.Path("assets/flow.svg")
out.write_text("\n".join(parts), encoding="utf-8", newline="\n")
print("wrote", out, out.stat().st_size, "bytes", f"{W}x{H}")
for label, _, rows in COLUMNS:
    print("  " + label)
    for level, marker, word, _ in rows:
        print("     |" + " " * ((level - 1) * SPACES_PER_LEVEL) + (marker + " " if marker else "") + word + "|")
