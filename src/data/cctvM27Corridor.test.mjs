import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadM27CorridorSourcesFromCatalog } from '../../server/providers/cctv/sources.js';

test('M27 corridor catalog loads the 76 NH cameras in corridor order', (t) => {
  t.mock.method(console, 'log', () => {});
  // File order is west (Ringwood end) to east (Portsmouth end), then the M3
  // stub; the loader re-sorts by distance from the corridor center, so the
  // order is checked against the catalog file, not the loader output.
  const file = JSON.parse(
    fs.readFileSync(
      new URL('../../config/cctv_sources.m27corridor.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(file.length, 76);
  assert.equal(file[0].id, 'nh-m27-19111'); // M27 J3 (westernmost mirrored camera)
  assert.equal(file.at(-1).id, 'nh-m3-12126'); // M3 J12 (western end of the M3)
  const cameras = loadM27CorridorSourcesFromCatalog();
  assert.equal(cameras.length, 76);
  const ids = cameras.map((camera) => camera.id);
  assert.equal(new Set(ids).size, ids.length, 'camera ids must be unique');
  assert.ok(ids.includes('nh-m27-19111'));
  assert.ok(ids.includes('nh-m3-12126'));
  for (const camera of cameras) {
    assert.match(
      camera.url,
      /^https:\/\/trafficcameras\.uk\/storage\/cameras\/\d+\.jpg$/,
      camera.id,
    );
    assert.equal(camera.snapshotUrl, camera.url);
    assert.equal(camera.cityId, 'm27-corridor');
    assert.equal(camera.feedType, 'image');
    assert.equal(camera.sourceKind, 'motorway-cctv');
    assert.equal(camera.poseSource, 'curated');
    assert.equal(camera.headingConfidence, 'low');
    assert.match(camera.license, /National Highways/);
    assert.match(camera.license, /unofficial mirror/i);
  }
  // 19457 moved here from the Chichester pack: corrected position and name,
  // but the deployed id is kept for continuity.
  const j12 = cameras.find((camera) => camera.id === 'nh-m27-19457-j12');
  assert.ok(j12, 'nh-m27-19457-j12 must be in the corridor pack');
  assert.equal(j12.lat, 50.83988);
  assert.equal(j12.lon, -1.07982);
  assert.equal(j12.headingDeg, 112);
  assert.match(j12.name, /M27 J12/);
  assert.match(j12.name, /Portsmouth/);
  assert.doesNotMatch(j12.name, /Emsworth/);
  // The two M275 cameras at the Portsmouth-end interchange face due north
  // (heading derived from the OSM M275 mainline, which leaves the complex
  // running north before bending east).
  const m275 = cameras.filter((camera) => camera.id.startsWith('nh-m275-'));
  assert.equal(m275.length, 2);
  for (const camera of m275) {
    assert.equal(camera.lat, 50.83988);
    assert.equal(camera.lon, -1.07982);
    assert.equal(camera.headingDeg, 0);
    assert.match(camera.name, /M275 J1 \(Portsmouth end\)/);
  }
  // The M3 western stub: five cameras at the M3 x M27 interchange (M3 J14),
  // one at M3 J13, one at M3 J12 — each group at its junction centroid.
  const m3 = cameras.filter((camera) => camera.id.startsWith('nh-m3-'));
  assert.equal(m3.length, 7);
  for (const camera of m3) {
    assert.match(camera.name, /M3 J1[2-4]/);
  }
  const j14 = m3.filter((camera) => camera.name.includes('M3 J14'));
  assert.equal(j14.length, 5);
  for (const camera of j14) {
    assert.equal(camera.lat, 50.95993);
    assert.equal(camera.lon, -1.39245);
    assert.equal(camera.headingDeg, 218);
  }
  const m3j13 = m3.find((camera) => camera.name.includes('M3 J13'));
  assert.equal(m3j13.lat, 50.97451);
  assert.equal(m3j13.lon, -1.37444);
  assert.equal(m3j13.headingDeg, 31);
  const m3j12 = m3.find((camera) => camera.name.includes('M3 J12'));
  assert.equal(m3j12.lat, 50.99491);
  assert.equal(m3j12.lon, -1.35849);
  assert.equal(m3j12.headingDeg, 30);
});

test('M27 corridor loader tolerates a missing catalog file', (t) => {
  t.mock.method(console, 'warn', () => {});
  assert.deepEqual(
    loadM27CorridorSourcesFromCatalog({ sourceRoot: '/nonexistent' }),
    [],
  );
});

test('M27 corridor loader skips malformed rows without throwing', (t) => {
  t.mock.method(console, 'log', () => {});
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gev-m27-corridor-'));
  fs.mkdirSync(path.join(dir, 'config'));
  fs.writeFileSync(
    path.join(dir, 'config', 'cctv_sources.m27corridor.json'),
    JSON.stringify([
      {
        id: { toString: null },
        url: 'https://trafficcameras.uk/storage/cameras/1.jpg',
        lat: 50.9,
        lon: -1.3,
      },
      {
        id: 'ok',
        url: 'https://trafficcameras.uk/storage/cameras/1.jpg',
        lat: 50.9,
        lon: -1.3,
      },
      {
        id: 'text-coords',
        url: 'https://trafficcameras.uk/storage/cameras/2.jpg',
        lat: '50.9',
        lon: '-1.3',
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
        lat: 50.9,
        lon: -1.3,
      },
    ]),
  );
  const cameras = loadM27CorridorSourcesFromCatalog({ sourceRoot: dir });
  assert.deepEqual(
    cameras.map((camera) => camera.id),
    ['ok'],
  );
});
