export interface Player {
  id: string
  name: string
  attack: number
  defense: number
  physical: number
  morale: number
}

export interface Team {
  name: string
  color: string
  players: Player[]
  avgAttack: number
  avgDefense: number
  avgPhysical: number
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
