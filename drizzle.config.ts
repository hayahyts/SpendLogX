import type { Config } from 'drizzle-kit'

/**
 * Two dialects, two migration folders, one source of truth per side.
 * `src/db/schema.drift.test.ts` fails the build if the two schemas diverge.
 *
 *   npx drizzle-kit generate --config drizzle.config.ts
 */
export default {
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/db/schema.sqlite.ts',
  out: './drizzle/sqlite',
} satisfies Config
