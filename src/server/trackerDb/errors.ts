/**
 * Turning a database failure into something the page can act on.
 *
 * "Could not reach the database" covers at least three problems with three
 * different fixes — nothing configured, configured but never migrated, or
 * genuinely unreachable — and telling someone to check all three is barely
 * better than telling them nothing. The classification below is coarse but
 * it is enough to point at the one command that actually resolves it.
 *
 * Only the code crosses the wire. The underlying message is logged on the
 * server and never returned, since it can carry connection strings and
 * internal paths.
 */

export type DbFailureReason = 'not_configured' | 'not_migrated' | 'unavailable'

export function classifyDbFailure(error: unknown): DbFailureReason {
  const message = error instanceof Error ? error.message : String(error)
  const cause = error instanceof Error && error.cause ? String(error.cause) : ''
  const combined = `${message} ${cause}`

  // Thrown by the client itself when running in production with no Turso URL.
  if (combined.includes('TRACKER_TURSO_DATABASE_URL')) return 'not_configured'
  // The database opened but the schema was never applied.
  if (/no such table|no such column/i.test(combined)) return 'not_migrated'
  return 'unavailable'
}
