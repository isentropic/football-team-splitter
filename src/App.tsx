import { useState } from 'react'
import { Users, Trophy, Settings } from 'lucide-react'
import { SelectionTab } from '@/tabs/SelectionTab'
import { SplitTab } from '@/tabs/SplitTab'
import { ManageTab } from '@/tabs/ManageTab'
import { cn, loadPlayers, savePlayers } from '@/lib/utils'
import type { Player, SplitVariant } from '@/lib/types'

type Tab = 'select' | 'split' | 'manage'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'select', label: 'Select', icon: Users },
  { id: 'split', label: 'Teams', icon: Trophy },
  { id: 'manage', label: 'Players', icon: Settings },
]

export default function App() {
  const [players, setPlayers] = useState<Player[]>(loadPlayers)
  const [selected, setSelected] = useState<string[]>([])
  const [variants, setVariants] = useState<SplitVariant[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('select')

  const handlePlayersChange = (updated: Player[]) => {
    setPlayers(updated)
    savePlayers(updated)
  }

  const handleGenerate = async () => {
    const selectedPlayers = players.filter((p) => selected.includes(p.id))
    setIsLoading(true)
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
      setVariants([])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto bg-slate-100">
      {/* Header */}
      <header className="bg-emerald-600 text-white px-4 pt-12 pb-4 shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚽</span>
          <div>
            <h1 className="text-lg font-bold leading-tight">Team Splitter</h1>
            <p className="text-emerald-200 text-xs">{players.length} players in roster</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-4 pb-24 overflow-y-auto">
        {activeTab === 'select' && (
          <SelectionTab
            players={players}
            selected={selected}
            onSelectionChange={setSelected}
            onGenerate={handleGenerate}
            isLoading={isLoading}
          />
        )}
        {activeTab === 'split' && (
          <SplitTab
            variants={variants}
            isLoading={isLoading}
            onRegenerate={handleGenerate}
            hasSelection={selected.length === 15}
          />
        )}
        {activeTab === 'manage' && (
          <ManageTab players={players} onChange={handlePlayersChange} />
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t border-slate-200 shadow-lg">
        <div className="flex relative">
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
