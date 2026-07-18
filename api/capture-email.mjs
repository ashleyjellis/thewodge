/**
 * Email capture — a native Vercel serverless function (spec §8: the list is the
 * asset, kept server-side). Works alongside the static SPA: Vercel serves /api/*
 * as functions and the rest as static files.
 *
 * Only an email is accepted — never any financial data (spec §8). Vercel's function
 * filesystem is read-only, so this logs the capture (visible in Vercel logs) and is
 * the one place to swap in a Turso `users` insert once a database is provisioned —
 * see src/lib/server/tursoStore.ts.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed' })
    return
  }
  try {
    const raw =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const email = String(raw.email || '')
      .trim()
      .toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ ok: false, error: 'invalid email' })
      return
    }
    // Production: insert into Turso `users` (encryption at rest, EU region).
    // For now, capture to the server log — no financial data, ever.
    console.log('[wodge] email captured:', email)
    res.status(200).json({ ok: true })
  } catch {
    res.status(400).json({ ok: false, error: 'bad request' })
  }
}
