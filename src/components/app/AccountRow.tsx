/**
 * A single account's display row — pot-category dot (navy=pension, accent=
 * investments, muted=cash, matching the free tool's tone system), provider +
 * type, balance + monthly contribution. Clickable to edit.
 */
import { money } from '@/lib/format'
import { dotClass } from '@/components/viz'
import type { Account } from '@/state/useAccounts'

const TYPE_LABELS: Record<Account['accountType'], string> = {
  cash_isa: 'Cash ISA',
  stocks_isa: 'Stocks & shares ISA',
  pension: 'Pension',
  lisa: 'LISA',
  savings_account: 'Savings account',
  other: 'Other',
}

const POT_TONE = {
  pension: 'you',
  investments: 'market',
  cash: 'cash',
} as const

export function AccountRow({ account, onClick }: { account: Account; onClick: () => void }) {
  const flags = [
    account.isRingFenced ? 'ring-fenced' : null,
    account.isGoalEarmarked ? 'goal' : null,
  ].filter(Boolean)

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-muted"
    >
      <div className="flex min-w-0 items-baseline gap-2.5">
        <span
          className={`h-2.5 w-2.5 shrink-0 translate-y-[3px] rounded-full ${dotClass[POT_TONE[account.potCategory]]}`}
        />
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-medium text-foreground">
            {account.provider}
          </span>
          <span className="block text-[12px] text-muted-foreground">
            {TYPE_LABELS[account.accountType]}
            {flags.length > 0 ? ` · ${flags.join(', ')}` : ''}
          </span>
        </span>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[14px] font-semibold tabular-nums text-foreground">
          {account.currentBalance !== null ? money(account.currentBalance) : '—'}
        </div>
        {account.monthlyContribution > 0 ? (
          <div className="text-[12px] tabular-nums text-muted-foreground">
            {money(account.monthlyContribution)}/mo
          </div>
        ) : null}
      </div>
    </button>
  )
}
