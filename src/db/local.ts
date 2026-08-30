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
import { MIGRATIONS } from './ddl'

/** What both drivers can do. */
export interface LocalDb {
  run(sql: string, params?: readonly unknown[]): void
  all<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): T[]
}

/**
 * Bring the database up to the current schema.
 *
 * `user_version` counts migrations already applied, so an install that shipped
 * with only the first one runs the rest and nothing else. Running every
 * migration every time would fail on the second launch, and skipping them all
 * once the file exists would strand a phone on an old shape.
 */
export function migrate(db: LocalDb): void {
  const [row] = db.all<{ user_version: number }>('PRAGMA user_version')
  const applied = row?.user_version ?? 0
  for (let i = applied; i < MIGRATIONS.length; i++) {
    for (const statement of MIGRATIONS[i]?.statements ?? []) db.run(statement)
    db.run(`PRAGMA user_version = ${i + 1}`)
  }
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
  id: string; user_id: string; email: string | null; display_name: string; role: string
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
  const [household] = db.all<{ id: string; name: string; invite_code: string | null }>(
    'SELECT id, name, invite_code FROM household WHERE deleted_at IS NULL LIMIT 1',
  )
  if (household === undefined) return null

  // Which member is holding the phone is a fact about this device, not about
  // the household, so it is stored here rather than pulled down with the rows.
  const [me] = db.all<{ user_id: string }>('SELECT user_id FROM sync_state WHERE id = 1')

  const members: Member[] = db
    .all<MemberRow>(
      'SELECT id, user_id, email, display_name, role FROM household_member WHERE deleted_at IS NULL ORDER BY created_at',
    )
    .map((r, i) => ({
      id: r.id,
      userId: r.user_id,
      name: r.display_name,
      email: r.email ?? r.user_id,
      role: r.role === 'owner' ? 'owner' : 'member',
      isCurrentUser: me === undefined ? i === 0 : r.user_id === me.user_id,
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
    household: {
      id: household.id,
      name: household.name,
      inviteCode: household.invite_code,
    },
    accounts,
    categories,
    people,
    members,
    txns,
    valuations,
    pendingSync: pendingCount(db),
  }
}

// --- writes ------------------------------------------------------------------

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"

/**
 * The tables that sync, in an order that satisfies every foreign key. Push and
 * pull both walk it — forwards, so a parent always lands before its children.
 */
export const SYNCED_TABLES = [
  'household', 'household_member', 'category', 'person',
  'account', 'account_valuation', 'txn',
] as const

export type SyncedTable = (typeof SYNCED_TABLES)[number]

/**
 * Mark a row as having local changes Postgres has not seen.
 *
 * The entry holds no payload: the pusher reads the row when it pushes, so
 * repeated edits collapse into one upsert and a soft delete needs no special
 * case — the tombstone is simply the row's latest version.
 */
function dirty(db: LocalDb, table: SyncedTable, rowId: string): void {
  db.run(
    `INSERT INTO outbox (table_name, row_id, queued_at) VALUES (?, ?, ${NOW})
     ON CONFLICT (table_name, row_id) DO UPDATE SET queued_at = ${NOW}`,
    [table, rowId],
  )
}

/** How many rows are waiting to go up. Shown as a count, never as a warning. */
export function pendingCount(db: LocalDb): number {
  const [row] = db.all<{ n: number }>('SELECT COUNT(*) AS n FROM outbox')
  return row?.n ?? 0
}

/** The household this device belongs to, or null before onboarding. */
export function householdId(db: LocalDb): string | null {
  const [row] = db.all<{ id: string }>('SELECT id FROM household LIMIT 1')
  return row?.id ?? null
}

function requireHousehold(db: LocalDb): string {
  const id = householdId(db)
  if (id === null) throw new Error('no household: onboarding has not run')
  return id
}

function insertTxn(db: LocalDb, hh: string, t: Txn): void {
  db.run(
    `INSERT INTO txn (id, household_id, type, occurred_on, amount_minor, tips_minor, fee_minor,
       account_id, counter_account_id, category_id, person_id, note, is_opening)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      t.id, hh, t.type, t.occurredOn, t.amount, t.tips, t.fee,
      t.accountId, t.counterAccountId, t.categoryId, t.personId, t.note,
      t.isOpening ? 1 : 0,
    ],
  )
  dirty(db, 'txn', t.id)
}

function insertCategory(db: LocalDb, hh: string, c: Category, orIgnore = false): void {
  db.run(
    `INSERT ${orIgnore ? 'OR IGNORE ' : ''}INTO category
       (id, household_id, name, kind, parent_id, is_person_facing, archived, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [c.id, hh, c.name, c.kind, c.parentId, c.isPersonFacing ? 1 : 0, c.archived ? 1 : 0, c.sortOrder],
  )
  dirty(db, 'category', c.id)
}

function insertPerson(db: LocalDb, hh: string, p: Person, memberUserId: string | null): void {
  db.run(
    `INSERT INTO person (id, household_id, name, relation, member_user_id, archived)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [p.id, hh, p.name, p.relation, memberUserId, p.archived ? 1 : 0],
  )
  dirty(db, 'person', p.id)
}

function insertAccount(db: LocalDb, hh: string, a: Account): void {
  db.run(
    `INSERT INTO account (id, household_id, name, kind, opening_balance_minor, opening_balance_on, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [a.id, hh, a.name, a.kind, a.openingBalance, a.openingBalanceOn, a.archived ? 0 : 1, a.sortOrder],
  )
  dirty(db, 'account', a.id)
}

/** Write one applied store action through to disk. */
export function persistAction(db: LocalDb, action: Action): void {
  switch (action.type) {
    case 'completeOnboarding': {
      // OR IGNORE throughout: signing out and back in walks this path again,
      // and re-onboarding must never corrupt what is already there.
      const hh = action.householdId
      db.run(
        'INSERT OR IGNORE INTO household (id, name, invite_code) VALUES (?, ?, ?)',
        [hh, action.householdName, action.inviteCode],
      )
      dirty(db, 'household', hh)

      db.run(
        `INSERT OR IGNORE INTO household_member (id, household_id, user_id, email, display_name, role)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          action.member.id, hh, action.member.userId, action.member.email,
          action.member.name, action.member.role,
        ],
      )
      dirty(db, 'household_member', action.member.id)

      // This device's own identity. Not synced: it says who is holding the
      // phone, which is not a fact about the household.
      db.run(
        `INSERT INTO sync_state (id, device_id, user_id) VALUES (1, ?, ?)
         ON CONFLICT (id) DO UPDATE SET user_id = excluded.user_id`,
        [action.member.id, action.member.userId],
      )

      // The taxonomy ships with the app; it becomes rows the moment there is a
      // household for it to belong to.
      for (const c of seed.categories) {
        insertCategory(db, hh, {
          id: c.id,
          name: c.name,
          kind: c.kind === 'income' ? 'income' : 'expense',
          parentId: c.parentId,
          isPersonFacing: c.isPersonFacing,
          archived: false,
          sortOrder: c.sortOrder,
        }, true)
      }
      for (const p of seed.people) {
        db.run(
          'INSERT OR IGNORE INTO person (id, household_id, name, relation, member_user_id, archived) VALUES (?, ?, ?, ?, ?, 0)',
          [p.id, hh, p.name, null, p.memberUserId],
        )
        dirty(db, 'person', p.id)
      }
      return
    }

    case 'addTxn':
      insertTxn(db, requireHousehold(db), action.txn)
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
      dirty(db, 'txn', action.txn.id)
      return

    case 'deleteTxn':
      db.run(`UPDATE txn SET deleted_at = ${NOW}, updated_at = ${NOW} WHERE id = ?`, [action.id])
      dirty(db, 'txn', action.id)
      return

    case 'addPerson':
      insertPerson(db, requireHousehold(db), action.person, null)
      return

    case 'addAccount':
      insertAccount(db, requireHousehold(db), action.account)
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
      dirty(db, 'account', action.account.id)
      return

    case 'addValuation': {
      const id = `val_${action.valuation.accountId}_${action.valuation.asOf}`
      db.run(
        'INSERT INTO account_valuation (id, account_id, as_of, value_minor, note) VALUES (?, ?, ?, ?, ?)',
        [
          id, action.valuation.accountId, action.valuation.asOf,
          action.valuation.value, action.valuation.note ?? null,
        ],
      )
      dirty(db, 'account_valuation', id)
      return
    }

    case 'renameCategory':
      db.run(`UPDATE category SET name = ?, updated_at = ${NOW} WHERE id = ?`, [action.name, action.id])
      dirty(db, 'category', action.id)
      return

    case 'archiveCategory':
      db.run(
        `UPDATE category SET archived = ?, updated_at = ${NOW} WHERE id = ?`,
        [action.archived ? 1 : 0, action.id],
      )
      dirty(db, 'category', action.id)
      return

    case 'addCategory':
      insertCategory(db, requireHousehold(db), action.category)
      return
  }
}

/**
 * Attach this device to a Supabase account.
 *
 * Before the first sign-in a member row carries a local id, so the app works
 * with no account at all. Signing in rewrites that id to the real one — which
 * is what every row-level security policy on the server compares against — and
 * re-queues the row so the change goes up.
 */
export function linkMemberToAuth(
  db: LocalDb, previousUserId: string, userId: string, email: string,
): void {
  const [row] = db.all<{ id: string }>(
    'SELECT id FROM household_member WHERE user_id = ?', [previousUserId],
  )
  if (row === undefined) return
  db.run(
    `UPDATE household_member SET user_id = ?, email = ?, updated_at = ${NOW} WHERE id = ?`,
    [userId, email, row.id],
  )
  db.run('UPDATE sync_state SET user_id = ? WHERE id = 1', [userId])
  dirty(db, 'household_member', row.id)
}
