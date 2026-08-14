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
const VARIANT_COUNT = 5
const SEARCH_RUN_COUNT = 40
const POSITION_DISTRIBUTION_WEIGHT = 0.08

const TEAM_DEFS = [
  { name: 'Orange', color: 'orange' },
  { name: 'Blue',   color: 'blue'   },
  { name: 'Green',  color: 'green'  },
  { name: 'White',  color: 'white'  },
] as const
type TeamDef = typeof TEAM_DEFS[number]
type Position = 'attack' | 'defense' | 'both'
type Random = () => number

function hashSeed(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededRandom(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

// Temporary player-position source. Everyone is flexible until the community
// labels are added; keeping this map here lets us evaluate the new algorithm
// without changing the production player schema first.
const POSITION_BY_PLAYER_NAME: Record<string, Position> = {
  'Abylay': 'attack',
  'Adai': 'attack',
  'Aidar Sattarov': 'both',
  'Aidyn': 'both',
  'Alikhan': 'attack',
  'Alisher K.': 'defense',
  'Alisher S.': 'attack',
  'Alisheri': 'defense',
  'Almas A.': 'attack',
  'Almas S.': 'attack',
  'Argen T.': 'defense',
  'Argo': 'both',
  'Askar': 'attack',
  'Asmir': 'defense',
  'Azamatbek': 'attack',
  'Azat': 'attack',
  'Azizbek': 'defense',
  'Batyrbek': 'attack',
  'Baurzhan': 'defense',
  'Bayram': 'attack',
  'Bekatan': 'attack',
  'Beksultan': 'both',
  'Dauren L.': 'attack',
  'Dosbol': 'attack',
  'Ghayrat': 'attack',
  'Ilias': 'both',
  'Islambek': 'defense',
  'Issabek': 'defense',
  'Jahongir': 'both',
  'Kairat': 'defense',
  'Kanye': 'defense',
  'Manas': 'both',
  'Mubbarrat': 'defense',
  'Muhammadjon': 'defense',
  'Murat': 'attack',
  'Muzzaffarjon': 'defense',
  'San': 'defense',
  'Sanzhar': 'defense',
  'Tairali': 'defense',
  'Temirlan D.': 'defense',
  'Tynychbek': 'attack',
  'Ulanbek': 'defense',
  'Yelnur': 'attack',
  'Yerlen': 'attack',
  'Yersultan': 'both',
  'Yerzhan': 'defense',
  'Zakirbek': 'attack',
  'Zhamin': 'both',
  'Zhanibek': 'defense',
  'Zhantore': 'both',
}

function playerPosition(player: Player): Position {
  return POSITION_BY_PLAYER_NAME[player.name] ?? 'both'
}

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

function buildTeamStats(players: Player[], def: TeamDef, includePositionCounts = false): Team {
  const avg = (key: StatKey) =>
    players.length === 0
      ? 0
      : Math.round((players.reduce((s, p) => s + p[key], 0) / players.length) * 10) / 10
  const team: Team = {
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
  if (includePositionCounts) {
    team.positionCounts = { attack: 0, defense: 0, both: 0 }
    for (const player of players) team.positionCounts[playerPosition(player)]++
  }
  return team
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

function computeOverallScore(overallSums: number[], sizes: number[]): number {
  const averages = overallSums.map((sum, index) => sum / sizes[index])
  const mean = averages.reduce((sum, value) => sum + value, 0) / averages.length
  return averages.reduce((total, value) => total + (value - mean) ** 2, 0)
}

function computePositionDistributionPenalty(players: Player[], assignment: number[], teamCount: number): number {
  let total = 0
  for (const position of ['attack', 'defense', 'both'] as const) {
    const counts = Array(teamCount).fill(0) as number[]
    for (let index = 0; index < players.length; index++) {
      if (playerPosition(players[index]) === position) counts[assignment[index]]++
    }
    const mean = counts.reduce((sum, count) => sum + count, 0) / teamCount
    for (const count of counts) total += (count - mean) ** 2
  }
  return total * POSITION_DISTRIBUTION_WEIGHT
}

function overallPositionScore(
  players: Player[],
  assignment: number[],
  overallSums: number[],
  sizes: number[],
  recentTeammatePairs: Map<string, number>,
): number {
  return computeOverallScore(overallSums, sizes)
    + computePositionDistributionPenalty(players, assignment, sizes.length)
    + computeRecentPairPenalty(players, assignment, sizes.length, recentTeammatePairs)
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

function separationDraftInit(
  players: Player[],
  teamDefs: readonly TeamDef[],
  separationGroups: number[][],
): number[] {
  const teamCount = teamDefs.length
  const targets = targetSizes(players.length, teamCount)
  const counts = Array(teamCount).fill(0) as number[]
  const overallSums = Array(teamCount).fill(0) as number[]
  const assignment = Array(players.length).fill(-1) as number[]

  // Place members of each separation group on distinct teams before filling
  // open slots. Larger groups go first so they always have enough teams.
  const groupedPlayers = new Set<number>()
  const groups = [...separationGroups].sort((a, b) => b.length - a.length)
  for (const group of groups) {
    const usedTeams = new Set<number>()
    const sortedGroup = [...group].sort((a, b) => playerOverall(players[b]) - playerOverall(players[a]))
    for (const playerIndex of sortedGroup) {
      const candidates = Array.from({ length: teamCount }, (_, teamIndex) => teamIndex)
        .filter((teamIndex) => counts[teamIndex] < targets[teamIndex] && !usedTeams.has(teamIndex))
        .sort((a, b) => counts[a] - counts[b] || overallSums[a] - overallSums[b] || a - b)
      const team = candidates[0]
      if (team === undefined) {
        throw new Error('A separation group cannot fit into the available teams')
      }
      assignment[playerIndex] = team
      counts[team]++
      overallSums[team] += playerOverall(players[playerIndex])
      usedTeams.add(team)
      groupedPlayers.add(playerIndex)
    }
  }

  // Sort descending by overall, then snake-draft all remaining players into open slots.
  const sorted = players.map((_, i) => i).filter((i) => !groupedPlayers.has(i)).sort(
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

function respectsSeparationGroups(assignment: number[], separationGroups: number[][]): boolean {
  return separationGroups.every((group) => {
    const teamIds = new Set(group.map((playerIndex) => assignment[playerIndex]))
    return teamIds.size === group.length
  })
}

function randomizeAssignment(
  assignment: number[],
  separationGroups: number[][],
  random: Random,
): void {
  const attempts = assignment.length * 12
  for (let attempt = 0; attempt < attempts; attempt++) {
    const first = Math.floor(random() * assignment.length)
    const second = Math.floor(random() * assignment.length)
    if (first === second || assignment[first] === assignment[second]) continue

    const firstTeam = assignment[first]
    assignment[first] = assignment[second]
    assignment[second] = firstTeam
    if (!respectsSeparationGroups(assignment, separationGroups)) {
      assignment[second] = assignment[first]
      assignment[first] = firstTeam
    }
  }
}

function runSA(
  players: Player[],
  teamDefs: readonly TeamDef[],
  separationGroups: number[][],
  recentTeammatePairs: Map<string, number>,
  random: Random,
): { assignment: number[]; score: number } {
  const n = players.length
  const teamCount = teamDefs.length

  // assignment[playerIdx] = teamIdx
  const assignment = separationDraftInit(players, teamDefs, separationGroups)
  randomizeAssignment(assignment, separationGroups, random)

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
  const movable = players.map((_, i) => i)

  for (let iter = 0; iter < ITERS; iter++) {
    if (movable.length < 2) break

    // Pick two players from different teams
    const i = movable[Math.floor(random() * movable.length)]
    let j = movable[Math.floor(random() * movable.length)]
    let guard = 0
    while (assignment[i] === assignment[j] && guard < 20) {
      j = movable[Math.floor(random() * movable.length)]
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
    if (!respectsSeparationGroups(assignment, separationGroups)) {
      assignment[i] = ti
      assignment[j] = tj
      for (let s = 0; s < 7; s++) {
        sums[ti][s] += players[i][STAT_KEYS[s]]
        sums[ti][s] -= players[j][STAT_KEYS[s]]
        sums[tj][s] += players[j][STAT_KEYS[s]]
        sums[tj][s] -= players[i][STAT_KEYS[s]]
      }
      T *= decay
      continue
    }
    const newScore = assignmentScore(players, assignment, sums, teamSizes, recentTeammatePairs)
    const delta = newScore - score

    if (delta < 0 || random() < Math.exp(-delta / T)) {
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

function runOverallPositionSA(
  players: Player[],
  teamDefs: readonly TeamDef[],
  separationGroups: number[][],
  recentTeammatePairs: Map<string, number>,
  random: Random,
): { assignment: number[]; score: number } {
  const teamCount = teamDefs.length
  const assignment = separationDraftInit(players, teamDefs, separationGroups)
  randomizeAssignment(assignment, separationGroups, random)
  const teamSizes = Array(teamCount).fill(0) as number[]
  const overallSums = Array(teamCount).fill(0) as number[]

  for (let index = 0; index < players.length; index++) {
    const team = assignment[index]
    teamSizes[team]++
    overallSums[team] += playerOverall(players[index])
  }

  let score = overallPositionScore(players, assignment, overallSums, teamSizes, recentTeammatePairs)
  const T_START = 2.0
  const T_END = 0.01
  const ITERS = 3000
  const decay = Math.pow(T_END / T_START, 1 / ITERS)
  let temperature = T_START
  let bestAssignment = [...assignment]
  let bestScore = score
  const movable = players.map((_, index) => index)

  for (let iteration = 0; iteration < ITERS; iteration++) {
    if (movable.length < 2) break

    const first = movable[Math.floor(random() * movable.length)]
    let second = movable[Math.floor(random() * movable.length)]
    let guard = 0
    while (assignment[first] === assignment[second] && guard < 20) {
      second = movable[Math.floor(random() * movable.length)]
      guard++
    }
    if (assignment[first] === assignment[second]) continue

    const firstTeam = assignment[first]
    const secondTeam = assignment[second]
    overallSums[firstTeam] += playerOverall(players[second]) - playerOverall(players[first])
    overallSums[secondTeam] += playerOverall(players[first]) - playerOverall(players[second])
    assignment[first] = secondTeam
    assignment[second] = firstTeam
    if (!respectsSeparationGroups(assignment, separationGroups)) {
      assignment[first] = firstTeam
      assignment[second] = secondTeam
      overallSums[firstTeam] += playerOverall(players[first]) - playerOverall(players[second])
      overallSums[secondTeam] += playerOverall(players[second]) - playerOverall(players[first])
      temperature *= decay
      continue
    }

    const nextScore = overallPositionScore(players, assignment, overallSums, teamSizes, recentTeammatePairs)
    const delta = nextScore - score
    if (delta < 0 || random() < Math.exp(-delta / temperature)) {
      score = nextScore
      if (score < bestScore) {
        bestScore = score
        bestAssignment = [...assignment]
      }
    } else {
      assignment[first] = firstTeam
      assignment[second] = secondTeam
      overallSums[firstTeam] += playerOverall(players[first]) - playerOverall(players[second])
      overallSums[secondTeam] += playerOverall(players[second]) - playerOverall(players[first])
    }

    temperature *= decay
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
  includePositionCounts = false,
): SplitVariant {
  const groups = Array.from({ length: teamDefs.length }, () => [] as Player[])
  for (let i = 0; i < players.length; i++) groups[assignment[i]].push(players[i])
  const teams = teamDefs.map((def, ti) => buildTeamStats(groups[ti], def, includePositionCounts))
  const balanceScore = 1 / (1 + score)
  return { id, teams, balanceScore, recentTeammatePairs: Object.fromEntries(recentTeammatePairs) }
}

// Team colors and display order do not make a different split. Sort player IDs
// within each group, then sort the groups themselves, to compare partitions.
function partitionKey(players: Player[], assignment: number[], teamCount: number): string {
  const groups = Array.from({ length: teamCount }, () => [] as string[])
  for (let i = 0; i < players.length; i++) groups[assignment[i]].push(players[i].id)
  return groups.map((group) => group.sort().join(',')).sort().join('|')
}

type SplitRun = { assignment: number[]; score: number }

function uniqueSplitRuns(
  players: Player[],
  teamCount: number,
  seed: number,
  createRun: (random: Random) => SplitRun,
): SplitRun[] {
  const uniqueRuns = new Map<string, SplitRun>()
  for (let attempt = 0; attempt < SEARCH_RUN_COUNT; attempt++) {
    const random = seededRandom((seed + Math.imul(attempt + 1, 0x9E3779B1)) >>> 0)
    const run = createRun(random)
    const key = partitionKey(players, run.assignment, teamCount)
    const existing = uniqueRuns.get(key)
    if (!existing || run.score < existing.score) uniqueRuns.set(key, run)
  }
  return [...uniqueRuns.entries()]
    .sort(([keyA, runA], [keyB, runB]) => runA.score - runB.score || keyA.localeCompare(keyB))
    .slice(0, VARIANT_COUNT)
    .map(([, run]) => run)
}

function insertTopRun(
  topRuns: Array<{ key: string; run: SplitRun }>,
  players: Player[],
  teamCount: number,
  run: SplitRun,
): void {
  const key = partitionKey(players, run.assignment, teamCount)
  if (topRuns.some((candidate) => candidate.key === key)) return
  topRuns.push({ key, run: { assignment: [...run.assignment], score: run.score } })
  topRuns.sort((a, b) => a.run.score - b.run.score || a.key.localeCompare(b.key))
  if (topRuns.length > VARIANT_COUNT) topRuns.pop()
}

function forEachCombination(
  values: number[],
  count: number,
  visit: (combination: number[]) => void,
): void {
  const combination: number[] = []
  const choose = (start: number) => {
    if (combination.length === count) {
      visit([...combination])
      return
    }
    const remainingNeeded = count - combination.length
    for (let index = start; index <= values.length - remainingNeeded; index++) {
      combination.push(values[index])
      choose(index + 1)
      combination.pop()
    }
  }
  choose(0)
}

// Five-a-side partitions for two and three teams are small enough to score
// completely. Forcing each next team to contain the lowest remaining player
// removes equivalent team-order permutations from the enumeration.
function exhaustiveFiveAsideRuns(
  players: Player[],
  teamCount: number,
  separationGroups: number[][],
  recentTeammatePairs: Map<string, number>,
): { attributeRuns: SplitRun[]; positionRuns: SplitRun[] } {
  const teamSize = players.length / teamCount
  const assignment = Array(players.length).fill(-1) as number[]
  const attributeRuns: Array<{ key: string; run: SplitRun }> = []
  const positionRuns: Array<{ key: string; run: SplitRun }> = []

  const scoreAssignment = () => {
    if (!respectsSeparationGroups(assignment, separationGroups)) return

    const sizes = Array(teamCount).fill(0) as number[]
    const sums = Array.from({ length: teamCount }, () => Array(STAT_KEYS.length).fill(0) as number[])
    const overallSums = Array(teamCount).fill(0) as number[]
    for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
      const teamIndex = assignment[playerIndex]
      sizes[teamIndex]++
      overallSums[teamIndex] += playerOverall(players[playerIndex])
      for (let statIndex = 0; statIndex < STAT_KEYS.length; statIndex++) {
        sums[teamIndex][statIndex] += players[playerIndex][STAT_KEYS[statIndex]]
      }
    }

    insertTopRun(attributeRuns, players, teamCount, {
      assignment,
      score: assignmentScore(players, assignment, sums, sizes, recentTeammatePairs),
    })
    insertTopRun(positionRuns, players, teamCount, {
      assignment,
      score: overallPositionScore(players, assignment, overallSums, sizes, recentTeammatePairs),
    })
  }

  const assignNextTeam = (teamIndex: number, remaining: number[]) => {
    if (teamIndex === teamCount - 1) {
      for (const playerIndex of remaining) assignment[playerIndex] = teamIndex
      scoreAssignment()
      for (const playerIndex of remaining) assignment[playerIndex] = -1
      return
    }

    const requiredPlayer = remaining[0]
    forEachCombination(remaining.slice(1), teamSize - 1, (additionalPlayers) => {
      const members = [requiredPlayer, ...additionalPlayers]
      const memberSet = new Set(members)
      for (const playerIndex of members) assignment[playerIndex] = teamIndex
      assignNextTeam(teamIndex + 1, remaining.filter((playerIndex) => !memberSet.has(playerIndex)))
      for (const playerIndex of members) assignment[playerIndex] = -1
    })
  }

  assignNextTeam(0, players.map((_, index) => index))
  return {
    attributeRuns: attributeRuns.map(({ run }) => run),
    positionRuns: positionRuns.map(({ run }) => run),
  }
}

function normalizeSeparationGroups(
  rawGroups: unknown,
  selectedPlayerIds: Set<string>,
  teamCount: number,
): string[][] {
  if (rawGroups === undefined) return []
  if (!Array.isArray(rawGroups)) throw new Error('Separation groups must be a list')

  const usedPlayerIds = new Set<string>()
  const groups: string[][] = []
  for (const rawGroup of rawGroups) {
    if (!Array.isArray(rawGroup)) throw new Error('Each separation group must be a list of players')
    const group = [...new Set(rawGroup.filter((id): id is string => typeof id === 'string'))]
    if (group.length < 2) continue
    if (group.length > teamCount) {
      throw new Error(`A separation group can contain at most ${teamCount} players`)
    }
    for (const playerId of group) {
      if (!selectedPlayerIds.has(playerId)) throw new Error('A separation-group player is not selected')
      if (usedPlayerIds.has(playerId)) throw new Error('A player can only belong to one separation group')
      usedPlayerIds.add(playerId)
    }
    groups.push(group)
  }
  return groups
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { players, separationGroups } = await ctx.request.json() as {
      players: Player[]
      separationGroups?: unknown
    }
    if (!Array.isArray(players) || players.length < 6) {
      return Response.json({ error: 'Need at least 6 players' }, { status: 400 })
    }

    const teamCount = players.length >= 20 ? 4 : players.length >= 15 ? 3 : 2
    const teamDefs = TEAM_DEFS.slice(0, teamCount)
    const playerIds = new Set(players.map((p) => p.id))
    const normalizedGroups = normalizeSeparationGroups(separationGroups, playerIds, teamDefs.length)
    const playerIndexById = new Map(players.map((player, index) => [player.id, index]))
    const separationGroupIndexes = normalizedGroups.map((group) =>
      group.map((playerId) => playerIndexById.get(playerId)!)
    )
    const [ppgByPlayer, recentTeammatePairs] = await Promise.all([
      loadPlayerPpg(ctx.env.DB, playerIds),
      loadRecentTeammatePairs(ctx.env.DB, playerIds),
    ])
    const effectivePlayers = players.map((player) => adjustPlayerByPpg(player, ppgByPlayer[player.id]))
    const requestSeed = hashSeed(JSON.stringify({
      players: [...playerIds].sort(),
      separationGroups: normalizedGroups.map((group) => [...group].sort()).sort(),
    }))

    let runs: SplitRun[]
    let positionRuns: SplitRun[]
    if (teamCount <= 3 && effectivePlayers.length === teamCount * 5) {
      const exhaustiveRuns = exhaustiveFiveAsideRuns(
        effectivePlayers,
        teamCount,
        separationGroupIndexes,
        recentTeammatePairs,
      )
      runs = exhaustiveRuns.attributeRuns
      positionRuns = exhaustiveRuns.positionRuns
    } else {
      runs = uniqueSplitRuns(
        effectivePlayers,
        teamCount,
        hashSeed(`${requestSeed}:attributes`),
        (random) => runSA(effectivePlayers, teamDefs, separationGroupIndexes, recentTeammatePairs, random),
      )
      positionRuns = uniqueSplitRuns(
        effectivePlayers,
        teamCount,
        hashSeed(`${requestSeed}:positions`),
        (random) => runOverallPositionSA(effectivePlayers, teamDefs, separationGroupIndexes, recentTeammatePairs, random),
      )
    }

    const variants = runs.map((run, index) =>
      assembleVariant(effectivePlayers, run.assignment, run.score, index, teamDefs, recentTeammatePairs)
    )
    const positionVariants = positionRuns.map((run, index) =>
      assembleVariant(effectivePlayers, run.assignment, run.score, index, teamDefs, recentTeammatePairs, true)
    )
    const result: SplitResponse = { variants, positionVariants }
    return Response.json(result)
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid request' }, { status: 400 })
  }
}
