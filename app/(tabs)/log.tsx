/**
 * Transactions.
 *
 * Grouped by day with a per-day expense subtotal, searchable across
 * description, category, subcategory, person and account — the handoff is
 * specific that a person's name should find their rows.
 */

import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ZERO, add, type Money } from '@/domain/money'
import type { Txn, TxnType } from '@/domain/ledger'
import { spendAmount } from '@/domain/ledger'
import {
  type State, accountById, categoryPath, personById, useAppState,
} from '@/store/store'
import { partnerInitial } from '@/store/demo'
import { Amount, Cedi } from '@/ui/Amount'
import { SearchMark } from '@/ui/marks'
import {
  Body, GoldLink, Micro, RowGroup, RowSeparator, ScreenTitle, gutter,
} from '@/ui/primitives'
import { TxnRow } from '@/ui/TxnRow'
import { useColors } from '@/ui/ThemeProvider'
import { TAB_HEIGHT } from '@/ui/TabBar'
import { radius } from '@/ui/theme'
import { fonts } from '@/ui/type'

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "Today · Sat 28 June", "Yesterday · Fri 27 June", then "Thu 26 June". */
function dayLabel(iso: string, today: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  const stamp = `${DAYS_SHORT[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
  const diff =
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${iso}T00:00:00Z`)) / 86_400_000
  if (diff === 0) return `Today · ${stamp}`
  if (diff === 1) return `Yesterday · ${stamp}`
  return stamp
}

interface Filters {
  type: TxnType | null
  accountId: string | null
}

/** Search covers everything a person might remember about a row. */
function matches(state: State, txn: Txn, query: string, filters: Filters): boolean {
  if (filters.type !== null && txn.type !== filters.type) return false
  if (
    filters.accountId !== null &&
    txn.accountId !== filters.accountId &&
    txn.counterAccountId !== filters.accountId
  ) {
    return false
  }
  if (query.trim() === '') return true
  const q = query.trim().toLowerCase()
  const haystack = [
    txn.note ?? '',
    categoryPath(state, txn.categoryId),
    personById(state, txn.personId)?.name ?? '',
    accountById(state, txn.accountId)?.name ?? '',
    accountById(state, txn.counterAccountId)?.name ?? '',
  ]
  return haystack.some((h) => h.toLowerCase().includes(q))
}

const TYPE_LABEL: Record<TxnType, string> = {
  expense: 'Expenses', income: 'Income', transfer: 'Transfers',
}

export default function Log() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const state = useAppState()
  const [query, setQuery] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState<Filters>({ type: null, accountId: null })

  const found = useMemo(
    () => state.txns.filter((t) => matches(state, t, query, filters)),
    [state, query, filters],
  )

  const days = useMemo(() => {
    const by = new Map<string, Txn[]>()
    for (const t of found) {
      const list = by.get(t.occurredOn)
      if (list) list.push(t)
      else by.set(t.occurredOn, [t])
    }
    return [...by.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [found])

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.ground }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: TAB_HEIGHT + 24 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[gutter, styles.head]}>
        <ScreenTitle>Transactions</ScreenTitle>
        <GoldLink isMicro size={10} onPress={() => setFilterOpen((o) => !o)}>
          filter
        </GoldLink>
      </View>

      {filterOpen && (
        <View style={[gutter, styles.filterRow]}>
          {(['expense', 'income', 'transfer'] as const).map((kind) => (
            <FilterChip
              key={kind}
              label={TYPE_LABEL[kind]}
              active={filters.type === kind}
              onPress={() =>
                setFilters((f) => ({ ...f, type: f.type === kind ? null : kind }))
              }
            />
          ))}
          {state.accounts.filter((a) => !a.archived).map((a) => (
            <FilterChip
              key={a.id}
              label={a.name}
              active={filters.accountId === a.id}
              onPress={() =>
                setFilters((f) => ({
                  ...f,
                  accountId: f.accountId === a.id ? null : a.id,
                }))
              }
            />
          ))}
        </View>
      )}

      <View style={[gutter, { marginTop: 14 }]}>
        <View style={[styles.search, { backgroundColor: c.card }]}>
          <SearchMark />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search description, category, person"
            placeholderTextColor={c.muted}
            style={{ flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: c.ink, padding: 0 }}
          />
        </View>
      </View>

      {days.length === 0 ? (
        <View style={[gutter, styles.empty]}>
          <Cedi size={34} color={c.line} />
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: c.ink, marginTop: 12 }}>
            {query.trim() === ''
              ? 'Nothing logged yet'
              : `Nothing matches “${query.trim()}”`}
          </Text>
          <Body size={12} style={{ marginTop: 4 }}>
            {query.trim() === ''
              ? 'Tap ₵ to add the first one.'
              : 'Try a person’s name — Dedei, Koshie — or an account.'}
          </Body>
        </View>
      ) : (
        days.map(([iso, rows]) => {
          const spent = rows.reduce<Money>((acc, t) => add(acc, spendAmount(t)), ZERO)
          return (
            <View key={iso} style={{ marginTop: 22 }}>
              <View style={[gutter, styles.dayHead]}>
                <Micro size={9}>{dayLabel(iso, state.today)}</Micro>
                {spent > 0 ? (
                  <Amount
                    value={spent} size={10.5} weight={700} width={100}
                    tone="muted" sign="minus" symbol
                    letterSpacing={0}
                  />
                ) : (
                  <Micro size={10.5} tracking={0}>—</Micro>
                )}
              </View>
              <RowGroup style={[gutter, { marginTop: 8 }]}>
                {rows.map((txn, i) => (
                  <View key={txn.id}>
                    {i > 0 && <RowSeparator />}
                    <TxnRow
                      txn={txn}
                      state={state}
                      enteredBy={partnerInitial(state, txn.id)}
                      onPress={() => router.push(`/txn/${txn.id}`)}
                      onEdit={() => router.push(`/txn/${txn.id}?edit=1`)}
                      onDelete={() => router.push(`/txn/${txn.id}?confirm=1`)}
                    />
                  </View>
                ))}
              </RowGroup>
            </View>
          )
        })
      )}
    </ScrollView>
  )
}

/** An active filter is an ink pill with an ×; inactive is outlined. */
function FilterChip({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        active
          ? { backgroundColor: c.ink }
          : { borderWidth: 1, borderColor: c.line },
      ]}
    >
      <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: active ? c.card : c.muted }}>
        {label}{active ? '  ×' : ''}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  filterChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: radius.field, paddingVertical: 11, paddingHorizontal: 13,
  },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  empty: { alignItems: 'center', paddingTop: 80 },
})
