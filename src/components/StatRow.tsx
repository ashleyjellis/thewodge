/**
 * Stat row (brand guide §6): a coloured dot + muted label on the left, a navy
 * tabular value right-aligned. Icons never decorate stat rows — dots and numbers
 * are the vocabulary.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { dotClass, type Tone } from './viz'

export function StatRow({
  label,
  value,
  tone = 'you',
  sub,
  className,
}: {
  label: ReactNode
  value: ReactNode
  tone?: Tone
  sub?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', className)}>
      <div className="flex items-baseline gap-2.5">
        <span
          className={cn(
            'translate-y-[3px] h-2.5 w-2.5 shrink-0 rounded-full',
            dotClass[tone],
          )}
        />
        <span className="text-[13px] leading-relaxed text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="text-right">
        <div className="text-[15px] font-semibold tabular-nums tracking-tight">
          {value}
        </div>
        {sub ? (
          <div className="text-[11px] text-muted-foreground tabular-nums">
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  )
}
