import { useState, useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import { SelectionTab } from './SelectionTab'
import { SplitTab } from './SplitTab'
import type { Player, SplitVariant } from '@/lib/types'

interface Props {
  players: Player[]
  selected: string[]
  onSelectionChange: (ids: string[]) => void
  variants: SplitVariant[]
  isGenerating: boolean
  onGenerate: () => void
  onLockTeams: (v: SplitVariant) => void
}

export function TeamsTab({ players, selected, onSelectionChange, variants, isGenerating, onGenerate, onLockTeams }: Props) {
  const [showSplit, setShowSplit] = useState(variants.length > 0)

  useEffect(() => {
    if (!isGenerating && variants.length > 0) setShowSplit(true)
  }, [isGenerating, variants.length])

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="h-12 w-12 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
        <p className="text-slate-500 text-sm">Generating balanced teams…</p>
      </div>
    )
  }

  if (!showSplit) {
    return (
      <SelectionTab
        players={players}
        selected={selected}
        onSelectionChange={onSelectionChange}
        onGenerate={onGenerate}
        isLoading={false}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-emerald-600 transition-colors self-start"
        onClick={() => setShowSplit(false)}
      >
        <ChevronLeft className="h-4 w-4" />
        Edit selection
      </button>
      <SplitTab
        variants={variants}
        isLoading={false}
        onRegenerate={onGenerate}
        hasSelection={selected.length >= 6}
        onLockTeams={onLockTeams}
      />
    </div>
  )
}
