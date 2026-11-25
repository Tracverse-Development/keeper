"""Regenerates Keeper's art from the brand mark (assets/brand/umoja-ark-mark.svg):
the app icon (assets/art/app-icon.svg/.png → src-tauri/icons via `tauri icon`), the gold mark
the window uses (assets/brand/umoja-ark-mark-gold.svg) and the DMG background
(src-tauri/dmg/background.png). Run: python3 scripts/make-art.py"""
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
MARK = (ROOT / "assets/brand/umoja-ark-mark.svg").read_text()
PATH = " ".join(re.findall(r'<path[^>]*?d="([^"]+)"', MARK))
# The mark's viewBox is "117 -309 3165 3165": its centre is (1699.5, 1273.5).
CENTRE = "translate(-1699.5 -1273.5)"
GOLD = '<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0c98a"/><stop offset="0.55" stop-color="#d39744"/><stop offset="1" stop-color="#b57b2c"/></linearGradient>'


def mark(at: str, scale: float) -> str:
    return f'<g transform="translate({at}) scale({scale}) {CENTRE}"><path fill="url(#gold)" fill-rule="evenodd" d="{PATH}"/></g>'


ICON = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>
<radialGradient id="bg" cx="50%" cy="32%" r="78%"><stop offset="0" stop-color="#2a3760"/><stop offset="0.55" stop-color="#151c33"/><stop offset="1" stop-color="#070a16"/></radialGradient>
{GOLD}<radialGradient id="glow" cx="50%" cy="55%" r="45%"><stop offset="0" stop-color="#d39744" stop-opacity="0.35"/><stop offset="1" stop-color="#d39744" stop-opacity="0"/></radialGradient></defs>
<rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bg)"/><rect x="100" y="100" width="824" height="824" rx="185" fill="url(#glow)"/>
<rect x="101.5" y="101.5" width="821" height="821" rx="184" fill="none" stroke="#f0c98a" stroke-opacity="0.28" stroke-width="3"/>
{mark("512 540", 0.2)}</svg>"""

BACKGROUND = f"""<svg xmlns="http://www.w3.org/2000/svg" width="660" height="420" viewBox="0 0 660 420"><defs>
<radialGradient id="bg" cx="50%" cy="20%" r="90%"><stop offset="0" stop-color="#1e2848"/><stop offset="0.6" stop-color="#0b1020"/><stop offset="1" stop-color="#070a16"/></radialGradient>
{GOLD}<linearGradient id="arrow" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b57b2c"/><stop offset="0.5" stop-color="#f0c98a"/><stop offset="1" stop-color="#b57b2c"/></linearGradient></defs>
<rect width="660" height="420" fill="url(#bg)"/>
<g fill="#f4eee2" opacity="0.5"><circle cx="60" cy="40" r="1"/><circle cx="140" cy="90" r="0.8"/><circle cx="250" cy="30" r="1.1"/><circle cx="420" cy="60" r="0.9"/><circle cx="560" cy="35" r="1.2"/><circle cx="610" cy="110" r="0.8"/><circle cx="35" cy="150" r="0.9"/><circle cx="330" cy="120" r="0.7"/></g>
{mark("330 58", 0.022)}
<text x="330" y="118" text-anchor="middle" font-family="Georgia, 'New York', serif" font-size="30" fill="#f4eee2" letter-spacing="1">Keeper</text>
<text x="330" y="142" text-anchor="middle" font-family="-apple-system, Helvetica, sans-serif" font-size="12.5" fill="#9aa3bf" letter-spacing="0.5">Your assistant. Your memory. Your own DKG node.</text>
<path d="M262 230 C 300 214, 360 214, 398 230" fill="none" stroke="url(#arrow)" stroke-width="2.5" stroke-linecap="round"/>
<path d="M388 222 L 400 231 L 387 238" fill="none" stroke="#e3b06a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
<text x="330" y="350" text-anchor="middle" font-family="-apple-system, Helvetica, sans-serif" font-size="12" fill="#d9cfbd">Drag Keeper into Applications</text>
<path d="M0 392 C 110 372, 220 412, 330 392 S 550 372, 660 392 L 660 420 L 0 420 Z" fill="#d39744" opacity="0.10"/>
<path d="M0 402 C 110 386, 220 418, 330 402 S 550 386, 660 402 L 660 420 L 0 420 Z" fill="#d39744" opacity="0.14"/></svg>"""

GOLD_MARK = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="117 -309 3165 3165"><defs>{GOLD}</defs><path fill="url(#gold)" fill-rule="evenodd" d="{PATH}"/></svg>'


def render(svg: pathlib.Path, png: pathlib.Path, w: int, h: int) -> None:
    subprocess.run(["swift", str(ROOT / "scripts/render-svg.swift"), str(svg), str(png), str(w), str(h)], check=True)


art = ROOT / "assets/art"
art.mkdir(parents=True, exist_ok=True)
(art / "app-icon.svg").write_text(ICON)
(art / "dmg-background.svg").write_text(BACKGROUND)
(ROOT / "assets/brand/umoja-ark-mark-gold.svg").write_text(GOLD_MARK)
(ROOT / "src-tauri/dmg").mkdir(parents=True, exist_ok=True)
render(art / "app-icon.svg", art / "app-icon.png", 1024, 1024)
render(art / "dmg-background.svg", ROOT / "src-tauri/dmg/background.png", 660, 420)
subprocess.run(["npx", "tauri", "icon", str(art / "app-icon.png"), "-o", str(ROOT / "src-tauri/icons")], check=True, cwd=ROOT)
for mobile in ("android", "ios"):
    subprocess.run(["rm", "-rf", str(ROOT / "src-tauri/icons" / mobile)], check=True)
print("art regenerated")
