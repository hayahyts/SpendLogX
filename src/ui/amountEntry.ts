/**
 * Amount entry, kept as a string while typing.
 *
 * "1." is a valid intermediate state and Money is not, so the field holds text
 * and parses on save. Two decimal places maximum, and nothing here ever
 * multiplies by 100 — that is `parseCedis`'s job, and it works on the string
 * precisely so 7000.47 does not become 700046.99999999994.
 */

import { type Money, ZERO, parseCedis } from '@/domain/money'
import type { Key } from './Keypad'

export const EMPTY = ''

export function press(current: string, key: Key): string {
  if (key === '⌫') return current.slice(0, -1)

  if (key === '.') {
    if (current.includes('.')) return current
    return current === '' ? '0.' : `${current}.`
  }

  const [whole = '', frac] = current.split('.')
  if (frac !== undefined && frac.length >= 2) return current
  // A leading zero is only meaningful before a decimal point.
  if (current === '0') return key
  if (whole.replace(/,/g, '').length >= 9 && frac === undefined) return current
  return current + key
}

/** What the keypad has typed, as Money. Zero for an empty or partial entry. */
export function toMoney(current: string): Money {
  if (current === '' || current === '.') return ZERO
  try {
    return parseCedis(current.endsWith('.') ? current.slice(0, -1) : current)
  } catch {
    return ZERO
  }
}

export function isEmpty(current: string): boolean {
  return toMoney(current) === ZERO
}

/**
 * The typed text split for display, with grouping applied to the cedi part.
 * Shows a trailing "." while it is being typed, and pads pesewas only once the
 * entry is committed — so "1.5" reads as 1.5 rather than jumping to 1.50.
 */
export function display(current: string): { whole: string; pesewas: string } {
  if (current === '') return { whole: '0', pesewas: '.00' }

  const [rawWhole = '', frac] = current.split('.')
  const grouped = (rawWhole === '' ? '0' : rawWhole).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ',',
  )
  if (frac === undefined) return { whole: grouped, pesewas: '.00' }
  return { whole: grouped, pesewas: `.${frac}` }
}
