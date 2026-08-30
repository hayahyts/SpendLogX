/**
 * When sync runs, and what the rest of the app is told about it.
 *
 * The rules are deliberately dull: push after a change settles, pull on a
 * timer and whenever the app comes back to the foreground. Nothing here
 * blocks a screen — SQLite is already authoritative by the time any of this
 * happens, so a failed sync costs nothing but a later retry.
 *
 * What it reports is only ever what is true. There is no spinner claiming
 * progress that is not happening, and "saved on this phone" is what it says
 * when there is no account to sync to.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import { AppState } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import type { LocalDb } from '@/db/local'
import { hydrate, linkMemberToAuth, pendingCount } from '@/db/local'
import { useStore } from '@/store/store'
import { SYNC_CONFIGURED, supabase } from './client'
import { sync as runSync } from './engine'
import { supabaseTransport } from './transport'

/** How the sync line on Home reads. */
export type SyncPhase =
  | 'local'    // no account, or no project configured: this phone only
  | 'idle'     // signed in, nothing outstanding
  | 'syncing'
  | 'pending'  // signed in, changes waiting for a connection
  | 'error'

export interface SyncStatus {
  phase: SyncPhase
  pending: number
  lastSyncedAt: Date | null
  /** The real message from the last failure, never a euphemism. */
  error: string | null
  signedInAs: string | null
}

interface SyncApi {
  status: SyncStatus
  /** Sync now. Safe to call at any time; overlapping calls collapse into one. */
  syncNow: () => void
  signOut: () => Promise<void>
}

const SyncContext = createContext<SyncApi | null>(null)

const PULL_EVERY_MS = 60_000
/** Long enough that a burst of keystrokes is one push, short enough to feel live. */
const DEBOUNCE_MS = 2_000

export function SyncProvider({
  db, children,
}: {
  /** Null in demo mode and on web, where nothing is persisted to sync. */
  db: LocalDb | null
  children: ReactNode
}) {
  const { state, replaceAll, linkAuth } = useStore()
  const [session, setSession] = useState<Session | null>(null)
  const [phase, setPhase] = useState<SyncPhase>('local')
  const [pending, setPending] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Overlapping syncs would push the same rows twice and race on the cursor.
  const running = useRef(false)
  const again = useRef(false)

  useEffect(() => {
    if (supabase === null) return
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  /**
   * A phone that has just signed in still has the local identity it invented
   * before it had an account. Rewrite it to the real one, or every row-level
   * security policy on the server will refuse rows this household owns.
   */
  useEffect(() => {
    if (db === null || session === null) return
    const me = state.members.find((m) => m.isCurrentUser)
    if (me === undefined || me.userId === session.user.id) return
    linkMemberToAuth(db, me.userId, session.user.id, session.user.email ?? me.email)
    linkAuth(session.user.id, session.user.email ?? me.email)
  }, [db, session, state.members, linkAuth])

  const syncNow = useCallback(() => {
    if (db === null || supabase === null || session === null) return
    if (running.current) { again.current = true; return }

    running.current = true
    setPhase('syncing')
    setError(null)

    void (async () => {
      try {
        const result = await runSync(db, supabaseTransport(supabase))
        // Reading the whole state back is cheap at this size and cannot drift
        // from what is on disk, which a merge into the reducer could.
        if (result.pulled > 0) {
          const stored = hydrate(db, state.today)
          if (stored !== null) replaceAll(stored)
        }
        setPending(result.pending)
        setLastSyncedAt(new Date())
        setPhase(result.pending > 0 ? 'pending' : 'idle')
      } catch (e) {
        setPending(pendingCount(db))
        setError(e instanceof Error ? e.message : String(e))
        setPhase('error')
      } finally {
        running.current = false
        if (again.current) { again.current = false; syncNow() }
      }
    })()
  }, [db, session, state.today, replaceAll])

  // Anything typed lands in SQLite immediately; this only decides when it
  // leaves the phone. Debounced, so a burst of edits is one round trip.
  useEffect(() => {
    if (db === null) return
    const count = pendingCount(db)
    setPending(count)
    if (count === 0 || session === null) return
    const timer = setTimeout(syncNow, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [db, session, state.txns, state.accounts, state.categories, state.people, syncNow])

  // A pull on a timer, and one whenever the app comes back — which is when the
  // other phone's changes are most likely to be waiting.
  useEffect(() => {
    if (session === null) return
    const timer = setInterval(syncNow, PULL_EVERY_MS)
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') syncNow()
    })
    syncNow()
    return () => { clearInterval(timer); subscription.remove() }
  }, [session, syncNow])

  useEffect(() => {
    if (session === null) setPhase('local')
  }, [session])

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
    setSession(null)
    setPhase('local')
  }, [])

  const value = useMemo<SyncApi>(() => ({
    status: {
      phase: SYNC_CONFIGURED ? phase : 'local',
      pending,
      lastSyncedAt,
      error,
      signedInAs: session?.user.email ?? null,
    },
    syncNow,
    signOut,
  }), [phase, pending, lastSyncedAt, error, session, syncNow, signOut])

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSync(): SyncApi {
  const api = useContext(SyncContext)
  // Demo mode and the web export render without a provider; local-only is the
  // honest answer there, not a crash.
  return api ?? {
    status: {
      phase: 'local', pending: 0, lastSyncedAt: null, error: null, signedInAs: null,
    },
    syncNow: () => {},
    signOut: async () => {},
  }
}

/** The sync line, as one sentence. Never claims more than has happened. */
export function syncLine(status: SyncStatus): string {
  switch (status.phase) {
    case 'local':
      return 'Saved on this phone'
    case 'syncing':
      return 'Syncing…'
    case 'pending':
      return status.pending === 1
        ? '1 change waiting to sync'
        : `${status.pending} changes waiting to sync`
    case 'error':
      return status.pending === 0 ? 'Saved on this phone · sync failed' : 'Sync failed · saved here'
    case 'idle':
      return status.lastSyncedAt === null ? 'Synced' : `Synced ${timeAgo(status.lastSyncedAt)}`
  }
}

function timeAgo(at: Date): string {
  const seconds = Math.max(0, Math.round((Date.now() - at.getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.round(minutes / 60)}h ago`
}
