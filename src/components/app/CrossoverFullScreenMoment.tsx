/**
 * A one-time full-screen takeover, shown once right after a genuine
 * movement event (a salary change, a life event entered) lands the user
 * back on Today via the justChanged search param — see today.tsx for how
 * that's consumed exactly once, never persisted. Plain text, no
 * illustration/confetti — calm, matching this app's ethos, not a
 * gamified celebration.
 */
export function CrossoverFullScreenMoment({
  crossoverYear,
  onDismiss,
}: {
  crossoverYear: number | null
  onDismiss: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-w-md text-center">
        <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Just updated
        </p>
        <h2 className="mt-3 text-[28px] font-semibold tracking-tight">Your plan just moved.</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          {crossoverYear
            ? `Growth still overtakes what you put in from ${crossoverYear} — the full picture is on Plan.`
            : 'The full picture is on Plan.'}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 rounded-full bg-foreground px-6 py-3 text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-95"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
