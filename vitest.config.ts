import { defineConfig } from 'vitest/config'

// The calc engine is pure TS — no framework plugins needed here. Keeping the test
// config free of the TanStack Start plugin keeps the "maths is the product" ring
// verifiable in isolation (spec §11, ring 1).
export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'node',
  },
})
