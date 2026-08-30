/**
 * The local database. SQLite is authoritative: a save writes here and returns,
 * and sync happens afterwards. Nothing in the UI waits on the network.
 */

import { drizzle } from 'drizzle-orm/expo-sqlite'
import { openDatabaseSync } from 'expo-sqlite'
import * as schema from './schema.sqlite'

const DATABASE_NAME = 'spendlogx.db'

const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true })

// Foreign keys are off by default in SQLite, which would let the app write a
// transaction pointing at an account that does not exist.
sqlite.execSync('PRAGMA foreign_keys = ON;')

export const db = drizzle(sqlite, { schema })
export { schema, sqlite, DATABASE_NAME }
