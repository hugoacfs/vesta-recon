#!/usr/bin/env node
// vesta recon: how well does the typed agent route the voice QA phrases to the
// right map tool? Sends each phrase from scripts/qa-voice-routing.mjs to
// /api/vesta/agent as a one-message conversation and checks the tools of the
// first answer (nothing is executed). Usage, inside the running container:
//   node scripts/vesta-routing-eval.mjs [--url http://127.0.0.1:8096] [--only N]
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const base = flag('--url', 'http://127.0.0.1:8096');
const only = Number(flag('--only', '0')) || Infinity;

// The phrase table is a literal in the QA script; read it without running that script.
const source = readFileSync(
  new URL('./qa-voice-routing.mjs', import.meta.url),
  'utf8',
);
const start = source.indexOf('const PHRASES = [');
const end = source.indexOf('\n];', start);
if (start < 0 || end < 0) throw new Error('PHRASES table not found');
const PHRASES = new Function(
  `return ${source.slice(start + 'const PHRASES = '.length, end + 2)}`,
)();

function matches(expect, names) {
  if (typeof expect === 'string') return names.includes(expect);
  if (Array.isArray(expect))
    return expect.every((name) => names.includes(name));
  if (expect?.oneOf) return expect.oneOf.some((name) => names.includes(name));
  return false;
}

const rows = [];
for (const item of PHRASES.slice(0, only)) {
  const t0 = performance.now();
  let names = [];
  let text = '';
  let error = '';
  try {
    const response = await fetch(`${base}/api/vesta/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: item.phrase }],
      }),
    });
    const data = await response.json();
    if (!response.ok) error = `HTTP ${response.status}`;
    names = (data.message?.tool_calls || []).map((call) => call.function.name);
    text = data.message?.content || '';
  } catch (e) {
    error = e.message;
  }
  const ms = Math.round(performance.now() - t0);
  const ok =
    !error &&
    (item.expectNone ? names.length === 0 : matches(item.expect, names));
  rows.push({
    ok,
    ms,
    phrase: item.phrase,
    expect: item.expectNone ? '(no tool)' : item.expect,
    names,
    text,
    error,
  });
  console.log(
    `${ok ? 'PASS' : 'FAIL'} ${String(ms).padStart(6)} ms  ${item.phrase}` +
      (ok
        ? ''
        : `  -> ${names.join(', ') || text.slice(0, 60) || error} (expected ${JSON.stringify(item.expectNone ? 'no tool' : item.expect)})`),
  );
}
const passed = rows.filter((row) => row.ok).length;
const times = rows.map((row) => row.ms).sort((a, b) => a - b);
console.log(
  `\n${passed}/${rows.length} routed as expected; median ${times[Math.floor(times.length / 2)]} ms, first ${rows[0]?.ms} ms, slowest ${times.at(-1)} ms`,
);
