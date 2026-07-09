import { z } from 'zod'

const bookmark = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  categoryId: z.string(),
  tagIds: z.array(z.string()),
  order: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const note = z.object({
  id: z.string(),
  title: z.string().optional(),
  body: z.string(),
  categoryId: z.string(),
  tagIds: z.array(z.string()),
  color: z.enum(['yellow', 'blue', 'green', 'pink', 'purple', 'neutral']),
  pinned: z.boolean(),
  order: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const category = z.object({
  id: z.string(),
  type: z.enum(['bookmark', 'note']),
  name: z.string(),
  order: z.number(),
  reserved: z.boolean().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const tag = z.object({
  id: z.string(),
  type: z.enum(['bookmark', 'note']),
  name: z.string(),
  createdAt: z.number(),
})

const settings = z.object({
  appearance: z.object({
    theme: z.enum(['light', 'dark', 'system']),
    accent: z.string(),
    density: z.enum(['comfortable', 'compact']),
  }),
  prefs: z.object({
    faviconFetch: z.boolean(),
    openLinks: z.enum(['new', 'same']),
    weatherUnits: z.enum(['c', 'f']).optional(),
    clockFormat: z.enum(['24', '12']).optional(),
    refreshMins: z.number().optional(),
    locations: z
      .array(z.object({ id: z.string(), label: z.string(), lat: z.number(), lon: z.number(), timezone: z.string() }))
      .optional(),
  }),
})

export const exportSchema = z.object({
  app: z.literal('d7d'),
  schemaVersion: z.number(),
  exportedAt: z.number(),
  bookmarks: z.array(bookmark),
  notes: z.array(note),
  categories: z.array(category),
  tags: z.array(tag),
  settings: settings.optional(),
})

export type ExportFile = z.infer<typeof exportSchema>
