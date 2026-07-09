// Tiny dependency-free event bus so the outbox can signal "a local mutation landed"
// without importing the triggers/reconciler (which would create an import cycle).

type Listener = () => void
const listeners = new Set<Listener>()

export function onMutation(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emitMutation(): void {
  for (const l of listeners) l()
}
