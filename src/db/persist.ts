/**
 * Wires the pure persistence logic to the phone's SQLite.
 *
 * Native only: on web there is no expo-sqlite runtime here, so the app runs in
 * memory — the APK is the deliverable, and the web export exists for review.
 * Nothing in this module is imported by tests; `local.ts` carries the logic
 * and is tested against better-sqlite3.
 */

import { openDatabaseSync } from 'expo-sqlite'
import type { IsoDate } from '@/domain/period'
import { type LocalDb, hydrate, migrate, persistAction } from './local'
import type { Persistence } from './persist.types'

export type { Persistence } from './persist.types'

export function openPersistence(today: IsoDate): Persistence | null {
  const sqlite = openDatabaseSync('spendlogx.db')
  sqlite.execSync('PRAGMA foreign_keys = ON;')

  const db: LocalDb = {
    run: (sql, params = []) => {
      sqlite.runSync(sql, params as never[])
    },
    all: <T>(sql: string, params: readonly unknown[] = []) =>
      sqlite.getAllSync<T>(sql, params as never[]),
  }

  migrate(db)

  return {
    db,
    stored: hydrate(db, today),
    persist: (action) => {
      try {
        persistAction(db, action)
      } catch (e) {
        // A failed write must never take the UI down with it; the in-memory
        // state is still correct for this session.
        console.warn('[persist]', e)
      }
    },
  }
}
