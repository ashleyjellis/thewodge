import { beforeAll, describe, expect, it } from 'vitest'
import {
  clearedSessionCookie,
  createSessionToken,
  hashPassword,
  readSessionToken,
  sessionCookie,
  verifyPassword,
} from './adminAuth'

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET = 'test-secret-that-is-long-enough'
})

describe('password hashing', () => {
  it('verifies a correct password', () => {
    const stored = hashPassword('correct horse battery staple')
    expect(verifyPassword('correct horse battery staple', stored)).toBe(true)
  })

  it('rejects a wrong password', () => {
    const stored = hashPassword('correct horse battery staple')
    expect(verifyPassword('Correct horse battery staple', stored)).toBe(false)
    expect(verifyPassword('', stored)).toBe(false)
  })

  it('salts, so the same password hashes differently every time', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'))
  })

  it('never stores the password itself', () => {
    expect(hashPassword('hunter2')).not.toContain('hunter2')
  })

  it('rejects a malformed or unknown-scheme stored value rather than throwing', () => {
    expect(verifyPassword('x', '')).toBe(false)
    expect(verifyPassword('x', 'plaintext')).toBe(false)
    expect(verifyPassword('x', 'bcrypt$salt$hash')).toBe(false)
    expect(verifyPassword('x', 'scrypt$notvalidhex$alsonot')).toBe(false)
  })

  it('never lets a corrupted hash become an open door', () => {
    // Buffer.from(invalid, 'hex') yields an empty buffer rather than
    // throwing, so without explicit validation a truncated or hand-edited
    // password_hash would verify against every password.
    const openDoors = [
      'scrypt$aabb$',
      'scrypt$aabb$zz',
      'scrypt$$aabb',
      'scrypt$aabb$aa',            // right hex, wrong length
      `scrypt$aabb$${'ab'.repeat(63)}`, // one byte short of the real key length
    ]
    for (const stored of openDoors) {
      expect(verifyPassword('anything at all', stored)).toBe(false)
      expect(verifyPassword('', stored)).toBe(false)
    }
  })
})

describe('session tokens', () => {
  const session = { adminId: 1, email: 'admin@example.com' }

  it('round-trips a session', () => {
    const read = readSessionToken(createSessionToken(session))
    expect(read?.adminId).toBe(1)
    expect(read?.email).toBe('admin@example.com')
    expect(read?.expiresAt).toBeGreaterThan(Date.now())
  })

  it('rejects a tampered payload', () => {
    const token = createSessionToken(session)
    const [, signature] = token.split('.')
    const forged = Buffer.from(
      JSON.stringify({ adminId: 99, email: 'attacker@example.com', expiresAt: Date.now() + 10_000 }),
    ).toString('base64url')
    expect(readSessionToken(`${forged}.${signature}`)).toBeNull()
  })

  it('rejects a token signed with a different secret', () => {
    const token = createSessionToken(session)
    process.env.ADMIN_SESSION_SECRET = 'a-completely-different-secret'
    expect(readSessionToken(token)).toBeNull()
    process.env.ADMIN_SESSION_SECRET = 'test-secret-that-is-long-enough'
  })

  it('rejects an expired session', () => {
    // The expiry lives inside the signed payload rather than relying on the
    // cookie's Max-Age, which the client controls entirely.
    const expired = Buffer.from(
      JSON.stringify({ adminId: 1, email: 'a@b.c', expiresAt: Date.now() - 1 }),
    ).toString('base64url')
    const { createHmac } = require('node:crypto') as typeof import('node:crypto')
    const signature = createHmac('sha256', 'test-secret-that-is-long-enough')
      .update(expired)
      .digest('base64url')
    expect(readSessionToken(`${expired}.${signature}`)).toBeNull()
  })

  it('rejects nonsense', () => {
    expect(readSessionToken(null)).toBeNull()
    expect(readSessionToken('')).toBeNull()
    expect(readSessionToken('no-dot')).toBeNull()
    expect(readSessionToken('a.b')).toBeNull()
  })

  it('refuses to issue sessions without a strong enough secret', () => {
    const original = process.env.ADMIN_SESSION_SECRET
    process.env.ADMIN_SESSION_SECRET = 'short'
    expect(() => createSessionToken(session)).toThrow(/ADMIN_SESSION_SECRET/)
    delete process.env.ADMIN_SESSION_SECRET
    expect(() => createSessionToken(session)).toThrow(/ADMIN_SESSION_SECRET/)
    process.env.ADMIN_SESSION_SECRET = original
  })
})

describe('cookies', () => {
  it('is HttpOnly and SameSite=Lax', () => {
    const cookie = sessionCookie('token')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
  })

  it('clears by expiring immediately', () => {
    expect(clearedSessionCookie()).toContain('Max-Age=0')
  })
})
