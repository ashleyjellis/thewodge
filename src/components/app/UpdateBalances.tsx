/**
 * The Growth tab's "update balances" flow (spec §3, revised by the
 * restructure brief) — the most important interaction in the logged-in
 * build. Update whenever you like, not forced-monthly: leaving an
 * account's balance blank skips it this round, only accounts with a real
 * end balance entered get a new snapshot on save.
 *
 * Growth no longer collects a contribution figure — money_in is always
 * computed from the account's known monthly contribution × months elapsed,
 * never entered or confirmed here, so there's exactly one place a
 * contribution amount can be set (the Forecast Plan table). The "put in /
 * grew" split shown per account is a read-only preview of that same
 * computation, not an editable field.
 */
import { useState } from 'react'
import { estimateContribution, latestSnapshotByAccount, monthsBetween } from '@/lib/snapshotMath'
import { money, monthYear } from '@/lib/format'
import { postJson } from '@/lib/apiClient'
import { ACCOUNT_TYPE_LABELS, type AccountType } from '@/lib/accountType'
import { dotClass } from '@/components/viz'
import { AppField } from './AppField'

type UpdateableAccount = {
  id: string
  provider: string
  accountType: AccountType
  potCategory: 'pension' | 'investments' | 'cash'
  monthlyContribution: number
  currentBalance: number | null
}

const POT_TONE = { pension: 'you', investments: 'market', cash: 'cash' } as const

type RowState = {
  endBalance: string
  note: string
}

const EMPTY_ROW: RowState = { endBalance: '', note: '' }

export function UpdateBalances({
  accounts,
  snapshots,
  onSaved,
  onCancel,
}: {
  accounts: UpdateableAccount[]
  snapshots: { accountId: string; recordedAt: string; year: number; month: number }[]
  onSaved: () => Promise<void>
  onCancel: () => void
}) {
  const latest = latestSnapshotByAccount(snapshots)
  const today = new Date()
  const todayPoint = { year: today.getUTCFullYear(), month: today.getUTCMonth() + 1 }

  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rowFor = (accountId: string): RowState => rows[accountId] ?? EMPTY_ROW

  const setEndBalance = (accountId: string, value: string) =>
    setRows((prev) => ({ ...prev, [accountId]: { ...rowFor(accountId), endBalance: value } }))

  const setNote = (accountId: string, value: string) =>
    setRows((prev) => ({ ...prev, [accountId]: { ...rowFor(accountId), note: value } }))

  const contributionSince = (account: UpdateableAccount) => {
    const last = latest.get(account.id)
    if (!last) return { moneyIn: 0, transferOut: 0 }
    return estimateContribution(
      account.monthlyContribution,
      monthsBetween({ year: last.year, month: last.month }, todayPoint),
    )
  }

  const touchedAccounts = accounts.filter((a) => rowFor(a.id).endBalance.trim() !== '')

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      for (const account of touchedAccounts) {
        const row = rowFor(account.id)
        const endBalance = Number(row.endBalance)
        const hasHistory = latest.has(account.id)
        const { moneyIn, transferOut } = hasHistory
          ? contributionSince(account)
          : { moneyIn: 0, transferOut: 0 }
        await postJson('/api/snapshots', {
          accountId: account.id,
          endBalance,
          moneyIn,
          transferOut,
          isEstimated: true,
          note: row.note,
        })
      }
      setRows({})
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to save updates')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft">
      <h3 className="text-[15px] font-semibold tracking-tight">Update balances</h3>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Update whichever accounts you like — there's no need to do them all, and no
        cadence to keep up with.
      </p>

      <div className="mt-5 space-y-5">
        {accounts.map((account) => {
          const last = latest.get(account.id)
          const row = rowFor(account.id)
          const hasHistory = Boolean(last)
          const endBalance = Number(row.endBalance)
          const showPreview = hasHistory && row.endBalance.trim() !== '' && Number.isFinite(endBalance)
          const { moneyIn } = contributionSince(account)
          const growth = showPreview ? endBalance - (account.currentBalance ?? 0) - moneyIn : null
          return (
            <div key={account.id} className="rounded-2xl bg-muted/60 p-4">
              <div className="flex items-baseline gap-2.5">
                <span
                  className={`h-2.5 w-2.5 shrink-0 translate-y-[3px] rounded-full ${dotClass[POT_TONE[account.potCategory]]}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-foreground">
                    {account.provider}
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      · {ACCOUNT_TYPE_LABELS[account.accountType]}
                    </span>
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {last
                      ? `Last updated ${monthYear(last.year, last.month)} — ${money(account.currentBalance ?? 0)}`
                      : 'No balance recorded yet'}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <AppField
                  label="Today's balance"
                  prefix="£"
                  inputMode="decimal"
                  value={row.endBalance}
                  onChange={(v) => setEndBalance(account.id, v)}
                  placeholder={account.currentBalance !== null ? String(Math.round(account.currentBalance)) : '0'}
                />
                {showPreview ? (
                  <div className="flex flex-col justify-center gap-0.5 text-[13px] text-muted-foreground sm:col-span-2">
                    <span>
                      Put in {money(moneyIn)}{' '}
                      <span className="text-[11px]">(from the account's contribution rate)</span>
                    </span>
                    <span>Grew {money(growth ?? 0)}</span>
                  </div>
                ) : null}
              </div>
              {row.endBalance.trim() !== '' ? (
                <div className="mt-3">
                  <AppField
                    label="Note"
                    hint="optional — e.g. “bonus invested”, “pulled £2k for the wedding”"
                    value={row.note}
                    onChange={(v) => setNote(account.id, v)}
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {error ? <p className="mt-4 text-[13px] text-muted-foreground">{error}</p> : null}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          disabled={saving || touchedAccounts.length === 0}
          onClick={() => void submit()}
          className="rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-40"
        >
          {saving
            ? 'Saving…'
            : touchedAccounts.length === 0
              ? 'Save updates'
              : `Save ${touchedAccounts.length} update${touchedAccounts.length === 1 ? '' : 's'}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-5 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
