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
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'

function findHandlerFile(root: string, name: string): string | null {
  for (const ext of ['.ts', '.mjs', '.js']) {
    const candidate = resolve(root, 'api', `${name}${ext}`)
    if (existsSync(candidate)) return candidate
  }
  return null
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
          if (!name || name.includes('/')) return next()

          const modulePath = findHandlerFile(process.cwd(), name)
          if (!modulePath) return next()

          const mod = await server.ssrLoadModule(modulePath)
          const handler = mod.default
          if (typeof handler !== 'function') return next()

          const body = await readBody(req)
          const query: Record<string, string> = {}
          url.searchParams.forEach((value, key) => {
            query[key] = value
          })

          await handler(
            { method: req.method, body, query },
            {
              status(code: number) {
                res.statusCode = code
                return this
              },
              json(payload: unknown) {
                res.setHeader('content-type', 'application/json')
                res.end(JSON.stringify(payload))
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
