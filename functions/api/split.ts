import type { Player, Team, SplitVariant, SplitResponse } from '../../src/lib/types'

function teamStats(players: Player[]): Omit<Team, 'name' | 'color'> {
  const avg = (key: keyof Player) =>
    Math.round((players.reduce((s, p) => s + (p[key] as number), 0) / players.length) * 10) / 10

  return {
    players,
    avgAttack: avg('attack'),
    avgDefense: avg('defense'),
    avgPhysical: avg('physical'),
    avgMorale: avg('morale'),
    avgOverall: Math.round(((avg('attack') + avg('defense') + avg('physical') + avg('morale')) / 4) * 10) / 10,
  }
}

function balanceScore(teams: Team[]): number {
  const stats: Array<keyof Pick<Team, 'avgAttack' | 'avgDefense' | 'avgPhysical' | 'avgMorale'>> =
    ['avgAttack', 'avgDefense', 'avgPhysical', 'avgMorale']

  let totalVariance = 0
  for (const stat of stats) {
    const vals = teams.map((t) => t[stat])
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    totalVariance += vals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / vals.length
  }

  // Lower variance = higher score (max 1.0)
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
  const shuffled = shuffle(players)
  const size = Math.floor(shuffled.length / 3)

  const NAMES = ['Team Alpha', 'Team Beta', 'Team Gamma']
  const teams: Team[] = [
    { name: NAMES[0], color: 'emerald', ...teamStats(shuffled.slice(0, size)) },
    { name: NAMES[1], color: 'blue', ...teamStats(shuffled.slice(size, size * 2)) },
    { name: NAMES[2], color: 'violet', ...teamStats(shuffled.slice(size * 2)) },
  ]

  return { id, teams, balanceScore: balanceScore(teams) }
}

export const onRequestPost: PagesFunction = async (context) => {
  try {
    const body = await context.request.json() as { players: Player[] }
    const { players } = body

    if (!Array.isArray(players) || players.length !== 15) {
      return Response.json({ error: 'Expected exactly 15 players' }, { status: 400 })
    }

    // Generate 20 random splits, return the top 3 by balance score
    const variants = Array.from({ length: 20 }, (_, i) => makeSplit(players, i))
    variants.sort((a, b) => b.balanceScore - a.balanceScore)

    const result: SplitResponse = { variants: variants.slice(0, 3).map((v, i) => ({ ...v, id: i })) }
    return Response.json(result)
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }
}
