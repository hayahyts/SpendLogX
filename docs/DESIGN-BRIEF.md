# SpendLogX — Design Brief

**Hand this to Claude Design.** It contains everything needed to design the
screens without reading the engineering spec. Return the designs and build
starts from them.

---

## The product in one paragraph

SpendLogX is a personal finance app for a household of two in Accra, Ghana,
replacing a Google Sheet that failed because entering a transaction took too
long. Money moves between three real accounts — **Cash**, a **MoMo Wallet**
(mobile money), and a **Stanbic Bank** account — plus one asset account for a
**Land** purchase. Currency is Ghana cedis (GHS). Roughly half of all
transactions are money sent to a named family member, which is the app's
distinguishing feature: **people are tracked separately from categories.**

## The one thing that must be right

**Logging a transaction takes about five seconds — three taps.** Amount →
category → save. Everything else on that screen is secondary and can hide.

This is not a nice-to-have. The spreadsheet it replaces has 29 of its 40 rows
carrying the same date, because entry was so slow the user batched two months
of spending into one sitting. If the add-transaction screen is beautiful but
slow, the product has failed. **Spend the most design attention here.**

## Who uses it

Two people sharing one pot: the owner and his partner (referred to as *Beb*).
Both log transactions, both see the same balances. There should be a quiet way
to tell who entered something — a small initial or label, never a heavy avatar
treatment.

---

## Art direction

**Take real creative risk here.** This is a personal product for one household,
not a fintech startup courting investors. It does not need to look like Revolut,
Monzo, Mint, or any American budgeting app. It should look like it was made *for
this person, in this place* — and it should be the kind of thing he opens partly
because it's a pleasure to look at.

You have full latitude on palette, typography, layout, motion and metaphor. The
functional requirements below are guardrails, not a style guide. If a better
structure than the one described serves the same job, take it and say why.

### Where the identity can come from

The subject has a specific world, and it isn't generic finance:

- **The cedi itself** — GHS, and the ₵ mark, which almost no product design has
  worn out.
- **Accra**, not a stock idea of Africa. Avoid every cliché: no kente borders,
  no sunset gradients, no Adinkra symbols used as decoration, no "vibrant
  African palette." If something Ghanaian belongs here, it should be specific
  and earned, not a costume.
- **Mobile money** — a genuinely distinct financial rail with no established
  visual language in Western app design. There's real territory here.
- **The ledger and the market**: the physical record-keeping this replaces.
  Ruled columns, tally marks, the receipt, the notebook.
- **Obligation between people.** Half this app is money sent to family. That's
  a warmer, more relational subject than "expense tracking" and the design can
  reflect it.

### Anti-slop

These are the looks that mark a design as machine-generated. **Do not produce
any of them:**

- Warm cream backgrounds (#F4F1EA and neighbours) with a serif display face and
  a terracotta accent.
- Near-black with a single acid-green or electric-violet pop.
- Purple-to-blue gradients. Any hero gradient, really.
- Inter, Space Grotesk, Poppins, Montserrat as the "safe" typeface.
- Glassmorphism, neumorphism, or a card with a coloured accent bar on the left.
- Everything centred. Everything at the same corner radius. Everything the same
  card.
- Emoji as iconography or section markers.
- Numbered markers (01 / 02 / 03) on content that isn't a sequence.
- Generic 3D or isomorphic illustration.

### What "professional" means here

Not "corporate." It means the craft holds up under scrutiny:

- **Typography does real work.** A deliberate pairing, a type scale that's
  actually used, weights and tracking chosen per role. Numbers get their own
  treatment — this is an app made of numbers, and they should be set as
  carefully as the text.
- **The palette is chosen, not defaulted.** Neutrals with a deliberate hue bias.
  Semantic colour (spent, earned, moved) distinct from the accent.
- **Spacing is a system**, not per-element nudges. Optical alignment where
  mathematical alignment looks wrong.
- **Boldness spends in one place.** One memorable move, everything around it
  quiet. A design that shouts everywhere reads as noise.
- **Motion is orchestrated, not scattered.** The keypad, the save confirmation
  and the period change are the three moments worth animating. Elsewhere,
  restraint.
- **Both themes are designed.** Dark mode is not an inversion; it's a second
  composition with the same intent.

### The one place to be most ambitious

The **add-transaction screen**. It's opened more than every other screen
combined, it has almost no content, and it has to feel fast. That combination —
sparse, high-frequency, performance-critical — is where a distinctive design
decision will pay off every single day. Make that screen the thing someone
remembers about this app.

The second is **People**. Money to Dedei, Koshie, Beb, Auntie is the emotional
centre of this data, and no budgeting app has a good visual language for it.
That's open ground.

---

## Design constraints

- **Mobile only.** iOS and Android via Expo. No tablet or web layout.
- **Dark mode required**, designed rather than inverted.
- **Amounts span three orders of magnitude** — GHS 20 to GHS 23,000 — so number
  formatting and alignment matter. Use tabular figures wherever amounts stack.
- **Mobile money is a first-class payment rail**, not a footnote. MoMo deserves
  the same visual weight as the bank account.
- **Expenses, income and transfers need distinct visual treatment** without
  resorting to plain red/green. Transfers are neither good nor bad — they're
  movement.
- **No photos or avatars for people.** Initials or a plain name treatment.
- **Offline is normal, not an error state.** Saves complete instantly and sync
  quietly in the background. A pending-sync indicator should be calm and
  peripheral — never a warning.

## Use real content, not lorem

All of this is from the actual data:

**Accounts** — Cash · MoMo Wallet · Stanbic Bank · Land (asset)

**Expense categories** — Food Drink · Transport · Bills Utilities · Shopping ·
Health · Entertainment · Personal · Family · Extended Family · Charity ·
Loan Repayment · Other

**Income categories** — Salary · Side Income · Gifts · Refunds · Other Income

**Subcategories (examples)** — Groceries, Takeaway, Fuel, Taxi Trotro, Uber Bolt,
Car Wash, Rent, Electricity, Clothing, Pharmacy, Streaming, Education, Masjid

**People** — Dedei · Koshie · Odarkor · Beb · Ibrahim · Abdur-Rahman · Jalil ·
Auntie (Maxwell) · Nateki · Mommy · Fauzia · Nana Adjoa

**Real transactions to populate mockups**

| Amount | Description | Category | Account |
| --- | --- | --- | --- |
| 53.00 | Bread and biscuit | Food Drink › Groceries | Cash |
| 300.00 | Buying corn husk | Extended Family (Dedei) | Cash |
| 200.00 + 10.00 tip | Fuel for Generator | Transport › Fuel | Cash |
| 1,000.00 | Dr Safo last payment | Extended Family (Dedei) | MoMo Wallet |
| 1,000.00 | Mary's mother's funeral | Charity (Friends) | MoMo Wallet |
| 800.00 + 60.00 tip | Spa Treatment | Family (Beb) | Stanbic Bank |
| 20,000.00 | Payment to Mr Richard | Land purchase (transfer) | Stanbic Bank |
| 23,000.00 | June salary | Salary › Main job | Stanbic Bank |
| 55.00 | Beans | Food Drink › Takeaway | Cash |
| 460.00 | Work at cemetery | Charity › Masjid | MoMo Wallet |

---

# Screens

Three tiers. **Tier 1 gets the most attention** — those three screens are the
app in daily use. Tier 3 should be systematic and consistent rather than
individually crafted.

## Tier 1 — the daily app

### 1. Add Transaction ★ the hero screen

The screen the whole product is judged on. Opens from a persistent action
button on every tab.

- **Amount is focused the instant the screen opens**, over a large custom
  numeric keypad. No system keyboard. Amount is the largest element on screen.
- **Type switcher** — Expense (default) / Income / Transfer — as a segmented
  control. Expense is selected 35 times out of 40, so it must never cost a tap.
- **Categories appear as recency-ranked chips**, not a dropdown. Around 6–8
  visible, with an overflow into the full picker.
- **Account selector defaults to the last used** — Cash covers 21 of 40 rows.
  One tap to change.
- **Date defaults to today**, shown but not prominent. *This is the fix for the
  spreadsheet's worst defect and should feel effortless to leave alone.*
- **Person picker appears only** when the chosen category is person-facing
  (Family, Extended Family, Charity, Loan Repayment). It should slide in, not
  reserve empty space.
- **"More" disclosure** holds tips, a note, and a non-today date.
- **Save dismisses immediately** with a confirmation toast. Never a spinner.

Design the three type variants — the Transfer variant replaces category with
**From account → To account** and adds an optional **fee** field for MoMo
cash-out charges.

**States:** empty · amount entered · category selected · person picker shown ·
"More" expanded · validation error (no amount, transfer to same account).

### 2. Home

The first thing seen on open. Answers "what do I have?"

- **Account balance cards** — Cash, MoMo Wallet, Stanbic Bank, each with its
  kind expressed visually. Land sits apart as an asset, not spendable.
- **Total across spendable accounts**, prominent.
- **This month at a glance** — spent, earned, net.
- **Recent transactions**, around five, tappable through to detail.
- **The add button**, unmissable.

**States:** populated · fresh install with zero transactions · sync pending ·
a negative balance (it will happen).

### 3. Transaction List

Browse, find and fix what was logged.

- **Grouped by date**, newest first, with a per-day subtotal.
- **Each row** — category, description, person if any, account, amount. Type
  legible at a glance.
- **Search** across description, category and person.
- **Filter sheet** — type, category, person, account, date range. Active
  filters visible and dismissible as chips.
- **Swipe or tap through to edit.**

**States:** populated · empty · no search results · filtered · loading.

## Tier 2 — the reporting surfaces

### 4. Dashboard

Replaces five spreadsheet tabs and ~600 formulas.

- **Period picker** — Week / Month / Quarter / Year, with previous/next
  navigation. It should be obvious which period is shown.
- **Four summary tiles** — Expenses, Income, Transfers, Net.
- **Category breakdown** for the period — ranked, with proportion visible.
  Every category the household uses appears; none is ever omitted.
- **Tap a category** to see it in detail.
- Land purchases must be visibly excluded from spending, since they're
  transfers. Consider how to communicate that without a footnote.

**States:** a busy month · a quiet week with almost nothing · a period with
zero transactions.

### 5. Category Detail

One category over the selected period — total, subcategory split, and the
transactions behind it.

### 6. People ★ the differentiator

The thing the spreadsheet genuinely cannot do.

- **List of people** with the amount sent this period, and a sense of trend.
- **Person detail** — total this period and all-time, a breakdown by category,
  and the full transaction history with that person.
- Household members (Beb) are marked as such and excluded from
  "people you support" totals, while still being viewable.

**States:** person with long history · person with one transaction · a period
where nothing was sent.

### 7. Transaction Detail / Edit

Full record, editable in place, with delete behind a confirmation.

## Tier 3 — supporting screens

Keep these consistent and systematic.

**8. Sign in** — email-based. Must feel trustworthy; it guards money data.

**9. Household setup** — create a household, or join one by invite.

**10. Account setup (first run)** — add each account with its kind and its
**current balance, entered by hand**. This is a one-time screen but it's the
foundation of every balance shown afterwards, so it must feel deliberate and
unhurried — the opposite of the capture screen.

**11. Import result** — a one-time confirmation that 40 transactions came
across from the spreadsheet, with what was reclassified.

**12. Category picker (full)** — searchable, two-level tree.

**13. Person picker** — searchable, with inline "add new person".

**14. Net worth** — spendable accounts plus asset values, and the Land
valuation history over time. Includes adding a new valuation.

**15. Settings** — accounts, categories, people, household members, export,
sign out.

**16. Manage categories** — two-level tree editor: add, rename, archive,
reorder. Archiving rather than deleting, since history depends on them.

**17. Manage accounts** — add, rename, archive, reorder.

**18. Household** — members, and inviting a partner.

---

## Design decisions still open

Call these however you think best — they're genuinely yours:

1. **Navigation shape.** Tabs (Home / Transactions / Dashboard / People) versus
   something less conventional. Four tabs plus a floating action button is the
   safe answer; a better one may exist.
2. **How transfers read** in a list among expenses and income, given they're
   neither spending nor earning.
3. **Whether Land and net worth live in their own tab** or inside Home.
4. **The visual language for people** — the app's most distinctive concept, and
   currently the least designed.
5. **How a pending sync is communicated** without ever looking like an error.

## What not to design

- Budgets, targets or limits. Explicitly out of scope.
- Charts beyond what the dashboard needs. No analytics playground.
- Receipt photos, recurring transactions, notifications. All deferred.
- Any onboarding tour or tutorial. The user built the spreadsheet this
  replaces; he does not need to be taught what a transaction is.
