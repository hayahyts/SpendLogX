/**
 * The keypad. Never the system keyboard — this screen is judged on speed, and a
 * system keyboard costs a frame of animation and a row of autocomplete.
 *
 * Grid is `1fr 1fr 1fr 92px` × four 60px rows; Save spans the fourth column for
 * all four rows, which is what makes it reachable without looking.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useColors } from './ThemeProvider'
import { hit, motion, radius } from './theme'
import { cedi, fonts } from './type'

/** Four rows of three, laid out as rows rather than a wrapping grid: a
 *  percentage width plus a gap overflows and silently drops to two columns. */
const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
] as const

export type Key = (typeof ROWS)[number][number]

export function Keypad({
  onKey, onSave, canSave,
}: { onKey: (k: Key) => void; onSave: () => void; canSave: boolean }) {
  const c = useColors()

  return (
    <View style={styles.wrap}>
      <View style={styles.keys}>
        {ROWS.map((row, i) => (
          <View key={i} style={styles.keyRow}>
            {row.map((k) => (
              <Pressable
                key={k}
                onPress={() => onKey(k)}
                accessibilityLabel={k === '⌫' ? 'Delete' : k}
                style={({ pressed }) => [
                  styles.key,
                  { backgroundColor: pressed ? c.sunken : c.card },
                ]}
              >
                <Text
                  style={{ fontFamily: fonts.archivo700, fontSize: 24, color: c.ink }}
                  allowFontScaling={false}
                >
                  {k}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      <Pressable
        onPress={onSave}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityLabel="Save"
        style={({ pressed }) => [
          styles.save,
          {
            backgroundColor: canSave ? c.gold : c.sunken,
            opacity: pressed && canSave ? 0.85 : 1,
          },
        ]}
      >
        <Text style={[cedi(27), { color: canSave ? c.goldInk : '#5A6560' }]}>₵</Text>
        <Text
          style={{
            fontFamily: fonts.archivo700, fontSize: 12, letterSpacing: 0.06 * 12,
            color: canSave ? c.goldInk : '#5A6560', marginTop: 4,
          }}
        >
          SAVE
        </Text>
      </Pressable>
    </View>
  )
}

const GAP = 7

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: GAP, paddingHorizontal: 14, paddingBottom: 14 },
  keys: { flex: 1, gap: GAP },
  keyRow: { flexDirection: 'row', gap: GAP },
  key: {
    flex: 1,
    height: hit.key,
    borderRadius: radius.key,
    alignItems: 'center',
    justifyContent: 'center',
  },
  save: {
    width: hit.saveWidth,
    height: hit.key * 4 + GAP * 3,
    borderRadius: radius.save,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
