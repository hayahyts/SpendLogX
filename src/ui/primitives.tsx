/**
 * The shared furniture: labels, cards, chips, rows, bars, segmented controls.
 * Every value here comes from the handoff's token tables.
 */

import type { ReactNode } from 'react'
import {
  Pressable, StyleSheet, Text, View,
  type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native'
import { useColors } from './ThemeProvider'
import { GUTTER, hit, radius } from './theme'
import { fonts, micro as microStyle, type } from './type'

export function Micro({
  children, size = 9, color, tracking, style,
}: {
  children: ReactNode; size?: number; color?: string
  tracking?: number; style?: StyleProp<TextStyle>
}) {
  const c = useColors()
  return (
    <Text style={[microStyle(size, tracking), { color: color ?? c.muted }, style]}>
      {children}
    </Text>
  )
}

export function ScreenTitle({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useColors()
  return <Text style={[type.screenTitle, { color: c.ink }, style]}>{children}</Text>
}

export function SectionHead({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useColors()
  return <Text style={[type.sectionHead, { color: c.ink }, style]}>{children}</Text>
}

export function Body({
  children, color, size = 12, style,
}: { children: ReactNode; color?: string; size?: number; style?: StyleProp<TextStyle> }) {
  const c = useColors()
  return (
    <Text
      style={[
        { fontFamily: fonts.body, fontSize: size, lineHeight: size * 1.6, color: color ?? c.muted },
        style,
      ]}
    >
      {children}
    </Text>
  )
}

export function Meta({ children, color, style }: { children: ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  const c = useColors()
  return (
    <Text numberOfLines={1} style={[type.metadata, { color: color ?? c.muted }, style]}>
      {children}
    </Text>
  )
}

/** A gold text link, used for "All 40", "FILTER", "UNDO". */
export function GoldLink({
  children, onPress, size = 11, isMicro = false,
}: { children: ReactNode; onPress?: () => void; size?: number; isMicro?: boolean }) {
  const c = useColors()
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      <Text
        style={
          isMicro
            ? [microStyle(size, 0.14), { color: c.gold }]
            : { fontFamily: fonts.body, fontSize: size, color: c.goldInk }
        }
      >
        {children}
      </Text>
    </Pressable>
  )
}

export function Card({
  children, style, padded = true, dashed = false,
}: {
  children: ReactNode; style?: StyleProp<ViewStyle>
  padded?: boolean; dashed?: boolean
}) {
  const c = useColors()
  return (
    <View
      style={[
        {
          backgroundColor: dashed ? 'transparent' : c.card,
          borderRadius: radius.balanceCard,
          ...(padded ? { padding: 16 } : null),
          ...(dashed
            ? { borderWidth: 1.5, borderStyle: 'dashed' as const, borderColor: c.line }
            : null),
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}

/** The white group that transaction rows sit in. */
export function RowGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors()
  return (
    <View
      style={[
        { backgroundColor: c.card, borderRadius: radius.rowGroup, overflow: 'hidden' },
        style,
      ]}
    >
      {children}
    </View>
  )
}

/** Separators are inset 16px from the left, so they start under the text. */
export function RowSeparator() {
  const c = useColors()
  return <View style={{ height: 1, backgroundColor: c.rowLine, marginLeft: 16 }} />
}

export function Chip({
  label, selected = false, outlined = false, dashed = false,
  onPress, leading, size = 12,
}: {
  label: string
  selected?: boolean
  /** Transparent with a line border — the "All ›" affordance. */
  outlined?: boolean
  dashed?: boolean
  onPress?: () => void
  leading?: ReactNode
  size?: number
}) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          minHeight: hit.chip,
          backgroundColor: selected ? c.gold : outlined || dashed ? 'transparent' : c.card,
          borderColor: selected ? c.gold : dashed ? c.line : outlined ? c.line : c.sunken,
          borderStyle: dashed ? 'dashed' : 'solid',
          opacity: pressed ? 0.85 : 1,
          paddingLeft: leading ? 6 : 13,
        },
      ]}
    >
      {leading}
      <Text
        style={{
          fontFamily: fonts.body,
          fontSize: size,
          color: selected ? c.goldInk : outlined || dashed ? c.muted : c.secondary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export function Segmented<T extends string>({
  options, value, onChange, dark = false,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  /** The add sheet's variant: gold selection on a card-coloured track. */
  dark?: boolean
}) {
  const c = useColors()
  return (
    <View style={[styles.segmented, { backgroundColor: dark ? c.card : c.sunken }]}>
      {options.map((opt) => {
        const on = opt === value
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[
              styles.segment,
              {
                backgroundColor: on ? (dark ? c.gold : c.ink) : 'transparent',
                paddingHorizontal: dark ? 13 : 16,
              },
            ]}
          >
            <Text
              style={{
                fontFamily: fonts.archivo600,
                fontSize: dark ? 11 : 12,
                color: on ? (dark ? c.goldInk : c.card) : c.muted,
              }}
            >
              {opt}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** A proportional track with a gold fill — the dashboard's category bars. */
export function Bar({
  fraction, height = 6, color, track, style,
}: {
  fraction: number; height?: number; color?: string
  track?: string; style?: StyleProp<ViewStyle>
}) {
  const c = useColors()
  const pct = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0))
  return (
    <View
      style={[
        { height, borderRadius: 999, backgroundColor: track ?? c.sunken, overflow: 'hidden' },
        style,
      ]}
    >
      <View
        style={{
          width: `${pct * 100}%`, height: '100%',
          borderRadius: 999, backgroundColor: color ?? c.gold,
        }}
      />
    </View>
  )
}

export function Screen({
  children, style, scroll = false,
}: { children: ReactNode; style?: StyleProp<ViewStyle>; scroll?: boolean }) {
  const c = useColors()
  return <View style={[{ flex: 1, backgroundColor: c.ground }, style]}>{children}</View>
}

export const gutter: ViewStyle = { paddingHorizontal: GUTTER }

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 13, paddingVertical: 9,
    borderRadius: radius.pill, borderWidth: 1,
  },
  segmented: {
    flexDirection: 'row', borderRadius: radius.pill, padding: 3, gap: 3,
    alignSelf: 'flex-start',
  },
  segment: {
    paddingVertical: 7, borderRadius: radius.pill, alignItems: 'center',
  },
})
