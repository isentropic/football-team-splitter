import type { Env } from '../_lib/db'

function monthKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const month = new URL(ctx.request.url).searchParams.get('month') // "YYYY-MM" or null

  const [{ results: sessions }, { results: allGames }, { results: players }] = await Promise.all([
    ctx.env.DB.prepare('SELECT id, teams FROM sessions').all(),
    ctx.env.DB.prepare('SELECT * FROM games ORDER BY played_at DESC').all(),
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

  // Compute available months from all games
  const monthSet = new Set<string>()
  for (const g of allGames) monthSet.add(monthKey(g.played_at as number))
  const available_months = Array.from(monthSet).sort()

  // Filter games by month if requested
  const games = month
    ? allGames.filter((g) => monthKey(g.played_at as number) === month)
    : allGames

  // Accumulate per-player stats (W=3pts, D=1pt, L=0pts)
  const statsMap: Record<string, { id: string; name: string; games_played: number; wins: number; draws: number; losses: number; pts: number }> = {}
  for (const p of players) {
    statsMap[p.id as string] = { id: p.id as string, name: p.name as string, games_played: 0, wins: 0, draws: 0, losses: 0, pts: 0 }
  }

  for (const g of games) {
    const colorMap = sessionTeamMap[g.session_id as string]
    if (!colorMap) continue
    const team1Ids = colorMap[g.team1 as string] ?? []
    const team2Ids = colorMap[g.team2 as string] ?? []
    const s1 = g.score1 as number
    const s2 = g.score2 as number

    for (const pid of team1Ids) {
      if (!statsMap[pid]) continue
      statsMap[pid].games_played++
      if (s1 > s2) { statsMap[pid].wins++; statsMap[pid].pts += 3 }
      else if (s1 === s2) { statsMap[pid].draws++; statsMap[pid].pts += 1 }
      else statsMap[pid].losses++
    }
    for (const pid of team2Ids) {
      if (!statsMap[pid]) continue
      statsMap[pid].games_played++
      if (s2 > s1) { statsMap[pid].wins++; statsMap[pid].pts += 3 }
      else if (s1 === s2) { statsMap[pid].draws++; statsMap[pid].pts += 1 }
      else statsMap[pid].losses++
    }
  }

  const playerStats = Object.values(statsMap).sort((a, b) => {
    const ppgA = a.games_played > 0 ? a.pts / a.games_played : 0
    const ppgB = b.games_played > 0 ? b.pts / b.games_played : 0
    if (ppgB !== ppgA) return ppgB - ppgA
    if (b.pts !== a.pts) return b.pts - a.pts
    return b.games_played - a.games_played
  })

  // Build player id→name lookup for enriching recent games
  const playerNameMap: Record<string, string> = {}
  for (const p of players) playerNameMap[p.id as string] = p.name as string

  const recentGames = games.slice(0, 30).map((g) => {
    const colorMap = sessionTeamMap[g.session_id as string] ?? {}
    const team1Players = (colorMap[g.team1 as string] ?? []).map((id: string) => playerNameMap[id]).filter(Boolean)
    const team2Players = (colorMap[g.team2 as string] ?? []).map((id: string) => playerNameMap[id]).filter(Boolean)
    return { ...g, team1Players, team2Players }
  })

  return Response.json({ players: playerStats, recent_games: recentGames, available_months })
}
