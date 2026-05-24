import type { Player } from './types'

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string }
    throw new Error(err.error ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function fetchPlayers(): Promise<Player[]> {
  return handle<Player[]>(await fetch('/api/players'))
}

export async function createPlayer(data: Omit<Player, 'id'>): Promise<Player> {
  return handle<Player>(await fetch('/api/players', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }))
}

export async function updatePlayer(id: string, data: Omit<Player, 'id'>): Promise<Player> {
  return handle<Player>(await fetch(`/api/players/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }))
}

export async function deletePlayer(id: string): Promise<void> {
  return handle<void>(await fetch(`/api/players/${id}`, { method: 'DELETE' }))
}

export async function importPlayers(players: Omit<Player, 'id'>[]): Promise<Player[]> {
  return handle<Player[]>(await fetch('/api/players', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(players),
  }))
}
