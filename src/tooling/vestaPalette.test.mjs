import assert from 'node:assert/strict';
import test from 'node:test';
import postcss from 'postcss';
import vestaPalette, {
  isCoolAccent,
  rewriteValue,
  vestaShade,
} from '../../build/vesta-palette.mjs';

test('only upstream’s cyans, teals and blues count as its accent family', () => {
  assert.equal(isCoolAccent(0, 212, 255), true);
  assert.equal(isCoolAccent(34, 230, 230), true);
  assert.equal(isCoolAccent(42, 113, 171), true);
  assert.equal(isCoolAccent(255, 255, 255), false); // white
  assert.equal(isCoolAccent(10, 10, 15), false); // a near-black grey
  assert.equal(isCoolAccent(0, 255, 80), false); // the nominal green
  assert.equal(isCoolAccent(255, 92, 110), false); // an alert red
  assert.equal(isCoolAccent(231, 194, 72), false); // an amber
});

test('the accent becomes Vesta’s ember, the deep navy its ground, tinted whites lose the cyan', () => {
  assert.deepEqual(vestaShade(0, 212, 255), [255, 196, 107]);
  assert.deepEqual(vestaShade(0, 7, 12), [7, 8, 12]);
  const [r, g, b] = vestaShade(244, 251, 255);
  assert.ok(
    r >= 240 && Math.abs(r - b) <= 6,
    `a neutral white, got ${[r, g, b]}`,
  );
  const [er, , eb] = vestaShade(42, 113, 171);
  assert.ok(er > eb, 'a mid blue turns warm');
});

test('a literal becomes a variable named after it, with itself as the fallback', () => {
  const used = new Map();
  assert.equal(
    rewriteValue(
      '0 0 12px rgba(0, 212, 255, 0.4), inset 0 0 0 1px #00d4ff',
      used,
    ),
    '0 0 12px rgba(var(--vr-0-212-255, 0, 212, 255), 0.4), inset 0 0 0 1px rgb(var(--vr-0-212-255, 0, 212, 255))',
  );
  assert.deepEqual([...used], [['--vr-0-212-255', [255, 196, 107]]]);
  assert.equal(
    rewriteValue('rgba(255, 255, 255, 0.08)', used),
    'rgba(255, 255, 255, 0.08)',
  );
  assert.equal(
    rewriteValue('url(#a0d4ff) no-repeat', used),
    'url(#a0d4ff) no-repeat',
  );
});

test('the plugin leaves the cyber skin and our own files alone and appends the Vesta values', async () => {
  const css = [
    '.a { color: #00d4ff; }',
    '.b { border-color: rgba(34, 230, 230, 0.5); }',
  ].join('\n');
  const theirs = postcss.parse(css, { from: '/app/src/ui/styles/layers.css' });
  const cyber = postcss.parse('.c { color: #00d4ff; }', {
    from: '/app/src/ui/styles/cyber.css',
  });
  const root = postcss.root();
  root.append(theirs.nodes);
  root.append(cyber.nodes);
  const out = (
    await postcss([vestaPalette()]).process(root, { from: undefined })
  ).css;
  assert.match(
    out,
    /\.a \{ color: rgb\(var\(--vr-0-212-255, 0, 212, 255\)\); \}/,
  );
  assert.match(out, /\.c \{ color: #00d4ff; \}/);
  assert.match(
    out,
    /:root:not\(\[data-ui-theme='cyber'\]\) \{[\s\S]*--vr-0-212-255: 255, 196, 107;[\s\S]*--vr-34-230-230: 255, 186, 102/,
  );
});
