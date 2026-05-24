import { useState, useEffect } from 'react'
import { Users, Trophy, Swords, BarChart2, Settings, LogOut } from 'lucide-react'
import { SelectionTab } from '@/tabs/SelectionTab'
import { SplitTab } from '@/tabs/SplitTab'
import { GamesTab } from '@/tabs/GamesTab'
import { StatsTab } from '@/tabs/StatsTab'
import { ManageTab } from '@/tabs/ManageTab'
import { LoginScreen } from '@/components/LoginScreen'
import { cn } from '@/lib/utils'
import { isLoggedIn, clearToken } from '@/lib/auth'
import * as api from '@/lib/api'
import type { Player, SplitVariant, Session, Game } from '@/lib/types'

type Tab = 'select' | 'split' | 'games' | 'stats' | 'manage'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'select', label: 'Select',  icon: Users     },
  { id: 'split',  label: 'Teams',   icon: Trophy    },
  { id: 'games',  label: 'Games',   icon: Swords    },
  { id: 'stats',  label: 'Stats',   icon: BarChart2 },
  { id: 'manage', label: 'Players', icon: Settings  },
]

const ACTIVE_SESSION_KEY = 'fts-active-session'

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn)
  const [players, setPlayers] = useState<Player[]>([])
  const [playersLoading, setPlayersLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [variants, setVariants] = useState<SplitVariant[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('select')
  const [activeSession, setActiveSession] = useState<(Session & { games: Game[] }) | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => {
    if (!loggedIn) return
    api.fetchPlayers()
      .then(setPlayers)
      .catch(console.error)
      .finally(() => setPlayersLoading(false))

    api.fetchSessions()
      .then(setSessions)
      .catch(console.error)

    const savedId = localStorage.getItem(ACTIVE_SESSION_KEY)
    if (savedId) {
      api.fetchSession(savedId)
        .then(setActiveSession)
        .catch(() => localStorage.removeItem(ACTIVE_SESSION_KEY))
    }
  }, [loggedIn])

  if (!loggedIn) {
    return <LoginScreen onLogin={() => setLoggedIn(true)} />
  }

  const handleAdd = async (data: Omit<Player, 'id'>) => {
    const player = await api.createPlayer(data)
    setPlayers((prev) => [...prev, player].sort((a, b) => a.name.localeCompare(b.name)))
  }

  const handleUpdate = async (id: string, data: Omit<Player, 'id'>) => {
    const updated = await api.updatePlayer(id, data)
    setPlayers((prev) => prev.map((p) => (p.id === id ? updated : p)))
  }

  const handleDelete = async (id: string) => {
    await api.deletePlayer(id)
    setPlayers((prev) => prev.filter((p) => p.id !== id))
    setSelected((prev) => prev.filter((s) => s !== id))
  }

  const handleImport = async (rows: Omit<Player, 'id'>[]) => {
    const created = await api.importPlayers(rows)
    setPlayers((prev) => [...prev, ...created].sort((a, b) => a.name.localeCompare(b.name)))
  }

  const handleGenerate = async () => {
    const selectedPlayers = players.filter((p) => selected.includes(p.id))
    setIsGenerating(true)
    setActiveTab('split')
    try {
      const res = await fetch('/api/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: selectedPlayers }),
      })
      const data = await res.json() as { variants: SplitVariant[] }
      setVariants(data.variants ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleLockTeams = async (variant: SplitVariant) => {
    const teams = variant.teams.map((t) => ({
      color: t.color,
      playerIds: t.players.map((p) => p.id),
    }))
    const session = await api.createSession(teams)
    const full = await api.fetchSession(session.id)
    setActiveSession(full)
    setSessions((prev) => [session, ...prev])
    localStorage.setItem(ACTIVE_SESSION_KEY, session.id)
    setActiveTab('games')
  }

  const handleRecordGame = async (
    sessionId: string,
    game: Pick<Game, 'team1' | 'score1' | 'team2' | 'score2'>
  ) => {
    const recorded = await api.recordGame(sessionId, game)
    setActiveSession((prev) => prev ? { ...prev, games: [...prev.games, recorded] } : prev)
  }

  const handleLogout = () => {
    clearToken()
    setLoggedIn(false)
  }

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto bg-slate-100">
      <header className="bg-emerald-600 text-white px-4 pt-12 pb-4 shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚽</span>
          <div className="flex-1">
            <h1 className="text-lg font-bold leading-tight">Team Splitter</h1>
            <p className="text-emerald-200 text-xs">
              {playersLoading ? 'Loading…' : `${players.length} players in roster`}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl hover:bg-emerald-700 transition-colors text-emerald-200 hover:text-white"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-24 overflow-y-auto">
        {playersLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'select' && (
              <SelectionTab
                players={players}
                selected={selected}
                onSelectionChange={setSelected}
                onGenerate={handleGenerate}
                isLoading={isGenerating}
              />
            )}
            {activeTab === 'split' && (
              <SplitTab
                variants={variants}
                isLoading={isGenerating}
                onRegenerate={handleGenerate}
                hasSelection={selected.length === 15}
                onLockTeams={handleLockTeams}
              />
            )}
            {activeTab === 'stats' && <StatsTab />}
            {activeTab === 'games' && (
              <GamesTab
                activeSession={activeSession}
                sessions={sessions}
                players={players}
                onRecordGame={handleRecordGame}
                onNewSession={() => setActiveTab('select')}
              />
            )}
            {activeTab === 'manage' && (
              <ManageTab
                players={players}
                onAdd={handleAdd}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onImport={handleImport}
              />
            )}
          </>
        )}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t border-slate-200 shadow-lg">
        <div className="flex">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors',
                activeTab === id ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              <Icon className={cn('h-5 w-5', activeTab === id && 'stroke-[2.5px]')} />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
