import type { Player, Team, SplitVariant, SplitResponse } from '../../src/lib/types'
import type { Env } from '../_lib/db'

const STAT_KEYS = ['pace','shooting','passing','dribbling','defending','physique','morale'] as const
type StatKey = typeof STAT_KEYS[number]
type DbGame = {
  session_id: string
  team1: string
  team2: string
  score1: number
  score2: number
}
type DbSession = {
  id: string
  teams: string
}

const SCORE_WINDOW = 50
const MAX_PPG_RATING_ADJUSTMENT = 0.2
const PPG_MIDPOINT = 1.5
const PPG_HALF_RANGE = 0.5
const RECENT_TEAMMATE_SESSION_COUNT = 3
const RECENT_PAIR_PENALTY_WEIGHT = 0.35

const TEAM_DEFS = [
  { name: 'Orange', color: 'orange' },
  { name: 'Blue',   color: 'blue'   },
  { name: 'Green',  color: 'green'  },
  { name: 'White',  color: 'white'  },
] as const
type TeamDef = typeof TEAM_DEFS[number]

function playerOverall(p: Player): number {
  return (p.pace + p.shooting + p.passing + p.dribbling + p.defending + p.physique + p.morale) / 7
}

function clampRating(value: number): number {
  return Math.max(0, Math.min(10, value))
}

function ppgRatingAdjustment(ppg: number): number {
  const normalized = Math.max(-1, Math.min(1, (ppg - PPG_MIDPOINT) / PPG_HALF_RANGE))
  return normalized * MAX_PPG_RATING_ADJUSTMENT
}

function adjustPlayerByPpg(player: Player, ppg?: number): Player {
  if (ppg === undefined) return player
  const adjustment = ppgRatingAdjustment(ppg)
  if (adjustment === 0) return player
  return STAT_KEYS.reduce((next, key) => {
    next[key] = clampRating(player[key] + adjustment)
    return next
  }, { ...player } as Player)
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

function parseSessionTeams(session: DbSession): Record<string, string[]> {
  const teams = JSON.parse(session.teams) as { color: string; playerIds: string[] }[]
  const colorMap: Record<string, string[]> = {}
  for (const team of teams) colorMap[team.color] = team.playerIds
  return colorMap
}

async function loadPlayerPpg(db: D1Database, selectedIds: Set<string>): Promise<Record<string, number>> {
  const [{ results: sessions }, { results: games }] = await Promise.all([
    db.prepare('SELECT id, teams FROM sessions').all<DbSession>(),
    db.prepare('SELECT * FROM games ORDER BY played_at DESC, rowid DESC').all<DbGame>(),
  ])

  const sessionTeamMap: Record<string, Record<string, string[]>> = {}
  for (const session of sessions) sessionTeamMap[session.id] = parseSessionTeams(session)

  const counts: Record<string, number> = {}
  const points: Record<string, number> = {}
  for (const id of selectedIds) {
    counts[id] = 0
    points[id] = 0
  }

  for (const game of games) {
    const colorMap = sessionTeamMap[game.session_id]
    if (!colorMap) continue
    const score1 = game.score1
    const score2 = game.score2
    const pts1 = score1 > score2 ? 3 : score1 === score2 ? 1 : 0
    const pts2 = score2 > score1 ? 3 : score1 === score2 ? 1 : 0

    const accumulate = (playerIds: string[], pts: number) => {
      for (const id of playerIds) {
        if (!selectedIds.has(id) || counts[id] >= SCORE_WINDOW) continue
        counts[id] += 1
        points[id] += pts
      }
    }

    accumulate(colorMap[game.team1] ?? [], pts1)
    accumulate(colorMap[game.team2] ?? [], pts2)
  }

  const ppgByPlayer: Record<string, number> = {}
  for (const id of selectedIds) {
    if (counts[id] > 0) ppgByPlayer[id] = points[id] / counts[id]
  }
  return ppgByPlayer
}

async function loadRecentTeammatePairs(db: D1Database, selectedIds: Set<string>): Promise<Map<string, number>> {
  const { results: sessions } = await db
    .prepare(`SELECT id, teams FROM sessions ORDER BY played_at DESC LIMIT ${RECENT_TEAMMATE_SESSION_COUNT}`)
    .all<DbSession>()
  const penalties = new Map<string, number>()

  for (const session of sessions) {
    const colorMap = parseSessionTeams(session)
    for (const playerIds of Object.values(colorMap)) {
      const selectedTeamIds = playerIds.filter((id) => selectedIds.has(id))
      for (let i = 0; i < selectedTeamIds.length; i++) {
        for (let j = i + 1; j < selectedTeamIds.length; j++) {
          const key = pairKey(selectedTeamIds[i], selectedTeamIds[j])
          penalties.set(key, (penalties.get(key) ?? 0) + 1)
        }
      }
    }
  }

  return penalties
}

function buildTeamStats(players: Player[], def: TeamDef): Team {
  const avg = (key: StatKey) =>
    players.length === 0
      ? 0
      : Math.round((players.reduce((s, p) => s + p[key], 0) / players.length) * 10) / 10
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
    const mean = avgs.reduce((a, b) => a + b, 0) / avgs.length
    for (const v of avgs) total += (v - mean) ** 2
  }
  return total
}

function computeRecentPairPenalty(
  players: Player[],
  assignment: number[],
  teamCount: number,
  recentTeammatePairs: Map<string, number>,
): number {
  if (recentTeammatePairs.size === 0) return 0

  let penalty = 0
  for (let teamIdx = 0; teamIdx < teamCount; teamIdx++) {
    const teamPlayers = players.filter((_, playerIdx) => assignment[playerIdx] === teamIdx)
    for (let i = 0; i < teamPlayers.length; i++) {
      for (let j = i + 1; j < teamPlayers.length; j++) {
        penalty += recentTeammatePairs.get(pairKey(teamPlayers[i].id, teamPlayers[j].id)) ?? 0
      }
    }
  }

  return penalty * RECENT_PAIR_PENALTY_WEIGHT
}

function assignmentScore(
  players: Player[],
  assignment: number[],
  sums: number[][],
  sizes: number[],
  recentTeammatePairs: Map<string, number>,
): number {
  return computeScore(sums, sizes) + computeRecentPairPenalty(players, assignment, sizes.length, recentTeammatePairs)
}

function targetSizes(playerCount: number, teamCount: number, minimums = Array(teamCount).fill(0) as number[]): number[] {
  const base = Math.floor(playerCount / teamCount)
  const extra = playerCount % teamCount
  const targets = Array.from({ length: teamCount }, (_, i) => Math.max(minimums[i], base + (i < extra ? 1 : 0)))

  while (targets.reduce((sum, size) => sum + size, 0) > playerCount) {
    let idx = -1
    for (let i = 0; i < teamCount; i++) {
      if (targets[i] > minimums[i] && targets[i] > 1 && (idx === -1 || targets[i] > targets[idx])) idx = i
    }
    if (idx === -1) throw new Error('Fixed players make an even split impossible')
    targets[idx]--
  }

  while (targets.reduce((sum, size) => sum + size, 0) < playerCount) {
    let idx = 0
    for (let i = 1; i < teamCount; i++) {
      if (targets[i] < targets[idx]) idx = i
    }
    targets[idx]++
  }

  return targets
}

function snakeDraftInit(
  players: Player[],
  teamDefs: readonly TeamDef[],
  locks: Record<string, string>,
): number[] {
  const teamCount = teamDefs.length
  const lockedCounts = Array(teamCount).fill(0) as number[]
  for (const player of players) {
    const lockedColor = locks[player.id]
    if (!lockedColor) continue
    const teamIdx = teamDefs.findIndex((t) => t.color === lockedColor)
    if (teamIdx === -1) throw new Error(`Unknown fixed team: ${lockedColor}`)
    lockedCounts[teamIdx]++
  }

  const targets = targetSizes(players.length, teamCount, lockedCounts)
  const counts = Array(teamCount).fill(0) as number[]
  const assignment = Array(players.length).fill(-1) as number[]

  for (let i = 0; i < players.length; i++) {
    const lockedColor = locks[players[i].id]
    if (!lockedColor) continue
    const teamIdx = teamDefs.findIndex((t) => t.color === lockedColor)
    if (teamIdx === -1) throw new Error(`Unknown fixed team: ${lockedColor}`)
    if (counts[teamIdx] >= targets[teamIdx]) {
      throw new Error(`Too many fixed players for ${lockedColor}`)
    }
    assignment[i] = teamIdx
    counts[teamIdx]++
  }

  // Sort descending by overall, then snake-draft movable players into open slots.
  const sorted = players.map((_, i) => i).filter((i) => assignment[i] === -1).sort(
    (a, b) => playerOverall(players[b]) - playerOverall(players[a])
  )
  for (let i = 0; i < sorted.length; i++) {
    const round = Math.floor(i / teamCount)
    const order = Array.from({ length: teamCount }, (_, idx) => idx)
    if (round % 2 === 1) order.reverse()
    const team = order.find((idx) => counts[idx] < targets[idx])
    if (team === undefined) throw new Error('Could not assign all players')
    assignment[sorted[i]] = team
    counts[team]++
  }
  return assignment
}

function runSA(
  players: Player[],
  teamDefs: readonly TeamDef[],
  locks: Record<string, string>,
  recentTeammatePairs: Map<string, number>,
): { assignment: number[]; score: number } {
  const n = players.length
  const teamCount = teamDefs.length
  const lockedPlayerIds = new Set(Object.keys(locks))

  // assignment[playerIdx] = teamIdx
  const assignment = snakeDraftInit(players, teamDefs, locks)

  const teamSizes = Array(teamCount).fill(0) as number[]
  for (const t of assignment) teamSizes[t]++

  // Precompute stat sums per team
  const sums = Array.from({ length: teamCount }, () => Array(7).fill(0) as number[])
  for (let i = 0; i < n; i++) {
    const t = assignment[i]
    for (let s = 0; s < 7; s++) sums[t][s] += players[i][STAT_KEYS[s]]
  }

  // teamSizes never change during SA (swaps exchange players between teams)
  let score = assignmentScore(players, assignment, sums, teamSizes, recentTeammatePairs)

  const T_START = 2.0
  const T_END = 0.01
  const ITERS = 3000
  const decay = Math.pow(T_END / T_START, 1 / ITERS)
  let T = T_START

  let bestAssignment = [...assignment]
  let bestScore = score
  const movable = players.map((_, i) => i).filter((i) => !lockedPlayerIds.has(players[i].id))

  for (let iter = 0; iter < ITERS; iter++) {
    if (movable.length < 2) break

    // Pick two players from different teams
    const i = movable[Math.floor(Math.random() * movable.length)]
    let j = movable[Math.floor(Math.random() * movable.length)]
    let guard = 0
    while (assignment[i] === assignment[j] && guard < 20) {
      j = movable[Math.floor(Math.random() * movable.length)]
      guard++
    }
    if (assignment[i] === assignment[j]) continue

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
    assignment[i] = tj
    assignment[j] = ti
    const newScore = assignmentScore(players, assignment, sums, teamSizes, recentTeammatePairs)
    const delta = newScore - score

    if (delta < 0 || Math.random() < Math.exp(-delta / T)) {
      score = newScore
      if (score < bestScore) {
        bestScore = score
        bestAssignment = [...assignment]
      }
    } else {
      assignment[i] = ti
      assignment[j] = tj
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

function assembleVariant(
  players: Player[],
  assignment: number[],
  score: number,
  id: number,
  teamDefs: readonly TeamDef[],
  recentTeammatePairs: Map<string, number>,
): SplitVariant {
  const groups = Array.from({ length: teamDefs.length }, () => [] as Player[])
  for (let i = 0; i < players.length; i++) groups[assignment[i]].push(players[i])
  const teams = teamDefs.map((def, ti) => buildTeamStats(groups[ti], def))
  const balanceScore = 1 / (1 + score)
  return { id, teams, balanceScore, recentTeammatePairs: Object.fromEntries(recentTeammatePairs) }
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { players, locks = {} } = await ctx.request.json() as {
      players: Player[]
      locks?: Record<string, string>
    }
    if (!Array.isArray(players) || players.length < 6) {
      return Response.json({ error: 'Need at least 6 players' }, { status: 400 })
    }

    const teamDefs = TEAM_DEFS.slice(0, players.length >= 20 ? 4 : 3)
    const playerIds = new Set(players.map((p) => p.id))
    const validColors = new Set(teamDefs.map((t) => t.color))
    const normalizedLocks = Object.fromEntries(
      Object.entries(locks).filter(([id, color]) => playerIds.has(id) && validColors.has(color))
    )
    const [ppgByPlayer, recentTeammatePairs] = await Promise.all([
      loadPlayerPpg(ctx.env.DB, playerIds),
      loadRecentTeammatePairs(ctx.env.DB, playerIds),
    ])
    const effectivePlayers = players.map((player) => adjustPlayerByPpg(player, ppgByPlayer[player.id]))

    const runs = [
      runSA(effectivePlayers, teamDefs, normalizedLocks, recentTeammatePairs),
      runSA(effectivePlayers, teamDefs, normalizedLocks, recentTeammatePairs),
      runSA(effectivePlayers, teamDefs, normalizedLocks, recentTeammatePairs),
    ]
    runs.sort((a, b) => a.score - b.score)

    const variants = runs.map((r, i) => assembleVariant(effectivePlayers, r.assignment, r.score, i, teamDefs, recentTeammatePairs))
    const result: SplitResponse = { variants }
    return Response.json(result)
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid request' }, { status: 400 })
  }
}
