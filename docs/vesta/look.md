# Look: the Vesta look and the name

vesta recon wears the look of the rest of vesta (the home page, the harness, vesta-voice, Home
Assistant's Vesta theme): the Vesta ground `#07080c`, ember accents (`#ffc46b`, `#ff7847`), warm white
text, glass surfaces, Space Grotesk for display, Inter and JetBrains Mono for the rest, and the hearth.

## The name

| Where | What |
|---|---|
| Title bar (`src/ui/templates/scene-chrome.html`) | the hearth, then the wordmark "vesta recon" (Space Grotesk, the Vesta gradient white → amber → orange, a blinking caret); under it "‹ vesta" (back to the home page) and "based on God's Eye View by Bilawal Sidhu" (to the upstream repository) |
| Loading screen (`hud-loading.html`) | the hearth and the wordmark |
| Tab | "vesta recon", the hearth as favicon (`index.html`), theme colour `#07080c` |
| The dock's voice control | "vesta" where upstream says "AI AGENT" (`src/voice/control.js`) |
| First-run dialog | its tip names the microphone and Vesta (`welcome.html`) |
| vesta's home page | the card **Vesta Recon** among the agents: home-page titles are Title Case (Hugo, 2026-10-01); the wordmark in the app keeps the lowercase brand style |

`src/vesta/brand.js` points the "‹ vesta" link at the same host without the globe's port. An
instance with a name (`VITE_VESTA_ENV`, `staging` on the staging instance; production sets none)
shows it as a small ember pill, in capitals, between the wordmark and the caret, on the title bar and
the loading screen, and after the title in the tab ("vesta recon · staging"). On a phone
upstream's layout shows only the logo, so the hearth stands alone there. The hearth is
`public/vesta/hearth.svg`, the emblem of the vesta home page.

## The palette: a build step, not edits

Upstream writes its colours as literals across about twenty stylesheets (the accent cyan alone more than
a hundred times). Editing them would collide with every upstream change, so the fork recolours them as
the page is built:

- `postcss.config.js` (Vite reads it for every stylesheet) runs `build/vesta-palette.mjs`;
- for each colour literal in `src/ui/styles/` whose hue is cyan, teal or blue (not the cyber skin's
  file, not the fork's own files), the plugin writes a variable named after the colour, with the
  colour itself as the fallback:
  `rgba(0, 212, 255, 0.15)` → `rgba(var(--vr-0-212-255, 0, 212, 255), 0.15)`;
- it appends one rule, `:root:not([data-ui-theme='cyber']) { --vr-0-212-255: 255, 196, 107; … }`, with
  the Vesta value of every such colour.

So the Vesta look holds everywhere except under upstream's cyber skin (its own theme, picked in the app),
where the variables are unset and every colour falls back to upstream's. Whites, blacks, greys and the
colours that carry meaning (greens, reds, ambers: feed states, alerts, aircraft categories) are left as
written. 609 literals, 148 distinct colours, were rewritten on 2026-10-01; new upstream literals are
picked up by themselves.

**How a Vesta value is chosen** (`vestaShade`): a table of hand-set values for the most used colours
(`VESTA_OVERRIDES`: the accent cyan → `#ffc46b`, the HUD's teal → a warmer amber, the deep navy →
`#07080c`…); for the rest, deep colours become the Vesta ground at their own lightness, near-whites lose
their cyan cast, and the others turn ember (hue 33°) with their lightness lifted a little, since an
orange looks darker than a cyan of the same lightness.

**To tune**: change `VESTA_OVERRIDES` or `vestaShade` in `build/vesta-palette.mjs`, rebuild, and look
(screenshots below). `src/tooling/vestaPalette.test.mjs` covers the family test, the shades, the
rewriting and the cyber exclusion.

## Tokens and styles

`src/ui/styles/vesta-theme.css` (imported in `style.css` before upstream's `cyber.css`, which a test
keeps last) sets upstream's own tokens for the Vesta look (`--bg-dark`, `--glass-bg`, `--glass-border`,
`--glass-border-hover`, `--text-*`, `--menu-bg`; `--accent` follows from the palette step), defines
`--vesta-ember-1`, `--vesta-ember-2`, `--vesta-grad` and `--font-display`, and styles the hearth, the
wordmark, the caret, the subtitle and its links, the loading screen and the text selection.

## Colours set from JavaScript

- **The HUD** (`src/hud.js`): each visual style sets `--hud-color`, `--hud-glow`, `--hud-border` on the
  HUD; the default style's values are `rgba(var(--vr-0-255-255, 0, 255, 255), …)`, so the palette step
  recolours them and the cyber skin keeps cyan (`postcss.config.js` lists `(0, 255, 255)` as an extra
  colour for this).
- **Labels and cards on the globe** (`src/overlays/worldOverlayTokens.js`, `WORLD_OVERLAY_STYLE` and the
  CCTV thumbnail style): drawn on a canvas, which cannot read CSS variables, so the Vesta values are
  written there (card ground, warm borders, ember selection and leaders). Upstream's test pinning the
  CCTV leader colour (`worldOverlayDraw.test.mjs`) follows the new value; the card's alpha stays 0.82,
  which another test ties to the ambient plates. The per-style data colours (civil and military
  aircraft, ships, vehicles) are unchanged.

## Fonts

All self-hosted, so the page asks Google Fonts for nothing:

| File (`public/vesta/fonts/`) | Size |
|---|---|
| `inter-latin.woff2`, `inter-latin-ext.woff2` | 48 KB, 85 KB |
| `jetbrains-mono-latin.woff2`, `jetbrains-mono-latin-ext.woff2` | 40 KB, 15 KB |
| `space-grotesk-latin.woff2`, `space-grotesk-latin-ext.woff2` | 22 KB, 19 KB |
| `material-symbols-outlined.woff2` | 331 KB |

The text faces are variable fonts (one file per subset carries every weight); the icon font is the whole
Material Symbols Outlined set at the axes the app uses, so no glyph can be missing when upstream adds an
icon. `src/ui/styles/vesta-fonts.css` declares them (and the icon class Google's stylesheet used to
supply). `scripts/vesta-fonts.py` fetches them again and rewrites that file, if upstream ever changes
its fonts. Licences: `public/vesta/fonts/LICENSES.txt` (SIL OFL 1.1; Apache 2.0 for the icons).
Upstream's icon list stays in an `index.html` comment because `src/materialSymbolsSubset.test.mjs` reads
it.

## Screenshots

Every change to the look is checked by eye, at desktop and phone width, in a real browser:

```bash
node scripts/vesta-shoot.mjs after            # after-desktop.png and after-phone.png in the current folder
LOADING=1200 node scripts/vesta-shoot.mjs l   # also the loading screen
OPEN_PANELS=data-panel node scripts/vesta-shoot.mjs p
```

It drives headless Chrome with software WebGL, so it works when no window is on screen; see
[operations.md](operations.md) for where it finds Chrome and puppeteer.

## Known

- On a phone, upstream's bottom HUD readouts overlap each other.
- The typed box can sit close under the CONTEXT panel on short phone screens.
