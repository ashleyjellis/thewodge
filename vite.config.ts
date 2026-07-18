import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    // SPA mode: prerender a static shell (dist/client/index.html) and hydrate the
    // app client-side. This makes the build a static site any host (Vercel) can
    // serve without a running server — financials are local-first, so no server is
    // needed at runtime for v1.
    tanstackStart({ spa: { enabled: true } }),
    viteReact(),
  ],
})
