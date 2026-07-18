# The Wodge

A calm, whole-picture financial-trajectory tool for the UK. Enter your pension,
investments and cash, and it carries them forward to 60 — showing the consequences
of your own numbers, not a verdict, and never a comparison to anyone else.

> The name lives in one place: `SITE_NAME` in `src/config.ts`.

## Four principles (they govern every decision)

1. **Consequences, not verdicts** — show what happens; never judge. No "on track" /
   "behind" language anywhere.
2. **Whole picture** — pension + stocks/shares + cash together, forecast forward.
3. **Calm over anxiety** — no comparison to averages or cohorts, no live-refresh
   numbers.
4. **Transparency** — every assumption is visible and sourced (see `/methodology`).

## Stack

TanStack Start on Vite · TypeScript `strict` · Tailwind v4 (locked semantic tokens)
· Vitest. The calculator is **stateless** — its inputs live in the URL search
params, so guide/doorway pages can deep-link with pre-filled values that survive
navigation to `/results`. No signup for v1.

## Run

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # forecast unit tests (Vitest)
pnpm typecheck  # tsc --noEmit, strict
pnpm build      # prerender + static SPA + sitemap/robots
```

## Routes

| Route | What it is |
|---|---|
| `/` | Landing — the calculator is the hero, then supporting sections |
| `/results` | Forecast from search params (age, pension, stocks, cash, monthly) |
| `/how-it-works` | Three-step explainer |
| `/methodology` | The maths — assumptions and their public sources, long form |
| `/about` | Why it exists |
| `/guides` · `/guides/$slug` | Doorway pages that deep-link into the calculator |
| `/privacy` · `/terms` | Legal |
| `/app` | Empty stub behind a placeholder auth boundary (snapshot ritual — later) |

## The forecast (`src/lib/forecast.ts`)

Pure, typed, unit-tested. Invested assets (pension + stocks/shares) grow at a
nominal `INVESTED_RATE` (7%); cash grows at a separate, lower `CASH_RATE` (2%) —
never the equity rate. Monthly contributions are added to the invested pot and
compounded monthly to `TARGET_AGE` (60). All three rates are constants in
`src/config.ts` and stated on `/methodology`. Nominal, not inflation-adjusted.

Results show: a whole-picture hero (today’s total → projected total), the
growth-vs-contribution split (navy = what you put in, light blue = what the market
adds), a four-row scenario table (stop / carry on / add £100 / add £500), and the
visible workings.

## Global chrome

`SiteHeader` (sticky, collapses to a menu on mobile), `SiteFooter` (link columns,
not-advice line, capture-only newsletter), and `MaxWidthContainer` (~1180px) wrap
every route via the root layout. Desktop uses the horizontal space in multiple
columns; the narrow single column only appears at mobile widths.

## SEO & deploy (Vercel, static)

- Indexable routes are **prerendered to static HTML** at build with real per-page
  `<title>`/meta/OG (`src/lib/seo.ts`). `/results` and `/app` are `noindex` and
  fall back to the SPA shell (client-rendered).
- `scripts/seo.mjs` generates `sitemap.xml` + `robots.txt` from the prerendered
  output; the default OG share image (`public/og-default.png`) is the growth-split
  card.
- `vercel.json` serves `dist/client` statically, `/api/*` as functions, and SPA-
  falls-back everything else. `api/subscribe.mjs` captures newsletter emails.
- Privacy-friendly analytics hook (Plausible-style) is wired via
  `VITE_ANALYTICS_DOMAIN` — off unless set.

## Design tokens

Page `#faf7f2` · cards `#ffffff` · primary/text/dark `#09153a` · accent/market
`#cbdcec` · muted a soft grey-navy. Sentence case, generous whitespace, soft
shadows only, no greens/oranges/reds. Semantic tokens only — no hardcoded hex in
components.
