import { runSnapshotStoreContract } from './contract'
import { MemorySnapshotStore } from './memoryStore'
import { LocalSnapshotStore, MemoryKeyValue } from './localStore'

// The same contract, two implementations — provably interchangeable (spec §11).
// A Turso/libSQL implementation would be added here as a third target once a test
// database is provisioned (see store/README).
runSnapshotStoreContract('MemorySnapshotStore', () => new MemorySnapshotStore())
runSnapshotStoreContract(
  'LocalSnapshotStore (kv-backed)',
  () => new LocalSnapshotStore(new MemoryKeyValue()),
)
