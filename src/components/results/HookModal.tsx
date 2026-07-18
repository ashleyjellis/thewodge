/**
 * The shared modal every product hook opens (locked assumptions, the partner CTA,
 * the save-forecast closer). Same shell, different content per HookId. Always
 * closable without any account — the backdrop, the X, and "not now" all dismiss it
 * and leave the free tool exactly as usable as before.
 */
import { X } from 'lucide-react'
import { NavLink } from '@/components/NavLink'
import { HOOKS, type HookId } from '@/lib/hooks'

export function HookModal({
  hookId,
  onClose,
}: {
  hookId: HookId | null
  onClose: () => void
}) {
  if (!hookId) return null
  const hook = HOOKS[hookId]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hook-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-card p-7 shadow-soft sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {hook.eyebrow}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <X size={18} strokeWidth={2.25} />
          </button>
        </div>

        <h2
          id="hook-modal-title"
          className="mt-3 text-[20px] font-semibold leading-snug tracking-tight"
        >
          {hook.title}
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
          {hook.body}
        </p>

        <NavLink
          to="/app"
          search={{ from: hookId }}
          onClick={onClose}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-foreground px-6 py-3.5 text-[15px] font-semibold text-primary-foreground transition-opacity hover:opacity-95"
        >
          {hook.ctaLabel} →
        </NavLink>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full text-center text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
