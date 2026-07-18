/**
 * Email capture — the ONE thing that goes server-side (spec §8, §11).
 *
 * The email list is the asset, so it is captured through a server function and
 * never lives only on the device. Financial data is NOT sent here — it stays local
 * behind the SnapshotStore. In production this handler writes to the Turso `users`
 * table (encryption at rest, EU region); in this build it appends to a local
 * server-side JSONL file so the seam is real and testable without a provisioned DB.
 *
 * No financial fields, no identifiers that resolve to them — only an email and a
 * timestamp (spec §8: no financial data in logs or third-party analytics).
 */
import { createServerFn } from '@tanstack/react-start'

function normaliseEmail(input: unknown): string {
  if (typeof input !== 'string') throw new Error('email must be a string')
  const email = input.trim().toLowerCase()
  // deliberately liberal — a wall, not identity verification.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('that does not look like an email')
  }
  return email
}

export const captureEmail = createServerFn({ method: 'POST' })
  .validator(normaliseEmail)
  .handler(async ({ data: email }) => {
    // dynamic import keeps node:fs out of the client bundle entirely.
    const { appendFile, mkdir } = await import('node:fs/promises')
    const { dirname, join } = await import('node:path')

    const dir = process.env.WODGE_DATA_DIR ?? join(process.cwd(), '.data')
    const file = join(dir, 'emails.jsonl')
    await mkdir(dirname(file), { recursive: true })
    const line = JSON.stringify({ email, at: new Date().toISOString() }) + '\n'
    await appendFile(file, line, 'utf8')

    return { ok: true as const }
  })
