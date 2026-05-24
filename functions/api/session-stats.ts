import type { Env } from '../_lib/db'

type TeamStat = {
  color: string
  playerNames: string[]
  games: number
  wins: number
  draws: number
  losses: number
  gf: number
  ga: number
}

type SessionGameRow = {
  id: string
  team1: string
  team2: string
  score1: number
  score2: number
  played_at: number
}

type SessionResult = {
  id: string
  played_at: number
  teams: TeamStat[]
  games: SessionGameRow[]
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const [{ results: sessions }, { results: allGames }, { results: players }] = await Promise.all([
    ctx.env.DB.prepare('SELECT id, teams, played_at FROM sessions ORDER BY played_at DESC LIMIT 40').all(),
    ctx.env.DB.prepare('SELECT id, session_id, team1, team2, score1, score2, played_at FROM games ORDER BY played_at ASC').all(),
    ctx.env.DB.prepare('SELECT id, name FROM players').all(),
  ])

  const playerNameMap: Record<string, string> = {}
  for (const p of players) playerNameMap[p.id as string] = p.name as string

  const gamesBySession: Record<string, SessionGameRow[]> = {}
  for (const g of allGames) {
    const sid = g.session_id as string
    if (!gamesBySession[sid]) gamesBySession[sid] = []
    gamesBySession[sid].push({
      id: g.id as string,
      team1: g.team1 as string,
      team2: g.team2 as string,
      score1: g.score1 as number,
      score2: g.score2 as number,
      played_at: g.played_at as number,
    })
  }

  const results: SessionResult[] = []

  for (const s of sessions) {
    const teamsData = JSON.parse(s.teams as string) as { color: string; playerIds: string[] }[]
    const sessionGames = gamesBySession[s.id as string] ?? []

    const teamStatsMap: Record<string, TeamStat> = {}
    for (const t of teamsData) {
      teamStatsMap[t.color] = {
        color: t.color,
        playerNames: t.playerIds.map((id) => playerNameMap[id]).filter(Boolean) as string[],
        games: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0,
      }
    }

    for (const g of sessionGames) {
      const t1 = teamStatsMap[g.team1]
      const t2 = teamStatsMap[g.team2]
      if (t1) {
        t1.games++; t1.gf += g.score1; t1.ga += g.score2
        if (g.score1 > g.score2) t1.wins++
        else if (g.score1 === g.score2) t1.draws++
        else t1.losses++
      }
      if (t2) {
        t2.games++; t2.gf += g.score2; t2.ga += g.score1
        if (g.score2 > g.score1) t2.wins++
        else if (g.score1 === g.score2) t2.draws++
        else t2.losses++
      }
    }

    results.push({
      id: s.id as string,
      played_at: s.played_at as number,
      teams: teamsData.map((t) => teamStatsMap[t.color]).filter(Boolean) as TeamStat[],
      games: sessionGames,
    })
  }

  return Response.json({ sessions: results.filter((r) => r.games.length > 0) })
}
