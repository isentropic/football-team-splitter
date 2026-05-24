import { useEffect, useState } from 'react'
import { BarChart2, Medal } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { fetchStats } from '@/lib/api'
import type { PlayerStat, Game } from '@/lib/types'

const TEAM_TEXT: Record<string, string> = {
  orange: 'text-orange-600',
  blue:   'text-blue-600',
  green:  'text-emerald-600',
}
const teamText = (c: string) => TEAM_TEXT[c] ?? 'text-slate-700'
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function WinBar({ wins, draws, losses }: { wins: number; draws: number; losses: number }) {
  const total = wins + draws + losses
  if (total === 0) return <div className="h-1.5 w-16 bg-slate-100 rounded-full" />
  const wp = (wins / total) * 100
  const dp = (draws / total) * 100
  return (
    <div className="h-1.5 w-16 rounded-full overflow-hidden flex">
      <div className="bg-emerald-500 h-full" style={{ width: `${wp}%` }} />
      <div className="bg-amber-400 h-full" style={{ width: `${dp}%` }} />
      <div className="bg-red-400 h-full" style={{ width: `${100 - wp - dp}%` }} />
    </div>
  )
}

function MedalIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Medal className="h-4 w-4 text-amber-400" />
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-400" />
  if (rank === 3) return <Medal className="h-4 w-4 text-orange-700" />
  return <span className="text-xs text-slate-400 w-4 text-center">{rank}</span>
}

function PlayerLeaderboard({ players }: { players: PlayerStat[] }) {
  const ranked = players.filter((p) => p.games_played > 0)
  const benched = players.filter((p) => p.games_played === 0)

  if (ranked.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-6">No games recorded yet.</p>
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 px-3 py-1.5 text-xs font-semibold text-slate-400 border-b border-slate-100">
        <span>Player</span>
        <span className="w-7 text-center">GP</span>
        <span className="w-5 text-center text-emerald-600">W</span>
        <span className="w-5 text-center text-amber-500">D</span>
        <span className="w-5 text-center text-red-400">L</span>
      </div>
      {ranked.map((p, i) => {
        const winRate = p.games_played > 0 ? Math.round((p.wins / p.games_played) * 100) : 0
        return (
          <div
            key={p.id}
            className={cn(
              'grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 items-center px-3 py-2.5 border-b border-slate-50 last:border-0',
              i < 3 && 'bg-gradient-to-r from-slate-50/80 to-transparent'
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <MedalIcon rank={i + 1} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                <WinBar wins={p.wins} draws={p.draws} losses={p.losses} />
              </div>
              <span className="text-xs text-slate-400 ml-auto shrink-0">{winRate}%</span>
            </div>
            <span className="w-7 text-center text-xs text-slate-500">{p.games_played}</span>
            <span className="w-5 text-center text-xs font-semibold text-emerald-600">{p.wins}</span>
            <span className="w-5 text-center text-xs font-semibold text-amber-500">{p.draws}</span>
            <span className="w-5 text-center text-xs font-semibold text-red-400">{p.losses}</span>
          </div>
        )
      })}
      {benched.length > 0 && (
        <p className="text-xs text-slate-400 px-3 pt-2 pb-1">{benched.length} players with no games yet</p>
      )}
    </div>
  )
}

function RecentGames({ games }: { games: Game[] }) {
  if (games.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-slate-700">Recent games</p>
      <Card className="divide-y divide-slate-100">
        {games.map((g) => {
          const t1won = g.score1 > g.score2
          const t2won = g.score2 > g.score1
          return (
            <div key={g.id} className="flex items-center px-4 py-2.5 gap-3">
              <span className={cn('text-sm font-bold w-14', teamText(g.team1), t1won && 'underline decoration-dotted')}>
                {capitalize(g.team1)}
              </span>
              <span className="text-sm font-bold text-slate-800 tabular-nums">{g.score1}–{g.score2}</span>
              <span className={cn('text-sm font-bold w-14', teamText(g.team2), t2won && 'underline decoration-dotted')}>
                {capitalize(g.team2)}
              </span>
              <span className="text-xs text-slate-400 ml-auto">{formatDate(g.played_at)}</span>
            </div>
          )
        })}
      </Card>
    </div>
  )
}

export function StatsTab() {
  const [players, setPlayers] = useState<PlayerStat[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchStats()
      .then((data) => { setPlayers(data.players); setGames(data.recent_games) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-10 w-10 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <BarChart2 className="h-10 w-10 text-slate-300" />
        <p className="text-slate-500 text-sm">Could not load stats.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden">
        <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold text-slate-700">Leaderboard</span>
          <span className="ml-auto text-xs text-slate-400">{players.filter((p) => p.games_played > 0).length} players</span>
        </div>
        <PlayerLeaderboard players={players} />
      </Card>
      <RecentGames games={games} />
    </div>
  )
}
