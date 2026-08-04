/**
 * The full plan history — every baseline, replan and checkpoint ever saved
 * for this household, newest first. Nothing here is ever deleted or
 * reordered ("the fork must stay visible, never disappear").
 */
import type { ForecastHistoryEntry } from '@/state/useCheckpoints'

const TYPE_LABEL: Record<ForecastHistoryEntry['type'], string> = {
  baseline: 'Original plan',
  replan: 'Replanned',
  checkpoint: 'Checkpoint',
}

export function CheckpointTimeline({ history }: { history: ForecastHistoryEntry[] }) {
  if (history.length === 0) return null
  const newestFirst = [...history].reverse()

  return (
    <section>
      <h2 className="text-[15px] font-semibold tracking-tight">Plan history</h2>
      <div className="mt-4 space-y-2">
        {newestFirst.map((entry) => (
          <div key={entry.id} className="rounded-2xl bg-card p-4 shadow-soft sm:p-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {TYPE_LABEL[entry.type]}
              </span>
              <span className="shrink-0 text-[12px] text-muted-foreground">
                {new Date(entry.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
            {entry.note ? (
              <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">“{entry.note}”</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
