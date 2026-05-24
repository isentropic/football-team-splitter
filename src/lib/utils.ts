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

export function generateId() {
  return crypto.randomUUID()
}

const STORAGE_KEY = 'fts-players'

export function loadPlayers(): Player[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultPlayers
    return JSON.parse(raw) as Player[]
  } catch {
    return defaultPlayers
  }
}

export function savePlayers(players: Player[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(players))
}

export const defaultPlayers: Player[] = [
  { id: '1', name: 'Alex Martinez', attack: 8, defense: 5, physical: 7, morale: 9 },
  { id: '2', name: 'Ben Johnson', attack: 6, defense: 8, physical: 8, morale: 7 },
  { id: '3', name: 'Carlos Silva', attack: 9, defense: 4, physical: 6, morale: 8 },
  { id: '4', name: 'David Kim', attack: 5, defense: 9, physical: 7, morale: 8 },
  { id: '5', name: 'Erik Petrov', attack: 7, defense: 7, physical: 9, morale: 6 },
  { id: '6', name: 'Felix Wang', attack: 8, defense: 6, physical: 5, morale: 9 },
  { id: '7', name: 'George Brown', attack: 4, defense: 8, physical: 8, morale: 7 },
  { id: '8', name: 'Hassan Ali', attack: 9, defense: 5, physical: 7, morale: 6 },
  { id: '9', name: 'Ivan Petrov', attack: 6, defense: 7, physical: 9, morale: 8 },
  { id: '10', name: 'James Wilson', attack: 7, defense: 6, physical: 6, morale: 9 },
  { id: '11', name: 'Kenji Tanaka', attack: 8, defense: 8, physical: 7, morale: 7 },
  { id: '12', name: 'Lucas Ferreira', attack: 5, defense: 9, physical: 8, morale: 6 },
  { id: '13', name: 'Marco Rossi', attack: 9, defense: 4, physical: 9, morale: 7 },
  { id: '14', name: 'Nathan Scott', attack: 6, defense: 7, physical: 6, morale: 9 },
  { id: '15', name: 'Omar Hassan', attack: 7, defense: 8, physical: 8, morale: 8 },
  { id: '16', name: 'Paulo Salave', attack: 8, defense: 5, physical: 9, morale: 7 },
  { id: '17', name: 'Quentin Dubois', attack: 5, defense: 6, physical: 7, morale: 8 },
  { id: '18', name: 'Rafael Torres', attack: 9, defense: 7, physical: 6, morale: 9 },
  { id: '19', name: 'Stefan Weber', attack: 6, defense: 9, physical: 8, morale: 7 },
  { id: '20', name: 'Tomas Novak', attack: 7, defense: 6, physical: 9, morale: 8 },
]
