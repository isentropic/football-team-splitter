import { requireAdmin, jsonError, type Env } from '../_lib/db'
import { eligiblePlayers, privateJson } from '../_lib/awards'
import { AWARD_YEAR, CATEGORIES, type Ballot } from '../../src/lib/awards'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Results must remain private even when local admin credentials are unconfigured.
  if (!env.ADMIN_PASSWORD) return jsonError('Admin login is not configured.', 503)
  const denied = await requireAdmin(request, env)
  if (denied) return denied
  const [players, { results: ballots }, { results: names }] = await Promise.all([
    eligiblePlayers(env),
    env.DB.prepare('SELECT voter_id, ballot, submitted_at FROM award_ballots WHERE year = ?').bind(AWARD_YEAR).all<{ voter_id: string; ballot: string; submitted_at: number }>(),
    env.DB.prepare('SELECT id, name FROM players').all<{ id: string; name: string }>(),
  ])
  const nameMap = new Map(names.map(p => [p.id, p.name]))
  const categories = CATEGORIES.map(category => {
    const scores = new Map<string, { id: string; name: string; points: number; first: number; second: number; third: number }>()
    let count = 0
    for (const row of ballots) {
      const picks = (JSON.parse(row.ballot) as Ballot)[category.id] ?? []
      if (picks.length) count++
      picks.forEach((id, index) => {
        const score = scores.get(id) ?? { id, name: nameMap.get(id) ?? 'Former player', points: 0, first: 0, second: 0, third: 0 }
        score.points += 3 - index
        if (index === 0) score.first++
        if (index === 1) score.second++
        if (index === 2) score.third++
        scores.set(id, score)
      })
    }
    const sorted = [...scores.values()].sort((a, b) => b.points - a.points || b.first - a.first || b.second - a.second || a.name.localeCompare(b.name))
    let rank = 0
    const standings = sorted.map((score, index) => {
      const prev = sorted[index - 1]
      if (!prev || prev.points !== score.points || prev.first !== score.first || prev.second !== score.second) rank = index + 1
      return { ...score, rank }
    })
    return { id: category.id, ballots: count, standings }
  })
  return privateJson({ eligible: players.length, submitted: ballots.length, categories,
    participation: players.map(p => ({ ...p, submittedAt: ballots.find(b => b.voter_id === p.id)?.submitted_at ?? null })) })
}
