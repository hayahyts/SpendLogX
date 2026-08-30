/**
 * Home — "what do I have?"
 *
 * Every figure is computed: the spendable total and each card come from
 * `balances()`, the month summary from `totalsForPeriod()`. Nothing here holds
 * a number.
 */

import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ZERO, add, type Money } from '@/domain/money'
import { periodContaining } from '@/domain/period'
import { balances, totalsForPeriod } from '@/domain/ledger'
import { isSpendable } from '@/domain/networth'
import { useAppState } from '@/store/store'
import { partnerInitial } from '@/store/demo'
import { Amount } from '@/ui/Amount'
import { AccountMark, InitialsDisc } from '@/ui/marks'
import {
  Body, Card, GoldLink, Meta, Micro, RowGroup, RowSeparator, SectionHead,
  gutter,
} from '@/ui/primitives'
import { TxnRow } from '@/ui/TxnRow'
import { useColors } from '@/ui/ThemeProvider'
import { TAB_HEIGHT } from '@/ui/TabBar'
import { GUTTER, radius } from '@/ui/theme'
import { type as t } from '@/ui/type'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Home() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const state = useAppState()

  const month = periodContaining('month', state.today)
  const totals = useMemo(() => totalsForPeriod(state.txns, month), [state.txns, month])
  const ledger = useMemo(() => balances(state.accounts, state.txns), [state.accounts, state.txns])

  const spendable = state.accounts
    .filter(isSpendable)
    .reduce<Money>((acc, a) => add(acc, ledger.get(a.id) ?? ZERO), ZERO)

  const entries = state.txns.filter(
    (x) => x.occurredOn >= month.start && x.occurredOn <= month.end,
  ).length

  const d = new Date(`${state.today}T12:00:00Z`)
  const dayLabel = `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`

  // Proportional split of the month: earned, spent, moved.
  const bandTotal = totals.income + totals.expenses + totals.transfers
  const band = (v: number) => (bandTotal === 0 ? 0 : v / bandTotal)

  const recent = state.txns.slice(0, 5)
  const landMoved = state.txns
    .filter((x) => x.type === 'transfer' && x.occurredOn >= month.start && x.occurredOn <= month.end)
    .reduce<Money>((acc, x) => add(acc, x.amount), ZERO)

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.ground }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: TAB_HEIGHT + 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* greeting */}
      <View style={[gutter, styles.greetRow]}>
        <View style={{ gap: 6 }}>
          <Micro size={9}>{dayLabel}</Micro>
          <Text style={[t.screenTitle, { color: c.ink }]}>{greeting(d.getUTCHours())}</Text>
        </View>
        <Pressable style={styles.members} onPress={() => router.push('/settings')}>
          {state.members.map((m) => (
            <InitialsDisc key={m.id} name={m.name} size={26} active={m.isCurrentUser} />
          ))}
        </Pressable>
      </View>

      {/* spendable */}
      <Pressable style={[gutter, { marginTop: 22 }]} onPress={() => router.push('/net-worth')}>
        <Micro size={9}>Spendable</Micro>
        <Amount value={spendable} size={50} style={{ marginTop: 6 }} />
        <View style={styles.syncRow}>
          <View style={[styles.dot, { backgroundColor: c.gold }]} />
          <Body size={12}>
            {state.pendingSync > 0
              ? `${state.pendingSync} changes syncing · saved on this phone`
              : 'All changes saved on this phone'}
          </Body>
        </View>
      </Pressable>

      {/* accounts */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 18 }}
        contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 12 }}
      >
        {state.accounts.filter((a) => !a.archived).map((a) => {
          const held = a.kind === 'asset' || a.kind === 'liability'
          return (
            <Card key={a.id} dashed={held} style={styles.acctCard}>
              <View style={styles.acctTop}>
                <Micro size={9} style={{ flex: 1 }}>{a.name}</Micro>
                <AccountMark kind={a.kind} />
              </View>
              <Amount
                value={ledger.get(a.id) ?? ZERO}
                size={26}
                tone={held ? 'muted' : 'ink'}
                style={{ marginTop: 12 }}
              />
              {held && (
                <Meta style={{ marginTop: 4 }}>Asset · not spendable</Meta>
              )}
            </Card>
          )
        })}
      </ScrollView>

      {/* month summary */}
      <Card style={[gutter, styles.monthCard]} padded={false}>
        <View style={styles.monthHead}>
          <Micro size={9}>{`${MONTHS[d.getUTCMonth()]} so far`}</Micro>
          <Meta>{`${entries} ${entries === 1 ? 'entry' : 'entries'}`}</Meta>
        </View>
        <View style={styles.monthGrid}>
          {([
            ['Spent', totals.expenses, 'spent', 'minus'],
            ['Earned', totals.income, 'earned', 'plus'],
            ['Net', totals.net, 'ink', 'auto'],
          ] as const).map(([label, value, tone, sign]) => (
            <View key={label} style={{ flex: 1, gap: 6 }}>
              <Body size={12}>{label}</Body>
              <Amount
                value={value} size={19} weight={700} width={100}
                tone={tone} sign={sign} symbol={false}
              />
            </View>
          ))}
        </View>
        <View style={styles.band}>
          <View style={{ flex: band(totals.income), backgroundColor: c.earned }} />
          <View style={{ flex: band(totals.expenses), backgroundColor: c.spent }} />
          <View style={{ flex: band(totals.transfers), backgroundColor: c.moved }} />
        </View>
        {landMoved > 0 && (
          <Body size={11.5} style={{ marginTop: 10 }}>
            The blue band is ₵{(landMoved / 100).toLocaleString('en-GH')} moved to Land —
            movement, not spending
          </Body>
        )}
      </Card>

      {/* recent */}
      <View style={[gutter, styles.recentHead]}>
        <SectionHead>Recent</SectionHead>
        <GoldLink onPress={() => router.push('/(tabs)/log')}>
          {`All ${state.txns.length}`}
        </GoldLink>
      </View>

      {recent.length === 0 ? (
        <Card style={[gutter, { marginTop: 12 }]}>
          <Body size={12.5}>
            Nothing logged yet. Tap ₵ to add the first one — amount, category, save.
          </Body>
        </Card>
      ) : (
        <RowGroup style={[gutter, { marginTop: 12 }]}>
          {recent.map((txn, i) => (
            <View key={txn.id}>
              {i > 0 && <RowSeparator />}
              <TxnRow
                txn={txn}
                state={state}
                enteredBy={partnerInitial(state, txn.id)}
                onPress={() => router.push(`/txn/${txn.id}`)}
              />
            </View>
          ))}
        </RowGroup>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  greetRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  members: { flexDirection: 'row', gap: -6 },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 },
  dot: { width: 5, height: 5, borderRadius: 999 },
  acctCard: { width: 150, padding: 16 },
  acctTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  monthCard: { marginTop: 18, padding: 16, paddingVertical: 18, borderRadius: radius.balanceCard },
  monthHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  monthGrid: { flexDirection: 'row', marginTop: 14, gap: 10 },
  band: { flexDirection: 'row', height: 5, borderRadius: 999, overflow: 'hidden', marginTop: 14 },
  recentHead: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'baseline', marginTop: 26,
  },
})
