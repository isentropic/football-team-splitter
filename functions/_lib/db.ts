export interface Env {
  DB: D1Database
  ADMIN_PASSWORD: string
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status })
}

async function hmac(password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('fts-admin'))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

export async function makeToken(password: string): Promise<string> {
  return hmac(password)
}

export async function requireAdmin(request: Request, env: Env): Promise<Response | null> {
  if (!env.ADMIN_PASSWORD) return null // not configured — open in dev
  const auth = request.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const expected = await hmac(env.ADMIN_PASSWORD)
  if (token !== expected) return jsonError('Unauthorized', 401)
  return null
}
