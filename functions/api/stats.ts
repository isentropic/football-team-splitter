import type { Env } from '../_lib/db'

function monthKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

type StatRow = { id: string; name: string; games_played: number; wins: number; draws: number; losses: number; pts: number; recent_count?: number }

function makeStatRow(id: string, name: string): StatRow {
  return { id, name, games_played: 0, wins: 0, draws: 0, losses: 0, pts: 0 }
}

function accumulateGame(
  map: Record<string, StatRow>,
  playerIds: string[],
  scored: boolean,  // true = team scored more
  drew: boolean,
) {
  for (const pid of playerIds) {
    if (!map[pid]) continue
    map[pid].games_played++
    if (scored)     { map[pid].wins++;   map[pid].pts += 3 }
    else if (drew)  { map[pid].draws++;  map[pid].pts += 1 }
    else              map[pid].losses++
  }
}

const RECENCY_MIN = 50

function sortByPPG(rows: StatRow[]): StatRow[] {
  return [...rows].sort((a, b) => {
    const ppgA = a.games_played > 0 ? a.pts / a.games_played : 0
    const ppgB = b.games_played > 0 ? b.pts / b.games_played : 0
    if (ppgB !== ppgA) return ppgB - ppgA
    if (b.pts !== a.pts) return b.pts - a.pts
    return b.games_played - a.games_played
  })
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const month = new URL(ctx.request.url).searchParams.get('month')

  const [{ results: sessions }, { results: allGames }, { results: players }] = await Promise.all([
    ctx.env.DB.prepare('SELECT id, teams FROM sessions').all(),
    ctx.env.DB.prepare('SELECT * FROM games ORDER BY played_at DESC, rowid DESC').all(),
    ctx.env.DB.prepare('SELECT id, name FROM players ORDER BY name ASC').all(),
  ])

  // Build color→playerIds map per session
  const sessionTeamMap: Record<string, Record<string, string[]>> = {}
  for (const s of sessions) {
    const teams = JSON.parse(s.teams as string) as { color: string; playerIds: string[] }[]
    const colorMap: Record<string, string[]> = {}
    for (const t of teams) colorMap[t.color] = t.playerIds
    sessionTeamMap[s.id as string] = colorMap
  }

  // Available months (always returned)
  const monthSet = new Set<string>()
  for (const g of allGames) monthSet.add(monthKey(g.played_at as number))
  const available_months = Array.from(monthSet).sort()

  // Player id→name lookup
  const playerNameMap: Record<string, string> = {}
  for (const p of players) playerNameMap[p.id as string] = p.name as string

  // Base statsMap (all players start at zero)
  const baseMap = (): Record<string, StatRow> => {
    const m: Record<string, StatRow> = {}
    for (const p of players) m[p.id as string] = makeStatRow(p.id as string, p.name as string)
    return m
  }

  let statsMap: Record<string, StatRow>
  let games: typeof allGames

  if (month) {
    // ── Monthly mode ────────────────────────────────────────────────────────
    games = allGames.filter((g) => monthKey(g.played_at as number) === month)
    statsMap = baseMap()

    for (const g of games) {
      const colorMap = sessionTeamMap[g.session_id as string]
      if (!colorMap) continue
      const t1 = colorMap[g.team1 as string] ?? []
      const t2 = colorMap[g.team2 as string] ?? []
      const s1 = g.score1 as number, s2 = g.score2 as number
      accumulateGame(statsMap, t1, s1 > s2, s1 === s2)
      accumulateGame(statsMap, t2, s2 > s1, s1 === s2)
    }
  } else {
    // ── Rolling mode ─────────────────────────────────────────────────────────
    // Score: last 50 games per player, newest-first.
    // rowid DESC in the SQL query ensures that within a session (same played_at),
    // later games in the session are prioritized over earlier ones.
    // Eligible: ≥ 50 recent games within the last 150 days.
    games = allGames
    statsMap = baseMap()

    const SCORE_WINDOW = 50
    const fiveMonthsAgo = Date.now() - 150 * 24 * 60 * 60 * 1000

    const playerScoreCount: Record<string, number> = {}
    const playerRecentCount: Record<string, number> = {}

    for (const g of allGames) {
      const colorMap = sessionTeamMap[g.session_id as string]
      if (!colorMap) continue
      const t1 = colorMap[g.team1 as string] ?? []
      const t2 = colorMap[g.team2 as string] ?? []
      const s1 = g.score1 as number
      const s2 = g.score2 as number
      const drew = s1 === s2
      const isRecent = (g.played_at as number) >= fiveMonthsAgo

      const accumulate = (pids: string[], won: boolean) => {
        for (const pid of pids) {
          if (!statsMap[pid]) continue
          if (isRecent) playerRecentCount[pid] = (playerRecentCount[pid] ?? 0) + 1
          if ((playerScoreCount[pid] ?? 0) < SCORE_WINDOW) {
            playerScoreCount[pid] = (playerScoreCount[pid] ?? 0) + 1
            statsMap[pid].games_played++
            if (won)       { statsMap[pid].wins++;   statsMap[pid].pts += 3 }
            else if (drew) { statsMap[pid].draws++;  statsMap[pid].pts += 1 }
            else             statsMap[pid].losses++
          }
        }
      }
      accumulate(t1, s1 > s2)
      accumulate(t2, s2 > s1)
    }

    // Attach recent_count; remove players with zero recent activity
    for (const id of Object.keys(statsMap)) {
      const rc = playerRecentCount[id] ?? 0
      if (rc === 0) {
        delete statsMap[id]
      } else {
        statsMap[id].recent_count = rc
      }
    }
  }

  let playerStats: StatRow[]
  if (month) {
    playerStats = sortByPPG(Object.values(statsMap))
  } else {
    const eligible = Object.values(statsMap).filter((p) => (p.recent_count ?? 0) >= RECENCY_MIN)
    const pending  = Object.values(statsMap).filter((p) => (p.recent_count ?? 0) < RECENCY_MIN)
    eligible.sort((a, b) => {
      const ppgA = a.games_played > 0 ? a.pts / a.games_played : 0
      const ppgB = b.games_played > 0 ? b.pts / b.games_played : 0
      if (ppgB !== ppgA) return ppgB - ppgA
      if (b.pts !== a.pts) return b.pts - a.pts
      return b.games_played - a.games_played
    })
    pending.sort((a, b) => (b.recent_count ?? 0) - (a.recent_count ?? 0))
    // Redact stats for pending players — only recent_count is real
    const redacted = pending.map(({ id, name, recent_count }) =>
      ({ id, name, games_played: 0, wins: 0, draws: 0, losses: 0, pts: 0, recent_count })
    )
    playerStats = [...eligible, ...redacted]
  }

  const recentGames = games.slice(0, 30).map((g) => {
    const colorMap = sessionTeamMap[g.session_id as string] ?? {}
    const team1Players = (colorMap[g.team1 as string] ?? []).map((id: string) => playerNameMap[id]).filter(Boolean)
    const team2Players = (colorMap[g.team2 as string] ?? []).map((id: string) => playerNameMap[id]).filter(Boolean)
    return { ...g, team1Players, team2Players }
  })

  return Response.json({ players: playerStats, recent_games: recentGames, available_months })
}
