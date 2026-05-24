import { requireAdmin, type Env } from '../_lib/db'

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { results } = await ctx.env.DB
    .prepare('SELECT id, teams, played_at FROM sessions ORDER BY played_at DESC')
    .all()
  const sessions = results.map((r) => ({
    id: r.id,
    teams: JSON.parse(r.teams as string),
    played_at: r.played_at,
  }))
  return Response.json(sessions)
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const denied = await requireAdmin(ctx.request, ctx.env)
  if (denied) return denied

  const body = await ctx.request.json() as { teams: { color: string; playerIds: string[] }[] }
  if (!Array.isArray(body.teams) || body.teams.length !== 3) {
    return Response.json({ error: 'Expected 3 teams' }, { status: 400 })
  }

  const id = crypto.randomUUID()
  const played_at = Date.now()
  await ctx.env.DB
    .prepare('INSERT INTO sessions (id, teams, played_at) VALUES (?, ?, ?)')
    .bind(id, JSON.stringify(body.teams), played_at)
    .run()

  return Response.json({ id, teams: body.teams, played_at }, { status: 201 })
}
