import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';
import { mountAskVestaRecon } from './vesta/ask.js';
import { vestaVoiceOption } from './vesta/voiceSession.js';

const application = createStandaloneApplication({
  googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
  cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
  allowQaRegistration: import.meta.env.DEV,
  // vesta recon: voice through vesta-voice when its offer URL is set at build time.
  voice: vestaVoiceOption(import.meta.env.VITE_VESTA_VOICE_OFFER_URL),
});

// vesta recon: the typed command box (map tools run through the voice runner).
mountAskVestaRecon();

application.start().catch((error) => {
  console.error("God's Eye View initialization failed:", error);
  const loaderStatus = document.querySelector('#loading-screen .loader-status');
  loaderStatus.textContent = `Error: ${describeError(error)}`;
  loaderStatus.style.color = '#ff4444';
});

export { application };
