/** A calm, labelled checkbox — used for the cash-only ring-fenced/goal flags. */
export function AppCheckbox({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-muted px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-foreground"
      />
      <span>
        <span className="block text-[13px] font-medium text-foreground">{label}</span>
        {hint ? (
          <span className="block text-[12px] text-muted-foreground">{hint}</span>
        ) : null}
      </span>
    </label>
  )
}
