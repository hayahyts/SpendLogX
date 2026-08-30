/**
 * Account setup — step 2 of 2. The one screen allowed to be slow.
 *
 * The app starts with no accounts at all. You add each one, choose its kind and
 * type its balance. Nothing is pre-filled and nothing is inferred, which is
 * what makes every figure afterwards trustworthy: the spreadsheet this replaces
 * had opening balances entered as salary, overstating its income by ₵8,042.47.
 *
 * A negative balance is a normal thing to type here — that is how a debt is
 * recorded — so it reads as expected rather than as an error.
 */

import { useState } from 'react'
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ZERO, type Money, add, parseCedis } from '@/domain/money'
import type { AccountKind } from '@/domain/networth'
import { isSpendable } from '@/domain/networth'
import { useStore } from '@/store/store'
import { Amount } from '@/ui/Amount'
import { AccountMark } from '@/ui/marks'
import { Body, Micro, gutter } from '@/ui/primitives'
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

interface Draft {
  key: number
  name: string
  kind: AccountKind
  balance: string
}

let nextKey = 0

function toMoney(text: string): Money {
  const trimmed = text.trim()
  if (trimmed === '' || trimmed === '-') return ZERO
  try {
    return parseCedis(trimmed)
  } catch {
    return ZERO
  }
}

export default function AccountSetup() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { state, addAccount } = useStore()

  const [drafts, setDrafts] = useState<Draft[]>([
    { key: nextKey++, name: '', kind: 'cash', balance: '' },
  ])

  const usable = drafts.filter((d) => d.name.trim() !== '')
  const spendableTotal = usable
    .filter((d) => isSpendable({ kind: d.kind }))
    .reduce<Money>((acc, d) => add(acc, toMoney(d.balance)), ZERO)

  const ready = usable.length > 0

  function update(key: number, patch: Partial<Draft>) {
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  }

  function confirm() {
    usable.forEach((d, i) => {
      addAccount({
        name: d.name.trim(),
        kind: d.kind,
        openingBalance: toMoney(d.balance),
        openingBalanceOn: state.today,
        hasFees: d.kind === 'mobile_money',
        archived: false,
        sortOrder: i,
      })
    })
    router.replace('/(tabs)/')
  }

  return (
    <View style={[styles.screen, { backgroundColor: c.ground, paddingTop: insets.top + 20 }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={gutter}>
          <Micro size={9}>Step 2 of 2</Micro>
          <Text style={{ fontFamily: fonts.archivo112_800, fontSize: 25, color: c.ink, marginTop: 10 }}>
            What do you have?
          </Text>
          <Body size={12.5} style={{ marginTop: 10, lineHeight: 20 }}>
            Add each account and type what it holds right now. Nothing is guessed
            and nothing is carried over — every figure the app shows afterwards
            is built from what you enter here.
          </Body>
          <Body size={12.5} style={{ marginTop: 10, lineHeight: 20 }}>
            A debt is typed as a negative, like −11599. That is normal here.
          </Body>
        </View>

        <View style={[gutter, { marginTop: 24, gap: 12 }]}>
          {drafts.map((d) => {
            const held = !isSpendable({ kind: d.kind })
            return (
              <View
                key={d.key}
                style={[
                  styles.card,
                  held
                    ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.line }
                    : { backgroundColor: c.card },
                ]}
              >
                <View style={styles.cardHead}>
                  <AccountMark kind={d.kind} />
                  <TextInput
                    value={d.name}
                    onChangeText={(v) => update(d.key, { name: v })}
                    placeholder="Account name"
                    placeholderTextColor={c.muted}
                    style={{
                      flex: 1, fontFamily: fonts.bodySemi, fontSize: 14,
                      color: c.ink, padding: 0,
                    }}
                  />
                </View>

                <View style={styles.kinds}>
                  {KINDS.map((k) => {
                    const on = k.kind === d.kind
                    return (
                      <Pressable
                        key={k.kind}
                        onPress={() => update(d.key, { kind: k.kind })}
                        style={[
                          styles.kindChip,
                          {
                            backgroundColor: on ? c.gold : 'transparent',
                            borderColor: on ? c.gold : c.line,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontFamily: fonts.body, fontSize: 11,
                            color: on ? c.goldInk : c.muted,
                          }}
                        >
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
                      {KINDS.find((k) => k.kind === d.kind)?.hint}
                    </Body>
                  </View>
                  <View style={styles.balanceInput}>
                    <Text style={{ fontFamily: undefined, fontSize: 15, color: c.gold, fontWeight: '900' }}>₵</Text>
                    <TextInput
                      value={d.balance}
                      onChangeText={(v) => update(d.key, { balance: v.replace(/[^0-9.\-]/g, '') })}
                      placeholder="0.00"
                      placeholderTextColor={c.zero}
                      keyboardType="numbers-and-punctuation"
                      style={{
                        fontFamily: fonts.archivo800, fontSize: 20,
                        color: toMoney(d.balance) < 0 ? c.spent : c.ink,
                        padding: 0, minWidth: 90, textAlign: 'right',
                      }}
                    />
                  </View>
                </View>
              </View>
            )
          })}

          <Pressable
            onPress={() =>
              setDrafts((ds) => [...ds, { key: nextKey++, name: '', kind: 'cash', balance: '' }])
            }
            style={[styles.add, { borderColor: c.line }]}
          >
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.muted }}>
              + Another account
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[gutter, styles.footer, { paddingBottom: insets.bottom + 20, borderTopColor: c.line }]}>
        <View style={styles.totalRow}>
          <Micro size={9}>Spendable total</Micro>
          <Amount value={spendableTotal} size={22} weight={700} width={100} />
        </View>
        <Pressable
          disabled={!ready}
          onPress={confirm}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: ready ? c.gold : c.sunken, opacity: pressed && ready ? 0.85 : 1 },
          ]}
        >
          <Text
            style={{
              fontFamily: fonts.archivo700, fontSize: 13.5,
              color: ready ? c.goldInk : c.zero,
            }}
          >
            These are correct
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  card: { borderRadius: radius.balanceCard, padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  kindChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  balanceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 14, paddingTop: 14, borderTopWidth: 1,
  },
  balanceInput: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  add: {
    borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.fieldLarge,
    paddingVertical: 15, alignItems: 'center',
  },
  footer: { borderTopWidth: 1, paddingTop: 16, gap: 14 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  button: { borderRadius: radius.fieldLarge, paddingVertical: 16, alignItems: 'center' },
})
