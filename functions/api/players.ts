import { requireAdmin, jsonError, type Env } from '../_lib/db'
import type { Player } from '../../src/lib/types'

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const { results } = await ctx.env.DB
      .prepare('SELECT * FROM players ORDER BY name')
      .all<Player>()
    return Response.json(results)
  } catch (e) {
    return jsonError(String(e), 500)
  }
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const denied = await requireAdmin(ctx.request, ctx.env)
  if (denied) return denied
  try {
    const body = await ctx.request.json() as Omit<Player, 'id'> | Omit<Player, 'id'>[]
    const players = Array.isArray(body) ? body : [body]
    const created: Player[] = []

    for (const p of players) {
      const id = crypto.randomUUID()
      await ctx.env.DB
        .prepare('INSERT INTO players (id,name,pace,shooting,passing,dribbling,defending,physique,morale) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(id, p.name, p.pace, p.shooting, p.passing, p.dribbling, p.defending, p.physique, p.morale)
        .run()
      created.push({ id, ...p })
    }

    return Response.json(Array.isArray(body) ? created : created[0], { status: 201 })
  } catch (e) {
    return jsonError(String(e), 500)
  }
}
