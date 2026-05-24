import { makeToken, jsonError, type Env } from '../_lib/db'

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { password } = await ctx.request.json() as { password: string }
    if (!ctx.env.ADMIN_PASSWORD || password !== ctx.env.ADMIN_PASSWORD) {
      return jsonError('Invalid password', 401)
    }
    const token = await makeToken(ctx.env.ADMIN_PASSWORD)
    return Response.json({ token })
  } catch {
    return jsonError('Bad request')
  }
}
