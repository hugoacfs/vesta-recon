#!/usr/bin/env python3
"""vesta recon: fetch the self-hosted fonts once (Inter, JetBrains Mono, Space Grotesk as variable fonts,
latin and latin-ext; Material Symbols Outlined whole, at the axes the app uses) into public/vesta/fonts,
and write src/ui/styles/vesta-fonts.css for them. Re-run after an upstream change of the fonts."""

import re
import sys
import urllib.request
from pathlib import Path

APP = Path(sys.argv[1] if len(sys.argv) > 1 else "/srv/ai/compose/gods-eye-view/app")
OUT = APP / "public" / "vesta" / "fonts"
CSS = APP / "src" / "ui" / "styles" / "vesta-fonts.css"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
TEXT = "https://fonts.googleapis.com/css2?family=Inter:wght@300..700&family=JetBrains+Mono:wght@300..700&family=Space+Grotesk:wght@400..700&display=swap"
ICONS = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20,400,0,0"


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def faces(css: str):
    """(subset, family, weight, unicode-range, url) for each @font-face block."""
    for subset, body in re.findall(r"/\*\s*([\w-]+)\s*\*/\s*@font-face\s*\{(.*?)\}", css, re.S):
        family = re.search(r"font-family:\s*'([^']+)'", body).group(1)
        weight = re.search(r"font-weight:\s*([\d ]+);", body).group(1).strip()
        urange = re.search(r"unicode-range:\s*([^;]+);", body)
        url = re.search(r"url\((https://[^)]+\.woff2)\)", body).group(1)
        yield subset, family, weight, urange.group(1).strip() if urange else None, url


OUT.mkdir(parents=True, exist_ok=True)
blocks = [
    "/* vesta recon: self-hosted fonts (no Google Fonts CDN), written by scripts/vesta-fonts.py.",
    "   Inter, JetBrains Mono and Space Grotesk: SIL Open Font License 1.1; Material Symbols: Apache 2.0",
    "   (public/vesta/fonts/LICENSES.txt). */",
]
for subset, family, weight, urange, url in faces(get(TEXT).decode()):
    if subset not in ("latin", "latin-ext"):
        continue
    name = f"{family.lower().replace(' ', '-')}-{subset}.woff2"
    (OUT / name).write_bytes(get(url))
    blocks.append(
        "@font-face {\n"
        f"  font-family: '{family}';\n  font-style: normal;\n  font-weight: {weight};\n  font-display: swap;\n"
        f"  src: url('/vesta/fonts/{name}') format('woff2');\n"
        + (f"  unicode-range: {urange};\n" if urange else "")
        + "}"
    )
    print(f"{name}: {(OUT / name).stat().st_size} bytes ({family} {weight}, {subset})")

icons = get(ICONS).decode()
url = re.search(r"url\((https://[^)]+)\)", icons).group(1)
(OUT / "material-symbols-outlined.woff2").write_bytes(get(url))
print(f"material-symbols-outlined.woff2: {(OUT / 'material-symbols-outlined.woff2').stat().st_size} bytes")
blocks.append(
    "@font-face {\n  font-family: 'Material Symbols Outlined';\n  font-style: normal;\n  font-weight: 400;\n"
    "  font-display: block;\n  src: url('/vesta/fonts/material-symbols-outlined.woff2') format('woff2');\n}"
)
# The class Google's stylesheet defined with the font.
rule = re.search(r"\.material-symbols-outlined\s*\{.*?\}", icons, re.S)
if rule:
    blocks.append(rule.group(0))
CSS.write_text("\n\n".join(blocks) + "\n")
print(f"wrote {CSS}")
