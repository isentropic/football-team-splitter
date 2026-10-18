import { AWARD_YEAR, OPENS_AT, CLOSES_AT } from '../../src/lib/awards'
import type { Env } from './db'

// These exclusions apply only to the 2026 club awards, never to club records.
const EXCLUDED_2026_PLAYER_IDS = new Set([
  'ed408f35-ae81-4624-864b-febb6c7befff', // Zhanibek
  '8d9b9628-770a-40ca-a59b-f0ea8f312e7e', // Alisher Saduakas
  '1e930f0e-1a99-4662-a6e9-e28a04ba66f6', // Sanzhar 2
  'c42e16dc-9018-4546-bfa1-82120c52b34d', // Nurlykhan
  '508a6ef5-ac96-4ebb-9cf3-25bf7b699495', // Merey
  '4812dfe5-f1af-4b2c-ad22-33c7812e17a0', // JJ
  '4fce0ca1-7b4b-48a3-84cd-e1d2d096818f', // Damir
])

export function isAwardPlayerExcluded(id: string) {
  return AWARD_YEAR === 2026 && EXCLUDED_2026_PLAYER_IDS.has(id)
}

export async function eligiblePlayers(env: Env) {
  const { results } = await env.DB.prepare(`SELECT DISTINCT p.id, p.name FROM players p
    JOIN sessions s JOIN json_each(s.teams) t JOIN json_each(t.value, '$.playerIds') member
    JOIN games g ON g.session_id = s.id AND (g.team1 = json_extract(t.value, '$.color') OR g.team2 = json_extract(t.value, '$.color'))
    WHERE member.value = p.id AND COALESCE(p.retired, 0) = 0 AND g.played_at >= ? AND g.played_at < ? ORDER BY p.name COLLATE NOCASE`)
    .bind(Date.parse(`${AWARD_YEAR}-01-01T00:00:00+09:00`), Date.parse(`${AWARD_YEAR + 1}-01-01T00:00:00+09:00`))
    .all<{ id: string; name: string }>()
  return results.filter(player => !isAwardPlayerExcluded(player.id))
}
export function isVotingOpen() {
  return Date.now() >= Date.parse(OPENS_AT) && Date.now() < Date.parse(CLOSES_AT)
}
export function privateJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}
