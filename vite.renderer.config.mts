import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  root: './src/renderer',
  build: {
    // Forge's relative outDir would resolve against `root`; anchor it to the project
    // root so the packager finds the renderer bundle. Must match the renderer `name`
    // in forge.config.ts.
    outDir: fileURLToPath(new URL('.vite/renderer/main_window', import.meta.url)),
    emptyOutDir: true,
    // One bundle of about 707 kB (three.js alone is about 570 kB), loaded from disk in the desktop app.
    // Splitting can't get under Vite's 500 kB default, so the limit records the intended size (plan item 4.4).
    chunkSizeWarningLimit: 800,
  },
});
