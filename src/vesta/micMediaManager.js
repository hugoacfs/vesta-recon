// vesta: the microphone for Pipecat's SmallWebRTCTransport, on plain
// getUserMedia. The transport's default media manager creates a Daily call
// object, which fetches Daily's call-machine script from c.daily.co and runs it
// in the page every time a call starts (found 2026-10-01). This one does what a
// voice page needs and nothing else: the microphone with the browser's echo
// cancellation, noise suppression and gain control; the device lists; mute;
// switching microphones during a call. No camera, no screen sharing. The same
// file serves vesta-voice's pages (web/mic.js) and vesta recon
// (src/vesta/micMediaManager.js).

const LOCAL = { id: 'local', name: '', local: true };
const REMEMBERED_MIC = 'vesta.voice.mic';

/**
 * A SmallWebRTCTransport on this microphone. The transport replaces the track
 * it sends itself only for its own media manager, so a new microphone track is
 * handed to the audio sender here.
 *
 * @param {Function} SmallWebRTCTransport the transport class
 * @param {object} [options] the transport's options
 */
export function micTransport(SmallWebRTCTransport, options = {}) {
  let transport = null;
  const mic = new MicMediaManager({
    onTrackReplaced: async (track) => {
      if (transport?.pc)
        await transport.getAudioTransceiver()?.sender?.replaceTrack(track);
    },
  });
  transport = new SmallWebRTCTransport({ ...options, mediaManager: mic });
  return transport;
}

export class MicMediaManager {
  constructor({
    onTrackReplaced,
    mediaDevices = globalThis.navigator?.mediaDevices,
    storage = globalThis.localStorage,
  } = {}) {
    this._callbacks = {};
    this._options = null;
    this._micEnabled = true;
    this._track = null;
    this._selectedMic = {};
    this._selectedSpeaker = {};
    this._initialized = false;
    this._connected = false;
    this._opening = 0;
    this._onTrackReplaced = onTrackReplaced;
    this._devices = mediaDevices;
    this._storage = storage;
    this._onDeviceChange = () => void this._announceDevices();
  }

  // What Pipecat's MediaManager base class provides.
  setUserAudioCallback(callback) {
    this._userAudioCallback = callback;
  }

  setClientOptions(options, override = false) {
    if (this._options && !override) return;
    this._options = options;
    this._callbacks = options.callbacks ?? {};
    this._micEnabled = options.enableMic ?? true;
  }

  get supportsScreenShare() {
    return false;
  }

  async initialize() {
    if (this._initialized) return;
    this._initialized = true;
    this._devices?.addEventListener?.('devicechange', this._onDeviceChange);
    if (this._micEnabled) await this._openMic(this._rememberedMic());
    await this._announceDevices();
  }

  async connect() {
    if (!this._initialized) await this.initialize();
    this._connected = true;
  }

  async disconnect() {
    this._connected = false;
    this._initialized = false;
    this._opening += 1;
    this._devices?.removeEventListener?.('devicechange', this._onDeviceChange);
    const track = this._track;
    this._track = null;
    if (track) {
      track.stop();
      this._callbacks.onTrackStopped?.(track, LOCAL);
    }
  }

  async getAllMics() {
    return (await this._list()).filter((d) => d.kind === 'audioinput');
  }

  async getAllCams() {
    return [];
  }

  async getAllSpeakers() {
    return (await this._list()).filter((d) => d.kind === 'audiooutput');
  }

  updateMic(micId) {
    this._remember(micId);
    void this._openMic(micId);
  }

  updateCam() {}

  // Her audio is played by the page's own player, which follows the speaker
  // choice itself (setSinkId); this only keeps the choice.
  async updateSpeaker(speakerId) {
    this._selectedSpeaker = { deviceId: speakerId };
    this._callbacks.onSpeakerUpdated?.(this._selectedSpeaker);
  }

  get selectedMic() {
    return this._selectedMic;
  }

  get selectedCam() {
    return {};
  }

  get selectedSpeaker() {
    return this._selectedSpeaker;
  }

  async enableMic(enable) {
    this._micEnabled = enable;
    if (enable && !this._track && this._initialized)
      await this._openMic(this._rememberedMic());
    if (this._track) this._track.enabled = enable;
  }

  enableCam() {}

  enableScreenShare() {}

  get isMicEnabled() {
    return this._micEnabled;
  }

  get isCamEnabled() {
    return false;
  }

  get isSharingScreen() {
    return false;
  }

  tracks() {
    return {
      local: {
        audio: this._track ?? undefined,
        screenAudio: undefined,
        screenVideo: undefined,
        video: undefined,
      },
    };
  }

  async userStartedSpeaking() {}

  bufferBotAudio() {}

  async _openMic(deviceId) {
    const attempt = ++this._opening;
    let stream;
    try {
      stream = await this._devices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
        video: false,
      });
    } catch (error) {
      // A remembered microphone that is gone: the default one instead.
      if (deviceId && attempt === this._opening) return this._openMic(null);
      this._callbacks.onDeviceError?.({
        devices: ['mic'],
        type: error?.name === 'NotAllowedError' ? 'permissions' : 'unknown',
        message: String(error?.message || error),
        error,
      });
      return null;
    }
    const track = stream.getAudioTracks()[0] ?? null;
    if (attempt !== this._opening || !track) {
      // Superseded (another switch, or the call ended) while the browser asked.
      for (const t of stream.getTracks()) t.stop();
      return null;
    }
    const previous = this._track;
    this._track = track;
    track.enabled = this._micEnabled;
    track.addEventListener?.('ended', () => {
      if (this._track === track) this._callbacks.onTrackStopped?.(track, LOCAL);
    });
    const settings = track.getSettings?.() ?? {};
    this._selectedMic = {
      deviceId: settings.deviceId ?? deviceId ?? 'default',
      groupId: settings.groupId ?? '',
      kind: 'audioinput',
      label: track.label ?? '',
    };
    this._callbacks.onMicUpdated?.(this._selectedMic);
    this._callbacks.onTrackStarted?.(track, LOCAL);
    if (this._connected) await this._onTrackReplaced?.(track);
    if (previous && previous !== track) {
      previous.stop();
      this._callbacks.onTrackStopped?.(previous, LOCAL);
    }
    return track;
  }

  async _list() {
    try {
      return (await this._devices?.enumerateDevices?.()) ?? [];
    } catch {
      return [];
    }
  }

  async _announceDevices() {
    const all = await this._list();
    this._callbacks.onAvailableMicsUpdated?.(
      all.filter((d) => d.kind === 'audioinput'),
    );
    this._callbacks.onAvailableSpeakersUpdated?.(
      all.filter((d) => d.kind === 'audiooutput'),
    );
    this._callbacks.onAvailableCamsUpdated?.([]);
  }

  _rememberedMic() {
    try {
      return this._storage?.getItem(REMEMBERED_MIC) || null;
    } catch {
      return null;
    }
  }

  _remember(micId) {
    try {
      if (micId) this._storage?.setItem(REMEMBERED_MIC, micId);
    } catch {
      /* private mode: the default microphone next time */
    }
  }
}
