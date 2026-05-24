import { useEffect, useRef, useState } from 'react'
import { BarChart2, Medal, Pencil, ChevronLeft, ChevronRight, Layers } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fetchStats, fetchSessionStats, updateGame, deleteGame } from '@/lib/api'
import type { PlayerStat, EnrichedGame, SessionStat, SessionGameRow } from '@/lib/types'

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
const TEAM_LIGHT: Record<string, string> = {
  orange: 'bg-orange-50',
  blue:   'bg-blue-50',
  green:  'bg-emerald-50',
}
const teamText  = (c: string) => TEAM_TEXT[c]  ?? 'text-slate-700'
const teamBg    = (c: string) => TEAM_BG[c]    ?? 'bg-slate-400'
const teamLight = (c: string) => TEAM_LIGHT[c] ?? 'bg-slate-50'
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function formatDayLabel(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatMonth(ym: string) {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
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

const MIN_GAMES = 10
const OVERALL_MIN = 50

const FAKE_CHARS = 'ABCDEFGHJKLMNPQRSTVWXZ'
function fakeStr(id: string, offset: number) {
  let h = offset
  for (let i = 0; i < id.length; i++) h = (Math.imul(h + 7, 31) + id.charCodeAt(i)) >>> 0
  return FAKE_CHARS[h % FAKE_CHARS.length] + FAKE_CHARS[(h >>> 5) % FAKE_CHARS.length]
}

function PlayerLeaderboard({ players, view }: { players: PlayerStat[]; view: 'overall' | 'monthly' }) {
  const isOverall = view === 'overall'

  const ranked = isOverall
    ? players.filter((p) => (p.recent_count ?? 0) >= OVERALL_MIN)
    : players.filter((p) => p.games_played >= MIN_GAMES)

  const pending = isOverall
    ? players.filter((p) => { const rc = p.recent_count ?? 0; return rc > 0 && rc < OVERALL_MIN })
    : players.filter((p) => p.games_played > 0 && p.games_played < MIN_GAMES)

  if (ranked.length === 0 && pending.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-6">No players qualify yet.</p>
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
      {isOverall && pending.length > 0 && (
        <>
          <div className="flex items-center gap-2 px-3 py-1.5 border-t border-dashed border-slate-200 bg-slate-50/60">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[10px] font-semibold text-slate-400 tracking-wide shrink-0">ALMOST THERE</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
          {pending.map((p) => {
            const need = OVERALL_MIN - (p.recent_count ?? 0)
            return (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-2 items-center px-3 py-2.5 border-b border-slate-50 last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-slate-300 w-4 text-center text-base leading-none">·</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-500 truncate">{p.name}</p>
                    <span className="text-[10px] font-medium text-amber-600">Need {need} more</span>
                  </div>
                </div>
                <span className="w-7 text-center text-xs text-slate-500 blur-sm select-none">{fakeStr(p.id, 1)}</span>
                <span className="w-5 text-center text-xs font-semibold text-emerald-600 blur-sm select-none">{fakeStr(p.id, 2)}</span>
                <span className="w-5 text-center text-xs font-semibold text-amber-500 blur-sm select-none">{fakeStr(p.id, 3)}</span>
                <span className="w-5 text-center text-xs font-semibold text-red-400 blur-sm select-none">{fakeStr(p.id, 4)}</span>
                <span className="w-10 text-center text-xs font-bold text-slate-700 blur-sm select-none">{fakeStr(p.id, 5)}</span>
              </div>
            )
          })}
        </>
      )}
      {!isOverall && pending.length > 0 && (
        <p className="text-xs text-slate-400 px-3 pt-2 pb-1">{pending.length} players need {MIN_GAMES}+ games to appear</p>
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

function SessionCard({
  session,
  loggedIn,
  onEdit,
}: {
  session: SessionStat
  loggedIn: boolean
  onEdit: (g: SessionGameRow, sessionId: string) => void
}) {
  const date = formatDayLabel(session.played_at)
  const gameCount = session.games.length

  return (
    <Card className="overflow-hidden shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <span className="text-sm font-semibold text-slate-700">{date}</span>
        <span className="text-xs text-slate-400">{gameCount} {gameCount === 1 ? 'game' : 'games'}</span>
      </div>

      {/* Teams */}
      {session.teams.map((t) => {
        const gd = t.gf - t.ga
        const pts = t.wins * 3 + t.draws
        return (
          <div key={t.color} className={cn('px-4 py-3 border-b border-slate-100 last:border-0', teamLight(t.color) + '/40')}>
            {/* Team header */}
            <div className="flex items-center gap-2 mb-1.5">
              <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', teamBg(t.color))} />
              <span className={cn('text-sm font-semibold', teamText(t.color))}>{capitalize(t.color)}</span>
              <span className="text-xs text-slate-400 ml-0.5">{t.playerNames.length}p</span>
            </div>

            {/* Player names */}
            <p className="text-[11px] text-slate-500 mb-2.5 leading-relaxed">
              {t.playerNames.map((n) => n.split(' ')[0]).join(', ')}
            </p>

            {/* Raw stats row */}
            <div className="grid grid-cols-7 text-center mb-0.5">
              {(['GP','W','D','L','GF','GA','GD'] as const).map((h) => (
                <span key={h} className={cn(
                  'text-[9px] font-semibold',
                  h === 'W' ? 'text-emerald-500' : h === 'D' ? 'text-amber-500' : h === 'L' ? 'text-red-400' : 'text-slate-400'
                )}>{h}</span>
              ))}
              <span className="text-xs font-semibold text-slate-700">{t.games}</span>
              <span className="text-xs font-semibold text-emerald-600">{t.wins}</span>
              <span className="text-xs font-semibold text-amber-500">{t.draws}</span>
              <span className="text-xs font-semibold text-red-400">{t.losses}</span>
              <span className="text-xs font-semibold text-slate-600">{t.gf}</span>
              <span className="text-xs font-semibold text-slate-600">{t.ga}</span>
              <span className={cn('text-xs font-semibold', gd > 0 ? 'text-emerald-600' : gd < 0 ? 'text-red-400' : 'text-slate-500')}>
                {gd > 0 ? '+' : ''}{gd}
              </span>
            </div>

            {/* Per-game rates */}
            {t.games > 0 && (
              <div className="grid grid-cols-4 mt-2 pt-2 border-t border-slate-100/80">
                {[
                  { label: 'P/G',  value: (pts / t.games).toFixed(2), color: 'text-slate-600' },
                  { label: 'GD/G', value: (gd >= 0 ? '+' : '') + (gd / t.games).toFixed(1), color: gd >= 0 ? 'text-emerald-600' : 'text-red-400' },
                  { label: 'GF/G', value: (t.gf / t.games).toFixed(1), color: 'text-slate-600' },
                  { label: 'GA/G', value: (t.ga / t.games).toFixed(1), color: 'text-slate-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center">
                    <div className="text-[9px] text-slate-400 font-medium">{label}</div>
                    <div className={cn('text-[11px] font-semibold', color)}>{value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Game list */}
      {gameCount > 0 && (
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold text-slate-400 mb-2 tracking-wide">GAMES</p>
          <div className="flex flex-col gap-1.5">
            {session.games.map((g, gi) => {
              const t1won = g.score1 > g.score2
              const t2won = g.score2 > g.score1
              return (
                <div key={g.id} className="relative flex items-center bg-slate-50 rounded-lg px-2 py-1.5">
                  <span className="absolute left-2 text-[9px] font-semibold text-slate-300 w-4 text-center select-none">{gi + 1}</span>
                  <div className="flex-1 flex items-center justify-end gap-1.5 pr-10">
                    <span className={cn('text-xs font-semibold', teamText(g.team1), t1won && 'text-slate-900')}>{capitalize(g.team1)}</span>
                    <div className={cn('h-2 w-2 rounded-full shrink-0', teamBg(g.team1))} />
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5 pointer-events-none">
                    <span className={cn('text-sm font-bold tabular-nums w-4 text-right', t1won ? 'text-slate-800' : 'text-slate-400')}>{g.score1}</span>
                    <span className="text-slate-300 text-xs mx-0.5">–</span>
                    <span className={cn('text-sm font-bold tabular-nums w-4', t2won ? 'text-slate-800' : 'text-slate-400')}>{g.score2}</span>
                  </div>
                  <div className="flex-1 flex items-center gap-1.5 pl-10">
                    <div className={cn('h-2 w-2 rounded-full shrink-0', teamBg(g.team2))} />
                    <span className={cn('text-xs font-semibold', teamText(g.team2), t2won && 'text-slate-900')}>{capitalize(g.team2)}</span>
                  </div>
                  {loggedIn && (
                    <button
                      className="absolute right-2 p-1 text-slate-300 hover:text-slate-500 transition-colors"
                      onClick={() => onEdit(g, session.id)}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}

function SessionCarousel({
  sessions,
  loggedIn,
  onEdit,
}: {
  sessions: SessionStat[]
  loggedIn: boolean
  onEdit: (g: SessionGameRow, sessionId: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const cardWidth = el.scrollWidth / sessions.length
    setCurrent(Math.round(el.scrollLeft / cardWidth))
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <Layers className="h-8 w-8 text-slate-300" />
        <p className="text-sm text-slate-400">No sessions yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-4 px-4"
        style={{ scrollbarWidth: 'none' }}
      >
        {sessions.map((s) => (
          <div key={s.id} className="snap-center shrink-0 w-[min(calc(100vw-3rem),29rem)]">
            <SessionCard session={s} loggedIn={loggedIn} onEdit={onEdit} />
          </div>
        ))}
      </div>
      {/* Dot indicators */}
      {sessions.length > 1 && (
        <div className="flex justify-center gap-1 pt-0.5">
          {sessions.map((_, i) => (
            <div
              key={i}
              className={cn(
                'rounded-full transition-all',
                i === current ? 'w-4 h-1.5 bg-emerald-500' : 'w-1.5 h-1.5 bg-slate-300'
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}

type LeaderboardView = 'overall' | 'sessions' | 'monthly'

interface StatsTabProps {
  loggedIn?: boolean
}

export function StatsTab({ loggedIn = false }: StatsTabProps) {
  const [view, setView] = useState<LeaderboardView>('overall')
  const [players, setPlayers] = useState<PlayerStat[]>([])
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [monthIdx, setMonthIdx] = useState(-1)
  const [sessions, setSessions] = useState<SessionStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [editingGame, setEditingGame] = useState<EnrichedGame | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  const loadOverall = async () => {
    setLoading(true)
    try {
      const data = await fetchStats()
      setPlayers(data.players)
      if (data.available_months.length > 0) setAvailableMonths(data.available_months)
    } catch { setError(true) }
    finally { setLoading(false) }
  }

  const loadMonth = async (month: string) => {
    setLoading(true)
    try {
      const data = await fetchStats(month)
      setPlayers(data.players)
    } catch { setError(true) }
    finally { setLoading(false) }
  }

  const loadSessions = async () => {
    setLoading(true)
    try {
      const data = await fetchSessionStats()
      setSessions(data.sessions)
    } catch { setError(true) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    setLoading(true)
    fetchStats()
      .then((data) => {
        setPlayers(data.players)
        if (data.available_months.length > 0) {
          setAvailableMonths(data.available_months)
          setMonthIdx(data.available_months.length - 1)
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const switchView = (next: LeaderboardView) => {
    if (next === view) return
    setView(next)
    setShowInfo(false)
    if (next === 'overall') loadOverall()
    else if (next === 'sessions') loadSessions()
    else {
      const month = availableMonths[monthIdx]
      if (month) loadMonth(month)
    }
  }

  const goMonth = (delta: number) => {
    const next = monthIdx + delta
    if (next < 0 || next >= availableMonths.length) return
    setMonthIdx(next)
    loadMonth(availableMonths[next])
  }

  const refresh = () => {
    if (view === 'overall') loadOverall()
    else if (view === 'sessions') loadSessions()
    else loadMonth(availableMonths[monthIdx])
  }

  const handleSave = async (id: string, s1: number, s2: number) => {
    await updateGame(id, s1, s2)
    await refresh()
  }

  const handleDelete = async (id: string) => {
    await deleteGame(id)
    await refresh()
  }

  const openEditForSessionGame = (g: SessionGameRow, sessionId: string) => {
    setEditingGame({ ...g, session_id: sessionId, team1Players: [], team2Players: [] })
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
      {/* View toggle */}
      <div className="flex gap-1 bg-slate-200 rounded-xl p-1">
        {(['overall', 'sessions', 'monthly'] as LeaderboardView[]).map((v) => (
          <button
            key={v}
            onClick={() => switchView(v)}
            className={cn(
              'flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors',
              view === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {v === 'overall' ? 'Overall' : v === 'sessions' ? 'Per Session' : 'Monthly'}
          </button>
        ))}
      </div>

      {/* Per Session carousel */}
      {view === 'sessions' && (
        loading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
          </div>
        ) : (
          <SessionCarousel sessions={sessions} loggedIn={loggedIn} onEdit={openEditForSessionGame} />
        )
      )}

      {/* Overall / Monthly leaderboard */}
      {view !== 'sessions' && (
        <Card className="overflow-hidden">
          <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-1">
            <BarChart2 className="h-4 w-4 text-emerald-600 shrink-0" />
            {view === 'overall' ? (
              <>
                <span className="text-sm font-semibold text-slate-700 flex-1">Last 50 games</span>
                <button
                  onClick={() => setShowInfo((v) => !v)}
                  className={cn(
                    'h-5 w-5 rounded-full text-[11px] font-bold border transition-colors shrink-0',
                    showInfo
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-600'
                  )}
                >
                  ?
                </button>
                <span className="text-xs text-slate-400 ml-1">
                  {players.filter((p) => (p.recent_count ?? 0) >= OVERALL_MIN).length} players
                </span>
              </>
            ) : (
              <>
                <button
                  className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"
                  onClick={() => goMonth(-1)}
                  disabled={monthIdx <= 0 || loading}
                >
                  <ChevronLeft className="h-4 w-4 text-slate-500" />
                </button>
                <span className="text-sm font-semibold text-slate-700 flex-1 text-center">
                  {currentMonth ? formatMonth(currentMonth) : '—'}
                </span>
                <button
                  className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"
                  onClick={() => goMonth(1)}
                  disabled={monthIdx >= availableMonths.length - 1 || loading}
                >
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </button>
                <button
                  onClick={() => setShowInfo((v) => !v)}
                  className={cn(
                    'h-5 w-5 rounded-full text-[11px] font-bold border transition-colors shrink-0 ml-1',
                    showInfo
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-600'
                  )}
                >
                  ?
                </button>
                <span className="text-xs text-slate-400 w-10 text-right">
                  {players.filter((p) => p.games_played >= MIN_GAMES).length} players
                </span>
              </>
            )}
          </div>
          {showInfo && (
            <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex flex-col gap-1.5 text-xs text-emerald-800">
              {view === 'overall' ? (
                <>
                  <p className="font-semibold">How the Overall ranking works</p>
                  <p>· Ranked by <strong>PPG</strong> (points per game): Win = 3 pts, Draw = 1 pt, Loss = 0 pts</p>
                  <p>· Score calculated from your <strong>last 50 games</strong> only</p>
                  <p>· You must have played <strong>50+ games in the last 5 months</strong> to appear — stop showing up and you drop off</p>
                </>
              ) : (
                <>
                  <p className="font-semibold">How the Monthly ranking works</p>
                  <p>· Ranked by <strong>PPG</strong> (points per game): Win = 3 pts, Draw = 1 pt, Loss = 0 pts</p>
                  <p>· Score based on all games played in the selected month</p>
                  <p>· Must have played <strong>10+ games that month</strong> to appear</p>
                </>
              )}
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
            </div>
          ) : (
            <PlayerLeaderboard players={players} view={view} />
          )}
        </Card>
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
