import type { Player, Team, SplitVariant, SplitResponse } from '../../src/lib/types'

const STAT_KEYS = ['pace','shooting','passing','dribbling','defending','physique','morale'] as const
type StatKey = typeof STAT_KEYS[number]

const TEAM_DEFS = [
  { name: 'Orange', color: 'orange' },
  { name: 'Blue',   color: 'blue'   },
  { name: 'Green',  color: 'green'  },
] as const

function playerOverall(p: Player): number {
  return (p.pace + p.shooting + p.passing + p.dribbling + p.defending + p.physique + p.morale) / 7
}

function buildTeamStats(players: Player[], def: { name: string; color: string }): Team {
  const avg = (key: StatKey) =>
    Math.round((players.reduce((s, p) => s + p[key], 0) / players.length) * 10) / 10
  return {
    name: def.name,
    color: def.color,
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

// Sum of squared differences of per-stat averages across teams (lower = better)
function computeScore(sums: number[][], sizes: number[]): number {
  let total = 0
  for (let s = 0; s < 7; s++) {
    const avgs = sums.map((t, ti) => t[s] / sizes[ti])
    const mean = avgs.reduce((a, b) => a + b, 0) / 3
    for (const v of avgs) total += (v - mean) ** 2
  }
  return total
}

function snakeDraftInit(players: Player[]): number[][] {
  // Sort descending by overall, then snake-draft into 3 teams
  const sorted = [...players.map((_, i) => i)].sort(
    (a, b) => playerOverall(players[b]) - playerOverall(players[a])
  )
  const assignment = new Array<number>(players.length)
  // rounds: 0→[0,1,2], 1→[2,1,0], 2→[0,1,2], ...
  for (let i = 0; i < sorted.length; i++) {
    const round = Math.floor(i / 3)
    const pos = i % 3
    const team = round % 2 === 0 ? pos : 2 - pos
    assignment[sorted[i]] = team
  }
  return assignment as unknown as number[][]
}

function runSA(players: Player[]): { assignment: number[]; score: number } {
  const n = players.length

  // assignment[playerIdx] = teamIdx (0,1,2)
  const assignment: number[] = snakeDraftInit(players) as unknown as number[]

  // Compute actual team sizes (may be unequal when n % 3 !== 0)
  const teamSizes = [0, 0, 0]
  for (const t of assignment) teamSizes[t]++

  // Precompute stat sums per team
  const sums: number[][] = [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]]
  for (let i = 0; i < n; i++) {
    const t = assignment[i]
    for (let s = 0; s < 7; s++) sums[t][s] += players[i][STAT_KEYS[s]]
  }

  // teamSizes never change during SA (swaps exchange players between teams)
  let score = computeScore(sums, teamSizes)

  const T_START = 2.0
  const T_END = 0.01
  const ITERS = 3000
  const decay = Math.pow(T_END / T_START, 1 / ITERS)
  let T = T_START

  let bestAssignment = [...assignment]
  let bestScore = score

  for (let iter = 0; iter < ITERS; iter++) {
    // Pick two players from different teams
    const i = Math.floor(Math.random() * n)
    let j = Math.floor(Math.random() * n)
    while (assignment[i] === assignment[j]) j = Math.floor(Math.random() * n)

    const ti = assignment[i]
    const tj = assignment[j]

    // Compute delta score from swapping i and j
    // Remove both from their teams, add to the other
    for (let s = 0; s < 7; s++) {
      sums[ti][s] -= players[i][STAT_KEYS[s]]
      sums[ti][s] += players[j][STAT_KEYS[s]]
      sums[tj][s] -= players[j][STAT_KEYS[s]]
      sums[tj][s] += players[i][STAT_KEYS[s]]
    }
    const newScore = computeScore(sums, teamSizes)
    const delta = newScore - score

    if (delta < 0 || Math.random() < Math.exp(-delta / T)) {
      assignment[i] = tj
      assignment[j] = ti
      score = newScore
      if (score < bestScore) {
        bestScore = score
        bestAssignment = [...assignment]
      }
    } else {
      // Revert sums
      for (let s = 0; s < 7; s++) {
        sums[ti][s] += players[i][STAT_KEYS[s]]
        sums[ti][s] -= players[j][STAT_KEYS[s]]
        sums[tj][s] += players[j][STAT_KEYS[s]]
        sums[tj][s] -= players[i][STAT_KEYS[s]]
      }
    }

    T *= decay
  }

  return { assignment: bestAssignment, score: bestScore }
}

function assembleVariant(players: Player[], assignment: number[], score: number, id: number): SplitVariant {
  const groups: Player[][] = [[], [], []]
  for (let i = 0; i < players.length; i++) groups[assignment[i]].push(players[i])
  const teams = TEAM_DEFS.map((def, ti) => buildTeamStats(groups[ti], def))
  const balanceScore = 1 / (1 + score)
  return { id, teams, balanceScore }
}

export const onRequestPost: PagesFunction = async (ctx) => {
  try {
    const { players } = await ctx.request.json() as { players: Player[] }
    if (!Array.isArray(players) || players.length < 6) {
      return Response.json({ error: 'Need at least 6 players' }, { status: 400 })
    }

    const runs = [runSA(players), runSA(players), runSA(players)]
    runs.sort((a, b) => a.score - b.score)

    const variants = runs.map((r, i) => assembleVariant(players, r.assignment, r.score, i))
    const result: SplitResponse = { variants }
    return Response.json(result)
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }
}
