/**
 * The "financial diary" (spec §3) — every note entered while updating balances,
 * newest first. Renders nothing when there's nothing to show, rather than an
 * empty card.
 */
import { monthYear } from '@/lib/format'

export type DiaryEntry = {
  id: string
  recordedAt: string
  year: number
  month: number
  note: string | null
  accountId: string
}

export function GrowthDiary({
  entries,
  accounts,
}: {
  entries: DiaryEntry[]
  accounts: { id: string; provider: string }[]
}) {
  const withNotes = entries
    .filter((e): e is DiaryEntry & { note: string } => Boolean(e.note))
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))

  if (withNotes.length === 0) return null

  return (
    <div className="rounded-3xl bg-card p-7 shadow-soft">
      <h2 className="text-[15px] font-semibold tracking-tight">Your diary</h2>
      <p className="mt-2 text-[13px] text-muted-foreground">
        Every note you've added while updating balances.
      </p>
      <div className="mt-5 space-y-4">
        {withNotes.map((entry) => (
          <div key={entry.id} className="border-l-2 border-border pl-4">
            <p className="text-[12px] text-muted-foreground">
              {monthYear(entry.year, entry.month)} ·{' '}
              {accounts.find((a) => a.id === entry.accountId)?.provider ?? 'Unknown account'}
            </p>
            <p className="mt-1 text-[14px] leading-relaxed text-foreground">{entry.note}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
