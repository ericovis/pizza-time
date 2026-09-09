import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// The API base is NOT baked in at build time: index.html loads /config.js,
// which the container entrypoint regenerates from $API_URL on boot.
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 8080 },
  preview: { host: true, port: 8080 },
  build: { outDir: 'dist', sourcemap: false },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
  },
})
