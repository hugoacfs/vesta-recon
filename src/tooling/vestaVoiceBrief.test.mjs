import assert from 'node:assert/strict';
import test from 'node:test';
import {
  handleVestaVoiceBrief,
  vestaVoiceInstructions,
  VESTA_VOICE_TOOLS,
} from '../../server/providers/openai/vesta-voice-brief.js';

function call(method) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
      },
      end(payload = '') {
        resolve({
          status: this.statusCode,
          headers: this.headers,
          json: JSON.parse(String(payload)),
        });
      },
    };
    handleVestaVoiceBrief({ method, url: '/api/vesta/voice-brief' }, res);
  });
}

test('the voice brief keeps the map rules but not the screenshots or upstream identity', () => {
  const instructions = vestaVoiceInstructions();
  assert.doesNotMatch(instructions, /screenshot/i);
  assert.doesNotMatch(instructions, /You are GEV Voice Control/);
  assert.match(instructions, /move_camera/);
});

test('the voice brief offers every map tool as name, description and parameters', () => {
  assert.equal(VESTA_VOICE_TOOLS.length > 20, true);
  for (const tool of VESTA_VOICE_TOOLS) {
    assert.deepEqual(Object.keys(tool), ['name', 'description', 'parameters']);
    assert.match(tool.name, /^[a-z][a-z0-9_]*$/);
    assert.equal(tool.parameters.type, 'object');
  }
  assert.ok(VESTA_VOICE_TOOLS.some((tool) => tool.name === 'fly_to_location'));
});

test('the brief answers GET only, never cached', async () => {
  const brief = await call('GET');
  assert.equal(brief.status, 200);
  assert.equal(brief.headers['cache-control'], 'no-store');
  assert.equal(brief.json.instructions, vestaVoiceInstructions());
  assert.equal(brief.json.tools.length, VESTA_VOICE_TOOLS.length);
  assert.equal((await call('POST')).status, 405);
});
