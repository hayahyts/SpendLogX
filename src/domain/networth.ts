/**
 * What the household is worth, as distinct from what it can spend.
 *
 * An asset account holds two different numbers and conflating them is the easy
 * mistake. The ledger knows what went *into* Land — four transfers totalling
 * 27,500 — and that is its cost basis, not its value. What the land is worth is
 * a judgement recorded over time in `account_valuation`, and the two only
 * coincide on the day of purchase.
 */

import { type Money, ZERO, add, pesewas, subtract, sum } from './money'
import type { IsoDate } from './period'
import { type Account, type Txn, balances } from './ledger'

export type AccountKind = 'cash' | 'mobile_money' | 'bank' | 'asset'

export interface ValuedAccount extends Account {
  name: string
  kind: AccountKind
}

/** A recorded opinion of what an asset is worth on a given date. */
export interface Valuation {
  accountId: string
  asOf: IsoDate
  value: Money
  note?: string | null
}

export function isSpendable(account: Pick<ValuedAccount, 'kind'>): boolean {
  return account.kind !== 'asset'
}

/**
 * The most recent valuation on or before `asOf`.
 *
 * Returns null when an asset has never been valued — deliberately, so callers
 * have to decide what to do about it rather than being handed a zero that looks
 * like a real answer.
 */
export function valuationAt(
  valuations: readonly Valuation[],
  accountId: string,
  asOf: IsoDate,
): Valuation | null {
  let best: Valuation | null = null
  for (const v of valuations) {
    if (v.accountId !== accountId) continue
    if (v.asOf > asOf) continue
    if (best === null || v.asOf > best.asOf) best = v
  }
  return best
}

export interface AssetPosition {
  accountId: string
  name: string
  /** Net of everything moved in and out. What it cost. */
  costBasis: Money
  /** The latest valuation at or before the date, or the cost basis if never valued. */
  value: Money
  /** True when nobody has said what it is worth, so `value` is standing in. */
  unvalued: boolean
  /** How stale the valuation is; null when unvalued. */
  valuedOn: IsoDate | null
  /** value − costBasis. Negative is a loss. */
  gain: Money
}

/**
 * Every asset account, with what it cost against what it is worth.
 *
 * An unvalued asset falls back to its cost basis rather than to zero: showing
 * 27,500 of land as worth nothing would be a worse lie than assuming it has
 * held its price. `unvalued` marks it so the UI can say which it is.
 */
export function assetPositions(
  accounts: readonly ValuedAccount[],
  txns: readonly Txn[],
  valuations: readonly Valuation[],
  asOf: IsoDate,
): AssetPosition[] {
  const ledger = balances(accounts, txns.filter((t) => t.occurredOn <= asOf))

  return accounts
    .filter((a) => !isSpendable(a))
    .map((account) => {
      const costBasis = ledger.get(account.id) ?? ZERO
      const valuation = valuationAt(valuations, account.id, asOf)
      const value = valuation?.value ?? costBasis
      return {
        accountId: account.id,
        name: account.name,
        costBasis,
        value,
        unvalued: valuation === null,
        valuedOn: valuation?.asOf ?? null,
        gain: subtract(value, costBasis),
      }
    })
}

export interface NetWorth {
  /** Cash, mobile money and bank balances. What could be spent today. */
  spendable: Money
  /** Assets at their latest valuation. */
  assets: Money
  /** spendable + assets */
  total: Money
  /** What the assets cost, for comparison against what they are worth. */
  assetCostBasis: Money
  /** assets − assetCostBasis, across every asset. */
  unrealisedGain: Money
  positions: AssetPosition[]
}

/**
 * Spendable balances plus assets at value.
 *
 * Asset accounts contribute their *valuation*, never their ledger balance, so
 * nothing is counted twice.
 */
export function netWorth(
  accounts: readonly ValuedAccount[],
  txns: readonly Txn[],
  valuations: readonly Valuation[],
  asOf: IsoDate,
): NetWorth {
  const upTo = txns.filter((t) => t.occurredOn <= asOf)
  const ledger = balances(accounts, upTo)

  const spendable = sum(
    accounts.filter(isSpendable).map((a) => ledger.get(a.id) ?? ZERO),
  )

  const positions = assetPositions(accounts, upTo, valuations, asOf)
  const assets = sum(positions.map((p) => p.value))
  const assetCostBasis = sum(positions.map((p) => p.costBasis))

  return {
    spendable,
    assets,
    total: add(spendable, assets),
    assetCostBasis,
    unrealisedGain: subtract(assets, assetCostBasis),
    positions,
  }
}

/**
 * Net worth at each of a series of dates, for a chart.
 *
 * Sorted ascending, so the caller gets a line rather than a scatter.
 */
export function netWorthOver(
  accounts: readonly ValuedAccount[],
  txns: readonly Txn[],
  valuations: readonly Valuation[],
  dates: readonly IsoDate[],
): { asOf: IsoDate; total: Money }[] {
  return [...dates]
    .sort()
    .map((asOf) => ({ asOf, total: netWorth(accounts, txns, valuations, asOf).total }))
}

/**
 * Percentage change from cost, in basis points to stay in integer arithmetic.
 * 10000 is +100%. Null when the asset cost nothing, since the ratio is undefined.
 */
export function gainBasisPoints(position: AssetPosition): number | null {
  if (position.costBasis === 0) return null
  return Math.round((position.gain / position.costBasis) * 10_000)
}

/** A valuation older than this reads as stale in the UI. */
export const STALE_VALUATION_DAYS = 365

export function isStale(position: AssetPosition, asOf: IsoDate): boolean {
  if (position.valuedOn === null) return true
  const days =
    (Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${position.valuedOn}T00:00:00Z`)) / 86_400_000
  return days > STALE_VALUATION_DAYS
}

/** Guard against a valuation that would silently corrupt the picture. */
export function assertValidValuation(valuation: Valuation): void {
  if (valuation.value < 0) {
    throw new Error('An asset cannot be worth a negative amount')
  }
  pesewas(valuation.value)
}
