import { useEffect, useState } from 'react'
import { BarChart2, Medal, Pencil, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fetchStats, updateGame, deleteGame } from '@/lib/api'
import type { PlayerStat, EnrichedGame } from '@/lib/types'

const TEAM_TEXT: Record<string, string> = {
  orange: 'text-orange-600',
  blue:   'text-blue-600',
  green:  'text-emerald-600',
}
const TEAM_BG: Record<string, string> = {
  orange: 'bg-orange-500',
  blue:   'bg-blue-500',
  green:  'bg-emerald-500',
}
const teamText = (c: string) => TEAM_TEXT[c] ?? 'text-slate-700'
const teamBg   = (c: string) => TEAM_BG[c]   ?? 'bg-slate-400'
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function formatDayLabel(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatMonth(ym: string) {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function groupByDay(games: EnrichedGame[]) {
  const groups: { label: string; games: EnrichedGame[] }[] = []
  for (const g of games) {
    const label = formatDayLabel(g.played_at)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.games.push(g)
    else groups.push({ label, games: [g] })
  }
  return groups
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

const MIN_GAMES = 5

function PlayerLeaderboard({ players }: { players: PlayerStat[] }) {
  const ranked = players.filter((p) => p.games_played >= MIN_GAMES)
  const below = players.filter((p) => p.games_played > 0 && p.games_played < MIN_GAMES)

  if (ranked.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-6">No games recorded this month.</p>
  }

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-2 px-3 py-1.5 text-xs font-semibold text-slate-400 border-b border-slate-100">
        <span>Player</span>
        <span className="w-7 text-center">GP</span>
        <span className="w-5 text-center text-emerald-600">W</span>
        <span className="w-5 text-center text-amber-500">D</span>
        <span className="w-5 text-center text-red-400">L</span>
        <span className="w-10 text-center text-slate-600">PPG</span>
      </div>
      {ranked.map((p, i) => {
        const ppg = p.games_played > 0 ? (p.pts / p.games_played).toFixed(2) : '—'
        return (
          <div
            key={p.id}
            className={cn(
              'grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-2 items-center px-3 py-2.5 border-b border-slate-50 last:border-0',
              i < 3 && 'bg-gradient-to-r from-slate-50/80 to-transparent'
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <MedalIcon rank={i + 1} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                <WinBar wins={p.wins} draws={p.draws} losses={p.losses} />
              </div>
            </div>
            <span className="w-7 text-center text-xs text-slate-500">{p.games_played}</span>
            <span className="w-5 text-center text-xs font-semibold text-emerald-600">{p.wins}</span>
            <span className="w-5 text-center text-xs font-semibold text-amber-500">{p.draws}</span>
            <span className="w-5 text-center text-xs font-semibold text-red-400">{p.losses}</span>
            <span className="w-10 text-center text-xs font-bold text-slate-700">{ppg}</span>
          </div>
        )
      })}
      {below.length > 0 && (
        <p className="text-xs text-slate-400 px-3 pt-2 pb-1">{below.length} players need {MIN_GAMES}+ games to appear</p>
      )}
    </div>
  )
}

function EditGameDialog({ game, onSave, onDelete, onClose }: {
  game: EnrichedGame
  onSave: (score1: number, score2: number) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
}) {
  const [s1, setS1] = useState(game.score1)
  const [s2, setS2] = useState(game.score2)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const adj = (setter: React.Dispatch<React.SetStateAction<number>>, delta: number) =>
    setter((v) => Math.max(0, v + delta))

  const submit = async () => {
    setSaving(true)
    try { await onSave(s1, s2); onClose() } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try { await onDelete(); onClose() } finally { setDeleting(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit score</DialogTitle></DialogHeader>
        <div className="flex items-center justify-center gap-4 py-4">
          <div className="flex flex-col items-center gap-1">
            <span className={cn('text-sm font-bold', teamText(game.team1))}>{capitalize(game.team1)}</span>
            <div className="flex items-center gap-2">
              <button className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-lg font-bold" onClick={() => adj(setS1, -1)}>−</button>
              <span className="w-8 text-center text-2xl font-bold text-slate-800">{s1}</span>
              <button className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-lg font-bold" onClick={() => adj(setS1, 1)}>+</button>
            </div>
          </div>
          <span className="text-slate-400 text-xl font-semibold">–</span>
          <div className="flex flex-col items-center gap-1">
            <span className={cn('text-sm font-bold', teamText(game.team2))}>{capitalize(game.team2)}</span>
            <div className="flex items-center gap-2">
              <button className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-lg font-bold" onClick={() => adj(setS2, -1)}>−</button>
              <span className="w-8 text-center text-2xl font-bold text-slate-800">{s2}</span>
              <button className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-lg font-bold" onClick={() => adj(setS2, 1)}>+</button>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving || deleting}>Cancel</Button>
          <Button className="flex-1" onClick={submit} disabled={saving || deleting}>{saving ? '…' : 'Save'}</Button>
        </div>
        <div className="flex justify-center mt-1">
          {confirmDelete ? (
            <div className="flex gap-2 w-full">
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Keep
              </Button>
              <Button variant="destructive" size="sm" className="flex-1 text-xs" onClick={handleDelete} disabled={deleting}>
                {deleting ? '…' : 'Delete game'}
              </Button>
            </div>
          ) : (
            <button
              className="text-xs text-slate-400 hover:text-red-500 transition-colors py-1"
              onClick={() => setConfirmDelete(true)}
            >
              Delete this game
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RecentGames({ games, loggedIn, onEdit }: {
  games: EnrichedGame[]
  loggedIn: boolean
  onEdit: (game: EnrichedGame) => void
}) {
  if (games.length === 0) return null
  const groups = groupByDay(games)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-slate-700">Games</p>
      <Card className="overflow-hidden">
        {groups.map((group, gi) => (
          <div key={group.label}>
            {/* Day separator */}
            <div className={cn('flex items-center gap-2 px-3 py-1.5', gi === 0 ? 'border-b border-slate-100' : 'border-y border-slate-100')}>
              <div className="h-px flex-1 bg-slate-100" />
              <span className="text-[10px] font-medium text-slate-400 shrink-0">{group.label}</span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>
            {group.games.map((g) => {
              const t1won = g.score1 > g.score2
              const t2won = g.score2 > g.score1
              return (
                <div key={g.id} className="border-b border-slate-50 last:border-0">
                  {/* Score row — score absolutely centered */}
                  <div className="relative flex items-center px-4 py-2.5">
                    {/* Team 1 — right-aligned, leaves gap for score */}
                    <div className="flex-1 flex items-center justify-end gap-1.5 pr-10">
                      <span className={cn('text-sm font-semibold', teamText(g.team1), t1won ? 'text-slate-900' : '')}>
                        {capitalize(g.team1)}
                      </span>
                      <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', teamBg(g.team1))} />
                    </div>
                    {/* Score — pinned to exact center of the row */}
                    <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 pointer-events-none">
                      <span className={cn('text-base font-bold tabular-nums w-5 text-right', t1won ? 'text-slate-900' : 'text-slate-400')}>{g.score1}</span>
                      <span className="text-slate-300 text-sm">–</span>
                      <span className={cn('text-base font-bold tabular-nums w-5', t2won ? 'text-slate-900' : 'text-slate-400')}>{g.score2}</span>
                    </div>
                    {/* Team 2 — left-aligned */}
                    <div className="flex-1 flex items-center gap-1.5 pl-10">
                      <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', teamBg(g.team2))} />
                      <span className={cn('text-sm font-semibold', teamText(g.team2), t2won ? 'text-slate-900' : '')}>
                        {capitalize(g.team2)}
                      </span>
                    </div>
                    {/* Edit button — absolute right, never affects centering */}
                    {loggedIn && (
                      <button
                        className="absolute right-3 p-1 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
                        onClick={() => onEdit(g)}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {/* Player names sub-row */}
                  {(g.team1Players.length > 0 || g.team2Players.length > 0) && (
                    <div className="flex px-4 pb-2 gap-2">
                      <p className="text-[10px] text-slate-400 flex-1 truncate text-right leading-relaxed">
                        {g.team1Players.map((n) => n.split(' ')[0]).join(', ')}
                      </p>
                      <div className="w-16 shrink-0" />
                      <p className="text-[10px] text-slate-400 flex-1 truncate leading-relaxed">
                        {g.team2Players.map((n) => n.split(' ')[0]).join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </Card>
    </div>
  )
}

interface StatsTabProps {
  loggedIn?: boolean
}

export function StatsTab({ loggedIn = false }: StatsTabProps) {
  const [players, setPlayers] = useState<PlayerStat[]>([])
  const [games, setGames] = useState<EnrichedGame[]>([])
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [monthIdx, setMonthIdx] = useState(-1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [editingGame, setEditingGame] = useState<EnrichedGame | null>(null)

  const loadMonth = async (month: string, months?: string[]) => {
    setLoading(true)
    try {
      const data = await fetchStats(month)
      setPlayers(data.players)
      setGames(data.recent_games)
      if (months) setAvailableMonths(months)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchStats()
      .then(async (data) => {
        const months = data.available_months
        setAvailableMonths(months)
        if (months.length > 0) {
          const lastIdx = months.length - 1
          setMonthIdx(lastIdx)
          const filtered = await fetchStats(months[lastIdx])
          setPlayers(filtered.players)
          setGames(filtered.recent_games)
        } else {
          setPlayers(data.players)
          setGames(data.recent_games)
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const goMonth = (delta: number) => {
    const next = monthIdx + delta
    if (next < 0 || next >= availableMonths.length) return
    setMonthIdx(next)
    loadMonth(availableMonths[next])
  }

  const handleSave = async (id: string, s1: number, s2: number) => {
    await updateGame(id, s1, s2)
    if (monthIdx >= 0 && availableMonths[monthIdx]) {
      await loadMonth(availableMonths[monthIdx])
    }
  }

  const handleDelete = async (id: string) => {
    await deleteGame(id)
    if (monthIdx >= 0 && availableMonths[monthIdx]) {
      await loadMonth(availableMonths[monthIdx])
    }
  }

  const currentMonth = monthIdx >= 0 ? availableMonths[monthIdx] : null

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
        <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-1">
          <BarChart2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <button
            className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"
            onClick={() => goMonth(-1)}
            disabled={monthIdx <= 0 || loading}
          >
            <ChevronLeft className="h-4 w-4 text-slate-500" />
          </button>
          <span className="text-sm font-semibold text-slate-700 flex-1 text-center">
            {currentMonth ? formatMonth(currentMonth) : 'Leaderboard'}
          </span>
          <button
            className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"
            onClick={() => goMonth(1)}
            disabled={monthIdx >= availableMonths.length - 1 || loading}
          >
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>
          <span className="text-xs text-slate-400 shrink-0 w-16 text-right">
            {players.filter((p) => p.games_played >= MIN_GAMES).length} players
          </span>
        </div>
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
          </div>
        ) : (
          <PlayerLeaderboard players={players} />
        )}
      </Card>

      {!loading && (
        <RecentGames
          games={games}
          loggedIn={loggedIn}
          onEdit={setEditingGame}
        />
      )}

      {editingGame && (
        <EditGameDialog
          game={editingGame}
          onSave={(s1, s2) => handleSave(editingGame.id, s1, s2)}
          onDelete={() => handleDelete(editingGame.id)}
          onClose={() => setEditingGame(null)}
        />
      )}
    </div>
  )
}
