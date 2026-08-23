/**
 * What the portfolio holds, and what moved since last month.
 *
 * The diff leads. A current allocation is available from the provider; a
 * month-on-month comparison is not, because it requires having written down
 * what it was before — which is the whole reason this data is collected by
 * hand every month.
 *
 * With one snapshot there is nothing to compare, and the block says so
 * plainly rather than inventing a previous month or padding the space.
 */
import {
  describeDiff,
  diffSnapshots,
  formatWeight,
  snapshotsByDate,
  type Holding,
} from '@/lib/tracker/holdings'

function AllocationBars({ slices }: { slices: { key: string; weightBps: number }[] }) {
  return (
    <div className="space-y-2">
      {slices.map((slice) => (
        <div key={slice.key} className="grid grid-cols-[minmax(90px,140px)_1fr_56px] items-center gap-3">
          <span className="truncate text-[13px] capitalize text-muted-foreground">{slice.key}</span>
          <span className="block h-2.5 overflow-hidden rounded-sm bg-muted">
            <span
              className="block h-full bg-foreground/70"
              style={{ width: `${Math.min(100, slice.weightBps / 100)}%` }}
            />
          </span>
          <span className="text-right text-[13px] tabular-nums text-foreground">
            {formatWeight(slice.weightBps)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function AllocationBlock({ holdings }: { holdings: Holding[] }) {
  const snapshots = snapshotsByDate(holdings)
  const current = snapshots[0]
  const previous = snapshots[1]

  if (!current) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <p className="text-[15px] font-medium text-foreground">
          Nothing recorded about what this one holds yet.
        </p>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-muted-foreground">
          Holdings are read off the provider's own breakdown once a month and written down by
          hand. When the first month is recorded it appears here, and the month after that this
          section starts showing what changed.
        </p>
      </div>
    )
  }

  const diff = previous ? diffSnapshots(previous, current) : null
  const sentences = diff ? describeDiff(diff) : []

  return (
    <div className="mt-6 space-y-6">
      {/* The diff first — it is the part nobody else publishes. */}
      {diff === null ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[14px] text-muted-foreground">
            One month recorded so far, on {current.asOfDate}. The comparison — what moved, what
            was bought and sold — appears here next month, once there is a previous month to
            compare against.
          </p>
        </div>
      ) : diff.isQuiet ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[14px] text-muted-foreground">
            Nothing moved by more than a rounding between {diff.fromDate} and {diff.toDate}. No
            holdings were bought or sold.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-foreground/25 bg-card p-6">
          <p className="text-[12px] font-medium uppercase tracking-[0.09em] text-muted-foreground">
            Changed since {diff.fromDate}
          </p>
          <ul className="mt-3 space-y-1.5">
            {sentences.map((sentence) => (
              <li key={sentence} className="text-[16px] leading-snug text-foreground">
                {sentence}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.09em] text-muted-foreground">
            By asset class
          </p>
          <div className="mt-3">
            <AllocationBars slices={current.byAssetClass} />
          </div>
        </div>
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.09em] text-muted-foreground">
            By region
          </p>
          <div className="mt-3">
            <AllocationBars slices={current.byRegion} />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[480px] text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              <th className="px-4 py-3 font-medium">Holding</th>
              <th className="px-4 py-3 font-medium">Asset class</th>
              <th className="px-4 py-3 font-medium">Region</th>
              <th className="px-4 py-3 text-right font-medium">Weight</th>
            </tr>
          </thead>
          <tbody>
            {current.holdings.map((holding) => (
              <tr key={holding.instrumentName} className="border-b border-border/40 last:border-0">
                <td className="px-4 py-2.5">{holding.instrumentName}</td>
                <td className="px-4 py-2.5 capitalize text-muted-foreground">
                  {holding.assetClass}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{holding.region ?? '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatWeight(holding.weightBps)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-border px-4 py-3 text-[12px] text-muted-foreground">
          As at {current.asOfDate}
          {current.totalWeightBps !== 10_000
            ? ` · weights total ${formatWeight(current.totalWeightBps)}, as published`
            : ''}
        </p>
      </div>
    </div>
  )
}
