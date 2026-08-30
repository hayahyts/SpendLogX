# SpendLogX — working notes for Claude

An Expo app replacing a Google Sheet, for a household of two in Accra. GHS.

`docs/SPEC.md` holds every design decision and why it was made.
`docs/DESIGN-BRIEF.md` is the design handoff. Read the spec before changing
anything that alters what a number means.

## How to work here

**Answer first, build second.** When asked a question — including one that
turns out to expose a problem — reply with the answer, the ways forward, and a
recommendation. Wait for approval. Then build. Do not discover something
mid-task and go straight to writing code for it.

This applies to anything that changes what a number means: what counts as
spending, how a balance is derived, what a category or a person is, how a
period is bounded. Mechanical fixes — a wrong constant, a failing test, a type
error, a typo — just fix.

**Report figures from the data, not from memory.** Every number quoted to the
user should come from running something. Two published figures have already
been wrong because they were estimated rather than computed. When correcting
one, correct it everywhere it was published.

## Rules the code holds to

**Money is an integer count of pesewas.** `₵ 7,000.47` is `700047`. Everything
goes through `src/domain/money.ts`; nothing else does arithmetic on money.
`Number('7000.47') * 100` is `700046.99999999994`. Never introduce a float into
the money path, and never store money in a column not suffixed `_minor` — a
test enforces both.

**Categories are data.** Reporting iterates the category table. No screen, no
function, no constant may contain a literal list of category names. The
spreadsheet's worst defect was a dashboard charting a hardcoded twelve
categories when thirteen existed, hiding ₵3,541. `spendByCategory` therefore
cannot be handed a list of categories to report on.

**Direction comes from the transaction type, never from a sign.** Amounts are
always positive. What a transaction does to an account is decided in one place,
`effects()` in `src/domain/ledger.ts`. Postgres enforces the same shape with
check constraints.

**Dates are calendar dates, not timestamps.** A transaction happens on a date.
Accra is UTC+0 so nothing breaks today, but the type stops a future timezone
moving somebody's spending into the previous month.

**Every balance is typed, none is inferred.** At setup you create each account
yourself and enter its balance — positive for a wallet, negative for a debt,
cost for an asset. Nothing is pre-filled and nothing is derived from history.
One rule, no exceptions, and it is what makes the app's figures trustworthy
from the first screen: the spreadsheet's own opening balances were fiction,
booked as salary and overstating income by ₵8,042.47.

A **liability** holds what is owed as a **negative** balance: a debt of ₵11,599
is entered as `-1159900`, and repayments move it up toward zero. Storing the
sign this way means `effects()` and `balances()` need no notion of debt —
repaying is an ordinary transfer — and net worth simply adds every balance
together.

`balances()` still applies an `openingBalanceOn` cutoff per account, so a
transfer can be history on one side and current on the other. Nothing in the
app relies on that today, since there is no imported history, but the ledger
supports it and a test pins it.

**Net worth counts assets at valuation, never at ledger balance.** Doing both
double-counts. An unvalued asset falls back to its cost basis and flags itself
`unvalued` — showing land as worth zero would be the worse lie. Net worth is
`spendable + assets − liabilities`.

**Buying an asset and repaying a debt are transfers, not spending.** Neither is
consumption, so neither gets a category: `Investment` and `Loan Repayment` are
deliberately absent from the seed. Offering them invites logging the next land
purchase as an expense, which is how the sheet came to claim ₵48,943. Together they were ₵39,099 of the sheet's ₵48,943, which is why
its real consumption was ₵9,844.

**The app starts empty.** No accounts, no balances, no transactions. The only
thing seeded is the taxonomy — 11 expense categories, their subcategories, and
16 people — because that is a year of the user's own thinking and rebuilding it
by hand would be an hour wasted. `scripts/import-workbook.ts` is now an *audit*
tool, not a seeding one: it proves the figures above are real and emits only
`categories` and `people`. `seed.json` contains no dates and no money.

## Layout

| Path | What |
| --- | --- |
| `src/domain/` | Money, dates, ledger, net worth. Pure TypeScript — no Expo, no database. Where correctness lives. |
| `src/db/` | Drizzle schemas per dialect, plus the imported `seed.json`. |
| `scripts/import-workbook.ts` | Audits the spreadsheet. Emits only the taxonomy as `seed.json`; the accounts and 40 transactions it parses stay in `analysis` and never ship. |
| `src/ui/` | Design tokens, typography and the shared components. Transcribed from the handoff; the values there are final. |
| `src/store/` | App state and selectors. The seam SQLite slots into. |
| `app/` | expo-router screens, 17 of them. |
| `assets/fonts/` | Archivo cut to the widths the design specifies. |

The two schemas are written out separately because Drizzle's column builders
differ per dialect, so they can drift. `src/db/schema.drift.test.ts` asserts
they haven't. If you add a column, add it on both sides.

## The screens

`docs/DESIGN-BRIEF.md` is the brief that went out; the handoff that came
back is the source of truth for every colour, size and radius.

**Archivo has a width axis and React Native cannot vary a font axis at
runtime**, so the widths the design calls for — 105% for section heads, 112%
for display, 125% for the sign-in mark — are cut from the variable font as
static instances into `assets/fonts/`. Never approximate one with `scaleX`.

**Neither Archivo nor Public Sans carries ₵ (U+20B5).** The glyph comes from the
platform font, which is why `Cedi` and `cedi()` set no `fontFamily`. It keeps
its size and its gold.

**No screen holds a number.** Every figure is computed by `src/domain` from the
store. `src/store/demo.ts` holds the ten rows the mockups were drawn against so
the screens can be reviewed; its opening balances are derived so that replaying
those rows lands exactly on the mockups' figures. `EXPO_PUBLIC_DEMO=0` starts
empty, which is what ships.

## Commands

```bash
npm test          # vitest
npm run typecheck
npm run import    # re-audit the workbook, regenerate the taxonomy seed
npm run db:generate   # both dialects, then regenerate ddl.ts and setup.sql
npm start         # Expo
npx expo export --platform web   # then serve it to see the screens in a browser
```

The APK is built locally, never committed (`dist/` and `*.apk` are ignored):

```bash
cd android && EXPO_PUBLIC_DEMO=0 ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

`EXPO_PUBLIC_DEMO=0` is what makes it start empty; a stale Metro cache has
silently kept demo mode in a build before, so if in doubt add `--rerun-tasks`.

To check the row-level security against a real Postgres rather than trusting
it, run `scripts/supabase-stub.sql` (the two roles and the two `auth` helpers
Supabase supplies), then `supabase/setup.sql`, then `scripts/verify-rls.sql`.

The seed is committed, and CI fails if re-running the import changes it. A
change to the importer that moves the output is a reviewable event, not a
surprise.

## Numbers worth knowing

Quoted often, and each is checked by a test:

| | |
| --- | --- |
| Real consumption | ₵9,844 — the sheet claimed ₵48,943 |
| Real income | ₵41,847 — the sheet claimed ₵49,889.47 |
| Land, at cost | ₵27,500 across 4 purchases — a transfer, not spending |
| Loan repaid to Beb | ₵11,599 — a transfer into a liability, not spending |
| Family spending the dashboard hid | ₵3,541 |
| Conflated under the name "Beb" | ₵13,874 in the sheet — ₵2,275 of family spending plus an ₵11,599 loan repayment, now separated |
| Rows carrying the old form's default date | 29 of 40 — one reason none of it is imported |

## Persistence

The store is in memory and every applied action is written through to SQLite
(`src/db/local.ts`), behind a two-method interface that better-sqlite3 also
satisfies — so the layer is tested in vitest against a real database, foreign
keys included. `src/db/ddl.ts` is generated from the drizzle migration by
`scripts/gen-ddl.ts`, and a test pins the copy byte-identical. Web builds swap
in `persist.web.ts` and run in memory; the phone is where data lives. Deletes
are soft, because the sync design needs tombstones.

Demo mode (`EXPO_PUBLIC_DEMO` unset or `1`) never touches the database.
`EXPO_PUBLIC_DEMO=0` is the shipping configuration: fresh installs are gated
into onboarding until a household exists.

## Sync

**Postgres owns `updated_at`.** A trigger stamps it on every write and the
client's value is discarded. Two phones cannot be ordered by their own clocks,
and the pull cursor walks `updated_at` forward, so a phone with a slow clock
could otherwise hide a row behind the other phone's cursor.

**Conflicts are settled without comparing clocks.** The outbox records only
"this row is dirty" — no payload, no operation. The pusher reads the row when
it pushes, so ten edits cost one upsert and a soft delete is just the row's
latest version. On pull, a row that is dirty locally is skipped: this phone is
about to send a version that will then be newest on the server.

**Membership is the only key.** `is_member()` is `security definer` so the
policy on `household_member` need not query the table it guards. You may insert
exactly one member row, your own — knowing a household id is not enough.
Joining goes through `join_household()`, which looks up the invite code with
privilege the joiner does not yet have. No table grants delete: a sync needs
the tombstone.

**`household_member.user_id` is the Supabase auth id**, because that is what
every policy compares against; `email` is a separate column and only a label. A
phone that has never signed in carries a local id there, so the app is complete
with no account. Signing in rewrites it and re-queues the row.

`supabase/setup.sql` is generated from the drizzle migrations plus
`supabase/policies.sql` and pasted into the Supabase SQL editor.
`src/db/supabase-sql.test.ts` fails if the committed copy is stale, so the app
can never be built against a schema nobody ran. `scripts/verify-rls.sql` proves
the policies hold against a real Postgres; `src/sync/engine.test.ts` runs two
SQLite databases against a fake server.

## Open

**Nothing is verified against the live project yet.** `setup.sql` has been run
against a local Postgres 16, not against Supabase — that needs the SQL editor,
which only the account holder can reach.

**Two figures in the design mockups do not reconcile,** and were not copied. The
Home total of ₵3,938 counts the spa tip but not the fuel tip, while the same
mockup's dashboard shows Transport at ₵210 — which includes that tip. Ours is
₵3,948 throughout. And the greeting block reads SATURDAY 28 JUNE, but that date
is a Sunday; the app derives the weekday.
