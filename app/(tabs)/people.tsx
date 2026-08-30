/**
 * People — the differentiator.
 *
 * Money to a named person is roughly half of everything this household spends,
 * and the spreadsheet could not answer "how much to Dedei this year" because
 * people lived inside the category tree. Here they are their own dimension.
 *
 * Household members are viewable but excluded from the people total: what Beb
 * costs is household spending, not support.
 */

import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ZERO, add, type Money } from '@/domain/money'
import { periodContaining, shiftPeriod } from '@/domain/period'
import { spendByPerson } from '@/domain/ledger'
import { type Person, useAppState } from '@/store/store'
import { Amount } from '@/ui/Amount'
import { InitialsDisc } from '@/ui/marks'
import { Body, Card, ScreenTitle, gutter } from '@/ui/primitives'
import { useColors } from '@/ui/ThemeProvider'
import { TAB_HEIGHT } from '@/ui/TabBar'
import { radius } from '@/ui/theme'
import { fonts } from '@/ui/type'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function People() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const state = useAppState()

  const month = periodContaining('month', state.today)
  const sent = useMemo(() => spendByPerson(state.txns, month), [state.txns, month])

  /** Five months of history, for the spark. */
  const sparks = useMemo(() => {
    const months = [4, 3, 2, 1, 0].map((back) => shiftPeriod(month, -back))
    const out = new Map<string, Money[]>()
    for (const p of state.people) {
      out.set(p.id, months.map((m) => spendByPerson(state.txns, m).get(p.id) ?? ZERO))
    }
    return out
  }, [state.people, state.txns, month])

  // Household members are excluded from the headline: this counts support.
  const supported = state.people.filter((p) => !p.isMember && (sent.get(p.id) ?? 0) > 0)
  const totalSent = supported.reduce<Money>(
    (acc, p) => add(acc, sent.get(p.id) ?? ZERO), ZERO,
  )

  const monthTotal = state.txns
    .filter((t) => t.occurredOn >= month.start && t.occurredOn <= month.end && t.type === 'expense')
    .reduce<Money>((acc, t) => add(acc, add(t.amount, t.tips)), ZERO)
  const share = monthTotal === 0 ? 0 : totalSent / monthTotal

  const ordered = [...state.people]
    .filter((p) => !p.archived)
    .sort((a, b) => (sent.get(b.id) ?? 0) - (sent.get(a.id) ?? 0))

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.ground }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: TAB_HEIGHT + 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={gutter}>
        <ScreenTitle>People</ScreenTitle>
        <Body size={12.5} style={{ marginTop: 6 }}>
          {supported.length === 0
            ? `Nothing sent in ${MONTHS[new Date(`${month.start}T12:00:00Z`).getUTCMonth()]} yet`
            : `₵${(totalSent / 100).toLocaleString('en-GH')} sent to ${supported.length} ${supported.length === 1 ? 'person' : 'people'} in ${MONTHS[new Date(`${month.start}T12:00:00Z`).getUTCMonth()]}${share >= 0.4 ? ' · half of everything spent' : ''}`}
        </Body>
      </View>

      <View style={[gutter, { marginTop: 18, gap: 10 }]}>
        {ordered.map((p) => (
          <PersonRow
            key={p.id}
            person={p}
            amount={sent.get(p.id) ?? ZERO}
            spark={sparks.get(p.id) ?? []}
            onPress={() => router.push(`/person/${p.id}`)}
          />
        ))}
      </View>
    </ScrollView>
  )
}

function PersonRow({
  person, amount, spark, onPress,
}: { person: Person; amount: Money; spark: Money[]; onPress: () => void }) {
  const c = useColors()
  const active = amount > 0
  const peak = Math.max(...spark, 1)

  return (
    <Pressable onPress={onPress}>
      <Card
        padded={false}
        dashed={person.isMember}
        style={[
          styles.card,
          person.isMember ? { backgroundColor: c.sunken } : null,
        ]}
      >
        <InitialsDisc name={person.name} size={34} active={active} />

        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13.5, color: c.ink }}>
            {person.name}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 10.5, color: c.muted }}>
            {person.isMember ? 'Household · not in people total' : (person.relation ?? 'Person')}
          </Text>
        </View>

        <View style={styles.right}>
          <View style={styles.spark}>
            {spark.map((v, i) => (
              <View
                key={i}
                style={{
                  width: 3,
                  height: Math.max(3, (v / peak) * 18),
                  borderRadius: 999,
                  backgroundColor: v > 0 ? c.gold : c.sunken,
                }}
              />
            ))}
          </View>
          {active ? (
            <Amount
              value={amount} size={15} weight={700} width={100}
              symbol={false} sign="none" letterSpacing={-0.02 * 15}
            />
          ) : (
            <Text style={{ fontFamily: fonts.archivo700, fontSize: 15, color: c.zero }}>—</Text>
          )}
        </View>
      </Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: radius.rowGroupLarge + 2,
  },
  right: { alignItems: 'flex-end', gap: 6 },
  spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 18 },
})
