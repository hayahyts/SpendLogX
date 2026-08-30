import type { Action, State } from '@/store/store'

export interface Persistence {
  /** Stored state, or null when onboarding has never been completed. */
  stored: State | null
  persist: (action: Action) => void
}
