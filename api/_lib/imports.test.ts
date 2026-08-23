/**
 * Every module the serverless runtime loads must use import specifiers that
 * Node can actually resolve.
 *
 * Vercel compiles these to .js preserving the directory structure rather than
 * bundling them, so each import is resolved at runtime by Node's ESM loader.
 * That loader has two properties TypeScript hides during development: it does
 * not add file extensions, and it knows nothing about tsconfig `paths`. So an
 * import written as `./schema` or `@/lib/tracker/series` typechecks, passes
 * every test, builds cleanly — and then throws ERR_MODULE_NOT_FOUND in
 * production the first time the endpoint is hit.
 *
 * This walks the real import graph from every api/ handler and fails on any
 * specifier that would not resolve. It exists because that exact bug reached
 * production: the tracker's data-access files used extensionless imports and
 * one `@/` alias, and nothing before deployment noticed.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')

function apiHandlers(dir = join(ROOT, 'api')): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry !== '_lib') out.push(...apiHandlers(full))
      continue
    }
    if (/\.(ts|mjs)$/.test(entry) && !entry.endsWith('.test.ts')) out.push(full)
  }
  return out
}

/** Every relative or aliased import in a file, with its line for reporting. */
function importsIn(file: string): { specifier: string; line: number }[] {
  const found: { specifier: string; line: number }[] = []
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((text, index) => {
      const match = text.match(/(?:from|import)\s+'([^']+)'/)
      if (match?.[1] && (match[1].startsWith('.') || match[1].startsWith('@/'))) {
        found.push({ specifier: match[1], line: index + 1 })
      }
    })
  return found
}

function resolveSpecifier(fromFile: string, specifier: string): string | null {
  const base = specifier.startsWith('@/')
    ? join(ROOT, 'src', specifier.slice(2))
    : resolve(dirname(fromFile), specifier)
  for (const candidate of [
    base.replace(/\.js$/, '.ts'),
    base.replace(/\.js$/, '.tsx'),
    base,
    `${base}.ts`,
    `${base}.tsx`,
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

/** Walks the graph from every handler, collecting every module deployed. */
function deployedModules(): string[] {
  const seen = new Set<string>()
  const queue = apiHandlers()
  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    for (const { specifier } of importsIn(file)) {
      const target = resolveSpecifier(file, specifier)
      if (target && !seen.has(target)) queue.push(target)
    }
  }
  return [...seen]
}

describe('serverless import specifiers', () => {
  const modules = deployedModules()

  it('reaches a meaningful number of modules, or this test proves nothing', () => {
    expect(modules.length).toBeGreaterThan(10)
  })

  it('never uses a tsconfig path alias', () => {
    // Node has no knowledge of `paths`; an alias resolves in dev and dies in
    // production.
    const offenders: string[] = []
    for (const file of modules) {
      for (const { specifier, line } of importsIn(file)) {
        if (specifier.startsWith('@/')) {
          offenders.push(`${relative(ROOT, file)}:${line} — ${specifier}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('always gives relative imports an explicit extension', () => {
    const offenders: string[] = []
    for (const file of modules) {
      for (const { specifier, line } of importsIn(file)) {
        if (specifier.startsWith('.') && !/\.(js|json|mjs)$/.test(specifier)) {
          offenders.push(`${relative(ROOT, file)}:${line} — ${specifier}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('points every import at a file that exists', () => {
    const offenders: string[] = []
    for (const file of modules) {
      for (const { specifier, line } of importsIn(file)) {
        if (!resolveSpecifier(file, specifier)) {
          offenders.push(`${relative(ROOT, file)}:${line} — ${specifier}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
