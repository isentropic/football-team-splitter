import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Player } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function overall(p: Player) {
  return Math.round(((p.attack + p.defense + p.physical + p.morale) / 4) * 10) / 10
}

export function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function statColor(value: number) {
  if (value >= 8) return 'text-emerald-600'
  if (value >= 6) return 'text-amber-500'
  return 'text-red-500'
}

export function statBg(value: number) {
  if (value >= 8) return 'bg-emerald-500'
  if (value >= 6) return 'bg-amber-400'
  return 'bg-red-400'
}

