export interface Player {
  id: string
  name: string
  pace: number
  shooting: number
  passing: number
  dribbling: number
  defending: number
  physique: number
  morale: number
}

export interface Team {
  name: string
  color: string
  players: Player[]
  avgPace: number
  avgShooting: number
  avgPassing: number
  avgDribbling: number
  avgDefending: number
  avgPhysique: number
  avgMorale: number
  avgOverall: number
}

export interface SplitVariant {
  id: number
  teams: Team[]
  balanceScore: number
}

export interface SplitResponse {
  variants: SplitVariant[]
}

export interface Session {
  id: string
  teams: { color: string; playerIds: string[] }[]
  played_at: number
}

export interface Game {
  id: string
  session_id: string
  team1: string
  team2: string
  score1: number
  score2: number
  played_at: number
}

export interface PlayerStat {
  id: string
  name: string
  games_played: number
  wins: number
  draws: number
  losses: number
  pts: number
}

export interface EnrichedGame extends Game {
  team1Players: string[]
  team2Players: string[]
}

export interface StatsResponse {
  players: PlayerStat[]
  recent_games: EnrichedGame[]
  available_months: string[]  // "YYYY-MM" sorted ascending
}
