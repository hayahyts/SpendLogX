/**
 * Transaction detail.
 *
 * Read view with a field group, and delete behind a dialog that names what
 * recalculates. This is the only destructive red in the app.
 */

import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { add, format } from '@/domain/money'
import {
  accountById, categoryPath, personById, useStore,
} from '@/store/store'
import { partnerInitial } from '@/store/demo'
import { Amount } from '@/ui/Amount'
import { Body, Card, Micro, gutter } from '@/ui/primitives'
import { toneFor } from '@/ui/TxnRow'
import { useColors } from '@/ui/ThemeProvider'
import { radius } from '@/ui/theme'
import { fonts } from '@/ui/type'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function TxnDetail() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { state, deleteTxn } = useStore()
  const [confirming, setConfirming] = useState(false)

  const txn = state.txns.find((t) => t.id === id)
  if (!txn) {
    return (
      <View style={[styles.screen, { backgroundColor: c.ground, paddingTop: insets.top + 20 }]}>
        <View style={gutter}>
          <BackLink label="Back" />
          <Body style={{ marginTop: 20 }}>That transaction is gone.</Body>
        </View>
      </View>
    )
  }

  const total = txn.type === 'expense' ? add(txn.amount, txn.tips) : txn.amount
  const d = new Date(`${txn.occurredOn}T12:00:00Z`)
  const person = personById(state, txn.personId)
  const account = accountById(state, txn.accountId)
  const counter = accountById(state, txn.counterAccountId)
  const enteredByName =
    partnerInitial(state, txn.id) === undefined
      ? (state.members.find((m) => m.isCurrentUser)?.name ?? 'You')
      : (state.members.find((m) => !m.isCurrentUser)?.name ?? 'Partner')

  const fields: [string, string][] =
    txn.type === 'transfer'
      ? [
          ['From', account?.name ?? '—'],
          ['To', counter?.name ?? '—'],
          ['Fee', format(txn.fee)],
          ['Date', `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`],
          ['Entered by', enteredByName],
        ]
      : [
          ['Category', categoryPath(state, txn.categoryId)],
          ...(person ? ([['Person', person.name]] as [string, string][]) : []),
          ['Account', account?.name ?? '—'],
          ['Date', `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`],
          ...(txn.tips > 0 ? ([['Tip', format(txn.tips)]] as [string, string][]) : []),
          ['Entered by', enteredByName],
        ]

  return (
    <View style={[styles.screen, { backgroundColor: c.ground, paddingTop: insets.top + 12 }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={gutter}>
          <BackLink label="Transactions" />

          <Micro size={9} style={{ marginTop: 22 }}>
            {txn.type === 'expense' ? 'Expense' : txn.type === 'income' ? 'Income' : 'Transfer'}
          </Micro>

          <Amount
            value={total}
            size={46}
            tone={toneFor(txn)}
            sign={txn.type === 'expense' ? 'minus' : txn.type === 'income' ? 'plus' : 'none'}
            style={{ marginTop: 8 }}
          />

          {txn.note !== null && (
            <Text
              style={{
                fontFamily: fonts.bodySemi, fontSize: 15,
                color: c.ink, marginTop: 12,
              }}
            >
              {txn.note}
            </Text>
          )}

          <Card padded={false} style={{ marginTop: 22, borderRadius: radius.rowGroupLarge }}>
            {fields.map(([k, v], i) => (
              <View key={k} style={[styles.field, i > 0 && { borderTopWidth: 1, borderTopColor: c.rowLine }]}>
                <Body size={12}>{k}</Body>
                <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.ink }}>{v}</Text>
              </View>
            ))}
          </Card>

          <Pressable
            onPress={() => setConfirming(true)}
            style={[styles.delete, { borderColor: c.deleteBorder }]}
          >
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.spent }}>
              Delete transaction
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal transparent visible={confirming} animationType="fade" onRequestClose={() => setConfirming(false)}>
        <Pressable style={styles.scrim} onPress={() => setConfirming(false)}>
          <Pressable style={[styles.dialog, { backgroundColor: c.card }]} onPress={() => {}}>
            <Text style={{ fontFamily: fonts.archivo700, fontSize: 17, color: c.ink }}>
              {`Delete ${format(total)} ${txn.note ?? categoryPath(state, txn.categoryId)}?`}
            </Text>
            <Body size={12.5} style={{ marginTop: 8 }}>
              {txn.type === 'transfer'
                ? `${account?.name ?? ''} and ${counter?.name ?? ''} both go back up, and net worth recalculates.`
                : `${account?.name ?? 'The account'} goes back up by ${format(total)}, and this month’s totals recalculate.`}
            </Body>
            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => {
                  deleteTxn(txn.id)
                  setConfirming(false)
                  router.back()
                }}
              >
                <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: c.spent }}>Delete</Text>
              </Pressable>
              <Pressable onPress={() => setConfirming(false)}>
                <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: c.ink }}>Keep it</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

export function BackLink({ label }: { label: string }) {
  const c = useColors()
  return (
    <Pressable onPress={() => router.back()} hitSlop={12}>
      <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.muted }}>
        {`‹ ${label}`}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, paddingHorizontal: 16, gap: 16,
  },
  delete: {
    marginTop: 22, borderWidth: 1, borderRadius: radius.fieldLarge,
    paddingVertical: 13, alignItems: 'center',
  },
  scrim: {
    flex: 1, backgroundColor: 'rgba(11,18,15,.45)',
    justifyContent: 'flex-end', padding: 16,
  },
  dialog: { borderRadius: radius.balanceCard, padding: 22 },
  dialogActions: { flexDirection: 'row', gap: 26, marginTop: 22 },
})
