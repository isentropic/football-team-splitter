import { jsonError, type Env } from '../../_lib/db'
import type { Player } from '../../../src/lib/types'

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  try {
    const id = ctx.params.id as string
    const body = await ctx.request.json() as Omit<Player, 'id'>
    const { meta } = await ctx.env.DB
      .prepare('UPDATE players SET name=?, attack=?, defense=?, physical=?, morale=? WHERE id=?')
      .bind(body.name, body.attack, body.defense, body.physical, body.morale, id)
      .run()

    if (meta.changes === 0) return jsonError('Player not found', 404)
    return Response.json({ id, ...body })
  } catch (e) {
    return jsonError(String(e), 500)
  }
}

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  try {
    const id = ctx.params.id as string
    await ctx.env.DB.prepare('DELETE FROM players WHERE id=?').bind(id).run()
    return new Response(null, { status: 204 })
  } catch (e) {
    return jsonError(String(e), 500)
  }
}
