# SpendLogX

A personal finance app for a household of two in Accra, replacing a Google
Sheet. Expo, local-first, Ghana cedis.

The spreadsheet it replaces is in `docs/`, along with an audit of what was
wrong with it. **Start with [`docs/SPEC.md`](docs/SPEC.md)** — it records every
design decision and the reasoning behind it, so a later change reads as a
correction rather than a drift.

## Where things are

| Path | What it is |
| --- | --- |
| `src/domain/` | Money, dates, and the ledger. Pure TypeScript, no Expo, no database. Where correctness lives. |
| `src/db/` | Drizzle schemas for SQLite (on device) and Postgres (Supabase), plus the imported seed. |
| `scripts/import-workbook.ts` | Reads the spreadsheet, emits `src/db/seed.json`, reports every transform. |
| `app/` | expo-router screens. A placeholder until designs land. |
| `docs/DESIGN-BRIEF.md` | The design handoff: 18 screens, real content, art direction. |

## Running it

```bash
npm install
npm test          # 80 tests
npm run typecheck
npm start         # Expo
npm run import    # re-run the spreadsheet import
```

## Three rules the code holds to

**Money is an integer count of pesewas.** `₵ 7,000.47` is `700047`. Every
amount passes through `src/domain/money.ts`; nothing else does arithmetic on
money. `Number('7000.47') * 100` is `700046.99999999994`, and a ledger cannot
afford that.

**Categories are data.** Reporting iterates the category table. No screen may
contain a literal list of category names — the spreadsheet's worst defect was a
dashboard that charted a hardcoded twelve categories when thirteen existed,
hiding ₵3,541 of family spending.

**Direction comes from the transaction type, never from a sign.** Amounts are
always positive. What a transaction does to an account is decided in one place,
`effects()` in `src/domain/ledger.ts`, and both databases enforce the shape
with check constraints.

## What the import does to the spreadsheet's 40 rows

Run `npm run import` to see the full report. The substance of it:

| | Sheet | After import |
| --- | --- | --- |
| Expenses | ₵48,943 | **₵21,443** — the land purchase is a transfer, not spending |
| Income | ₵49,889.47 | **₵41,847** — opening balances no longer booked as salary |
| Categories charted | 12 of 13 | **all 13** |
| People | subcategories | **18, as their own dimension** |

Twenty-nine rows share the date `2026-05-04` — the old entry form's default.
They import unchanged, by decision; the report warns about them.

## Status

Scaffold complete: domain layer, both schemas, migrations, the import, and CI.
Screens are being designed and are not built yet.
