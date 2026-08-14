import { useState } from 'react'
import { Check, GitBranch, Plus, RefreshCw, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, overall } from '@/lib/utils'
import type { Player, SeparationGroups } from '@/lib/types'

interface Props {
  players: Player[]
  teamCount: number
  separationGroups: SeparationGroups
  onSeparationGroupsChange: (groups: SeparationGroups) => void
  onApply: () => void
  onSkip: () => void
  isGenerating: boolean
}

export function PlayerFixTab({
  players,
  teamCount,
  separationGroups,
  onSeparationGroupsChange,
  onApply,
  onSkip,
  isGenerating,
}: Props) {
  const [editingGroupIndex, setEditingGroupIndex] = useState<number | null>(
    separationGroups.length > 0 ? 0 : null,
  )
  const playerById = new Map(players.map((player) => [player.id, player]))
  const validGroups = separationGroups.filter((group) => group.length >= 2)
  const editingGroup = editingGroupIndex === null ? null : separationGroups[editingGroupIndex]
  const usedByOtherGroups = new Set(
    separationGroups.flatMap((group, index) => index === editingGroupIndex ? [] : group),
  )

  const addGroup = () => {
    onSeparationGroupsChange([...separationGroups, []])
    setEditingGroupIndex(separationGroups.length)
  }

  const removeGroup = (index: number) => {
    onSeparationGroupsChange(separationGroups.filter((_, groupIndex) => groupIndex !== index))
    setEditingGroupIndex((current) => {
      if (current === null) return null
      if (current === index) return null
      return current > index ? current - 1 : current
    })
  }

  const togglePlayer = (playerId: string) => {
    if (editingGroupIndex === null || !editingGroup) return
    const selected = editingGroup.includes(playerId)
    if (!selected && (usedByOtherGroups.has(playerId) || editingGroup.length >= teamCount)) return
    const nextGroup = selected
      ? editingGroup.filter((id) => id !== playerId)
      : [...editingGroup, playerId]
    onSeparationGroupsChange(separationGroups.map((group, index) => (
      index === editingGroupIndex ? nextGroup : group
    )))
  }

  const applyGroups = () => {
    const cleaned = validGroups
    if (cleaned.length !== separationGroups.length) onSeparationGroupsChange(cleaned)
    onApply()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
            <GitBranch className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-slate-800">Keep players apart</p>
            <p className="mt-1 text-xs text-slate-500">
              Every player in a group will be placed on a different team. Players can belong to one group only.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
            {validGroups.length} groups
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {separationGroups.map((group, index) => {
          const complete = group.length >= 2
          return (
            <div key={index} className={cn(
              'rounded-xl border bg-white p-3 shadow-sm',
              editingGroupIndex === index ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200',
            )}>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-xs font-bold text-emerald-700">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">Separation group</p>
                  <p className={cn('text-xs', complete ? 'text-slate-500' : 'text-amber-600')}>
                    {group.length}/{teamCount} players {complete ? 'selected' : '— choose at least 2'}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Delete separation group ${index + 1}`}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  onClick={() => removeGroup(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {group.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {group.map((playerId) => (
                    <span key={playerId} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {playerById.get(playerId)?.name ?? 'Unknown player'}
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="mt-3 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                onClick={() => setEditingGroupIndex(index)}
              >
                {editingGroupIndex === index ? 'Editing group' : 'Edit group'}
              </button>
            </div>
          )
        })}
      </div>

      <Button variant="outline" className="gap-2" onClick={addGroup} disabled={isGenerating}>
        <Plus className="h-4 w-4" />
        Add separation group
      </Button>

      {editingGroupIndex !== null && editingGroup && (
        <section className="border-t border-slate-200 pt-4">
          <div className="mb-3 flex items-start gap-2">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Choose group {editingGroupIndex + 1} players</p>
              <p className="text-xs text-slate-500">Choose 2 to {teamCount} players. They will all be on separate teams.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {players.map((player) => {
              const selected = editingGroup.includes(player.id)
              const unavailable = !selected && usedByOtherGroups.has(player.id)
              const atLimit = !selected && editingGroup.length >= teamCount
              return (
                <button
                  key={player.id}
                  type="button"
                  disabled={unavailable || atLimit}
                  onClick={() => togglePlayer(player.id)}
                  className={cn(
                    'flex min-h-12 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors',
                    selected && 'border-emerald-300 bg-emerald-50 text-emerald-800',
                    !selected && !unavailable && !atLimit && 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                    unavailable && 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400',
                    atLimit && 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400',
                  )}
                >
                  <span className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                    selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300',
                  )}>
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">{player.name}</span>
                  <span className="text-[10px] text-slate-400">{overall(player).toFixed(1)}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      <div className="sticky bottom-0 flex gap-2 bg-slate-100 pt-2 pb-1">
        <Button variant="outline" className="flex-1" onClick={onSkip} disabled={isGenerating}>
          Skip and generate
        </Button>
        <Button className="flex-1 gap-2" onClick={applyGroups} disabled={isGenerating}>
          <RefreshCw className={cn('h-4 w-4', isGenerating && 'animate-spin')} />
          {isGenerating ? 'Generating…' : 'Generate teams'}
        </Button>
      </div>
    </div>
  )
}
