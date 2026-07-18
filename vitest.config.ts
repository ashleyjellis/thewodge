import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// The forecast module is pure TS — no framework plugins needed. It does import the
// `@/config` constants, so mirror the tsconfig path alias here.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'node',
  },
})
