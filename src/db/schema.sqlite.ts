/**
 * The on-device schema. SQLite is authoritative: writes land here first and
 * sync to Postgres afterwards, which is what keeps a save at 20ms instead of a
 * round-trip to a distant region.
 *
 * Kept in step with `schema.pg.ts` by `schema.drift.test.ts`.
 */

import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`

/** Columns every synced row carries. */
const syncable = {
  createdAt: text('created_at').notNull().default(now),
  updatedAt: text('updated_at').notNull().default(now),
  deletedAt: text('deleted_at'),
}

export const household = sqliteTable('household', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ...syncable,
})

export const householdMember = sqliteTable(
  'household_member',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull().references(() => household.id),
    userId: text('user_id').notNull(),
    displayName: text('display_name').notNull(),
    role: text('role', { enum: ['owner', 'member'] }).notNull(),
    ...syncable,
  },
  (t) => [uniqueIndex('household_member_unique').on(t.householdId, t.userId)],
)

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull().references(() => household.id),
    name: text('name').notNull(),
    /**
     * 'asset' is Land: it holds value but is not spendable.
     * 'liability' is money owed: its balance is negative until it is cleared.
     */
    kind: text('kind', {
      enum: ['cash', 'mobile_money', 'bank', 'asset', 'liability'],
    }).notNull(),
    /**
     * Pesewas. Entered by hand at first run, not derived from the spreadsheet.
     *
     * Negative on a liability: an account holding a debt of 11,599 opens at
     * -1159900, so repaying it moves the balance up toward zero and net worth
     * can simply add it. No sign flipping anywhere else.
     */
    openingBalanceMinor: integer('opening_balance_minor').notNull().default(0),
    openingBalanceOn: text('opening_balance_on').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...syncable,
  },
  (t) => [index('account_household').on(t.householdId)],
)

/** Market value of an asset account over time. Cost basis lives in `txn`. */
export const accountValuation = sqliteTable(
  'account_valuation',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull().references(() => account.id),
    asOf: text('as_of').notNull(),
    valueMinor: integer('value_minor').notNull(),
    note: text('note'),
    ...syncable,
  },
  (t) => [index('account_valuation_account').on(t.accountId, t.asOf)],
)

export const category = sqliteTable(
  'category',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull().references(() => household.id),
    name: text('name').notNull(),
    kind: text('kind', { enum: ['expense', 'income'] }).notNull(),
    /** Null for a top-level category. Exactly two levels deep. */
    parentId: text('parent_id'),
    /** Whether the add-transaction screen offers a person for this category. */
    isPersonFacing: integer('is_person_facing', { mode: 'boolean' }).notNull().default(false),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    ...syncable,
  },
  (t) => [index('category_household').on(t.householdId, t.kind)],
)

export const person = sqliteTable(
  'person',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull().references(() => household.id),
    name: text('name').notNull(),
    relation: text('relation'),
    /** Set when this person is also a household member, as Beb is. */
    memberUserId: text('member_user_id'),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    ...syncable,
  },
  (t) => [index('person_household').on(t.householdId)],
)

export const txn = sqliteTable(
  'txn',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull().references(() => household.id),
    type: text('type', { enum: ['expense', 'income', 'transfer'] }).notNull(),
    /** A calendar date, never an instant. */
    occurredOn: text('occurred_on').notNull(),
    /** Pesewas, always positive. Direction comes from `type`. */
    amountMinor: integer('amount_minor').notNull(),
    tipsMinor: integer('tips_minor').notNull().default(0),
    feeMinor: integer('fee_minor').notNull().default(0),
    accountId: text('account_id').notNull().references(() => account.id),
    counterAccountId: text('counter_account_id').references(() => account.id),
    categoryId: text('category_id').references(() => category.id),
    personId: text('person_id').references(() => person.id),
    note: text('note'),
    /** A migrated opening balance. Excluded from income and expense totals. */
    isOpening: integer('is_opening', { mode: 'boolean' }).notNull().default(false),
    createdBy: text('created_by'),
    /** Row ID 1..40 from the spreadsheet, for provenance. */
    legacyRowId: integer('legacy_row_id'),
    ...syncable,
  },
  (t) => [
    index('txn_household_date').on(t.householdId, t.occurredOn),
    index('txn_account').on(t.accountId),
    index('txn_category').on(t.categoryId),
    index('txn_person').on(t.personId),
  ],
)

/** Local mutations awaiting a push. Local only — never synced upward itself. */
export const outbox = sqliteTable(
  'outbox',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tableName: text('table_name').notNull(),
    rowId: text('row_id').notNull(),
    op: text('op', { enum: ['upsert', 'delete'] }).notNull(),
    payload: text('payload', { mode: 'json' }).notNull(),
    queuedAt: text('queued_at').notNull().default(now),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
  },
  (t) => [index('outbox_queued').on(t.queuedAt)],
)

/** Single row holding the pull cursor. */
export const syncState = sqliteTable('sync_state', {
  id: integer('id').primaryKey(),
  lastPulledAt: text('last_pulled_at'),
  deviceId: text('device_id').notNull(),
})
