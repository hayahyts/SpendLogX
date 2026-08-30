/**
 * The engine's `Transport`, over Supabase.
 *
 * Everything in here is one PostgREST call and a thrown error. No merge logic
 * and no state — that all lives in `engine.ts`, which is why the engine can be
 * tested against a fake server rather than a real project.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Transport } from './engine'
import type { Row, SyncedTable } from './rows'

export function supabaseTransport(client: SupabaseClient): Transport {
  return {
    async upsert(table, rows) {
      // No `.select()` chained, so supabase-js sends `Prefer: return=minimal`
      // and nothing is read back. That saves a round trip, and it means a
      // phone creating a household does not need permission to read the row it
      // has only just inserted — which it would not have until its own member
      // row lands a moment later.
      const { error } = await client.from(table).upsert(rows, { onConflict: 'id' })
      if (error) throw error
    },

    async fetch(table, since, limit) {
      let query = client.from(table).select('*').order('updated_at').limit(limit)
      // Inclusive, because a batch upsert stamps every row in it with the same
      // instant; asking for strictly-after could step over the rest of a batch.
      if (since !== null) query = query.gte('updated_at', since)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as Row[]
    },
  }
}

/**
 * The household this invite code belongs to, and this account added to it.
 *
 * A server function rather than a query, because someone joining is not a
 * member yet and so cannot read the household row. The function runs with the
 * privilege to look it up, adds the caller, and hands back only that one
 * household — a wrong code gets an error, never somebody else's rows.
 */
export async function joinHousehold(
  client: SupabaseClient, code: string, displayName: string,
): Promise<{ id: string; name: string; inviteCode: string; memberId: string }> {
  const { data, error } = await client.rpc('join_household', {
    p_invite_code: code.trim().toUpperCase(),
    p_display_name: displayName,
  })
  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('That code does not match a household.')
  return {
    id: String(row.id),
    name: String(row.name),
    inviteCode: String(row.invite_code),
    // Stored under the server's id, not one minted here: otherwise the pull
    // brings the same member down beside the local copy and the two collide.
    memberId: String(row.member_id),
  }
}

export type { Row, SyncedTable, Transport }
