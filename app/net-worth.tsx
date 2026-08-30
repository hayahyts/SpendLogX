/**
 * Net worth.
 *
 * Spendable plus assets at valuation, less what is owed. Assets contribute
 * their valuation and never their ledger balance, so nothing is counted twice —
 * and an asset nobody has valued says so rather than quietly standing in.
 *
 * A valuation changes net worth only. It never appears as income, which is the
 * whole reason it lives in its own table rather than as a transaction.
 */

import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ZERO, format, parseCedis, type Money } from '@/domain/money'
import { assetPositions, liabilityPositions } from '@/domain/networth'
import { useStore, worth } from '@/store/store'
import { Amount } from '@/ui/Amount'
import { AccountMark } from '@/ui/marks'
import { Body, Card, Micro, ScreenTitle, gutter } from '@/ui/primitives'
import { BackLink } from './txn/[id]'
import { useColors } from '@/ui/ThemeProvider'
import { radius } from '@/ui/theme'
import { fonts } from '@/ui/type'

export default function NetWorth() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { state, addValuation } = useStore()
  const [draft, setDraft] = useState('')

  const nw = worth(state)
  const assets = assetPositions(state.accounts, state.txns, state.valuations, state.today)
  const debts = liabilityPositions(state.accounts, state.txns, state.today)
  const firstAsset = assets[0]

  const history = state.valuations
    .filter((v) => v.accountId === firstAsset?.accountId)
    .sort((a, b) => (a.asOf < b.asOf ? -1 : 1))
  const peak = Math.max(...history.map((h) => h.value), firstAsset?.costBasis ?? 1, 1)

  function record() {
    if (firstAsset === undefined || draft.trim() === '') return
    try {
      addValuation({
        accountId: firstAsset.accountId,
        asOf: state.today,
        value: parseCedis(draft),
        note: null,
      })
      setDraft('')
    } catch {
      // An unparseable figure simply does not record; nothing is destroyed.
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.ground }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 44 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={gutter}>
        <BackLink label="Home" />
        <ScreenTitle style={{ marginTop: 20 }}>Net worth</ScreenTitle>

        <Amount value={nw.total} size={44} style={{ marginTop: 14 }} />
        <Body size={12} style={{ marginTop: 8 }}>
          {`${format(nw.spendable)} spendable · ${format(nw.assets)} in assets`}
          {nw.liabilities > 0 ? ` · ${format(nw.liabilities)} owed` : ''}
        </Body>

        {assets.length > 0 && (
          <>
            <Micro size={9} style={{ marginTop: 30 }}>Assets</Micro>
            <View style={{ marginTop: 10, gap: 10 }}>
              {assets.map((a) => (
                <Card key={a.accountId} dashed>
                  <View style={styles.assetHead}>
                    <AccountMark kind="asset" />
                    <Text style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: c.ink }}>
                      {a.name}
                    </Text>
                  </View>
                  <Amount value={a.value} size={28} style={{ marginTop: 12 }} />
                  <Body size={11.5} style={{ marginTop: 6 }}>
                    {a.unvalued
                      ? `Held at what it cost — nobody has said what it is worth`
                      : `Cost ${format(a.costBasis)} · ${a.gain >= 0 ? 'up' : 'down'} ${format(Math.abs(a.gain) as Money)} since`}
                  </Body>
                </Card>
              ))}
            </View>
          </>
        )}

        {debts.length > 0 && (
          <>
            <Micro size={9} style={{ marginTop: 26 }}>Owed</Micro>
            <Card padded={false} style={{ marginTop: 10, borderRadius: radius.rowGroupLarge }}>
              {debts.map((d, i) => (
                <View
                  key={d.accountId}
                  style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.rowLine }]}
                >
                  <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 13, color: c.ink }}>
                    {d.name}
                  </Text>
                  {d.settled ? (
                    <Body size={12}>Cleared</Body>
                  ) : (
                    <Amount
                      value={d.owed} size={15} weight={700} width={100}
                      symbol={false} sign="none" tone="spent"
                    />
                  )}
                </View>
              ))}
            </Card>
          </>
        )}

        {/* valuation history */}
        {firstAsset !== undefined && history.length > 0 && (
          <>
            <Micro size={9} style={{ marginTop: 30 }}>{`${firstAsset.name} over time`}</Micro>
            <View style={styles.history}>
              {history.map((h) => (
                <View key={h.asOf} style={styles.historyCol}>
                  <View
                    style={{
                      width: '100%',
                      height: Math.max(4, (h.value / peak) * 70),
                      borderRadius: 3,
                      backgroundColor: c.gold,
                    }}
                  />
                  <Micro size={8}>{h.asOf.slice(5)}</Micro>
                </View>
              ))}
            </View>
          </>
        )}

        {/* add a valuation */}
        {firstAsset !== undefined && (
          <Card style={{ marginTop: 26 }}>
            <Micro size={8.5} tracking={0.16}>{`What is ${firstAsset.name} worth now?`}</Micro>
            <View style={styles.valuationRow}>
              <Text style={{ fontSize: 22, color: c.gold, fontWeight: '900' }}>₵</Text>
              <TextInput
                value={draft}
                onChangeText={(v) => setDraft(v.replace(/[^0-9.]/g, ''))}
                placeholder="0.00"
                placeholderTextColor={c.zero}
                keyboardType="decimal-pad"
                style={{
                  flex: 1, fontFamily: fonts.archivo112_800, fontSize: 30,
                  color: c.ink, padding: 0,
                }}
              />
              <Pressable
                onPress={record}
                style={[styles.record, { backgroundColor: draft === '' ? c.sunken : c.gold }]}
              >
                <Text
                  style={{
                    fontFamily: fonts.archivo700, fontSize: 12,
                    color: draft === '' ? c.zero : c.goldInk,
                  }}
                >
                  Record
                </Text>
              </Pressable>
            </View>
            <Body size={11.5} style={{ marginTop: 12, lineHeight: 18 }}>
              A valuation changes net worth only. It never appears as income.
            </Body>
          </Card>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  assetHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  history: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 92, marginTop: 12 },
  historyCol: { flex: 1, alignItems: 'center', gap: 8, justifyContent: 'flex-end' },
  valuationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  record: { borderRadius: radius.field, paddingHorizontal: 14, paddingVertical: 10 },
})
