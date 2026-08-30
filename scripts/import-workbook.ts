/**
 * Reads Spending_Tracker_GHS.xlsx and emits two different things.
 *
 * The **seed** is what a fresh install starts with, and it is only the
 * taxonomy: categories and people. No accounts, no balances, no transactions.
 * You add your accounts at setup and type every balance yourself, so nothing
 * the app shows is inherited from a spreadsheet whose own figures were wrong.
 *
 * The **analysis** is what the spreadsheet actually contained, and it never
 * reaches the app. It exists so the audit stays reproducible: it is how 48,943
 * of claimed spending was shown to be 9,844 of real consumption, and the tests
 * assert against it so that finding cannot quietly rot.
 *
 * Re-runnable and deterministic: ids are derived from the source values, so
 * running it twice produces byte-identical output.
 *
 *   npm run import -- [--workbook path] [--out path] [--json]
 */

import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { type Money, ZERO, format, fromSheetNumber, pesewas } from '../src/domain/money'
import { type IsoDate, isoDate } from '../src/domain/period'

/** Subcategories that name a person rather than a kind of spending. */
const PEOPLE = new Set([
  'Beb', 'Ibrahim', 'Abdur-Rahman', 'Dedei', 'Odarkor', 'Koshie', 'Mommy',
  'Aryee', 'Sammy', 'Omama', 'Mother', 'Auntie (Maxwell)', 'Nateki', 'Jalil',
  'Friends', 'Poor',
])

/** Beb is the second household member, so support totals must exclude them. */
const MEMBER_PEOPLE = new Set(['Beb'])

/** Categories whose transactions should offer a person on the entry screen. */
const PERSON_FACING = new Set(['Family', 'Extended Family', 'Charity', 'Loan Repayment'])

/** Investment/Land is a purchase of an asset, not spending. */
const ASSET_SUBCATEGORY = 'Land'
const ASSET_ACCOUNT_NAME = 'Land'

/**
 * Asset accounts open before any recorded transaction, so their whole purchase
 * history counts toward the cost basis.
 */
const ASSET_EPOCH = '2000-01-01'

/**
 * Repaying a loan is money owed being cleared, not money consumed. The category
 * that recorded it becomes a liability account, and the repayment a transfer
 * into it. What is still owed is entered by hand at setup, so the account opens
 * today like a wallet does.
 */
const LIABILITY_CATEGORY = 'Loan Repayment'
const LIABILITY_ACCOUNT_NAME = 'Loan from Beb'

/** Descriptions that mark a smuggled-in opening balance rather than income. */
const OPENING_BALANCE_HINTS = [/initial balance/i, /initial cash/i]

/** Payment Method duplicated Account in 37 of 40 rows; Account wins. */
const ACCOUNT_KIND: Record<string, 'cash' | 'mobile_money' | 'bank' | 'asset' | 'liability'> = {
  Cash: 'cash',
  'MoMo Wallet': 'mobile_money',
  'Stanbic Bank': 'bank',
  Other: 'cash',
}

// ---------------------------------------------------------------------------

function id(kind: string, ...parts: (string | number)[]): string {
  const hash = createHash('sha1').update(parts.join(' ')).digest('hex').slice(0, 12)
  return `${kind}_${hash}`
}

/**
 * Four cells hold names encoded in zero-width characters and render as blank.
 * ZWNJ is a 0 bit, ZWJ a 1, sixteen bits to a UTF-16 code unit.
 */
const ZERO_BIT = '‌'
const ONE_BIT = '‍'

export function decodeHidden(value: string): string | null {
  const bits = [...value]
    .map((ch) => (ch === ZERO_BIT ? '0' : ch === ONE_BIT ? '1' : ''))
    .join('')
  if (bits.length < 16) return null

  let out = ''
  for (let i = 0; i + 16 <= bits.length; i += 16) {
    out += String.fromCharCode(Number.parseInt(bits.slice(i, i + 16), 2))
  }
  const trimmed = out.trim()
  return trimmed === '' ? null : trimmed
}

/** True when a cell is made entirely of invisible characters. */
export function isHidden(value: string): boolean {
  return value.length > 0 && [...value].every((ch) => ch.charCodeAt(0) >= 0x2000)
}

/** Cell text, with hidden-unicode names recovered and whitespace collapsed. */
function readText(cell: ExcelJS.Cell): { value: string; recovered: boolean } {
  const raw = typeof cell.value === 'string' ? cell.value : (cell.text ?? '')
  if (isHidden(raw)) {
    const decoded = decodeHidden(raw)
    if (decoded) return { value: decoded, recovered: true }
    return { value: '', recovered: false }
  }
  return { value: raw.trim().replace(/\s+/g, ' '), recovered: false }
}

function readDate(cell: ExcelJS.Cell): IsoDate {
  const v = cell.value
  if (v instanceof Date) return isoDate(v.toISOString().slice(0, 10))
  throw new Error(`Expected a date, got ${JSON.stringify(v)}`)
}

function addOneDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function readMoney(cell: ExcelJS.Cell): Money {
  const v = cell.value
  if (v === null || v === undefined || v === '') return ZERO
  if (typeof v === 'number') return fromSheetNumber(v)
  throw new Error(`Expected a number, got ${JSON.stringify(v)}`)
}

// ---------------------------------------------------------------------------

/** What a fresh install starts with. Taxonomy only. */
export interface Seed {
  categories: {
    id: string; name: string; kind: 'expense' | 'income'
    parentId: string | null; isPersonFacing: boolean; sortOrder: number
  }[]
  people: { id: string; name: string; memberUserId: string | null }[]
}

/** What the spreadsheet held. Used for the audit; never shipped to the app. */
export interface Analysis {
  accounts: {
    id: string; name: string; kind: string
    openingBalanceMinor: number; openingBalanceOn: string; sortOrder: number
  }[]
  txns: {
    id: string; type: 'expense' | 'income' | 'transfer'; occurredOn: string
    amountMinor: number; tipsMinor: number; feeMinor: number
    accountId: string; counterAccountId: string | null
    categoryId: string | null; personId: string | null
    note: string | null; isOpening: boolean; legacyRowId: number
  }[]
}

export interface Report {
  counts: Record<string, number>
  transforms: string[]
  warnings: string[]
  totals: { expenses: string; income: string; transfers: string; assetPurchases: string }
}

export async function importWorkbook(
  file: string,
): Promise<{ seed: Seed; analysis: Analysis; report: Report }> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(file)

  const settings = wb.getWorksheet('Settings')
  const transactions = wb.getWorksheet('Transactions')
  if (!settings || !transactions) throw new Error('Workbook is missing Settings or Transactions')

  const transforms: string[] = []
  const warnings: string[] = []

  // --- taxonomy, from Settings A:B and C:D only -----------------------------
  // Columns M:N are stale dropdown copies: M invents "Family Home", omits
  // Investment, Charity and Loan Repayment. They are discarded entirely.
  transforms.push(
    'Discarded Settings columns M:N — stale dropdown copies that had already drifted from A:D',
  )

  const categories: Seed['categories'] = []
  const catIndex = new Map<string, string>()
  const peopleNames = new Set<string>()

  function addCategory(name: string, kind: 'expense' | 'income', parent: string | null): string {
    const key = `${kind}|${parent ?? ''}|${name}`
    const existing = catIndex.get(key)
    if (existing) return existing
    const cid = id('cat', kind, parent ?? '', name)
    catIndex.set(key, cid)
    categories.push({
      id: cid, name, kind, parentId: parent,
      isPersonFacing: parent === null && PERSON_FACING.has(name),
      sortOrder: categories.length,
    })
    return cid
  }

  for (const [catCol, subCol, kind] of [['A', 'B', 'expense'], ['C', 'D', 'income']] as const) {
    settings.eachRow((row, n) => {
      if (n === 1) return
      const parentName = readText(row.getCell(catCol)).value
      const sub = readText(row.getCell(subCol))
      if (!parentName) return

      const parentId = addCategory(parentName, kind, null)

      if (!sub.value) return
      if (sub.recovered) {
        transforms.push(`Recovered "${sub.value}" from zero-width text in Settings!${subCol}${n}`)
      }
      // Investment/Land becomes an asset account, so it is not a category.
      if (parentName === 'Investment' && sub.value === ASSET_SUBCATEGORY) return
      if (PEOPLE.has(sub.value) || sub.recovered) {
        peopleNames.add(sub.value)
        return
      }
      addCategory(sub.value, kind, parentId)
    })
  }

  // --- accounts -------------------------------------------------------------
  const accountNames = new Set<string>()
  const seenTxnDates = new Set<string>()
  transactions.eachRow((row, n) => {
    if (n === 1) return
    const name = readText(row.getCell('J')).value
    if (name) accountNames.add(name)
    seenTxnDates.add(readDate(row.getCell('B')))
  })

  // The day after the last imported transaction, not today's date.
  //
  // Wallets and liabilities open where the imported history ends, so every
  // imported row is history and none of it moves a balance the user types in.
  // Deriving it from the data rather than the clock also keeps the seed
  // reproducible — CI re-runs this import and fails if the output moves, which
  // a baked-in `new Date()` would trigger every single day.
  //
  // At real setup the app writes the actual date; this is only the seed's value.
  const lastTxnDate = [...seenTxnDates].sort().at(-1)
  const setupDate = lastTxnDate === undefined ? ASSET_EPOCH : addOneDay(lastTxnDate)

  // Spendable accounts open where history ends: the user types what they
  // actually hold, and the imported rows do not move that figure.
  const accounts: Analysis['accounts'] = [...accountNames].sort().map((name, i) => ({
    id: id('acct', name),
    name,
    kind: ACCOUNT_KIND[name] ?? 'cash',
    // Deliberately zero: balances are entered by hand at first run, so nothing
    // here pretends the imported history reconciles to a real balance.
    openingBalanceMinor: 0,
    openingBalanceOn: setupDate,
    sortOrder: i,
  }))

  // An asset account opens before all recorded history, because its balance is
  // a cost basis — what has been put into it over time — not a figure anybody
  // types in. Opening it today would show the land as having cost nothing. What
  // the land is *worth* is a separate number, recorded in account_valuation.
  accounts.push({
    id: id('acct', ASSET_ACCOUNT_NAME),
    name: ASSET_ACCOUNT_NAME,
    kind: 'asset',
    openingBalanceMinor: 0,
    openingBalanceOn: ASSET_EPOCH,
    sortOrder: accounts.length,
  })
  transforms.push(
    `Created asset account "${ASSET_ACCOUNT_NAME}" — Investment/Land purchases become transfers into it, not spending`,
  )
  transforms.push(
    'Dropped the Payment Method column — Account carries the meaning, and each account now knows its own kind',
  )
  transforms.push(
    'Opening balances left at zero: they are entered by hand at first run rather than inferred from the sheet',
  )

  // A liability opens today, not before history: what is still owed is a figure
  // the user types at setup, exactly as a wallet balance is. Its balance is
  // negative until cleared, so net worth can simply add every account up.
  accounts.push({
    id: id('acct', LIABILITY_ACCOUNT_NAME),
    name: LIABILITY_ACCOUNT_NAME,
    kind: 'liability',
    openingBalanceMinor: 0,
    openingBalanceOn: setupDate,
    sortOrder: accounts.length,
  })
  transforms.push(
    `Created liability account "${LIABILITY_ACCOUNT_NAME}" — repaying a loan clears a debt rather than spending money`,
  )

  const accountId = new Map(accounts.map((a) => [a.name, a.id]))
  const landAccountId = id('acct', ASSET_ACCOUNT_NAME)
  const liabilityAccountId = id('acct', LIABILITY_ACCOUNT_NAME)

  // --- transactions ---------------------------------------------------------
  const txns: Analysis['txns'] = []
  let expenses = ZERO
  let income = ZERO
  let transfers = ZERO
  let assetPurchases = ZERO
  const seenDates = new Map<string, number>()

  transactions.eachRow((row, n) => {
    if (n === 1) return
    const legacyRowId = Number(row.getCell('A').value)
    if (!Number.isFinite(legacyRowId)) return

    const occurredOn = readDate(row.getCell('B'))
    const sheetType = readText(row.getCell('C')).value
    const amount = readMoney(row.getCell('D'))
    const tips = readMoney(row.getCell('E'))
    const catName = readText(row.getCell('F')).value
    const sub = readText(row.getCell('G'))
    const note = readText(row.getCell('H')).value || null
    const acctName = readText(row.getCell('J')).value

    seenDates.set(occurredOn, (seenDates.get(occurredOn) ?? 0) + 1)

    if (sub.recovered) {
      transforms.push(`Row ${legacyRowId}: recovered "${sub.value}" from zero-width text`)
    }

    const account = accountId.get(acctName)
    if (!account) {
      warnings.push(`Row ${legacyRowId}: unknown account "${acctName}", skipped`)
      return
    }

    const isOpening = OPENING_BALANCE_HINTS.some((re) => note !== null && re.test(note))
    if (isOpening) {
      transforms.push(
        `Row ${legacyRowId}: "${note}" flagged as an opening balance, not income — the sheet booked it as Salary`,
      )
    }

    // Investment/Land -> a transfer into the asset account.
    if (sub.value === ASSET_SUBCATEGORY && catName === 'Investment') {
      txns.push({
        id: id('txn', legacyRowId), type: 'transfer', occurredOn,
        amountMinor: amount, tipsMinor: 0, feeMinor: 0,
        accountId: account, counterAccountId: landAccountId,
        categoryId: null, personId: null, note, isOpening: false, legacyRowId,
      })
      transfers = pesewas(transfers + amount)
      assetPurchases = pesewas(assetPurchases + amount)
      transforms.push(
        `Row ${legacyRowId}: ${format(amount)} land purchase reclassified from expense to a transfer into ${ASSET_ACCOUNT_NAME}`,
      )
      return
    }

    // Loan Repayment -> a transfer into the liability account. The person stays
    // attached: it changes no total, since transfers are not spending, but it
    // keeps the repayment in the history of dealings with that person.
    if (catName === LIABILITY_CATEGORY) {
      let lender: string | null = null
      if (sub.value && (PEOPLE.has(sub.value) || sub.recovered)) {
        peopleNames.add(sub.value)
        lender = id('person', sub.value)
      }
      txns.push({
        id: id('txn', legacyRowId), type: 'transfer', occurredOn,
        amountMinor: amount, tipsMinor: 0, feeMinor: 0,
        accountId: account, counterAccountId: liabilityAccountId,
        categoryId: null, personId: lender, note, isOpening: false, legacyRowId,
      })
      transfers = pesewas(transfers + amount)
      transforms.push(
        `Row ${legacyRowId}: ${format(amount)} repayment reclassified from expense to a transfer into ${LIABILITY_ACCOUNT_NAME} — it is money owed, not money spent`,
      )
      return
    }

    if (sheetType === 'Transfer') {
      // The sheet's one transfer put the source in Payment Method and the
      // destination in Account, which no other row does.
      const source = accountId.get(readText(row.getCell('I')).value) ?? null
      const destination = account
      const from = source !== null && source !== destination
        ? source
        : (accountId.get('Stanbic Bank') ?? destination)
      if (from === destination) {
        warnings.push(`Row ${legacyRowId}: transfer source and destination are the same, skipped`)
        return
      }
      txns.push({
        id: id('txn', legacyRowId), type: 'transfer', occurredOn,
        amountMinor: amount, tipsMinor: 0, feeMinor: 0,
        accountId: from, counterAccountId: destination,
        categoryId: null, personId: null, note, isOpening: false, legacyRowId,
      })
      transfers = pesewas(transfers + amount)
      transforms.push(
        `Row ${legacyRowId}: transfer given an explicit source and destination — the sheet encoded these in Payment Method and Account`,
      )
      return
    }

    const kind = sheetType === 'Income' ? 'income' : 'expense'
    let personId: string | null = null
    let categoryId: string | null = null

    if (catName) {
      const parentId = catIndex.get(`${kind}||${catName}`) ?? addCategory(catName, kind, null)
      categoryId = parentId
      if (sub.value) {
        if (PEOPLE.has(sub.value) || sub.recovered) {
          peopleNames.add(sub.value)
          personId = id('person', sub.value)
          transforms.push(
            `Row ${legacyRowId}: "${sub.value}" moved from subcategory to person, keeping category "${catName}"`,
          )
        } else {
          categoryId =
            catIndex.get(`${kind}|${parentId}|${sub.value}`) ??
            addCategory(sub.value, kind, parentId)
        }
      }
    }

    txns.push({
      id: id('txn', legacyRowId), type: kind, occurredOn,
      amountMinor: amount, tipsMinor: kind === 'expense' ? tips : 0, feeMinor: 0,
      accountId: account, counterAccountId: null,
      categoryId, personId, note, isOpening, legacyRowId,
    })

    if (isOpening) return
    if (kind === 'expense') expenses = pesewas(expenses + amount + tips)
    else income = pesewas(income + amount)
  })

  const people: Seed['people'] = [...peopleNames].sort().map((name) => ({
    id: id('person', name),
    name,
    memberUserId: MEMBER_PEOPLE.has(name) ? 'pending-invite' : null,
  }))
  transforms.push(
    `Extracted ${people.length} people from subcategories — "Beb" appeared under both Family and Loan Repayment, which is why subcategory totals double-counted`,
  )

  // The sheet's dashboard iterated a hardcoded list of 12 categories while
  // Settings defined 13, so Family never appeared.
  const topLevel = categories.filter((c) => c.parentId === null && c.kind === 'expense')
  transforms.push(
    `Imported ${topLevel.length} top-level expense categories; the sheet's dashboard only ever charted 12 of them`,
  )

  for (const [date, count] of seenDates) {
    if (count > 5) {
      warnings.push(
        `${count} transactions share the date ${date} — the entry form's default. Imported unchanged, as agreed.`,
      )
    }
  }

  return {
    seed: { categories, people },
    analysis: { accounts, txns },
    report: {
      counts: {
        accounts: accounts.length,
        categories: categories.length,
        people: people.length,
        transactions: txns.length,
      },
      transforms,
      warnings,
      totals: {
        expenses: format(expenses),
        income: format(income),
        transfers: format(transfers),
        assetPurchases: format(assetPurchases),
      },
    },
  }
}

// --- cli --------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const arg = (flag: string, fallback: string) => {
    const i = args.indexOf(flag)
    return i >= 0 ? (args[i + 1] ?? fallback) : fallback
  }

  const workbook = arg('--workbook', path.join('docs', 'Spending_Tracker_GHS.xlsx'))
  const out = arg('--out', path.join('src', 'db', 'seed.json'))

  const { seed, report } = await importWorkbook(workbook)
  writeFileSync(out, `${JSON.stringify(seed, null, 2)}\n`)

  if (args.includes('--json')) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  console.log(`\nRead ${workbook}\n`)
  console.log(`  Seeded to ${out} — the taxonomy only:`)
  console.log('    Categories ', report.counts.categories)
  console.log('    People     ', report.counts.people)
  console.log('\n  Not seeded. You add accounts and type every balance at setup:')
  console.log('    Accounts in the sheet     ', report.counts.accounts)
  console.log('    Transactions in the sheet ', report.counts.transactions)
  console.log('\n  What the sheet actually meant:')
  console.log('  Expenses        ', report.totals.expenses)
  console.log('  Income          ', report.totals.income)
  console.log('  Transfers       ', report.totals.transfers)
  console.log('  Of which assets ', report.totals.assetPurchases)

  const grouped = new Map<string, number>()
  for (const t of report.transforms) {
    const key = t
      .replace(/^Row \d+: /, 'Row N: ')
      .replace(/"[^"]*"/g, '"…"')
      .replace(/₵ [\d,.]+/, '₵ …')
    grouped.set(key, (grouped.get(key) ?? 0) + 1)
  }
  console.log(`\n  Transforms (${report.transforms.length}):`)
  for (const [text, n] of grouped) console.log(`    ${n > 1 ? `${n}x ` : ''}${text}`)

  if (report.warnings.length) {
    console.log(`\n  Warnings (${report.warnings.length}):`)
    for (const w of report.warnings) console.log(`    ${w}`)
  }
  console.log()
}

const invokedDirectly =
  process.argv[1] !== undefined && process.argv[1].endsWith('import-workbook.ts')

if (invokedDirectly) {
  main().catch((err: unknown) => {
    console.error(err)
    process.exit(1)
  })
}
