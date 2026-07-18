# The Wodge

A wealth-clarity engine for affluent professionals who feel rich on paper but
anxious in reality. It shows a household where they’re heading, when the market
takes over from their contributions, and what they’re realistically free to do.

> **This is a modelling tool, not financial advice. We show you maths on your own
> numbers — we don’t tell you what to do.** No recommendations, no product names,
> no “you should”. Everything it teaches (SWR, ISA/pension mechanics, the £100k
> trap, benchmarks) is publicly derivable and sourced.

## Stack

TanStack Start (full-stack React on Vite) · TypeScript `strict` · Tailwind v4 with
locked semantic tokens · hand-rolled SVG charts · Vitest · Drizzle + libSQL (Turso)
for the server storage option.

## Run

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # calc engine + store contract (Vitest)
pnpm typecheck  # tsc --noEmit, strict
pnpm build      # client + SSR
```

## Deploy (Vercel)

v1 ships as a **static SPA** (TanStack Start SPA mode) plus one native serverless
function for email — the reliable shape for static hosts, and enough because
financials are local-first so no server is needed at runtime.

- `pnpm build` prerenders a hydratable shell to `dist/client/_shell.html` and the
  post-build step copies it to `index.html`.
- `vercel.json` sets `outputDirectory: dist/client`, runs `pnpm build`, serves
  `/api/*` as functions, and falls back all other routes to `index.html` (client
  routing) — this is the fix for the “404: NOT_FOUND” you get when a host serves
  the SSR output folder as a plain static site.
- `api/capture-email.mjs` keeps the email list server-side; financial data never
  leaves the device.

To restore full SSR (doorway-page SEO, §11), deploy the server build
(`dist/server/server.js`) to a Node host instead of static hosting.

## Architecture — three rings, dependencies point inward only

1. **Calc engine** — `src/lib/calc/*`. Pure TypeScript: zero framework, zero IO,
   zero storage imports. This is the product. Fully unit-tested in isolation
   against the source-conversation numbers (`pnpm test`).
2. **Storage** — `src/lib/store/*` behind the `SnapshotStore` interface. The only
   thing that touches persistence. Financial data never reaches the engine or UI
   through any other path. See [`src/lib/store/README.md`](src/lib/store/README.md).
3. **UI / routing** — `src/routes/*`, `src/components/*`, `src/state/*`.
   Presentation only: reads the store, calls the engine, renders.

Any import crossing these rings the wrong way (UI reaching into a DB client, calc
importing storage) is a review-blocking bug.

## The five-screen arc

`where am I → am I doing well → what’s the machine doing → what does the future
look like → what am I free to do`. Every screen maps to a step; the value is the
permission at the end, not the big number.

- `/` — landing hook (age + total invested → benchmark + free-money read-out).
- `/signup` — email capture wall (email server-side; financials never sent).
- `/app/where-am-i` · `on-track` · `the-machine` · `the-future` · `what-am-i-free`.
- `/app/track` — baseline / actuals / deliberate replan (the retention loop).

## The calc engine (all real-terms, all pure)

FI number · Coast FI (per pot/person/combined) · year-by-year projection ·
contribution-vs-market-growth split · crossover year · stop-at-X · lifetime value
of £1 · deployed-vs-generated · earliest-retirement · bridge check · plus the £100k
personal-allowance trap and employer-match education helpers. Every function is
surfaced with a “how we worked this out” drawer.

> The spec’s worked example quotes Coast FI ≈ £432k for 24 years at 7%; that figure
> is actually the 6% discount (`£1.75m / 1.06^24`). The formula is the source of
> truth — the tests pin both cases (`src/lib/calc/fi.test.ts`).

## Storage & privacy

- **v1 is local-first**: household financials + snapshots live in the browser
  (`localStorage`) behind `SnapshotStore`. Only the email goes server-side.
- **Promotable to Turso** without touching the engine or UI — swap the store in
  `src/lib/store/index.ts` for `TursoSnapshotStore` (Drizzle schema + encryption at
  rest already written in `src/lib/server/*`). See the store README.
- No financial data in URLs, query strings, logs, or third-party analytics.

## Brand

The brand guide is locked (see the project spec). Navy = “you”, accent (light blue)
= “market/world” — never swapped. Semantic tokens only, no hardcoded hex in
components. One `shadow-soft`. Calm over engagement: no verdicts, no urgency, no
gamification, no reds/greens for ahead/behind.
