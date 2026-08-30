/**
 * Translating a row between the two dialects.
 *
 * SQLite has no boolean and no date: it stores 0 and 1, and ISO strings.
 * Postgres has both. Rather than hand-list which columns are which — a list
 * that would rot the first time a column was added — the shape is read off
 * `schema.sqlite.ts`, which `schema.drift.test.ts` already pins to the
 * Postgres side column for column.
 */

import { getTableColumns, getTableName } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import * as schema from '@/db/schema.sqlite'
import { SYNCED_TABLES, type SyncedTable } from '@/db/local'

export type Row = Record<string, unknown>

interface TableShape {
  columns: string[]
  booleans: Set<string>
}

const shapes = new Map<string, TableShape>()
for (const table of Object.values(schema) as SQLiteTable[]) {
  const columns: string[] = []
  const booleans = new Set<string>()
  for (const column of Object.values(getTableColumns(table))) {
    columns.push(column.name)
    if (column.columnType === 'SQLiteBoolean') booleans.add(column.name)
  }
  shapes.set(getTableName(table), { columns, booleans })
}

function shapeOf(table: SyncedTable): TableShape {
  const shape = shapes.get(table)
  if (shape === undefined) throw new Error(`no shape for table ${table}`)
  return shape
}

/** Every column of a synced table, for building a SELECT. */
export function columnsOf(table: SyncedTable): string[] {
  return shapeOf(table).columns
}

/** A row read out of SQLite, as Postgres wants it. */
export function toRemote(table: SyncedTable, row: Row): Row {
  const { booleans } = shapeOf(table)
  const out: Row = {}
  for (const [key, value] of Object.entries(row)) {
    out[key] = booleans.has(key) ? value === 1 || value === true : value
  }
  return out
}

/**
 * A row from Postgres, as SQLite wants it.
 *
 * Timestamps come back in the server's format — `+00:00` rather than `Z`, with
 * microseconds — and are normalised so that ordering a local query by
 * `updated_at` gives the same answer for a pulled row as for a typed one.
 */
export function toLocal(table: SyncedTable, row: Row): Row {
  const { columns, booleans } = shapeOf(table)
  const out: Row = {}
  for (const column of columns) {
    const value = row[column]
    if (value === undefined || value === null) {
      out[column] = null
    } else if (booleans.has(column)) {
      out[column] = value === true || value === 1 ? 1 : 0
    } else if (/_at$/.test(column) && typeof value === 'string') {
      out[column] = normaliseTimestamp(value)
    } else {
      out[column] = value
    }
  }
  return out
}

function normaliseTimestamp(value: string): string {
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? value : new Date(parsed).toISOString()
}

export { SYNCED_TABLES, type SyncedTable }
