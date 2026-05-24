import { getDb, ensureSchema, jsonError, type Env } from '../../_lib/db'
import type { Player } from '../../../src/lib/types'

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  try {
    const id = ctx.params.id as string
    const body = await ctx.request.json() as Omit<Player, 'id'>
    const db = getDb(ctx.env)
    await ensureSchema(db)

    const result = await db.sql`
      UPDATE players
      SET name=${body.name}, attack=${body.attack}, defense=${body.defense},
          physical=${body.physical}, morale=${body.morale}
      WHERE id=${id}
    `

    if ((result as { changes?: number }).changes === 0) {
      return jsonError('Player not found', 404)
    }

    return Response.json({ id, ...body })
  } catch (e) {
    return jsonError(String(e), 500)
  }
}

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  try {
    const id = ctx.params.id as string
    const db = getDb(ctx.env)
    await ensureSchema(db)
    await db.sql`DELETE FROM players WHERE id=${id}`
    return new Response(null, { status: 204 })
  } catch (e) {
    return jsonError(String(e), 500)
  }
}
