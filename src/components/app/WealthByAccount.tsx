/**
 * The Dashboard's "latest view of wealth by account" module — every account's
 * most recent balance, grouped the same way the Accounts tab does, with a way
 * to jump straight into the same update flow the Growth tab uses.
 */
import { useState } from 'react'
import type { AccountType } from '@/lib/accountType'
import { ACCOUNT_TYPE_LABELS } from '@/lib/accountType'
import { groupAccounts, type GroupableAccount } from '@/lib/groupAccounts'
import { money } from '@/lib/format'
import { UpdateBalances } from './UpdateBalances'

type WealthAccount = GroupableAccount & {
  id: string
  provider: string
  accountType: AccountType
  monthlyContribution: number
  currentBalance: number | null
}

export function WealthByAccount({
  accounts,
  snapshots,
  people,
  onSaved,
}: {
  accounts: WealthAccount[]
  snapshots: { accountId: string; recordedAt: string; year: number; month: number }[]
  people: { id: string; name: string }[]
  onSaved: () => Promise<void>
}) {
  const [updating, setUpdating] = useState(false)
  const groups = groupAccounts(accounts, people)
  const total = accounts.reduce((sum, a) => sum + (a.currentBalance ?? 0), 0)

  return (
    <div className="rounded-3xl bg-card p-7 shadow-soft">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Wealth by account</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {money(total)} across {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
          </p>
        </div>
        {!updating ? (
          <button
            type="button"
            onClick={() => setUpdating(true)}
            className="rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-95"
          >
            Update
          </button>
        ) : null}
      </div>

      {updating ? (
        <div className="mt-5">
          <UpdateBalances
            accounts={accounts}
            snapshots={snapshots}
            onSaved={async () => {
              setUpdating(false)
              await onSaved()
            }}
            onCancel={() => setUpdating(false)}
          />
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {groups.map((group) => (
            <div key={group.owner}>
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {group.label}
              </h3>
              <div className="mt-2 divide-y divide-border">
                {group.potGroups.flatMap((pg) => pg.accounts).map((account) => (
                  <div key={account.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-[14px] font-medium leading-tight">{account.provider}</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {ACCOUNT_TYPE_LABELS[account.accountType]}
                      </p>
                    </div>
                    <p className="text-[14px] font-semibold tabular-nums">
                      {account.currentBalance !== null ? money(account.currentBalance) : '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
