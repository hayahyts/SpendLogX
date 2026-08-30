/**
 * Web build of the persistence seam.
 *
 * Metro picks this file over persist.ts on web, so expo-sqlite is never
 * bundled there. The web export exists to review screens; the phone is where
 * data lives.
 */

import type { IsoDate } from '@/domain/period'
import type { Persistence } from './persist.types'

export type { Persistence } from './persist.types'

export function openPersistence(_today: IsoDate): Persistence | null {
  return null
}
