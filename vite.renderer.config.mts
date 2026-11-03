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
  },
});
