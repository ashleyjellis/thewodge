/**
 * Dev-only Vite middleware that serves api/*.ts (or .mjs) the same way Vercel
 * serves them in production, so `pnpm dev` + a real browser can exercise the
 * actual API handlers end to end — Vite has no built-in knowledge of Vercel's
 * `api/` convention, so without this, /api/* 404s during local dev.
 *
 * Generic: any request to /api/<name> loads api/<name>.ts (or .mjs) and calls its
 * default export with an adapted req/res. Never runs in production — Vercel's own
 * routing takes over there (see `apply: 'serve'` below).
 */
import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'

type ResolvedHandler = {
  modulePath: string
  /** params captured from a dynamic segment, merged into req.query */
  params: Record<string, string>
}

function findLiteralFile(root: string, name: string): string | null {
  for (const ext of ['.ts', '.mjs', '.js']) {
    const candidate = resolve(root, 'api', `${name}${ext}`)
    if (existsSync(candidate)) return candidate
  }
  return null
}

/**
 * A `[param].ts` in the same directory, as Vercel's dynamic segments work.
 *
 * The tracker's endpoints share one function this way — see
 * api/tracker/[resource].ts for why — and without this, every one of them
 * 404s in local dev while working in production. A dev server that routes
 * differently from the real thing is worse than no dev server, because the
 * difference only surfaces after deploying.
 */
function findDynamicFile(root: string, name: string): ResolvedHandler | null {
  const segments = name.split('/')
  const last = segments.pop()
  if (!last || segments.length === 0) return null

  const dir = resolve(root, 'api', ...segments)
  if (!existsSync(dir)) return null

  for (const entry of readdirSync(dir)) {
    const match = /^\[([a-zA-Z0-9_]+)\]\.(ts|mjs|js)$/.exec(entry)
    if (match) {
      return { modulePath: resolve(dir, entry), params: { [match[1]!]: last } }
    }
  }
  return null
}

function findHandler(root: string, name: string): ResolvedHandler | null {
  const literal = findLiteralFile(root, name)
  // A literal file wins over a dynamic one, which is what Vercel does too.
  if (literal) return { modulePath: literal, params: {} }
  return findDynamicFile(root, name)
}

/**
 * Handler names may contain a single directory level (api/tracker/readings.ts
 * serving /api/tracker/readings), which is how the newer product areas keep
 * their endpoints together instead of crowding the top level. Deeper paths
 * and any `..` are refused — this only ever runs in dev, but a path that
 * escapes the api directory is not something to leave open regardless.
 */
function isSafeHandlerName(name: string): boolean {
  if (!name || name.includes('..')) return false
  const segments = name.split('/')
  if (segments.length > 2) return false
  return segments.every((segment) => /^[a-zA-Z0-9_-]+$/.test(segment))
}

async function readBody(req: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

export function apiDevMiddleware(): Plugin {
  return {
    name: 'wodge-api-dev-middleware',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api', async (req, res, next) => {
        try {
          const url = new URL(req.url ?? '/', 'http://localhost')
          const name = url.pathname.replace(/^\//, '')
          if (!isSafeHandlerName(name)) return next()

          const resolved = findHandler(process.cwd(), name)
          if (!resolved) return next()

          const mod = await server.ssrLoadModule(resolved.modulePath)
          const handler = mod.default
          if (typeof handler !== 'function') return next()

          const body = await readBody(req)
          const query: Record<string, string> = {}
          url.searchParams.forEach((value, key) => {
            query[key] = value
          })
          // Path params last: a query string cannot override the segment that
          // chose the handler, which would otherwise let /api/tracker/notes
          // ?resource=entry run a different endpoint than the URL names.
          Object.assign(query, resolved.params)

          await handler(
            { method: req.method, body, query, headers: req.headers },
            {
              status(code: number) {
                res.statusCode = code
                return this
              },
              json(payload: unknown) {
                res.setHeader('content-type', 'application/json')
                res.end(JSON.stringify(payload))
              },
              // Deliberately does not set a content-type: a handler sending a
              // non-JSON body has already said what it is (the CSV export
              // sets text/csv plus a filename), and defaulting one here would
              // silently override it.
              send(body: string) {
                res.end(body)
              },
              setHeader(name: string, value: string | string[]) {
                res.setHeader(name, value)
              },
            },
          )
        } catch (err) {
          console.error('[api-dev-middleware]', err)
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'internal error' }))
        }
      })
    },
  }
}
