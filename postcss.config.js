// vesta recon: the Vesta palette over upstream's stylesheets, at build time
// (build/vesta-palette.mjs). Vite reads this file for every CSS it builds.
import vestaPalette from './build/vesta-palette.mjs';

export default {
  plugins: [
    // (0, 255, 255) is also the HUD's default colour, set from src/hud.js.
    vestaPalette({ extra: [[0, 255, 255]] }),
  ],
};
