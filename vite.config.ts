import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base so the build also works inside the Capacitor WebView.
  base: './',
  server: {
    host: true,
  },
  build: {
    target: 'es2022',
    // Three.js alone is ~500 kB; the app is offline/bundled, so one chunk is fine for now.
    chunkSizeWarningLimit: 1000,
  },
})
