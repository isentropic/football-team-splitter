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
