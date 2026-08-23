/**
 * Note reads for the public notes pages.
 */
import { desc, eq } from 'drizzle-orm'
import type { TrackerDb } from './client.js'
import { notes, portfolios, providers } from './schema.js'

export type NoteRow = typeof notes.$inferSelect

export type NoteWithSubject = NoteRow & {
  /** null when the note is about the project rather than one portfolio */
  portfolioName: string | null
  portfolioSlug: string | null
  providerName: string | null
  providerSlug: string | null
}

/**
 * Newest first. `portfolio_id` is nullable — a note may be about one portfolio
 * or about the whole project — so this is a left join and the subject fields
 * come back null rather than the note disappearing, which is what an inner
 * join would do to every general note.
 */
export async function listNotes(db: TrackerDb): Promise<NoteWithSubject[]> {
  const rows = await db
    .select({ note: notes, portfolio: portfolios, provider: providers })
    .from(notes)
    .leftJoin(portfolios, eq(portfolios.id, notes.portfolioId))
    .leftJoin(providers, eq(providers.id, portfolios.providerId))
    .orderBy(desc(notes.publishedAt))

  return rows.map(({ note, portfolio, provider }) => ({
    ...note,
    portfolioName: portfolio?.name ?? null,
    portfolioSlug: portfolio?.slug ?? null,
    providerName: provider?.name ?? null,
    providerSlug: provider?.slug ?? null,
  }))
}

export async function findNote(db: TrackerDb, slug: string): Promise<NoteWithSubject | null> {
  const rows = await db
    .select({ note: notes, portfolio: portfolios, provider: providers })
    .from(notes)
    .leftJoin(portfolios, eq(portfolios.id, notes.portfolioId))
    .leftJoin(providers, eq(providers.id, portfolios.providerId))
    .where(eq(notes.slug, slug))

  const row = rows[0]
  if (!row) return null
  return {
    ...row.note,
    portfolioName: row.portfolio?.name ?? null,
    portfolioSlug: row.portfolio?.slug ?? null,
    providerName: row.provider?.name ?? null,
    providerSlug: row.provider?.slug ?? null,
  }
}
