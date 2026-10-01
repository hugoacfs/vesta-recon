// vesta recon: the Vesta palette over upstream's stylesheets, at build time.
//
// Upstream writes its cyans, teals and blues as literals across many style
// files. Rather than edit those files (and fight every upstream merge), this
// PostCSS plugin rewrites each such literal into a variable named after it,
// with the literal itself as the fallback:
//   rgba(0, 212, 255, 0.15)  ->  rgba(var(--vr-0-212-255, 0, 212, 255), 0.15)
// and appends the Vesta value of every variable, set everywhere except under
// upstream's cyber skin (which therefore keeps its own look). Only colours
// whose hue lies in the cyan-blue range are touched; whites, blacks, greys and
// the colours that carry meaning (greens, reds, ambers) stay as written.

const COLOR =
  /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+%?)\s*)?\)|#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

/** Vesta values for upstream's most used literals; the rest follow vestaShade(). */
export const VESTA_OVERRIDES = new Map([
  ['0,212,255', [255, 196, 107]], // the accent -> ember amber (#ffc46b)
  ['0,220,255', [255, 196, 107]],
  ['0,255,255', [255, 196, 107]],
  ['34,230,230', [255, 186, 102]], // the HUD's teal -> a warmer amber
  ['54,220,255', [255, 206, 133]],
  ['65,220,231', [255, 196, 120]],
  ['107,232,255', [255, 208, 140]],
  ['0,7,12', [7, 8, 12]], // deep backgrounds -> the Vesta ground (#07080c)
]);

function hsl(r, g, b) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function rgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [r, g, b].map((v) => Math.round((v + m) * 255));
}

/** Whether a colour is one of upstream's cyans, teals or blues. */
export function isCoolAccent(r, g, b) {
  const [h] = hsl(r, g, b);
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  return chroma >= 8 && h >= 165 && h <= 230;
}

/**
 * The Vesta counterpart of a cool colour: deep ones become the Vesta ground,
 * near-whites lose their cyan cast, the rest turn ember with their lightness
 * lifted a little (an orange looks darker than a cyan of the same lightness).
 */
export function vestaShade(r, g, b) {
  const key = `${r},${g},${b}`;
  if (VESTA_OVERRIDES.has(key)) return VESTA_OVERRIDES.get(key);
  const [, s, l] = hsl(r, g, b);
  if (l < 0.18) return rgb(228, Math.min(s, 0.26), l);
  if (l > 0.86) return rgb(220, Math.min(s, 0.25), l);
  return rgb(33, Math.min(1, s), Math.min(0.9, l + (l < 0.6 ? 0.12 : 0.06)));
}

function parse(match) {
  const [, r, g, b, alpha, hex] = match;
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
    return {
      rgb: [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)),
      alpha: null,
    };
  }
  return { rgb: [r, g, b].map(Number), alpha: alpha ?? null };
}

/**
 * Rewrite the cool literals of one declaration value.
 * @param {string} value
 * @param {Map<string, number[]>} used variable name -> its Vesta value
 */
export function rewriteValue(value, used) {
  const inUrl = /url\(/i.test(value);
  return value.replace(COLOR, (...match) => {
    if (inUrl && match[5]) return match[0];
    const { rgb: color, alpha } = parse(match);
    if (color.some((v) => v > 255) || !isCoolAccent(...color)) return match[0];
    const name = `--vr-${color.join('-')}`;
    used.set(name, vestaShade(...color));
    const channels = `var(${name}, ${color.join(', ')})`;
    return alpha === null ? `rgb(${channels})` : `rgba(${channels}, ${alpha})`;
  });
}

/**
 * @param {object} [options]
 * @param {(file: string) => boolean} [options.include] which source files to rewrite
 * @param {number[][]} [options.extra] literals used from JavaScript (as var() fallbacks) that need a Vesta value too
 */
export default function vestaPalette({
  include = (file) =>
    /src[\\/]ui[\\/]styles[\\/]/.test(file) &&
    !/cyber\.css$|vesta-[^\\/]*\.css$/.test(file),
  extra = [],
} = {}) {
  return {
    postcssPlugin: 'vesta-palette',
    prepare() {
      const used = new Map();
      for (const color of extra)
        used.set(`--vr-${color.join('-')}`, vestaShade(...color));
      return {
        Declaration(decl) {
          const file = decl.source?.input?.file || '';
          if (!include(file)) return;
          const next = rewriteValue(decl.value, used);
          if (next !== decl.value) decl.value = next;
        },
        OnceExit(root, { postcss }) {
          if (!used.size) return;
          const rule = postcss.rule({
            selector: ":root:not([data-ui-theme='cyber'])",
          });
          for (const [name, value] of [...used].sort())
            rule.append(postcss.decl({ prop: name, value: value.join(', ') }));
          root.append(rule);
        },
      };
    },
  };
}
vestaPalette.postcss = true;
