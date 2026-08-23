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
  /** lower-cased request headers — needed to read the session cookie */
  headers?: Record<string, string | string[] | undefined>
}

export type ApiResponse = {
  status: (code: number) => ApiResponse
  json: (body: unknown) => void
  /**
   * Optional so every existing handler and test keeps working untouched.
   * Anything that genuinely needs it — setting a session cookie — should
   * fail loudly rather than silently skip, which is what requireSetHeader()
   * below is for.
   */
  setHeader?: (name: string, value: string | string[]) => void
  /**
   * Sends a body that is not JSON. Only the CSV export needs this; optional
   * for the same reason as setHeader, and guarded by requireSend() below.
   */
  send?: (body: string) => void
}

/** Reads one cookie out of the request's Cookie header. */
export function readCookie(req: ApiRequest, name: string): string | null {
  const raw = req.headers?.cookie
  const header = Array.isArray(raw) ? raw.join('; ') : raw
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

/**
 * A response that can set headers, or a clear failure.
 *
 * Silently not setting a session cookie would present as "login succeeds but
 * you are immediately logged out again", which is a genuinely horrible thing
 * to debug. Better to say so.
 */
export function requireSetHeader(res: ApiResponse): (name: string, value: string | string[]) => void {
  if (!res.setHeader) {
    throw new Error('this response cannot set headers, so a session cookie cannot be issued')
  }
  return res.setHeader.bind(res)
}

/**
 * A response that can send a non-JSON body, or a clear failure.
 *
 * Falling back to res.json() for a CSV would produce a JSON-quoted string
 * with every newline escaped — a file that downloads, opens, and is wrong in
 * a way that looks like a bug in the export rather than in the plumbing.
 */
export function requireSend(res: ApiResponse): (body: string) => void {
  if (!res.send) {
    throw new Error('this response cannot send a non-JSON body, so a CSV cannot be returned')
  }
  return res.send.bind(res)
}

export function unauthorized(res: ApiResponse): void {
  res.status(401).json({ ok: false, error: 'not signed in' })
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
