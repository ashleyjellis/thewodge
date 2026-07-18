/**
 * The Accounts tab (spec §2) — set up the people in the household, then the real
 * accounts that roll up to pension/investments/cash. Calm, list-based, no charts;
 * this is a setup/maintenance screen. Every pot rollup elsewhere in the app is
 * computed by summing these accounts — never hand-entered separately.
 */
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { seo } from '@/lib/seo'
import { useHousehold } from '@/state/useHousehold'
import { useAccounts, type Account } from '@/state/useAccounts'
import { groupAccounts } from '@/lib/groupAccounts'
import { money } from '@/lib/format'
import {
  PersonCard,
  personFormToPayload,
  type PersonData,
} from '@/components/app/PersonCard'
import { AccountForm, type AccountFormPayload } from '@/components/app/AccountForm'
import { AccountRow } from '@/components/app/AccountRow'

const accountsSeo = seo({
  title: `Accounts — ${SITE_NAME}`,
  description: 'Set up the real accounts that make up your wealth.',
  path: '/app/accounts',
})

export const Route = createFileRoute('/app/accounts')({
  head: () => ({
    links: accountsSeo.links,
    meta: [...accountsSeo.meta, { name: 'robots', content: 'noindex' }],
  }),
  component: AccountsPage,
})

const POT_LABELS: Record<'pension' | 'investments' | 'cash', string> = {
  pension: 'Pension',
  investments: 'Investments',
  cash: 'Cash',
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || !data.ok) throw new Error(data.error ?? 'request failed')
  return data
}

async function patchJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || !data.ok) throw new Error(data.error ?? 'request failed')
  return data
}

function AccountsPage() {
  const {
    household,
    people,
    loading: householdLoading,
    error: householdError,
    refetch: refetchHousehold,
  } = useHousehold()
  const {
    accounts,
    loading: accountsLoading,
    error: accountsError,
    refetch: refetchAccounts,
  } = useAccounts(household?.id ?? null)

  const [addingPerson, setAddingPerson] = useState(false)
  const [addingAccount, setAddingAccount] = useState(false)
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)

  if (householdLoading) {
    return <p className="text-[14px] text-muted-foreground">Loading…</p>
  }
  if (householdError || !household) {
    return (
      <p className="text-[14px] text-muted-foreground">
        Couldn’t load your household{householdError ? `: ${householdError}` : ''}.
      </p>
    )
  }

  const savePerson = async (
    personId: string | null,
    payload: ReturnType<typeof personFormToPayload>,
  ) => {
    if (personId) {
      await patchJson('/api/people', { id: personId, ...payload })
    } else {
      await postJson('/api/people', { householdId: household.id, ...payload })
      setAddingPerson(false)
    }
    await refetchHousehold()
  }

  const saveAccount = async (payload: AccountFormPayload) => {
    if (editingAccountId) {
      await patchJson('/api/accounts', {
        id: editingAccountId,
        provider: payload.provider,
        accountType: payload.accountType,
        isRingFenced: payload.isRingFenced,
        isGoalEarmarked: payload.isGoalEarmarked,
        monthlyContribution: payload.monthlyContribution,
      })
      setEditingAccountId(null)
    } else {
      await postJson('/api/accounts', { householdId: household.id, ...payload })
      setAddingAccount(false)
    }
    await refetchAccounts()
  }

  const groups = groupAccounts(accounts, people)
  const editingAccount = accounts.find((a) => a.id === editingAccountId) ?? null

  return (
    <div className="space-y-10">
      <div>
        <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Set up
        </p>
        <h1 className="mt-2 text-[26px] font-semibold tracking-tight">Accounts</h1>
        <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-muted-foreground">
          The real accounts that make up your wealth — each one rolls up to your
          pension, investments or cash automatically.
        </p>
      </div>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight">People</h2>
          {people.length < 2 && !addingPerson ? (
            <button
              type="button"
              onClick={() => setAddingPerson(true)}
              className="text-[13px] font-medium text-foreground underline underline-offset-2"
            >
              Add a person
            </button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {people.map((p) => (
            <PersonCard
              key={p.id}
              person={p as PersonData}
              onSave={(payload) => savePerson(p.id, payload)}
            />
          ))}
          {addingPerson ? (
            <PersonCard
              person={null}
              onSave={(payload) => savePerson(null, payload)}
              onCancelNew={() => setAddingPerson(false)}
            />
          ) : null}
          {people.length === 0 && !addingPerson ? (
            <p className="text-[13px] text-muted-foreground">
              Add the first person to start setting up accounts.
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight">Accounts</h2>
          {!addingAccount && !editingAccountId ? (
            <button
              type="button"
              onClick={() => setAddingAccount(true)}
              className="text-[13px] font-medium text-foreground underline underline-offset-2"
            >
              Add an account
            </button>
          ) : null}
        </div>

        {accountsLoading ? (
          <p className="mt-4 text-[13px] text-muted-foreground">Loading…</p>
        ) : accountsError ? (
          <p className="mt-4 text-[13px] text-muted-foreground">
            Couldn’t load accounts: {accountsError}
          </p>
        ) : null}

        {addingAccount ? (
          <div className="mt-4">
            <AccountForm
              people={people.map((p) => ({ id: p.id, name: p.name }))}
              isNew
              onSubmit={saveAccount}
              onCancel={() => setAddingAccount(false)}
            />
          </div>
        ) : null}

        {editingAccount ? (
          <div className="mt-4">
            <AccountForm
              people={people.map((p) => ({ id: p.id, name: p.name }))}
              isNew={false}
              initial={{
                personId: editingAccount.personId,
                provider: editingAccount.provider,
                accountType: editingAccount.accountType,
                isRingFenced: editingAccount.isRingFenced,
                isGoalEarmarked: editingAccount.isGoalEarmarked,
                monthlyContribution: String(editingAccount.monthlyContribution || ''),
              }}
              onSubmit={saveAccount}
              onCancel={() => setEditingAccountId(null)}
            />
          </div>
        ) : null}

        <div className="mt-4 space-y-6">
          {groups.length === 0 && !addingAccount ? (
            <p className="text-[13px] text-muted-foreground">
              No accounts yet — add the first one above.
            </p>
          ) : null}

          {groups.map((group) => (
            <div key={group.owner} className="rounded-3xl bg-card p-5 shadow-soft sm:p-6">
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {group.label}
              </h3>
              <div className="mt-3 space-y-4">
                {group.potGroups.map((potGroup) => {
                  const potTotal = potGroup.accounts.reduce(
                    (s, a) => s + (a.currentBalance ?? 0),
                    0,
                  )
                  return (
                    <div key={potGroup.potCategory}>
                      <div className="flex items-baseline justify-between px-1">
                        <span className="text-[12px] font-medium text-muted-foreground">
                          {POT_LABELS[potGroup.potCategory]}
                        </span>
                        <span className="text-[12px] tabular-nums text-muted-foreground">
                          {money(potTotal)}
                        </span>
                      </div>
                      <div className="mt-1">
                        {potGroup.accounts.map((account: Account) => (
                          <AccountRow
                            key={account.id}
                            account={account}
                            onClick={() => {
                              setAddingAccount(false)
                              setEditingAccountId(account.id)
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
