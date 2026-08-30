/**
 * Person picker.
 *
 * Recency rows carry context — what was sent this month, and how many of the
 * last fourteen months had something — because "which Auntie" is answered
 * faster by a number than by a surname. Adding a new person asks for a name and
 * nothing else.
 */

import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ZERO, type Money } from '@/domain/money'
import { periodContaining, shiftPeriod } from '@/domain/period'
import { spendByPerson } from '@/domain/ledger'
import { useStore } from '@/store/store'
import { resolvePerson } from '@/ui/pickerBridge'
import { InitialsDisc, SearchMark } from '@/ui/marks'
import { Body, Chip, Micro } from '@/ui/primitives'
import { SheetTheme, useColors } from '@/ui/ThemeProvider'
import { radius } from '@/ui/theme'
import { fonts } from '@/ui/type'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const RHYTHM = 14

export default function PersonPickerScreen() {
  return (
    <SheetTheme>
      <PersonPicker />
    </SheetTheme>
  )
}

function PersonPicker() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { state, addPerson } = useStore()
  const [query, setQuery] = useState('')

  const month = periodContaining('month', state.today)
  const monthName = MONTHS[new Date(`${month.start}T12:00:00Z`).getUTCMonth()]

  const context = useMemo(() => {
    const sent = spendByPerson(state.txns, month)
    const active = new Map<string, number>()
    for (let back = 0; back < RHYTHM; back++) {
      const m = shiftPeriod(month, -back)
      for (const [pid, amount] of spendByPerson(state.txns, m)) {
        if (amount > 0) active.set(pid, (active.get(pid) ?? 0) + 1)
      }
    }
    return { sent, active }
  }, [state.txns, month])

  const q = query.trim().toLowerCase()
  const matching = state.people.filter(
    (p) => !p.archived && (q === '' || p.name.toLowerCase().includes(q)),
  )
  const recent = matching
    .filter((p) => (context.sent.get(p.id) ?? 0) > 0)
    .sort((a, b) => (context.sent.get(b.id) ?? 0) - (context.sent.get(a.id) ?? 0))
  const tail = matching.filter((p) => (context.sent.get(p.id) ?? 0) === 0)

  const exact = matching.some((p) => p.name.toLowerCase() === q)

  return (
    <View style={[styles.screen, { backgroundColor: c.ground, paddingTop: insets.top + 14 }]}>
      <View style={styles.head}>
        <Text style={{ fontFamily: fonts.archivo112_800, fontSize: 22, color: c.ink }}>
          Who is it for
        </Text>
        <Pressable
          onPress={() => { resolvePerson(null); router.back() }}
          style={[styles.close, { backgroundColor: c.sunken }]}
        >
          <Text style={{ fontFamily: fonts.archivo600, fontSize: 15, color: c.muted }}>×</Text>
        </Pressable>
      </View>

      <View style={[styles.search, { backgroundColor: c.card }]}>
        <SearchMark />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search or add a name"
          placeholderTextColor={c.muted}
          autoFocus
          style={{ flex: 1, fontFamily: fonts.body, fontSize: 13, color: c.ink, padding: 0 }}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {recent.length > 0 && (
          <View style={{ paddingHorizontal: 20, paddingTop: 18, gap: 4 }}>
            <Micro size={8.5} tracking={0.16}>Recent</Micro>
            {recent.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => { resolvePerson(p.id); router.back() }}
                style={styles.row}
              >
                <InitialsDisc name={p.name} size={30} active />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13.5, color: c.ink }}>
                    {p.name}
                  </Text>
                  <Body size={10.5}>
                    {`₵${((context.sent.get(p.id) ?? ZERO) / 100).toLocaleString('en-GH')} in ${monthName} · ${context.active.get(p.id) ?? 0} of ${RHYTHM} months`}
                  </Body>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {tail.length > 0 && (
          <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 10 }}>
            <Micro size={8.5} tracking={0.16}>Everyone else</Micro>
            <View style={styles.chips}>
              {tail.map((p) => (
                <Chip
                  key={p.id}
                  label={p.name}
                  onPress={() => { resolvePerson(p.id); router.back() }}
                />
              ))}
            </View>
          </View>
        )}

        {q !== '' && !exact && (
          <Pressable
            onPress={() => {
              const added = addPerson(query.trim())
              resolvePerson(added.id)
              router.back()
            }}
            style={[styles.addRow, { borderColor: c.line }]}
          >
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: c.gold }}>
              {`+ Add “${query.trim()}”`}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14,
  },
  close: { width: 30, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, borderRadius: radius.field,
    paddingVertical: 11, paddingHorizontal: 13,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  addRow: {
    marginHorizontal: 20, marginTop: 20,
    borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.fieldLarge,
    paddingVertical: 14, alignItems: 'center',
  },
})
