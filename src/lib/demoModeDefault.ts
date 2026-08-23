/**
 * The one place demo mode's default lives.
 *
 * Demo mode is read twice — by the browser from `import.meta.env` (see
 * src/config.ts) and by API handlers from `process.env` (see
 * src/server/demoMode.ts) — because Vite inlines `import.meta.env` at build
 * time for client code only, so neither read works in the other's context.
 *
 * Two reads of one setting is the shape that drifts, and the half most likely
 * to drift silently is the fallback: someone changes '1' to '0' in one file
 * and the banner disappears from the page while the CSV still declares itself
 * fabricated, or the reverse. So the default is a constant here that both
 * import, and this module deliberately contains nothing else — no env access,
 * so it is safe on both sides of the client/server line.
 *
 * On, because the failure modes are not symmetric: a demo banner shown over
 * real data is a small embarrassment someone notices and fixes, while
 * fabricated performance figures published without one are a serious problem.
 */
export const DEMO_MODE_DEFAULT_ON = true
