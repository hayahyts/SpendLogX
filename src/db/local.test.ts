/**
 * The persistence layer against a real SQLite database.
 *
 * better-sqlite3 here, expo-sqlite on the phone — both behind the same
 * two-method interface, so what passes here is what runs there.
 */

import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { ZERO, parseCedis as money } from '@/domain/money'
import { isoDate } from '@/domain/period'
import type { Txn } from '@/domain/ledger'
import type { Member, State } from '@/store/store'
import { DDL } from './ddl'
import { HOUSEHOLD_ID, type LocalDb, hydrate, migrate, persistAction } from './local'
import seed from './seed.json'

const TODAY = isoDate('2026-08-30')

function open(): LocalDb {
  const raw = new Database(':memory:')
  raw.pragma('foreign_keys = ON')
  return {
    run: (sql, params = []) => {
      if (sql.trim().toUpperCase().startsWith('PRAGMA') || sql.includes(';\n') || !sql.includes('?')) {
        raw.exec(sql)
      } else {
        raw.prepare(sql).run(...(params as unknown[]))
      }
    },
    all: <T>(sql: string, params: readonly unknown[] = []) =>
      raw.prepare(sql).all(...(params as unknown[])) as T[],
  }
}

const member: Member = {
  id: 'm_1', name: 'Kwesi', email: 'kwesi@example.com', role: 'owner', isCurrentUser: true,
}

function onboarded(): LocalDb {
  const db = open()
  migrate(db)
  persistAction(db, { type: 'completeOnboarding', householdName: 'Home', member })
  return db
}

function txn(over: Partial<Txn>): Txn {
  return {
    id: `t_${Math.random().toString(36).slice(2)}`,
    type: 'expense',
    occurredOn: TODAY,
    amount: money('53'),
    tips: ZERO,
    fee: ZERO,
    accountId: 'a_cash',
    counterAccountId: null,
    categoryId: null,
    personId: null,
    note: 'Bread',
    isOpening: false,
    ...over,
  }
}

describe('the DDL module', () => {
  it('is byte-identical to the migration on disk', () => {
    // scripts/gen-ddl.ts copies the migration; this stops the copy drifting.
    const dir = path.join(__dirname, '..', '..', 'drizzle', 'sqlite')
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
    const sql = files.map((f) => readFileSync(path.join(dir, f), 'utf8')).join('\n')
    expect(DDL).toBe(sql)
  })
})

describe('migrate', () => {
  it('creates the schema once, and is safe to run again', () => {
    const db = open()
    migrate(db)
    migrate(db)
    expect(db.all('SELECT name FROM sqlite_master WHERE type = ?', ['table']).length)
      .toBeGreaterThan(5)
  })
})

describe('a fresh install', () => {
  it('hydrates to null until onboarding completes', () => {
    const db = open()
    migrate(db)
    expect(hydrate(db, TODAY)).toBeNull()
  })

  it('onboarding creates the household and turns the shipped taxonomy into rows', () => {
    const db = onboarded()
    const state = hydrate(db, TODAY)
    expect(state).not.toBeNull()
    expect(state?.members).toEqual([member])
    expect(state?.categories).toHaveLength(seed.categories.length)
    expect(state?.people).toHaveLength(seed.people.length)
    expect(state?.accounts).toEqual([])
    expect(state?.txns).toEqual([])
  })
})

describe('write-through round trips', () => {
  let db: LocalDb
  beforeEach(() => {
    db = onboarded()
    persistAction(db, {
      type: 'addAccount',
      account: {
        id: 'a_cash', name: 'Cash', kind: 'cash',
        openingBalance: money('500'), openingBalanceOn: TODAY,
        hasFees: false, archived: false, sortOrder: 0,
      },
    })
  })

  it('stores an account with its typed balance, negative included', () => {
    persistAction(db, {
      type: 'addAccount',
      account: {
        id: 'a_loan', name: 'Loan from Beb', kind: 'liability',
        openingBalance: money('-11599'), openingBalanceOn: TODAY,
        hasFees: false, archived: false, sortOrder: 1,
      },
    })
    const state = hydrate(db, TODAY) as State
    const loan = state.accounts.find((a) => a.id === 'a_loan')
    expect(loan?.openingBalance).toBe(money('-11599'))
    expect(loan?.kind).toBe('liability')
  })

  it('round-trips a transaction exactly, pesewas and all', () => {
    const t = txn({ amount: money('7000.47'), tips: money('10'), note: 'Fuel' })
    persistAction(db, { type: 'addTxn', txn: t })
    const state = hydrate(db, TODAY) as State
    expect(state.txns).toEqual([t])
  })

  it('updates in place', () => {
    const t = txn({})
    persistAction(db, { type: 'addTxn', txn: t })
    persistAction(db, { type: 'updateTxn', txn: { ...t, amount: money('99'), note: 'More bread' } })
    const state = hydrate(db, TODAY) as State
    expect(state.txns[0]?.amount).toBe(money('99'))
    expect(state.txns[0]?.note).toBe('More bread')
  })

  it('soft-deletes: gone from hydrate, still a row for sync to ship later', () => {
    const t = txn({})
    persistAction(db, { type: 'addTxn', txn: t })
    persistAction(db, { type: 'deleteTxn', id: t.id })
    expect((hydrate(db, TODAY) as State).txns).toEqual([])
    expect(db.all('SELECT id FROM txn WHERE deleted_at IS NOT NULL')).toHaveLength(1)
  })

  it('persists people, categories, renames and archivals', () => {
    persistAction(db, {
      type: 'addPerson',
      person: { id: 'p_new', name: 'Ama', relation: null, isMember: false, archived: false },
    })
    persistAction(db, {
      type: 'addCategory',
      category: {
        id: 'c_new', name: 'School', kind: 'expense', parentId: null,
        isPersonFacing: false, archived: false, sortOrder: 999,
      },
    })
    persistAction(db, { type: 'renameCategory', id: 'c_new', name: 'Education' })
    persistAction(db, { type: 'archiveCategory', id: 'c_new', archived: true })

    const state = hydrate(db, TODAY) as State
    expect(state.people.some((p) => p.name === 'Ama')).toBe(true)
    const cat = state.categories.find((x) => x.id === 'c_new')
    expect(cat?.name).toBe('Education')
    expect(cat?.archived).toBe(true)
  })

  it('persists a valuation against an asset', () => {
    persistAction(db, {
      type: 'addAccount',
      account: {
        id: 'a_land', name: 'Land', kind: 'asset',
        openingBalance: money('27500'), openingBalanceOn: TODAY,
        hasFees: false, archived: false, sortOrder: 2,
      },
    })
    persistAction(db, {
      type: 'addValuation',
      valuation: { accountId: 'a_land', asOf: TODAY, value: money('42000'), note: null },
    })
    const state = hydrate(db, TODAY) as State
    expect(state.valuations).toEqual([
      { accountId: 'a_land', asOf: TODAY, value: money('42000'), note: null },
    ])
  })

  it('enforces the ledger shape at the database, not just in code', () => {
    // No foreign-key ghosts: a txn against an account that does not exist fails.
    expect(() =>
      persistAction(db, { type: 'addTxn', txn: txn({ accountId: 'a_ghost' }) }),
    ).toThrow()
  })
})
