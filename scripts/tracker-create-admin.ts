/**
 * Creates or updates the admin operator for the performance tracker.
 *
 *   pnpm tracker:admin:create -- you@example.com
 *
 * The password is read from ADMIN_PASSWORD rather than an argument, so it
 * does not end up in shell history or in the process list where anyone on the
 * machine can read it:
 *
 *   ADMIN_PASSWORD='...' pnpm tracker:admin:create -- you@example.com
 *
 * Only the scrypt hash is ever stored. Re-running for an existing email
 * updates that operator's password, which doubles as the reset flow — there
 * is deliberately no self-service reset in the panel itself, because at one
 * operator it would be more attack surface than convenience.
 */
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { hashPassword } from '../src/server/adminAuth'
import { getTrackerDb, closeTrackerDb } from '../src/server/trackerDb/client'
import { adminUsers } from '../src/server/trackerDb/schema'

const email = process.argv.slice(2).find((arg) => !arg.startsWith('-'))
const password = process.env.ADMIN_PASSWORD

function fail(message: string): never {
  console.error(`[tracker-admin] ${message}`)
  process.exit(1)
}

if (!email || !email.includes('@')) {
  fail('usage: ADMIN_PASSWORD=\'...\' pnpm tracker:admin:create -- you@example.com')
}
if (!password || password.length < 12) {
  fail('ADMIN_PASSWORD must be set to at least 12 characters')
}
if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 16) {
  // Checked here rather than at first login, so the problem surfaces while
  // someone is already at a terminal setting things up.
  fail('ADMIN_SESSION_SECRET must also be set (32+ random characters) or sessions cannot be issued')
}

const db = getTrackerDb()
const existing = await db.select().from(adminUsers).where(eq(adminUsers.email, email))

if (existing.length > 0) {
  await db
    .update(adminUsers)
    .set({ passwordHash: hashPassword(password) })
    .where(eq(adminUsers.email, email))
  console.log(`[tracker-admin] updated the password for ${email}`)
} else {
  await db.insert(adminUsers).values({ email, passwordHash: hashPassword(password) })
  console.log(`[tracker-admin] created operator ${email}`)
}

await closeTrackerDb()
process.exit(0)
