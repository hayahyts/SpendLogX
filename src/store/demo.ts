/**
 * The content the designs were drawn against.
 *
 * The shipped app starts empty — no accounts, no balances, no transactions —
 * so this exists purely so the screens can be seen and reviewed with the same
 * data the mockups used. Every figure the UI then shows is *computed* from
 * these rows by `src/domain`, never transcribed from the mockups, which is what
 * makes the screens a real check on the model rather than a picture of one.
 *
 * `EXPO_PUBLIC_DEMO=0` starts empty instead.
 */

import { ZERO, parseCedis as c } from '@/domain/money'
import { isoDate } from '@/domain/period'
import type { Txn } from '@/domain/ledger'
import { type Account, type Member, type Person, type State, emptyState } from './store'
import seed from '@/db/seed.json'

const TODAY = isoDate('2026-06-28')
const OPENS = isoDate('2026-06-01')

const account = (
  name: string, kind: Account['kind'], balance: string,
  sortOrder: number, hasFees = false,
): Account => ({
  id: `acct_${name.toLowerCase().replace(/\W+/g, '_')}`,
  name, kind,
  openingBalance: c(balance),
  openingBalanceOn: OPENS,
  hasFees, archived: false, sortOrder,
})

/**
 * Opening balances as of 1 June, chosen so that replaying the ten June rows
 * lands exactly on the balances the mockups show — Cash ₵1,240.50, MoMo
 * ₵4,182.50, Stanbic ₵18,455.00, and a spendable total of ₵23,878.00.
 *
 * Deriving them this way rather than typing the end figures is the point: the
 * screens then prove the ledger arrives at the designed numbers, instead of
 * displaying them.
 */
const accounts: Account[] = [
  account('Cash', 'cash', '2868.50', 0),
  account('MoMo Wallet', 'mobile_money', '5642.50', 1, true),
  account('Stanbic Bank', 'bank', '16315.00', 2),
  account('Land', 'asset', '0', 3),
]

const members: Member[] = [
  {
    id: 'm_k', userId: 'local_demo_k', name: 'Kwesi',
    email: 'kwesi@example.com', role: 'owner', isCurrentUser: true,
  },
  {
    id: 'm_b', userId: 'local_demo_b', name: 'Beb',
    email: 'beb@example.com', role: 'member', isCurrentUser: false,
  },
]

const relations: Record<string, string> = {
  Dedei: 'Extended family · sister',
  Koshie: 'Extended family · niece',
  Odarkor: 'Extended family · niece',
  Beb: 'Household',
  Ibrahim: 'Family · son',
  'Abdur-Rahman': 'Family · son',
  Jalil: 'Extended family',
  'Auntie (Maxwell)': 'Extended family',
  Nateki: 'Extended family',
  Mommy: 'Extended family',
  Mother: 'Extended family',
  Aryee: 'Extended family',
  Sammy: 'Extended family',
  Omama: 'Extended family',
  Fauzia: 'Friend',
  'Nana Adjoa': 'Friend',
}

function findCategory(name: string, parent?: string): string | null {
  const cats = seed.categories
  if (parent !== undefined) {
    const top = cats.find((x) => x.name === parent && x.parentId === null)
    const child = cats.find((x) => x.name === name && x.parentId === top?.id)
    return child?.id ?? top?.id ?? null
  }
  return cats.find((x) => x.name === name && x.parentId === null)?.id ?? null
}

const personId = (name: string) => seed.people.find((p) => p.name === name)?.id ?? null

const A = {
  cash: 'acct_cash',
  momo: 'acct_momo_wallet',
  stanbic: 'acct_stanbic_bank',
  land: 'acct_land',
} as const

interface Row {
  on: string
  type: Txn['type']
  amount: string
  tips?: string
  fee?: string
  cat?: [string, string?]
  person?: string
  account: string
  to?: string
  note: string
  by?: string
}

/** The ten rows from the brief, dated 24–28 June 2026. */
const rows: Row[] = [
  { on: '2026-06-28', type: 'expense', amount: '53.00', cat: ['Groceries', 'Food Drink'], account: A.cash, note: 'Bread and biscuit' },
  { on: '2026-06-28', type: 'expense', amount: '300.00', cat: ['Extended Family'], person: 'Dedei', account: A.cash, note: 'Buying corn husk' },
  { on: '2026-06-28', type: 'expense', amount: '200.00', tips: '10.00', cat: ['Fuel', 'Transport'], account: A.cash, note: 'Fuel for Generator' },
  { on: '2026-06-27', type: 'expense', amount: '1000.00', cat: ['Extended Family'], person: 'Dedei', account: A.momo, note: 'Dr Safo last payment' },
  { on: '2026-06-27', type: 'expense', amount: '800.00', tips: '60.00', cat: ['Family'], person: 'Beb', account: A.stanbic, note: 'Spa Treatment', by: 'm_b' },
  { on: '2026-06-26', type: 'expense', amount: '460.00', cat: ['Masjid', 'Charity'], account: A.momo, note: 'Work at cemetery' },
  { on: '2026-06-26', type: 'expense', amount: '75.00', cat: ['Extended Family'], person: 'Koshie', account: A.cash, note: 'Feeding fee' },
  { on: '2026-06-25', type: 'expense', amount: '990.00', cat: ['Extended Family'], person: 'Odarkor', account: A.cash, note: 'Dr Safo part payment' },
  { on: '2026-06-25', type: 'transfer', amount: '20000.00', account: A.stanbic, to: A.land, note: 'Payment to Mr Richard' },
  { on: '2026-06-24', type: 'income', amount: '23000.00', cat: ['Main job', 'Salary'], account: A.stanbic, note: 'June salary' },
]

const txns: Txn[] = rows.map((r, i) => ({
  id: `demo_${i}`,
  type: r.type,
  occurredOn: isoDate(r.on),
  amount: c(r.amount),
  tips: r.tips === undefined ? ZERO : c(r.tips),
  fee: r.fee === undefined ? ZERO : c(r.fee),
  accountId: r.account,
  counterAccountId: r.to ?? null,
  categoryId: r.cat ? findCategory(r.cat[0], r.cat[1]) : null,
  personId: r.person ? personId(r.person) : null,
  note: r.note,
  isOpening: false,
}))

export function demoState(): State {
  const base = emptyState(TODAY)
  return {
    ...base,
    household: { id: 'hh_demo', name: 'Home', inviteCode: 'KWB4T7' },
    accounts,
    members,
    people: base.people.map((p) => ({ ...p, relation: relations[p.name] ?? null })),
    txns,
    valuations: [
      { accountId: A.land, asOf: isoDate('2026-06-26'), value: c('22000.00'), note: 'Agent estimate' },
    ],
    pendingSync: 2,
    today: TODAY,
  }
}

/** Who entered a row. Kept beside the demo rows rather than in the store. */
export const enteredBy: Record<string, string> = Object.fromEntries(
  rows.map((r, i) => [`demo_${i}`, r.by ?? 'm_k']),
)

/**
 * The initial to show in a row's metadata — only when the *partner* entered it.
 * Your own entries are unmarked, since almost all of them are yours.
 */
export function partnerInitial(state: State, txnId: string): string | undefined {
  const by = enteredBy[txnId]
  if (by === undefined) return undefined
  const member = state.members.find((m) => m.id === by)
  if (!member || member.isCurrentUser) return undefined
  return member.name.slice(0, 1)
}

export const DEMO_ENABLED = process.env.EXPO_PUBLIC_DEMO !== '0'

export function initialState(): State {
  return DEMO_ENABLED ? demoState() : emptyState(isoDate(new Date().toISOString().slice(0, 10)))
}
