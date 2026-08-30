/**
 * The local database, as pure logic.
 *
 * Everything here speaks a two-method interface — run and all — that both
 * expo-sqlite (on the phone) and better-sqlite3 (in the tests) satisfy, so the
 * whole persistence layer is exercised by vitest against a real SQLite file
 * rather than trusted on the device.
 *
 * Writes go through `persistAction`: the store stays pure and in memory, and
 * every action it applies is written through here. Deletes are soft
 * (`deleted_at`), because the sync design needs a tombstone; hydrate filters
 * them out.
 */

import { pesewas, type Money } from '@/domain/money'
import { isoDate, type IsoDate } from '@/domain/period'
import type { Txn } from '@/domain/ledger'
import type { AccountKind } from '@/domain/networth'
import type {
  Account, Action, Category, Member, Person, State,
} from '@/store/store'
import { emptyState } from '@/store/store'
import seed from './seed.json'
import { DDL_STATEMENTS } from './ddl'

/** What both drivers can do. */
export interface LocalDb {
  run(sql: string, params?: readonly unknown[]): void
  all<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): T[]
}

export const HOUSEHOLD_ID = 'hh_local'
const SCHEMA_VERSION = 1

export function migrate(db: LocalDb): void {
  const [row] = db.all<{ user_version: number }>('PRAGMA user_version')
  if ((row?.user_version ?? 0) >= SCHEMA_VERSION) return
  for (const statement of DDL_STATEMENTS) db.run(statement)
  db.run(`PRAGMA user_version = ${SCHEMA_VERSION}`)
}

// --- hydration ---------------------------------------------------------------

interface AccountRow {
  id: string; name: string; kind: string
  opening_balance_minor: number; opening_balance_on: string
  is_active: number; sort_order: number
}

interface CategoryRow {
  id: string; name: string; kind: string; parent_id: string | null
  is_person_facing: number; archived: number; sort_order: number
}

interface PersonRow {
  id: string; name: string; relation: string | null
  member_user_id: string | null; archived: number
}

interface MemberRow {
  id: string; user_id: string; display_name: string; role: string
}

interface TxnRow {
  id: string; type: string; occurred_on: string
  amount_minor: number; tips_minor: number; fee_minor: number
  account_id: string; counter_account_id: string | null
  category_id: string | null; person_id: string | null
  note: string | null; is_opening: number
}

interface ValuationRow {
  id: string; account_id: string; as_of: string; value_minor: number; note: string | null
}

/**
 * Everything stored, as app state — or null when onboarding has never been
 * completed, which is what routes a fresh install to the sign-in screen.
 */
export function hydrate(db: LocalDb, today: IsoDate): State | null {
  const [household] = db.all<{ id: string; name: string }>(
    'SELECT id, name FROM household WHERE deleted_at IS NULL LIMIT 1',
  )
  if (household === undefined) return null

  const members: Member[] = db
    .all<MemberRow>(
      'SELECT id, user_id, display_name, role FROM household_member WHERE deleted_at IS NULL ORDER BY created_at',
    )
    .map((r, i) => ({
      id: r.id,
      name: r.display_name,
      email: r.user_id,
      role: r.role === 'owner' ? 'owner' : 'member',
      // One device, one signed-in person: the first (owner) row is you.
      isCurrentUser: i === 0,
    }))

  const accounts: Account[] = db
    .all<AccountRow>(
      'SELECT id, name, kind, opening_balance_minor, opening_balance_on, is_active, sort_order FROM account WHERE deleted_at IS NULL ORDER BY sort_order',
    )
    .map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind as AccountKind,
      openingBalance: pesewas(r.opening_balance_minor) as Money,
      openingBalanceOn: isoDate(r.opening_balance_on),
      // The schema has no fees column; the rule is a property of the rail.
      hasFees: r.kind === 'mobile_money',
      archived: r.is_active === 0,
      sortOrder: r.sort_order,
    }))

  const categories: Category[] = db
    .all<CategoryRow>(
      'SELECT id, name, kind, parent_id, is_person_facing, archived, sort_order FROM category WHERE deleted_at IS NULL ORDER BY sort_order',
    )
    .map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind === 'income' ? 'income' : 'expense',
      parentId: r.parent_id,
      isPersonFacing: r.is_person_facing === 1,
      archived: r.archived === 1,
      sortOrder: r.sort_order,
    }))

  const people: Person[] = db
    .all<PersonRow>(
      'SELECT id, name, relation, member_user_id, archived FROM person WHERE deleted_at IS NULL',
    )
    .map((r) => ({
      id: r.id,
      name: r.name,
      relation: r.relation,
      isMember: r.member_user_id !== null,
      archived: r.archived === 1,
    }))

  const txns: Txn[] = db
    .all<TxnRow>(
      'SELECT id, type, occurred_on, amount_minor, tips_minor, fee_minor, account_id, counter_account_id, category_id, person_id, note, is_opening FROM txn WHERE deleted_at IS NULL ORDER BY occurred_on DESC, created_at DESC',
    )
    .map((r) => ({
      id: r.id,
      type: r.type as Txn['type'],
      occurredOn: isoDate(r.occurred_on),
      amount: pesewas(r.amount_minor) as Money,
      tips: pesewas(r.tips_minor) as Money,
      fee: pesewas(r.fee_minor) as Money,
      accountId: r.account_id,
      counterAccountId: r.counter_account_id,
      categoryId: r.category_id,
      personId: r.person_id,
      note: r.note,
      isOpening: r.is_opening === 1,
    }))

  const valuations = db
    .all<ValuationRow>(
      'SELECT id, account_id, as_of, value_minor, note FROM account_valuation WHERE deleted_at IS NULL ORDER BY as_of',
    )
    .map((r) => ({
      accountId: r.account_id,
      asOf: isoDate(r.as_of),
      value: pesewas(r.value_minor) as Money,
      note: r.note,
    }))

  return {
    ...emptyState(today),
    accounts,
    categories,
    people,
    members,
    txns,
    valuations,
    pendingSync: 0,
  }
}

// --- writes ------------------------------------------------------------------

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"

function insertTxn(db: LocalDb, t: Txn): void {
  db.run(
    `INSERT INTO txn (id, household_id, type, occurred_on, amount_minor, tips_minor, fee_minor,
       account_id, counter_account_id, category_id, person_id, note, is_opening)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      t.id, HOUSEHOLD_ID, t.type, t.occurredOn, t.amount, t.tips, t.fee,
      t.accountId, t.counterAccountId, t.categoryId, t.personId, t.note,
      t.isOpening ? 1 : 0,
    ],
  )
}

function insertSeedCategory(db: LocalDb, c: Category): void {
  db.run(
    `INSERT OR IGNORE INTO category (id, household_id, name, kind, parent_id, is_person_facing, archived, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [c.id, HOUSEHOLD_ID, c.name, c.kind, c.parentId, c.isPersonFacing ? 1 : 0, c.archived ? 1 : 0, c.sortOrder],
  )
}

function insertCategory(db: LocalDb, c: Category): void {
  db.run(
    `INSERT INTO category (id, household_id, name, kind, parent_id, is_person_facing, archived, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [c.id, HOUSEHOLD_ID, c.name, c.kind, c.parentId, c.isPersonFacing ? 1 : 0, c.archived ? 1 : 0, c.sortOrder],
  )
}

function insertPerson(db: LocalDb, p: Person, memberUserId: string | null): void {
  db.run(
    `INSERT INTO person (id, household_id, name, relation, member_user_id, archived)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [p.id, HOUSEHOLD_ID, p.name, p.relation, memberUserId, p.archived ? 1 : 0],
  )
}

function insertAccount(db: LocalDb, a: Account): void {
  db.run(
    `INSERT INTO account (id, household_id, name, kind, opening_balance_minor, opening_balance_on, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [a.id, HOUSEHOLD_ID, a.name, a.kind, a.openingBalance, a.openingBalanceOn, a.archived ? 0 : 1, a.sortOrder],
  )
}

/** Write one applied store action through to disk. */
export function persistAction(db: LocalDb, action: Action): void {
  switch (action.type) {
    case 'completeOnboarding': {
      // OR IGNORE throughout: signing out and back in walks this path again,
      // and re-onboarding must never corrupt what is already there.
      db.run('INSERT OR IGNORE INTO household (id, name) VALUES (?, ?)', [HOUSEHOLD_ID, action.householdName])
      db.run(
        'INSERT OR IGNORE INTO household_member (id, household_id, user_id, display_name, role) VALUES (?, ?, ?, ?, ?)',
        [action.member.id, HOUSEHOLD_ID, action.member.email, action.member.name, action.member.role],
      )
      // The taxonomy ships with the app; it becomes rows the moment there is a
      // household for it to belong to.
      for (const c of seed.categories) {
        insertSeedCategory(db, {
          id: c.id,
          name: c.name,
          kind: c.kind === 'income' ? 'income' : 'expense',
          parentId: c.parentId,
          isPersonFacing: c.isPersonFacing,
          archived: false,
          sortOrder: c.sortOrder,
        })
      }
      for (const p of seed.people) {
        db.run(
          'INSERT OR IGNORE INTO person (id, household_id, name, relation, member_user_id, archived) VALUES (?, ?, ?, ?, ?, 0)',
          [p.id, HOUSEHOLD_ID, p.name, null, p.memberUserId],
        )
      }
      return
    }

    case 'addTxn':
      insertTxn(db, action.txn)
      return

    case 'updateTxn':
      db.run(
        `UPDATE txn SET occurred_on = ?, amount_minor = ?, tips_minor = ?, fee_minor = ?,
           account_id = ?, counter_account_id = ?, category_id = ?, person_id = ?, note = ?,
           updated_at = ${NOW}
         WHERE id = ?`,
        [
          action.txn.occurredOn, action.txn.amount, action.txn.tips, action.txn.fee,
          action.txn.accountId, action.txn.counterAccountId, action.txn.categoryId,
          action.txn.personId, action.txn.note, action.txn.id,
        ],
      )
      return

    case 'deleteTxn':
      db.run(`UPDATE txn SET deleted_at = ${NOW}, updated_at = ${NOW} WHERE id = ?`, [action.id])
      return

    case 'addPerson':
      insertPerson(db, action.person, null)
      return

    case 'addAccount':
      insertAccount(db, action.account)
      return

    case 'updateAccount':
      db.run(
        `UPDATE account SET name = ?, kind = ?, opening_balance_minor = ?, opening_balance_on = ?,
           is_active = ?, sort_order = ?, updated_at = ${NOW}
         WHERE id = ?`,
        [
          action.account.name, action.account.kind, action.account.openingBalance,
          action.account.openingBalanceOn, action.account.archived ? 0 : 1,
          action.account.sortOrder, action.account.id,
        ],
      )
      return

    case 'addValuation':
      db.run(
        'INSERT INTO account_valuation (id, account_id, as_of, value_minor, note) VALUES (?, ?, ?, ?, ?)',
        [
          `val_${action.valuation.accountId}_${action.valuation.asOf}`,
          action.valuation.accountId, action.valuation.asOf,
          action.valuation.value, action.valuation.note ?? null,
        ],
      )
      return

    case 'renameCategory':
      db.run(`UPDATE category SET name = ?, updated_at = ${NOW} WHERE id = ?`, [action.name, action.id])
      return

    case 'archiveCategory':
      db.run(
        `UPDATE category SET archived = ?, updated_at = ${NOW} WHERE id = ?`,
        [action.archived ? 1 : 0, action.id],
      )
      return

    case 'addCategory':
      insertCategory(db, action.category)
      return
  }
}
