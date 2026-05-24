import { Database } from '@sqlitecloud/drivers'

export interface Env {
  SQLITECLOUD_URL: string
}

export function getDb(env: Env): Database {
  if (!env.SQLITECLOUD_URL) throw new Error('SQLITECLOUD_URL is not set')
  return new Database(env.SQLITECLOUD_URL)
}

export async function ensureSchema(db: Database): Promise<void> {
  await db.sql`
    CREATE TABLE IF NOT EXISTS players (
      id   TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      attack   INTEGER NOT NULL DEFAULT 5,
      defense  INTEGER NOT NULL DEFAULT 5,
      physical INTEGER NOT NULL DEFAULT 5,
      morale   INTEGER NOT NULL DEFAULT 5
    )
  `
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status })
}
