// vesta recon: the map brief for a voice call on vesta-voice. When a call says
// it comes from the globe (profile "globe"), vesta-voice fetches this from the
// server side: the map rules and the map tools. The page never supplies
// instructions, and the rules stay next to the tools they describe; Vesta's
// identity and her way of speaking are vesta-voice's own.
import { realtimeInstructions } from './instructions.js';
import { GEV_REALTIME_TOOLS } from './tools.js';

const UPSTREAM_IDENTITY = /^You are GEV Voice Control\b/;

/**
 * The voice agent's map rules for a call on vesta-voice: the screenshot lines
 * go (the model cannot see the map) and upstream's identity line gives way to
 * Vesta's.
 *
 * @returns {string}
 */
export function vestaVoiceInstructions() {
  return realtimeInstructions()
    .split('\n')
    .filter((line) => !/screenshot/i.test(line))
    .filter((line) => !UPSTREAM_IDENTITY.test(line))
    .join('\n');
}

/** The map tools as name, description and JSON-schema parameters. */
export const VESTA_VOICE_TOOLS = Object.freeze(
  GEV_REALTIME_TOOLS.map(({ name, description, parameters }) => ({
    name,
    description,
    parameters,
  })),
);

function send(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

/** GET /api/vesta/voice-brief: { instructions, tools } for a globe call. */
function handleVestaVoiceBrief(req, res) {
  if (req.method !== 'GET') {
    send(res, 405, { error: 'Method not allowed' });
    return;
  }
  send(res, 200, {
    instructions: vestaVoiceInstructions(),
    tools: VESTA_VOICE_TOOLS,
  });
}

export { handleVestaVoiceBrief };
