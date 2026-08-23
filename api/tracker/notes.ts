/**
 * GET /api/tracker/notes            — every note, newest first
 * GET /api/tracker/notes?slug=X     — one note
 *
 * Bodies are sent as markdown source rather than rendered HTML. The renderer
 * lives in src/lib/tracker/markdown.ts and produces React elements, never a
 * markup string, so there is no point in the pipeline where a note body could
 * become HTML — see that module for why that is the design rather than an
 * implementation detail.
 */
import { getTrackerDb } from '../../src/server/trackerDb/client.js'
import { findNote, listNotes } from '../../src/server/trackerDb/notes.js'
import { noteExcerpt } from '../../src/lib/tracker/markdown.js'
import { classifyDbFailure } from '../../src/server/trackerDb/errors.js'
import { methodNotAllowed, type ApiRequest, type ApiResponse } from '../_lib/http.js'

function single(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    if (req.method !== 'GET') {
      methodNotAllowed(res)
      return
    }

    const db = getTrackerDb()
    const slug = single(req.query?.slug)

    if (slug) {
      const note = await findNote(db, slug)
      if (!note) {
        res.status(404).json({ ok: false, error: 'no such note' })
        return
      }
      res.status(200).json({
        ok: true,
        note: {
          slug: note.slug,
          title: note.title,
          publishedAt: note.publishedAt,
          bodyMd: note.bodyMd,
          portfolioName: note.portfolioName,
          portfolioSlug: note.portfolioSlug,
          providerName: note.providerName,
          providerSlug: note.providerSlug,
        },
      })
      return
    }

    const all = await listNotes(db)
    res.status(200).json({
      ok: true,
      // The index shows an excerpt, so full bodies are not sent — a list of
      // twenty notes would otherwise carry twenty complete articles to render
      // three lines of each.
      notes: all.map((note) => ({
        slug: note.slug,
        title: note.title,
        publishedAt: note.publishedAt,
        excerpt: noteExcerpt(note.bodyMd),
        portfolioName: note.portfolioName,
        portfolioSlug: note.portfolioSlug,
        providerName: note.providerName,
        providerSlug: note.providerSlug,
      })),
    })
  } catch (err) {
    console.error('[api/tracker/notes]', err)
    res.status(500).json({
      ok: false,
      error: 'the tracker database could not be read',
      reason: classifyDbFailure(err),
    })
  }
}
