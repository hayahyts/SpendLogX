/**
 * Period maths, replacing the spreadsheet's DATE / EOMONTH / WEEKDAY formulas.
 *
 * Dates are plain calendar dates held as "YYYY-MM-DD" strings. Accra is UTC+0
 * year-round, so nothing here would break today if we used Date objects — but a
 * transaction happens on a date, not at an instant, and typing it that way stops
 * a future timezone from moving somebody's spending into the previous month.
 */

export type IsoDate = string & { readonly __isoDate: unique symbol }

export type PeriodKind = 'week' | 'month' | 'quarter' | 'year'

export interface Period {
  kind: PeriodKind
  start: IsoDate
  end: IsoDate
}

const ISO = /^\d{4}-\d{2}-\d{2}$/

export function isoDate(value: string): IsoDate {
  if (!ISO.test(value)) throw new Error(`Not an ISO date: "${value}"`)
  const d = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) throw new Error(`Not a real date: "${value}"`)
  if (toIso(d) !== value) throw new Error(`Not a real date: "${value}"`)
  return value as IsoDate
}

function toUtc(d: IsoDate): Date {
  return new Date(`${d}T00:00:00Z`)
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function fromParts(year: number, month1: number, day: number): IsoDate {
  const d = new Date(Date.UTC(year, month1 - 1, day))
  return isoDate(toIso(d))
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = toUtc(date)
  d.setUTCDate(d.getUTCDate() + days)
  return isoDate(toIso(d))
}

export function year(date: IsoDate): number {
  return toUtc(date).getUTCFullYear()
}

/** 1-based, so January is 1. */
export function month(date: IsoDate): number {
  return toUtc(date).getUTCMonth() + 1
}

/** 1-based, so Q1 is 1. */
export function quarter(date: IsoDate): number {
  return Math.floor((month(date) - 1) / 3) + 1
}

/** Monday = 1 … Sunday = 7, matching the spreadsheet's WEEKDAY(x, 2). */
export function isoWeekday(date: IsoDate): number {
  const day = toUtc(date).getUTCDay()
  return day === 0 ? 7 : day
}

export function startOfWeek(date: IsoDate): IsoDate {
  return addDays(date, -(isoWeekday(date) - 1))
}

export function endOfMonth(date: IsoDate): IsoDate {
  const d = toUtc(date)
  return fromParts(d.getUTCFullYear(), d.getUTCMonth() + 2, 0)
}

/** The period of the given kind that contains `date`. */
export function periodContaining(kind: PeriodKind, date: IsoDate): Period {
  switch (kind) {
    case 'week': {
      const start = startOfWeek(date)
      return { kind, start, end: addDays(start, 6) }
    }
    case 'month': {
      const start = fromParts(year(date), month(date), 1)
      return { kind, start, end: endOfMonth(start) }
    }
    case 'quarter': {
      const firstMonth = (quarter(date) - 1) * 3 + 1
      const start = fromParts(year(date), firstMonth, 1)
      return { kind, start, end: endOfMonth(fromParts(year(date), firstMonth + 2, 1)) }
    }
    case 'year': {
      return {
        kind,
        start: fromParts(year(date), 1, 1),
        end: fromParts(year(date), 12, 31),
      }
    }
  }
}

/** Step forward (or back, with a negative count) by whole periods. */
export function shiftPeriod(period: Period, by: number): Period {
  const d = toUtc(period.start)
  switch (period.kind) {
    case 'week':
      return periodContaining('week', addDays(period.start, by * 7))
    case 'month':
      return periodContaining('month', fromParts(d.getUTCFullYear(), d.getUTCMonth() + 1 + by, 1))
    case 'quarter':
      return periodContaining(
        'quarter',
        fromParts(d.getUTCFullYear(), d.getUTCMonth() + 1 + by * 3, 1),
      )
    case 'year':
      return periodContaining('year', fromParts(d.getUTCFullYear() + by, 1, 1))
  }
}

export function contains(period: Period, date: IsoDate): boolean {
  return date >= period.start && date <= period.end
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

export function label(period: Period): string {
  const y = year(period.start)
  switch (period.kind) {
    case 'week': {
      const a = period.start
      const b = period.end
      const sameMonth = month(a) === month(b)
      const left = `${MONTHS_SHORT[month(a) - 1]} ${Number(a.slice(8))}`
      const right = sameMonth
        ? String(Number(b.slice(8)))
        : `${MONTHS_SHORT[month(b) - 1]} ${Number(b.slice(8))}`
      return `${left} – ${right}, ${y}`
    }
    case 'month':
      return `${MONTHS[month(period.start) - 1]} ${y}`
    case 'quarter':
      return `Q${quarter(period.start)} ${y}`
    case 'year':
      return String(y)
  }
}
