/**
 * Typography, transcribed from the handoff.
 *
 * Archivo is a variable font with a width axis, and React Native cannot vary a
 * font axis at runtime. So the widths the design calls for — 105%, 112%, 125% —
 * are shipped as static instances cut from the variable original
 * (`scripts/build-fonts.ts`). `Archivo112_800` really is Archivo at wdth=112,
 * not a scaled approximation.
 */

import type { TextStyle } from 'react-native'

/** Registered in `useAppFonts`; the keys are the family names RN resolves. */
export const fonts = {
  archivo600: 'Archivo_600',
  archivo700: 'Archivo_700',
  archivo800: 'Archivo_800',
  archivo900: 'Archivo_900',
  /** Section heads. */
  archivo105_600: 'Archivo105_600',
  /** Display: hero amounts, screen titles, greeting. */
  archivo112_800: 'Archivo112_800',
  /** The sign-in mark, and nothing else. */
  archivo125_900: 'Archivo125_900',
  body: 'PublicSans_400Regular',
  bodySemi: 'PublicSans_600SemiBold',
} as const

/** Amounts that stack must line up. */
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] }

type Role =
  | 'heroAmount' | 'balanceAmount' | 'screenTitle' | 'sectionHead'
  | 'rowAmount' | 'rowTitle' | 'metadata' | 'micro' | 'body' | 'keyGlyph'

export const type: Record<Role, TextStyle> = {
  heroAmount: {
    fontFamily: fonts.archivo112_800, fontSize: 56, lineHeight: 50,
    letterSpacing: -0.055 * 56, ...tabular,
  },
  balanceAmount: {
    fontFamily: fonts.archivo112_800, fontSize: 50, lineHeight: 50,
    letterSpacing: -0.052 * 50, ...tabular,
  },
  screenTitle: {
    fontFamily: fonts.archivo112_800, fontSize: 25, lineHeight: 30,
    letterSpacing: -0.03 * 25,
  },
  sectionHead: {
    fontFamily: fonts.archivo105_600, fontSize: 15, lineHeight: 20,
  },
  rowAmount: {
    fontFamily: fonts.archivo700, fontSize: 16, lineHeight: 20,
    letterSpacing: -0.02 * 16, ...tabular,
  },
  rowTitle: {
    fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 17,
  },
  metadata: {
    fontFamily: fonts.body, fontSize: 10.5, lineHeight: 14,
  },
  micro: {
    fontFamily: fonts.archivo600, fontSize: 9, lineHeight: 11,
    letterSpacing: 0.18 * 9, textTransform: 'uppercase',
  },
  body: {
    fontFamily: fonts.body, fontSize: 12, lineHeight: 12 * 1.6,
  },
  keyGlyph: {
    fontFamily: fonts.archivo700, fontSize: 24, lineHeight: 28,
  },
}

/** A micro label at an arbitrary size, keeping the tracking proportional. */
export function micro(size: number, tracking = 0.18): TextStyle {
  return {
    fontFamily: fonts.archivo600,
    fontSize: size,
    lineHeight: size * 1.2,
    letterSpacing: tracking * size,
    textTransform: 'uppercase',
  }
}

/**
 * The ₵ mark.
 *
 * Neither Archivo nor Public Sans carries U+20B5, so the glyph comes from the
 * platform font. It keeps its size and its gold, which is all the design asks
 * of it — the handoff anticipated exactly this.
 */
export function cedi(size: number): TextStyle {
  return {
    fontSize: size,
    lineHeight: size,
    fontWeight: '900',
    includeFontPadding: false,
  }
}
