/** A small toggle pill for filter rows (person/pot/owner filters across the app). */
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
        active ? 'bg-foreground text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
