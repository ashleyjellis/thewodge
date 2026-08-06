/**
 * "Model putting aside a bit more" — one of the two v1 nudges (spec: nudge
 * feed). A single click opens the Today-if sandbox (TodayIfSandbox.tsx)
 * with that extra amount already added to the investments pot's current
 * monthly figure — thin wiring on top of Phase 2's sandbox, not a new
 * mechanism: this component holds no household data and makes no
 * projection itself, it only tells the sandbox what to seed.
 */
const PRESET_EXTRA_AMOUNTS = [25, 50, 100]

export function ExtraContributionShortcut({ onModel }: { onModel: (extraMonthly: number) => void }) {
  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft">
      <p className="text-[15px] font-semibold tracking-tight">Model putting aside a bit more</p>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
        See what an extra amount a month could do — opens the sandbox below with it already
        applied to your investments.
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {PRESET_EXTRA_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => onModel(amount)}
            className="rounded-full bg-muted px-4 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted/70"
          >
            +£{amount}/mo
          </button>
        ))}
      </div>
    </div>
  )
}
