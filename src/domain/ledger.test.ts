import { describe, expect, it } from 'vitest'
import { parseCedis as c, ZERO } from './money'
import { isoDate, periodContaining } from './period'
import {
  LedgerError, type Txn, balances, effects, spendByCategory, spendByPerson,
  totalsForPeriod,
} from './ledger'

function txn(over: Partial<Txn> & Pick<Txn, 'type' | 'amount' | 'accountId'>): Txn {
  return {
    id: 'x', occurredOn: isoDate('2026-06-28'), tips: ZERO, fee: ZERO,
    counterAccountId: null, categoryId: null, personId: null, note: null,
    isOpening: false,
    ...over,
  }
}

describe('effects', () => {
  it('spends the amount plus the tip from one account', () => {
    // Sheet row 4: fuel 200, tip 10, paid from Cash.
    const t = txn({ type: 'expense', amount: c('200'), tips: c('10'), accountId: 'cash' })
    expect(effects(t)).toEqual([{ accountId: 'cash', delta: c('-210') }])
  })

  it('credits income to the account it landed in', () => {
    const t = txn({ type: 'income', amount: c('23000'), accountId: 'stanbic' })
    expect(effects(t)).toEqual([{ accountId: 'stanbic', delta: c('23000') }])
  })

  it('moves a transfer between two accounts, and the fee leaves the source', () => {
    const t = txn({
      type: 'transfer', amount: c('10611'), fee: c('25'),
      accountId: 'stanbic', counterAccountId: 'cash',
    })
    expect(effects(t)).toEqual([
      { accountId: 'stanbic', delta: c('-10636') },
      { accountId: 'cash', delta: c('10611') },
    ])
  })
})

describe('assertValid', () => {
  it('refuses a transfer to the same account', () => {
    const t = txn({ type: 'transfer', amount: c('10'), accountId: 'a', counterAccountId: 'a' })
    expect(() => effects(t)).toThrow(LedgerError)
  })

  it('refuses a transfer with no destination', () => {
    const t = txn({ type: 'transfer', amount: c('10'), accountId: 'a' })
    expect(() => effects(t)).toThrow(LedgerError)
  })

  it('refuses a categorised transfer', () => {
    const t = txn({
      type: 'transfer', amount: c('10'), accountId: 'a',
      counterAccountId: 'b', categoryId: 'food',
    })
    expect(() => effects(t)).toThrow(LedgerError)
  })

  it('refuses a zero or negative amount, since direction comes from the type', () => {
    expect(() => effects(txn({ type: 'expense', amount: c('0'), accountId: 'a' }))).toThrow(LedgerError)
    expect(() => effects(txn({ type: 'expense', amount: c('-5'), accountId: 'a' }))).toThrow(LedgerError)
  })

  it('refuses a fee on anything but a transfer', () => {
    const t = txn({ type: 'expense', amount: c('10'), fee: c('1'), accountId: 'a' })
    expect(() => effects(t)).toThrow(LedgerError)
  })
})

describe('balances', () => {
  const accounts = [
    { id: 'cash', openingBalance: c('1042') },
    { id: 'stanbic', openingBalance: c('7000.47') },
  ]

  it('is the opening balance plus every effect', () => {
    const out = balances(accounts, [
      txn({ type: 'income', amount: c('23000'), accountId: 'stanbic' }),
      txn({ type: 'expense', amount: c('200'), tips: c('10'), accountId: 'cash' }),
      txn({
        type: 'transfer', amount: c('10611'),
        accountId: 'stanbic', counterAccountId: 'cash',
      }),
    ])
    expect(out.get('stanbic')).toBe(c('19389.47'))
    expect(out.get('cash')).toBe(c('11443'))
  })

  it('lets a balance go negative rather than quietly clamping', () => {
    const out = balances([{ id: 'cash', openingBalance: c('10') }], [
      txn({ type: 'expense', amount: c('50'), accountId: 'cash' }),
    ])
    expect(out.get('cash')).toBe(c('-40'))
  })

  it('refuses a transaction against an account it does not know', () => {
    expect(() => balances(accounts, [
      txn({ type: 'expense', amount: c('5'), accountId: 'ghost' }),
    ])).toThrow(LedgerError)
  })
})

describe('totalsForPeriod', () => {
  const june = periodContaining('month', isoDate('2026-06-15'))

  it('counts tips as spending and leaves transfers out of it', () => {
    const totals = totalsForPeriod([
      txn({ type: 'expense', amount: c('200'), tips: c('10'), accountId: 'cash' }),
      txn({ type: 'income', amount: c('23000'), accountId: 'stanbic' }),
      txn({
        type: 'transfer', amount: c('10611'),
        accountId: 'stanbic', counterAccountId: 'cash',
      }),
    ], june)

    expect(totals.expenses).toBe(c('210'))
    expect(totals.income).toBe(c('23000'))
    expect(totals.transfers).toBe(c('10611'))
    expect(totals.net).toBe(c('22790'))
  })

  it('excludes migrated opening balances from income', () => {
    // The sheet booked these as Salary, overstating its income by 8,042.
    const totals = totalsForPeriod([
      txn({ type: 'income', amount: c('7000.47'), accountId: 'stanbic', isOpening: true }),
      txn({ type: 'income', amount: c('1042'), accountId: 'cash', isOpening: true }),
      txn({ type: 'income', amount: c('23000'), accountId: 'stanbic' }),
    ], june)

    expect(totals.income).toBe(c('23000'))
  })

  it('ignores transactions outside the period', () => {
    const totals = totalsForPeriod([
      txn({ type: 'expense', amount: c('100'), accountId: 'cash', occurredOn: isoDate('2026-05-31') }),
      txn({ type: 'expense', amount: c('50'), accountId: 'cash', occurredOn: isoDate('2026-06-01') }),
      txn({ type: 'expense', amount: c('25'), accountId: 'cash', occurredOn: isoDate('2026-07-01') }),
    ], june)

    expect(totals.expenses).toBe(c('50'))
  })
})

describe('spendByCategory', () => {
  const june = periodContaining('month', isoDate('2026-06-15'))

  it('reports every category present, never a fixed list', () => {
    // The sheet's dashboard iterated 12 hardcoded categories while Settings
    // defined 13, hiding every cedi of Family spending.
    const out = spendByCategory([
      txn({ type: 'expense', amount: c('108'), accountId: 'cash', categoryId: 'food' }),
      txn({ type: 'expense', amount: c('3541'), accountId: 'cash', categoryId: 'family' }),
      txn({ type: 'expense', amount: c('2740'), accountId: 'cash', categoryId: 'extended-family' }),
    ], june)

    expect([...out.keys()].sort()).toEqual(['extended-family', 'family', 'food'])
    expect(out.get('family')).toBe(c('3541'))
  })

  it('sums to the same figure as the period total', () => {
    const txns = [
      txn({ type: 'expense', amount: c('108'), accountId: 'cash', categoryId: 'food' }),
      txn({ type: 'expense', amount: c('200'), tips: c('10'), accountId: 'cash', categoryId: 'transport' }),
      txn({ type: 'expense', amount: c('3541'), accountId: 'cash', categoryId: 'family' }),
      txn({ type: 'transfer', amount: c('20000'), accountId: 'stanbic', counterAccountId: 'land' }),
    ]
    const byCategory = [...spendByCategory(txns, june).values()].reduce((a, b) => a + b, 0)
    expect(byCategory).toBe(totalsForPeriod(txns, june).expenses)
  })

  it('excludes transfers, so a land purchase is not spending', () => {
    const out = spendByCategory([
      txn({ type: 'transfer', amount: c('20000'), accountId: 'stanbic', counterAccountId: 'land' }),
    ], june)
    expect(out.size).toBe(0)
  })
})

describe('spendByPerson', () => {
  const june = periodContaining('month', isoDate('2026-06-15'))

  it('totals a person across every category they appear in', () => {
    // "Beb" was a subcategory of both Family and Loan Repayment in the sheet,
    // so summing by subcategory name conflated a spa treatment with a loan.
    const out = spendByPerson([
      txn({ type: 'expense', amount: c('800'), tips: c('60'), accountId: 'stanbic', categoryId: 'family', personId: 'beb' }),
      txn({ type: 'expense', amount: c('11599'), accountId: 'stanbic', categoryId: 'loan', personId: 'beb' }),
      txn({ type: 'expense', amount: c('300'), accountId: 'cash', categoryId: 'extended-family', personId: 'dedei' }),
    ], june)

    expect(out.get('beb')).toBe(c('12459'))
    expect(out.get('dedei')).toBe(c('300'))
  })

  it('skips transactions with nobody attached', () => {
    const out = spendByPerson([
      txn({ type: 'expense', amount: c('53'), accountId: 'cash', categoryId: 'food' }),
    ], june)
    expect(out.size).toBe(0)
  })
})
