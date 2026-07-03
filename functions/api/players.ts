import { requireAdmin, jsonError, type Env } from '../_lib/db'
import type { Player } from '../../src/lib/types'

function normalizePlayer(row: Record<string, unknown>): Player {
  return {
    id: row.id as string,
    name: row.name as string,
    pace: row.pace as number,
    shooting: row.shooting as number,
    passing: row.passing as number,
    dribbling: row.dribbling as number,
    defending: row.defending as number,
    physique: row.physique as number,
    morale: row.morale as number,
    retired: Boolean(row.retired),
  }
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const { results } = await ctx.env.DB
      .prepare('SELECT * FROM players ORDER BY name')
      .all<Record<string, unknown>>()
    return Response.json(results.map(normalizePlayer))
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
        .prepare('INSERT INTO players (id,name,pace,shooting,passing,dribbling,defending,physique,morale,retired) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .bind(id, p.name, p.pace, p.shooting, p.passing, p.dribbling, p.defending, p.physique, p.morale, p.retired ? 1 : 0)
        .run()
      created.push({ id, ...p, retired: Boolean(p.retired) })
    }

    return Response.json(Array.isArray(body) ? created : created[0], { status: 201 })
  } catch (e) {
    return jsonError(String(e), 500)
  }
}
