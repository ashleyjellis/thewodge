/**
 * The Growth tab's "update balances" flow (spec §3) — the most important
 * interaction in the logged-in build. Update whenever you like, not
 * forced-monthly: leaving an account's balance blank skips it this round, only
 * accounts with a real end balance entered get a new snapshot on save.
 * money_in/transfer_out are pre-filled from the known monthly contribution and
 * labelled "estimated" until the user edits either — never applied silently.
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
  moneyIn: string
  transferOut: string
  moneyInTouched: boolean
  transferOutTouched: boolean
  note: string
}

const EMPTY_ROW: RowState = {
  endBalance: '',
  moneyIn: '',
  transferOut: '',
  moneyInTouched: false,
  transferOutTouched: false,
  note: '',
}

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

  const setEndBalance = (account: UpdateableAccount, value: string) => {
    setRows((prev) => {
      const existing = prev[account.id]
      const last = latest.get(account.id)
      const estimate = last
        ? estimateContribution(
            account.monthlyContribution,
            monthsBetween({ year: last.year, month: last.month }, todayPoint),
          )
        : { moneyIn: 0, transferOut: 0 }
      return {
        ...prev,
        [account.id]: {
          endBalance: value,
          moneyIn: existing?.moneyInTouched ? existing.moneyIn : String(estimate.moneyIn),
          transferOut: existing?.transferOutTouched ? existing.transferOut : String(estimate.transferOut),
          moneyInTouched: existing?.moneyInTouched ?? false,
          transferOutTouched: existing?.transferOutTouched ?? false,
          note: existing?.note ?? '',
        },
      }
    })
  }

  const setMoneyIn = (accountId: string, value: string) =>
    setRows((prev) => ({ ...prev, [accountId]: { ...rowFor(accountId), moneyIn: value, moneyInTouched: true } }))

  const setTransferOut = (accountId: string, value: string) =>
    setRows((prev) => ({
      ...prev,
      [accountId]: { ...rowFor(accountId), transferOut: value, transferOutTouched: true },
    }))

  const setNote = (accountId: string, value: string) =>
    setRows((prev) => ({ ...prev, [accountId]: { ...rowFor(accountId), note: value } }))

  const touchedAccounts = accounts.filter((a) => rowFor(a.id).endBalance.trim() !== '')

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      for (const account of touchedAccounts) {
        const row = rowFor(account.id)
        const endBalance = Number(row.endBalance)
        const hasHistory = latest.has(account.id)
        const moneyIn = hasHistory ? Number(row.moneyIn || '0') : 0
        const transferOut = hasHistory ? Number(row.transferOut || '0') : 0
        const isEstimated = hasHistory && !row.moneyInTouched && !row.transferOutTouched
        await postJson('/api/snapshots', {
          accountId: account.id,
          endBalance,
          moneyIn,
          transferOut,
          isEstimated,
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
                  onChange={(v) => setEndBalance(account, v)}
                  placeholder={account.currentBalance !== null ? String(Math.round(account.currentBalance)) : '0'}
                />
                {hasHistory && row.endBalance.trim() !== '' ? (
                  <>
                    <AppField
                      label="Money in"
                      hint={row.moneyInTouched ? undefined : 'estimated'}
                      prefix="£"
                      inputMode="decimal"
                      value={row.moneyIn}
                      onChange={(v) => setMoneyIn(account.id, v)}
                    />
                    <AppField
                      label="Money out"
                      hint={row.transferOutTouched ? undefined : 'estimated'}
                      prefix="£"
                      inputMode="decimal"
                      value={row.transferOut}
                      onChange={(v) => setTransferOut(account.id, v)}
                    />
                  </>
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
