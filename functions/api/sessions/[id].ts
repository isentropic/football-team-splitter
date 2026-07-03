import { requireAdmin, type Env } from '../../_lib/db'

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const id = ctx.params.id as string
  const session = await ctx.env.DB
    .prepare('SELECT id, teams, played_at FROM sessions WHERE id = ?')
    .bind(id)
    .first()
  if (!session) return Response.json({ error: 'Not found' }, { status: 404 })

  const { results: games } = await ctx.env.DB
    .prepare('SELECT * FROM games WHERE session_id = ? ORDER BY played_at ASC')
    .bind(id)
    .all()

  return Response.json({
    id: session.id,
    teams: JSON.parse(session.teams as string),
    played_at: session.played_at,
    games,
  })
}

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const denied = await requireAdmin(ctx.request, ctx.env)
  if (denied) return denied

  const id = ctx.params.id as string
  const { meta } = await ctx.env.DB
    .prepare('DELETE FROM sessions WHERE id = ?')
    .bind(id)
    .run()
  if (meta.changes === 0) return Response.json({ error: 'Not found' }, { status: 404 })
  return new Response(null, { status: 204 })
}

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const denied = await requireAdmin(ctx.request, ctx.env)
  if (denied) return denied

  const id = ctx.params.id as string
  const body = await ctx.request.json() as { teams: { color: string; playerIds: string[] }[] }
  if (!Array.isArray(body.teams) || ![3, 4].includes(body.teams.length)) {
    return Response.json({ error: 'Expected 3 or 4 teams' }, { status: 400 })
  }
  const colors = new Set(body.teams.map((t) => t.color))
  if (colors.size !== body.teams.length) {
    return Response.json({ error: 'Team colors must be unique' }, { status: 400 })
  }

  const gameCount = await ctx.env.DB
    .prepare('SELECT COUNT(*) AS count FROM games WHERE session_id = ?')
    .bind(id)
    .first<{ count: number }>()
  if ((gameCount?.count ?? 0) > 0) {
    return Response.json({ error: 'Team colors can only be changed before games start' }, { status: 400 })
  }

  const { meta } = await ctx.env.DB
    .prepare('UPDATE sessions SET teams = ? WHERE id = ?')
    .bind(JSON.stringify(body.teams), id)
    .run()
  if (meta.changes === 0) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json({ id, teams: body.teams })
}
