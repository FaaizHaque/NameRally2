import cairosvg, math

# ── Seeded PRNG matching JS implementation ────────────────────────────────
def rng_gen(seed):
    s = seed & 0xFFFFFFFF
    def nxt():
        nonlocal s
        s = ((s * 1664525) + 1013904223) & 0xFFFFFFFF
        return s / 0xFFFFFFFF
    return nxt

W, H = 1024, 1024

GRAIN_COLORS = ['#6B4820','#7A5530','#8A6238','#5A3D18','#9B7045','#4E3210','#B08050','#3E2808']

r1 = rng_gen(0xDEADBEEF)
fibers = []
for _ in range(220):
    x    = r1() * W
    y    = r1() * H
    fw   = 6  + r1() * 38
    fh   = 1  + r1() * 3.5
    col  = GRAIN_COLORS[int(r1() * len(GRAIN_COLORS))]
    op   = 0.04 + r1() * 0.09
    rot  = r1() * 160 - 80
    fibers.append((x, y, fw, fh, col, op, rot))

r2 = rng_gen(0xCAFEBABE)
smudges = []
for _ in range(55):
    x  = r2() * W
    y  = r2() * H
    sw = 20 + r2() * 90
    sh =  3 + r2() * 12
    op = 0.03 + r2() * 0.07
    smudges.append((x, y, sw, sh, op))

# ── Layout ────────────────────────────────────────────────────────────────
TW, TH  = 210, 210   # tile size — bigger for readability
GAP     = 12
LABEL_FONT = 52      # word label font size
LABEL_GAP  = 30      # gap between tile bottom and label baseline

# Vertically centre the whole group
CONTENT_H = TH + LABEL_GAP + LABEL_FONT
TILE_Y  = (1024 - CONTENT_H) // 2 - 20  # slight upward nudge so labels have room
CY      = TILE_Y + TH // 2
LABEL_Y = TILE_Y + TH + LABEL_GAP + LABEL_FONT // 2

TILES = [
    dict(letter='N', bg='#FFD4D4', stroke='#E07070', ink='#882020', word='Name',   rot=-3),
    dict(letter='P', bg='#FEF3A3', stroke='#E8D840', ink='#8B7A10', word='Place',  rot= 2),
    dict(letter='A', bg='#C8F5D0', stroke='#50B870', ink='#2A6640', word='Animal', rot=-2),
    dict(letter='T', bg='#D0EAFF', stroke='#60A8E0', ink='#205880', word='Thing',  rot= 3),
]

total_w = 4 * TW + 3 * GAP
start_x = (W - total_w) // 2
tile_cx = [start_x + i * (TW + GAP) + TW // 2 for i in range(4)]

# ── Build SVG ─────────────────────────────────────────────────────────────
lines = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">']

lines.append('''<defs>
  <filter id="ds0"><feDropShadow dx="0" dy="5" stdDeviation="8"
    flood-color="#3E2000" flood-opacity="0.22"/></filter>
  <filter id="ds1"><feDropShadow dx="0" dy="5" stdDeviation="8"
    flood-color="#5A4000" flood-opacity="0.22"/></filter>
  <filter id="ds2"><feDropShadow dx="0" dy="5" stdDeviation="8"
    flood-color="#1A4020" flood-opacity="0.22"/></filter>
  <filter id="ds3"><feDropShadow dx="0" dy="5" stdDeviation="8"
    flood-color="#102840" flood-opacity="0.22"/></filter>
  <linearGradient id="vTop" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#4A2E0A" stop-opacity="0.22"/>
    <stop offset="1" stop-color="#4A2E0A" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="vBot" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#4A2E0A" stop-opacity="0"/>
    <stop offset="1" stop-color="#4A2E0A" stop-opacity="0.26"/>
  </linearGradient>
  <linearGradient id="vLeft" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#4A2E0A" stop-opacity="0.14"/>
    <stop offset="1" stop-color="#4A2E0A" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="vRight" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#4A2E0A" stop-opacity="0"/>
    <stop offset="1" stop-color="#4A2E0A" stop-opacity="0.14"/>
  </linearGradient>
</defs>''')

# 1. Base paper
lines.append(f'<rect width="{W}" height="{H}" fill="#EEE3BE"/>')

# 2. Grain fibers
for (x, y, fw, fh, col, op, rot) in fibers:
    lines.append(
        f'<rect x="{x:.1f}" y="{y:.1f}" width="{fw:.1f}" height="{fh:.1f}" rx="{fh/2:.1f}" '
        f'fill="{col}" opacity="{op:.3f}" '
        f'transform="rotate({rot:.1f} {x+fw/2:.1f} {y+fh/2:.1f})"/>'
    )

# 3. Smudge blobs
for (x, y, sw, sh, op) in smudges:
    lines.append(
        f'<rect x="{x:.1f}" y="{y:.1f}" width="{sw:.1f}" height="{sh:.1f}" rx="3" '
        f'fill="#6B4820" opacity="{op:.3f}"/>'
    )

# 4. Ruled lines
LINE_SPACING = 36
LINE_START_Y = 40
LINE_COUNT   = 28
r3 = rng_gen(0xF00DCAFE)
for i in range(LINE_COUNT):
    jitter  = (r3() * 2 - 1) if i % 9 == 0 else 0
    opacity = 0.55 if i % 6 == 0 else 0.28
    yy      = LINE_START_Y + i * LINE_SPACING + jitter
    lines.append(f'<line x1="0" y1="{yy:.1f}" x2="{W}" y2="{yy:.1f}" '
                 f'stroke="#7A5A2A" stroke-width="1" opacity="{opacity}"/>')

# 5. Red margin line
lines.append(f'<line x1="72" y1="0" x2="72" y2="{H}" stroke="#C04040" stroke-width="1.5" opacity="0.30"/>')

# 6. Vignette overlays
lines.append(f'<rect width="{W}" height="100" fill="url(#vTop)"/>')
lines.append(f'<rect y="{H-120}" width="{W}" height="120" fill="url(#vBot)"/>')
lines.append(f'<rect width="50" height="{H}" fill="url(#vLeft)"/>')
lines.append(f'<rect x="{W-50}" width="50" height="{H}" fill="url(#vRight)"/>')

# 7. Tiles (with slight rotation for sketchiness)
ds_ids = ['ds0','ds1','ds2','ds3']
for i, t in enumerate(TILES):
    cx = tile_cx[i]
    tx = cx - TW // 2
    ty = TILE_Y
    rot = t['rot']
    lines.append(
        f'<g transform="rotate({rot} {cx} {CY})" filter="url(#{ds_ids[i]})">'
        # tile background
        f'<rect x="{tx}" y="{ty}" width="{TW}" height="{TH}" rx="24" ry="24" '
        f'fill="{t["bg"]}" stroke="{t["stroke"]}" stroke-width="5"/>'
        # white gloss stripe at top
        f'<rect x="{tx+8}" y="{ty+8}" width="{TW-16}" height="64" rx="18" ry="18" '
        f'fill="white" opacity="0.22"/>'
        # letter
        f'<text x="{cx}" y="{CY}" font-family="\'Helvetica Neue\', Arial, sans-serif" '
        f'font-size="138" font-weight="900" fill="{t["ink"]}" '
        f'text-anchor="middle" dominant-baseline="central">{t["letter"]}</text>'
        f'</g>'
    )

# 8. Word labels below each tile
for i, t in enumerate(TILES):
    cx = tile_cx[i]
    lines.append(
        f'<text x="{cx}" y="{LABEL_Y}" '
        f'font-family="\'Helvetica Neue\', Arial, sans-serif" '
        f'font-size="{LABEL_FONT}" font-weight="900" fill="{t["ink"]}" opacity="0.88" '
        f'text-anchor="middle" dominant-baseline="central">{t["word"]}</text>'
    )

lines.append('</svg>')
svg_str = '\n'.join(lines)

with open('/home/user/NameRally2/mobile/src/assets/icon-generate.svg', 'w') as f:
    f.write(svg_str)

cairosvg.svg2png(
    bytestring=svg_str.encode(),
    write_to='/home/user/NameRally2/mobile/src/assets/logo-main.png',
    output_width=1024, output_height=1024
)
print('Done')
