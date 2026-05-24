import { useState, useRef } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Upload, ArrowUpDown, Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn, overall, statColor, initials } from '@/lib/utils'
import type { Player } from '@/lib/types'

const schema = z.object({
  name: z.string().min(2, 'At least 2 characters'),
  attack: z.number().min(1).max(10),
  defense: z.number().min(1).max(10),
  physical: z.number().min(1).max(10),
  morale: z.number().min(1).max(10),
})
type FormData = z.infer<typeof schema>

const STATS: { key: keyof Omit<FormData, 'name'>; label: string }[] = [
  { key: 'attack', label: 'Attack' },
  { key: 'defense', label: 'Defense' },
  { key: 'physical', label: 'Physical' },
  { key: 'morale', label: 'Morale' },
]

const avatarColors = [
  'bg-emerald-500', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-orange-500',
]
const colorFor = (name: string) => avatarColors[name.charCodeAt(0) % avatarColors.length]

interface PlayerFormProps {
  defaultValues?: FormData
  onSubmit: (data: FormData) => Promise<void>
  onClose: () => void
}

function PlayerForm({ defaultValues, onSubmit, onClose }: PlayerFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? { name: '', attack: 5, defense: 5, physical: 5, morale: 5 },
  })

  const submit = async (data: FormData) => {
    setSubmitting(true)
    try {
      await onSubmit(data)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" placeholder="Player name" {...register('name')} />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>

      {STATS.map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-2">
          <div className="flex justify-between">
            <Label>{label}</Label>
            <span className={cn('text-sm font-bold', statColor(watch(key)))}>{watch(key)}/10</span>
          </div>
          <Controller
            control={control}
            name={key}
            render={({ field }) => (
              <Slider
                min={1} max={10} step={1}
                value={[field.value]}
                onValueChange={([v]) => field.onChange(v)}
              />
            )}
          />
        </div>
      ))}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save player'}
        </Button>
      </div>
    </form>
  )
}

interface Props {
  players: Player[]
  onAdd: (data: Omit<Player, 'id'>) => Promise<void>
  onUpdate: (id: string, data: Omit<Player, 'id'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onImport: (players: Omit<Player, 'id'>[]) => Promise<void>
}

export function ManageTab({ players, onAdd, onUpdate, onDelete, onImport }: Props) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [importing, setImporting] = useState(false)
  const csvRef = useRef<HTMLInputElement>(null)

  const columns: ColumnDef<Player>[] = [
    {
      accessorKey: 'name',
      header: 'Player',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0', colorFor(row.original.name))}>
            {initials(row.original.name)}
          </div>
          <span className="text-sm font-medium text-slate-900 truncate max-w-[100px]">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'attack',
      header: ({ column }) => (
        <button className="flex items-center gap-1 text-xs" onClick={() => column.toggleSorting()}>
          ATK <ArrowUpDown className="h-3 w-3" />
        </button>
      ),
      cell: ({ getValue }) => <StatCell value={getValue() as number} />,
    },
    {
      accessorKey: 'defense',
      header: ({ column }) => (
        <button className="flex items-center gap-1 text-xs" onClick={() => column.toggleSorting()}>
          DEF <ArrowUpDown className="h-3 w-3" />
        </button>
      ),
      cell: ({ getValue }) => <StatCell value={getValue() as number} />,
    },
    {
      accessorKey: 'physical',
      header: ({ column }) => (
        <button className="flex items-center gap-1 text-xs" onClick={() => column.toggleSorting()}>
          PHY <ArrowUpDown className="h-3 w-3" />
        </button>
      ),
      cell: ({ getValue }) => <StatCell value={getValue() as number} />,
    },
    {
      accessorKey: 'morale',
      header: ({ column }) => (
        <button className="flex items-center gap-1 text-xs" onClick={() => column.toggleSorting()}>
          MOR <ArrowUpDown className="h-3 w-3" />
        </button>
      ),
      cell: ({ getValue }) => <StatCell value={getValue() as number} />,
    },
    {
      id: 'overall',
      header: 'OVR',
      accessorFn: (p) => overall(p),
      cell: ({ getValue }) => (
        <span className="font-bold text-sm text-slate-700">{(getValue() as number).toFixed(1)}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <button
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          onClick={(e) => { e.stopPropagation(); setDeleteId(row.original.id) }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ]

  const table = useReactTable({
    data: players,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await onDelete(deleteId)
      setDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = ev.target?.result as string
      const lines = text.trim().split('\n')
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
      const idx = (name: string) => header.findIndex((h) => h === name)

      const rows: Omit<Player, 'id'>[] = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim())
        if (!cols[idx('name')]) continue
        rows.push({
          name: cols[idx('name')],
          attack: Math.min(10, Math.max(1, Number(cols[idx('attack')]) || 5)),
          defense: Math.min(10, Math.max(1, Number(cols[idx('defense')]) || 5)),
          physical: Math.min(10, Math.max(1, Number(cols[idx('physical')]) || 5)),
          morale: Math.min(10, Math.max(1, Number(cols[idx('morale')]) || 5)),
        })
      }

      setImporting(true)
      try {
        await onImport(rows)
      } finally {
        setImporting(false)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Search…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
        </div>
        <Button
          variant="outline" size="icon" className="h-10 w-10 shrink-0"
          onClick={() => csvRef.current?.click()}
          disabled={importing}
        >
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        </Button>
        <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={importCSV} />
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="icon" className="h-10 w-10 shrink-0"><Plus className="h-4 w-4" /></Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add player</DialogTitle></DialogHeader>
            <PlayerForm onSubmit={onAdd} onClose={() => setAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-slate-100 bg-slate-50">
                  {hg.headers.map((h) => (
                    <th key={h.id} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="text-center text-slate-400 py-10 text-sm">
                    No players yet — add one or import a CSV.
                  </td>
                </tr>
              )}
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-emerald-50 active:bg-emerald-100 transition-colors cursor-pointer"
                  onClick={() => setEditingPlayer(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
          {players.length} players total
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editingPlayer} onOpenChange={(o) => !o && setEditingPlayer(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit player</DialogTitle></DialogHeader>
          {editingPlayer && (
            <PlayerForm
              defaultValues={editingPlayer}
              onSubmit={(data) => onUpdate(editingPlayer.id, data)}
              onClose={() => setEditingPlayer(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete player?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500 mb-5">This cannot be undone.</p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatCell({ value }: { value: number }) {
  return <span className={cn('text-sm font-semibold', statColor(value))}>{value}</span>
}
