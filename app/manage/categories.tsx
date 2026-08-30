/**
 * Manage categories.
 *
 * Archive, never delete — history depends on the names. An archived child shows
 * struck through rather than vanishing, so it is obvious what happened to it.
 */

import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { childrenOf, topLevel, useStore } from '@/store/store'
import { Body, Card, Micro, ScreenTitle, gutter } from '@/ui/primitives'
import { BackLink } from '../txn/[id]'
import { useColors } from '@/ui/ThemeProvider'
import { radius } from '@/ui/theme'
import { fonts } from '@/ui/type'

/** Three rules, gold on the row being dragged. */
function DragHandle({ active = false }: { active?: boolean }) {
  const c = useColors()
  return (
    <View style={{ gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{ width: 12, height: 1.5, backgroundColor: active ? c.gold : c.zero }}
        />
      ))}
    </View>
  )
}

export default function ManageCategories() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { state, archiveCategory } = useStore()

  const parents = topLevel(state, 'expense')

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.ground }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 44 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={gutter}>
        <BackLink label="Settings" />
        <ScreenTitle style={{ marginTop: 20 }}>Categories</ScreenTitle>
        <Body size={12.5} style={{ marginTop: 8, lineHeight: 19 }}>
          Archive rather than delete — past transactions keep their names.
        </Body>

        <View style={{ marginTop: 22, gap: 12 }}>
          {parents.map((parent) => {
            const kids = childrenOf(state, parent.id)
            const archivedKids = state.categories.filter(
              (x) => x.parentId === parent.id && x.archived,
            )
            return (
              <Card key={parent.id} padded={false} style={{ borderRadius: radius.rowGroupLarge }}>
                <View style={styles.row}>
                  <DragHandle />
                  <Text style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 13.5, color: c.ink }}>
                    {parent.name}
                  </Text>
                  {parent.isPersonFacing && (
                    <View style={[styles.tag, { borderColor: c.goldInk }]}>
                      <Micro size={8} color={c.goldInk} tracking={0.16}>person</Micro>
                    </View>
                  )}
                  <Pressable onPress={() => archiveCategory(parent.id, true)} hitSlop={8}>
                    <Body size={11}>Archive</Body>
                  </Pressable>
                </View>

                {[...kids, ...archivedKids].map((kid) => (
                  <View
                    key={kid.id}
                    style={[styles.row, styles.childRow, { borderTopColor: c.rowLine }]}
                  >
                    <DragHandle />
                    <Text
                      style={{
                        flex: 1, fontFamily: fonts.body, fontSize: 12.5,
                        color: kid.archived ? c.zero : c.muted,
                        textDecorationLine: kid.archived ? 'line-through' : 'none',
                      }}
                    >
                      {kid.name}
                    </Text>
                    <Pressable onPress={() => archiveCategory(kid.id, !kid.archived)} hitSlop={8}>
                      <Body size={11}>{kid.archived ? 'Restore' : 'Archive'}</Body>
                    </Pressable>
                  </View>
                ))}
              </Card>
            )
          })}

          <Pressable style={[styles.add, { borderColor: c.line }]}>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.muted }}>
              + New top-level category
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 16,
  },
  childRow: { borderTopWidth: 1, paddingLeft: 28 },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  add: {
    borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.fieldLarge,
    paddingVertical: 15, alignItems: 'center',
  },
})
