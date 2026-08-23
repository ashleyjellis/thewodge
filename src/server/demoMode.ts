/**
 * Demo mode, as seen from the server.
 *
 * src/config.ts exports DEMO_MODE for the browser, read from
 * `import.meta.env`. An API handler has no `import.meta.env` — Vite inlines
 * that at build time for client code only — so the server has to read the
 * same variable from `process.env` instead.
 *
 * Two separate reads of one setting is exactly the shape that drifts, so the
 * default is a shared constant rather than a literal in each file.
 *
 * What that still cannot prevent: VITE_DEMO_MODE is baked into the client
 * bundle at build time but read fresh by the server on every request, so
 * changing it in the deployment environment WITHOUT redeploying leaves the
 * browser on the old value and the server on the new one — the banner and the
 * CSV would then disagree about whether the data is real. Changing demo mode
 * means a redeploy, not just an environment edit.
 */
import { DEMO_MODE_DEFAULT_ON } from '../lib/demoModeDefault.js'

export function isDemoMode(): boolean {
  const raw = process.env.VITE_DEMO_MODE
  if (raw === undefined || raw === '') return DEMO_MODE_DEFAULT_ON
  return raw !== '0'
}
