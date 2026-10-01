#!/usr/bin/env node
// vesta recon: screenshots of the live page at desktop and phone width, in headless Chrome with
// software WebGL, so they work with no window on screen. On the Mac:
//   node scripts/vesta-shoot.mjs <label> [url]
// writes <label>-desktop.png and <label>-phone.png in the current folder. LOADING=<ms> also shoots the
// loading screen that long after the page opens; OPEN_PANELS=data-panel,... opens panels first;
// SETTLE=<ms> waits longer for the tiles (default 14000); ONLY=desktop|phone. Needs Google Chrome
// (CHROME=<path> to use another) and puppeteer-core, from this repository's node_modules or from
// PUPPETEER_FROM=<a package.json beside a node_modules that has puppeteer-core>.
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(process.env.PUPPETEER_FROM || import.meta.url);
const puppeteer = require('puppeteer-core');
const label = process.argv[2] || 'shot';
const url = process.argv[3] || 'https://vesta.tail22b555.ts.net:8600/';
const settle = Number(process.env.SETTLE || 14000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await puppeteer.launch({
  headless: true,
  executablePath:
    process.env.CHROME ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

async function shoot(name, viewport, mobile) {
  const page = await browser.newPage();
  if (mobile)
    await page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    );
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', (error) =>
    errors.push(String(error.message).slice(0, 140)),
  );
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (process.env.LOADING) {
    await sleep(Number(process.env.LOADING));
    await page.screenshot({
      path: path.resolve(`${label}-${name}-loading.png`),
    });
  }
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const ready = await page.evaluate(
      () => typeof window.__gevVoiceCommands?.subscribe === 'function',
    );
    if (ready) break;
  }
  await sleep(1500);
  await page.keyboard.press('Escape'); // the first-run dialog
  await sleep(settle);
  if (process.env.OPEN_PANELS) {
    await page.evaluate((ids) => {
      for (const id of ids.split(','))
        document.querySelector(`[data-collapse-target="${id}"]`)?.click();
    }, process.env.OPEN_PANELS);
    await sleep(2500);
  }
  const file = path.resolve(`${label}-${name}.png`);
  await page.screenshot({ path: file });
  console.log(
    name,
    file,
    errors.length ? `page errors: ${JSON.stringify(errors.slice(0, 3))}` : '',
  );
  await page.close();
}

try {
  if (!process.env.ONLY || process.env.ONLY === 'desktop')
    await shoot(
      'desktop',
      { width: 1440, height: 900, deviceScaleFactor: 1 },
      false,
    );
  if (!process.env.ONLY || process.env.ONLY === 'phone')
    await shoot(
      'phone',
      {
        width: 390,
        height: 844,
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
      true,
    );
} finally {
  await browser.close();
}
