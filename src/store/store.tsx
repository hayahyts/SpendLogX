/**
 * App state.
 *
 * Every figure any screen shows is computed by `src/domain` from this state —
 * nothing in the UI does arithmetic on money, and no screen holds a formatted
 * string. Persistence is not wired yet; this is the seam SQLite slots into,
 * and the shape is deliberately the same as the schema's.
 */

import {
  createContext, useCallback, useContext, useMemo, useReducer, type ReactNode,
} from 'react'
import { type Money, ZERO, parseCedis, pesewas } from '@/domain/money'
import { type IsoDate, isoDate } from '@/domain/period'
import type { Txn, TxnType } from '@/domain/ledger'
import { balances, spendAmount } from '@/domain/ledger'
import { type AccountKind, netWorth, type Valuation } from '@/domain/networth'
import seed from '@/db/seed.json'

export interface Account {
  id: string
  name: string
  kind: AccountKind
  openingBalance: Money
  openingBalanceOn: IsoDate
  /** MoMo charges to cash out; the transfer form offers a fee when this is on. */
  hasFees: boolean
  archived: boolean
  sortOrder: number
}

export interface Category {
  id: string
  name: string
  kind: 'expense' | 'income'
  parentId: string | null
  isPersonFacing: boolean
  archived: boolean
  sortOrder: number
}

export interface Person {
  id: string
  name: string
  relation: string | null
  /** Household members are viewable but excluded from "people you support". */
  isMember: boolean
  archived: boolean
}

export interface Member {
  id: string
  name: string
  email: string
  role: 'owner' | 'member'
  isCurrentUser: boolean
}

export interface State {
  accounts: Account[]
  categories: Category[]
  people: Person[]
  members: Member[]
  txns: Txn[]
  valuations: Valuation[]
  /** Pending sync operations. Shown as a count, never as a warning. */
  pendingSync: number
  today: IsoDate
}

type Action =
  | { type: 'addTxn'; txn: Txn }
  | { type: 'updateTxn'; txn: Txn }
  | { type: 'deleteTxn'; id: string }
  | { type: 'addPerson'; person: Person }
  | { type: 'addAccount'; account: Account }
  | { type: 'updateAccount'; account: Account }
  | { type: 'addValuation'; valuation: Valuation }
  | { type: 'renameCategory'; id: string; name: string }
  | { type: 'archiveCategory'; id: string; archived: boolean }

function reduce(s: State, a: Action): State {
  switch (a.type) {
    case 'addTxn':
      return { ...s, txns: [a.txn, ...s.txns], pendingSync: s.pendingSync + 1 }
    case 'updateTxn':
      return {
        ...s,
        txns: s.txns.map((t) => (t.id === a.txn.id ? a.txn : t)),
        pendingSync: s.pendingSync + 1,
      }
    case 'deleteTxn':
      return {
        ...s,
        txns: s.txns.filter((t) => t.id !== a.id),
        pendingSync: s.pendingSync + 1,
      }
    case 'addPerson':
      return { ...s, people: [...s.people, a.person] }
    case 'addAccount':
      return { ...s, accounts: [...s.accounts, a.account] }
    case 'updateAccount':
      return {
        ...s,
        accounts: s.accounts.map((x) => (x.id === a.account.id ? a.account : x)),
      }
    case 'addValuation':
      return { ...s, valuations: [...s.valuations, a.valuation] }
    case 'renameCategory':
      return {
        ...s,
        categories: s.categories.map((c) => (c.id === a.id ? { ...c, name: a.name } : c)),
      }
    case 'archiveCategory':
      return {
        ...s,
        categories: s.categories.map((c) =>
          c.id === a.id ? { ...c, archived: a.archived } : c,
        ),
      }
  }
}

// --- the taxonomy ships with the app; everything else is created by the user --

const seededCategories: Category[] = seed.categories.map((c) => ({
  id: c.id,
  name: c.name,
  kind: c.kind as 'expense' | 'income',
  parentId: c.parentId,
  isPersonFacing: c.isPersonFacing,
  archived: false,
  sortOrder: c.sortOrder,
}))

const seededPeople: Person[] = seed.people.map((p) => ({
  id: p.id,
  name: p.name,
  relation: null,
  isMember: p.memberUserId !== null,
  archived: false,
}))

export function emptyState(today: IsoDate): State {
  return {
    accounts: [],
    categories: seededCategories,
    people: seededPeople,
    members: [],
    txns: [],
    valuations: [],
    pendingSync: 0,
    today,
  }
}

// --- selectors ---------------------------------------------------------------

export function categoryPath(state: State, id: string | null): string {
  if (id === null) return 'Transfer'
  const cat = state.categories.find((c) => c.id === id)
  if (!cat) return '—'
  if (cat.parentId === null) return cat.name
  const parent = state.categories.find((c) => c.id === cat.parentId)
  return parent ? `${parent.name} › ${cat.name}` : cat.name
}

export function topLevel(state: State, kind: 'expense' | 'income'): Category[] {
  return state.categories
    .filter((c) => c.parentId === null && c.kind === kind && !c.archived)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function childrenOf(state: State, parentId: string): Category[] {
  return state.categories
    .filter((c) => c.parentId === parentId && !c.archived)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function accountById(state: State, id: string | null): Account | undefined {
  return id === null ? undefined : state.accounts.find((a) => a.id === id)
}

export function personById(state: State, id: string | null): Person | undefined {
  return id === null ? undefined : state.people.find((p) => p.id === id)
}

/**
 * Categories ranked by how recently they were used, for the add screen's chips.
 * Never a hardcoded list — the ordering is derived, the membership is the table.
 */
export function recentCategories(state: State, kind: 'expense' | 'income', limit = 6): Category[] {
  const seen = new Map<string, number>()
  state.txns.forEach((t, i) => {
    if (t.categoryId === null) return
    const cat = state.categories.find((c) => c.id === t.categoryId)
    if (!cat) return
    const top = cat.parentId ?? cat.id
    if (!seen.has(top)) seen.set(top, i)
  })
  const all = topLevel(state, kind)
  return [...all]
    .sort((a, b) => (seen.get(a.id) ?? 1e9) - (seen.get(b.id) ?? 1e9))
    .slice(0, limit)
}

/** People ranked by recent use, for the person strip. */
export function recentPeople(state: State, limit = 2): Person[] {
  const seen = new Map<string, number>()
  state.txns.forEach((t, i) => {
    if (t.personId !== null && !seen.has(t.personId)) seen.set(t.personId, i)
  })
  return [...state.people]
    .filter((p) => !p.archived)
    .sort((a, b) => (seen.get(a.id) ?? 1e9) - (seen.get(b.id) ?? 1e9))
    .slice(0, limit)
}

export function balanceOf(state: State, accountId: string): Money {
  return balances(state.accounts, state.txns).get(accountId) ?? ZERO
}

export function worth(state: State) {
  return netWorth(state.accounts, state.txns, state.valuations, state.today)
}

/** Does this transaction need a person picker? Driven by the category flag. */
export function isPersonFacing(state: State, categoryId: string | null): boolean {
  if (categoryId === null) return false
  const cat = state.categories.find((c) => c.id === categoryId)
  if (!cat) return false
  const top = cat.parentId === null ? cat : state.categories.find((c) => c.id === cat.parentId)
  return top?.isPersonFacing ?? false
}

// --- context -----------------------------------------------------------------

interface Store {
  state: State
  addTxn: (t: Omit<Txn, 'id'>) => Txn
  updateTxn: (t: Txn) => void
  deleteTxn: (id: string) => void
  addPerson: (name: string) => Person
  addAccount: (a: Omit<Account, 'id'>) => Account
  updateAccount: (a: Account) => void
  addValuation: (v: Valuation) => void
  renameCategory: (id: string, name: string) => void
  archiveCategory: (id: string, archived: boolean) => void
}

const StoreContext = createContext<Store | null>(null)

let counter = 0
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${counter++}`

export function StoreProvider({
  children, initial,
}: { children: ReactNode; initial: State }) {
  const [state, dispatch] = useReducer(reduce, initial)

  const addTxn = useCallback((t: Omit<Txn, 'id'>) => {
    const txn: Txn = { ...t, id: newId('txn') }
    dispatch({ type: 'addTxn', txn })
    return txn
  }, [])

  const addPerson = useCallback((name: string) => {
    const person: Person = {
      id: newId('person'), name, relation: null, isMember: false, archived: false,
    }
    dispatch({ type: 'addPerson', person })
    return person
  }, [])

  const addAccount = useCallback((a: Omit<Account, 'id'>) => {
    const account: Account = { ...a, id: newId('acct') }
    dispatch({ type: 'addAccount', account })
    return account
  }, [])

  const value = useMemo<Store>(
    () => ({
      state,
      addTxn,
      addPerson,
      addAccount,
      updateTxn: (txn) => dispatch({ type: 'updateTxn', txn }),
      deleteTxn: (id) => dispatch({ type: 'deleteTxn', id }),
      updateAccount: (account) => dispatch({ type: 'updateAccount', account }),
      addValuation: (valuation) => dispatch({ type: 'addValuation', valuation }),
      renameCategory: (id, name) => dispatch({ type: 'renameCategory', id, name }),
      archiveCategory: (id, archived) => dispatch({ type: 'archiveCategory', id, archived }),
    }),
    [state, addTxn, addPerson, addAccount],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore must be used inside StoreProvider')
  return s
}

export function useAppState(): State {
  return useStore().state
}

export { type Txn, type TxnType, type Money, type IsoDate, parseCedis, pesewas, isoDate, spendAmount }
