/**
 * Data-access barrel — the only door into the database. Calculation logic
 * elsewhere (a later phase) imports from here, never writes raw SQL, and never
 * imports drizzle-orm or @libsql/client directly.
 */
export * from './client.js'
export * from './schema.js'
export * from './households.js'
export * from './people.js'
export * from './accounts.js'
export * from './accountSnapshots.js'
export * from './forecastSnapshots.js'
