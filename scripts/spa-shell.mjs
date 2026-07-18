/**
 * Post-build: expose the prerendered SPA shell as index.html.
 *
 * TanStack Start's SPA mode writes the hydratable shell to dist/client/_shell.html.
 * Copying it to index.html lets any static host (Vercel) serve "/" naturally and
 * fall back to it for client-routed deep links. The app is local-first, so no
 * server is required at runtime for v1.
 */
import { copyFile, access } from 'node:fs/promises'

const dir = 'dist/client'
const shell = `${dir}/_shell.html`
const index = `${dir}/index.html`

try {
  await access(shell)
} catch {
  console.error(`[spa] expected ${shell} — is SPA mode enabled in vite.config.ts?`)
  process.exit(1)
}

await copyFile(shell, index)
console.log(`[spa] wrote ${index} from _shell.html`)
