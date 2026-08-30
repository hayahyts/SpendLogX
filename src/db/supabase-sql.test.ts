/**
 * supabase/setup.sql is what gets pasted into the Supabase SQL editor, so it
 * is the only description of the database the phone actually talks to. It is
 * generated from the drizzle migrations rather than maintained by hand; this
 * fails if the committed copy is stale, which would mean the app was built
 * against a schema nobody ever ran.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { build } from '../../scripts/gen-supabase-sql'

const root = path.join(__dirname, '..', '..')
const setup = readFileSync(path.join(root, 'supabase', 'setup.sql'), 'utf8')

describe('supabase/setup.sql', () => {
  it('is what the generator produces from the migrations and the policies', () => {
    // Run from the repository root, as `npm run supabase:sql` does.
    const cwd = process.cwd()
    try {
      process.chdir(root)
      expect(setup).toBe(build())
    } finally {
      process.chdir(cwd)
    }
  })

  it('turns row-level security on for every synced table, and forces it', () => {
    for (const table of [
      'household', 'household_member', 'category', 'person',
      'account', 'account_valuation', 'txn',
    ]) {
      expect(setup).toContain(`alter table public.${table}`)
    }
    expect(setup.match(/enable row level security/g)).toHaveLength(7)
    expect(setup.match(/force row level security/g)).toHaveLength(7)
  })

  it('grants no delete anywhere, because a sync needs the tombstone', () => {
    expect(setup).not.toMatch(/for delete/i)
  })

  it('never trusts the client for updated_at', () => {
    expect(setup).toContain('new.updated_at := now()')
  })
})
