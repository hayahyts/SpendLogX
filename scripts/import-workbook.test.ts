/**
 * Runs the importer against the real workbook.
 *
 * These assertions are the model's proof: if reclassifying land, extracting
 * people or flagging the opening balances is ever quietly undone, the totals
 * below move and this fails.
 */

import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { parseCedis as c } from '../src/domain/money'
import { isoDate, periodContaining } from '../src/domain/period'
import { type Txn, balances, effects, spendByCategory, spendByPerson, totalsForPeriod } from '../src/domain/ledger'
import { type ValuedAccount, assetPositions, liabilityPositions, netWorth } from '../src/domain/networth'
import {
  type Analysis, type Report, type Seed, decodeHidden, importWorkbook, isHidden,
} from './import-workbook'

const WORKBOOK = path.join(__dirname, '..', 'docs', 'Spending_Tracker_GHS.xlsx')

/** What a fresh install ships with. */
let seed: Seed
/** What the spreadsheet held. Audited here, never shipped. */
let analysis: Analysis
let report: Report

beforeAll(async () => {
  ;({ seed, analysis, report } = await importWorkbook(WORKBOOK))
}, 30_000)

/** The sheet's rows as domain transactions, so the ledger can be run over them. */
function asTxns(): Txn[] {
  return analysis.txns.map((t) => ({
    id: t.id,
    type: t.type,
    occurredOn: isoDate(t.occurredOn),
    amount: c(String(t.amountMinor / 100)),
    tips: c(String(t.tipsMinor / 100)),
    fee: c(String(t.feeMinor / 100)),
    accountId: t.accountId,
    counterAccountId: t.counterAccountId,
    categoryId: t.categoryId,
    personId: t.personId,
    note: t.note,
    isOpening: t.isOpening,
  }))
}

describe('decodeHidden', () => {
  it('recovers a name from zero-width characters', () => {
    const encode = (s: string) =>
      [...s]
        .map((ch) =>
          ch
            .charCodeAt(0)
            .toString(2)
            .padStart(16, '0')
            .replace(/0/g, '‌')
            .replace(/1/g, '‍'),
        )
        .join('')
    expect(decodeHidden(encode('Fauzia'))).toBe('Fauzia')
    expect(decodeHidden(encode('Nana Adjoa'))).toBe('Nana Adjoa')
  })

  it('returns null when there is nothing encoded', () => {
    expect(decodeHidden('‌')).toBeNull()
    expect(decodeHidden('')).toBeNull()
  })

  it('recognises a cell made only of invisible characters', () => {
    expect(isHidden('⁠‌‍⁤')).toBe(true)
    expect(isHidden('Groceries')).toBe(false)
    expect(isHidden('')).toBe(false)
  })
})

describe('what a fresh install actually receives', () => {
  it('is the taxonomy and nothing else', () => {
    expect(Object.keys(seed).sort()).toEqual(['categories', 'people'])
  })

  it('ships no accounts and no balances — you type those at setup', () => {
    expect(seed).not.toHaveProperty('accounts')
    expect(JSON.stringify(seed)).not.toContain('openingBalance')
  })

  it('ships no transactions — the app starts empty', () => {
    expect(seed).not.toHaveProperty('txns')
  })

  it('contains no dates at all, so the committed seed cannot drift', () => {
    expect(JSON.stringify(seed)).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })
})

describe('auditing the workbook', () => {
  it('reads all 40 rows', () => {
    expect(report.counts.transactions).toBe(40)
    expect(new Set(analysis.txns.map((t) => t.legacyRowId)).size).toBe(40)
  })

  it('is deterministic, so re-running it changes nothing', async () => {
    const again = await importWorkbook(WORKBOOK)
    expect(again.analysis.txns).toEqual(analysis.txns)
    expect(again.seed.categories).toEqual(seed.categories)
    expect(again.seed.people).toEqual(seed.people)
  }, 30_000)
})

describe('land stops being spending', () => {
  it('reclassifies all four purchases into a transfer to the asset account', () => {
    const land = analysis.accounts.find((a) => a.name === 'Land')
    expect(land?.kind).toBe('asset')

    const intoLand = analysis.txns.filter((t) => t.counterAccountId === land?.id)
    expect(intoLand).toHaveLength(4)
    expect(intoLand.every((t) => t.type === 'transfer' && t.categoryId === null)).toBe(true)
    expect(intoLand.reduce((sum, t) => sum + t.amountMinor, 0)).toBe(c('27500'))
  })

  it('drops true spending to 9,844 — the sheet claimed 48,943', () => {
    // 48,943 less 27,500 of land and 11,599 of loan repayment, neither of
    // which is consumption.
    expect(report.totals.expenses).toBe('₵ 9,844.00')
  })
})

describe('opening balances stop being income', () => {
  it('flags both rows and removes 8,042.47 from income', () => {
    const opening = analysis.txns.filter((t) => t.isOpening)
    expect(opening).toHaveLength(2)
    expect(opening.reduce((sum, t) => sum + t.amountMinor, 0)).toBe(c('8042.47'))
    // The sheet's own total was 49,889.47.
    expect(report.totals.income).toBe('₵ 41,847.00')
  })

  it('never puts a balance anywhere near the app', () => {
    // The sheet's own opening figures were fiction — 8,042.47 booked as salary.
    expect(analysis.accounts.every((a) => a.openingBalanceMinor === 0)).toBe(true)
  })

})

describe('people become their own dimension', () => {
  it('attaches a person to the 23 person-directed transactions', () => {
    expect(analysis.txns.filter((t) => t.personId !== null)).toHaveLength(23)
  })

  it('recovers the two names hidden in zero-width text', () => {
    const names = seed.people.map((p) => p.name)
    expect(names).toContain('Fauzia')
    expect(names).toContain('Nana Adjoa')
  })

  it('links Beb to a household member, so support totals can exclude them', () => {
    const beb = seed.people.find((p) => p.name === 'Beb')
    expect(beb?.memberUserId).not.toBeNull()
  })

  it('totals Beb across both categories instead of double-counting the name', () => {
    // "Beb" was a subcategory of Family and of Loan Repayment, so the sheet's
    // subcategory total mixed a spa treatment with an 11,599 loan repayment.
    const beb = seed.people.find((p) => p.name === 'Beb')
    const bebTxns = analysis.txns.filter((t) => t.personId === beb?.id)
    const categories = new Set(bebTxns.map((t) => t.categoryId))
    expect(categories.size).toBeGreaterThan(1)

    const year = periodContaining('year', isoDate('2026-01-01'))
    // 2,275 of family spending. The 11,599 repayment is a transfer into the
    // liability account, so it is money owed being cleared, not spending.
    expect(spendByPerson(asTxns(), year).get(beb?.id ?? '')).toBe(c('2275'))
  })

  it('never leaves a person as a category', () => {
    const names = new Set(seed.people.map((p) => p.name))
    expect(seed.categories.filter((cat) => names.has(cat.name))).toEqual([])
  })
})

describe('the taxonomy', () => {
  it('keeps all 13 top-level expense categories, Family included', () => {
    const top = seed.categories.filter((cat) => cat.parentId === null && cat.kind === 'expense')
    expect(top.map((cat) => cat.name)).toContain('Family')
    // The sheet's dashboard hardcoded 12 and hid 3,541 cedis of Family spending.
    expect(top).toHaveLength(13)
  })

  it('discards the drifted dropdown lists in Settings M:N', () => {
    const names = seed.categories.map((cat) => cat.name)
    expect(names).not.toContain('Family Home') // only ever existed in column M
    expect(names).not.toContain('Unplanned') // only ever existed in column N
  })

  it('is never more than two levels deep', () => {
    const byId = new Map(seed.categories.map((cat) => [cat.id, cat]))
    for (const cat of seed.categories) {
      if (cat.parentId === null) continue
      expect(byId.get(cat.parentId)?.parentId).toBeNull()
    }
  })

  it('marks the categories that should offer a person', () => {
    const facing = seed.categories.filter((cat) => cat.isPersonFacing).map((cat) => cat.name).sort()
    expect(facing).toEqual(['Charity', 'Extended Family', 'Family', 'Loan Repayment'])
  })
})

describe('the imported ledger is internally consistent', () => {
  it('produces a valid effect for every transaction', () => {
    for (const txn of asTxns()) expect(() => effects(txn)).not.toThrow()
  })

  it('touches only accounts that exist', () => {
    const accounts = analysis.accounts.map((a) => ({
      id: a.id, openingBalance: c('0'), openingBalanceOn: isoDate(a.openingBalanceOn),
    }))
    expect(() => balances(accounts, asTxns())).not.toThrow()
  })

  it('has category totals that add up to the expense total', () => {
    // The defect this app exists to fix: the sheet's parts summed to 45,402
    // against a stated total of 48,943.
    const year = periodContaining('year', isoDate('2026-01-01'))
    const txns = asTxns()
    const parts = [...spendByCategory(txns, year).values()].reduce((a, b) => a + b, 0)
    expect(parts).toBe(totalsForPeriod(txns, year).expenses)
  })

  it('records the Family spending the sheet hid', () => {
    const family = seed.categories.find((cat) => cat.name === 'Family' && cat.parentId === null)
    const year = periodContaining('year', isoDate('2026-01-01'))
    expect(spendByCategory(asTxns(), year).get(family?.id ?? '')).toBe(c('3541'))
  })
})

describe('the report', () => {
  it('warns about the 29 rows sharing the form default date', () => {
    expect(report.warnings.join(' ')).toMatch(/29 transactions share the date 2026-05-04/)
  })

  it('lists every transform it applied', () => {
    expect(report.transforms.length).toBeGreaterThan(30)
  })
})

describe('land as an asset, on the real data', () => {
  /** Seed accounts with the kind the net-worth layer needs. */
  function asAccounts(): ValuedAccount[] {
    return analysis.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      kind: a.kind as ValuedAccount['kind'],
      openingBalance: c(String(a.openingBalanceMinor / 100)),
      openingBalanceOn: isoDate(a.openingBalanceOn),
    }))
  }

  const asOf = isoDate('2026-12-31')

  it('holds Land at its 27,500 cost basis until somebody values it', () => {
    // Cost basis is history, so it counts every purchase regardless of setup date.
    const [land] = assetPositions(
      asAccounts().map((a) => ({ ...a, openingBalanceOn: isoDate('2020-01-01') })),
      asTxns(), [], asOf,
    )
    expect(land).toMatchObject({ name: 'Land', costBasis: c('27500'), unvalued: true })
  })

  it('holds the asset at cost while leaving spendable balances alone', () => {
    const nw = netWorth(asAccounts(), asTxns(), [], asOf)
    expect(nw.assets).toBe(c('27500'))
    // Every imported row predates setup, so none of it moves a balance the
    // user typed in. Spendable is exactly the hand-entered figures, which are
    // zero until first run.
    expect(nw.spendable).toBe(c('0'))
  })

  it('reports an unrealised gain once the land is valued', () => {
    const nw = netWorth(asAccounts().map((a) => ({ ...a, openingBalanceOn: isoDate('2020-01-01') })), asTxns(), [
      { accountId: analysis.accounts.find((a) => a.name === 'Land')!.id,
        asOf: isoDate('2026-08-01'), value: c('42000') },
    ], asOf)
    expect(nw.assets).toBe(c('42000'))
    expect(nw.unrealisedGain).toBe(c('14500'))
  })

  it('never counts the land twice', () => {
    const nw = netWorth(asAccounts(), asTxns(), [], asOf)
    expect(nw.total).toBe(nw.spendable + nw.assets)
  })
})

describe('the loan repayment stops being spending', () => {
  function asAccounts(): ValuedAccount[] {
    return analysis.accounts.map((a) => ({
      id: a.id, name: a.name, kind: a.kind as ValuedAccount['kind'],
      openingBalance: c(String(a.openingBalanceMinor / 100)),
      openingBalanceOn: isoDate(a.openingBalanceOn),
    }))
  }

  it('creates a liability account for what was owed', () => {
    const loan = analysis.accounts.find((a) => a.kind === 'liability')
    expect(loan?.name).toBe('Loan from Beb')
    // Opens today at zero: what is still owed is typed in at setup.
    expect(loan?.openingBalanceMinor).toBe(0)
  })

  it('turns the 11,599 repayment into a transfer into it', () => {
    const loan = analysis.accounts.find((a) => a.kind === 'liability')
    const into = analysis.txns.filter((t) => t.counterAccountId === loan?.id)
    expect(into).toHaveLength(1)
    expect(into[0]).toMatchObject({ type: 'transfer', amountMinor: c('11599'), categoryId: null })
  })

  it('keeps the lender on the transfer, without counting it as spending', () => {
    const beb = seed.people.find((p) => p.name === 'Beb')
    const loan = analysis.accounts.find((a) => a.kind === 'liability')
    const repayment = analysis.txns.find((t) => t.counterAccountId === loan?.id)
    expect(repayment?.personId).toBe(beb?.id)
  })

  it('leaves consumption at 9,844 rather than 21,443', () => {
    expect(report.totals.expenses).toBe('₵ 9,844.00')
  })

  it('reports nothing owed until a figure is entered at setup', () => {
    const debts = liabilityPositions(asAccounts(), asTxns(), isoDate('2026-12-31'))
    expect(debts).toHaveLength(1)
    expect(debts[0]?.owed).toBe(c('0'))
  })

  it('shows the debt clearing once the opening figure is set', () => {
    // Every account opens from the same date here, or the transfer counts on
    // one side only and net worth jumps by 11,599 out of nowhere.
    const accounts = asAccounts().map((a) => ({
      ...a,
      openingBalance: a.kind === 'liability' ? c('-11599') : a.openingBalance,
      openingBalanceOn: isoDate('2026-01-01'),
    }))
    const asOf = isoDate('2026-12-31')

    expect(netWorth(accounts, [], [], isoDate('2026-01-01')).liabilities).toBe(c('11599'))
    expect(netWorth(accounts, asTxns(), [], asOf).liabilities).toBe(c('0'))
  })

  it('leaves net worth untouched by the repayment itself', () => {
    // Isolate the repayment rather than comparing two dates: 30 June also
    // carries a 300 expense, which would otherwise be read as the difference.
    const accounts = asAccounts().map((a) => ({
      ...a,
      openingBalance: a.kind === 'liability' ? c('-11599') : a.openingBalance,
      openingBalanceOn: isoDate('2026-01-01'),
    }))
    const loan = analysis.accounts.find((a) => a.kind === 'liability')
    const all = asTxns()
    const withoutRepayment = all.filter((t) => t.counterAccountId !== loan?.id)
    const asOf = isoDate('2026-12-31')

    expect(all.length - withoutRepayment.length).toBe(1)
    // Paying it moves 11,599 out of the bank and shrinks the debt by 11,599.
    // Nothing is created or destroyed, so the total does not move.
    expect(netWorth(accounts, all, [], asOf).total).toBe(
      netWorth(accounts, withoutRepayment, [], asOf).total,
    )
  })
})
