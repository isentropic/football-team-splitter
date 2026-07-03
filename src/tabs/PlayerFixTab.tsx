import { Pin, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, overall } from '@/lib/utils'
import type { LockedTeams, Player } from '@/lib/types'

interface Props {
  players: Player[]
  teamCount: number
  lockedTeams: LockedTeams
  onLockedTeamsChange: (locks: LockedTeams) => void
  onApply: () => void
  onSkip: () => void
  isGenerating: boolean
}

const TEAM_OPTIONS = [
  { color: 'orange', label: 'Orange', dot: 'bg-orange-500', selected: 'border-orange-300 bg-orange-50 text-orange-700' },
  { color: 'blue',   label: 'Blue',   dot: 'bg-blue-500',   selected: 'border-blue-300 bg-blue-50 text-blue-700' },
  { color: 'green',  label: 'Green',  dot: 'bg-emerald-500',selected: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  { color: 'white',  label: 'White',  dot: 'bg-white border border-slate-300', selected: 'border-slate-300 bg-white text-slate-700' },
]

export function PlayerFixTab({
  players,
  teamCount,
  lockedTeams,
  onLockedTeamsChange,
  onApply,
  onSkip,
  isGenerating,
}: Props) {
  const teamOptions = TEAM_OPTIONS.slice(0, teamCount)
  const lockCount = Object.keys(lockedTeams).length

  const setLock = (playerId: string, color: string | null) => {
    const next = { ...lockedTeams }
    if (color) next[playerId] = color
    else delete next[playerId]
    onLockedTeamsChange(next)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Pin className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-slate-800">Player fix page</p>
            <p className="text-xs text-slate-500 mt-1">
              Pick players who must start on a specific color. The next step generates balanced teams around them.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
            {lockCount} fixed
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {players.map((player) => (
          <div key={player.id} className="rounded-xl bg-white border border-slate-200 p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm font-semibold text-slate-800 truncate">{player.name}</span>
              <span className="text-xs font-semibold text-slate-500">{overall(player).toFixed(1)}</span>
            </div>
            <div className={cn('grid gap-1.5', teamCount === 4 ? 'grid-cols-5' : 'grid-cols-4')}>
              <button
                className={cn(
                  'h-9 rounded-lg border text-xs font-semibold transition-colors',
                  !lockedTeams[player.id]
                    ? 'border-slate-300 bg-slate-50 text-slate-700'
                    : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600'
                )}
                onClick={() => setLock(player.id, null)}
              >
                Auto
              </button>
              {teamOptions.map((team) => {
                const active = lockedTeams[player.id] === team.color
                return (
                  <button
                    key={team.color}
                    className={cn(
                      'h-9 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1',
                      active ? team.selected : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                    )}
                    onClick={() => setLock(player.id, team.color)}
                  >
                    <span className={cn('h-2.5 w-2.5 rounded-full', team.dot)} />
                    {team.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 flex gap-2 bg-slate-100 pt-2 pb-1">
        <Button variant="outline" className="flex-1" onClick={onSkip} disabled={isGenerating}>
          Skip and generate
        </Button>
        <Button className="flex-1 gap-2" onClick={onApply} disabled={isGenerating}>
          <RefreshCw className={cn('h-4 w-4', isGenerating && 'animate-spin')} />
          {isGenerating ? 'Generating…' : (lockCount > 0 ? 'Generate with fixes' : 'Generate teams')}
        </Button>
      </div>
    </div>
  )
}
