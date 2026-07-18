/**
 * The ambient "save this forecast" closer. General-purpose and always available —
 * not a form, not a "calculate" step, independent of whether any other hook has
 * been triggered. The live number above stays exactly as it is; this only offers
 * to keep it.
 */
import { BookmarkPlus } from 'lucide-react'

export function SaveForecastCard({ onClick }: { onClick: () => void }) {
  return (
    <div className="rounded-3xl bg-card p-7 shadow-soft sm:p-8">
      <div className="flex items-center gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/40">
          <BookmarkPlus size={18} strokeWidth={2.25} className="text-foreground" />
        </span>
        <div>
          <h2 className="text-[16px] font-semibold tracking-tight">
            Save this forecast
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Keep this and see how it’s tracking next time you look.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="mt-5 w-full rounded-full bg-foreground px-6 py-3.5 text-[15px] font-semibold text-primary-foreground transition-opacity hover:opacity-95 sm:w-auto sm:px-8"
      >
        Save this forecast →
      </button>
    </div>
  )
}
