/**
 * Person detail.
 *
 * The 14-month rhythm strip is the app's only chart besides the dashboard bars.
 * A quiet month is a fact, not an empty state: when nothing was sent this
 * period it reports the last amount and date rather than shrugging.
 */

import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ZERO, add, type Money } from '@/domain/money'
import { type Period, periodContaining, shiftPeriod } from '@/domain/period'
import { spendAmount, spendByCategory, spendByPerson } from '@/domain/ledger'
import { categoryPath, useAppState } from '@/store/store'
import { Amount } from '@/ui/Amount'
import { InitialsDisc } from '@/ui/marks'
import {
  Bar, Body, Card, Micro, RowGroup, RowSeparator, SectionHead, gutter,
} from '@/ui/primitives'
import { TxnRow } from '@/ui/TxnRow'
import { BackLink } from '../txn/[id]'
import { useColors } from '@/ui/ThemeProvider'
import { fonts } from '@/ui/type'

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]
const RHYTHM_MONTHS = 14

export default function PersonDetail() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const state = useAppState()

  const person = state.people.find((p) => p.id === id)
  const month = periodContaining('month', state.today)

  const rhythm = useMemo(() => {
    const months: Period[] = []
    for (let back = RHYTHM_MONTHS - 1; back >= 0; back--) months.push(shiftPeriod(month, -back))
    return months.map((m) => ({
      period: m,
      amount: id === undefined ? ZERO : (spendByPerson(state.txns, m).get(id) ?? ZERO),
    }))
  }, [state.txns, month, id])

  if (!person) {
    return (
      <View style={[styles.screen, { backgroundColor: c.ground, paddingTop: insets.top + 12 }]}>
        <View style={gutter}><BackLink label="People" /></View>
      </View>
    )
  }

  const rows = state.txns.filter((t) => t.personId === person.id)
  const thisPeriod = spendByPerson(state.txns, month).get(person.id) ?? ZERO
  const allTime = rows.reduce<Money>((acc, t) => add(acc, spendAmount(t)), ZERO)
  const previous = rhythm[RHYTHM_MONTHS - 2]?.amount ?? ZERO
  const monthsWithSomething = rhythm.filter((r) => r.amount > 0).length
  const peak = Math.max(...rhythm.map((r) => r.amount), 1)

  const trend =
    previous === 0 || thisPeriod === 0
      ? null
      : Math.round(((thisPeriod - previous) / previous) * 100)

  const byCategory = useMemo(() => {
    const totals = new Map<string, Money>()
    for (const t of rows) {
      const amount = spendAmount(t)
      if (amount === 0 || t.categoryId === null) continue
      totals.set(t.categoryId, add(totals.get(t.categoryId) ?? ZERO, amount))
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])
  const categoryPeak = Math.max(...byCategory.map(([, v]) => v), 1)

  const last = rows[0]

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.ground }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 44 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={gutter}>
        <BackLink label="People" />

        <View style={styles.head}>
          <InitialsDisc name={person.name} size={48} active={thisPeriod > 0} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: fonts.archivo112_800, fontSize: 24, color: c.ink }}>
              {person.name}
            </Text>
            <Body size={12}>
              {person.isMember ? 'Household · not in people total' : (person.relation ?? 'Person')}
            </Body>
          </View>
        </View>

        {thisPeriod > 0 ? (
          <View style={{ marginTop: 22 }}>
            <Micro size={9}>{`Sent in ${MONTHS_SHORT[new Date(`${month.start}T12:00:00Z`).getUTCMonth()]}`}</Micro>
            <Amount value={thisPeriod} size={44} style={{ marginTop: 6 }} />
            <Body size={12} style={{ marginTop: 6 }}>
              {`₵${(allTime / 100).toLocaleString('en-GH')} all time`}
              {trend !== null && rows.length > 1
                ? ` · ${trend >= 0 ? '↑' : '↓'} ${Math.abs(trend)}% on last month`
                : rows.length <= 1
                  ? ' · too little history for a trend'
                  : ''}
            </Body>
          </View>
        ) : (
          <Card style={{ marginTop: 22 }}>
            <Body size={12.5}>
              {last
                ? `Nothing this month. The last was ₵${(spendAmount(last) / 100).toLocaleString('en-GH')} on ${last.occurredOn}.`
                : 'Nothing sent yet.'}
            </Body>
          </Card>
        )}

        {/* 14-month rhythm */}
        <View style={{ marginTop: 26 }}>
          <View style={styles.rhythm}>
            {rhythm.map((r, i) => {
              const current = i === RHYTHM_MONTHS - 1
              return (
                <View
                  key={r.period.start}
                  style={{
                    flex: 1,
                    height: Math.max(3, (r.amount / peak) * 54),
                    borderRadius: 2,
                    backgroundColor: r.amount === 0 ? c.sunken : current ? c.gold : c.line,
                  }}
                />
              )
            })}
          </View>
          <Body size={11.5} style={{ marginTop: 8 }}>
            {`Sent in ${monthsWithSomething} of the last ${RHYTHM_MONTHS} months`}
          </Body>
        </View>

        {byCategory.length > 0 && (
          <View style={{ marginTop: 26, gap: 14 }}>
            <SectionHead>What it went on</SectionHead>
            {byCategory.map(([catId, amount]) => (
              <View key={catId} style={{ gap: 7 }}>
                <View style={styles.catRow}>
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
                <Bar fraction={amount / categoryPeak} height={5} />
              </View>
            ))}
          </View>
        )}

        {rows.length > 0 && (
          <View style={{ marginTop: 26 }}>
            <SectionHead>History</SectionHead>
            <RowGroup style={{ marginTop: 12 }}>
              {rows.map((txn, i) => (
                <View
                  key={txn.id}
                  style={{ opacity: txn.occurredOn >= month.start ? 1 : 0.55 }}
                >
                  {i > 0 && <RowSeparator />}
                  <TxnRow
                    txn={txn}
                    state={state}
                    onPress={() => router.push(`/txn/${txn.id}`)}
                  />
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
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20 },
  rhythm: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 54 },
  catRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
})
