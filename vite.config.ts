import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Indexable routes are prerendered to static HTML at build so crawlers and share
// cards get real per-page <title>/meta/OG. /results and /app are excluded on
// purpose (user-specific / noindex) and stay client-rendered.
const PRERENDER_PATHS = [
  '/',
  '/how-it-works',
  '/methodology',
  '/about',
  '/security',
  '/guides',
  '/guides/am-i-behind-for-my-age',
  '/guides/what-is-200-a-month-worth',
  '/privacy',
  '/terms',
]
const PRERENDER_PAGES = PRERENDER_PATHS.map((path) => ({ path }))
const ALLOWED = new Set(PRERENDER_PATHS)

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      spa: { enabled: true },
      // Prerender ONLY the explicit indexable pages. Crawling is off so dynamic,
      // noindex routes (/results, /app) are never prerendered — they fall back to
      // the SPA shell and render cleanly on the client (no hydration mismatch).
      prerender: {
        enabled: true,
        crawlLinks: false,
        concurrency: 4,
        filter: (page: { path: string }) => ALLOWED.has(page.path),
      },
      pages: PRERENDER_PAGES,
    }),
    viteReact(),
  ],
})
