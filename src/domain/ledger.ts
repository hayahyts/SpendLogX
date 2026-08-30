/**
 * How a transaction moves money.
 *
 * The spreadsheet had no notion of a balance, so it never had to answer this.
 * The app does, and every balance shown anywhere derives from `effects` below.
 */

import { type Money, ZERO, add, pesewas, sum } from './money'
import type { IsoDate, Period } from './period'
import { contains } from './period'

export type TxnType = 'expense' | 'income' | 'transfer'

export interface Txn {
  id: string
  type: TxnType
  occurredOn: IsoDate
  /** Always positive. Direction comes from `type`, never from the sign. */
  amount: Money
  /** Expenses only. Added to the amount, and spent from the same account. */
  tips: Money
  /** Transfers only. Leaves the source account and never reaches the destination. */
  fee: Money
  /** Source for an expense or transfer; destination for income. */
  accountId: string
  /** Destination. Transfers only. */
  counterAccountId: string | null
  categoryId: string | null
  personId: string | null
  note: string | null
  /**
   * A migrated opening balance. Excluded from income and expense totals — the
   * spreadsheet recorded these as salary, which overstated its income by 8,042.
   */
  isOpening: boolean
}

export interface AccountEffect {
  accountId: string
  delta: Money
}

export class LedgerError extends Error {}

/** Reject the states the type system can't: a transfer to itself, a stray fee. */
export function assertValid(txn: Txn): void {
  if (txn.amount <= 0) {
    throw new LedgerError(`Amount must be positive, got ${txn.amount}`)
  }
  if (txn.tips < 0 || txn.fee < 0) {
    throw new LedgerError('Tips and fees cannot be negative')
  }

  if (txn.type === 'transfer') {
    if (txn.counterAccountId === null) {
      throw new LedgerError('A transfer needs a destination account')
    }
    if (txn.counterAccountId === txn.accountId) {
      throw new LedgerError('A transfer cannot move money to the same account')
    }
    if (txn.categoryId !== null) {
      throw new LedgerError('Transfers are not categorised')
    }
    if (txn.tips !== 0) {
      throw new LedgerError('Transfers do not carry tips')
    }
    return
  }

  if (txn.counterAccountId !== null) {
    throw new LedgerError(`A ${txn.type} has no counter account`)
  }
  if (txn.fee !== 0) {
    throw new LedgerError(`A ${txn.type} does not carry a transfer fee`)
  }
  if (txn.type === 'income' && txn.tips !== 0) {
    throw new LedgerError('Income does not carry tips')
  }
}

/** What this transaction does to each account it touches. */
export function effects(txn: Txn): AccountEffect[] {
  assertValid(txn)

  switch (txn.type) {
    case 'expense':
      return [{ accountId: txn.accountId, delta: pesewas(-(txn.amount + txn.tips)) }]

    case 'income':
      return [{ accountId: txn.accountId, delta: txn.amount }]

    case 'transfer':
      return [
        { accountId: txn.accountId, delta: pesewas(-(txn.amount + txn.fee)) },
        { accountId: txn.counterAccountId as string, delta: txn.amount },
      ]
  }
}

export interface Account {
  id: string
  openingBalance: Money
}

/** Opening balance plus every effect, for each account. */
export function balances(
  accounts: readonly Account[],
  txns: readonly Txn[],
): Map<string, Money> {
  const out = new Map<string, Money>(accounts.map((a) => [a.id, a.openingBalance]))

  for (const txn of txns) {
    for (const effect of effects(txn)) {
      const current = out.get(effect.accountId)
      if (current === undefined) {
        throw new LedgerError(`Transaction ${txn.id} touches unknown account ${effect.accountId}`)
      }
      out.set(effect.accountId, add(current, effect.delta))
    }
  }

  return out
}

/**
 * What a transaction contributes to "spending".
 *
 * Tips count. Transfers do not — moving money between your own accounts is not
 * spending, which is what makes the 27,500 land purchase disappear from these
 * totals once Land is an account rather than a category.
 */
export function spendAmount(txn: Txn): Money {
  if (txn.isOpening || txn.type !== 'expense') return ZERO
  return add(txn.amount, txn.tips)
}

export function incomeAmount(txn: Txn): Money {
  if (txn.isOpening || txn.type !== 'income') return ZERO
  return txn.amount
}

export function transferAmount(txn: Txn): Money {
  return txn.type === 'transfer' ? txn.amount : ZERO
}

export interface PeriodTotals {
  expenses: Money
  income: Money
  transfers: Money
  net: Money
}

export function totalsForPeriod(txns: readonly Txn[], period: Period): PeriodTotals {
  const inPeriod = txns.filter((t) => contains(period, t.occurredOn))
  const expenses = sum(inPeriod.map(spendAmount))
  const income = sum(inPeriod.map(incomeAmount))
  return {
    expenses,
    income,
    transfers: sum(inPeriod.map(transferAmount)),
    net: pesewas(income - expenses),
  }
}

/**
 * Spending per category over a period.
 *
 * Returns a total for every category id present in the transactions. The
 * spreadsheet's worst defect was a dashboard that iterated a hardcoded list of
 * twelve categories when thirteen existed, hiding 3,541 cedis of family
 * spending. Nothing here may take a caller-supplied list of categories.
 */
export function spendByCategory(
  txns: readonly Txn[],
  period: Period,
): Map<string | null, Money> {
  const out = new Map<string | null, Money>()
  for (const txn of txns) {
    if (!contains(period, txn.occurredOn)) continue
    const amount = spendAmount(txn)
    if (amount === 0) continue
    out.set(txn.categoryId, add(out.get(txn.categoryId) ?? ZERO, amount))
  }
  return out
}

/** Spending per person over a period. Transactions with no person are excluded. */
export function spendByPerson(txns: readonly Txn[], period: Period): Map<string, Money> {
  const out = new Map<string, Money>()
  for (const txn of txns) {
    if (txn.personId === null) continue
    if (!contains(period, txn.occurredOn)) continue
    const amount = spendAmount(txn)
    if (amount === 0) continue
    out.set(txn.personId, add(out.get(txn.personId) ?? ZERO, amount))
  }
  return out
}
