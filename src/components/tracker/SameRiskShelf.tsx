/**
 * Every other tracked portfolio at the same risk level.
 *
 * The peer block above states an average and names nobody, which is honest
 * but leaves a reader who has just decided they want something else with
 * nowhere to go. This is the route off the page.
 *
 * ## Deliberately not a league table
 *
 * Sorted by return, because some order is needed and an arbitrary one wastes
 * the sort. But no row is numbered, no row is labelled best, and nothing is
 * highlighted — over a run this short the ordering is mostly the market
 * moving, not one manager outperforming another, and any decoration that
 * implied otherwise would be asserting something the data cannot support.
 *
 * The fall is shown beside the return for the same reason it leads the page:
 * a reader scanning for the biggest number should have the worst week in the
 * same glance.
 */
import { NavLink } from '@/components/NavLink'
import { formatBps, formatReturn } from '@/lib/tracker/money'
import type { Peer } from '@/lib/tracker/providerPage'

export type ShelfRow = Peer & {
  maxDrawdown?: number
  feeBps: number
}

export function SameRiskShelf({
  rows,
  riskLabel,
  feesDeducted,
}: {
  rows: ShelfRow[]
  riskLabel: string | null
  feesDeducted: boolean
}) {
  if (rows.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <p className="text-[15px] font-medium text-foreground">
          Nothing else is tracked at this risk level yet.
        </p>
        <p className="mt-2 max-w-[60ch] text-[14px] text-muted-foreground">
          Comparisons appear here as more accounts are opened. There is no point showing a
          shelf of one.
        </p>
      </div>
    )
  }

  const ordered = [...rows].sort((a, b) => b.returnFraction - a.returnFraction)

  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[560px] text-[13px]">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            <th className="px-4 py-3 font-medium">Provider and portfolio</th>
            <th className="px-4 py-3 text-right font-medium">
              Since inception{feesDeducted ? ', after fees' : ''}
            </th>
            <th className="px-4 py-3 text-right font-medium">Deepest fall</th>
            <th className="px-4 py-3 text-right font-medium">Platform fee</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((row) => (
            <tr key={`${row.providerSlug}/${row.slug}`} className="border-b border-border/40 last:border-0">
              <td className="px-4 py-3">
                {row.providerSlug && row.slug ? (
                  <NavLink
                    to={`/performance/p/${row.providerSlug}/${row.slug}`}
                    className="text-foreground underline underline-offset-2"
                  >
                    {row.label}
                  </NavLink>
                ) : (
                  row.label
                )}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatReturn(row.returnFraction)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                {row.maxDrawdown === undefined || row.maxDrawdown === 0
                  ? '—'
                  : formatReturn(row.maxDrawdown)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                {row.feeBps === 0 ? '—' : formatBps(row.feeBps)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {riskLabel ? (
        <p className="border-t border-border px-4 py-3 text-[12px] text-muted-foreground">
          All labelled {riskLabel} by their own provider.
        </p>
      ) : null}
    </div>
  )
}
