/**
 * Sync, as two phones against one server.
 *
 * Real SQLite on each side via better-sqlite3, and a fake server that behaves
 * the way the Postgres in `supabase/setup.sql` does — most importantly, it
 * stamps `updated_at` itself, so the phones' own clocks never order anything.
 * `scripts/verify-rls.sql` proves the real server does the same.
 */

import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { ZERO, parseCedis as money } from '@/domain/money'
import { isoDate } from '@/domain/period'
import { balances } from '@/domain/ledger'
import type { Txn } from '@/domain/ledger'
import type { Member, State } from '@/store/store'
import {
  type LocalDb, SYNCED_TABLES, hydrate, migrate, pendingCount, persistAction,
} from '@/db/local'
import { type Transport, pull, push, sync } from './engine'
import type { Row, SyncedTable } from './rows'

const TODAY = isoDate('2026-08-30')

function open(): LocalDb {
  const raw = new Database(':memory:')
  raw.pragma('foreign_keys = ON')
  const db: LocalDb = {
    run: (sql, params = []) => {
      if (params.length === 0 && !sql.includes('?')) raw.exec(sql)
      else raw.prepare(sql).run(...(params as unknown[]))
    },
    all: <T>(sql: string, params: readonly unknown[] = []) =>
      raw.prepare(sql).all(...(params as unknown[])) as T[],
  }
  migrate(db)
  return db
}

/**
 * The server, in memory.
 *
 * It stamps `updated_at` on every write from its own clock, exactly as the
 * trigger in setup.sql does — which is the whole reason the phones never have
 * to compare their clocks with each other.
 */
function fakeServer() {
  const tables = new Map<string, Map<string, Row>>()
  for (const t of SYNCED_TABLES) tables.set(t, new Map())
  let clock = 0

  const of = (t: SyncedTable) => tables.get(t) as Map<string, Row>

  return {
    tables,
    /** Every write in one call shares an instant, as a transaction does. */
    transport(): Transport {
      return {
        upsert: async (table, rows) => {
          clock++
          const stamp = new Date(Date.UTC(2026, 7, 30, 0, 0, 0, clock)).toISOString()
          for (const row of rows) {
            of(table).set(String(row['id']), { ...row, updated_at: stamp })
          }
        },
        fetch: async (table, since, limit) => {
          const all = [...of(table).values()]
            .filter((r) => since === null || String(r['updated_at']) >= since)
            .sort((a, b) => String(a['updated_at']).localeCompare(String(b['updated_at'])))
          return all.slice(0, limit)
        },
      }
    },
    count: (t: SyncedTable) => of(t).size,
    row: (t: SyncedTable, id: string) => of(t).get(id),
  }
}

const owner: Member = {
  id: 'm_a', userId: 'u_a', name: 'Kwesi',
  email: 'kwesi@example.com', role: 'owner', isCurrentUser: true,
}
const partner: Member = {
  id: 'm_b', userId: 'u_b', name: 'Beb',
  email: 'beb@example.com', role: 'member', isCurrentUser: true,
}

function onboard(db: LocalDb, member: Member): void {
  persistAction(db, {
    type: 'completeOnboarding',
    householdId: 'hh_1',
    householdName: 'Home',
    inviteCode: 'KWB4T7',
    member,
  })
}

function account(id: string, name: string, opening: string, order: number) {
  return {
    id, name, kind: 'cash' as const,
    openingBalance: money(opening), openingBalanceOn: TODAY,
    hasFees: false, archived: false, sortOrder: order,
  }
}

function txn(over: Partial<Txn> & { id: string }): Txn {
  return {
    type: 'expense', occurredOn: TODAY, amount: money('53'),
    tips: ZERO, fee: ZERO, accountId: 'ac_cash',
    counterAccountId: null, categoryId: null, personId: null,
    note: 'Bread', isOpening: false,
    ...over,
  }
}

describe('the outbox', () => {
  let db: LocalDb
  beforeEach(() => {
    db = open()
    onboard(db, owner)
  })

  it('queues every write, and one row once however many times it is edited', () => {
    persistAction(db, { type: 'addAccount', account: account('ac_cash', 'Cash', '500', 0) })
    const t = txn({ id: 't_1' })
    persistAction(db, { type: 'addTxn', txn: t })
    persistAction(db, { type: 'updateTxn', txn: { ...t, amount: money('99') } })
    persistAction(db, { type: 'updateTxn', txn: { ...t, amount: money('120') } })

    expect(db.all('SELECT row_id FROM outbox WHERE table_name = ?', ['txn'])).toHaveLength(1)
  })

  it('treats a soft delete as one more version of the row, not a special case', () => {
    persistAction(db, { type: 'addAccount', account: account('ac_cash', 'Cash', '500', 0) })
    persistAction(db, { type: 'addTxn', txn: txn({ id: 't_1' }) })
    persistAction(db, { type: 'deleteTxn', id: 't_1' })

    const queued = db.all<{ row_id: string }>(
      'SELECT row_id FROM outbox WHERE table_name = ?', ['txn'],
    )
    expect(queued).toEqual([{ row_id: 't_1' }])
  })
})

describe('push', () => {
  it('sends the row as it is now, not as it was when it was queued', async () => {
    const db = open()
    onboard(db, owner)
    persistAction(db, { type: 'addAccount', account: account('ac_cash', 'Cash', '500', 0) })
    const t = txn({ id: 't_1', note: 'Bread' })
    persistAction(db, { type: 'addTxn', txn: t })
    persistAction(db, { type: 'updateTxn', txn: { ...t, note: 'Bread and milk' } })

    const server = fakeServer()
    await push(db, server.transport())

    expect(server.row('txn', 't_1')?.['note']).toBe('Bread and milk')
    expect(pendingCount(db)).toBe(0)
  })

  it('converts SQLite 0/1 into real booleans on the way up', async () => {
    const db = open()
    onboard(db, owner)
    persistAction(db, {
      type: 'addAccount',
      account: { ...account('ac_x', 'Old', '0', 0), archived: true },
    })

    const server = fakeServer()
    await push(db, server.transport())

    expect(server.row('account', 'ac_x')?.['is_active']).toBe(false)
  })

  it('leaves nothing queued once it succeeds, and everything queued when it fails', async () => {
    const db = open()
    onboard(db, owner)
    const before = pendingCount(db)
    expect(before).toBeGreaterThan(0)

    const failing: Transport = {
      upsert: async () => { throw new Error('offline') },
      fetch: async () => [],
    }
    await expect(push(db, failing)).rejects.toThrow('offline')
    expect(pendingCount(db)).toBe(before)

    const server = fakeServer()
    await push(db, server.transport())
    expect(pendingCount(db)).toBe(0)
  })
})

describe('two phones', () => {
  it('carries a transaction from one to the other, and agrees on the balance', async () => {
    const server = fakeServer()
    const transport = server.transport()

    const a = open()
    onboard(a, owner)
    persistAction(a, { type: 'addAccount', account: account('ac_cash', 'Cash', '500', 0) })
    persistAction(a, { type: 'addTxn', txn: txn({ id: 't_1', amount: money('53'), note: 'Bread' }) })
    await sync(a, transport)

    // A second phone, joining a household that already exists.
    const b = open()
    onboard(b, { ...partner, id: 'm_b' })
    await sync(b, transport)

    const stateB = hydrate(b, TODAY) as State
    expect(stateB.txns.map((t) => t.note)).toContain('Bread')
    expect(stateB.accounts.map((x) => x.name)).toContain('Cash')

    const stateA = hydrate(a, TODAY) as State
    expect(balances(stateB.accounts, stateB.txns).get('ac_cash'))
      .toBe(balances(stateA.accounts, stateA.txns).get('ac_cash'))
  })

  it('carries a soft delete across, so a row removed on one phone leaves the other', async () => {
    const server = fakeServer()
    const transport = server.transport()

    const a = open()
    onboard(a, owner)
    persistAction(a, { type: 'addAccount', account: account('ac_cash', 'Cash', '500', 0) })
    persistAction(a, { type: 'addTxn', txn: txn({ id: 't_1' }) })
    await sync(a, transport)

    const b = open()
    onboard(b, partner)
    await sync(b, transport)
    expect((hydrate(b, TODAY) as State).txns).toHaveLength(1)

    persistAction(a, { type: 'deleteTxn', id: 't_1' })
    await sync(a, transport)
    await sync(b, transport)

    expect((hydrate(b, TODAY) as State).txns).toHaveLength(0)
    // The tombstone is still a row, which is what stops it coming back.
    expect(b.all('SELECT id FROM txn WHERE deleted_at IS NOT NULL')).toHaveLength(1)
  })

  it('keeps an unpushed local edit rather than letting a pull overwrite it', async () => {
    const server = fakeServer()
    const transport = server.transport()

    const a = open()
    onboard(a, owner)
    persistAction(a, { type: 'addAccount', account: account('ac_cash', 'Cash', '500', 0) })
    const t = txn({ id: 't_1', note: 'Bread' })
    persistAction(a, { type: 'addTxn', txn: t })
    await sync(a, transport)

    const b = open()
    onboard(b, partner)
    await sync(b, transport)

    // B edits while offline; A edits the same row and gets its edit up first.
    persistAction(b, { type: 'updateTxn', txn: { ...t, note: 'B was here' } })
    persistAction(a, { type: 'updateTxn', txn: { ...t, note: 'A was here' } })
    await sync(a, transport)

    // B pulls. Its own edit is still queued, so the server's copy must not
    // land on top of it — that would silently lose what was typed.
    await pull(b, transport)
    expect((hydrate(b, TODAY) as State).txns[0]?.note).toBe('B was here')

    // Once B pushes, its edit is the newest and both phones agree on it.
    await sync(b, transport)
    await sync(a, transport)
    expect((hydrate(a, TODAY) as State).txns[0]?.note).toBe('B was here')
    expect((hydrate(b, TODAY) as State).txns[0]?.note).toBe('B was here')
  })

  it('is not fooled by a phone whose clock is a decade slow', async () => {
    const server = fakeServer()
    const transport = server.transport()

    const a = open()
    onboard(a, owner)
    persistAction(a, { type: 'addAccount', account: account('ac_cash', 'Cash', '500', 0) })
    await sync(a, transport)

    const b = open()
    onboard(b, partner)
    await sync(b, transport)

    // A's clock is wrong: its row carries a timestamp from 2016. The server
    // stamps its own on arrival, so B's cursor cannot step over it.
    persistAction(a, { type: 'addTxn', txn: txn({ id: 't_slow', note: 'From the past' }) })
    a.run("UPDATE txn SET updated_at = '2016-01-01T00:00:00.000Z' WHERE id = 't_slow'")
    await sync(a, transport)
    await sync(b, transport)

    expect((hydrate(b, TODAY) as State).txns.map((t) => t.note)).toContain('From the past')
  })

  it('re-syncing changes nothing once both phones are level', async () => {
    const server = fakeServer()
    const transport = server.transport()

    const a = open()
    onboard(a, owner)
    persistAction(a, { type: 'addAccount', account: account('ac_cash', 'Cash', '500', 0) })
    persistAction(a, { type: 'addTxn', txn: txn({ id: 't_1' }) })
    await sync(a, transport)

    const b = open()
    onboard(b, partner)
    await sync(b, transport)

    const before = hydrate(b, TODAY) as State
    const again = await sync(b, transport)
    expect(again.pushed).toBe(0)
    expect(hydrate(b, TODAY)).toEqual(before)
  })
})

describe('the pull cursor', () => {
  it('survives a failed pull: nothing is skipped on the next attempt', async () => {
    const server = fakeServer()
    const transport = server.transport()

    const a = open()
    onboard(a, owner)
    persistAction(a, { type: 'addAccount', account: account('ac_cash', 'Cash', '500', 0) })
    persistAction(a, { type: 'addTxn', txn: txn({ id: 't_1' }) })
    await sync(a, transport)

    const b = open()
    onboard(b, partner)

    let calls = 0
    const flaky: Transport = {
      upsert: transport.upsert,
      fetch: async (table, since, limit) => {
        calls++
        if (calls === 3) throw new Error('connection lost')
        return transport.fetch(table, since, limit)
      },
    }
    await expect(sync(b, flaky)).rejects.toThrow('connection lost')

    // Nothing was recorded as pulled, so the retry starts from where it began.
    await sync(b, transport)
    expect((hydrate(b, TODAY) as State).txns).toHaveLength(1)
  })
})
