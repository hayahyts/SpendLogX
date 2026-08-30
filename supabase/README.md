# Turning sync on

One paste, once. Until you do it the app works exactly as it does now — every
figure correct, saved on this phone — and the sync line says so rather than
pretending.

## 1. Create the schema

1. Open your project at <https://supabase.com/dashboard>, then **SQL Editor**.
2. Paste the whole of [`setup.sql`](./setup.sql) and run it.

It is safe to run again, so if you are unsure whether it went through, run it a
second time. It creates the seven tables, turns on row-level security, and adds
the `join_household` function the second phone needs.

You should see `Success. No rows returned`. Notices about triggers or policies
"not existing, skipping" are expected on a first run — the file drops before it
creates so that a re-run is clean.

## 2. Let people sign in

**Authentication → Sign In / Providers → Email.** Make sure **Enable email
provider** is on. The app signs in with a six-digit code rather than a link, so
under **Email Templates → Magic Link**, the template must contain `{{ .Token }}`
somewhere — the default template only has the link, and the code never arrives
without it.

A working template body:

```html
<h2>Your SpendLogX code</h2>
<p>{{ .Token }}</p>
<p>It expires in an hour.</p>
```

## 3. Check it

Open the app and sign in. Home's sync line changes from *Saved on this phone*
to *Synced just now*, and Settings shows which address you signed in as.

For the second phone: Settings on the first phone shows a six-character
**invite code**. On the second phone, sign in with its own email, choose **Join
by invite**, and type that code. Both then show the same figures.

## What the file actually does

The schema half is generated from `drizzle/pg/*.sql`, so it is exactly what the
app was built against — `src/db/supabase-sql.test.ts` fails if the committed
copy is stale. The rest is `policies.sql`, and it is worth knowing three things
about it:

**Postgres stamps `updated_at` itself** and throws away whatever the phone
sent. The pull cursor walks that column forward, so a phone with a slow clock
would otherwise be able to hide a row behind the other phone's cursor.

**Nothing is readable except through membership.** `is_member()` is the single
question every policy asks. It runs `security definer` so that the policy on
`household_member` does not have to query the table it is guarding, which would
recurse.

**You may insert exactly one member row: your own.** Knowing a household id is
not enough to write yourself into it. Joining goes through `join_household()`,
which looks up the invite code with privilege the joiner does not have, adds
only the caller, and returns only the household the code matched.

No table grants `delete`. Rows carry `deleted_at` instead, because a sync needs
a tombstone to tell "removed on the other phone" from "not arrived yet".

`scripts/verify-rls.sql` proves all of this against a real Postgres — 22 checks,
including that a stranger cannot read or write another household's rows and
that a forged member row is refused.

## The key in `.env`

`EXPO_PUBLIC_SUPABASE_ANON_KEY` is the **publishable** key. It is public by
design: it identifies the project, not a person, and it is compiled into the
APK where anyone can read it. The row-level security above is what actually
keeps one household's rows away from another's.

The **secret** key is a different thing entirely — it bypasses row-level
security completely. It belongs nowhere near this repository, the app, or a
chat window.
