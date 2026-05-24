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
