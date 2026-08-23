/**
 * Alert subscriptions — someone asking to hear when one portfolio moves.
 *
 * Delivery is not built. The brief marks it stubbed, and this file stores the
 * intent without pretending anything will be sent: `subscribers.confirmed_at`
 * stays null because double opt-in cannot complete without an email going
 * out, and an unconfirmed subscriber is not someone to mail.
 */
import { randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import type { TrackerDb } from './client.js'
import { alertSubscriptions, subscribers } from './schema.js'

/**
 * Deliberately permissive.
 *
 * The only thing worth rejecting here is input that is obviously not an
 * address, because the real check is whether a confirmation email arrives —
 * and an over-strict pattern turns a valid but unusual address into a
 * mysterious failure the person cannot do anything about. Plenty of
 * legitimate addresses fail the clever regexes.
 */
export function looksLikeEmail(value: string): boolean {
  const email = value.trim()
  if (email.length < 3 || email.length > 254) return false
  if (/\s/.test(email)) return false
  const at = email.indexOf('@')
  if (at <= 0 || at !== email.lastIndexOf('@')) return false
  const domain = email.slice(at + 1)
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.')
}

export type SubscribeResult = {
  /** false when this address was already tracking this portfolio */
  created: boolean
}

/**
 * Records that an address wants alerts for a portfolio.
 *
 * Idempotent by design rather than by catching a constraint violation: asking
 * twice is what happens when someone double-clicks or comes back a month
 * later having forgotten, and neither should be an error.
 */
export async function subscribeToPortfolio(
  db: TrackerDb,
  email: string,
  portfolioId: number,
): Promise<SubscribeResult> {
  const normalised = email.trim().toLowerCase()

  const [existing] = await db
    .select({ id: subscribers.id })
    .from(subscribers)
    .where(eq(subscribers.email, normalised))

  let subscriberId = existing?.id
  if (subscriberId === undefined) {
    const [row] = await db
      .insert(subscribers)
      .values({
        email: normalised,
        // Null until a confirmation email is answered. Nothing sends one yet,
        // so every subscriber stays unconfirmed — which is the honest state,
        // and the state any future delivery must respect.
        confirmedAt: null,
        unsubToken: randomBytes(24).toString('base64url'),
      })
      .returning({ id: subscribers.id })
    subscriberId = row!.id
  }

  const [already] = await db
    .select({ id: alertSubscriptions.id })
    .from(alertSubscriptions)
    .where(
      and(
        eq(alertSubscriptions.subscriberId, subscriberId),
        eq(alertSubscriptions.portfolioId, portfolioId),
      ),
    )

  if (already) return { created: false }

  await db.insert(alertSubscriptions).values({ subscriberId, portfolioId })
  return { created: true }
}
