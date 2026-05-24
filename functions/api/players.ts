import { getDb, ensureSchema, jsonError, type Env } from '../_lib/db'
import type { Player } from '../../src/lib/types'

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const db = getDb(ctx.env)
    await ensureSchema(db)
    const rows = await db.sql`SELECT * FROM players ORDER BY name`
    return Response.json(rows)
  } catch (e) {
    return jsonError(String(e), 500)
  }
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const body = await ctx.request.json() as Omit<Player, 'id'> | Omit<Player, 'id'>[]
    const db = getDb(ctx.env)
    await ensureSchema(db)

    // Supports single player or bulk import array
    const players: Omit<Player, 'id'>[] = Array.isArray(body) ? body : [body]
    const created: Player[] = []

    for (const p of players) {
      const id = crypto.randomUUID()
      await db.sql`
        INSERT INTO players (id, name, attack, defense, physical, morale)
        VALUES (${id}, ${p.name}, ${p.attack}, ${p.defense}, ${p.physical}, ${p.morale})
      `
      created.push({ id, ...p })
    }

    return Response.json(Array.isArray(body) ? created : created[0], { status: 201 })
  } catch (e) {
    return jsonError(String(e), 500)
  }
}
