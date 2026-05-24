import { useState } from 'react'
import { Trophy, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn, initials, statBg } from '@/lib/utils'
import type { SplitVariant } from '@/lib/types'

interface Props {
  variants: SplitVariant[]
  isLoading: boolean
  onRegenerate: () => void
  hasSelection: boolean
}

const TEAM_COLORS = [
  { ring: 'ring-emerald-400', bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { ring: 'ring-blue-400', bg: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  { ring: 'ring-violet-400', bg: 'bg-violet-500', light: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
]

const STATS = [
  { key: 'avgAttack' as const, label: 'ATK' },
  { key: 'avgDefense' as const, label: 'DEF' },
  { key: 'avgPhysical' as const, label: 'PHY' },
  { key: 'avgMorale' as const, label: 'MOR' },
]

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 w-7 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', statBg(value))}
          style={{ width: `${(value / 10) * 100}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-slate-700 w-5 text-right">{value.toFixed(1)}</span>
    </div>
  )
}

function VariantCard({ variant, index, defaultOpen }: { variant: SplitVariant; index: number; defaultOpen: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen)

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {index === 0 && <Trophy className="h-4 w-4 text-amber-500" />}
          <span className="font-semibold text-slate-800">Option {index + 1}</span>
          <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
            Balance {(variant.balanceScore * 100).toFixed(0)}%
          </span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {variant.teams.map((team, ti) => {
            const color = TEAM_COLORS[ti]
            return (
              <div key={team.name} className={cn('rounded-xl border p-3', color.light, color.border)}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn('h-3 w-3 rounded-full', color.bg)} />
                  <span className={cn('text-sm font-semibold', color.text)}>{team.name}</span>
                  <span className="text-xs text-slate-400 ml-auto">{team.avgOverall.toFixed(1)} avg</span>
                </div>

                {/* Players */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {team.players.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 text-xs text-slate-700 px-2 py-0.5 font-medium"
                    >
                      <span className={cn('h-4 w-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold', color.bg)}>
                        {initials(p.name)[0]}
                      </span>
                      {p.name.split(' ')[0]}
                    </span>
                  ))}
                </div>

                {/* Stat bars */}
                <div className="flex flex-col gap-1">
                  {STATS.map((s) => (
                    <StatBar key={s.key} label={s.label} value={team[s.key]} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

export function SplitTab({ variants, isLoading, onRegenerate, hasSelection }: Props) {
  if (!hasSelection) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center">
          <Trophy className="h-8 w-8 text-slate-300" />
        </div>
        <p className="text-slate-500 text-sm">Select 15 players in the first tab to generate teams.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-12 w-12 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
        <p className="text-slate-500 text-sm">Generating balanced teams…</p>
      </div>
    )
  }

  if (variants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-slate-500 text-sm">No variants yet.</p>
        <Button onClick={onRegenerate}>Generate</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Top {variants.length} balanced splits</p>
        <Button variant="outline" size="sm" onClick={onRegenerate} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Regenerate
        </Button>
      </div>

      {variants.map((v, i) => (
        <VariantCard key={v.id} variant={v} index={i} defaultOpen={i === 0} />
      ))}
    </div>
  )
}
