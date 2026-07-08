import type { NoteColor } from '@/types/models'

export const NOTE_COLORS: readonly NoteColor[] = ['yellow', 'blue', 'green', 'pink', 'purple', 'neutral']

export const noteBg = (c: NoteColor): string => `var(--note-${c})`

export const NOTE_BODY_SOFT_CAP = 500
