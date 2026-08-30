/**
 * The Supabase schema. Mirrors `schema.sqlite.ts` table-for-table and
 * column-for-column; `schema.drift.test.ts` fails the build if they diverge.
 *
 * Postgres carries the constraints SQLite cannot express as cleanly — the
 * transfer invariants below are the ones that keep balances derivable.
 */

import { sql } from 'drizzle-orm'
import {
  boolean, check, date, index, integer, pgTable, text, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core'

const syncable = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}

export const household = pgTable(
  'household',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** Six characters, typed by the second phone to join. */
    inviteCode: text('invite_code'),
    ...syncable,
  },
  (t) => [uniqueIndex('household_invite_code').on(t.inviteCode)],
)

export const householdMember = pgTable(
  'household_member',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull().references(() => household.id),
    /** The Supabase auth user id. Every RLS policy compares against this. */
    userId: text('user_id').notNull(),
    email: text('email'),
    displayName: text('display_name').notNull(),
    role: text('role', { enum: ['owner', 'member'] }).notNull(),
    ...syncable,
  },
  (t) => [uniqueIndex('household_member_unique').on(t.householdId, t.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull().references(() => household.id),
    name: text('name').notNull(),
    kind: text('kind', {
      enum: ['cash', 'mobile_money', 'bank', 'asset', 'liability'],
    }).notNull(),
    openingBalanceMinor: integer('opening_balance_minor').notNull().default(0),
    openingBalanceOn: date('opening_balance_on').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...syncable,
  },
  (t) => [index('account_household').on(t.householdId)],
)

export const accountValuation = pgTable(
  'account_valuation',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull().references(() => account.id),
    asOf: date('as_of').notNull(),
    valueMinor: integer('value_minor').notNull(),
    note: text('note'),
    ...syncable,
  },
  (t) => [index('account_valuation_account').on(t.accountId, t.asOf)],
)

export const category = pgTable(
  'category',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull().references(() => household.id),
    name: text('name').notNull(),
    kind: text('kind', { enum: ['expense', 'income'] }).notNull(),
    parentId: text('parent_id'),
    isPersonFacing: boolean('is_person_facing').notNull().default(false),
    archived: boolean('archived').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    ...syncable,
  },
  (t) => [index('category_household').on(t.householdId, t.kind)],
)

export const person = pgTable(
  'person',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull().references(() => household.id),
    name: text('name').notNull(),
    relation: text('relation'),
    memberUserId: text('member_user_id'),
    archived: boolean('archived').notNull().default(false),
    ...syncable,
  },
  (t) => [index('person_household').on(t.householdId)],
)

export const txn = pgTable(
  'txn',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull().references(() => household.id),
    type: text('type', { enum: ['expense', 'income', 'transfer'] }).notNull(),
    occurredOn: date('occurred_on').notNull(),
    amountMinor: integer('amount_minor').notNull(),
    tipsMinor: integer('tips_minor').notNull().default(0),
    feeMinor: integer('fee_minor').notNull().default(0),
    accountId: text('account_id').notNull().references(() => account.id),
    counterAccountId: text('counter_account_id').references(() => account.id),
    categoryId: text('category_id').references(() => category.id),
    personId: text('person_id').references(() => person.id),
    note: text('note'),
    isOpening: boolean('is_opening').notNull().default(false),
    createdBy: text('created_by'),
    legacyRowId: integer('legacy_row_id'),
    ...syncable,
  },
  (t) => [
    index('txn_household_date').on(t.householdId, t.occurredOn),
    index('txn_account').on(t.accountId),
    index('txn_category').on(t.categoryId),
    index('txn_person').on(t.personId),

    // Direction comes from `type`; a signed amount would let the same row mean
    // two things.
    check('txn_amount_positive', sql`${t.amountMinor} > 0`),
    check('txn_tips_non_negative', sql`${t.tipsMinor} >= 0`),
    check('txn_fee_non_negative', sql`${t.feeMinor} >= 0`),

    // A transfer has a destination, is not categorised, and carries no tip.
    check(
      'txn_transfer_shape',
      sql`(${t.type} <> 'transfer') OR (
        ${t.counterAccountId} IS NOT NULL
        AND ${t.counterAccountId} <> ${t.accountId}
        AND ${t.categoryId} IS NULL
        AND ${t.tipsMinor} = 0
      )`,
    ),

    // An expense or income touches one account and carries no transfer fee.
    check(
      'txn_single_sided_shape',
      sql`(${t.type} = 'transfer') OR (
        ${t.counterAccountId} IS NULL AND ${t.feeMinor} = 0
      )`,
    ),

    // Only expenses are tipped.
    check(
      'txn_tips_on_expenses_only',
      sql`(${t.type} = 'expense') OR (${t.tipsMinor} = 0)`,
    ),
  ],
)
