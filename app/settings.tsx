/**
 * Settings — two grouped lists: the ledger, and the household.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAppState } from '@/store/store'
import { Body, Card, Micro, ScreenTitle, gutter } from '@/ui/primitives'
import { BackLink } from './txn/[id]'
import { useColors } from '@/ui/ThemeProvider'
import { radius } from '@/ui/theme'
import { fonts } from '@/ui/type'
import { Pressable } from 'react-native'

export default function Settings() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const state = useAppState()

  const ledger: [string, string, string][] = [
    ['Accounts', `${state.accounts.filter((a) => !a.archived).length}`, '/manage/accounts'],
    ['Categories', `${state.categories.filter((x) => x.parentId === null && !x.archived).length} top level`, '/manage/categories'],
    ['People', `${state.people.filter((p) => !p.archived).length}`, '/(tabs)/people'],
    ['Net worth & assets', '', '/net-worth'],
  ]

  const household: [string, string, string | null][] = [
    ['Members', `${state.members.length}`, '/manage/household'],
    ['Appearance', 'Follow phone', null],
    ['Export everything', 'CSV', null],
  ]

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.ground }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 44 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={gutter}>
        <BackLink label="Home" />
        <ScreenTitle style={{ marginTop: 20 }}>Settings</ScreenTitle>

        <Micro size={9} style={{ marginTop: 28 }}>The ledger</Micro>
        <Card padded={false} style={{ marginTop: 10, borderRadius: radius.rowGroupLarge }}>
          {ledger.map(([label, value, href], i) => (
            <Pressable
              key={label}
              onPress={() => router.push(href as never)}
              style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.rowLine }]}
            >
              <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 13, color: c.ink }}>
                {label}
              </Text>
              <Body size={12}>{value}</Body>
              <Text style={{ fontFamily: fonts.archivo600, fontSize: 14, color: c.zero }}>›</Text>
            </Pressable>
          ))}
        </Card>

        <Micro size={9} style={{ marginTop: 26 }}>Household</Micro>
        <Card padded={false} style={{ marginTop: 10, borderRadius: radius.rowGroupLarge }}>
          {household.map(([label, value, href], i) => (
            <Pressable
              key={label}
              disabled={href === null}
              onPress={() => href !== null && router.push(href as never)}
              style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.rowLine }]}
            >
              <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 13, color: c.ink }}>
                {label}
              </Text>
              <Body size={12}>{value}</Body>
              {href !== null && (
                <Text style={{ fontFamily: fonts.archivo600, fontSize: 14, color: c.zero }}>›</Text>
              )}
            </Pressable>
          ))}
        </Card>

        <Card style={{ marginTop: 22 }}>
          <View style={styles.syncHead}>
            <View style={[styles.dot, { backgroundColor: c.gold }]} />
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: c.ink }}>
              How syncing works
            </Text>
          </View>
          <Body size={12} style={{ marginTop: 8, lineHeight: 19 }}>
            Everything you log is saved on this phone first, so it never waits for
            a signal. When there is one, changes go up quietly and your partner's
            come down. Nothing is lost if you are offline for a week.
          </Body>
        </Card>

        <Pressable style={[styles.signOut, { borderColor: c.line }]}>
          <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.muted }}>Sign out</Text>
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
  syncHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 5, height: 5, borderRadius: 999 },
  signOut: {
    marginTop: 22, borderWidth: 1, borderRadius: radius.fieldLarge,
    paddingVertical: 14, alignItems: 'center',
  },
})
