/**
 * The alert endpoint's demo-mode gate.
 *
 * This is the assertion that matters most in T7, and it is worth being clear
 * why. While the portfolios are fabricated there is nothing to alert on, so
 * storing someone's email address against one collects personal data for a
 * purpose that cannot exist. The refusal is the feature; a regression that
 * quietly started accepting addresses would look like the form working.
 *
 * These cases run before any database call, so no database is needed — which
 * is itself part of the guarantee: the gate must come first, not after a
 * lookup that might succeed.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import handler from './alert'
import { fakeReq, fakeRes } from '../testHttp'

const original = process.env.VITE_DEMO_MODE

beforeEach(() => {
  delete process.env.VITE_DEMO_MODE
})
afterEach(() => {
  if (original === undefined) delete process.env.VITE_DEMO_MODE
  else process.env.VITE_DEMO_MODE = original
})

function post(body: unknown) {
  return fakeReq({ method: 'POST', body })
}

describe('POST /api/tracker/alert while demo mode is on', () => {
  it('refuses by default, with no environment variable set at all', async () => {
    // Demo mode defaults to on, so a deployment that simply forgot to set the
    // variable must still refuse rather than start collecting addresses.
    const { res, status, body } = fakeRes()
    await handler(post({ email: 'a@example.com', provider: 'p', portfolio: 'q' }), res)

    expect(status()).toBe(403)
    expect(body()).toMatchObject({ ok: false, reason: 'demo_mode' })
  })

  it('refuses when explicitly on', async () => {
    process.env.VITE_DEMO_MODE = '1'
    const { res, status } = fakeRes()
    await handler(post({ email: 'a@example.com', provider: 'p', portfolio: 'q' }), res)
    expect(status()).toBe(403)
  })

  it('says plainly that nothing was stored', async () => {
    const { res, body } = fakeRes()
    await handler(post({ email: 'a@example.com', provider: 'p', portfolio: 'q' }), res)
    expect(String((body() as { error: string }).error)).toMatch(/no address has been stored/i)
  })

  it('refuses before looking anything up, so a bad payload still gets the same answer', async () => {
    // If the gate ran after validation or a database lookup, this would come
    // back as a 400 or a 500 instead — and on a misconfigured deployment
    // could reach the database at all.
    const { res, status, body } = fakeRes()
    await handler(post({}), res)
    expect(status()).toBe(403)
    expect(body()).toMatchObject({ reason: 'demo_mode' })
  })
})

describe('POST /api/tracker/alert once the data is real', () => {
  beforeEach(() => {
    process.env.VITE_DEMO_MODE = '0'
  })

  it('validates the address rather than accepting anything', async () => {
    const { res, status, body } = fakeRes()
    await handler(post({ email: 'nope', provider: 'p', portfolio: 'q' }), res)

    expect(status()).toBe(400)
    expect(String((body() as { error: string }).error)).toMatch(/email address/i)
  })

  it('requires a portfolio to subscribe to', async () => {
    const { res, status } = fakeRes()
    await handler(post({ email: 'a@example.com' }), res)
    expect(status()).toBe(400)
  })

  it('rejects a non-POST request', async () => {
    const { res, status } = fakeRes()
    await handler(fakeReq({ method: 'GET' }), res)
    expect(status()).toBe(405)
  })
})
