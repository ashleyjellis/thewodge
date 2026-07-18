/**
 * Newsletter capture — a native Vercel serverless function. Capture-only: it takes
 * an email and nothing else (never any financial data). Vercel's function
 * filesystem is read-only, so this logs the capture (visible in Vercel logs); swap
 * in a real list/store when you have one.
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
    console.log('[wodge] newsletter signup:', email)
    res.status(200).json({ ok: true })
  } catch {
    res.status(400).json({ ok: false, error: 'bad request' })
  }
}
