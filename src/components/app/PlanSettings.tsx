/**
 * Household-level plan assumptions — currently just retirement age, the one
 * value users have asked to see and set themselves. Editing this doesn't move
 * an existing Forecast baseline — it's frozen by design — so a change here
 * only shows up in Forecast after an explicit replan.
 */
import { useState } from 'react'
import { AppField } from './AppField'

export function PlanSettings({
  retirementAge,
  onSave,
}: {
  retirementAge: number
  onSave: (retirementAge: number) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(retirementAge))
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      await onSave(Number(value))
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="rounded-3xl bg-card p-6 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Plan settings</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Retirement age {retirementAge} — Forecast projects to this.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setValue(String(retirementAge))
              setEditing(true)
            }}
            className="text-[13px] font-medium text-foreground underline underline-offset-2"
          >
            Edit
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft">
      <h2 className="text-[15px] font-semibold tracking-tight">Plan settings</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Changing this doesn't move your existing Forecast plan — replan there afterwards to lock
        in a fresh one at the new age.
      </p>
      <div className="mt-4 max-w-[160px]">
        <AppField label="Retirement age" value={value} onChange={setValue} inputMode="numeric" />
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={saving || !value.trim()}
          onClick={() => void submit()}
          className="rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-full px-5 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
