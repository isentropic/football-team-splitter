import { useState } from 'react'
import { Check, Search, X } from 'lucide-react'
import { cn, initials, overall } from '@/lib/utils'
import type { Player } from '@/lib/types'

interface Props {
  players: Player[]
  selected: string[]
  onChange: (ids: string[]) => void
  max?: number  // optional hard cap; when omitted, no limit
}

const avatarColors = [
  'bg-emerald-500', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-orange-500',
]
const colorFor = (name: string) => avatarColors[name.charCodeAt(0) % avatarColors.length]

export function PlayerSelect({ players, selected, onChange, max }: Props) {
  const [query, setQuery] = useState('')

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  )

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id))
    } else if (max === undefined || selected.length < max) {
      onChange([...selected, id])
    }
  }

  const selectedPlayers = players.filter((p) => selected.includes(p.id))

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="Search players…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setQuery('')}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{selected.length}{max !== undefined ? `/${max}` : ''} selected</span>
        {selected.length > 0 && (
          <button className="text-emerald-600 font-medium hover:underline" onClick={() => onChange([])}>
            Clear all
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 py-8 text-sm">No players found</p>
        )}
        {filtered.map((player) => {
          const isSelected = selected.includes(player.id)
          const isFull = max !== undefined && selected.length >= max && !isSelected
          return (
            <button
              key={player.id}
              onClick={() => toggle(player.id)}
              disabled={isFull}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
                isSelected ? 'bg-emerald-50 border border-emerald-200 shadow-sm' : 'bg-white border border-slate-200 hover:border-slate-300',
                isFull && 'opacity-40 cursor-not-allowed'
              )}
            >
              <div className={cn('h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0', colorFor(player.name))}>
                {initials(player.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{player.name}</p>
                <p className="text-xs text-slate-400">
                  PAC {player.pace} · SHO {player.shooting} · PAS {player.passing} · DRI {player.dribbling} · DEF {player.defending} · PHY {player.physique} · MOR {player.morale}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold text-slate-600">{overall(player)}</span>
                <div className={cn('h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all', isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300')}>
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {selectedPlayers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedPlayers.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium px-2.5 py-1">
              {p.name.split(' ')[0]}
              <button onClick={() => toggle(p.id)} className="ml-0.5 hover:text-emerald-600">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
