import assert from 'node:assert/strict';
import test from 'node:test';
import { mountVestaBrand } from './brand.js';

function element(className = '') {
  const el = {
    className,
    children: [],
    textContent: '',
    querySelector: (selector) =>
      el.children.find((child) => `.${child.className}` === selector) ?? null,
    insertBefore(child, before) {
      const at = before ? el.children.indexOf(before) : -1;
      if (at < 0) el.children.push(child);
      else el.children.splice(at, 0, child);
    },
  };
  return el;
}

function page() {
  const caret = element('vesta-caret');
  const title = element('vesta-wordmark');
  title.children.push(element('vesta-wordmark-sub'), caret);
  const loader = element('vesta-wordmark');
  const home = { href: '/' };
  return {
    title: 'vesta recon',
    documentElement: { dataset: {} },
    marks: [title, loader],
    home,
    createElement: () => element(),
    querySelectorAll(selector) {
      if (selector === 'a.vesta-home') return [home];
      if (selector === '.vesta-wordmark') return this.marks;
      return [];
    },
  };
}

const at = { protocol: 'https:', hostname: 'vesta.example' };

test('the home link goes to the same host without the port', () => {
  const doc = page();
  assert.equal(
    mountVestaBrand({ documentRef: doc, locationRef: at }),
    'https://vesta.example/',
  );
  assert.equal(doc.home.href, 'https://vesta.example/');
  assert.equal(doc.title, 'vesta recon');
  assert.equal(
    doc.marks[0].children.some((c) => c.className === 'vesta-env'),
    false,
  );
});

test('a named instance says so in the tab and beside each wordmark, before the caret', () => {
  const doc = page();
  mountVestaBrand({ documentRef: doc, locationRef: at, env: ' staging ' });
  assert.equal(doc.title, 'vesta recon · staging');
  assert.equal(doc.documentElement.dataset.vestaEnv, 'staging');
  const [title, loader] = doc.marks;
  assert.deepEqual(
    title.children.map((c) => c.className),
    ['vesta-wordmark-sub', 'vesta-env', 'vesta-caret'],
  );
  assert.equal(title.children[1].textContent, 'staging');
  assert.equal(loader.children[0].className, 'vesta-env');
  mountVestaBrand({ documentRef: doc, locationRef: at, env: 'staging' });
  assert.equal(
    title.children.filter((c) => c.className === 'vesta-env').length,
    1,
  );
});
