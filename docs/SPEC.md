# SpendLogX — Build Spec

Converting `Spending_Tracker_GHS.xlsx` into an Expo app.

Status: **agreed, not yet built.** Every decision below came out of a grilling
session and is recorded with the reasoning, so we can tell later whether a
change is a correction or a drift.

Currency is GHS throughout. All money is stored as **integer pesewas**.

---

## 1. What the spreadsheet actually is

Nine tabs. Only two hold information:

| Tab | Role |
| --- | --- |
| `Transactions` | 40 rows. The entire dataset. |
| `Settings` | Category/subcategory/account taxonomy. |
| `Dashboard`, `Weekly/Monthly/Quarterly/Yearly Detail` | ~600 `SUMIFS` formulas over those 40 rows. |
| `Add Transaction` | Apps Script-driven entry form. |
| `Validation` | Hidden helper ranges. |

Totals as the sheet computes them: expenses **48,943.00** (including 90.00 of
tips), income **49,889.47**, transfers **10,611.00**.

### 1.1 Defects found in the audit

| # | Finding | At stake |
| --- | --- | --- |
| 1 | **Dashboard omits the `Family` category.** `Dashboard!A17:A28` hardcodes 12 categories; `Settings` defines 13. Category rows sum to 45,402 while Total Expenses reads 48,943. | GHS 3,541 invisible |
| 2 | **29 of 40 rows carry the form's default date** (`2026-05-04`), including a row described "June Salary". Only 11 rows (28 Jun – 1 Jul 2026) have real dates. | 29 rows |
| 3 | **Opening balances disguised as salary.** `Stanbic initial balance` (7,000.47) and `Initial Cash` (1,042) are entered as `Income / Salary / Main job`. | Income overstated by GHS 8,042 |
| 4 | **`Payment Method` and `Account` model one concept.** 37 of 40 rows pair them 1:1 (Cash/Cash, Mobile Money/MoMo Wallet, Bank Transfer/Stanbic Bank). 3 rows contradict. On the single Transfer row the pair means from→to instead. | 1 redundant field, 3 bad rows |
| 5 | **Subcategory totals double-count.** `Beb` is a subcategory of both `Family` and `Loan Repayment`; the Dashboard sums by subcategory name alone, reporting 13,874 that mixes 2,275 of family spending with an 11,599 loan repayment. | GHS 13,874 conflated |
| 6 | **Three competing category lists, already drifted.** `Settings!A:B` is canonical; `M:N` are dropdown copies. `M` contains `Family Home` (exists nowhere else) and omits Investment, Charity, Loan Repayment. `N` lists `Donations`, `Childcare`, `Unplanned` that were never options. Live data uses `Main job`, absent from the income list. | Referential integrity gone |
| 7 | **Four cells contain zero-width Unicode.** `Settings!B55`, `B56` and two transaction subcategories render blank but encode `Fauzia` and `Nana Adjoa`. | GHS 700 uncategorised |

### 1.2 What the data says about the user

- 23 of 40 transactions (GHS 19,730) go to a **named person**: Dedei, Koshie,
  Beb, Odarkor, Jalil, Auntie (Maxwell), Ibrahim, Abdur-Rahman.
- `Investment → Land` is GHS 27,500 — **56% of all "expenses"** — and is not
  spending at all.
- Three accounts in use: Cash (21 txns), MoMo Wallet (10), Stanbic Bank (9).
- Tips: GHS 90 total, across 2 of 35 expense rows.

---

## 2. Decisions

| Decided | Rejected, and why |
| --- | --- |
| **Capture speed is the product.** Success = logging a transaction in ~5 seconds. | "Better analytics" — the sheet's failure was friction, evidenced by 29 rows entered in one backfill session. |
| **Real ledger with correct balances.** | Spend-log with no balances — you'd still be checking the MoMo app. |
| **Local-first: expo-sqlite is authoritative, Supabase syncs behind it.** | Cloud-first — every save becomes a round-trip to a distant region. It rebuilds the exact friction that killed the sheet. |
| **The spreadsheet dies completely.** Its 40 transactions are not imported; only the taxonomy is. | Importing the history. 29 of 40 rows carry the form's default date and every opening balance was fiction, so the data would poison the app's first charts. |
| **`Payment Method` is deleted. `Account` carries the meaning.** Each account has a kind (cash / mobile money / bank / asset). | Keeping both — the data shows no real distinction in 37 of 40 rows. |
| **Transfers are two-sided: from → to, plus a fee field.** The fee captures MoMo cash-out charges so balances reconcile. | Single-sided transfers — they make balances impossible. |
| **Household with two members, shared pot.** You and Beb. | Single-user — would need a schema rewrite later, not a migration. |
| **Land becomes an asset account with tracked value,** and money owed becomes a liability account. Buying land and repaying a loan are both transfers, not expenses. True consumption drops from 48,943 to 9,844. | Leaving it as an expense — one land purchase would dominate every chart and average forever. |
| **People are a first-class dimension**, separate from category. | People-as-subcategories — that is precisely what causes the `Beb` collision. |
| **Every balance is typed at setup — positive, negative or asset cost.** Accounts start empty and you create each one. | Pre-filling, or deriving balances from history. One rule with no exceptions is easier to trust and easier to design a setup screen around. |
| **Tips survives, behind a "More" disclosure.** | Prominent field — GHS 90 across two months doesn't earn a tap on every entry. |
| **The taxonomy is kept** — 13 categories, their subcategories, 18 people. | Starting with nothing, or a generic starter set. The taxonomy is a year of the user's own thinking; the specificity (Extended Family, Masjid, Charity) is what made the sheet good. |
| **No budgets in v1.** | Monthly limits — you've never had them and didn't ask. Revisit once there's real usage. |
| **Everything ships in one release** — capture, balances, list, dashboard, people, net worth. Design is produced first and approved before build. | A staged release. You'd rather migrate once than twice. Accepted cost: no working app in hand until the whole thing is built. |

---

## 3. Domain model

Two levels of category in one tree. People orthogonal to categories. Money in
integer pesewas, dates as plain `DATE`.

```sql
household(id, name, created_at)

household_member(household_id, user_id, display_name, role, joined_at)

account(
  id, household_id, name,
  kind             text CHECK (kind IN ('cash','mobile_money','bank','asset')),
  opening_balance_minor  integer NOT NULL,   -- you set this at first run
  opening_balance_on     date    NOT NULL,
  is_active, sort_order,
  created_at, updated_at, deleted_at
)

-- asset accounts only (Land): cost basis lives in txns, market value here
account_valuation(id, account_id, as_of date, value_minor integer, note)

category(
  id, household_id, name,
  kind             text CHECK (kind IN ('expense','income')),
  parent_id        references category(id),   -- exactly 2 levels
  is_person_facing boolean,                   -- drives the person picker
  archived, sort_order
)

person(
  id, household_id, name, relation,
  member_user_id   references auth.users,     -- Beb; excluded from support totals
  archived
)

txn(
  id uuid, household_id,
  type              text CHECK (type IN ('expense','income','transfer')),
  occurred_on       date    NOT NULL,
  amount_minor      integer NOT NULL CHECK (amount_minor > 0),
  tips_minor        integer NOT NULL DEFAULT 0,   -- expense only
  fee_minor         integer NOT NULL DEFAULT 0,   -- transfer only
  account_id        references account,           -- source, or destination for income
  counter_account_id references account,          -- destination; transfers only
  category_id       references category,          -- NULL for transfers
  person_id         references person,            -- optional
  note              text,
  is_opening        boolean NOT NULL DEFAULT false,
  created_by, created_at, updated_at, deleted_at,
  legacy_row_id     integer                       -- 1..40, provenance
)
```

### Invariants

- Money is **always** an integer count of pesewas. `7000.47` is stored as
  `700047`. No floating point anywhere in the money path, enforced by a `Money`
  branded type in TypeScript and `integer` columns in SQL.
- `occurred_on` is a calendar date, never a timestamp. Accra is UTC+0, which
  spares us — but the type still matters for correctness.
- `type = 'transfer'` ⇒ `category_id IS NULL` and `account_id <> counter_account_id`.
- `type IN ('expense','income')` ⇒ `counter_account_id IS NULL`.
- `is_opening = true` rows are excluded from every income and expense total.

### Balance derivation

```
expense   →  account         −= (amount_minor + tips_minor)
income    →  account         += amount_minor
transfer  →  account         −= (amount_minor + fee_minor)
             counter_account += amount_minor

balance(a) = a.opening_balance_minor + Σ effects on a
```

Transfer fees report under a system category **Fees & Charges** — no extra
field, and MoMo cash-out costs stop being invisible.

**The rule that prevents defect #1 from recurring:** categories are data.
Reporting iterates the `category` table. No screen ever contains a literal list
of category names.

---

## 4. The 5-second capture flow

This is the product, so it gets specified rather than left to implementation.

1. **Amount is focused on open**, over a large numeric keypad. Type `53`.
2. **Category as recency-ranked chips**, not an alphabetical dropdown.
3. **Account defaults to last used**, one tap to change. Cash is 21 of 40 rows.
4. **Date defaults to today.** This single change prevents defect #2 — the
   sheet defaulted to a fixed date, which is how 29 rows got the same one.
5. **Person picker appears only** when the category is person-facing (Family,
   Extended Family, Charity, Loan).
6. **Tips, notes, and a non-today date live behind "More."**
7. **Save writes to SQLite synchronously and dismisses immediately.** Sync
   happens in the background. Never a spinner.

Target: amount → category chip → save. **Three taps.** We instrument
tap-to-save and treat a regression as a bug, because a promise nobody measures
is a promise nobody keeps.

---

## 5. Stack

| Concern | Choice | Note |
| --- | --- | --- |
| App | Expo (latest SDK) + expo-router | Typed routes, file-based |
| Language | TypeScript, `strict` | |
| Local DB | expo-sqlite + Drizzle ORM | Same schema definition drives both ends |
| Reactivity | Drizzle `useLiveQuery` | SQLite-backed live queries; no global state library needed |
| Remote | Supabase (Postgres + Auth + RLS) | RLS scoped by `household_id` |
| Session | expo-secure-store | Must survive offline launches |
| Validation | Zod | At the import and form boundaries only |
| Dates | date-fns | Replaces `EOMONTH`, `WEEKDAY`, `DATE` |

### Sync

Hand-rolled, and deliberately small:

- An `outbox` table of local mutations, pushed to Supabase on connectivity.
- Pull by cursor: rows where `updated_at > last_seen`.
- Last-write-wins per row on `updated_at`, device id as tiebreak.
- Soft deletes (`deleted_at`), never hard deletes — a hard delete cannot sync.

For two users and append-mostly data this is tractable. It is still where
projects of this shape usually die, so it lives entirely in `src/sync/` behind
an interface, and PowerSync is the escape hatch if it misbehaves.

---

## 6. What comes from the spreadsheet

`scripts/import-workbook.ts` is an **audit** tool, not a seeding one. It emits
`seed.json` containing only `categories` and `people` — no accounts, no
balances, no transactions, and no dates at all. Everything else it parses stays
in an `analysis` result that the app never sees, and exists so the audit
findings stay reproducible and testable.

| Sheet reality | Becomes |
| --- | --- |
| `Settings!A:B` | The one category tree. `M:N` discarded entirely. |
| `Payment Method` column | Dropped. The 3 contradicting rows resolve to their `Account` value. |
| `Investment / Land` (27,500) | Audited as transfers into an asset account. Not imported. |
| Person subcategories | **Seeded** as 18 `person` records, out of the category tree. |
| `Beb` | Seeded as a person, linked to a household member. |
| `Loan Repayment / Beb` (11,599) | Audited as a transfer into a liability. Not imported. |
| Zero-width cells | Decoded to `Fauzia` and `Nana Adjoa`; seeded as people. |
| The 2 fake salary rows | Dropped, along with everything else. Their existence is why no balance is inferred. |
| `Main job`, `Rising`, `Peswa` | **Seeded** into the income subcategory tree. |
| The 40 transactions | **Not imported.** The app starts empty. |
| Account balances | **Not imported.** Typed at setup, positive or negative. |
| The 29 default dates | Moot — nothing is imported. |

---

## 7. Sequencing

**All four surfaces ship together.** No staged release.

Design comes first: the screen inventory in `docs/DESIGN-BRIEF.md` goes to
Claude Design, the returned designs come back here, and build starts from
approved screens rather than from guesses.

| Stage | Contents |
| --- | --- |
| **Design** | Two stages: three palette/type directions to choose from, then the full screen inventory designed in the chosen one. |
| **Scaffold** | Expo app, Drizzle schema, migrations both ends, import script, `Money` type, CI. Runs in parallel with design — none of it depends on visuals. |
| **Build** | Capture, balances, transaction list, dashboard, people, net worth. Sync and household invite included. |
| **Import & cutover** | Run the import, set opening balances by hand, stop using the sheet. |

Two things stay true regardless of the single-release decision:

- The **scaffold work is design-independent** and starts now, so design time
  is not idle time.
- The **capture flow is still the thing that must be right.** If design
  attention has to be rationed, it goes to the add-transaction screen.

## 8. Judgement calls I made

Say the word if any of these are wrong.

1. **Beb stays a `person` and is linked to a user**, rather than
   re-categorising the 7 `Family / Beb` rows into household spending. Reports
   exclude household members from "people you support" totals. Non-destructive,
   and reversible.
2. **The two opening-balance rows are imported but flagged `is_opening`**, so
   history is preserved without overstating income by 8,042.
3. **Transfer fees report under a system "Fees & Charges" category** rather than
   taking their own category field.
4. **The decoded names are used as-is** (`Fauzia`, `Nana Adjoa`).

## 9. Open questions

1. ~~Liabilities are not modelled.~~ **Done.** A `liability` account kind
   holds what is owed as a negative balance; the 11,599 repayment is a transfer
   into it. Spending fell from 21,443 to **9,844**, since 54% of it was debt
   service. What is still owed is entered by hand at setup.
2. Recurring transactions — rent and salary are obvious candidates.
3. Receipt photos.
4. Reminders / notifications to log.
5. Multi-currency. Assumed no.

## 10. Risks

| Risk | Mitigation |
| --- | --- |
| Hand-rolled sync consumes the project | Contained in one module behind an interface; PowerSync as escape hatch |
| Floats corrupt money | Integer pesewas, branded `Money` type, `CHECK` constraints |
| The 5-second promise quietly erodes | Instrumented tap-to-save; regressions are bugs |
| Hardcoded taxonomy repeats defect #1 | Categories are data; no literal category lists in any screen |
| Land valuation drags us into net-worth scope | Phase 4, explicitly after the core ships |
