import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadChichesterSourcesFromCatalog } from '../../server/providers/cctv/sources.js';

test('Chichester catalog registers the harbour webcam', (t) => {
  t.mock.method(console, 'log', () => {});
  const cameras = loadChichesterSourcesFromCatalog();
  assert.deepEqual(
    cameras.map((camera) => camera.id),
    ['chichester-harbour-webcam'],
  );
  for (const camera of cameras) {
    assert.ok(
      /^https:\/\/www\.vision-environnement\.com\/live\/image\/webcam\//.test(
        camera.url,
      ),
      camera.url,
    );
    assert.equal(camera.snapshotUrl, camera.url);
    assert.equal(camera.cityId, 'chichester');
    assert.equal(camera.feedType, 'image');
    assert.equal(camera.sourceKind, 'independent-webcam');
    assert.equal(camera.poseSource, 'curated');
  }
  const harbour = cameras[0];
  assert.match(harbour.license, /vision-environnement/i);
  assert.equal(harbour.headingConfidence, 'low');
});

test('Chichester loader tolerates a missing catalog file', (t) => {
  t.mock.method(console, 'warn', () => {});
  assert.deepEqual(
    loadChichesterSourcesFromCatalog({ sourceRoot: '/nonexistent' }),
    [],
  );
});

test('Chichester loader skips malformed rows without throwing', (t) => {
  t.mock.method(console, 'log', () => {});
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gev-chichester-'));
  fs.mkdirSync(path.join(dir, 'config'));
  fs.writeFileSync(
    path.join(dir, 'config', 'cctv_sources.chichester.json'),
    JSON.stringify([
      {
        id: { toString: null },
        url: 'https://www.vision-environnement.com/live/image/webcam/a.jpg',
        lat: 50.85,
        lon: -0.93,
      },
      {
        id: 'ok',
        url: 'https://www.vision-environnement.com/live/image/webcam/a.jpg',
        lat: 50.85,
        lon: -0.93,
      },
      {
        id: 'text-coords',
        url: 'https://www.vision-environnement.com/live/image/webcam/b.jpg',
        lat: '50.85',
        lon: '-0.93',
      },
      {
        id: 'null-island',
        url: 'https://www.vision-environnement.com/live/image/webcam/c.jpg',
        lat: 0,
        lon: 0,
      },
      {
        id: 'off-host',
        url: 'https://evil.example/a.jpg',
        lat: 50.85,
        lon: -0.93,
      },
    ]),
  );
  const cameras = loadChichesterSourcesFromCatalog({ sourceRoot: dir });
  assert.deepEqual(
    cameras.map((camera) => camera.id),
    ['ok'],
  );
});
