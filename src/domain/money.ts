/**
 * Money is an integer count of pesewas. GHS 7,000.47 is 700047.
 *
 * The spreadsheet this app replaces stored money as floating point, which is
 * survivable in a spreadsheet and not survivable in a ledger. Every amount in
 * this codebase passes through this module; nothing else is allowed to do
 * arithmetic on money.
 */

declare const MoneyBrand: unique symbol

/** An integer number of pesewas. May be negative (balances), never fractional. */
export type Money = number & { readonly [MoneyBrand]: 'Money' }

export const ZERO = 0 as Money

export class MoneyError extends Error {}

/** Wrap an integer count of pesewas. */
export function pesewas(n: number): Money {
  if (!Number.isInteger(n)) {
    throw new MoneyError(`Money must be a whole number of pesewas, got ${n}`)
  }
  if (!Number.isSafeInteger(n)) {
    throw new MoneyError(`Money out of safe integer range: ${n}`)
  }
  return n as Money
}

/**
 * Parse a cedi amount written as text: "7000.47", "1,042", "20", ".5", "-3.20".
 *
 * Parsed as a string rather than via `Number(x) * 100`, because 7000.47 * 100
 * is 700046.99999999994 in IEEE-754 and would silently lose a pesewa.
 */
export function parseCedis(input: string | number): Money {
  const raw = String(input).trim().replace(/[,\s₵]/g, '').replace(/^GHS/i, '')
  if (raw === '') throw new MoneyError('Empty amount')

  const m = /^(-)?(\d*)(?:\.(\d*))?$/.exec(raw)
  if (!m) throw new MoneyError(`Not a valid amount: "${input}"`)

  const [, sign, whole = '', frac = ''] = m
  if (whole === '' && frac === '') throw new MoneyError(`Not a valid amount: "${input}"`)
  if (frac.length > 2) {
    throw new MoneyError(`Amounts carry at most 2 decimal places, got "${input}"`)
  }

  const cedis = whole === '' ? 0 : Number(whole)
  const pes = frac === '' ? 0 : Number(frac.padEnd(2, '0'))
  const total = cedis * 100 + pes
  return pesewas(sign === '-' ? -total : total)
}

/**
 * Convert a spreadsheet cell's numeric value to Money.
 *
 * Excel hands us floats, so 7000.47 arrives as 7000.4699999999998. Rounding at
 * the pesewa is correct here: the source only ever held 2 decimal places.
 */
export function fromSheetNumber(n: number): Money {
  if (!Number.isFinite(n)) throw new MoneyError(`Not a finite number: ${n}`)
  return pesewas(Math.round(n * 100))
}

export function add(a: Money, b: Money): Money {
  return pesewas(a + b)
}

export function subtract(a: Money, b: Money): Money {
  return pesewas(a - b)
}

export function sum(values: readonly Money[]): Money {
  return values.reduce<Money>((acc, v) => add(acc, v), ZERO)
}

export function isPositive(m: Money): boolean {
  return m > 0
}

export function isNegative(m: Money): boolean {
  return m < 0
}

/** Decimal string without a currency mark or grouping: 700047 -> "7000.47". */
export function toDecimalString(m: Money): string {
  const neg = m < 0
  const abs = Math.abs(m)
  const whole = Math.floor(abs / 100)
  const frac = abs % 100
  return `${neg ? '-' : ''}${whole}.${String(frac).padStart(2, '0')}`
}

export interface FormatOptions {
  /** Include the ₵ mark. Default true. */
  symbol?: boolean
  /** Show ".00" on whole amounts. Default true. */
  cents?: boolean
  /** Render negatives as "-₵ 5.00" rather than "(₵ 5.00)". Default 'minus'. */
  negative?: 'minus' | 'parens'
}

/** 700047 -> "₵ 7,000.47" */
export function format(m: Money, options: FormatOptions = {}): string {
  const { symbol = true, cents = true, negative = 'minus' } = options
  const abs = Math.abs(m)
  const whole = Math.floor(abs / 100)
  const frac = abs % 100

  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const body = cents || frac !== 0 ? `${grouped}.${String(frac).padStart(2, '0')}` : grouped
  const withSymbol = symbol ? `₵ ${body}` : body

  if (m >= 0) return withSymbol
  return negative === 'parens' ? `(${withSymbol})` : `-${withSymbol}`
}
