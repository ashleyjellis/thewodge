/**
 * The shared "preview before you commit" step for every typed life-event
 * compiler (maternityLeave.ts now; houseMove.ts/newChild.ts next; the diary
 * parser later) — built once, reused by all of them. Deliberately dumb: it
 * has no idea which compiler produced the plan it's showing, just renders
 * the draft contribution_changes/planned_events rows and defers the actual
 * save to whichever form called it, since that form is the one that already
 * holds onAddContributionChange/onAddPlannedEvent.
 */
import { useState } from 'react'
import { ownerLabel } from '@/lib/accountOwner'
import type { PotCategory } from '@/lib/householdForecast'
import type { LifeEventPlan } from '@/lib/lifeEvents/types'
import { money } from '@/lib/format'

const POT_LABELS: Record<PotCategory, string> = {
  pension: 'Pension',
  investments: 'Investments',
  cash: 'Cash savings',
}

export function PlanUpdatePreview({
  plan,
  people,
  onConfirm,
  onBack,
}: {
  plan: LifeEventPlan
  people: { id: string; name: string }[]
  onConfirm: () => Promise<void>
  onBack: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to save')
      setSaving(false)
    }
  }

  return (
    <div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">{plan.summary}</p>

      <div className="mt-4 space-y-2">
        {plan.contributionChanges.map((c, i) => (
          <div key={`cc-${i}`} className="rounded-2xl bg-muted/60 p-4">
            <p className="text-[13px] font-semibold">
              {ownerLabel(c.owner, people)} · {POT_LABELS[c.potCategory]}
            </p>
            <p className="mt-1 text-[13px] tabular-nums text-muted-foreground">
              From {c.effectiveYear}: {money(c.value)}/mo
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">{c.note}</p>
          </div>
        ))}
        {plan.plannedEvents.map((e, i) => (
          <div key={`pe-${i}`} className="rounded-2xl bg-muted/60 p-4">
            <p className="text-[13px] font-semibold">
              {e.name} — {ownerLabel(e.owner, people)} · {POT_LABELS[e.potCategory]}
            </p>
            <p className="mt-1 text-[13px] tabular-nums text-muted-foreground">
              {e.year}: {money(e.amount)}
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">{e.note}</p>
          </div>
        ))}
      </div>

      {error ? <p className="mt-3 text-[13px] text-muted-foreground">{error}</p> : null}

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className="rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Confirm'}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-full px-5 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Back
        </button>
      </div>
    </div>
  )
}
