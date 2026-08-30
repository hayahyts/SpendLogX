import type { Config } from 'drizzle-kit'

export default {
  dialect: 'postgresql',
  schema: './src/db/schema.pg.ts',
  out: './drizzle/pg',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
} satisfies Config
