import { useEffect, useRef, useState } from 'react'
import { BarChart2, Download, Medal, Pencil, Layers, Share2 } from 'lucide-react'
import { toPng } from 'html-to-image'
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
  white:  'text-slate-700',
}
const TEAM_BG: Record<string, string> = {
  orange: 'bg-orange-500',
  blue:   'bg-blue-500',
  green:  'bg-emerald-500',
  white:  'bg-white border border-slate-300',
}
const TEAM_LIGHT: Record<string, string> = {
  orange: 'bg-orange-50',
  blue:   'bg-blue-50',
  green:  'bg-emerald-50',
  white:  'bg-white',
}
const teamText  = (c: string) => TEAM_TEXT[c]  ?? 'text-slate-700'
const teamBg    = (c: string) => TEAM_BG[c]    ?? 'bg-slate-400'
const teamLight = (c: string) => TEAM_LIGHT[c] ?? 'bg-slate-50'
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function formatDayLabel(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
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
  if (players.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-6">No players yet.</p>
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
      {players.map((p, i) => {
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

const shareTeamStyle = (color: string) => {
  if (color === 'orange') return { accent: '#f97316', tint: '#fff7ed', text: '#c2410c' }
  if (color === 'blue') return { accent: '#3b82f6', tint: '#eff6ff', text: '#1d4ed8' }
  if (color === 'green') return { accent: '#10b981', tint: '#ecfdf5', text: '#047857' }
  return { accent: '#cbd5e1', tint: '#ffffff', text: '#334155' }
}

function SessionShareBoard({ session, boardRef }: {
  session: SessionStat
  boardRef: React.RefObject<HTMLDivElement | null>
}) {
  const date = formatDayLabel(session.played_at)
  const maxPlayers = Math.max(...session.teams.map((team) => team.playerNames.length), 0)

  return (
    <div className="fixed left-[-12000px] top-0" aria-hidden="true">
      <div ref={boardRef} className="w-[1000px] bg-white p-10 text-black">
        <header className="flex items-end justify-between pb-5">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-600">Seoul Nomads</p>
            <h2 className="text-[28px] font-bold leading-none">Game results</h2>
          </div>
          <div className="text-right">
            <p className="text-[17px] font-semibold">{date}</p>
            <p className="mt-1 text-[11px] text-black">{session.games.length} {session.games.length === 1 ? 'game' : 'games'}</p>
          </div>
        </header>

        <main className="mt-6 grid grid-cols-[330px_1fr] items-start gap-8">
          <section>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-black">Scores</h3>
            <div className="border border-slate-200">
              {session.games.map((game, index) => {
                const team1 = shareTeamStyle(game.team1)
                const team2 = shareTeamStyle(game.team2)
                return (
                  <div key={game.id} className="grid h-8 grid-cols-[24px_1fr_58px_1fr] items-center border-b border-slate-200 text-[11px] last:border-b-0">
                    <span className="pl-2 text-black">{index + 1}</span>
                    <span className="text-right font-semibold" style={{ color: team1.text }}>{capitalize(game.team1)}</span>
                    <span className="text-center text-[13px] font-bold tabular-nums text-black">{game.score1} - {game.score2}</span>
                    <span className="font-semibold" style={{ color: team2.text }}>{capitalize(game.team2)}</span>
                  </div>
                )
              })}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-black">Teams</h3>
            <div
              className="grid border border-slate-200"
              style={{ gridTemplateColumns: `repeat(${session.teams.length}, minmax(0, 1fr))` }}
            >
              {session.teams.map((team) => {
                const style = shareTeamStyle(team.color)
                return (
                  <div key={team.color} className="border-r border-slate-200 last:border-r-0">
                    <div className="border-b border-slate-200 px-3 py-2 text-center text-[12px] font-bold" style={{ backgroundColor: style.tint, color: style.text }}>
                      {capitalize(team.color)}
                    </div>
                    <div className="py-1.5">
                      {Array.from({ length: maxPlayers }, (_, playerIndex) => (
                        <div key={playerIndex} className="h-6 px-3 text-center text-[11px] leading-6 text-black">
                          {team.playerNames[playerIndex] ?? ''}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <h3 className="mb-2 mt-7 text-[11px] font-bold uppercase tracking-[0.14em] text-black">Team statistics</h3>
            <div className="border border-slate-200 text-[10px] text-black">
              <div className="grid grid-cols-[1.25fr_repeat(9,1fr)] border-b border-slate-200 bg-slate-50 py-2 text-center font-bold text-black">
                <span className="text-left pl-3">Team</span>
                <span>PTS</span><span>PPG</span><span>GP</span><span>W</span><span>D</span><span>L</span><span>GF</span><span>GA</span><span>GD</span>
              </div>
              {session.teams.map((team) => {
                const style = shareTeamStyle(team.color)
                const points = team.wins * 3 + team.draws
                const goalDifference = team.gf - team.ga
                return (
                  <div key={team.color} className="grid grid-cols-[1.25fr_repeat(9,1fr)] border-b border-slate-200 py-2.5 text-center last:border-b-0">
                    <span className="text-left pl-3 font-bold" style={{ color: style.text }}>{capitalize(team.color)}</span>
                    <span className="font-bold">{points}</span>
                    <span className="font-bold">{team.games ? (points / team.games).toFixed(2) : '-'}</span>
                    <span>{team.games}</span><span>{team.wins}</span><span>{team.draws}</span><span>{team.losses}</span><span>{team.gf}</span><span>{team.ga}</span>
                    <span className="font-semibold" style={{ color: goalDifference > 0 ? '#059669' : goalDifference < 0 ? '#f87171' : '#64748b' }}>
                      {goalDifference > 0 ? '+' : ''}{goalDifference}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        </main>
        </div>
    </div>
  )
}

function SessionCard({
  session,
  loggedIn,
  onEdit,
  onShare,
}: {
  session: SessionStat
  loggedIn: boolean
  onEdit: (g: SessionGameRow, sessionId: string) => void
  onShare: (session: SessionStat) => void
}) {
  const date = formatDayLabel(session.played_at)
  const gameCount = session.games.length

  return (
    <Card className="overflow-hidden shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <span className="text-sm font-semibold text-slate-700">{date}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{gameCount} {gameCount === 1 ? 'game' : 'games'}</span>
          <button
            type="button"
            data-share-control="true"
            title="Share session image"
            aria-label={`Share ${date} session image`}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-emerald-600"
            onClick={() => onShare(session)}
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
        </div>
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
            </div>

            {/* Player names */}
            <p className="text-[11px] text-slate-500 mb-2.5 leading-relaxed">
              {t.playerNames.join(', ')}
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

            {/* Points */}
            {t.games > 0 && (
              <div className="mt-2 grid grid-cols-2 border-t border-slate-100/80 pt-2.5 text-center">
                <div className="border-r border-slate-100">
                  <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Total points</div>
                  <div className={cn('mt-0.5 text-lg font-bold tabular-nums', teamText(t.color))}>{pts}</div>
                </div>
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Points / game</div>
                  <div className="mt-0.5 text-lg font-bold tabular-nums text-slate-700">{(pts / t.games).toFixed(2)}</div>
                </div>
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
  onShare,
}: {
  sessions: SessionStat[]
  loggedIn: boolean
  onEdit: (g: SessionGameRow, sessionId: string) => void
  onShare: (session: SessionStat) => void
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
            <SessionCard session={s} loggedIn={loggedIn} onEdit={onEdit} onShare={onShare} />
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

type LeaderboardView = 'overall' | 'recent' | 'sessions'

interface StatsTabProps {
  loggedIn?: boolean
}

export function StatsTab({ loggedIn = false }: StatsTabProps) {
  const [view, setView] = useState<LeaderboardView>('recent')
  const [players, setPlayers] = useState<PlayerStat[]>([])
  const [sessions, setSessions] = useState<SessionStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [editingGame, setEditingGame] = useState<EnrichedGame | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const [shareSource, setShareSource] = useState<SessionStat | null>(null)
  const [shareImage, setShareImage] = useState<{ url: string; label: string } | null>(null)
  const [shareError, setShareError] = useState(false)
  const shareBoardRef = useRef<HTMLDivElement>(null)

  const loadOverall = async () => {
    setLoading(true)
    try {
      const data = await fetchStats('all')
      setPlayers(data.players)
    } catch { setError(true) }
    finally { setLoading(false) }
  }

  const loadRecent = async () => {
    setLoading(true)
    try {
      const data = await fetchStats('recent')
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
    fetchStats('recent')
      .then((data) => {
        setPlayers(data.players)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const switchView = (next: LeaderboardView) => {
    if (next === view) return
    setView(next)
    setShowInfo(false)
    if (next === 'overall') loadOverall()
    else if (next === 'recent') loadRecent()
    else if (next === 'sessions') loadSessions()
  }

  const refresh = () => {
    if (view === 'overall') loadOverall()
    else if (view === 'recent') loadRecent()
    else if (view === 'sessions') loadSessions()
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

  const createSessionImage = (session: SessionStat) => {
    setShareError(false)
    setShareImage(null)
    setShareSource(session)
  }

  useEffect(() => {
    if (!shareSource) return

    let cancelled = false
    const renderImage = async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      if (!shareBoardRef.current) return

      try {
        const url = await toPng(shareBoardRef.current, {
          backgroundColor: '#ffffff',
          cacheBust: true,
          pixelRatio: 2,
        })
        if (!cancelled) setShareImage({ url, label: formatDayLabel(shareSource.played_at) })
      } catch {
        if (!cancelled) setShareError(true)
      }
    }

    void renderImage()
    return () => { cancelled = true }
  }, [shareSource])

  const saveSessionImage = async () => {
    if (!shareImage) return

    const filename = `seoul-nomads-${shareImage.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`
    const response = await fetch(shareImage.url)
    const blob = await response.blob()
    const file = new File([blob], filename, { type: 'image/png' })

    // iOS Safari does not reliably download data URLs. Sharing the generated
    // image as a file opens the native sheet, including Save Image / Files.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Game results' })
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setShareError(true)
      }
      return
    }

    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    link.click()
    URL.revokeObjectURL(objectUrl)
  }

  const canShareSessionImage = typeof navigator !== 'undefined' && 'canShare' in navigator

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
      <div className="flex gap-1 rounded-xl bg-[#edf0f3] p-1">
        {(['recent', 'sessions', 'overall'] as LeaderboardView[]).map((v) => (
          <button
            key={v}
            onClick={() => switchView(v)}
            className={cn(
              'flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors',
              view === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {v === 'recent' ? 'Latest' : v === 'sessions' ? 'Per Session' : 'Overall'}
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
          <SessionCarousel sessions={sessions} loggedIn={loggedIn} onEdit={openEditForSessionGame} onShare={createSessionImage} />
        )
      )}

      {shareSource && <SessionShareBoard session={shareSource} boardRef={shareBoardRef} />}

      <Dialog open={shareSource !== null || shareError} onOpenChange={(open) => {
        if (!open) {
          setShareSource(null)
          setShareImage(null)
          setShareError(false)
        }
      }}>
        <DialogContent className="max-h-[90dvh] max-w-[min(100vw-2rem,64rem)] overflow-y-auto">
          <div className="mb-3 flex items-center gap-2 pr-8">
            <DialogHeader className="mb-0 space-y-0"><DialogTitle>Game results</DialogTitle></DialogHeader>
            {shareImage && (
              <Button size="sm" className="h-8 gap-1.5 px-3 py-0" onClick={saveSessionImage}>
                <Download className="h-3.5 w-3.5" />{canShareSessionImage ? 'Share image' : 'Download'}
              </Button>
            )}
          </div>
          {shareImage ? (
            <div>
              <img src={shareImage.url} alt={`${shareImage.label} session preview`} className="w-full rounded-lg border border-slate-200" />
            </div>
          ) : shareError ? (
            <p className="text-sm text-slate-500">Could not create the session image.</p>
          ) : (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Overall / Last 50 leaderboard */}
      {view !== 'sessions' && (
        <Card className="overflow-hidden">
          <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-1">
            <BarChart2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="text-sm font-semibold text-slate-700 flex-1">
              {view === 'overall' ? 'Overall' : 'Latest'}
            </span>
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
              {players.length} players
            </span>
          </div>
          {showInfo && (
            <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex flex-col gap-1.5 text-xs text-emerald-800">
              {view === 'overall' ? (
                <>
                  <p className="font-semibold">How the Overall ranking works</p>
                  <p>· Ranked by <strong>games played</strong>, from most to least</p>
                  <p>· Score calculated from <strong>all recorded games</strong></p>
                </>
              ) : (
                <>
                  <p className="font-semibold">How the Latest ranking works</p>
                  <p>· Ranked by <strong>PPG</strong> (points per game): Win = 3 pts, Draw = 1 pt, Loss = 0 pts</p>
                  <p>· Score calculated from each player's <strong>last 50 games</strong> when available</p>
                </>
              )}
              <p>· Only players with at least <strong>50 games</strong> are eligible for this ranking</p>
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
            </div>
          ) : (
            <PlayerLeaderboard players={players} />
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
