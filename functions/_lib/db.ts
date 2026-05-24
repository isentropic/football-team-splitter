export interface Env {
  DB: D1Database
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status })
}
