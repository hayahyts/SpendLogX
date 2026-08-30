import { describe, expect, it } from 'vitest'
import {
  contains, endOfMonth, isoDate, isoWeekday, label, periodContaining,
  shiftPeriod, startOfWeek,
} from './period'

const d = isoDate

describe('isoDate', () => {
  it('rejects dates that do not exist', () => {
    expect(() => isoDate('2026-02-30')).toThrow()
    expect(() => isoDate('2026-13-01')).toThrow()
    expect(() => isoDate('4 May 2026')).toThrow()
  })
})

describe('weeks', () => {
  it('starts on Monday, matching the sheet WEEKDAY(x, 2)', () => {
    // 2026-05-04 is a Monday.
    expect(isoWeekday(d('2026-05-04'))).toBe(1)
    expect(isoWeekday(d('2026-05-10'))).toBe(7)
    expect(startOfWeek(d('2026-05-04'))).toBe('2026-05-04')
    expect(startOfWeek(d('2026-05-10'))).toBe('2026-05-04')
  })

  it('builds a Monday-to-Sunday period', () => {
    const p = periodContaining('week', d('2026-07-01'))
    expect(p).toMatchObject({ start: '2026-06-29', end: '2026-07-05' })
  })
})

describe('months', () => {
  it('ends on the real last day, including leap years', () => {
    expect(endOfMonth(d('2026-02-10'))).toBe('2026-02-28')
    expect(endOfMonth(d('2028-02-10'))).toBe('2028-02-29')
    expect(endOfMonth(d('2026-06-15'))).toBe('2026-06-30')
    expect(endOfMonth(d('2026-12-01'))).toBe('2026-12-31')
  })
})

describe('quarters and years', () => {
  it('spans the right months', () => {
    expect(periodContaining('quarter', d('2026-05-04'))).toMatchObject({
      start: '2026-04-01', end: '2026-06-30',
    })
    expect(periodContaining('quarter', d('2026-12-31'))).toMatchObject({
      start: '2026-10-01', end: '2026-12-31',
    })
    expect(periodContaining('year', d('2026-07-01'))).toMatchObject({
      start: '2026-01-01', end: '2026-12-31',
    })
  })
})

describe('shiftPeriod', () => {
  it('steps months across a year boundary', () => {
    const jan = periodContaining('month', d('2026-01-15'))
    expect(shiftPeriod(jan, -1)).toMatchObject({ start: '2025-12-01', end: '2025-12-31' })
    expect(shiftPeriod(jan, 12)).toMatchObject({ start: '2027-01-01', end: '2027-01-31' })
  })

  it('does not land on an impossible day', () => {
    const jan31 = periodContaining('month', d('2026-01-31'))
    expect(shiftPeriod(jan31, 1)).toMatchObject({ start: '2026-02-01', end: '2026-02-28' })
  })

  it('steps weeks and quarters', () => {
    const w = periodContaining('week', d('2026-05-04'))
    expect(shiftPeriod(w, 1)).toMatchObject({ start: '2026-05-11', end: '2026-05-17' })
    const q = periodContaining('quarter', d('2026-05-04'))
    expect(shiftPeriod(q, 1)).toMatchObject({ start: '2026-07-01', end: '2026-09-30' })
  })
})

describe('contains', () => {
  it('includes both endpoints', () => {
    const p = periodContaining('month', d('2026-06-15'))
    expect(contains(p, d('2026-06-01'))).toBe(true)
    expect(contains(p, d('2026-06-30'))).toBe(true)
    expect(contains(p, d('2026-07-01'))).toBe(false)
    expect(contains(p, d('2026-05-31'))).toBe(false)
  })
})

describe('label', () => {
  it('reads the way a person would say it', () => {
    expect(label(periodContaining('month', d('2026-06-15')))).toBe('June 2026')
    expect(label(periodContaining('quarter', d('2026-05-04')))).toBe('Q2 2026')
    expect(label(periodContaining('year', d('2026-05-04')))).toBe('2026')
    expect(label(periodContaining('week', d('2026-05-04')))).toBe('May 4 – 10, 2026')
    expect(label(periodContaining('week', d('2026-07-01')))).toBe('Jun 29 – Jul 5, 2026')
  })
})
