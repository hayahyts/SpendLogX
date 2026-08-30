/**
 * Dashboard.
 *
 * Replaces five spreadsheet tabs. Every category the household uses is
 * represented — the ones with nothing this period collapse into muted chips
 * rather than a column of zeros, so none is ever silently omitted. That is the
 * defect this whole app exists to prevent, made visible.
 */

import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ZERO, add, type Money } from '@/domain/money'
import {
  type Period, type PeriodKind, label as periodLabel, periodContaining, shiftPeriod,
} from '@/domain/period'
import { spendByCategory, totalsForPeriod } from '@/domain/ledger'
import { type State, categoryPath, topLevel, useAppState } from '@/store/store'
import { Amount, Cedi } from '@/ui/Amount'
import {
  Bar, Body, Card, Chip, Micro, ScreenTitle, SectionHead, Segmented, gutter,
} from '@/ui/primitives'
import { useColors } from '@/ui/ThemeProvider'
import { TAB_HEIGHT } from '@/ui/TabBar'
import { radius } from '@/ui/theme'
import { fonts } from '@/ui/type'

const KINDS = ['Week', 'Month', 'Quarter', 'Year'] as const
type KindLabel = (typeof KINDS)[number]
const KIND_OF: Record<KindLabel, PeriodKind> = {
  Week: 'week', Month: 'month', Quarter: 'quarter', Year: 'year',
}

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function rangeLabel(p: Period): string {
  const a = new Date(`${p.start}T12:00:00Z`)
  const b = new Date(`${p.end}T12:00:00Z`)
  const same = a.getUTCMonth() === b.getUTCMonth()
  const left = `${a.getUTCDate()} ${same ? '' : MONTHS_SHORT[a.getUTCMonth()]}`.trim()
  return `${left} – ${b.getUTCDate()} ${MONTHS_SHORT[b.getUTCMonth()]}`
}

/** "This week" reads better than the date range when you are in it. */
function headline(p: Period, today: string): string {
  const current = periodContaining(p.kind, today as never)
  if (current.start === p.start) {
    return p.kind === 'week' ? 'This week'
      : p.kind === 'month' ? 'This month'
      : p.kind === 'quarter' ? 'This quarter' : 'This year'
  }
  return periodLabel(p)
}

export default function Report() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const state = useAppState()

  const [kindLabel, setKindLabel] = useState<KindLabel>('Week')
  const [offset, setOffset] = useState(0)

  const period = useMemo(() => {
    const base = periodContaining(KIND_OF[kindLabel], state.today)
    return offset === 0 ? base : shiftPeriod(base, offset)
  }, [kindLabel, offset, state.today])

  const totals = useMemo(() => totalsForPeriod(state.txns, period), [state.txns, period])
  const byCategory = useMemo(() => spendByCategory(state.txns, period), [state.txns, period])
  const entries = state.txns.filter(
    (t) => t.occurredOn >= period.start && t.occurredOn <= period.end,
  ).length

  // Roll subcategory spend up to its top-level parent, keeping the deepest
  // name for display when a category was only used through one child.
  const ranked = useMemo(() => {
    const rows: { id: string; name: string; amount: Money }[] = []
    for (const [catId, amount] of byCategory) {
      if (catId === null) continue
      rows.push({ id: catId, name: categoryPath(state, catId), amount })
    }
    return rows.sort((a, b) => b.amount - a.amount)
  }, [byCategory, state])

  const used = new Set(
    ranked.map((r) => {
      const cat = state.categories.find((x) => x.id === r.id)
      return cat?.parentId ?? r.id
    }),
  )
  const allTop = topLevel(state, 'expense')
  const unused = allTop.filter((cat) => !used.has(cat.id))

  const biggest = ranked[0]?.amount ?? ZERO
  const landMoved = state.txns
    .filter((t) => t.type === 'transfer' && t.occurredOn >= period.start && t.occurredOn <= period.end)
    .reduce<Money>((acc, t) => add(acc, t.amount), ZERO)

  const atCurrent = offset >= 0

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.ground }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: TAB_HEIGHT + 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={gutter}>
        <ScreenTitle>Dashboard</ScreenTitle>
      </View>

      {/* period picker */}
      <View style={[gutter, { marginTop: 14 }]}>
        <View style={[styles.periodBar, { backgroundColor: c.card }]}>
          <Pressable onPress={() => setOffset((o) => o - 1)} hitSlop={12}>
            <Text style={{ fontFamily: fonts.archivo600, fontSize: 18, color: c.muted }}>‹</Text>
          </Pressable>
          <View style={{ alignItems: 'center', gap: 3 }}>
            <Text style={{ fontFamily: fonts.archivo700, fontSize: 15, color: c.ink }}>
              {headline(period, state.today)}
            </Text>
            <Body size={11.5}>{`${rangeLabel(period)} · ${entries} ${entries === 1 ? 'entry' : 'entries'}`}</Body>
          </View>
          <Pressable onPress={() => !atCurrent && setOffset((o) => o + 1)} hitSlop={12} disabled={atCurrent}>
            <Text
              style={{
                fontFamily: fonts.archivo600, fontSize: 18,
                color: atCurrent ? c.zero : c.muted,
              }}
            >
              ›
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={[gutter, { marginTop: 12 }]}>
        <Segmented
          options={KINDS}
          value={kindLabel}
          onChange={(k) => { setKindLabel(k); setOffset(0) }}
        />
      </View>

      {/* summary tiles */}
      <View style={[gutter, styles.tiles]}>
        <Tile label="Expenses" value={totals.expenses} tone="spent" sign="minus" />
        <Tile label="Income" value={totals.income} tone="earned" sign="plus" />
        <Tile label="Transfers" value={totals.transfers} tone="moved" sign="none" />
        <Tile label="Net" value={totals.net} tone="gold" sign="auto" ink />
      </View>

      {landMoved > 0 && (
        <View style={[gutter, styles.landNote]}>
          <View style={[styles.landMark, { borderColor: c.muted }]} />
          <Body size={11.5} style={{ flex: 1 }}>
            {`₵${(landMoved / 100).toLocaleString('en-GH')} to Land is counted as a transfer, so it sits in Transfers and never inside spending`}
          </Body>
        </View>
      )}

      {/* where it went */}
      <View style={[gutter, styles.sectionHead]}>
        <SectionHead>Where it went</SectionHead>
        <Body size={11.5}>{`${ranked.length} of ${allTop.length} categories used`}</Body>
      </View>

      {ranked.length === 0 ? (
        <View style={[gutter, styles.empty]}>
          <Cedi size={62} color={c.zero} />
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: c.ink, marginTop: 14 }}>
            {`${periodLabel(period)} hasn’t started spending yet`}
          </Text>
        </View>
      ) : (
        <View style={[gutter, { marginTop: 8, gap: 16 }]}>
          {ranked.map((row) => (
            <Pressable
              key={row.id}
              onPress={() => router.push(`/category/${row.id}`)}
              style={{ gap: 8 }}
            >
              <View style={styles.rankRow}>
                <Text
                  numberOfLines={1}
                  style={{ flex: 1, fontFamily: fonts.body, fontSize: 14, color: c.ink }}
                >
                  {row.name}
                </Text>
                <Body size={11.5}>
                  {totals.expenses === 0 ? '' : `${Math.round((row.amount / totals.expenses) * 100)}%`}
                </Body>
                <Amount
                  value={row.amount} size={16} weight={700} width={100}
                  symbol={false} sign="none" letterSpacing={-0.02 * 16}
                />
              </View>
              <Bar fraction={biggest === 0 ? 0 : row.amount / biggest} />
            </Pressable>
          ))}
        </View>
      )}

      {unused.length > 0 && (
        <View style={[gutter, { marginTop: 22, gap: 10 }]}>
          <Micro size={9}>{`Nothing this ${period.kind}`}</Micro>
          <View style={styles.chipWrap}>
            {unused.map((cat) => (
              <Chip key={cat.id} label={cat.name} outlined />
            ))}
          </View>
          <Body size={11.5}>
            Unused categories collapse into chips rather than a column of zeros —
            still all present, never omitted
          </Body>
        </View>
      )}
    </ScrollView>
  )
}

function Tile({
  label, value, tone, sign, ink = false,
}: {
  label: string
  value: Money
  tone: 'spent' | 'earned' | 'moved' | 'gold'
  sign: 'minus' | 'plus' | 'none' | 'auto'
  /** The Net tile sits on ink with its figure in gold. */
  ink?: boolean
}) {
  const c = useColors()
  const zero = value === 0
  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: ink ? c.ink : c.card },
      ]}
    >
      <Body size={12} color={ink ? c.muted : c.muted}>{label}</Body>
      <Amount
        value={value}
        size={22}
        weight={700}
        width={100}
        tone={zero && !ink ? 'zero' : tone}
        sign={zero ? 'none' : sign}
        symbol={false}
        letterSpacing={-0.02 * 22}
        style={{ marginTop: 6 }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  periodBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: radius.rowGroupLarge, paddingVertical: 14, paddingHorizontal: 18,
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  tile: {
    width: '48%', flexGrow: 1,
    borderRadius: radius.rowGroupLarge, padding: 14,
  },
  landNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 16 },
  landMark: { width: 13, height: 13, borderRadius: 2, borderWidth: 1.5, borderStyle: 'dashed', marginTop: 3 },
  sectionHead: {
    flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'space-between', marginTop: 26,
  },
  rankRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  empty: { alignItems: 'center', paddingTop: 40 },
})
