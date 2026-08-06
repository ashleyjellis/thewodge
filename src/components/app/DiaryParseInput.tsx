/**
 * "Tell it what's changing" — free text in, parsed via diaryParser.ts's
 * deterministic keyword parser. A match jumps straight to
 * PlanUpdatePreview (Back backs out to the plain picker, never re-guesses);
 * no match opens the plain picker directly — always a real path forward,
 * never a silent failure. Reuses LifeEventPicker/AddPlannedEventModal
 * unchanged for both the picker and its own "something else" escape hatch.
 */
import { useState } from 'react'
import type { AccountOwner } from '@/lib/accountOwner'
import type { PotCategory } from '@/lib/householdForecast'
import type { OwnerScopedContributionChange, ScheduledPlanAccount } from '@/lib/scheduledPlan'
import { parseDiaryEntry } from '@/lib/diaryParser'
import type { LifeEventKind, LifeEventPlan } from '@/lib/lifeEvents/types'
import { Modal } from './Modal'
import { PlanUpdatePreview } from './PlanUpdatePreview'
import { LifeEventPicker } from './LifeEventPicker'
import { AddPlannedEventModal } from './AddPlannedEventModal'

const KIND_TITLE: Record<LifeEventKind, string> = {
  maternity_paternity_leave: 'Confirm maternity/paternity leave',
  house_move: 'Confirm house move',
  new_child: 'Confirm new child',
}

type Step = { kind: 'idle' } | { kind: 'preview'; eventKind: LifeEventKind; plan: LifeEventPlan } | { kind: 'picker' } | { kind: 'fallback' }

export function DiaryParseInput({
  people,
  accounts,
  contributionChanges,
  onAddContributionChange,
  onAddPlannedEvent,
}: {
  people: { id: string; name: string; salary: number | null }[]
  accounts: ScheduledPlanAccount[]
  contributionChanges: OwnerScopedContributionChange[]
  onAddContributionChange: (input: {
    owner: AccountOwner
    potCategory: PotCategory
    effectiveYear: number
    changeType: 'set' | 'grow_pct' | 'annual_bonus'
    value: number
    note?: string
  }) => Promise<void>
  onAddPlannedEvent: (input: {
    owner: AccountOwner
    potCategory: PotCategory
    year: number
    name: string
    amount: number
    note?: string
  }) => Promise<void>
}) {
  const [text, setText] = useState('')
  const [step, setStep] = useState<Step>({ kind: 'idle' })

  const currentYear = new Date().getUTCFullYear()
  const years = Array.from({ length: 11 }, (_, i) => currentYear + i)

  const submit = () => {
    const result = parseDiaryEntry({ text, people, accounts, contributionChanges })
    setStep(result.matched ? { kind: 'preview', eventKind: result.kind, plan: result.plan } : { kind: 'picker' })
  }

  const closeAll = () => {
    setStep({ kind: 'idle' })
    setText('')
  }

  return (
    <section>
      <h2 className="text-[15px] font-semibold tracking-tight">Tell it what's changing</h2>
      <p className="mt-2 text-[13px] text-muted-foreground">
        A sentence, in your own words — it'll try to work out what to add, and always shows you
        exactly what before saving anything.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Sam's going on maternity leave in 2027, back at work 2028"
        rows={2}
        className="mt-3 w-full resize-none rounded-2xl bg-muted px-4 py-3 text-[14px] text-foreground outline-none ring-1 ring-transparent transition placeholder:text-muted-foreground/50 focus:bg-card focus:ring-foreground/25"
      />
      <button
        type="button"
        disabled={!text.trim()}
        onClick={submit}
        className="mt-3 rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-40"
      >
        Work it out
      </button>

      {step.kind === 'preview' ? (
        <Modal title={KIND_TITLE[step.eventKind]} onClose={closeAll}>
          <PlanUpdatePreview
            plan={step.plan}
            people={people}
            onBack={() => setStep({ kind: 'picker' })}
            onConfirm={async () => {
              for (const change of step.plan.contributionChanges) {
                await onAddContributionChange({ ...change })
              }
              for (const event of step.plan.plannedEvents) {
                await onAddPlannedEvent({ ...event })
              }
              closeAll()
            }}
          />
        </Modal>
      ) : null}

      {step.kind === 'picker' ? (
        <LifeEventPicker
          people={people}
          accounts={accounts}
          contributionChanges={contributionChanges}
          years={years}
          defaultYear={currentYear}
          defaultOwner="joint"
          onAddContributionChange={onAddContributionChange}
          onAddPlannedEvent={onAddPlannedEvent}
          onSomethingElse={() => setStep({ kind: 'fallback' })}
          onClose={closeAll}
        />
      ) : null}

      {step.kind === 'fallback' ? (
        <AddPlannedEventModal
          people={people}
          years={years}
          defaultOwner="joint"
          defaultPotCategory="investments"
          defaultYear={currentYear}
          onSave={onAddPlannedEvent}
          onClose={closeAll}
        />
      ) : null}
    </section>
  )
}
