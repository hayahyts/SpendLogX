/**
 * The two schemas are written out twice, once per dialect, because Drizzle's
 * column builders differ. Writing them twice means they can drift, so this
 * asserts they haven't: same tables, same columns, same nullability, same
 * primary keys.
 */

import { getTableColumns, getTableName, is } from 'drizzle-orm'
import { SQLiteTable } from 'drizzle-orm/sqlite-core'
import { PgTable } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import * as sqlite from './schema.sqlite'
import * as pg from './schema.pg'

/** Local-only tables, deliberately absent from Postgres. */
const LOCAL_ONLY = new Set(['outbox', 'sync_state'])

interface Shape {
  notNull: boolean
  hasDefault: boolean
  primaryKey: boolean
}

function shapes(table: SQLiteTable | PgTable): Record<string, Shape> {
  const out: Record<string, Shape> = {}
  for (const column of Object.values(getTableColumns(table))) {
    out[column.name] = {
      notNull: column.notNull,
      hasDefault: column.hasDefault,
      primaryKey: column.primary,
    }
  }
  return out
}

function tablesOf<T>(mod: Record<string, unknown>, guard: (v: unknown) => v is T): Map<string, T> {
  const out = new Map<string, T>()
  for (const value of Object.values(mod)) {
    if (guard(value)) out.set(getTableName(value as never), value)
  }
  return out
}

const sqliteTables = tablesOf(sqlite, (v): v is SQLiteTable => is(v, SQLiteTable))
const pgTables = tablesOf(pg, (v): v is PgTable => is(v, PgTable))

describe('schema parity', () => {
  it('defines the same tables on both sides, bar the local-only ones', () => {
    const synced = [...sqliteTables.keys()].filter((n) => !LOCAL_ONLY.has(n)).sort()
    expect(synced).toEqual([...pgTables.keys()].sort())
  })

  it('keeps the local-only tables out of Postgres', () => {
    for (const name of LOCAL_ONLY) {
      expect(sqliteTables.has(name)).toBe(true)
      expect(pgTables.has(name)).toBe(false)
    }
  })

  for (const [name, sqliteTable] of sqliteTables) {
    if (LOCAL_ONLY.has(name)) continue

    it(`"${name}" has matching columns in both dialects`, () => {
      const pgTable = pgTables.get(name)
      expect(pgTable, `"${name}" is missing from the Postgres schema`).toBeDefined()
      expect(shapes(sqliteTable)).toEqual(shapes(pgTable as PgTable))
    })
  }
})

describe('money columns', () => {
  const MONEY = /_minor$/

  it('are integers on both sides, so no amount can be fractional', () => {
    for (const [name, table] of [...sqliteTables, ...pgTables]) {
      for (const column of Object.values(getTableColumns(table))) {
        if (!MONEY.test(column.name)) continue
        expect(
          column.columnType,
          `${name}.${column.name} must be an integer column, got ${column.columnType}`,
        ).toMatch(/Integer/i)
      }
    }
  })

  it('are the only place money is stored', () => {
    // A column named like money that isn't suffixed _minor is a column somebody
    // will eventually put a float in.
    const suspicious: string[] = []
    for (const [name, table] of sqliteTables) {
      for (const column of Object.values(getTableColumns(table))) {
        const isDateOrTime = /_(on|at)$/.test(column.name)
        const soundsLikeMoney = /amount|balance|value|price|total|fee|tip/i.test(column.name)
        if (soundsLikeMoney && !isDateOrTime && !MONEY.test(column.name)) {
          suspicious.push(`${name}.${column.name}`)
        }
      }
    }
    expect(suspicious).toEqual([])
  })
})

describe('dates', () => {
  it('stores transaction dates as dates, not timestamps', () => {
    const occurredOn = getTableColumns(pg.txn).occurredOn
    expect(occurredOn.columnType).toBe('PgDateString')
  })
})
