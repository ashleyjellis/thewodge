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

/**
 * The platform turns every file under api/ into its own serverless function,
 * and the plan this deploys on allows twelve. Going over fails the build
 * before anything is compiled, with an error about a count rather than about
 * the endpoint that tipped it over — so the person who added a perfectly good
 * handler gets a failure that says nothing about what they did.
 *
 * That happened. Six tracker endpoints plus the household app's seven made
 * thirteen; api/tracker/[resource].ts now serves all six as one, and the
 * handlers live in api/_lib/tracker/ where an underscore keeps them from
 * deploying.
 */
const FUNCTION_LIMIT = 12

/** Files the platform would deploy as functions, applying the same rules. */
function deployableFunctions(dir = join(ROOT, 'api'), prefix = ''): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      // Underscore-prefixed directories are shared code, not endpoints.
      if (!entry.startsWith('_')) out.push(...deployableFunctions(full, `${prefix}${entry}/`))
      continue
    }
    // .vercelignore keeps tests out of the upload, so they never become
    // functions — mirrored here rather than parsed, and asserted below.
    if (!/\.(ts|mjs|js)$/.test(entry) || entry.endsWith('.test.ts')) continue
    out.push(`${prefix}${entry}`)
  }
  return out
}

describe('serverless function count', () => {
  it(`stays within the ${FUNCTION_LIMIT} the plan allows`, () => {
    const functions = deployableFunctions()
    expect(
      functions.length,
      `${functions.length} functions would deploy:\n  ${functions.join('\n  ')}\n` +
        'Add new tracker endpoints to api/_lib/tracker/ and register them in ' +
        'api/tracker/[resource].ts rather than as new files under api/.',
    ).toBeLessThanOrEqual(FUNCTION_LIMIT)
  })

  it('counts something, so the limit is not passing on an empty list', () => {
    expect(deployableFunctions().length).toBeGreaterThan(5)
  })

  it('relies on .vercelignore actually excluding the test files it assumes', () => {
    // The count above only holds if tests really are kept out of the upload.
    // If this rule is ever dropped from .vercelignore, the count is wrong and
    // the build fails on something this test claimed to be watching.
    const ignore = readFileSync(join(ROOT, '.vercelignore'), 'utf8')
    expect(ignore).toContain('api/**/*.test.ts')
  })
})
