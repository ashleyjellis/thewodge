/**
 * Alert subscriptions, against a real migrated database.
 *
 * The properties worth holding here are the ones that would embarrass the
 * site rather than merely inconvenience it: a subscriber must never be
 * created already confirmed, since nothing has sent them a confirmation and
 * "confirmed" is the flag any future delivery will trust; and asking twice
 * must not create two subscriptions, since that is what a double-click does
 * and it would mean sending everything twice.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createMigratedTrackerDb } from './testHelpers'
import { looksLikeEmail, subscribeToPortfolio } from './alerts'
import { alertSubscriptions, portfolios, providers, subscribers } from './schema'
import type { TrackerDb } from './client'

describe('looksLikeEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(looksLikeEmail('someone@example.com')).toBe(true)
    expect(looksLikeEmail('first.last+tag@sub.example.co.uk')).toBe(true)
    expect(looksLikeEmail('  padded@example.com  ')).toBe(true)
  })

  it('rejects input that is plainly not an address', () => {
    expect(looksLikeEmail('')).toBe(false)
    expect(looksLikeEmail('nobody')).toBe(false)
    expect(looksLikeEmail('no@domain')).toBe(false)
    expect(looksLikeEmail('two@at@example.com')).toBe(false)
    expect(looksLikeEmail('has space@example.com')).toBe(false)
    expect(looksLikeEmail('@example.com')).toBe(false)
    expect(looksLikeEmail('trailing@example.')).toBe(false)
  })

  it('rejects an address longer than the spec allows', () => {
    expect(looksLikeEmail(`${'a'.repeat(250)}@example.com`)).toBe(false)
  })
})

describe('subscribeToPortfolio (against a real migrated database)', () => {
  let db: TrackerDb
  let cleanup: () => void
  let portfolioId: number
  let otherPortfolioId: number

  beforeAll(async () => {
    ;({ db, cleanup } = await createMigratedTrackerDb())

    const [provider] = await db
      .insert(providers)
      .values({ slug: 'northgate', name: 'Northgate', isDemo: false })
      .returning({ id: providers.id })

    const [portfolio] = await db
      .insert(portfolios)
      .values({
        providerId: provider!.id,
        slug: 'balanced',
        name: 'Balanced',
        inceptionDate: '2025-01-06',
        initialPence: 50_000,
      })
      .returning({ id: portfolios.id })
    portfolioId = portfolio!.id

    const [other] = await db
      .insert(portfolios)
      .values({
        providerId: provider!.id,
        slug: 'cautious',
        name: 'Cautious',
        inceptionDate: '2025-01-06',
        initialPence: 50_000,
      })
      .returning({ id: portfolios.id })
    otherPortfolioId = other!.id
  })

  afterAll(() => cleanup())

  it('creates the subscriber and the subscription', async () => {
    const result = await subscribeToPortfolio(db, 'reader@example.com', portfolioId)
    expect(result.created).toBe(true)

    const rows = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, 'reader@example.com'))
    expect(rows).toHaveLength(1)
  })

  it('never marks a new subscriber as confirmed', async () => {
    // Nothing has sent them anything to confirm. A future delivery job will
    // trust this flag to decide who may be emailed, so setting it here would
    // mail people who never opted in.
    const [row] = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, 'reader@example.com'))
    expect(row!.confirmedAt).toBeNull()
  })

  it('gives every subscriber an unsubscribe token', async () => {
    const [row] = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, 'reader@example.com'))
    expect(row!.unsubToken.length).toBeGreaterThan(20)
  })

  it('is idempotent — asking twice does not subscribe twice', async () => {
    const again = await subscribeToPortfolio(db, 'reader@example.com', portfolioId)
    expect(again.created).toBe(false)

    const rows = await db
      .select()
      .from(alertSubscriptions)
      .where(eq(alertSubscriptions.portfolioId, portfolioId))
    expect(rows).toHaveLength(1)
  })

  it('does not create a second subscriber row for the same address', async () => {
    await subscribeToPortfolio(db, 'reader@example.com', otherPortfolioId)
    const rows = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, 'reader@example.com'))
    expect(rows).toHaveLength(1)
  })

  it('lets one address track more than one portfolio', async () => {
    const [subscriber] = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, 'reader@example.com'))
    const rows = await db
      .select()
      .from(alertSubscriptions)
      .where(eq(alertSubscriptions.subscriberId, subscriber!.id))
    expect(rows).toHaveLength(2)
  })

  it('treats differently-cased addresses as one person', async () => {
    // Email local parts are technically case-sensitive; in practice nobody
    // runs a mail server that way, and treating Reader@ and reader@ as two
    // subscribers would mail the same person twice.
    const result = await subscribeToPortfolio(db, 'READER@Example.com', portfolioId)
    expect(result.created).toBe(false)

    const rows = await db.select().from(subscribers)
    expect(rows.filter((row) => row.email.toLowerCase() === 'reader@example.com')).toHaveLength(1)
  })
})
