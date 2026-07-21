/**
 * One account's update history — spec §3's "per account: start balance,
 * contributions in period, market growth in period, end balance," as a calm
 * StatRow list rather than a dense grid. Periods are pre-computed by the caller
 * (raw snapshots for "monthly", rollupSnapshotsByYear() output for "annual").
 * put-in/grew is always computed from the account's contribution rate, never
 * user-entered (see UpdateBalances) — not flagged as "estimated" here, since
 * that's simply how this figure works now, not a stand-in pending confirmation.
 */
import { periodGrowth, type SnapshotLike } from '@/lib/snapshotMath'
import { money } from '@/lib/format'
import { dotClass } from '@/components/viz'
import { StatRow } from '@/components/StatRow'

const POT_TONE = { pension: 'you', investments: 'market', cash: 'cash' } as const

export type HistoryPeriod = SnapshotLike & { label: string }

function periodSub(period: HistoryPeriod): string {
  const g = periodGrowth(period)
  const putIn = period.moneyIn !== null ? money(period.moneyIn) : 'unknown'
  const grew = g.growth !== null ? money(g.growth) : 'not available'
  return `put in ${putIn} · grew ${grew}`
}

export function AccountHistoryCard({
  provider,
  potCategory,
  periods,
}: {
  provider: string
  potCategory: 'pension' | 'investments' | 'cash'
  periods: HistoryPeriod[]
}) {
  const ordered = [...periods].sort((a, b) =>
    a.year !== b.year ? b.year - a.year : b.month - a.month,
  )

  return (
    <div className="rounded-3xl bg-card p-5 shadow-soft sm:p-6">
      <div className="flex items-baseline gap-2.5">
        <span
          className={`h-2.5 w-2.5 shrink-0 translate-y-[3px] rounded-full ${dotClass[POT_TONE[potCategory]]}`}
        />
        <h3 className="text-[14px] font-semibold text-foreground">{provider}</h3>
      </div>
      <div className="mt-3 space-y-3">
        {ordered.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No updates recorded yet.</p>
        ) : (
          ordered.map((period, i) => (
            <StatRow
              key={`${period.year}-${period.month}-${i}`}
              tone={POT_TONE[potCategory]}
              label={period.label}
              value={money(period.endBalance)}
              sub={periodSub(period)}
            />
          ))
        )}
      </div>
    </div>
  )
}
