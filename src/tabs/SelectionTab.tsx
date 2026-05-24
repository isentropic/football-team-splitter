import { Users, Zap } from 'lucide-react'
import { PlayerSelect } from '@/components/PlayerSelect'
import { Button } from '@/components/ui/button'
import { overall } from '@/lib/utils'
import type { Player } from '@/lib/types'

interface Props {
  players: Player[]
  selected: string[]
  onSelectionChange: (ids: string[]) => void
  onGenerate: () => void
  isLoading: boolean
}

const TARGET = 15

export function SelectionTab({ players, selected, onSelectionChange, onGenerate, isLoading }: Props) {
  const canGenerate = selected.length === TARGET
  const selectedPlayers = players.filter((p) => selected.includes(p.id))
  const avgOverall = selectedPlayers.length
    ? (selectedPlayers.reduce((s, p) => s + overall(p), 0) / selectedPlayers.length).toFixed(1)
    : '—'

  return (
    <div className="flex flex-col gap-4">
      {/* Header stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white border border-slate-200 p-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-emerald-600">{selected.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Selected</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-slate-700">{avgOverall}</p>
          <p className="text-xs text-slate-500 mt-0.5">Avg. rating</p>
        </div>
      </div>

      {/* Selection warning */}
      {selected.length > 0 && selected.length !== TARGET && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
          <Users className="h-4 w-4 shrink-0" />
          Select exactly {TARGET} players to generate balanced teams
        </div>
      )}

      <PlayerSelect
        players={players}
        selected={selected}
        onChange={onSelectionChange}
        max={TARGET}
      />

      {/* Sticky generate button */}
      <div className="sticky bottom-0 pt-2 pb-1">
        <Button
          className="w-full h-14 text-base gap-2"
          disabled={!canGenerate || isLoading}
          onClick={onGenerate}
        >
          <Zap className="h-5 w-5" />
          {isLoading ? 'Generating…' : `Generate Teams (${selected.length}/${TARGET})`}
        </Button>
      </div>
    </div>
  )
}
