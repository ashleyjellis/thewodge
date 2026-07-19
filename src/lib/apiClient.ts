/**
 * Small fetch wrappers for the authenticated area's JSON API routes — shared so
 * every /app/* route talks to /api/* the same way rather than each redefining it.
 */
async function sendJson(method: 'POST' | 'PATCH' | 'DELETE', url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || !data.ok) throw new Error(data.error ?? 'request failed')
  return data
}

export const postJson = (url: string, body: unknown): Promise<unknown> => sendJson('POST', url, body)
export const patchJson = (url: string, body: unknown): Promise<unknown> => sendJson('PATCH', url, body)
export const sendDelete = (url: string, body: unknown): Promise<unknown> => sendJson('DELETE', url, body)
