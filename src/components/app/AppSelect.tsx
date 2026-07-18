/**
 * A select for the authenticated area, styled to match AppField. Used for
 * account_type and owner choices — short preset lists, not free text.
 */
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export function AppSelect({
  label,
  hint,
  value,
  onChange,
  options,
  className,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <label className={cn('flex h-full flex-col', className)}>
      <span className="text-[13px] font-medium leading-snug text-foreground">
        {label}
        {hint ? (
          <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span>
        ) : null}
      </span>
      <span className="relative mt-2 flex items-center rounded-2xl bg-muted px-4 py-3 ring-1 ring-transparent transition focus-within:bg-card focus-within:ring-foreground/25">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-transparent text-[15px] font-semibold tracking-tight text-foreground outline-none"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          strokeWidth={2.25}
          className="pointer-events-none absolute right-4 text-muted-foreground"
        />
      </span>
    </label>
  )
}
