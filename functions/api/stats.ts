import type { Env } from '../_lib/db'

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const [{ results: sessions }, { results: games }, { results: players }] = await Promise.all([
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

  // Accumulate per-player stats
  const statsMap: Record<string, { id: string; name: string; games_played: number; wins: number; draws: number; losses: number }> = {}
  for (const p of players) {
    statsMap[p.id as string] = { id: p.id as string, name: p.name as string, games_played: 0, wins: 0, draws: 0, losses: 0 }
  }

  for (const g of games) {
    const colorMap = sessionTeamMap[g.session_id as string]
    if (!colorMap) continue
    const team1Players = colorMap[g.team1 as string] ?? []
    const team2Players = colorMap[g.team2 as string] ?? []
    const s1 = g.score1 as number
    const s2 = g.score2 as number

    for (const pid of team1Players) {
      if (!statsMap[pid]) continue
      statsMap[pid].games_played++
      if (s1 > s2) statsMap[pid].wins++
      else if (s1 === s2) statsMap[pid].draws++
      else statsMap[pid].losses++
    }
    for (const pid of team2Players) {
      if (!statsMap[pid]) continue
      statsMap[pid].games_played++
      if (s2 > s1) statsMap[pid].wins++
      else if (s1 === s2) statsMap[pid].draws++
      else statsMap[pid].losses++
    }
  }

  const playerStats = Object.values(statsMap).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    const rateA = a.games_played > 0 ? a.wins / a.games_played : 0
    const rateB = b.games_played > 0 ? b.wins / b.games_played : 0
    if (rateB !== rateA) return rateB - rateA
    return b.games_played - a.games_played
  })

  return Response.json({
    players: playerStats,
    recent_games: games.slice(0, 30),
  })
}
