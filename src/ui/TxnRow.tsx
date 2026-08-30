/**
 * The transaction row. The app's most repeated component, so it earns its
 * detail: a description over a metadata line joined by " · ", and the amount in
 * its semantic colour on the right.
 *
 * Metadata order is fixed — category › subcategory, person, account, and the
 * entering member's initial only when it was the partner. Anything absent is
 * simply skipped rather than leaving a gap.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Txn } from '@/domain/ledger'
import { add } from '@/domain/money'
import { type State, accountById, categoryPath, personById } from '@/store/store'
import { Amount, type Tone } from './Amount'
import { useColors } from './ThemeProvider'
import { type as t } from './type'
import { hit } from './theme'

/** Long account names are abbreviated in metadata, never in headings. */
function shortAccount(name: string): string {
  if (name === 'MoMo Wallet') return 'MoMo'
  if (name === 'Stanbic Bank') return 'Stanbic'
  return name
}

export function toneFor(txn: Txn): Tone {
  if (txn.type === 'income') return 'earned'
  if (txn.type === 'transfer') return 'moved'
  return 'spent'
}

export function metaFor(state: State, txn: Txn, enteredBy?: string): string {
  const bits: string[] = []

  if (txn.type === 'transfer') {
    const from = accountById(state, txn.accountId)
    const to = accountById(state, txn.counterAccountId)
    bits.push(`${shortAccount(from?.name ?? '—')} → ${shortAccount(to?.name ?? '—')}`)
  } else {
    bits.push(categoryPath(state, txn.categoryId))
    const person = personById(state, txn.personId)
    if (person) bits.push(person.name)
    const account = accountById(state, txn.accountId)
    if (account) bits.push(shortAccount(account.name))
  }

  if (enteredBy !== undefined && enteredBy !== '') bits.push(enteredBy)
  return bits.join(' · ')
}

export function TxnRow({
  txn, state, onPress, enteredBy,
}: {
  txn: Txn
  state: State
  onPress?: () => void
  /** Single initial, shown only when the partner entered it. */
  enteredBy?: string | undefined
}) {
  const c = useColors()
  const tone = toneFor(txn)
  const total = txn.type === 'expense' ? add(txn.amount, txn.tips) : txn.amount
  const title = txn.note ?? categoryPath(state, txn.categoryId)

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { opacity: pressed ? 0.7 : 1, minHeight: hit.row },
      ]}
    >
      <View style={styles.left}>
        <Text numberOfLines={1} style={[t.rowTitle, { color: c.ink }]}>
          {title}
        </Text>
        <Text numberOfLines={1} style={[t.metadata, { color: c.muted }]}>
          {metaFor(state, txn, enteredBy)}
        </Text>
      </View>
      <Amount
        value={total}
        size={16}
        weight={700}
        width={100}
        tone={tone}
        symbol={false}
        sign={txn.type === 'expense' ? 'minus' : txn.type === 'income' ? 'plus' : 'none'}
        letterSpacing={-0.02 * 16}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, paddingHorizontal: 16, gap: 12,
  },
  left: { flex: 1, gap: 3 },
})
