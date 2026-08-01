/**
 * The wealth planning tool's data-capture form: a list of everyone in the
 * plan ("You" first, always present), whoever is selected editable directly
 * below it. Selecting a person collapses whoever was open back to a summary
 * card — the page stays out of the way of the results once someone's numbers
 * are in. One person at a time, one field set for everyone (age, salary,
 * pension, both ISAs, cash savings, bonus) — see PersonFieldsPanel.
 *
 * Always a single stacked column here, deliberately — this form shares the
 * hero row with the page's intro copy (see the route), and MaxWidthContainer
 * caps the page at 1180px, so its own share of that split has a hard ceiling
 * of roughly 500px no matter how wide the viewport gets. There's never
 * enough room for a second internal column, so it doesn't try. The field
 * grids inside PersonFieldsPanel/Section do still respond to their own
 * available width (container queries — @container/@sm/@lg — not viewport
 * ones), since that genuinely varies: a single-column stack here vs. the
 * quick-edit modal's own fixed width.
 *
 * Every save is explicit, not live-as-you-type, and nothing is saved or sent
 * — matches how the rest of the site's calculators work.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Person } from '@/lib/household'
import { MAX_PEOPLE } from '@/lib/wealthPlanSearch'
import { rateToPct } from '@/lib/wealthPlanSearch'
import { CASH_RATE, INVESTED_RATE } from '@/config'
import { money, percent } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PersonFieldsPanel } from './PersonFieldsPanel'

const DEFAULT_INVESTED_PCT = rateToPct(INVESTED_RATE)
const DEFAULT_CASH_PCT = rateToPct(CASH_RATE)

export function WealthPlanForm({
  people,
  activePersonId,
  onSelectPerson,
  onSavePerson,
  onAddPerson,
  onRemovePerson,
  ready,
  investedRatePct,
  cashRatePct,
  onSaveAssumptions,
  className,
}: {
  /** "You" first, always present */
  people: Person[]
  /** whose fields are open on the right; 'new' = the add-a-person flow; null = nobody, just the list */
  activePersonId: string | 'new' | null
  onSelectPerson: (id: string | 'new' | null) => void
  onSavePerson: (id: string, fields: Omit<Person, 'id'>) => void
  onAddPerson: (fields: Omit<Person, 'id'>) => void
  onRemovePerson: (id: string) => void
  /** whether there's enough of "You" to show results — changes the primary save label */
  ready: boolean
  investedRatePct?: number
  cashRatePct?: number
  onSaveAssumptions: (investedRatePct: number | undefined, cashRatePct: number | undefined) => void
  className?: string
}) {
  const you = people[0]!
  const activePerson =
    activePersonId && activePersonId !== 'new' ? people.find((p) => p.id === activePersonId) : undefined
  const isAdding = activePersonId === 'new'
  const isPrimary = activePerson?.id === you.id

  return (
    <div className={cn('@container rounded-3xl bg-card p-5 shadow-soft sm:p-6', className)}>
      <div className="space-y-6">
        <div className="space-y-2.5">
          {people.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              active={p.id === activePersonId}
              onClick={() => onSelectPerson(p.id === activePersonId ? null : p.id)}
            />
          ))}
          {people.length < MAX_PEOPLE ? (
            <AddPersonTile
              active={isAdding}
              onClick={() => onSelectPerson(isAdding ? null : 'new')}
            />
          ) : (
            <p className="px-1 text-[12px] text-muted-foreground">
              Up to {MAX_PEOPLE} people at once.
            </p>
          )}
        </div>

        <div>
          {activePerson || isAdding ? (
            <PersonFieldsPanel
              key={activePersonId}
              person={activePerson}
              fallbackName={isPrimary ? 'You' : isAdding ? `Person ${people.length + 1}` : 'Person'}
              saveLabel={
                isPrimary ? (ready ? 'Save changes' : 'See your plan') : activePerson ? 'Save changes' : 'Add to plan'
              }
              canRemove={!!activePerson && !isPrimary}
              removeLabel={`Remove ${activePerson?.name ?? 'them'} from this plan`}
              onSave={(fields) => {
                if (activePerson) onSavePerson(activePerson.id, fields)
                else onAddPerson(fields)
              }}
              onRemove={() => activePerson && onRemovePerson(activePerson.id)}
              onCancel={() => onSelectPerson(null)}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-5 py-4 text-[13px] text-muted-foreground">
              Select someone on the left to see or edit their numbers.
            </div>
          )}
        </div>
      </div>

      <AssumptionsSection
        investedRatePct={investedRatePct}
        cashRatePct={cashRatePct}
        onSave={onSaveAssumptions}
      />
    </div>
  )
}

function PersonRow({
  person,
  active,
  onClick,
}: {
  person: Person
  active: boolean
  onClick: () => void
}) {
  const details: string[] = []
  if (person.salary > 0) details.push(`Salary ${money(person.salary)}`)
  if (person.pensionPct > 0) details.push(`${percent(person.pensionPct, 0)} pension`)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={cn(
        'flex w-full items-start justify-between gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors',
        active ? 'bg-foreground' : 'bg-muted hover:bg-muted/70',
      )}
    >
      <div className="min-w-0">
        <p className={cn('text-[14px] font-semibold', active ? 'text-primary-foreground' : 'text-foreground')}>
          {person.name}
        </p>
        <p className={cn('mt-0.5 text-[12.5px]', active ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
          Age {person.age} · retiring at {person.targetAge}
        </p>
        {details.length > 0 ? (
          <p className={cn('mt-1.5 text-[12px]', active ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
            {details.join(' · ')}
          </p>
        ) : null}
      </div>
      <ChevronDown
        size={16}
        strokeWidth={2.25}
        className={cn(
          'mt-0.5 shrink-0 transition-transform',
          active ? 'rotate-180 text-primary-foreground' : 'text-muted-foreground',
        )}
      />
    </button>
  )
}

function AddPersonTile({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border border-dashed px-4 py-3.5 text-left transition-colors',
        active
          ? 'border-foreground/40 text-foreground'
          : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-current text-[15px] leading-none">
        +
      </span>
      <span>
        <span className="block text-[13.5px] font-semibold leading-tight text-foreground">
          Add a person
        </span>
        <span className="block text-[12px]">Plan for your household together</span>
      </span>
    </button>
  )
}

function AssumptionsSection({
  investedRatePct,
  cashRatePct,
  onSave,
}: {
  investedRatePct?: number
  cashRatePct?: number
  onSave: (investedRatePct: number | undefined, cashRatePct: number | undefined) => void
}) {
  const [invested, setInvested] = useState(() => String(investedRatePct ?? ''))
  const [cash, setCash] = useState(() => String(cashRatePct ?? ''))
  const n = (x: string) => {
    const v = Number(x)
    return x.trim() !== '' && Number.isFinite(v) && v >= 0 ? v : undefined
  }

  return (
    <details className="mt-6 border-t border-border/60 pt-5">
      <summary className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Assumptions
          <span className="ml-1.5 normal-case font-normal text-muted-foreground/70">
            {invested || DEFAULT_INVESTED_PCT}% investments · {cash || DEFAULT_CASH_PCT}% cash — yours to
            change
          </span>
        </p>
        <ChevronDown
          size={16}
          strokeWidth={2.25}
          className="drawer-chevron shrink-0 text-muted-foreground"
        />
      </summary>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSave(n(invested), n(cash))
        }}
        className="mt-3"
      >
        <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2">
          <Field
            label="Investment growth rate"
            hint="pension & ISA stocks and shares, per year"
            suffix="%"
            value={invested}
            onChange={setInvested}
            placeholder={String(DEFAULT_INVESTED_PCT)}
          />
          <Field
            label="Cash growth rate"
            hint="ISA cash & cash savings, per year"
            suffix="%"
            value={cash}
            onChange={setCash}
            placeholder={String(DEFAULT_CASH_PCT)}
          />
        </div>
        <button
          type="submit"
          className="mt-3 rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-95"
        >
          Save assumptions
        </button>
      </form>
    </details>
  )
}

/** Shared with PersonFieldsPanel, which builds the same section-grouped
 *  layout for a person's own numbers. */
export function Section({
  title,
  hint,
  cols = 2,
  children,
}: {
  title: string
  hint?: ReactNode
  cols?: 1 | 2 | 3
  children: ReactNode
}) {
  return (
    <div className="border-t border-border/60 pt-5 first:border-t-0 first:pt-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {title}
        {hint ? (
          <span className="ml-1.5 normal-case font-normal text-muted-foreground/70">{hint}</span>
        ) : null}
      </p>
      <div
        className={cn(
          'mt-3 grid grid-cols-1 gap-3',
          cols >= 2 && '@sm:grid-cols-2',
          cols === 3 && '@lg:grid-cols-3',
        )}
      >
        {children}
      </div>
    </div>
  )
}

/** Shared with ContributionModal and PersonFieldsPanel, which ask for the
 *  same shape of numbers. */
export function Field({
  label,
  hint,
  prefix,
  suffix,
  value,
  onChange,
  placeholder,
  inputMode = 'decimal',
  className,
}: {
  label: string
  hint?: string
  prefix?: string
  suffix?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputMode?: 'numeric' | 'decimal'
  className?: string
}) {
  // strip commas so "120,000" pastes cleanly
  const handle = (raw: string) => onChange(raw.replace(/,/g, ''))
  return (
    // justify-end (not a fixed top margin) so a taller neighbour's wrapped
    // hint pushes this label down rather than leaving the input boxes across
    // a row at different heights
    <label className={cn('flex h-full flex-col justify-end', className)}>
      <span className="text-[12.5px] font-medium leading-snug text-foreground">
        {label}
        {hint ? (
          <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span>
        ) : null}
      </span>
      <span className="mt-2 flex items-center gap-1 rounded-xl bg-muted px-3.5 py-2.5 ring-1 ring-transparent transition focus-within:bg-card focus-within:ring-foreground/25">
        {prefix ? (
          <span className="text-[15px] font-semibold text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <input
          type="text"
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          onChange={(e) => handle(e.target.value)}
          className="w-full bg-transparent text-[15px] font-semibold tabular-nums tracking-tight text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/50"
        />
        {suffix ? (
          <span className="text-[15px] font-semibold text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </span>
    </label>
  )
}
