import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn, initials } from '@/lib/utils'
import type { SplitVariant, Team, Player } from '@/lib/types'

const STAT_KEYS = ['pace','shooting','passing','dribbling','defending','physique','morale'] as const
type StatKey = typeof STAT_KEYS[number]

const TEAM_COLORS: Record<string, { bg: string; light: string; text: string; border: string; ring: string }> = {
  orange: { bg: 'bg-orange-500', light: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200', ring: 'ring-orange-400' },
  blue:   { bg: 'bg-blue-500',   light: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',   ring: 'ring-blue-400'   },
  green:  { bg: 'bg-emerald-500',light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',ring: 'ring-emerald-400'},
}
const colorFor = (color: string) => TEAM_COLORS[color] ?? TEAM_COLORS['orange']

function recomputeTeam(players: Player[], base: Team): Team {
  const avg = (key: StatKey) =>
    Math.round((players.reduce((s, p) => s + p[key], 0) / players.length) * 10) / 10
  return {
    ...base,
    players,
    avgPace:      avg('pace'),
    avgShooting:  avg('shooting'),
    avgPassing:   avg('passing'),
    avgDribbling: avg('dribbling'),
    avgDefending: avg('defending'),
    avgPhysique:  avg('physique'),
    avgMorale:    avg('morale'),
    avgOverall: Math.round(
      (STAT_KEYS.reduce((s, k) => s + avg(k), 0) / STAT_KEYS.length) * 10
    ) / 10,
  }
}

function computeBalance(teams: Team[]): number {
  let total = 0
  const avgKeys = ['avgPace','avgShooting','avgPassing','avgDribbling','avgDefending','avgPhysique','avgMorale'] as const
  for (const key of avgKeys) {
    const vals = teams.map((t) => t[key])
    const mean = vals.reduce((a, b) => a + b, 0) / 3
    for (const v of vals) total += (v - mean) ** 2
  }
  return 1 / (1 + total)
}

interface Selection { teamIdx: number; playerId: string }

interface Props {
  variant: SplitVariant
  onConfirm: (v: SplitVariant) => void
  onCancel: () => void
}

export function TeamAdjuster({ variant, onConfirm, onCancel }: Props) {
  const [teams, setTeams] = useState<Team[]>(() => variant.teams.map((t) => ({ ...t, players: [...t.players] })))
  const [selected, setSelected] = useState<Selection | null>(null)
  const [balance, setBalance] = useState(variant.balanceScore)

  const handleTap = (teamIdx: number, playerId: string) => {
    if (!selected) {
      setSelected({ teamIdx, playerId })
      return
    }
    if (selected.teamIdx === teamIdx && selected.playerId === playerId) {
      setSelected(null)
      return
    }

    // Perform swap
    const newTeams = teams.map((t) => ({ ...t, players: [...t.players] }))
    const fromTeam = newTeams[selected.teamIdx]
    const toTeam = newTeams[teamIdx]

    const fromIdx = fromTeam.players.findIndex((p) => p.id === selected.playerId)
    const toIdx = toTeam.players.findIndex((p) => p.id === playerId)

    const playerA = fromTeam.players[fromIdx]
    const playerB = toTeam.players[toIdx]

    fromTeam.players[fromIdx] = playerB
    toTeam.players[toIdx] = playerA

    newTeams[selected.teamIdx] = recomputeTeam(fromTeam.players, fromTeam)
    newTeams[teamIdx] = recomputeTeam(toTeam.players, toTeam)

    setTeams(newTeams)
    setBalance(computeBalance(newTeams))
    setSelected(null)
  }

  const handleConfirm = () => {
    onConfirm({ ...variant, teams, balanceScore: balance })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Tap two players to swap them between teams</p>
        <span className="text-xs font-semibold text-emerald-600">Balance {(balance * 100).toFixed(0)}%</span>
      </div>

      {teams.map((team, ti) => {
        const color = colorFor(team.color)
        return (
          <div key={team.name} className={cn('rounded-xl border p-3', color.light, color.border)}>
            <div className="flex items-center gap-2 mb-2">
              <div className={cn('h-3 w-3 rounded-full', color.bg)} />
              <span className={cn('text-sm font-semibold', color.text)}>{team.name}</span>
              <span className="text-xs text-slate-400 ml-auto">{team.avgOverall.toFixed(1)} avg</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {team.players.map((player) => {
                const isSelected = selected?.teamIdx === ti && selected?.playerId === player.id
                const isPending = selected !== null && !isSelected
                return (
                  <button
                    key={player.id}
                    onClick={() => handleTap(ti, player.id)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border text-xs font-medium px-2 py-1 transition-all',
                      isSelected
                        ? cn('bg-white ring-2', color.ring, 'border-transparent scale-105')
                        : isPending && selected?.teamIdx !== ti
                          ? cn('bg-white border-slate-300 opacity-70 hover:opacity-100 hover:border-slate-400')
                          : 'bg-white border-slate-200 hover:border-slate-400',
                    )}
                  >
                    <span className={cn('h-4 w-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold', color.bg)}>
                      {initials(player.name)[0]}
                    </span>
                    {player.name.split(' ')[0]}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="flex gap-2 mt-1">
        <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button size="sm" className="flex-1" onClick={handleConfirm}>Lock in teams</Button>
      </div>
    </div>
  )
}
