/**
 * Assumptions panel (spec §6) — always reachable, every default listed and
 * editable. Changing one recalculates everything live: it writes to the household
 * context, which re-runs the pure engine and re-renders every screen. Letting
 * people break your assumptions is the most trust-building thing the product does.
 */
import { useHousehold } from '@/state/household'
import { DEFAULT_ASSUMPTIONS } from '@/lib/calc/types'
import { percent } from '@/lib/format'
import { Card, SectionHeading } from './brand'

function AssumptionField({
  label,
  value,
  defaultValue,
  onChange,
  hint,
}: {
  label: string
  value: number
  defaultValue: number
  onChange: (fraction: number) => void
  hint: string
}) {
  const shown = Number((value * 100).toFixed(2))
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="text-[13px] text-foreground">{label}</div>
        <div className="text-[11px] text-muted-foreground">
          {hint} · default {percent(defaultValue)}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          step={0.1}
          value={shown}
          onChange={(e) => {
            const next = parseFloat(e.target.value)
            if (!Number.isNaN(next)) onChange(next / 100)
          }}
          aria-label={label}
          className="w-16 rounded-xl bg-muted px-3 py-2 text-right text-[15px] font-semibold tabular-nums tracking-tight text-foreground outline-none focus:bg-accent/60"
        />
        <span className="text-[13px] text-muted-foreground">%</span>
      </div>
    </div>
  )
}

export function AssumptionsPanel() {
  const { household, updateAssumptions, setHousehold } = useHousehold()
  const a = household.assumptions

  const isDefault =
    a.realReturn === DEFAULT_ASSUMPTIONS.realReturn &&
    a.cashReturn === DEFAULT_ASSUMPTIONS.cashReturn &&
    a.swr === DEFAULT_ASSUMPTIONS.swr

  return (
    <Card className="scroll-mt-6" >
      <div id="assumptions" className="flex items-baseline justify-between">
        <SectionHeading>Assumptions</SectionHeading>
        {!isDefault ? (
          <button
            type="button"
            onClick={() =>
              setHousehold({
                ...household,
                assumptions: { ...DEFAULT_ASSUMPTIONS },
              })
            }
            className="text-[12px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            reset to defaults
          </button>
        ) : null}
      </div>

      <div className="mt-3 divide-y divide-border">
        <AssumptionField
          label="Investment return"
          hint="pension & stocks, real terms"
          value={a.realReturn}
          defaultValue={DEFAULT_ASSUMPTIONS.realReturn}
          onChange={(v) => updateAssumptions({ realReturn: v })}
        />
        <AssumptionField
          label="Cash return"
          hint="cash & cash ISA, real terms"
          value={a.cashReturn}
          defaultValue={DEFAULT_ASSUMPTIONS.cashReturn}
          onChange={(v) => updateAssumptions({ cashReturn: v })}
        />
        <AssumptionField
          label="Safe withdrawal rate"
          hint="what you draw each year"
          value={a.swr}
          defaultValue={DEFAULT_ASSUMPTIONS.swr}
          onChange={(v) => updateAssumptions({ swr: v })}
        />
      </div>

      <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
        All figures are in today’s money — real terms, after inflation. Nothing
        here grows just because prices do.
      </p>
    </Card>
  )
}
