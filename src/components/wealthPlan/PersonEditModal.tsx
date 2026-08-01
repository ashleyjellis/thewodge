/**
 * Quick-edit popup for one person's inputs, opened from the sticky bar above
 * the results — lets you tweak someone's numbers without scrolling back up
 * to the form. Reuses PersonFieldsPanel (the exact same fields the form's own
 * right-hand column uses) inside a modal shell, mirroring ContributionModal's
 * shell pattern. Editing only, deliberately no "remove" here — who's in the
 * plan is the form's job; this is just what their numbers are.
 */
import { X } from 'lucide-react'
import type { Person } from '@/lib/household'
import { PersonFieldsPanel } from './PersonFieldsPanel'

export function PersonEditModal({
  person,
  onSave,
  onClose,
}: {
  person: Person
  onSave: (fields: Omit<Person, 'id'>) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="person-edit-modal-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-card p-6 shadow-soft sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="person-edit-modal-title" className="text-[17px] font-semibold tracking-tight">
            Edit {person.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <X size={18} strokeWidth={2.25} />
          </button>
        </div>
        <PersonFieldsPanel
          person={person}
          fallbackName={person.name}
          saveLabel="Save changes"
          canRemove={false}
          removeLabel=""
          onSave={(fields) => {
            onSave(fields)
            onClose()
          }}
          onRemove={() => {}}
          onCancel={onClose}
        />
      </div>
    </div>
  )
}
