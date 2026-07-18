/**
 * Text/number input for the authenticated area — same visual language as the
 * free tool's Calculator field (bg-muted rounded-2xl), reused here so the whole
 * product feels like one system.
 */
import { cn } from '@/lib/cn'

/** Keystroke-level filtering — prevents letters ever landing in a numeric field,
 *  rather than validating after the fact. 'decimal' keeps at most one '.'. */
function filterInput(raw: string, mode: 'text' | 'numeric' | 'decimal'): string {
  if (mode === 'text') return raw
  if (mode === 'numeric') return raw.replace(/[^\d]/g, '')
  const cleaned = raw.replace(/[^\d.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot === -1) return cleaned
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
}

export function AppField({
  label,
  hint,
  prefix,
  value,
  onChange,
  placeholder,
  inputMode = 'text',
  className,
}: {
  label: string
  hint?: string
  prefix?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputMode?: 'text' | 'numeric' | 'decimal'
  className?: string
}) {
  const handle = (raw: string) => onChange(filterInput(raw, inputMode))
  return (
    <label className={cn('flex h-full flex-col', className)}>
      <span className="text-[13px] font-medium leading-snug text-foreground">
        {label}
        {hint ? (
          <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span>
        ) : null}
      </span>
      <span className="mt-2 flex items-center gap-1 rounded-2xl bg-muted px-4 py-3 ring-1 ring-transparent transition focus-within:bg-card focus-within:ring-foreground/25">
        {prefix ? (
          <span className="text-[15px] font-semibold text-muted-foreground">{prefix}</span>
        ) : null}
        <input
          type="text"
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          onChange={(e) => handle(e.target.value)}
          className="w-full bg-transparent text-[15px] font-semibold tabular-nums tracking-tight text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/50"
        />
      </span>
    </label>
  )
}
