/**
 * Edit one year's contributions — opened by clicking a "Put in" cell in the
 * year-by-year table. Same field set as the top-of-page form (expected annual
 * income, each pot's monthly contribution, the expected additional contribution
 * and where it goes), because that's the one thing a single year's "put in"
 * figure can't show on its own: which of several inputs actually moved.
 *
 * Explicit save, not live — this is a considered exception for one year, not a
 * quick tweak. Applies to this year only; every other year keeps the baseline
 * from the form above, exactly like the table's rate overrides.
 *
 * Site-layer modal shell (same pattern as components/results/HookModal.tsx),
 * not the authenticated app's Modal — this page never imports from components/app.
 */
import { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { POT_KEYS, POT_LABELS, type PotKey } from '@/lib/wealthPlan'
import type { ContributionOverride, WealthPlanInput } from '@/lib/wealthPlan'
import { Field } from './WealthPlanForm'

type FieldState = {
  salary: string
  isaStocksMonthly: string
  isaCashMonthly: string
  cashSavingsMonthly: string
  bonus: string
  bonusTarget: PotKey
}

function toFieldState(
  input: WealthPlanInput,
  override: ContributionOverride | undefined,
): FieldState {
  return {
    salary: String(override?.salary ?? input.salary),
    isaStocksMonthly: String(override?.isaStocksMonthly ?? input.isaStocksMonthly),
    isaCashMonthly: String(override?.isaCashMonthly ?? input.isaCashMonthly),
    cashSavingsMonthly: String(override?.cashSavingsMonthly ?? input.cashSavingsMonthly),
    bonus: String(override?.bonus ?? input.bonus),
    bonusTarget: override?.bonusTarget ?? input.bonusTarget,
  }
}

function toOverrideValues(f: FieldState): Omit<ContributionOverride, 'year'> {
  const n = (x: string) => {
    const v = Number(x)
    return x.trim() !== '' && Number.isFinite(v) && v >= 0 ? v : undefined
  }
  return {
    salary: n(f.salary),
    isaStocksMonthly: n(f.isaStocksMonthly),
    isaCashMonthly: n(f.isaCashMonthly),
    cashSavingsMonthly: n(f.cashSavingsMonthly),
    bonus: n(f.bonus),
    bonusTarget: f.bonusTarget,
  }
}

export function ContributionModal({
  age,
  input,
  override,
  onSave,
  onClear,
  onClose,
}: {
  age: number
  input: WealthPlanInput
  override: ContributionOverride | undefined
  onSave: (values: Omit<ContributionOverride, 'year'>) => void
  onClear: () => void
  onClose: () => void
}) {
  const [f, setF] = useState<FieldState>(() => toFieldState(input, override))
  const set = (k: keyof Omit<FieldState, 'bonusTarget'>) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }))

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contribution-modal-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-card p-6 shadow-soft sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Age {age}
            </p>
            <h2
              id="contribution-modal-title"
              className="mt-1 text-[17px] font-semibold tracking-tight"
            >
              This year's contributions
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <X size={18} strokeWidth={2.25} />
          </button>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
          Applies to this year only — every other year keeps what's in the form
          above.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSave(toOverrideValues(f))
            onClose()
          }}
          className="mt-5 space-y-4"
        >
          <Field
            label="Expected annual income"
            prefix="£"
            value={f.salary}
            onChange={set('salary')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="ISA — stocks & shares"
              hint="monthly"
              prefix="£"
              value={f.isaStocksMonthly}
              onChange={set('isaStocksMonthly')}
            />
            <Field
              label="ISA — cash"
              hint="monthly"
              prefix="£"
              value={f.isaCashMonthly}
              onChange={set('isaCashMonthly')}
            />
            <Field
              label="Cash savings"
              hint="monthly"
              prefix="£"
              value={f.cashSavingsMonthly}
              onChange={set('cashSavingsMonthly')}
            />
            <Field
              label="Additional contribution"
              hint="e.g. a bonus"
              prefix="£"
              value={f.bonus}
              onChange={set('bonus')}
            />
          </div>

          <div>
            <span className="text-[12.5px] font-medium leading-snug text-foreground">
              Add it to
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {POT_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setF((p) => ({ ...p, bonusTarget: key }))}
                  className={cn(
                    'rounded-full px-3.5 py-2 text-[12.5px] font-medium transition-colors',
                    f.bonusTarget === key
                      ? 'bg-foreground text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground',
                  )}
                >
                  {POT_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-foreground px-6 py-3.5 text-center text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-95"
          >
            Save for this year
          </button>
          {override ? (
            <button
              type="button"
              onClick={() => {
                onClear()
                onClose()
              }}
              className="w-full text-center text-[12.5px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Reset to the plan above
            </button>
          ) : null}
        </form>
      </div>
    </div>
  )
}
