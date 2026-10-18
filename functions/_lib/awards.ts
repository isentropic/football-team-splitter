import { AWARD_YEAR, OPENS_AT, CLOSES_AT } from '../../src/lib/awards'
import type { Env } from './db'

export async function eligiblePlayers(env: Env) {
  const { results } = await env.DB.prepare(`SELECT DISTINCT p.id, p.name FROM players p
    JOIN sessions s JOIN json_each(s.teams) t JOIN json_each(t.value, '$.playerIds') member
    JOIN games g ON g.session_id = s.id AND (g.team1 = json_extract(t.value, '$.color') OR g.team2 = json_extract(t.value, '$.color'))
    WHERE member.value = p.id AND COALESCE(p.retired, 0) = 0 AND g.played_at >= ? AND g.played_at < ? ORDER BY p.name COLLATE NOCASE`)
    .bind(Date.parse(`${AWARD_YEAR}-01-01T00:00:00+09:00`), Date.parse(`${AWARD_YEAR + 1}-01-01T00:00:00+09:00`))
    .all<{ id: string; name: string }>()
  return results
}
export function isVotingOpen() {
  return Date.now() >= Date.parse(OPENS_AT) && Date.now() < Date.parse(CLOSES_AT)
}
export function privateJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}
