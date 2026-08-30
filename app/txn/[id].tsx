/**
 * Transaction detail — read, edit in place, delete.
 *
 * Editing keeps the semantic rules: the amount stays positive, direction stays
 * with the type, and a change is validated by the same `effects()` that the
 * ledger runs on, so a transaction that cannot be applied cannot be saved.
 * Delete sits behind a dialog that names what recalculates — the only
 * destructive red in the app.
 */

import { useEffect, useState } from 'react'
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { add, format, parseCedis, ZERO, type Money } from '@/domain/money'
import { isoDate } from '@/domain/period'
import type { Txn } from '@/domain/ledger'
import { effects } from '@/domain/ledger'
import {
  accountById, categoryPath, personById, useStore,
} from '@/store/store'
import { partnerInitial } from '@/store/demo'
import { Amount } from '@/ui/Amount'
import { Body, Card, Micro, gutter } from '@/ui/primitives'
import { toneFor } from '@/ui/TxnRow'
import { askForCategory, askForPerson } from '@/ui/pickerBridge'
import { useColors } from '@/ui/ThemeProvider'
import { radius } from '@/ui/theme'
import { fonts } from '@/ui/type'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function parseOr(text: string, fallback: Money): Money {
  try {
    return parseCedis(text)
  } catch {
    return fallback
  }
}

export default function TxnDetail() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ id: string; edit?: string; confirm?: string }>()
  const { state, updateTxn, deleteTxn } = useStore()

  const txn = state.txns.find((t) => t.id === params.id)

  const [editing, setEditing] = useState(params.edit === '1')
  const [confirming, setConfirming] = useState(params.confirm === '1')
  const [error, setError] = useState<string | null>(null)

  // Draft fields, as text while editing.
  const [amountText, setAmountText] = useState('')
  const [tipText, setTipText] = useState('')
  const [dateText, setDateText] = useState('')
  const [noteText, setNoteText] = useState('')
  const [draftCategory, setDraftCategory] = useState<string | null>(null)
  const [draftPerson, setDraftPerson] = useState<string | null>(null)
  const [draftAccount, setDraftAccount] = useState<string | null>(null)

  useEffect(() => {
    if (!txn) return
    setAmountText(format(txn.amount, { symbol: false }).replace(/,/g, ''))
    setTipText(txn.tips === 0 ? '' : format(txn.tips, { symbol: false }).replace(/,/g, ''))
    setDateText(txn.occurredOn)
    setNoteText(txn.note ?? '')
    setDraftCategory(txn.categoryId)
    setDraftPerson(txn.personId)
    setDraftAccount(txn.accountId)
  }, [txn?.id, editing])

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

  function cycleDraftAccount() {
    if (!txn) return
    const usable = state.accounts.filter(
      (a) => !a.archived && (txn.type === 'transfer' || (a.kind !== 'asset' && a.kind !== 'liability')),
    )
    if (usable.length === 0) return
    const i = usable.findIndex((a) => a.id === draftAccount)
    setDraftAccount(usable[(i + 1) % usable.length]?.id ?? draftAccount)
  }

  function saveChanges() {
    if (!txn) return
    let occurredOn
    try {
      occurredOn = isoDate(dateText.trim())
    } catch {
      setError('The date needs to be YYYY-MM-DD')
      return
    }
    const amount = parseOr(amountText.trim(), ZERO)
    if (amount <= 0) {
      setError('The amount has to be more than zero')
      return
    }
    const next: Txn = {
      ...txn,
      occurredOn,
      amount,
      tips: txn.type === 'expense' ? parseOr(tipText.trim() === '' ? '0' : tipText.trim(), ZERO) : txn.tips,
      note: noteText.trim() === '' ? null : noteText.trim(),
      categoryId: txn.type === 'transfer' ? null : draftCategory,
      personId: txn.type === 'transfer' ? null : draftPerson,
      accountId: draftAccount ?? txn.accountId,
    }
    try {
      effects(next) // the ledger's own validation; nothing invalid gets stored
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That change does not add up')
      return
    }
    updateTxn(next)
    setError(null)
    setEditing(false)
  }

  const draftAcct = accountById(state, draftAccount)

  const fields: [string, string, (() => void) | null][] =
    txn.type === 'transfer'
      ? [
          ['From', account?.name ?? '—', null],
          ['To', counter?.name ?? '—', null],
          ['Fee', format(txn.fee), null],
          ['Date', `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`, null],
          ['Entered by', enteredByName, null],
        ]
      : [
          ['Category', categoryPath(state, txn.categoryId), null],
          ...(person ? ([['Person', person.name, null]] as [string, string, null][]) : []),
          ['Account', account?.name ?? '—', null],
          ['Date', `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`, null],
          ...(txn.tips > 0 ? ([['Tip', format(txn.tips), null]] as [string, string, null][]) : []),
          ['Entered by', enteredByName, null],
        ]

  return (
    <View style={[styles.screen, { backgroundColor: c.ground, paddingTop: insets.top + 12 }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={gutter}>
          <View style={styles.topRow}>
            {editing ? (
              <>
                <Pressable onPress={() => { setEditing(false); setError(null) }} hitSlop={12}>
                  <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.muted }}>
                    Cancel
                  </Text>
                </Pressable>
                <Pressable onPress={saveChanges} hitSlop={12}>
                  <Text style={{ fontFamily: fonts.archivo700, fontSize: 11, letterSpacing: 1.2, color: c.goldInk }}>
                    SAVE CHANGES
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <BackLink label="Transactions" />
                <Pressable onPress={() => setEditing(true)} hitSlop={12}>
                  <Text style={{ fontFamily: fonts.archivo700, fontSize: 11, letterSpacing: 1.2, color: c.goldInk }}>
                    EDIT
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          <Micro size={9} style={{ marginTop: 22 }}>
            {txn.type === 'expense' ? 'Expense' : txn.type === 'income' ? 'Income' : 'Transfer'}
          </Micro>

          {editing ? (
            <View style={styles.amountEdit}>
              <Text style={{ fontSize: 25, color: c.gold, fontWeight: '900' }}>₵</Text>
              <TextInput
                value={amountText}
                onChangeText={(v) => setAmountText(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                autoFocus
                style={{
                  fontFamily: fonts.archivo112_800, fontSize: 46,
                  color: c.ink, padding: 0, flex: 1,
                }}
              />
              <View style={[styles.caret, { backgroundColor: c.gold }]} />
            </View>
          ) : (
            <Amount
              value={total}
              size={46}
              tone={toneFor(txn)}
              sign={txn.type === 'expense' ? 'minus' : txn.type === 'income' ? 'plus' : 'none'}
              style={{ marginTop: 8 }}
            />
          )}

          {editing ? (
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Description"
              placeholderTextColor={c.muted}
              style={{
                fontFamily: fonts.bodySemi, fontSize: 15, color: c.ink,
                marginTop: 12, padding: 0,
              }}
            />
          ) : (
            txn.note !== null && (
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: c.ink, marginTop: 12 }}>
                {txn.note}
              </Text>
            )
          )}

          {editing ? (
            <Card padded={false} style={{ marginTop: 22, borderRadius: radius.rowGroupLarge }}>
              {txn.type !== 'transfer' && (
                <>
                  <EditRow
                    label="Category"
                    value={categoryPath(state, draftCategory)}
                    onPress={() => {
                      askForCategory((picked) => setDraftCategory(picked))
                      router.push('/picker/category')
                    }}
                  />
                  <EditRow
                    label="Person"
                    value={personById(state, draftPerson)?.name ?? 'Nobody'}
                    onPress={() => {
                      askForPerson((picked) => setDraftPerson(picked))
                      router.push('/picker/person')
                    }}
                    top
                  />
                  <EditRow
                    label="Account"
                    value={draftAcct?.name ?? '—'}
                    onPress={cycleDraftAccount}
                    top
                  />
                </>
              )}
              <View style={[styles.field, txn.type !== 'transfer' && { borderTopWidth: 1, borderTopColor: c.rowLine }]}>
                <Body size={12}>Date</Body>
                <TextInput
                  value={dateText}
                  onChangeText={setDateText}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={c.muted}
                  style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.ink, padding: 0, textAlign: 'right', minWidth: 110 }}
                />
              </View>
              {txn.type === 'expense' && (
                <View style={[styles.field, { borderTopWidth: 1, borderTopColor: c.rowLine }]}>
                  <Body size={12}>Tip</Body>
                  <TextInput
                    value={tipText}
                    onChangeText={(v) => setTipText(v.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    placeholderTextColor={c.muted}
                    style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.goldInk, padding: 0, textAlign: 'right', minWidth: 80 }}
                  />
                </View>
              )}
            </Card>
          ) : (
            <Card padded={false} style={{ marginTop: 22, borderRadius: radius.rowGroupLarge }}>
              {fields.map(([k, v], i) => (
                <View key={k} style={[styles.field, i > 0 && { borderTopWidth: 1, borderTopColor: c.rowLine }]}>
                  <Body size={12}>{k}</Body>
                  <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.ink }}>{v}</Text>
                </View>
              ))}
            </Card>
          )}

          {error !== null && (
            <View style={[styles.error, { backgroundColor: c.errorSurface }]}>
              <View style={[styles.errorDot, { backgroundColor: c.spent }]} />
              <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: c.spent }}>{error}</Text>
            </View>
          )}

          {!editing && (
            <Pressable
              onPress={() => setConfirming(true)}
              style={[styles.delete, { borderColor: c.deleteBorder }]}
            >
              <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.spent }}>
                Delete transaction
              </Text>
            </Pressable>
          )}
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

function EditRow({
  label, value, onPress, top = false,
}: { label: string; value: string; onPress: () => void; top?: boolean }) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      style={[styles.field, top && { borderTopWidth: 1, borderTopColor: c.rowLine }]}
    >
      <Body size={12}>{label}</Body>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.ink }}>{value}</Text>
        <Text style={{ fontFamily: fonts.archivo600, fontSize: 13, color: c.zero }}>›</Text>
      </View>
    </Pressable>
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
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amountEdit: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  caret: { width: 3, height: 34 },
  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, paddingHorizontal: 16, gap: 16,
  },
  error: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 14, borderRadius: radius.fieldLarge, padding: 11, paddingHorizontal: 13,
  },
  errorDot: { width: 5, height: 5, borderRadius: 999 },
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
