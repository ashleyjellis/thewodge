/**
 * Segmented control (brand guide §2, §6): selection pill = bg-accent/60, no border,
 * no checkmark, no "selected" text. Used for singular scenario choices (keep vs stop
 * at 40/45/50). If comparing scenarios use a list, not multiple bars.
 */
import { cn } from '@/lib/cn'

export type SegmentedOption<T extends string | number> = {
  label: string
  value: T
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  ariaLabel?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex gap-1 rounded-full bg-muted p-1',
        className,
      )}
    >
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 rounded-full px-3 py-2 text-[13px] font-medium tabular-nums transition-colors',
              selected
                ? 'bg-accent/60 text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
