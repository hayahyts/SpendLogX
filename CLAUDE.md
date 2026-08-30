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
| `app/` | expo-router screens. A placeholder until designs land. |

The two schemas are written out separately because Drizzle's column builders
differ per dialect, so they can drift. `src/db/schema.drift.test.ts` asserts
they haven't. If you add a column, add it on both sides.

## Commands

```bash
npm test          # vitest
npm run typecheck
npm run import    # re-audit the workbook, regenerate the taxonomy seed
npm start         # Expo
```

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

## Open

Nothing outstanding. Screens are next, once designs land.
