import { describe, expect, it } from 'vitest'
import {
  MoneyError, ZERO, add, format, fromSheetNumber, parseCedis, pesewas,
  subtract, sum, toDecimalString,
} from './money'

describe('parseCedis', () => {
  it('parses the amounts the spreadsheet actually contains', () => {
    expect(parseCedis('7000.47')).toBe(700047)
    expect(parseCedis('1,042')).toBe(104200)
    expect(parseCedis('23000')).toBe(2300000)
    expect(parseCedis('53')).toBe(5300)
    expect(parseCedis('0.05')).toBe(5)
  })

  it('does not lose a pesewa to floating point', () => {
    // Number('7000.47') * 100 is 700046.99999999994.
    expect(parseCedis('7000.47')).toBe(700047)
    expect(parseCedis('0.29')).toBe(29)
    expect(parseCedis('1.10')).toBe(110)
  })

  it('treats a single decimal place as tenths', () => {
    expect(parseCedis('5.5')).toBe(550)
    expect(parseCedis('.5')).toBe(50)
  })

  it('accepts a currency mark and stray spacing', () => {
    expect(parseCedis(' ₵ 1,234.50 ')).toBe(123450)
    expect(parseCedis('GHS 20')).toBe(2000)
  })

  it('handles negatives, for balances', () => {
    expect(parseCedis('-3.20')).toBe(-320)
  })

  it('rejects anything it cannot represent exactly', () => {
    expect(() => parseCedis('1.234')).toThrow(MoneyError)
    expect(() => parseCedis('')).toThrow(MoneyError)
    expect(() => parseCedis('abc')).toThrow(MoneyError)
    expect(() => parseCedis('1.2.3')).toThrow(MoneyError)
  })
})

describe('pesewas', () => {
  it('refuses fractional input, which is the whole point', () => {
    expect(() => pesewas(10.5)).toThrow(MoneyError)
    expect(() => pesewas(Number.NaN)).toThrow(MoneyError)
    expect(() => pesewas(Number.MAX_SAFE_INTEGER + 2)).toThrow(MoneyError)
  })
})

describe('fromSheetNumber', () => {
  it('recovers exact pesewas from Excel floats', () => {
    expect(fromSheetNumber(7000.4699999999998)).toBe(700047)
    expect(fromSheetNumber(23000)).toBe(2300000)
    expect(fromSheetNumber(0.1 + 0.2)).toBe(30)
  })
})

describe('arithmetic', () => {
  it('adds and subtracts without drift', () => {
    expect(add(parseCedis('0.1'), parseCedis('0.2'))).toBe(parseCedis('0.3'))
    expect(subtract(parseCedis('10'), parseCedis('9.99'))).toBe(1)
  })

  it('sums an empty list to zero', () => {
    expect(sum([])).toBe(ZERO)
  })

  it('sums the sheet total exactly', () => {
    const rows = ['23000', '7000.47', '1042', '18847'].map(parseCedis)
    expect(sum(rows)).toBe(parseCedis('49889.47'))
  })
})

describe('format', () => {
  it('groups thousands and always shows pesewas', () => {
    expect(format(parseCedis('7000.47'))).toBe('₵ 7,000.47')
    expect(format(parseCedis('23000'))).toBe('₵ 23,000.00')
    expect(format(parseCedis('53'))).toBe('₵ 53.00')
  })

  it('can drop the symbol and the trailing pesewas', () => {
    expect(format(parseCedis('1234.5'), { symbol: false })).toBe('1,234.50')
    expect(format(parseCedis('20'), { cents: false })).toBe('₵ 20')
    expect(format(parseCedis('20.5'), { cents: false })).toBe('₵ 20.50')
  })

  it('renders negatives both ways', () => {
    expect(format(parseCedis('-5'))).toBe('-₵ 5.00')
    expect(format(parseCedis('-5'), { negative: 'parens' })).toBe('(₵ 5.00)')
  })
})

describe('toDecimalString', () => {
  it('round-trips through parseCedis', () => {
    for (const s of ['0.00', '0.05', '7000.47', '23000.00', '-3.20']) {
      expect(toDecimalString(parseCedis(s))).toBe(s)
    }
  })
})
