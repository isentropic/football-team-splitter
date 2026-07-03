import { requireAdmin, jsonError, type Env } from '../../_lib/db'
import type { Player } from '../../../src/lib/types'

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const denied = await requireAdmin(ctx.request, ctx.env)
  if (denied) return denied
  try {
    const id = ctx.params.id as string
    const p = await ctx.request.json() as Omit<Player, 'id'>
    const { meta } = await ctx.env.DB
      .prepare('UPDATE players SET name=?,pace=?,shooting=?,passing=?,dribbling=?,defending=?,physique=?,morale=? WHERE id=?')
      .bind(p.name, p.pace, p.shooting, p.passing, p.dribbling, p.defending, p.physique, p.morale, id)
      .run()
    if (meta.changes === 0) return jsonError('Player not found', 404)
    return Response.json({ id, ...p })
  } catch (e) {
    return jsonError(String(e), 500)
  }
}

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const denied = await requireAdmin(ctx.request, ctx.env)
  if (denied) return denied
  try {
    await ctx.env.DB.prepare('DELETE FROM players WHERE id=?').bind(ctx.params.id).run()
    return new Response(null, { status: 204 })
  } catch (e) {
    return jsonError(String(e), 500)
  }
}
