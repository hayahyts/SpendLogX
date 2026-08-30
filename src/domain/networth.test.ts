import { describe, expect, it } from 'vitest'
import { parseCedis as c, ZERO } from './money'
import { isoDate } from './period'
import type { Txn } from './ledger'
import {
  type ValuedAccount, type Valuation, assertValidValuation, assetPositions,
  gainBasisPoints, isStale, netWorth, netWorthOver, valuationAt,
} from './networth'

const d = isoDate

function txn(over: Partial<Txn> & Pick<Txn, 'type' | 'amount' | 'accountId'>): Txn {
  return {
    id: Math.random().toString(36).slice(2),
    occurredOn: d('2026-05-04'), tips: ZERO, fee: ZERO,
    counterAccountId: null, categoryId: null, personId: null, note: null,
    isOpening: false,
    ...over,
  }
}

const accounts: ValuedAccount[] = [
  { id: 'cash', name: 'Cash', kind: 'cash', openingBalance: c('1042'), openingBalanceOn: d('2026-01-01') },
  { id: 'momo', name: 'MoMo Wallet', kind: 'mobile_money', openingBalance: ZERO, openingBalanceOn: d('2026-01-01') },
  { id: 'stanbic', name: 'Stanbic Bank', kind: 'bank', openingBalance: c('7000.47'), openingBalanceOn: d('2026-01-01') },
  { id: 'land', name: 'Land', kind: 'asset', openingBalance: ZERO, openingBalanceOn: d('2026-01-01') },
]

/** The four real land purchases, totalling 27,500. */
const landPurchases: Txn[] = [
  txn({ type: 'transfer', amount: c('6000'), accountId: 'cash', counterAccountId: 'land' }),
  txn({ type: 'transfer', amount: c('500'), accountId: 'cash', counterAccountId: 'land' }),
  txn({ type: 'transfer', amount: c('20000'), accountId: 'stanbic', counterAccountId: 'land' }),
  txn({ type: 'transfer', amount: c('1000'), accountId: 'momo', counterAccountId: 'land' }),
]

describe('cost basis', () => {
  it('is what the ledger put into the asset, not what it is worth', () => {
    const [land] = assetPositions(accounts, landPurchases, [], d('2026-12-31'))
    expect(land?.costBasis).toBe(c('27500'))
  })

  it('leaves the asset out of spendable money', () => {
    const nw = netWorth(accounts, landPurchases, [], d('2026-12-31'))
    // 1,042 + 7,000.47 opening, less 27,500 spent on land.
    expect(nw.spendable).toBe(c('-19457.53'))
  })
})

describe('valuationAt', () => {
  const valuations: Valuation[] = [
    { accountId: 'land', asOf: d('2026-06-01'), value: c('30000') },
    { accountId: 'land', asOf: d('2027-01-15'), value: c('42000') },
    { accountId: 'other', asOf: d('2026-06-01'), value: c('999') },
  ]

  it('takes the most recent valuation on or before the date', () => {
    expect(valuationAt(valuations, 'land', d('2026-12-31'))?.value).toBe(c('30000'))
    expect(valuationAt(valuations, 'land', d('2027-06-01'))?.value).toBe(c('42000'))
  })

  it('includes a valuation made on the date itself', () => {
    expect(valuationAt(valuations, 'land', d('2026-06-01'))?.value).toBe(c('30000'))
  })

  it('does not look into the future', () => {
    expect(valuationAt(valuations, 'land', d('2026-05-31'))).toBeNull()
  })

  it('never mixes up accounts', () => {
    expect(valuationAt(valuations, 'land', d('2027-06-01'))?.value).not.toBe(c('999'))
  })
})

describe('assetPositions', () => {
  it('reports value, cost and the gain between them', () => {
    const [land] = assetPositions(
      accounts, landPurchases,
      [{ accountId: 'land', asOf: d('2026-06-01'), value: c('42000') }],
      d('2026-12-31'),
    )
    expect(land).toMatchObject({
      costBasis: c('27500'),
      value: c('42000'),
      gain: c('14500'),
      unvalued: false,
      valuedOn: '2026-06-01',
    })
  })

  it('reports a loss when the valuation is below cost', () => {
    const [land] = assetPositions(
      accounts, landPurchases,
      [{ accountId: 'land', asOf: d('2026-06-01'), value: c('20000') }],
      d('2026-12-31'),
    )
    expect(land?.gain).toBe(c('-7500'))
  })

  it('falls back to cost when nobody has valued it, and says so', () => {
    // Showing 27,500 of land as worth nothing would be the worse lie.
    const [land] = assetPositions(accounts, landPurchases, [], d('2026-12-31'))
    expect(land).toMatchObject({ value: c('27500'), gain: ZERO, unvalued: true, valuedOn: null })
  })

  it('ignores transactions after the date', () => {
    const later = txn({
      type: 'transfer', amount: c('5000'), accountId: 'cash',
      counterAccountId: 'land', occurredOn: d('2027-03-01'),
    })
    const [land] = assetPositions(accounts, [...landPurchases, later], [], d('2026-12-31'))
    expect(land?.costBasis).toBe(c('27500'))
  })

  it('lists only asset accounts', () => {
    const positions = assetPositions(accounts, landPurchases, [], d('2026-12-31'))
    expect(positions.map((p) => p.name)).toEqual(['Land'])
  })
})

describe('netWorth', () => {
  const valuations: Valuation[] = [
    { accountId: 'land', asOf: d('2026-06-01'), value: c('42000') },
  ]

  it('counts the asset at value, never at its ledger balance', () => {
    const nw = netWorth(accounts, landPurchases, valuations, d('2026-12-31'))
    expect(nw.spendable).toBe(c('-19457.53'))
    expect(nw.assets).toBe(c('42000'))
    expect(nw.total).toBe(c('22542.47'))
  })

  it('does not double-count the asset', () => {
    // The wrong answer here is spendable + cost + value.
    const nw = netWorth(accounts, landPurchases, valuations, d('2026-12-31'))
    expect(nw.total).toBe(nw.spendable + nw.assets)
  })

  it('separates what the assets cost from what they are worth', () => {
    const nw = netWorth(accounts, landPurchases, valuations, d('2026-12-31'))
    expect(nw.assetCostBasis).toBe(c('27500'))
    expect(nw.unrealisedGain).toBe(c('14500'))
  })

  it('is unchanged in total by buying an asset, since money only moves', () => {
    const before = netWorth(accounts, [], [], d('2026-05-03'))
    // With no valuation, land is held at cost, so the purchase is a wash.
    const after = netWorth(accounts, landPurchases, [], d('2026-05-04'))
    expect(after.total).toBe(before.total)
  })

  it('moves with income, which is the point of tracking it', () => {
    const salary = txn({
      type: 'income', amount: c('23000'), accountId: 'stanbic', occurredOn: d('2026-06-28'),
    })
    const before = netWorth(accounts, landPurchases, valuations, d('2026-06-27'))
    const after = netWorth(accounts, [...landPurchases, salary], valuations, d('2026-06-28'))
    expect(after.total - before.total).toBe(c('23000'))
  })

  it('drops by the spend when money is spent', () => {
    const spend = txn({
      type: 'expense', amount: c('200'), tips: c('10'),
      accountId: 'cash', occurredOn: d('2026-06-28'),
    })
    const before = netWorth(accounts, landPurchases, valuations, d('2026-06-27'))
    const after = netWorth(accounts, [...landPurchases, spend], valuations, d('2026-06-28'))
    expect(before.total - after.total).toBe(c('210'))
  })
})

describe('netWorthOver', () => {
  it('returns a sorted series', () => {
    const series = netWorthOver(
      accounts, landPurchases,
      [
        { accountId: 'land', asOf: d('2026-06-01'), value: c('30000') },
        { accountId: 'land', asOf: d('2027-01-15'), value: c('42000') },
      ],
      [d('2027-06-01'), d('2026-05-31'), d('2026-12-31')],
    )
    expect(series.map((p) => p.asOf)).toEqual(['2026-05-31', '2026-12-31', '2027-06-01'])
    expect(series[1]?.total).toBe(c('10542.47')) // land at 30,000
    expect(series[2]?.total).toBe(c('22542.47')) // land revalued to 42,000
  })
})

describe('gainBasisPoints', () => {
  it('reports the gain as a proportion of cost', () => {
    const [land] = assetPositions(
      accounts, landPurchases,
      [{ accountId: 'land', asOf: d('2026-06-01'), value: c('41250') }],
      d('2026-12-31'),
    )
    // 13,750 on 27,500 is exactly 50%.
    expect(gainBasisPoints(land!)).toBe(5000)
  })

  it('is undefined when the asset cost nothing', () => {
    const free: ValuedAccount[] = [
      { id: 'gift', name: 'Gifted land', kind: 'asset', openingBalance: ZERO, openingBalanceOn: d('2026-01-01') },
    ]
    const [position] = assetPositions(free, [], [], d('2026-12-31'))
    expect(gainBasisPoints(position!)).toBeNull()
  })
})

describe('isStale', () => {
  const valued = (asOf: string) =>
    assetPositions(
      accounts, landPurchases,
      [{ accountId: 'land', asOf: d(asOf), value: c('42000') }],
      d('2027-06-01'),
    )[0]!

  it('treats a valuation over a year old as stale', () => {
    expect(isStale(valued('2026-05-01'), d('2027-06-01'))).toBe(true)
    expect(isStale(valued('2027-01-01'), d('2027-06-01'))).toBe(false)
  })

  it('treats an unvalued asset as stale', () => {
    const [land] = assetPositions(accounts, landPurchases, [], d('2027-06-01'))
    expect(isStale(land!, d('2027-06-01'))).toBe(true)
  })
})

describe('assertValidValuation', () => {
  it('rejects a negative valuation', () => {
    expect(() =>
      assertValidValuation({ accountId: 'land', asOf: d('2026-06-01'), value: c('-1') }),
    ).toThrow()
  })

  it('accepts zero, since an asset can become worthless', () => {
    expect(() =>
      assertValidValuation({ accountId: 'land', asOf: d('2026-06-01'), value: ZERO }),
    ).not.toThrow()
  })
})
