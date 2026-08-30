/**
 * Household.
 *
 * Members, and the invite code. The note about members being excluded from
 * "people you support" is here because that is the rule most likely to surprise
 * someone reading a People total.
 */

import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAppState } from '@/store/store'
import { InitialsDisc } from '@/ui/marks'
import { Body, Card, Micro, ScreenTitle, gutter } from '@/ui/primitives'
import { BackLink } from '../txn/[id]'
import { useColors } from '@/ui/ThemeProvider'
import { radius } from '@/ui/theme'
import { fonts } from '@/ui/type'

const CODE = 'K4M2PD'

export default function Household() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const state = useAppState()

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.ground }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 44 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={gutter}>
        <BackLink label="Settings" />
        <ScreenTitle style={{ marginTop: 20 }}>Household</ScreenTitle>

        <View style={{ marginTop: 22, gap: 10 }}>
          {state.members.map((m) => {
            const entries = state.txns.length
            return (
              <Card key={m.id} style={styles.member}>
                <InitialsDisc name={m.name} size={38} letters={1} active={m.isCurrentUser} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13.5, color: c.ink }}>
                    {m.name}{m.isCurrentUser ? ' · you' : ''}
                  </Text>
                  <Body size={10.5}>{`${m.email} · ${m.role}`}</Body>
                </View>
              </Card>
            )
          })}
        </View>

        <Card style={{ marginTop: 18 }}>
          <Micro size={8.5} tracking={0.16}>Invite the other half</Micro>
          <View style={styles.code}>
            {[...CODE].map((ch, i) => (
              <View key={i} style={[styles.tile, { backgroundColor: c.ground }]}>
                <Text style={{ fontFamily: fonts.archivo800, fontSize: 18, color: c.goldInk }}>
                  {ch}
                </Text>
              </View>
            ))}
          </View>
          <Pressable style={[styles.share, { backgroundColor: c.gold }]}>
            <Text style={{ fontFamily: fonts.archivo700, fontSize: 12.5, color: c.goldInk }}>
              Share the code
            </Text>
          </Pressable>
        </Card>

        <Body size={11.5} style={{ marginTop: 16, lineHeight: 19 }}>
          Household members are excluded from “people you support” totals. What
          you spend on each other is household spending, not support.
        </Body>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  member: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  code: { flexDirection: 'row', gap: 6, marginTop: 12 },
  tile: {
    flex: 1, aspectRatio: 1, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  share: {
    marginTop: 14, borderRadius: radius.fieldLarge,
    paddingVertical: 13, alignItems: 'center',
  },
})
