/**
 * Push and pull, as pure logic over the two-method database interface and a
 * small transport. No Supabase types here — `transport.ts` supplies those —
 * so the whole merge is testable against a real SQLite file and a fake server.
 *
 * The shape of the thing:
 *
 *   Push  reads every row the outbox has marked dirty and upserts it. The
 *         outbox holds no payload, so ten edits to one transaction cost one
 *         upsert, and a soft delete needs no special case — the tombstone is
 *         just the row's latest version.
 *
 *   Pull  asks for every row changed at or after the cursor and writes it in.
 *         A row that is currently dirty locally is skipped: this phone is
 *         about to push it, and that push will be the newest version on the
 *         server, so local wins without anything having to compare clocks.
 *
 * That last point is the whole conflict story. Two phones with skewed clocks
 * cannot be ordered by their own timestamps, so they are never asked to be:
 * Postgres stamps `updated_at` itself on every write, and the only question
 * asked locally is "is this row dirty", which has an exact answer.
 */

import { type LocalDb, SYNCED_TABLES, type SyncedTable, pendingCount } from '@/db/local'
import { type Row, columnsOf, toLocal, toRemote } from './rows'

/** What the engine needs from a server. Implemented over Supabase. */
export interface Transport {
  /** Upsert rows into one table. Rejects on failure; never partially reports. */
  upsert(table: SyncedTable, rows: Row[]): Promise<void>
  /**
   * Rows changed at or after `since`, oldest first, at most `limit` of them.
   * `since` is null on a first pull, which asks for everything.
   */
  fetch(table: SyncedTable, since: string | null, limit: number): Promise<Row[]>
}

/**
 * A page big enough that one push never splits across two pulls.
 *
 * PostgREST runs a batch upsert in a single transaction, so every row in it
 * carries the identical `now()`. The cursor is inclusive to cope with that,
 * which costs one page of re-read and guarantees nothing is stepped over.
 */
const PAGE = 500

export interface SyncResult {
  pushed: number
  pulled: number
  pending: number
}

// --- the cursor --------------------------------------------------------------

/**
 * The newest `updated_at` any pulled row carried, kept exactly as the server
 * wrote it. Not normalised and never this phone's clock: the next pull asks
 * for everything from here on, and rounding it forward would skip rows.
 */
function cursor(db: LocalDb): string | null {
  const [row] = db.all<{ last_pulled_at: string | null }>(
    'SELECT last_pulled_at FROM sync_state WHERE id = 1',
  )
  return row?.last_pulled_at ?? null
}

function setCursor(db: LocalDb, at: string): void {
  db.run(
    `INSERT INTO sync_state (id, device_id, last_pulled_at) VALUES (1, '', ?)
     ON CONFLICT (id) DO UPDATE SET last_pulled_at = excluded.last_pulled_at`,
    [at],
  )
}

// --- push --------------------------------------------------------------------

interface DirtyEntry {
  table_name: string
  row_id: string
  queued_at: string
}

export async function push(db: LocalDb, transport: Transport): Promise<number> {
  let pushed = 0

  // Forwards through the table order, so a parent row always lands before the
  // rows that reference it.
  for (const table of SYNCED_TABLES) {
    const entries = db.all<DirtyEntry>(
      'SELECT table_name, row_id, queued_at FROM outbox WHERE table_name = ? ORDER BY queued_at',
      [table],
    )
    if (entries.length === 0) continue

    for (let i = 0; i < entries.length; i += PAGE) {
      const page = entries.slice(i, i + PAGE)
      const rows: Row[] = []
      for (const entry of page) {
        const [row] = db.all<Row>(
          `SELECT ${columnsOf(table).join(', ')} FROM ${table} WHERE ${idColumn(table)} = ?`,
          [entry.row_id],
        )
        // The row can be gone if something outside the app removed it. Nothing
        // to send; the outbox entry is cleared below either way.
        if (row !== undefined) rows.push(toRemote(table, row))
      }

      if (rows.length > 0) await transport.upsert(table, rows)

      // Clear only entries untouched since they were read. An edit that landed
      // mid-flight rewrote `queued_at`, and that row must stay dirty so the
      // next push carries it.
      for (const entry of page) {
        db.run(
          'DELETE FROM outbox WHERE table_name = ? AND row_id = ? AND queued_at = ?',
          [entry.table_name, entry.row_id, entry.queued_at],
        )
      }
      pushed += rows.length
    }
  }

  return pushed
}

/** Every synced table is keyed by `id`. Named rather than assumed. */
function idColumn(_table: SyncedTable): string {
  return 'id'
}

// --- pull --------------------------------------------------------------------

export async function pull(db: LocalDb, transport: Transport): Promise<number> {
  const since = cursor(db)
  let applied = 0
  let newest = since

  for (const table of SYNCED_TABLES) {
    let from = since
    for (;;) {
      const remote = await transport.fetch(table, from, PAGE)
      if (remote.length === 0) break

      for (const raw of remote) {
        const stamp = typeof raw['updated_at'] === 'string' ? raw['updated_at'] : null
        if (stamp !== null && (newest === null || stamp > newest)) newest = stamp

        const id = raw['id']
        if (typeof id !== 'string') continue

        // Dirty locally means this phone holds a newer version it has not sent
        // yet. Overwriting it here would silently lose what was typed.
        if (isDirty(db, table, id)) continue

        writeRow(db, table, toLocal(table, raw))
        applied++
      }

      if (remote.length < PAGE) break
      const last = remote[remote.length - 1]?.['updated_at']
      if (typeof last !== 'string' || last === from) break
      from = last
    }
  }

  if (newest !== null && newest !== since) setCursor(db, newest)
  return applied
}

function isDirty(db: LocalDb, table: SyncedTable, id: string): boolean {
  return db.all('SELECT 1 FROM outbox WHERE table_name = ? AND row_id = ?', [table, id]).length > 0
}

/**
 * Write a pulled row in, replacing whatever is there.
 *
 * An upsert rather than an insert-or-update pair: the row may be one this
 * phone has never seen, or one it already has an older copy of, and both cases
 * end the same way.
 */
function writeRow(db: LocalDb, table: SyncedTable, row: Row): void {
  const columns = columnsOf(table)
  const assignments = columns.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`)
  db.run(
    `INSERT INTO ${table} (${columns.join(', ')})
     VALUES (${columns.map(() => '?').join(', ')})
     ON CONFLICT (id) DO UPDATE SET ${assignments.join(', ')}`,
    columns.map((c) => row[c] ?? null),
  )
}

// --- both --------------------------------------------------------------------

/**
 * Push, then pull.
 *
 * In that order, so a row typed a moment ago is on the server before this
 * phone asks what changed — otherwise the pull would hand back a stale copy
 * that the dirty check then has to throw away, and the round trip is wasted.
 */
export async function sync(db: LocalDb, transport: Transport): Promise<SyncResult> {
  const pushed = await push(db, transport)
  const pulled = await pull(db, transport)
  return { pushed, pulled, pending: pendingCount(db) }
}
