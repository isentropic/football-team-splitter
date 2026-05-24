import type { Player, Team, SplitVariant, SplitResponse } from '../../src/lib/types'

const STAT_KEYS = ['pace','shooting','passing','dribbling','defending','physique','morale'] as const
type StatKey = typeof STAT_KEYS[number]

function teamStats(players: Player[]): Omit<Team, 'name' | 'color'> {
  const avg = (key: StatKey) =>
    Math.round((players.reduce((s, p) => s + p[key], 0) / players.length) * 10) / 10

  return {
    players,
    avgPace:      avg('pace'),
    avgShooting:  avg('shooting'),
    avgPassing:   avg('passing'),
    avgDribbling: avg('dribbling'),
    avgDefending: avg('defending'),
    avgPhysique:  avg('physique'),
    avgMorale:    avg('morale'),
    avgOverall: Math.round(
      (STAT_KEYS.reduce((s, k) => s + avg(k), 0) / STAT_KEYS.length) * 10
    ) / 10,
  }
}

function balanceScore(teams: Team[]): number {
  let totalVariance = 0
  const avgKeys = ['avgPace','avgShooting','avgPassing','avgDribbling','avgDefending','avgPhysique','avgMorale'] as const
  for (const key of avgKeys) {
    const vals = teams.map((t) => t[key])
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    totalVariance += vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length
  }
  return Math.max(0, 1 - totalVariance / 10)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function makeSplit(players: Player[], id: number): SplitVariant {
  const s = shuffle(players)
  const n = Math.floor(s.length / 3)
  const NAMES = ['Team Alpha', 'Team Beta', 'Team Gamma']
  const teams: Team[] = [
    { name: NAMES[0], color: 'emerald', ...teamStats(s.slice(0, n)) },
    { name: NAMES[1], color: 'blue',    ...teamStats(s.slice(n, n * 2)) },
    { name: NAMES[2], color: 'violet',  ...teamStats(s.slice(n * 2)) },
  ]
  return { id, teams, balanceScore: balanceScore(teams) }
}

export const onRequestPost: PagesFunction = async (ctx) => {
  try {
    const { players } = await ctx.request.json() as { players: Player[] }
    if (!Array.isArray(players) || players.length !== 15) {
      return Response.json({ error: 'Expected exactly 15 players' }, { status: 400 })
    }
    const variants = Array.from({ length: 20 }, (_, i) => makeSplit(players, i))
    variants.sort((a, b) => b.balanceScore - a.balanceScore)
    const result: SplitResponse = { variants: variants.slice(0, 3).map((v, i) => ({ ...v, id: i })) }
    return Response.json(result)
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }
}
