import { db } from './db'
import { now } from '@/lib/id'
import type { ItemType, ID } from '@/types/models'

/** Fixed IDs for the reserved, non-deletable "Uncategorised" pseudo-categories (one per type). */
export const UNCATEGORISED: Record<ItemType, ID> = {
  bookmark: 'uncategorised-bookmark',
  note: 'uncategorised-note',
}
export const UNCATEGORISED_NAME = 'Uncategorised'

/** Ensure the reserved categories exist. Idempotent; safe to call on every boot. */
export async function initDb(): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const ts = now()
    for (const type of ['bookmark', 'note'] as const) {
      const id = UNCATEGORISED[type]
      if (!(await db.categories.get(id))) {
        await db.categories.add({
          id,
          type,
          name: UNCATEGORISED_NAME,
          order: Number.MAX_SAFE_INTEGER, // always sorts last
          reserved: true,
          createdAt: ts,
          updatedAt: ts,
        })
      }
    }
  })
}
