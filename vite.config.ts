import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import pkg from './package.json'

/** Build id shown in copied runs: package version + git commit (if available). */
function buildId(): string {
  try {
    const hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
    return `${pkg.version}-${hash}`
  } catch {
    return pkg.version
  }
}

export default defineConfig({
  // Relative base so the build also works inside the Capacitor WebView.
  base: './',
  server: {
    host: true,
  },
  define: {
    __BUILD__: JSON.stringify(buildId()),
  },
  build: {
    target: 'es2022',
    // Three.js alone is ~500 kB; the app is offline/bundled, so one chunk is fine for now.
    chunkSizeWarningLimit: 1000,
  },
})
