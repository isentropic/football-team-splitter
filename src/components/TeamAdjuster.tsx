import { useState } from 'react'
import { MoveRight, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, initials } from '@/lib/utils'
import type { SplitVariant, Team, Player } from '@/lib/types'

const STAT_KEYS = ['pace','shooting','passing','dribbling','defending','physique','morale'] as const
type StatKey = typeof STAT_KEYS[number]

const TEAM_COLORS: Record<string, { bg: string; light: string; text: string; border: string; ring: string }> = {
  orange: { bg: 'bg-orange-500', light: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200', ring: 'ring-orange-400' },
  blue:   { bg: 'bg-blue-500',   light: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',   ring: 'ring-blue-400'   },
  green:  { bg: 'bg-emerald-500',light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',ring: 'ring-emerald-400'},
  white:  { bg: 'bg-white border border-slate-300', light: 'bg-white', text: 'text-slate-700', border: 'border-slate-200', ring: 'ring-slate-400' },
}
const COLOR_ORDER = ['orange', 'blue', 'green', 'white']
const RECENT_PAIR_PENALTY_WEIGHT = 0.35
const colorFor = (color: string) => TEAM_COLORS[color] ?? TEAM_COLORS['orange']
const colorName = (color: string) => color.charAt(0).toUpperCase() + color.slice(1)

function recomputeTeam(players: Player[], base: Team): Team {
  const avg = (key: StatKey) =>
    players.length === 0
      ? 0
      : Math.round((players.reduce((s, p) => s + p[key], 0) / players.length) * 10) / 10
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

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

function computeBalance(teams: Team[], recentTeammatePairs: Record<string, number> = {}): number {
  let total = 0
  for (const key of STAT_KEYS) {
    const vals = teams.map((team) => (
      team.players.length === 0
        ? 0
        : team.players.reduce((sum, player) => sum + player[key], 0) / team.players.length
    ))
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    for (const v of vals) total += (v - mean) ** 2
  }

  for (const team of teams) {
    for (let i = 0; i < team.players.length; i++) {
      for (let j = i + 1; j < team.players.length; j++) {
        total += (recentTeammatePairs[pairKey(team.players[i].id, team.players[j].id)] ?? 0) * RECENT_PAIR_PENALTY_WEIGHT
      }
    }
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
  const colorOptions = COLOR_ORDER.filter((color) => variant.teams.some((team) => team.color === color))

  const handleTap = (teamIdx: number, playerId: string) => {
    if (!selected) {
      setSelected({ teamIdx, playerId })
      return
    }
    if (selected.teamIdx === teamIdx && selected.playerId === playerId) {
      setSelected(null)
      return
    }

    // Swap the two players
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
    setBalance(computeBalance(newTeams, variant.recentTeammatePairs))
    setSelected(null)
  }

  const handleMoveToTeam = (teamIdx: number) => {
    if (!selected || selected.teamIdx === teamIdx) return

    // Move selected player to this team without swapping
    const newTeams = teams.map((t) => ({ ...t, players: [...t.players] }))
    const fromTeam = newTeams[selected.teamIdx]
    const toTeam = newTeams[teamIdx]

    const player = fromTeam.players.find((p) => p.id === selected.playerId)!
    fromTeam.players = fromTeam.players.filter((p) => p.id !== selected.playerId)
    toTeam.players = [...toTeam.players, player]

    if (fromTeam.players.length > 0) {
      newTeams[selected.teamIdx] = recomputeTeam(fromTeam.players, fromTeam)
    }
    newTeams[teamIdx] = recomputeTeam(toTeam.players, toTeam)

    setTeams(newTeams)
    setBalance(computeBalance(newTeams, variant.recentTeammatePairs))
    setSelected(null)
  }

  const handleColorChange = (teamIdx: number, color: string) => {
    const current = teams[teamIdx]
    if (current.color === color) return

    const otherIdx = teams.findIndex((team, idx) => idx !== teamIdx && team.color === color)
    const next = teams.map((team) => ({ ...team, players: [...team.players] }))
    next[teamIdx] = { ...next[teamIdx], color, name: colorName(color) }
    if (otherIdx !== -1) {
      next[otherIdx] = { ...next[otherIdx], color: current.color, name: colorName(current.color) }
    }
    setTeams(next)
  }

  const handleConfirm = () => {
    onConfirm({ ...variant, teams, balanceScore: balance })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-slate-800">Final teams</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Player swapping and team color swapping page.
            {' '}
            {selected ? 'Pick another player or team.' : 'Adjust or continue.'}
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          Balance {(balance * 100).toFixed(0)}%
        </span>
      </div>

      {teams.map((team, ti) => {
        const color = colorFor(team.color)
        const canMoveTo = selected !== null && selected.teamIdx !== ti
        return (
          <div key={ti} className={cn('rounded-xl border p-3 transition-all', color.light, color.border, canMoveTo && 'ring-1 ring-inset ring-slate-300')}>
            <div className="flex items-start gap-2 mb-3">
              <button
                className={cn('flex items-center gap-2 min-w-0', canMoveTo && 'cursor-pointer')}
                onClick={() => canMoveTo && handleMoveToTeam(ti)}
              >
                <div className={cn('h-4 w-4 rounded-full shrink-0', color.bg)} />
                <span className={cn('text-sm font-bold truncate', color.text)}>{team.name}</span>
              </button>
              <span className="text-xs text-slate-400 ml-auto whitespace-nowrap">{team.players.length}p · {team.avgOverall.toFixed(1)} avg</span>
              {canMoveTo && (
                <button
                  className={cn('flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full bg-white border', color.text, color.border)}
                  onClick={() => handleMoveToTeam(ti)}
                >
                  <MoveRight className="h-3 w-3" />Move here
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 mb-3">
              <Palette className="h-3.5 w-3.5 text-slate-400" />
              <div className="flex flex-wrap gap-1">
                {colorOptions.map((optionColorName) => {
                  const optionColor = colorFor(optionColorName)
                  const active = optionColorName === team.color
                  return (
                    <button
                      key={optionColorName}
                      onClick={() => handleColorChange(ti, optionColorName)}
                      className={cn(
                        'h-8 rounded-full border px-2.5 text-xs font-semibold flex items-center gap-1.5 transition-colors',
                        active
                          ? cn('bg-white ring-2', optionColor.ring, optionColor.border, optionColor.text)
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                      )}
                    >
                      <span className={cn('h-3 w-3 rounded-full', optionColor.bg)} />
                      {colorName(optionColorName)}
                    </button>
                  )
                })}
              </div>
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
                    {player.name}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="flex gap-2 mt-1">
        <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>Back</Button>
        <Button size="sm" className="flex-1" onClick={handleConfirm}>Start games</Button>
      </div>
    </div>
  )
}
