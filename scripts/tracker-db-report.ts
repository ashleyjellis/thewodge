/**
 * Prints a markdown summary of what the tracker database currently holds.
 *
 * Used by the Database setup workflow to write into the GitHub run summary,
 * so the outcome of a migrate or seed is visible without reading logs — and
 * so a run that silently did nothing is obvious at a glance. Safe to run
 * locally too.
 */
import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { getTrackerDb, closeTrackerDb } from '../src/server/trackerDb/client'

const TABLES = [
  'providers',
  'portfolios',
  'readings',
  'flows',
  'fee_events',
  'holdings',
  'series_cache',
  'notes',
  'subscribers',
] as const

const db = getTrackerDb()

const lines = ['## Tracker state', '', '| Table | Rows |', '|---|---|']
for (const table of TABLES) {
  const rows = await db.all<{ n: number }>(sql.raw(`select count(*) as n from ${table}`))
  lines.push(`| ${table} | ${rows[0]?.n ?? 0} |`)
}

const portfolios = await db.all<{ provider: string; name: string; readings: number }>(
  sql.raw(`
    select p.name as provider, pf.name as name, count(r.id) as readings
    from portfolios pf
    join providers p on p.id = pf.provider_id
    left join readings r on r.portfolio_id = pf.id
    group by pf.id
    order by p.name, pf.name
  `),
)

if (portfolios.length > 0) {
  lines.push('', '### Portfolios', '', '| Provider | Portfolio | Readings |', '|---|---|---|')
  for (const p of portfolios) {
    lines.push(`| ${p.provider} | ${p.name} | ${p.readings} |`)
  }
}

console.log(lines.join('\n'))
await closeTrackerDb()
process.exit(0)
