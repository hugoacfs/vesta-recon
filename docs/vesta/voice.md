# Voice: Vesta on the globe

The dock's microphone calls **vesta-voice**, vesta's own voice service (Pipecat over WebRTC, Qwen3-ASR
for hearing, Qwen 27B as the brain, Pocket TTS for her voice). On a call from the globe Vesta keeps her
own voice and manner, moves the map with the globe's map tools, and has Hugo's memory and web search as
on any call with her. Hugo, 2026-10-01: "works perfectly fine with web search, memory and map controls".

## A call, step by step

1. **Click.** The dock's button starts the session (`src/voice/sessionCommands.js`). The adapter plays a
   silent clip inside the click, so that her reply may play later (Safari and iOS only allow audio a
   gesture started), and loads Pipecat's browser client (a separate chunk, fetched when a call starts).
2. **Offer.** The page sends its WebRTC offer to `VITE_VESTA_VOICE_OFFER_URL` with
   `requestData: {"profile": "globe"}`, and nothing else: no prompt, no tools.
3. **Brief.** vesta-voice sees the profile and fetches `GET /api/vesta/voice-brief` from this app's
   server over loopback: the map rules (upstream's voice instructions without the screenshot lines and
   without upstream's identity line) and the 30 map tools.
4. **Ready.** The call connects; the dock shows LISTENING, "Ask or command". vesta-voice has already
   asked the model server to read the long prompt (a one-token request built like a turn), so the first
   turn does not wait for it.
5. **Speech.** Hugo speaks; vesta-voice hears the whole turn and hands it to Qwen.
6. **A map tool.** Qwen calls, say, `fly_to_location {"locationId": "london"}`. vesta-voice sends it to
   the page as a server message `{"type": "tool-call", "id", "name", "args"}`; the page runs it through
   the map runner (the dock shows EXECUTING, "Running command") and answers with a client message
   `tool-result` `{"id", "result"}`. Qwen confirms in a sentence: "Flying to London."
7. **Memory or search.** Those tools run inside vesta-voice (its MCP servers) under the hold sound, as
   on a normal call; the page only hears the answer.
8. **The end.** The button again, or the service ending the call (idle, a restart): the dock goes back
   to OFF.

## The page side

**The adapter**, `src/vesta/voiceSession.js`, is a session adapter for upstream's voice contract
(`src/voice/session.js`; see upstream's `docs/VOICE-OWNERSHIP.md`). `src/main.js` passes
`voice: vestaVoiceOption(import.meta.env.VITE_VESTA_VOICE_OFFER_URL)` to the application: with no URL
the option is empty and upstream's own (OpenAI Realtime) voice stays in place.

| | |
|---|---|
| Capabilities | `costControls: false` (OpenAI's cost readout and tier button are hidden), `pushToTalk: false` (the button toggles; no Space-to-talk) |
| States | connecting "Calling vesta"; listening "Ask or command", "Hearing you", "Thinking", "Vesta is speaking"; executing "Running command"; idle "Call ended"; error with the reason |
| Map tools | `tool-call` → the session's `runAction` → `tool-result`; a failing action answers `{ok: false, error}`; a result over 8,000 characters is cut (`{truncated: true, result}`); a result that arrives after the call ended is dropped |
| Transcripts | what was heard (`heard`, final) and what she said (`bot-tts-text`) become `transcript` events; the typed box's reply line shows the latest of either |
| Typed turns | `sendText` sends text over the live call (`window.__gevVoiceCommands.sendText('Fly to Paris')` in the console does a whole turn without a microphone) |
| Map events | not sent yet: upstream adds drawn-outline events to the conversation, and a note in the middle of a tool round would break the conversation on vesta-voice |
| Connect limit | 25 s, then the call is given up with a note |
| The runner | `window.__gevVoiceCommands` is the session; its runner is at `.session.adapter.runner` (the typed box looks there) |

**The libraries**: `@pipecat-ai/client-js` 1.13.1 and `@pipecat-ai/small-webrtc-transport` 1.10.8,
pinned exactly, the versions vesta-voice's own page uses with its Pipecat 1.11 service.

**The microphone**, `src/vesta/micMediaManager.js`. Pipecat's WebRTC transport defaults to a Daily
media manager, which creates a Daily call object and so fetched Daily's call-machine script (447 KB,
from `c.daily.co`) and ran it in the page whenever a call started (found 2026-10-01). The fork hands the
transport its own media manager on plain `getUserMedia` instead (`micTransport(SmallWebRTCTransport,
options)`), which does what a voice page needs and nothing else:

- the microphone with the browser's echo cancellation, noise suppression and gain control;
- the device lists, kept fresh on `devicechange`;
- mute (the track stays, silenced);
- switching microphones during a call (the new track replaces the one being sent);
- the chosen microphone remembered (`localStorage` `vesta.voice.mic`, falling back to the default
  when it is gone);
- a refused microphone reported as a device error, while the call can still go ahead (typed turns).

The same file serves vesta-voice's own pages as `web/mic.js`.

## The service side (vesta-voice)

Lives in the `hugoacfs/vesta-voice` repository (branch `staging`), documented in its
`docs/architecture.md` ("The globe profile") and `docs/runbook.md`.

| | |
|---|---|
| Switch | `VESTA_VOICE_GLOBE_BRIEF_URL` in the instance's `.env` (staging: `http://127.0.0.1:8096/api/vesta/voice-brief`); unset, or the brief unreachable, and a globe call is refused rather than answered as a normal call |
| Brief | `brains/globe.py` checks it: tool names `^[a-z][a-z0-9_]{0,63}$`, at most 64 tools, object parameters, descriptions cut at 4,000 characters, at most 256 KB |
| Prompt | `brains/globe.md` (Vesta's identity and way of speaking, the map, memory, search and the clock) followed by the brief's rules; no clock line, so the prompt and the tools after it (about 12k tokens) stay cached on the model server |
| Tools | `current_time`, the 30 map tools (bridged to the page), `memory_search`, `memory_read`, `memory_write`, `web_search`, `news_search`, `search_and_fetch`; never the house. A map tool whose name is taken by another tool is left out |
| Bridge | each map tool waits at most 20 s for the page's answer, then hands the model `{ok: false, error: "The map did not answer in time."}` (Pipecat's own limit, 30 s, stands behind it); cancelled with the call |
| Hold sound | not for map tools (the map moving is the feedback); as usual for memory and search |
| Warm-up | a one-token `run_inference` built exactly like a turn, as the call starts |

Everything else is the normal call: the turn hearing (Qwen3-ASR 1.7B with Hugo's vocabulary), the
follow-through net, the brain grace, Pocket TTS with voice p231.

### Messages over the data channel

| Direction | RTVI message | Payload |
|---|---|---|
| service → page | `server-message` | `{"type": "tool-call", "id": "<call id>", "name": "fly_to_location", "args": {...}}` |
| page → service | `client-message`, type `tool-result` | `{"id": "<call id>", "result": {...}}` |
| service → page | `server-message` | `{"type": "heard", "text", "final", "epoch"}`, `{"type": "hold", "on"}`, `{"type": "brain", "state"}`, `{"type": "hearing", "mode", "engine"}` (as for every call) |

## Figures (staging, 2026-10-01)

- **Warm:** "Fly to London" → `fly_to_location` 1.4 s after the last word, her first word at 2.7 s;
  "Now show me the ships" → `set_layer_visibility` (AIS vessels), "Ships are on." at 2.9 s.
- **Cold:** before the warm-up existed, a first turn waited 10.1 s for the model to read the prompt
  (warm: 1.1 s). The warm-up now starts that reading as the call connects.
- **Two calls at once:** a globe call and a normal call ("what time is it on the server") both answered;
  the shared recogniser and voice were unaffected.
- **Memory and search:** "Search the news for the latest on the Artemis Moon mission" → `news_search`
  under the hold sound, answered in two sentences; "What do you remember about me?" → `memory_search`.
- **The microphone:** in Firefox with a fake microphone the track was live, audio went out (11 → 59 KB in
  a few seconds), a typed "Fly to Paris" over the call ran `fly_to_location`, and no request went to
  `c.daily.co`.

## Testing

From inside the voice service's staging container (the scripted caller stands in for the page,
answering every map tool "ok"):

```bash
docker exec vesta-voice-staging python -m vesta_voice.tools.caller --url http://127.0.0.1:8097/api/offer --wav /app/data/probes/globe-london.wav --seconds 30 --request-data '{"profile": "globe"}' --answer-tools
```

Probes in staging's `data/probes/`: `globe-london.wav`, `globe-london-ships.wav`, `globe-news.wav`,
`globe-memory.wav`. A real browser with a fake microphone, on the Mac: `node checks/mic-check.mjs` in the
vesta-voice repository (`ONLY=globe` for this page). The sound itself needs a person: Hugo's call.

## Staging and production

Today the globe calls vesta-voice's **staging** instance, whose memory is the staging memory server
(not Hugo's own notes). To move to production, on Hugo's word:

1. vesta-voice: promote `staging` to `main` and production as its runbook says (this carries the globe
   profile, off until configured, and the microphone layer).
2. Production's `.env` (`/srv/ai/compose/vesta-voice/.env`): add
   `VESTA_VOICE_GLOBE_BRIEF_URL=http://127.0.0.1:8096/api/vesta/voice-brief`, then `docker compose up -d`.
3. This app's `.env` (`/srv/ai/compose/gods-eye-view/.env`): set
   `VITE_VESTA_VOICE_OFFER_URL=https://vesta.tail22b555.ts.net/voice/api/offer`, then
   `docker compose up -d` (the container is recreated and the page rebuilt with the new URL).
4. Check with a call: the map moves, memory answers from Hugo's own notes, the house stays out.

## Known limits

- Drawn-outline map events are not sent to voice (see above).
- A silent call ends after Pipecat's idle timeout (300 s).
- No push-to-talk: the button toggles the call.
