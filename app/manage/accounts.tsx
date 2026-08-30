/**
 * Manage accounts.
 *
 * The first row is the default for new entries. MoMo carries its cash-out fee
 * setting, which is what makes the transfer form offer a fee field at all.
 */

import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ZERO } from '@/domain/money'
import { balances } from '@/domain/ledger'
import { useStore } from '@/store/store'
import { Amount } from '@/ui/Amount'
import { AccountMark } from '@/ui/marks'
import { Body, Card, Micro, ScreenTitle, gutter } from '@/ui/primitives'
import { BackLink } from '../txn/[id]'
import { useColors } from '@/ui/ThemeProvider'
import { radius } from '@/ui/theme'
import { fonts } from '@/ui/type'

export default function ManageAccounts() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { state, updateAccount } = useStore()

  const ledger = balances(state.accounts, state.txns)
  const ordered = [...state.accounts].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.ground }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 44 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={gutter}>
        <BackLink label="Settings" />
        <ScreenTitle style={{ marginTop: 20 }}>Accounts</ScreenTitle>
        <Body size={12.5} style={{ marginTop: 8, lineHeight: 19 }}>
          The first is the default for new entries.
        </Body>

        <Card padded={false} style={{ marginTop: 22, borderRadius: radius.rowGroupLarge }}>
          {ordered.map((a, i) => (
            <View
              key={a.id}
              style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.rowLine }]}
            >
              <AccountMark kind={a.kind} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  style={{
                    fontFamily: fonts.bodySemi, fontSize: 13.5,
                    color: a.archived ? c.zero : c.ink,
                    textDecorationLine: a.archived ? 'line-through' : 'none',
                  }}
                >
                  {a.name}
                </Text>
                <Body size={10.5}>
                  {i === 0 ? 'Default · ' : ''}
                  {a.kind === 'mobile_money' ? (a.hasFees ? 'cash-out fees on' : 'cash-out fees off') : a.kind}
                </Body>
              </View>
              {a.archived ? (
                <Pressable onPress={() => updateAccount({ ...a, archived: false })} hitSlop={8}>
                  <Body size={11}>Restore</Body>
                </Pressable>
              ) : (
                <Amount
                  value={ledger.get(a.id) ?? ZERO}
                  size={15} weight={700} width={100}
                  symbol={false} sign="auto"
                />
              )}
            </View>
          ))}
        </Card>

        <Pressable style={[styles.add, { borderColor: c.line }]}>
          <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.muted }}>
            + Another account
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  add: {
    marginTop: 14, borderWidth: 1, borderStyle: 'dashed',
    borderRadius: radius.fieldLarge, paddingVertical: 15, alignItems: 'center',
  },
})
