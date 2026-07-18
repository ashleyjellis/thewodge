/**
 * Minimal request/response shapes shared by every api/*.ts function — matches
 * both Vercel's real Node runtime and the local dev middleware (vite.config.ts)
 * structurally, so handlers work identically in both without a @vercel/node
 * dependency. Deliberately small: only what these handlers actually use.
 */
export type ApiRequest = {
  method?: string
  body?: unknown
  query?: Record<string, string | string[] | undefined>
}

export type ApiResponse = {
  status: (code: number) => ApiResponse
  json: (body: unknown) => void
}

/** Defensive body parsing — Vercel sometimes hands a raw string, sometimes JSON. */
export function parseBody(req: ApiRequest): Record<string, unknown> {
  const raw = req.body
  if (raw === undefined || raw === null || raw === '') return {}
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return raw as Record<string, unknown>
}

export function methodNotAllowed(res: ApiResponse): void {
  res.status(405).json({ ok: false, error: 'method not allowed' })
}

export function badRequest(res: ApiResponse, error: string): void {
  res.status(400).json({ ok: false, error })
}

export function serverError(res: ApiResponse, error: unknown): void {
  console.error('[api]', error)
  res.status(500).json({ ok: false, error: 'internal error' })
}
