/**
 * Add an account, after setup.
 *
 * The same rule as first-run: you type what it holds — positive for a wallet,
 * negative for a debt, cost for an asset. Nothing is inferred.
 */

import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ZERO, parseCedis, type Money } from '@/domain/money'
import type { AccountKind } from '@/domain/networth'
import { useStore } from '@/store/store'
import { AccountMark } from '@/ui/marks'
import { Body, Micro, ScreenTitle, gutter } from '@/ui/primitives'
import { BackLink } from '../txn/[id]'
import { useColors } from '@/ui/ThemeProvider'
import { radius } from '@/ui/theme'
import { fonts } from '@/ui/type'

const KINDS: { kind: AccountKind; label: string; hint: string }[] = [
  { kind: 'cash', label: 'Cash', hint: 'what is in your pocket' },
  { kind: 'mobile_money', label: 'Mobile money', hint: 'what the wallet holds' },
  { kind: 'bank', label: 'Bank', hint: 'what the account holds' },
  { kind: 'asset', label: 'Asset', hint: 'what it cost you' },
  { kind: 'liability', label: 'Debt', hint: 'what you still owe, as a negative' },
]

function toMoney(text: string): Money {
  const trimmed = text.trim()
  if (trimmed === '' || trimmed === '-') return ZERO
  try {
    return parseCedis(trimmed)
  } catch {
    return ZERO
  }
}

export default function AddAccount() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { state, addAccount } = useStore()

  const [name, setName] = useState('')
  const [kind, setKind] = useState<AccountKind>('cash')
  const [balance, setBalance] = useState('')

  const ready = name.trim() !== ''

  function save() {
    if (!ready) return
    addAccount({
      name: name.trim(),
      kind,
      openingBalance: toMoney(balance),
      openingBalanceOn: state.today,
      hasFees: kind === 'mobile_money',
      archived: false,
      sortOrder: state.accounts.length,
    })
    router.back()
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.ground }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 44 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={gutter}>
        <BackLink label="Accounts" />
        <ScreenTitle style={{ marginTop: 20 }}>New account</ScreenTitle>

        <View style={[styles.card, { backgroundColor: c.card }]}>
          <View style={styles.head}>
            <AccountMark kind={kind} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Account name"
              placeholderTextColor={c.muted}
              autoFocus
              style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: c.ink, padding: 0 }}
            />
          </View>

          <View style={styles.kinds}>
            {KINDS.map((k) => {
              const on = k.kind === kind
              return (
                <Pressable
                  key={k.kind}
                  onPress={() => setKind(k.kind)}
                  style={[
                    styles.kindChip,
                    { backgroundColor: on ? c.gold : 'transparent', borderColor: on ? c.gold : c.line },
                  ]}
                >
                  <Text style={{ fontFamily: fonts.body, fontSize: 11, color: on ? c.goldInk : c.muted }}>
                    {k.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <View style={[styles.balanceRow, { borderTopColor: c.rowLine }]}>
            <View style={{ flex: 1 }}>
              <Micro size={8.5} tracking={0.16}>Balance</Micro>
              <Body size={11} style={{ marginTop: 2 }}>
                {KINDS.find((k) => k.kind === kind)?.hint}
              </Body>
            </View>
            <View style={styles.balanceInput}>
              <Text style={{ fontSize: 15, color: c.gold, fontWeight: '900' }}>₵</Text>
              <TextInput
                value={balance}
                onChangeText={(v) => setBalance(v.replace(/[^0-9.\-]/g, ''))}
                placeholder="0.00"
                placeholderTextColor={c.zero}
                keyboardType="numbers-and-punctuation"
                style={{
                  fontFamily: fonts.archivo800, fontSize: 20,
                  color: toMoney(balance) < 0 ? c.spent : c.ink,
                  padding: 0, minWidth: 90, textAlign: 'right',
                }}
              />
            </View>
          </View>
        </View>

        <Pressable
          disabled={!ready}
          onPress={save}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: ready ? c.gold : c.sunken, opacity: pressed && ready ? 0.85 : 1 },
          ]}
        >
          <Text style={{ fontFamily: fonts.archivo700, fontSize: 13.5, color: ready ? c.goldInk : c.zero }}>
            Add it
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.balanceCard, padding: 16, marginTop: 22 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  kindChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  balanceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 14, paddingTop: 14, borderTopWidth: 1,
  },
  balanceInput: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  button: { marginTop: 18, borderRadius: radius.fieldLarge, paddingVertical: 16, alignItems: 'center' },
})
