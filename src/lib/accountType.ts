/** Human labels for account_type — shared by every screen that displays or picks one. */
export type AccountType = 'cash_isa' | 'stocks_isa' | 'pension' | 'lisa' | 'savings_account' | 'other'

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash_isa: 'Cash ISA',
  stocks_isa: 'Stocks & shares ISA',
  pension: 'Pension',
  lisa: 'LISA',
  savings_account: 'Savings account',
  other: 'Other',
}
