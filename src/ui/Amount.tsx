/**
 * How a figure is set.
 *
 * The rule from the handoff: ₵ is always gold, never grey. Pesewas sit at ~55%
 * of the cedi size in muted, so ₵53.00 and ₵23,000.00 read at the same weight.
 * A sign glyph precedes the figure in the semantic colour at ~80% of its size.
 */

import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import { type Money, format } from '@/domain/money'
import { useColors } from './ThemeProvider'
import { cedi, fonts, tabular } from './type'

/** Splits "₵ 7,000.47" into its parts so each can be set differently. */
function parts(value: Money): { sign: string; whole: string; pesewas: string } {
  const text = format(value, { symbol: false, negative: 'minus' })
  const negative = text.startsWith('-')
  const bare = negative ? text.slice(1) : text
  const dot = bare.lastIndexOf('.')
  return {
    sign: negative ? '−' : '',
    whole: dot === -1 ? bare : bare.slice(0, dot),
    pesewas: dot === -1 ? '' : bare.slice(dot),
  }
}

export type Tone = 'ink' | 'spent' | 'earned' | 'moved' | 'gold' | 'muted' | 'zero'

export interface AmountProps {
  value: Money
  /** Cedi figure size. Pesewas and the ₵ mark are derived from it. */
  size: number
  tone?: Tone
  /**
   * The sign glyph to show.
   *
   * Deliberately explicit rather than read off the value: amounts are always
   * positive and direction comes from the transaction type, so a row decides
   * its own sign. 'auto' shows − only for a genuinely negative figure, which is
   * what a balance wants.
   */
  sign?: 'auto' | 'minus' | 'plus' | 'none'
  /** Show the ₵ mark. */
  symbol?: boolean
  /** Archivo weight for the figure. */
  weight?: 700 | 800
  /** Width instance for the figure. Display sizes use 112. */
  width?: 100 | 112
  letterSpacing?: number
  style?: ViewStyle
  /** Renders the figure in the empty colour, for an untouched amount field. */
  empty?: boolean
}

export function Amount({
  value, size, tone = 'ink', sign: signMode = 'auto', symbol = true,
  weight = 800, width = 112, letterSpacing, style, empty = false,
}: AmountProps) {
  const c = useColors()
  const p = parts(value)

  const toneColor: Record<Tone, string> = {
    ink: c.ink, spent: c.spent, earned: c.earned, moved: c.moved,
    gold: c.gold, muted: c.muted, zero: c.zero,
  }
  const figureColor = empty ? c.emptyFigure : toneColor[tone]
  const pesewasColor = empty ? c.emptyPesewas : c.muted

  const family =
    width === 112
      ? fonts.archivo112_800
      : weight === 700
        ? fonts.archivo700
        : fonts.archivo800

  const figure: TextStyle = {
    fontFamily: family,
    fontSize: size,
    lineHeight: size * 0.9 < size ? size : size,
    letterSpacing: letterSpacing ?? -0.052 * size,
    color: figureColor,
    ...tabular,
  }

  const sign =
    signMode === 'none' ? ''
    : signMode === 'plus' ? '+'
    : signMode === 'minus' ? '−'
    : p.sign
  const symbolSize = Math.round(size * 0.54)
  const pesewasSize = Math.round(size * 0.55)

  return (
    <View style={[styles.row, style]}>
      {sign !== '' && (
        <Text
          style={{
            fontFamily: fonts.archivo700,
            fontSize: Math.round(size * 0.8),
            lineHeight: size,
            color: figureColor,
            marginRight: size * 0.06,
          }}
        >
          {sign}
        </Text>
      )}
      {symbol && (
        <Text
          style={[
            cedi(symbolSize),
            { color: c.gold, marginRight: size * 0.12 },
          ]}
        >
          ₵
        </Text>
      )}
      <Text style={figure} allowFontScaling={false}>
        {p.whole}
        <Text
          style={{
            fontFamily: family,
            fontSize: pesewasSize,
            letterSpacing: 0,
            color: pesewasColor,
            ...tabular,
          }}
        >
          {p.pesewas}
        </Text>
      </Text>
    </View>
  )
}

/** The ₵ mark on its own, in gold, from the platform font. */
export function Cedi({ size, color }: { size: number; color?: string }) {
  const c = useColors()
  return <Text style={[cedi(size), { color: color ?? c.gold }]}>₵</Text>
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline' },
})
