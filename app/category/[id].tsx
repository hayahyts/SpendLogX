/**
 * Category detail.
 *
 * The four-month comparison is the only place the app compares periods
 * directly, and it exists because "is this normal?" is the question a category
 * total actually raises.
 */

import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ZERO, add, type Money } from '@/domain/money'
import { periodContaining, shiftPeriod } from '@/domain/period'
import { spendAmount, spendByCategory, totalsForPeriod } from '@/domain/ledger'
import { categoryPath, childrenOf, personById, useAppState } from '@/store/store'
import { Amount } from '@/ui/Amount'
import {
  Bar, Body, Micro, RowGroup, RowSeparator, SectionHead, gutter,
} from '@/ui/primitives'
import { TxnRow } from '@/ui/TxnRow'
import { BackLink } from '../txn/[id]'
import { useColors } from '@/ui/ThemeProvider'
import { fonts } from '@/ui/type'

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export default function CategoryDetail() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const state = useAppState()

  const category = state.categories.find((x) => x.id === id)
  const month = periodContaining('month', state.today)

  /** The category and, if it is a parent, everything under it. */
  const ids = useMemo(() => {
    if (!category) return new Set<string>()
    const kids = childrenOf(state, category.id).map((k) => k.id)
    return new Set([category.id, ...kids])
  }, [category, state])

  const rows = state.txns.filter(
    (t) => t.categoryId !== null && ids.has(t.categoryId)
      && t.occurredOn >= month.start && t.occurredOn <= month.end,
  )
  const total = rows.reduce<Money>((acc, t) => add(acc, spendAmount(t)), ZERO)

  const comparison = useMemo(() => {
    const months = [3, 2, 1, 0].map((back) => shiftPeriod(month, -back))
    return months.map((m) => {
      const by = spendByCategory(state.txns, m)
      let sum: Money = ZERO
      for (const [catId, amount] of by) {
        if (catId !== null && ids.has(catId)) sum = add(sum, amount)
      }
      return { period: m, amount: sum }
    })
  }, [state.txns, month, ids])

  const periodTotals = totalsForPeriod(state.txns, month)
  const share = periodTotals.expenses === 0 ? 0 : total / periodTotals.expenses

  const bySub = useMemo(() => {
    const totals = new Map<string, Money>()
    for (const t of rows) {
      if (t.categoryId === null) continue
      totals.set(t.categoryId, add(totals.get(t.categoryId) ?? ZERO, spendAmount(t)))
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])

  // For a person-facing category, name who it all went to when it is one person.
  const recipients = new Set(rows.map((t) => t.personId).filter((p) => p !== null))
  const soleRecipient =
    recipients.size === 1 ? personById(state, [...recipients][0] ?? null)?.name : undefined

  if (!category) {
    return (
      <View style={[styles.screen, { backgroundColor: c.ground, paddingTop: insets.top + 12 }]}>
        <View style={gutter}><BackLink label="Dashboard" /></View>
      </View>
    )
  }

  const peak = Math.max(...comparison.map((m) => m.amount), 1)
  const subPeak = Math.max(...bySub.map(([, v]) => v), 1)

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.ground }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 44 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={gutter}>
        <BackLink label="Dashboard" />

        <Text
          style={{
            fontFamily: fonts.archivo112_800, fontSize: 24,
            color: c.ink, marginTop: 20,
          }}
        >
          {categoryPath(state, category.id)}
        </Text>

        <Amount value={total} size={42} style={{ marginTop: 10 }} />

        <Body size={12} style={{ marginTop: 8 }}>
          {`${Math.round(share * 100)}% of this month · ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`}
          {soleRecipient !== undefined ? ' · ' : ''}
          {soleRecipient !== undefined && (
            <Text style={{ color: c.goldInk }}>{`all to ${soleRecipient}`}</Text>
          )}
        </Body>

        {/* four months */}
        <View style={{ marginTop: 26 }}>
          <Micro size={9}>Last four months</Micro>
          <View style={styles.compare}>
            {comparison.map((m, i) => {
              const current = i === comparison.length - 1
              const d = new Date(`${m.period.start}T12:00:00Z`)
              return (
                <View key={m.period.start} style={styles.compareCol}>
                  <View
                    style={{
                      width: '100%',
                      height: Math.max(3, (m.amount / peak) * 70),
                      borderRadius: 3,
                      backgroundColor: current ? c.gold : c.sunken,
                    }}
                  />
                  <Micro size={8.5} color={current ? c.ink : c.muted}>
                    {MONTHS_SHORT[d.getUTCMonth()]}
                  </Micro>
                </View>
              )
            })}
          </View>
        </View>

        {bySub.length > 1 && (
          <View style={{ marginTop: 26, gap: 14 }}>
            <SectionHead>Split</SectionHead>
            {bySub.map(([catId, amount]) => (
              <View key={catId} style={{ gap: 7 }}>
                <View style={styles.subRow}>
                  <Text
                    numberOfLines={1}
                    style={{ flex: 1, fontFamily: fonts.body, fontSize: 13, color: c.ink }}
                  >
                    {categoryPath(state, catId)}
                  </Text>
                  <Amount
                    value={amount} size={14} weight={700} width={100}
                    symbol={false} sign="none" letterSpacing={-0.02 * 14}
                  />
                </View>
                <Bar fraction={amount / subPeak} height={5} />
              </View>
            ))}
          </View>
        )}

        {rows.length > 0 && (
          <View style={{ marginTop: 26 }}>
            <SectionHead>Behind it</SectionHead>
            <RowGroup style={{ marginTop: 12 }}>
              {rows.map((txn, i) => (
                <View key={txn.id}>
                  {i > 0 && <RowSeparator />}
                  <TxnRow txn={txn} state={state} onPress={() => router.push(`/txn/${txn.id}`)} />
                </View>
              ))}
            </RowGroup>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  compare: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 92, marginTop: 12 },
  compareCol: { flex: 1, alignItems: 'center', gap: 8, justifyContent: 'flex-end' },
  subRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
})
