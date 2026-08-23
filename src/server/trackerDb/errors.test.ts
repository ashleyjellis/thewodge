import { describe, expect, it } from 'vitest'
import { classifyDbFailure } from './errors'

describe('classifyDbFailure', () => {
  it('recognises a database that was never migrated', () => {
    expect(classifyDbFailure(new Error('SQLITE_ERROR: no such table: portfolios'))).toBe('not_migrated')
    expect(classifyDbFailure(new Error('SQL_INPUT_ERROR: no such column: "wrapper"'))).toBe('not_migrated')
  })

  it('recognises a production build with nothing configured', () => {
    expect(
      classifyDbFailure(new Error('TRACKER_TURSO_DATABASE_URL is not set. The tracker database...')),
    ).toBe('not_configured')
  })

  it('reads a wrapped cause, since drizzle nests the real error', () => {
    const wrapped = new Error('Failed query: select ...', {
      cause: new Error('SqliteError: no such table: readings'),
    })
    expect(classifyDbFailure(wrapped)).toBe('not_migrated')
  })

  it('falls back to unavailable for anything it does not recognise', () => {
    expect(classifyDbFailure(new Error('connection refused'))).toBe('unavailable')
    expect(classifyDbFailure('a string')).toBe('unavailable')
    expect(classifyDbFailure(null)).toBe('unavailable')
  })
})
