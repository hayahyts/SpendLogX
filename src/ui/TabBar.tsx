/**
 * Four tabs and the gold action button, present on every tab.
 *
 * The bar is 92px tall with a gradient fade from the ground colour, so content
 * scrolls under it rather than stopping at a hard edge. The action button sits
 * 6px proud of the bar — it belongs to the app, not to the bar.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from './ThemeProvider'
import { fonts } from './type'
import { cedi } from './type'

export const TAB_HEIGHT = 92

export type TabKey = 'home' | 'log' | 'report' | 'people'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'log', label: 'Log' },
  { key: 'report', label: 'Report' },
  { key: 'people', label: 'People' },
]

export function TabBar({
  active, onSelect, onAdd,
}: { active: TabKey; onSelect: (k: TabKey) => void; onAdd: () => void }) {
  const c = useColors()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.wrap, { height: TAB_HEIGHT + insets.bottom }]} pointerEvents="box-none">
      <LinearGradient
        colors={['transparent', c.ground, c.ground]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={[styles.row, { paddingBottom: insets.bottom }]}>
        <View style={styles.tabs}>
          {TABS.map((t) => {
            const on = t.key === active
            return (
              <Pressable
                key={t.key}
                onPress={() => onSelect(t.key)}
                style={styles.tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: on ? c.gold : 'transparent' },
                  ]}
                />
                <Text
                  style={{
                    fontFamily: on ? fonts.bodySemi : fonts.body,
                    fontSize: 12.5,
                    color: on ? c.ink : c.muted,
                  }}
                >
                  {t.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="Add a transaction"
          style={({ pressed }) => [
            styles.action,
            {
              backgroundColor: c.gold,
              transform: [{ scale: pressed ? 0.94 : 1 }],
              shadowColor: c.gold,
            },
          ]}
        >
          <Text style={[cedi(26), { color: c.goldInk, fontFamily: undefined }]}>₵</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  row: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, gap: 12,
  },
  tabs: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 22 },
  tab: { alignItems: 'center', gap: 5, paddingVertical: 8 },
  dot: { width: 5, height: 5, borderRadius: 999 },
  action: {
    width: 58, height: 58, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 8,
  },
})
