/**
 * Add Transaction — the hero screen.
 *
 * Three taps: amount → category → save. Everything else hides. The composition
 * is always dark, in both themes, because speed matters more than mode here.
 *
 * The person strip appears purely from the selected category and reserves no
 * space when absent; the layout above it never moves.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ZERO, type Money } from '@/domain/money'
import { isoDate } from '@/domain/period'
import type { Txn, TxnType } from '@/domain/ledger'
import {
  accountById, categoryPath, isPersonFacing, recentCategories, recentPeople, useStore,
} from '@/store/store'
import { Amount, Cedi } from '@/ui/Amount'
import { AccountMark, InitialsDisc } from '@/ui/marks'
import { Keypad, type Key } from '@/ui/Keypad'
import { EMPTY, display, isEmpty, press, toMoney } from '@/ui/amountEntry'
import { Chip, Micro, Segmented } from '@/ui/primitives'
import { SheetTheme, useColors } from '@/ui/ThemeProvider'
import { motion, radius } from '@/ui/theme'
import { fonts, micro, tabular } from '@/ui/type'
import { useToast } from '@/ui/Toast'
import { askForCategory, askForPerson } from '@/ui/pickerBridge'

const SEGMENTS = ['Expense', 'Income', 'Transfer'] as const
type Segment = (typeof SEGMENTS)[number]

const TYPE_OF: Record<Segment, TxnType> = {
  Expense: 'expense', Income: 'income', Transfer: 'transfer',
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function AddScreen() {
  return (
    <SheetTheme>
      <AddSheet />
    </SheetTheme>
  )
}

function AddSheet() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { state, addTxn } = useStore()
  const toast = useToast()

  const [segment, setSegment] = useState<Segment>('Expense')
  const [amount, setAmount] = useState(EMPTY)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [personId, setPersonId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<string | null>(
    state.accounts.find((a) => a.kind !== 'asset' && a.kind !== 'liability')?.id ?? null,
  )
  const [toId, setToId] = useState<string | null>(null)
  const [fee, setFee] = useState(EMPTY)
  const [tip, setTip] = useState(EMPTY)
  const [note, setNote] = useState('')
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const kind = TYPE_OF[segment]
  const money = toMoney(amount)
  const shown = display(amount)
  const blank = isEmpty(amount)

  const chips = useMemo(
    () => recentCategories(state, kind === 'income' ? 'income' : 'expense'),
    [state, kind],
  )
  /** A category chosen from the full picker that is not among the six chips. */
  const pickedOutsideChips =
    categoryId !== null && !chips.some((cat) => cat.id === categoryId)
  const people = useMemo(() => recentPeople(state, 2), [state])
  const showPeople = kind !== 'transfer' && isPersonFacing(state, categoryId)

  const account = accountById(state, accountId)
  const to = accountById(state, toId)
  const feesOn = account?.hasFees === true

  const caret = useCaret()
  const strip = useSlideIn(showPeople)

  const d = new Date(`${state.today}T12:00:00Z`)
  const dateLabel = `Today · ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`

  function cycleAccount(which: 'from' | 'to') {
    // An expense is paid from money you can spend; only a transfer may touch
    // an asset or a liability account.
    const usable = state.accounts.filter(
      (a) => !a.archived && (kind === 'transfer' || (a.kind !== 'asset' && a.kind !== 'liability')),
    )
    if (usable.length === 0) return
    const current = which === 'from' ? accountId : toId
    const i = usable.findIndex((a) => a.id === current)
    const next = usable[(i + 1) % usable.length]
    if (!next) return
    if (which === 'from') setAccountId(next.id)
    else setToId(next.id)
    setError(null)
  }

  function save() {
    if (blank) {
      setError('Enter an amount first')
      return
    }
    if (accountId === null) {
      setError('Choose an account')
      return
    }
    if (kind === 'transfer') {
      if (toId === null) {
        setError('Choose where the money is going')
        return
      }
      if (toId === accountId) {
        setError('A transfer needs two different accounts')
        return
      }
    }

    const txn: Omit<Txn, 'id'> = {
      type: kind,
      occurredOn: isoDate(state.today),
      amount: money,
      tips: kind === 'expense' ? toMoney(tip) : ZERO,
      fee: kind === 'transfer' ? toMoney(fee) : ZERO,
      accountId,
      counterAccountId: kind === 'transfer' ? toId : null,
      categoryId: kind === 'transfer' ? null : categoryId,
      personId: kind === 'transfer' ? null : personId,
      note: note.trim() === '' ? null : note.trim(),
      isOpening: false,
    }

    const saved = addTxn(txn)
    const person = state.people.find((p) => p.id === personId)
    const where =
      kind === 'transfer'
        ? `${account?.name ?? ''} → ${to?.name ?? ''}`
        : (person?.name ?? account?.name ?? '')

    toast.show(`Saved ${fmt(money)} to ${where}`, saved.id)
    router.back()
  }

  return (
    <View style={[styles.sheet, { backgroundColor: c.ground, paddingTop: insets.top }]}>
      {/* top bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Close"
          style={[styles.close, { backgroundColor: c.sunken }]}
        >
          <Text style={{ fontFamily: fonts.archivo600, fontSize: 15, color: c.muted }}>×</Text>
        </Pressable>

        <Segmented options={SEGMENTS} value={segment} dark onChange={(s) => {
          setSegment(s)
          setCategoryId(null)
          setPersonId(null)
          setError(null)
        }} />

        <Pressable onPress={() => setMore((m) => !m)} hitSlop={10}>
          <Text style={[micro(10, 0.14), { color: more ? c.gold : c.muted }]}>more</Text>
        </Pressable>
      </View>

      {/* amount */}
      <View style={styles.amountBlock}>
        <View style={styles.amountRow}>
          <Cedi size={30} />
          <Text
            style={[
              styles.figure,
              { color: blank ? c.emptyFigure : c.ink },
            ]}
            allowFontScaling={false}
          >
            {shown.whole}
            <Text
              style={[
                styles.pesewas,
                { color: blank ? c.emptyPesewas : c.muted },
              ]}
            >
              {shown.pesewas}
            </Text>
          </Text>
          <Animated.View style={[styles.caret, { backgroundColor: c.gold, opacity: caret }]} />
        </View>

        {/* account + date */}
        {kind !== 'transfer' && (
          <View style={styles.acctRow}>
            <Pressable
              onPress={() => cycleAccount('from')}
              style={[styles.acctPill, { backgroundColor: c.sunken }]}
            >
              {account && <AccountMark kind={account.kind} color={c.ink} scale={0.82} />}
              <Text style={{ fontFamily: fonts.archivo600, fontSize: 11.5, color: c.ink }}>
                {account?.name ?? 'Add an account'}
              </Text>
              <Text style={{ fontFamily: fonts.archivo600, fontSize: 10, color: c.muted }}>▾</Text>
            </Pressable>
            <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: c.muted }}>
              {dateLabel}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {kind === 'transfer' ? (
          <View style={styles.transferBlock}>
            <View style={styles.transferRow}>
              <AccountField
                label="From" account={account?.name ?? 'Choose'}
                onPress={() => cycleAccount('from')}
              />
              <Text style={{ fontFamily: fonts.archivo700, fontSize: 18, color: c.moved }}>→</Text>
              <AccountField
                label="To" account={to?.name ?? 'Choose'}
                onPress={() => cycleAccount('to')}
              />
            </View>
            {feesOn && (
              <View style={[styles.feeField, { borderColor: c.line }]}>
                <Micro size={8.5} tracking={0.16}>MoMo cash-out fee</Micro>
                <Text style={{ fontFamily: fonts.archivo700, fontSize: 13, color: c.gold }}>
                  {fmt(toMoney(fee))}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.chips}>
            {pickedOutsideChips && (
              <Chip
                label={categoryPath(state, categoryId)}
                selected
                onPress={() => { setCategoryId(null); setPersonId(null) }}
              />
            )}
            {chips.map((cat) => (
              <Chip
                key={cat.id}
                label={cat.name}
                selected={categoryId === cat.id}
                onPress={() => {
                  setCategoryId(categoryId === cat.id ? null : cat.id)
                  setPersonId(null)
                  setError(null)
                }}
              />
            ))}
            <Chip
              label="All ›"
              outlined
              onPress={() => {
                askForCategory((picked) => {
                  setCategoryId(picked)
                  setPersonId(null)
                  setError(null)
                })
                router.push('/picker/category')
              }}
            />
          </View>
        )}

        {/* person strip — slides, reserves no space when absent */}
        {showPeople && (
          <Animated.View
            style={[
              styles.personStrip,
              { opacity: strip, transform: [{ translateY: strip.interpolate({
                inputRange: [0, 1], outputRange: [10, 0],
              }) }] },
            ]}
          >
            <Micro size={8.5} tracking={0.16} color={c.gold} style={{ paddingHorizontal: 20 }}>
              Who is it for
            </Micro>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.personRow}
            >
              {people.map((p) => {
                const on = personId === p.id
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setPersonId(on ? null : p.id)}
                    style={[
                      styles.personChip,
                      {
                        backgroundColor: on ? c.goldTint : c.card,
                        borderColor: on ? c.gold : c.sunken,
                      },
                    ]}
                  >
                    <InitialsDisc name={p.name} size={22} active={on} />
                    <Text
                      style={{
                        fontFamily: fonts.body, fontSize: 12,
                        color: on ? c.gold : c.secondary,
                      }}
                    >
                      {p.name}
                    </Text>
                  </Pressable>
                )
              })}
              <Chip
                label={`All ${state.people.length} ›`}
                dashed
                onPress={() => {
                  askForPerson((picked) => setPersonId(picked))
                  router.push('/picker/person')
                }}
              />
            </ScrollView>
          </Animated.View>
        )}

        {/* more */}
        {more && (
          <View style={styles.moreBlock}>
            <View style={styles.moreRow}>
              <Field label="Tip" value={fmt(toMoney(tip))} gold onChangeText={setTip} raw={tip} />
              <Field label="Date" value={dateLabel} />
            </View>
            <Field label="Note" value={note} onChangeText={setNote} raw={note} full />
            <Text style={{ fontFamily: fonts.body, fontSize: 11, color: c.muted, lineHeight: 17 }}>
              Tips are stored apart from the amount, so category totals stay clean.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* error sits at thumb height, directly above the keypad */}
      {error !== null && (
        <View style={[styles.error, { backgroundColor: c.errorSurface }]}>
          <View style={[styles.errorDot, { backgroundColor: c.spent }]} />
          <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: c.spent }}>{error}</Text>
        </View>
      )}

      <View style={{ paddingBottom: insets.bottom }}>
        <Keypad
          canSave={!blank}
          onSave={save}
          onKey={(k: Key) => {
            setAmount((a) => press(a, k))
            setError(null)
          }}
        />
      </View>
    </View>
  )
}

// --- small pieces ------------------------------------------------------------

function AccountField({
  label, account, onPress,
}: { label: string; account: string; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable onPress={onPress} style={[styles.acctField, { backgroundColor: c.card }]}>
      <Micro size={8.5} tracking={0.16}>{label}</Micro>
      <Text style={{ fontFamily: fonts.archivo600, fontSize: 13, color: c.ink }}>{account}</Text>
    </Pressable>
  )
}

function Field({
  label, value, gold = false, onChangeText, raw, full = false,
}: {
  label: string; value: string; gold?: boolean
  onChangeText?: (t: string) => void; raw?: string; full?: boolean
}) {
  const c = useColors()
  return (
    <View style={[styles.field, { backgroundColor: c.card }, full ? { width: '100%' } : { flex: 1 }]}>
      <Micro size={8.5} tracking={0.16}>{label}</Micro>
      {onChangeText ? (
        <TextInput
          value={raw}
          onChangeText={onChangeText}
          placeholder={value}
          placeholderTextColor={c.muted}
          keyboardType={gold ? 'decimal-pad' : 'default'}
          style={{
            fontFamily: fonts.archivo600, fontSize: 13,
            color: gold ? c.gold : c.ink, padding: 0, marginTop: 4,
          }}
        />
      ) : (
        <Text style={{ fontFamily: fonts.archivo600, fontSize: 13, color: c.ink, marginTop: 4 }}>
          {value}
        </Text>
      )}
    </View>
  )
}

function fmt(m: Money): string {
  const abs = Math.abs(m)
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `₵${whole}.${String(abs % 100).padStart(2, '0')}`
}

/**
 * A 1.1s step blink — on for half, off for half, with no fade between, which is
 * what makes it read as a text caret rather than a pulsing dot.
 */
function useCaret() {
  const v = useRef(new Animated.Value(1)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(motion.caretBlink / 2),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(motion.caretBlink / 2),
        Animated.timing(v, { toValue: 1, duration: 0, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [v])
  return v
}

function useSlideIn(active: boolean) {
  const v = useRef(new Animated.Value(active ? 1 : 0)).current
  useEffect(() => {
    Animated.timing(v, {
      toValue: active ? 1 : 0,
      duration: motion.personStrip,
      useNativeDriver: true,
    }).start()
  }, [active, v])
  return v
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16,
  },
  close: {
    width: 30, height: 30, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  amountBlock: { paddingHorizontal: 20, paddingTop: 22 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  figure: {
    fontFamily: fonts.archivo112_800, fontSize: 56, lineHeight: 56,
    letterSpacing: -0.055 * 56, ...tabular,
  },
  pesewas: { fontSize: 31, letterSpacing: 0 },
  caret: { width: 3, height: 38, alignSelf: 'center' },
  acctRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 14,
  },
  acctPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingLeft: 10, paddingRight: 12, paddingVertical: 7, borderRadius: 999,
  },
  chips: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 7,
    paddingHorizontal: 20, paddingTop: 20,
  },
  transferBlock: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  transferRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  acctField: { flex: 1, borderRadius: radius.fieldLarge, padding: 12, paddingHorizontal: 14, gap: 4 },
  feeField: {
    borderRadius: radius.fieldLarge, borderWidth: 1, borderStyle: 'dashed',
    padding: 11, paddingHorizontal: 13, gap: 5,
  },
  personStrip: { paddingTop: 16, gap: 9 },
  personRow: { flexDirection: 'row', gap: 7, paddingHorizontal: 20 },
  personChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingLeft: 6, paddingRight: 14, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
  },
  moreBlock: { paddingHorizontal: 20, paddingTop: 18, gap: 10 },
  moreRow: { flexDirection: 'row', gap: 10 },
  field: { borderRadius: radius.fieldLarge, padding: 11, paddingHorizontal: 13 },
  error: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 14, marginBottom: 10,
    borderRadius: radius.fieldLarge, padding: 11, paddingHorizontal: 13,
  },
  errorDot: { width: 5, height: 5, borderRadius: 999 },
})
