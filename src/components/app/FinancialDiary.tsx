/**
 * The merged financial diary (spec: rendering unification) — every note
 * from balance updates, contribution/event changes, and checkpoint labels,
 * newest first, in one chronological log. Kept separate from
 * GrowthDiary.tsx, which stays untouched and keeps serving /app's Growth
 * tab with its own narrower, balance-update-only scope. Renders nothing
 * when there's nothing to show, same convention as GrowthDiary.tsx.
 */
import { ownerLabel } from '@/lib/accountOwner'
import type { PotCategory } from '@/lib/householdForecast'
import type { DiaryEntry } from '@/lib/diary'

const POT_LABELS: Record<PotCategory, string> = {
  pension: 'Pension',
  investments: 'Investments',
  cash: 'Cash savings',
}

const KIND_LABEL: Record<DiaryEntry['kind'], string> = {
  balance_update: 'Balance update',
  contribution_change: 'Contribution change',
  planned_event: 'Planned event',
  checkpoint: 'Checkpoint',
}

function entryContext(
  entry: DiaryEntry,
  accounts: { id: string; provider: string }[],
  people: { id: string; name: string }[],
): string | null {
  if (entry.kind === 'balance_update') {
    return accounts.find((a) => a.id === entry.accountId)?.provider ?? null
  }
  if (entry.kind === 'contribution_change') {
    return `${ownerLabel(entry.owner, people)} · ${POT_LABELS[entry.potCategory]}`
  }
  if (entry.kind === 'planned_event') return entry.name
  return null
}

export function FinancialDiary({
  entries,
  accounts,
  people,
}: {
  entries: DiaryEntry[]
  accounts: { id: string; provider: string }[]
  people: { id: string; name: string }[]
}) {
  if (entries.length === 0) return null

  return (
    <section>
      <h2 className="text-[15px] font-semibold tracking-tight">Your diary</h2>
      <p className="mt-2 text-[13px] text-muted-foreground">
        Every note you've added — balance updates, plan changes, checkpoints — in one place.
      </p>
      <div className="mt-5 space-y-4">
        {entries.map((entry) => {
          const context = entryContext(entry, accounts, people)
          return (
            <div key={entry.id} className="border-l-2 border-border pl-4">
              <p className="text-[12px] text-muted-foreground">
                {new Date(entry.at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}{' '}
                · {KIND_LABEL[entry.kind]}
                {context ? ` · ${context}` : ''}
              </p>
              <p className="mt-1 text-[14px] leading-relaxed text-foreground">{entry.note}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
