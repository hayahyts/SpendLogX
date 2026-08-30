/**
 * Category picker.
 *
 * Dark, because it opens from the add sheet. Matching rows highlight the typed
 * letters in gold, and the four person-facing parents carry a PERSON tag so it
 * is obvious which ones will ask who the money was for.
 */

import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { childrenOf, topLevel, useAppState } from '@/store/store'
import { SearchMark } from '@/ui/marks'
import { Body, Chip, Micro } from '@/ui/primitives'
import { SheetTheme, useColors } from '@/ui/ThemeProvider'
import { radius } from '@/ui/theme'
import { fonts, micro } from '@/ui/type'

export default function CategoryPickerScreen() {
  return (
    <SheetTheme>
      <CategoryPicker />
    </SheetTheme>
  )
}

/** Highlights the typed letters wherever they appear. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const c = useColors()
  const q = query.trim().toLowerCase()
  if (q === '') return <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: c.ink }}>{text}</Text>

  const at = text.toLowerCase().indexOf(q)
  if (at === -1) return <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: c.ink }}>{text}</Text>

  return (
    <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: c.ink }}>
      {text.slice(0, at)}
      <Text style={{ color: c.gold }}>{text.slice(at, at + q.length)}</Text>
      {text.slice(at + q.length)}
    </Text>
  )
}

function CategoryPicker() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const state = useAppState()
  const [query, setQuery] = useState('')

  const parents = topLevel(state, 'expense')

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === '') return []
    return state.categories
      .filter((cat) => !cat.archived && cat.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [state.categories, query])

  return (
    <View style={[styles.screen, { backgroundColor: c.ground, paddingTop: insets.top + 14 }]}>
      <View style={styles.head}>
        <Text style={{ fontFamily: fonts.archivo112_800, fontSize: 22, color: c.ink }}>
          Category
        </Text>
        <Pressable onPress={() => router.back()} style={[styles.close, { backgroundColor: c.sunken }]}>
          <Text style={{ fontFamily: fonts.archivo600, fontSize: 15, color: c.muted }}>×</Text>
        </Pressable>
      </View>

      <View style={[styles.search, { backgroundColor: c.card }]}>
        <SearchMark />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search categories"
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
        {matching.length > 0 && (
          <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 2 }}>
            <Micro size={8.5} tracking={0.16}>Matches</Micro>
            {matching.map((cat) => (
              <Pressable key={cat.id} onPress={() => router.back()} style={styles.row}>
                <Highlighted text={cat.name} query={query} />
              </Pressable>
            ))}
          </View>
        )}

        <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 18 }}>
          {parents.map((parent) => {
            const kids = childrenOf(state, parent.id)
            return (
              <View key={parent.id} style={{ gap: 9 }}>
                <Pressable onPress={() => router.back()} style={styles.parentRow}>
                  <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: c.ink }}>
                    {parent.name}
                  </Text>
                  {parent.isPersonFacing && (
                    <View style={[styles.tag, { borderColor: c.gold }]}>
                      <Text style={[micro(8, 0.16), { color: c.gold }]}>person</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }} />
                  <Body size={11}>{kids.length > 0 ? `${kids.length}` : ''}</Body>
                </Pressable>
                {kids.length > 0 && (
                  <View style={styles.kids}>
                    {kids.map((kid) => (
                      <Chip key={kid.id} label={kid.name} onPress={() => router.back()} />
                    ))}
                  </View>
                )}
              </View>
            )
          })}
        </View>
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
  row: { paddingVertical: 11 },
  parentRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 4 },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  kids: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
})
