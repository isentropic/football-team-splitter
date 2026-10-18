import { jsonError, type Env } from '../_lib/db'
import { eligiblePlayers, isVotingOpen, privateJson } from '../_lib/awards'
import { AWARD_YEAR, CATEGORIES, OPENS_AT, CLOSES_AT } from '../../src/lib/awards'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  return privateJson({ players: await eligiblePlayers(env), opensAt: OPENS_AT, closesAt: CLOSES_AT, isOpen: isVotingOpen() })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isVotingOpen()) return jsonError('Voting is closed.', 403)
  let body: { voterId?: unknown; ballot?: unknown }
  try { body = await request.json() } catch { return jsonError('Invalid ballot.') }
  const players = await eligiblePlayers(env)
  const ids = new Set(players.map(p => p.id))
  if (typeof body.voterId !== 'string' || !ids.has(body.voterId)) return jsonError('Please select an eligible player.')
  if (!body.ballot || typeof body.ballot !== 'object' || Array.isArray(body.ballot)) return jsonError('Invalid ballot.')
  const ballot = body.ballot as Record<string, unknown>
  if (Object.keys(ballot).some(key => !CATEGORIES.some(c => c.id === key))) return jsonError('Unknown award category.')
  const clean: Record<string, string[]> = {}
  for (const category of CATEGORIES) {
    const picks = ballot[category.id] ?? []
    if (!Array.isArray(picks) || ![0, 3].includes(picks.length) || new Set(picks).size !== picks.length || picks.some(id => typeof id !== 'string' || !ids.has(id) || id === body.voterId)) {
      return jsonError('Choose three different players per category, or skip it. Self-voting is not allowed.')
    }
    clean[category.id] = picks
  }
  if (!Object.values(clean).some(picks => picks.length)) return jsonError('Please vote in at least one category.')
  // The primary key enforces one ballot even when requests arrive simultaneously.
  const result = await env.DB.prepare('INSERT INTO award_ballots (year, voter_id, ballot, submitted_at) VALUES (?, ?, ?, ?) ON CONFLICT(year, voter_id) DO NOTHING')
    .bind(AWARD_YEAR, body.voterId, JSON.stringify(clean), Date.now()).run()
  if (result.meta.changes === 0) return jsonError('A ballot has already been submitted for this player. Submissions cannot be changed.', 409)
  return privateJson({ submitted: true }, 201)
}
