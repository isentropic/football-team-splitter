import { useState } from 'react'
import { Swords, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn, initials } from '@/lib/utils'
import type { Session, Game, Player } from '@/lib/types'

interface Props {
  activeSession: (Session & { games: Game[] }) | null
  sessions: Session[]
  players: Player[]
  onRecordGame: (sessionId: string, game: Pick<Game, 'team1' | 'score1' | 'team2' | 'score2'>) => Promise<void>
  onNewSession: () => void
}

const TEAM_META: Record<string, { bg: string; light: string; text: string; border: string }> = {
  orange: { bg: 'bg-orange-500', light: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
  blue:   { bg: 'bg-blue-500',   light: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'   },
  green:  { bg: 'bg-emerald-500',light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200'},
}
const teamMeta = (color: string) => TEAM_META[color] ?? TEAM_META['orange']

const MATCHUPS: [string, string][] = [['orange', 'blue'], ['orange', 'green'], ['blue', 'green']]
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ScoreEntry({ team1, team2, onRecord }: {
  team1: string; team2: string; onRecord: (s1: number, s2: number) => Promise<void>
}) {
  const [s1, setS1] = useState(0)
  const [s2, setS2] = useState(0)
  const [saving, setSaving] = useState(false)
  const m1 = teamMeta(team1)
  const m2 = teamMeta(team2)

  const adj = (setter: React.Dispatch<React.SetStateAction<number>>, delta: number) =>
    setter((v) => Math.max(0, v + delta))

  const submit = async () => {
    setSaving(true)
    try { await onRecord(s1, s2) } finally { setSaving(false) }
  }

  return (
    <div className="flex items-center gap-2 mt-2 bg-slate-50 rounded-xl p-3 border border-slate-200">
      <span className={cn('text-sm font-bold w-14 text-center', m1.text)}>{capitalize(team1)}</span>
      <div className="flex items-center gap-1">
        <button className="h-7 w-7 rounded-full bg-slate-200 hover:bg-slate-300 text-sm font-bold" onClick={() => adj(setS1, -1)}>−</button>
        <span className="w-6 text-center text-lg font-bold text-slate-800">{s1}</span>
        <button className="h-7 w-7 rounded-full bg-slate-200 hover:bg-slate-300 text-sm font-bold" onClick={() => adj(setS1, 1)}>+</button>
      </div>
      <span className="text-slate-400 font-semibold">–</span>
      <div className="flex items-center gap-1">
        <button className="h-7 w-7 rounded-full bg-slate-200 hover:bg-slate-300 text-sm font-bold" onClick={() => adj(setS2, -1)}>−</button>
        <span className="w-6 text-center text-lg font-bold text-slate-800">{s2}</span>
        <button className="h-7 w-7 rounded-full bg-slate-200 hover:bg-slate-300 text-sm font-bold" onClick={() => adj(setS2, 1)}>+</button>
      </div>
      <span className={cn('text-sm font-bold w-14 text-center', m2.text)}>{capitalize(team2)}</span>
      <Button size="sm" className="ml-auto" disabled={saving} onClick={submit}>
        {saving ? '…' : 'Record'}
      </Button>
    </div>
  )
}

function SessionHistory({ sessions }: { sessions: Session[] }) {
  const [open, setOpen] = useState(false)
  if (sessions.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <button
        className="flex items-center gap-2 text-sm font-semibold text-slate-600"
        onClick={() => setOpen(!open)}
      >
        Past sessions
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && sessions.map((s) => (
        <Card key={s.id} className="p-3">
          <p className="text-xs text-slate-400 mb-1">{formatDate(s.played_at)}</p>
          <div className="flex gap-1 flex-wrap">
            {s.teams.map((t) => {
              const m = teamMeta(t.color)
              return (
                <span key={t.color} className={cn('text-xs font-medium px-2 py-0.5 rounded-full', m.light, m.text)}>
                  {capitalize(t.color)} ({t.playerIds.length})
                </span>
              )
            })}
          </div>
        </Card>
      ))}
    </div>
  )
}

export function GamesTab({ activeSession, sessions, players, onRecordGame, onNewSession }: Props) {
  const [activeMatchup, setActiveMatchup] = useState<[string, string] | null>(null)

  if (!activeSession) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center">
          <Swords className="h-8 w-8 text-slate-300" />
        </div>
        <p className="text-slate-500 text-sm">No active session. Select players, generate teams, then lock them in.</p>
        <Button variant="outline" size="sm" onClick={onNewSession}>
          <Plus className="h-4 w-4 mr-1" />Go to Select tab
        </Button>
        <SessionHistory sessions={sessions} />
      </div>
    )
  }

  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]))

  const handleRecord = async (t1: string, t2: string, s1: number, s2: number) => {
    await onRecordGame(activeSession.id, { team1: t1, score1: s1, team2: t2, score2: s2 })
    setActiveMatchup(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-slate-400 mb-2">{formatDate(activeSession.played_at)}</p>
        <div className="flex flex-col gap-2">
          {activeSession.teams.map((t) => {
            const m = teamMeta(t.color)
            return (
              <div key={t.color} className={cn('rounded-xl border p-3', m.light, m.border)}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn('h-3 w-3 rounded-full', m.bg)} />
                  <span className={cn('text-sm font-semibold', m.text)}>{capitalize(t.color)}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {t.playerIds.map((pid) => {
                    const p = playerMap[pid]
                    if (!p) return null
                    return (
                      <span key={pid} className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 text-xs px-2 py-0.5">
                        <span className={cn('h-4 w-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold', m.bg)}>
                          {initials(p.name)[0]}
                        </span>
                        {p.name.split(' ')[0]}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-slate-700">Record a game</p>
        {MATCHUPS.map(([t1, t2]) => {
          const isActive = activeMatchup?.[0] === t1 && activeMatchup?.[1] === t2
          const m1 = teamMeta(t1)
          const m2 = teamMeta(t2)
          return (
            <div key={`${t1}-${t2}`}>
              <button
                className={cn(
                  'w-full flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white hover:bg-slate-50'
                )}
                onClick={() => setActiveMatchup(isActive ? null : [t1, t2])}
              >
                <span className={cn('font-semibold', m1.text)}>{capitalize(t1)}</span>
                <span className="text-slate-400">vs</span>
                <span className={cn('font-semibold', m2.text)}>{capitalize(t2)}</span>
              </button>
              {isActive && (
                <ScoreEntry
                  team1={t1}
                  team2={t2}
                  onRecord={(s1, s2) => handleRecord(t1, t2, s1, s2)}
                />
              )}
            </div>
          )
        })}
      </div>

      {activeSession.games.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-slate-700">Results</p>
          <Card className="divide-y divide-slate-100">
            {activeSession.games.map((g) => {
              const m1 = teamMeta(g.team1)
              const m2 = teamMeta(g.team2)
              return (
                <div key={g.id} className="flex items-center px-4 py-2.5 gap-2">
                  <span className={cn('text-sm font-bold w-16', m1.text)}>{capitalize(g.team1)}</span>
                  <span className="text-sm font-bold text-slate-800">{g.score1} – {g.score2}</span>
                  <span className={cn('text-sm font-bold', m2.text)}>{capitalize(g.team2)}</span>
                  <span className="text-xs text-slate-400 ml-auto">{formatDate(g.played_at)}</span>
                </div>
              )
            })}
          </Card>
        </div>
      )}

      <SessionHistory sessions={sessions.filter((s) => s.id !== activeSession.id)} />
    </div>
  )
}
