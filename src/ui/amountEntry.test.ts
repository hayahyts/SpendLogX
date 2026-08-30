import { describe, expect, it } from 'vitest'
import { parseCedis } from '@/domain/money'
import { display, isEmpty, press, toMoney } from './amountEntry'

/** Type a whole string of keys, as a thumb would. */
const type = (keys: string) =>
  [...keys].reduce((s, k) => press(s, k as Parameters<typeof press>[1]), '')

describe('typing an amount', () => {
  it('builds up digits', () => {
    expect(type('1000')).toBe('1000')
  })

  it('allows one decimal point, and only one', () => {
    expect(type('1.5')).toBe('1.5')
    expect(press('1.5', '.')).toBe('1.5')
  })

  it('treats a leading point as 0.', () => {
    expect(type('.')).toBe('0.')
    expect(type('.5')).toBe('0.5')
  })

  it('stops at two decimal places', () => {
    expect(type('12.345')).toBe('12.34')
  })

  it('replaces a lone leading zero', () => {
    expect(type('05')).toBe('5')
  })

  it('deletes from the end', () => {
    expect(press('1000', '⌫')).toBe('100')
    expect(press('', '⌫')).toBe('')
  })
})

describe('toMoney', () => {
  it('parses what has been typed', () => {
    expect(toMoney('1000')).toBe(parseCedis('1000'))
    expect(toMoney('7000.47')).toBe(parseCedis('7000.47'))
  })

  it('treats a trailing point as a whole number', () => {
    // "1." is a valid thing to be part-way through typing.
    expect(toMoney('1.')).toBe(parseCedis('1'))
  })

  it('is zero when nothing useful has been typed', () => {
    expect(toMoney('')).toBe(0)
    expect(toMoney('.')).toBe(0)
    expect(isEmpty('')).toBe(true)
    expect(isEmpty('0')).toBe(true)
    expect(isEmpty('0.00')).toBe(true)
    expect(isEmpty('0.01')).toBe(false)
  })
})

describe('display', () => {
  it('groups thousands as they are typed', () => {
    expect(display('23000')).toEqual({ whole: '23,000', pesewas: '.00' })
    expect(display('1000')).toEqual({ whole: '1,000', pesewas: '.00' })
  })

  it('shows an empty entry as 0.00', () => {
    expect(display('')).toEqual({ whole: '0', pesewas: '.00' })
  })

  it('does not pad pesewas while they are being typed', () => {
    expect(display('1.5')).toEqual({ whole: '1', pesewas: '.5' })
    expect(display('1.')).toEqual({ whole: '1', pesewas: '.' })
  })
})
