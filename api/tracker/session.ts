/**
 * POST   /api/tracker/session  { email, password } → signs in, sets the cookie
 * DELETE /api/tracker/session  → signs out
 * GET    /api/tracker/session  → { signedIn, email? }
 */
import { eq } from 'drizzle-orm'
import { getTrackerDb } from '../../src/server/trackerDb/client.js'
import { adminUsers } from '../../src/server/trackerDb/schema.js'
import {
  ADMIN_COOKIE_NAME,
  clearedSessionCookie,
  createSessionToken,
  readSessionToken,
  sessionCookie,
  verifyPassword,
} from '../../src/server/adminAuth.js'
import {
  methodNotAllowed,
  parseBody,
  readCookie,
  requireSetHeader,
  serverError,
  type ApiRequest,
  type ApiResponse,
} from '../_lib/http.js'

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    if (req.method === 'GET') {
      const session = readSessionToken(readCookie(req, ADMIN_COOKIE_NAME))
      res.status(200).json({ ok: true, signedIn: session !== null, email: session?.email ?? null })
      return
    }

    if (req.method === 'DELETE') {
      requireSetHeader(res)('Set-Cookie', clearedSessionCookie())
      res.status(200).json({ ok: true, signedIn: false })
      return
    }

    if (req.method !== 'POST') {
      methodNotAllowed(res)
      return
    }

    const body = parseBody(req)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    const db = getTrackerDb()
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.email, email))

    // One message for both "no such operator" and "wrong password", so the
    // form cannot be used to work out which email addresses exist.
    const valid = admin ? verifyPassword(password, admin.passwordHash) : false
    if (!admin || !valid) {
      res.status(401).json({ ok: false, error: 'those details were not recognised' })
      return
    }

    const token = createSessionToken({ adminId: admin.id, email: admin.email })
    requireSetHeader(res)('Set-Cookie', sessionCookie(token))
    res.status(200).json({ ok: true, signedIn: true, email: admin.email })
  } catch (err) {
    serverError(res, err)
  }
}
