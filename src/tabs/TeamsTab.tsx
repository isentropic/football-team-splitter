import { useState, useEffect } from 'react'
import { ChevronLeft, AlertTriangle } from 'lucide-react'
import { SelectionTab } from './SelectionTab'
import { SplitTab } from './SplitTab'
import { TeamAdjuster } from '@/components/TeamAdjuster'
import { PlayerFixTab } from './PlayerFixTab'
import type { LockedTeams, Player, SplitVariant } from '@/lib/types'

interface Props {
  players: Player[]
  selected: string[]
  onSelectionChange: (ids: string[]) => void
  lockedTeams: LockedTeams
  onLockedTeamsChange: (locks: LockedTeams) => void
  variants: SplitVariant[]
  isGenerating: boolean
  onGenerate: (locksOverride?: LockedTeams) => void
  onLockTeams: (v: SplitVariant) => void
  hasActiveSession?: boolean
}

export function TeamsTab({
  players,
  selected,
  onSelectionChange,
  lockedTeams,
  onLockedTeamsChange,
  variants,
  isGenerating,
  onGenerate,
  onLockTeams,
  hasActiveSession = false,
}: Props) {
  const [showSplit, setShowSplit] = useState(variants.length > 0)
  const [setupVariant, setSetupVariant] = useState<SplitVariant | null>(null)
  const [showPlayerFix, setShowPlayerFix] = useState(false)

  useEffect(() => {
    if (!isGenerating && variants.length > 0) {
      setShowSplit(true)
      setShowPlayerFix(false)
    }
  }, [isGenerating, variants.length])

  useEffect(() => {
    if (isGenerating) setSetupVariant(null)
  }, [isGenerating])

  useEffect(() => {
    if (selected.length >= 20) return
    if (!Object.values(lockedTeams).includes('white')) return
    onLockedTeamsChange(Object.fromEntries(
      Object.entries(lockedTeams).filter(([, color]) => color !== 'white')
    ))
  }, [lockedTeams, onLockedTeamsChange, selected.length])

  const sessionBanner = hasActiveSession ? (
    <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-px" />
      <p className="text-xs text-amber-700">
        Session in progress — go to <strong>Games</strong> and tap "End session" before locking in new teams.
      </p>
    </div>
  ) : null

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="h-12 w-12 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
        <p className="text-slate-500 text-sm">Generating balanced teams…</p>
      </div>
    )
  }

  if (!showSplit) {
    if (showPlayerFix) {
      const selectedPlayers = players.filter((p) => selected.includes(p.id))
      return (
        <div className="flex flex-col gap-3">
          {sessionBanner}
          <button
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-emerald-600 transition-colors self-start"
            onClick={() => setShowPlayerFix(false)}
          >
            <ChevronLeft className="h-4 w-4" />
            Edit selection
          </button>
          <PlayerFixTab
            players={selectedPlayers}
            teamCount={selected.length >= 20 ? 4 : 3}
            lockedTeams={lockedTeams}
            onLockedTeamsChange={onLockedTeamsChange}
            onApply={() => onGenerate()}
            onSkip={() => {
              onLockedTeamsChange({})
              onGenerate({})
            }}
            isGenerating={isGenerating}
          />
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-3">
        {sessionBanner}
        <SelectionTab
          players={players}
          selected={selected}
          onSelectionChange={onSelectionChange}
          onGenerate={() => setShowPlayerFix(true)}
          isLoading={false}
        />
      </div>
    )
  }

  if (setupVariant) {
    return (
      <div className="flex flex-col gap-3">
        {sessionBanner}
        <button
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-emerald-600 transition-colors self-start"
          onClick={() => setSetupVariant(null)}
        >
          <ChevronLeft className="h-4 w-4" />
          Choose another split
        </button>
        <TeamAdjuster
          variant={setupVariant}
          onConfirm={onLockTeams}
          onCancel={() => setSetupVariant(null)}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {sessionBanner}
      <button
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-emerald-600 transition-colors self-start"
        onClick={() => {
          setShowSplit(false)
          setShowPlayerFix(true)
        }}
      >
        <ChevronLeft className="h-4 w-4" />
        Back to player fix
      </button>
      <SplitTab
        variants={variants}
        isLoading={false}
        onRegenerate={() => onGenerate(lockedTeams)}
        fixedCount={Object.keys(lockedTeams).length}
        hasSelection={selected.length >= 6}
        onUseTeams={setSetupVariant}
        hasActiveSession={hasActiveSession}
      />
    </div>
  )
}
