/**
 * Data-access barrel — the only door into the database. Calculation logic
 * elsewhere (a later phase) imports from here, never writes raw SQL, and never
 * imports drizzle-orm or @libsql/client directly.
 */
export * from './client'
export * from './schema'
export * from './households'
export * from './people'
export * from './accounts'
export * from './accountSnapshots'
export * from './forecastSnapshots'
