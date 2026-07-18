/**
 * Storage barrel (ring 2). The app calls `getStore()` and nothing else — the one
 * place the local ⇄ server decision is made (spec §8, §11).
 */
import type { SnapshotStore } from './SnapshotStore'
import { createLocalStore } from './localStore'

export * from './SnapshotStore'
export * from './localStore'
export * from './memoryStore'

let singleton: SnapshotStore | null = null

/**
 * The app's store. v1: local-first (financials on the device). To promote to
 * server-side, return a TursoSnapshotStore here instead — see store/README.md.
 */
export function getStore(): SnapshotStore {
  if (!singleton) singleton = createLocalStore()
  return singleton
}
