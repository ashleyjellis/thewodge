/**
 * Guards the rule in libsqlClientType.ts.
 *
 * This is here because the failure mode is invisible locally: importing a
 * type by name from '@libsql/client' passes `pnpm typecheck` on every
 * resolution mode and every TypeScript version tried, and only breaks once
 * the code reaches a deployment whose node_modules layout leaves the
 * transitive `@libsql/core` unreachable. A rule that cannot fail on the
 * machine where it is broken needs something that checks it explicitly.
 *
 * The check is textual on purpose. Reproducing the real condition means
 * hiding a package inside node_modules and running a second full typecheck —
 * accurate, but slow and far too invasive to run on every commit. Grepping
 * the source costs nothing and catches the thing that actually regresses:
 * someone writing the import back in.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { glob } from 'node:fs/promises'

const ROOT = join(import.meta.dirname, '..', '..')

async function sourceFiles(): Promise<string[]> {
  const found: string[] = []
  for await (const entry of glob('{src,api,scripts}/**/*.{ts,tsx}', { cwd: ROOT })) {
    found.push(entry)
  }
  return found
}

describe('@libsql/client imports', () => {
  it('imports nothing from the package except createClient', async () => {
    // Stated as an allowlist rather than as "no type imports", because the
    // safe set really is that small. `createClient` is a value the package
    // declares and exports itself, so it survives however the dependency tree
    // is laid out — and importing it `import type { createClient }`, as
    // libsqlClientType.ts does purely to read its return type, is equally
    // safe. Every other name in that module arrives via
    // `export * from "@libsql/core/api"` and disappears wherever that
    // transitive package cannot be resolved.
    const offenders: string[] = []

    for (const file of await sourceFiles()) {
      const source = readFileSync(join(ROOT, file), 'utf8')
      for (const match of source.matchAll(
        /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]@libsql\/client['"]/g,
      )) {
        // The rule is discussed in prose in libsqlClientType.ts, and its
        // examples are exactly what this pattern looks for. Match on code
        // only. Approximated by the opening line's shape, which is enough for
        // a JSDoc block or a //-comment and is the only place these examples
        // appear.
        const lineStart = source.lastIndexOf('\n', match.index) + 1
        const line = source.slice(lineStart, source.indexOf('\n', match.index)).trim()
        if (line.startsWith('*') || line.startsWith('//')) continue

        for (const name of match[1]!.split(',').map((part) => part.trim())) {
          if (name === '' || name === 'createClient') continue
          offenders.push(`${file} — ${name}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('checks files that really exist, so an empty pass means something', async () => {
    // Without this, a broken glob would make the test above pass by scanning
    // nothing at all — which is the same shape of false confidence the CSV
    // round-trip check had before it was fixed.
    const files = await sourceFiles()
    expect(files.length).toBeGreaterThan(50)
    expect(files).toContain(join('src', 'server', 'trackerDb', 'client.ts'))

    const importers = files.filter((file) =>
      readFileSync(join(ROOT, file), 'utf8').includes("from '@libsql/client'"),
    )
    // The three database clients. If this ever drops to zero the rule above
    // is guarding nothing.
    expect(importers.length).toBeGreaterThanOrEqual(3)
  })
})
