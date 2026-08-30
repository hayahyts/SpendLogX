/**
 * Design tokens, transcribed from the handoff.
 *
 * Rules the palette holds to, and the reasons they are rules:
 *   - One gold per theme. It is the accent and nothing else uses it.
 *   - One destructive red, on delete only.
 *   - Semantic colours (spent / earned / moved) never double as the accent.
 *   - Neutrals carry a green hue bias (~155°) so grey never reads blue
 *     beside gold.
 *   - Dark is a second composition, not an inversion: cards lift in lightness
 *     instead of casting shadows.
 */

export interface Palette {
  ground: string
  card: string
  /** Sunken in light, raised in dark — the same role, opposite direction. */
  sunken: string
  line: string
  rowLine: string
  ink: string
  muted: string
  /** Disabled, and any zero figure. */
  zero: string
  gold: string
  goldInk: string
  goldTint: string
  spent: string
  earned: string
  moved: string
  deleteBorder: string
  errorSurface: string
  errorBorder: string
  /** The amount figure before anything is typed. */
  emptyFigure: string
  emptyPesewas: string
  /** Secondary body text. Dark only; falls back to muted in light. */
  secondary: string
}

export const light: Palette = {
  ground: '#F1F3F1',
  card: '#FFFFFF',
  sunken: '#E3E7E4',
  line: '#D2D8D4',
  rowLine: '#EDF0EE',
  ink: '#0B120F',
  muted: '#5A6560',
  zero: '#C3CAC6',
  gold: '#E8A317',
  goldInk: '#8A5B00',
  goldTint: '#F6E4BC',
  spent: '#B03A22',
  earned: '#0A6E52',
  moved: '#3A4B87',
  deleteBorder: '#E0C4BC',
  errorSurface: '#F6E4BC',
  errorBorder: '#E0C4BC',
  emptyFigure: '#C3CAC6',
  emptyPesewas: '#D2D8D4',
  secondary: '#5A6560',
}

export const dark: Palette = {
  ground: '#0B120F',
  card: '#141D19',
  sunken: '#1D2A25',
  line: '#2A3833',
  rowLine: '#1D2A25',
  ink: '#F2F3F1',
  muted: '#8B9792',
  zero: '#3A4741',
  gold: '#F2B23C',
  goldInk: '#0B120F',
  goldTint: '#5A4413',
  spent: '#EF7A5F',
  earned: '#3FC49A',
  moved: '#8FA0E4',
  deleteBorder: '#4A2018',
  errorSurface: '#2A1714',
  errorBorder: '#4A2018',
  emptyFigure: '#3A4741',
  emptyPesewas: '#2A3833',
  secondary: '#C6CFCB',
}

/**
 * The add sheet is always dark, in both themes. Speed matters more than mode on
 * the one screen the product is judged on.
 */
export const sheet = dark

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 32 } as const

/** Screen gutter. Every screen edge sits here. */
export const GUTTER = 20

/** Radius by role — deliberately not one value everywhere. */
export const radius = {
  balanceCard: 20,
  sheet: 18,
  sheetLarge: 20,
  rowGroup: 12,
  rowGroupLarge: 14,
  field: 8,
  fieldLarge: 10,
  key: 12,
  save: 14,
  pill: 999,
} as const

/** Minimum hit targets, from the handoff. */
export const hit = { key: 60, saveWidth: 92, chip: 34, row: 44 } as const

export const motion = {
  sheetIn: 220,
  personStrip: 240,
  toast: 240,
  keyPress: 90,
  periodChange: 160,
  detailPush: 200,
  caretBlink: 1100,
  toastDwell: 4200,
  /** cubic-bezier(.2,.8,.2,1) */
  easing: [0.2, 0.8, 0.2, 1] as const,
}

export const marks = {
  cash: { widths: [16, 16, 10], height: 3, gap: 2 },
  momo: { heights: [7, 11, 15], width: 4, gap: 2 },
  bank: { size: 15, radius: 2 },
  land: { size: 15, radius: 2, borderWidth: 2 },
} as const
