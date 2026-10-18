export const AWARD_YEAR = 2026
export const OPENS_AT = '2026-10-16T00:00:00+09:00'
export const CLOSES_AT = '2026-10-24T00:00:00+09:00'
export const CATEGORIES = [
  { id: 'ballon-dor', name: "Ballon d’Or", icon: '🏆', description: 'The best overall player of the year.' },
  { id: 'attacker', name: 'Best Attacker', icon: '⚡', description: 'Outstanding attacking play and goalscoring.' },
  { id: 'defender', name: 'Best Defender', icon: '🛡️', description: 'The player who keeps the opposition at bay.' },
  { id: 'goalkeeper', name: 'Best Goalkeeper', icon: '🧤', description: 'The safest hands and biggest saves.' },
  { id: 'playmaker', name: 'Best Playmaker', icon: '🎯', description: 'Exceptional passing and chance creation.' },
  { id: 'improved', name: 'Most Improved Player', icon: '📈', description: 'The biggest improvement throughout the year.' },
  { id: 'team-player', name: 'Best Team Player', icon: '🤝', description: 'Unselfish play that makes everyone better.' },
  { id: 'spirit', name: 'Spirit of the Club', icon: '💚', description: 'Positivity, sportsmanship, and encouragement.' },
] as const
export type AwardPlayer = { id: string; name: string }
export type Ballot = Record<string, string[]>
export type AwardConfig = { players: AwardPlayer[]; opensAt: string; closesAt: string; isOpen: boolean }
export type AwardResults = { eligible: number; submitted: number; participation: (AwardPlayer & { submittedAt: number | null })[]; categories: { id: string; ballots: number; standings: (AwardPlayer & { points: number; first: number; second: number; third: number; rank: number })[] }[] }
