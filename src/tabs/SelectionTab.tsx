import { useState } from 'react'
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

const MIN = 6

export function SelectionTab({
  players,
  selected,
  onSelectionChange,
  onGenerate,
  isLoading,
}: Props) {
  const [selectionError, setSelectionError] = useState(false)
  const canGenerate = selected.length >= MIN
  const selectedPlayers = players.filter((p) => selected.includes(p.id))
  const teamCount = selected.length >= 20 ? 4 : selected.length >= 15 ? 3 : 2
  const avgOverall = selectedPlayers.length
    ? (selectedPlayers.reduce((s, p) => s + overall(p), 0) / selectedPlayers.length).toFixed(1)
    : '—'

  const teamSize = selected.length > 0
    ? `${Math.floor(selected.length / teamCount)}${selected.length % teamCount !== 0 ? `–${Math.floor(selected.length / teamCount) + 1}` : ''}`
    : '—'

  const handleSelectionChange = (ids: string[]) => {
    onSelectionChange(ids)
    if (ids.length >= MIN) setSelectionError(false)
  }

  const handleGenerate = () => {
    if (!canGenerate) {
      setSelectionError(true)
      return
    }
    setSelectionError(false)
    onGenerate()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white border border-slate-200 p-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-emerald-600">{selected.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Selected</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-slate-700">{teamSize}</p>
          <p className="text-xs text-slate-500 mt-0.5">Per team</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-slate-700">{avgOverall}</p>
          <p className="text-xs text-slate-500 mt-0.5">Avg rating</p>
        </div>
      </div>

      {/* Warning */}
      {selectionError && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
          <Users className="h-4 w-4 shrink-0" />
          Select at least {MIN} players
        </div>
      )}

      <PlayerSelect
        players={players}
        selected={selected}
        onChange={handleSelectionChange}
      />

      {/* Sticky generate button */}
      <div className="sticky bottom-0 pt-2 pb-1">
        <Button
          className="w-full h-14 text-base gap-2"
          disabled={isLoading}
          onClick={handleGenerate}
        >
          <Zap className="h-5 w-5" />
          {isLoading ? 'Loading…' : `Next: Fix players (${selected.length})`}
        </Button>
      </div>
    </div>
  )
}
