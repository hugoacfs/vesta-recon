import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadChichesterSourcesFromCatalog } from '../../server/providers/cctv/sources.js';

test('Chichester catalog registers the harbour webcam and the NH M27 mirror camera', (t) => {
  t.mock.method(console, 'log', () => {});
  const cameras = loadChichesterSourcesFromCatalog();
  assert.deepEqual(
    cameras.map((camera) => camera.id),
    ['chichester-harbour-webcam', 'nh-m27-19457-j12'],
  );
  for (const camera of cameras) {
    assert.ok(
      /^https:\/\/(www\.vision-environnement\.com\/live\/image\/webcam\/|trafficcameras\.uk\/storage\/cameras\/)/.test(
        camera.url,
      ),
      camera.url,
    );
    assert.equal(camera.snapshotUrl, camera.url);
    assert.equal(camera.cityId, 'chichester');
    assert.equal(camera.feedType, 'image');
    assert.equal(camera.poseSource, 'curated');
  }
  const nh = cameras.find((camera) => camera.id === 'nh-m27-19457-j12');
  assert.match(nh.license, /unofficial mirror/i);
  assert.match(nh.license, /National Highways/i);
  assert.equal(nh.headingConfidence, 'low');
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
        url: 'https://trafficcameras.uk/storage/cameras/1.jpg',
        lat: 50.85,
        lon: -0.93,
      },
      {
        id: 'ok',
        url: 'https://trafficcameras.uk/storage/cameras/1.jpg',
        lat: 50.85,
        lon: -0.93,
      },
      {
        id: 'text-coords',
        url: 'https://trafficcameras.uk/storage/cameras/2.jpg',
        lat: '50.85',
        lon: '-0.93',
      },
      {
        id: 'null-island',
        url: 'https://trafficcameras.uk/storage/cameras/3.jpg',
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
