/**
 * Admin authentication — password hashing and signed session cookies.
 *
 * Server-only. Deliberately small: this guards an internal panel used by one
 * operator, not a consumer product, and the honest thing at that scale is a
 * well-built minimum rather than a half-built general auth system. There is
 * no registration flow, no password reset, no roles — an operator is created
 * by a script that has database access, which is the same access needed to
 * bypass any of it anyway.
 *
 * Written to be shared: the pricing archive's own admin (planned, not yet
 * built) should use this module rather than grow a second mechanism.
 *
 * ## scrypt rather than bcrypt
 *
 * The brief says bcrypt. Node ships scrypt in `crypto`, it is memory-hard in
 * the same way, and it avoids a native compiled dependency that has to build
 * on every machine and CI runner. If bcrypt specifically matters — an
 * existing hash to migrate, say — this is the one file that would change.
 *
 * ## What the session cookie is
 *
 * `<payload>.<hmac>`, where the payload carries the admin id and an expiry.
 * Signed, not encrypted: the contents are not secret, and the only thing that
 * matters is that they cannot be forged without the secret. Verification is
 * constant-time, and the expiry is inside the signed payload rather than left
 * to the cookie's own Max-Age, which a client controls entirely.
 */
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'

const SESSION_COOKIE = 'wodge_admin'
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000 // one working day
const SCRYPT_KEYLEN = 64

export type AdminSession = {
  adminId: number
  email: string
  expiresAt: number
}

// ── passwords ─────────────────────────────────────────────────────────────

/** `scrypt$<salt-hex>$<hash-hex>` — self-describing, so the format can change later. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

const HEX = /^[0-9a-f]+$/i

/**
 * Note the strict validation of the stored value before any comparison
 * happens. Without it this function accepts ANY password against a stored
 * hash whose hex is malformed — Buffer.from('zz', 'hex') returns an empty
 * buffer rather than throwing, scryptSync is then asked for a zero-length
 * key, and timingSafeEqual(empty, empty) is true. A truncated or
 * hand-edited password_hash would silently turn into an open door, which is
 * the worst possible way for a corrupted row to fail.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  if (!HEX.test(saltHex) || !HEX.test(hashHex)) return false
  if (saltHex.length % 2 !== 0 || hashHex.length % 2 !== 0) return false

  const expected = Buffer.from(hashHex, 'hex')
  const salt = Buffer.from(saltHex, 'hex')
  // A hash of the wrong length is not a hash this module produced.
  if (expected.length !== SCRYPT_KEYLEN || salt.length === 0) return false

  let actual: Buffer
  try {
    actual = scryptSync(password, salt, SCRYPT_KEYLEN)
  } catch {
    return false
  }
  // Length is checked first because timingSafeEqual throws on a mismatch
  // rather than returning false.
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

// ── sessions ──────────────────────────────────────────────────────────────

function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < 16) {
    throw new Error(
      'ADMIN_SESSION_SECRET must be set to at least 16 characters before the admin panel can issue sessions',
    )
  }
  return secret
}

function sign(payload: string): string {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
}

export function createSessionToken(session: Omit<AdminSession, 'expiresAt'>): string {
  const payload = Buffer.from(
    JSON.stringify({ ...session, expiresAt: Date.now() + SESSION_DURATION_MS }),
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

/** Returns the session, or null for anything forged, tampered with or expired. */
export function readSessionToken(token: string | null): AdminSession | null {
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null

  const expected = Buffer.from(sign(payload))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as AdminSession
    if (typeof session.expiresAt !== 'number' || session.expiresAt < Date.now()) return null
    if (typeof session.adminId !== 'number' || typeof session.email !== 'string') return null
    return session
  } catch {
    return null
  }
}

// ── cookies ───────────────────────────────────────────────────────────────

export const ADMIN_COOKIE_NAME = SESSION_COOKIE

export function sessionCookie(token: string): string {
  const maxAge = Math.floor(SESSION_DURATION_MS / 1000)
  // HttpOnly so a script cannot read it; SameSite=Lax so it survives a normal
  // navigation but is not sent on cross-site form posts; Secure everywhere
  // except local dev, which is not served over HTTPS.
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

export function clearedSessionCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
}
