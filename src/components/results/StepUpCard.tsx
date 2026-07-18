/**
 * The honest step-up — names what this free snapshot doesn't do, then invites the
 * reader toward the fuller (paywalled, not yet built) household tool. Naming the
 * gap is what makes the deeper thing worth wanting.
 *
 * The destination is a placeholder — /app — until the signed-in journey is built;
 * wire it up to the real entry point then.
 */
import { NavLink } from '@/components/NavLink'

const GAPS = [
  'It’s one person. Most of our readers plan as a household — add a partner and the whole picture changes.',
  'It doesn’t separate your pension from the years before you can touch it — the bridge that actually decides when you’re free.',
  'It doesn’t remember you. Come back in a year and you’re starting from nothing.',
]

export function StepUpCard() {
  return (
    <div className="rounded-3xl bg-foreground p-7 text-primary-foreground shadow-soft sm:p-10">
      <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-primary-foreground/70">
        What this snapshot doesn’t do
      </p>
      <h2 className="mt-3 text-[22px] font-semibold leading-snug tracking-tight sm:text-[26px]">
        This is a single-person view on three numbers.
      </h2>
      <ul className="mt-5 space-y-3">
        {GAPS.map((line) => (
          <li
            key={line}
            className="flex gap-3 text-[14px] leading-relaxed text-primary-foreground/90"
          >
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-foreground/40" />
            {line}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-[14px] leading-relaxed text-primary-foreground/90">
        The full picture keeps your pension, investments and cash separate for a
        reason, adds your partner, and tracks how reality moves against the plan —
        the same calm view, over time.
      </p>
      <NavLink
        to="/app"
        className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-background px-6 py-3.5 text-[15px] font-semibold text-foreground transition-opacity hover:opacity-95 sm:w-auto"
      >
        See the full household picture →
      </NavLink>
    </div>
  )
}
