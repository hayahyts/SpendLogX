/**
 * How a picker hands its answer back.
 *
 * The pickers are routes, pushed over whichever screen asked — the add sheet,
 * or a transaction being edited. expo-router params only carry strings forward,
 * so the asking screen registers a callback here, pushes the route, and the
 * picker resolves it. One picker is ever open at a time, which is what makes a
 * module-level slot sufficient — and honest about it.
 */

type CategoryCb = (categoryId: string | null) => void
type PersonCb = (personId: string | null) => void

let categoryCb: CategoryCb | null = null
let personCb: PersonCb | null = null

export function askForCategory(cb: CategoryCb): void {
  categoryCb = cb
}

export function resolveCategory(categoryId: string | null): void {
  const cb = categoryCb
  categoryCb = null
  cb?.(categoryId)
}

export function askForPerson(cb: PersonCb): void {
  personCb = cb
}

export function resolvePerson(personId: string | null): void {
  const cb = personCb
  personCb = null
  cb?.(personId)
}
