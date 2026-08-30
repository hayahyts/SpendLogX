/**
 * Account marks and initials discs.
 *
 * No images, no icon fonts — every mark is drawn from plain views, as briefed.
 * Cash is three stacked rules, MoMo three rising bars in gold, a bank a filled
 * square, Land the same square with a dashed border because it is held rather
 * than spent.
 */

import { StyleSheet, Text, View } from 'react-native'
import type { AccountKind } from '@/domain/networth'
import { useColors } from './ThemeProvider'
import { fonts } from './type'
import { marks } from './theme'

export function AccountMark({
  kind, color, scale = 1,
}: { kind: AccountKind; color?: string; scale?: number }) {
  const c = useColors()
  const ink = color ?? c.ink
  const s = (n: number) => n * scale

  if (kind === 'mobile_money') {
    return (
      <View style={[styles.row, { gap: s(marks.momo.gap), alignItems: 'flex-end' }]}>
        {marks.momo.heights.map((h) => (
          <View
            key={h}
            style={{ width: s(marks.momo.width), height: s(h), backgroundColor: c.gold }}
          />
        ))}
      </View>
    )
  }

  if (kind === 'bank') {
    return (
      <View
        style={{
          width: s(marks.bank.size), height: s(marks.bank.size),
          borderRadius: marks.bank.radius, backgroundColor: ink,
        }}
      />
    )
  }

  if (kind === 'asset' || kind === 'liability') {
    return (
      <View
        style={{
          width: s(marks.land.size), height: s(marks.land.size),
          borderRadius: marks.land.radius,
          borderWidth: marks.land.borderWidth, borderStyle: 'dashed',
          borderColor: c.muted,
        }}
      />
    )
  }

  // Cash
  return (
    <View style={{ gap: s(marks.cash.gap) }}>
      {marks.cash.widths.map((w, i) => (
        <View
          key={i}
          style={{ width: s(w), height: s(marks.cash.height), backgroundColor: ink }}
        />
      ))}
    </View>
  )
}

/**
 * Initials, never a photo.
 *
 * People get two letters — "DE" reads as Dedei at a glance in a list of
 * sixteen. Household members get one, because there are only two of them and a
 * single letter is quieter beside a greeting.
 */
export function initialsOf(name: string, letters: 1 | 2 = 2): string {
  const cleaned = name.replace(/\(.*?\)/g, '').trim()
  const words = cleaned.split(/[\s-]+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (letters === 1) return (words[0] ?? '?').slice(0, 1).toUpperCase()
  if (words.length === 1) return (words[0] ?? '').slice(0, 2).toUpperCase()
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase()
}

export function InitialsDisc({
  name, size = 34, active = false, letters = 2, style,
}: {
  name: string
  size?: number
  /** Ink disc with gold initials when something happened this period. */
  active?: boolean
  letters?: 1 | 2
  style?: object
}) {
  const c = useColors()
  return (
    <View
      style={[
        {
          width: size, height: size, borderRadius: 999,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: active ? c.ink : c.sunken,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.archivo700,
          fontSize: Math.max(8, Math.round(size * (letters === 1 ? 0.4 : 0.32))),
          letterSpacing: 0.02 * size,
          color: active ? c.gold : c.muted,
        }}
      >
        {initialsOf(name, letters)}
      </Text>
    </View>
  )
}

/** The search glyph: an 11px circle outline, per the asset list. */
export function SearchMark({ color }: { color?: string }) {
  const c = useColors()
  return (
    <View
      style={{
        width: 11, height: 11, borderRadius: 999,
        borderWidth: 1.5, borderColor: color ?? c.muted,
      }}
    />
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
})
