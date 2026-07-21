/**
 * Logs an actual salary for a person as of a given year — salary as an
 * evolving input (src/lib/salary.ts), the same actuals-over-time pattern
 * Growth uses for account balances. This is additive history, not an edit
 * to the person's baseline onboarding salary.
 */
import { useState } from 'react'
import { AppField } from './AppField'
import { Modal } from './Modal'

export function UpdateSalaryModal({
  personName,
  currentSalary,
  defaultYear,
  onSave,
  onClose,
}: {
  personName: string
  currentSalary: number | null
  defaultYear: number
  onSave: (input: { effectiveYear: number; salary: number }) => Promise<void>
  onClose: () => void
}) {
  const [year, setYear] = useState(String(defaultYear))
  const [salary, setSalary] = useState(currentSalary !== null ? String(currentSalary) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const parsedYear = Number(year)
    const parsedSalary = Number(salary)
    if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedSalary) || parsedSalary < 0) return
    setSaving(true)
    setError(null)
    try {
      await onSave({ effectiveYear: parsedYear, salary: parsedSalary })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Update ${personName}'s salary`} onClose={onClose}>
      <p className="text-[13px] text-muted-foreground">
        What {personName} actually earns from a given year — this replaces the assumed growth
        from that year onward, it doesn't change the original starting figure.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <AppField label="From year" value={year} onChange={setYear} inputMode="numeric" />
        <AppField
          label="Salary"
          prefix="£"
          value={salary}
          onChange={setSalary}
          placeholder="96,305"
          inputMode="decimal"
        />
      </div>
      {error ? <p className="mt-3 text-[13px] text-muted-foreground">Couldn't save: {error}</p> : null}
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          disabled={saving || !year.trim() || !salary.trim()}
          onClick={() => void submit()}
          className="rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-5 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </Modal>
  )
}
