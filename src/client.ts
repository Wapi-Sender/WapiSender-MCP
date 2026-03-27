import { session } from './session.ts'

const BASE_URL = 'https://wapisender.com'

function normalizeError(status: number, body: unknown): string {
  const msg = typeof body === 'object' && body !== null && 'error' in body
    ? String((body as Record<string, unknown>).error)
    : JSON.stringify(body)
  if (status === 401) return 'Not authenticated. Run: wapisender-mcp login --token <token>'
  if (status === 403) return `Access denied — ${msg}`
  if (status === 404) return `Not found — ${msg}`
  if (status === 429) return 'Rate limited. Wait a moment and try again.'
  return `Server error ${status}: ${msg}`
}

export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const token = session.getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(normalizeError(res.status, data))
  }

  return data as T
}

export function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] }
}

export function err(text: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${text}` }], isError: true }
}
