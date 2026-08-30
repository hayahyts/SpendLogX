import type { LocalDb } from './local'
import type { Action, State } from '@/store/store'

export interface Persistence {
  /** Stored state, or null when onboarding has never been completed. */
  stored: State | null
  persist: (action: Action) => void
  /** The open database, for the sync layer to read and write rows through. */
  db: LocalDb
}
