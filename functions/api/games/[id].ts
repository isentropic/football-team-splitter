import { requireAdmin, type Env } from '../../_lib/db'

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const denied = await requireAdmin(ctx.request, ctx.env)
  if (denied) return denied

  const id = ctx.params.id as string
  const body = await ctx.request.json() as { score1: number; score2: number }

  const { meta } = await ctx.env.DB
    .prepare('UPDATE games SET score1 = ?, score2 = ? WHERE id = ?')
    .bind(body.score1, body.score2, id)
    .run()

  if (meta.changes === 0) return Response.json({ error: 'Not found' }, { status: 404 })

  const game = await ctx.env.DB
    .prepare('SELECT * FROM games WHERE id = ?')
    .bind(id)
    .first()

  return Response.json(game)
}
