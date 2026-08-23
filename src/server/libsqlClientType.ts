/**
 * The libSQL client type, derived rather than imported by name.
 *
 * ## Why this file exists
 *
 * `import { type Client } from '@libsql/client'` typechecks locally and fails
 * the deployment build with:
 *
 *     TS2459: Module '"@libsql/client"' declares 'Client' locally,
 *             but it is not exported.
 *
 * The package's own `lib-esm/node.d.ts` reads:
 *
 *     import type { Config, Client } from "@libsql/core/api"
 *     export * from "@libsql/core/api"
 *     export declare function createClient(config: Config): Client
 *
 * so `Client` reaches the outside world only through that `export *`. When
 * `@libsql/core` cannot be resolved from wherever those declarations are being
 * read, the star export contributes nothing — while the `import type` line
 * still declares `Client` in the module's local scope. Declared locally, never
 * exported, which is exactly what TS2459 says.
 *
 * `@libsql/core` is a transitive dependency and is never hoisted:
 * `node_modules/@libsql/` contains only `client`, and core lives under
 * `node_modules/.pnpm/@libsql+core@x/…`, reachable through pnpm's nested
 * symlinks. That layout resolves, which is why `pnpm typecheck` passes here.
 * A deployment whose install or file-tracing does not reproduce those symlinks
 * leaves core unreachable and the error appears.
 *
 * This was confirmed rather than assumed: temporarily renaming the `.pnpm`
 * core directory reproduces TS2459 on the same line and column the deploy log
 * reported, and restoring it makes the error go away. Module resolution mode
 * is NOT the variable — node10, node16, nodenext and bundler all typecheck
 * clean while core is resolvable, and TypeScript 5.7 and 5.9 agree.
 *
 * `ReturnType<typeof createClient>` reaches the same type through the one
 * export that is unambiguously present, so it holds whether or not core
 * resolves — verified by running the full typecheck with core hidden. Do not
 * "tidy" this back to a named type import: it will pass here and break the
 * deploy, which is the worst of both.
 *
 * One honest caveat. When core is unresolvable, `createClient`'s return type
 * is itself unresolved, so this alias quietly degrades to `any` in that build.
 * That is a deliberate trade — it keeps the deployment working — and the type
 * safety that matters comes from `pnpm typecheck` and CI, where core resolves
 * and this is the real client type.
 */
import type { createClient } from '@libsql/client'

export type LibsqlClient = ReturnType<typeof createClient>
