import { requireAdmin, type Env } from '../../../_lib/db'

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const session_id = ctx.params.id as string
  const { results } = await ctx.env.DB
    .prepare('SELECT * FROM games WHERE session_id = ? ORDER BY played_at ASC')
    .bind(session_id)
    .all()
  return Response.json(results)
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const denied = await requireAdmin(ctx.request, ctx.env)
  if (denied) return denied

  const session_id = ctx.params.id as string
  const session = await ctx.env.DB
    .prepare('SELECT id FROM sessions WHERE id = ?')
    .bind(session_id)
    .first()
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 })

  const body = await ctx.request.json() as {
    team1: string; score1: number; team2: string; score2: number
  }
  const id = crypto.randomUUID()
  const played_at = Date.now()

  await ctx.env.DB
    .prepare('INSERT INTO games (id, session_id, team1, score1, team2, score2, played_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, session_id, body.team1, body.score1, body.team2, body.score2, played_at)
    .run()

  return Response.json({ id, session_id, ...body, played_at }, { status: 201 })
}
