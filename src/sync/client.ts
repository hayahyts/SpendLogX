/**
 * The Supabase client, and whether there is one at all.
 *
 * The URL and publishable key are read from the environment at build time. The
 * publishable key is public by design — it identifies the project, not a
 * person, and row-level security on the database is what actually keeps one
 * household's rows away from another's. Nothing here can widen that.
 *
 * When either value is missing the app is not broken, it is simply local-only:
 * `supabase` is null, sync never runs, and the sync line says so.
 */

import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const SYNC_CONFIGURED = url !== '' && key !== ''

export const supabase: SupabaseClient | null = SYNC_CONFIGURED
  ? createClient(url, key, {
      auth: {
        // The session lives in the phone's own storage and is refreshed in the
        // background, so a signed-in phone stays signed in across launches.
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        // Nothing here handles a redirect: sign-in is a six-digit code typed
        // into the app, not a link that reopens it.
        detectSessionInUrl: false,
      },
    })
  : null
