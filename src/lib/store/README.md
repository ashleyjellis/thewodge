# Storage (ring 2)

Everything that touches persistence lives behind the `SnapshotStore` interface
(`SnapshotStore.ts`). The calc engine and the UI never import a storage client
directly — that boundary is what makes the local ⇄ server swap a change of
implementation rather than a rewrite (spec §8, §11).

## Invariants

- **Snapshots are append-only and immutable.** The interface exposes no `update`
  or `delete` for snapshots. `makeSnapshot` deep-copies the `Household` state so a
  later edit to the working draft can never mutate a stored snapshot.
- **The baseline is a pointer, not a mutation.** `setBaselineId` moves the
  plan-of-record deliberately (a "replan"). Adding actuals never moves it.
- **No financial data leaves the device in v1.** Only the email is sent
  server-side (`server/emailList.ts`) — the list is the asset.

## Implementations

| Store | File | Holds | Status |
|---|---|---|---|
| `MemorySnapshotStore` | `memoryStore.ts` | RAM | tests / SSR fallback |
| `LocalSnapshotStore` | `localStore.ts` | `localStorage` (client) | **v1 default** |
| `TursoSnapshotStore` | `../server/tursoStore.ts` | Turso/libSQL | server option, not wired in v1 |

All three satisfy one shared contract (`contract.ts`), so they are provably
interchangeable. `store.test.ts` runs the contract against the two local stores;
add the Turso store as a third target once a test database is provisioned.

## Promoting to server-side

1. Provision a Turso database, primary in an EU region, with encryption at rest.
2. Set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `TURSO_ENCRYPTION_KEY` (server env
   only — never shipped to the client).
3. `pnpm drizzle-kit generate && pnpm drizzle-kit migrate` (schema in
   `../server/schema.ts`).
4. Swap the store the app constructs (see `store/index.ts`) from `createLocalStore()`
   to a `TursoSnapshotStore` scoped to the authenticated user.

Nothing in `lib/calc/*` or the components changes.
