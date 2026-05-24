import type { Player, Session, Game, StatsResponse } from './types'
import { authHeaders } from './auth'

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string }
    throw new Error(err.error ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export async function fetchPlayers(): Promise<Player[]> {
  return handle<Player[]>(await fetch('/api/players'))
}

export async function createPlayer(data: Omit<Player, 'id'>): Promise<Player> {
  return handle<Player>(await fetch('/api/players', {
    method: 'POST',
    headers: { ...JSON_HEADERS, ...authHeaders() },
    body: JSON.stringify(data),
  }))
}

export async function updatePlayer(id: string, data: Omit<Player, 'id'>): Promise<Player> {
  return handle<Player>(await fetch(`/api/players/${id}`, {
    method: 'PUT',
    headers: { ...JSON_HEADERS, ...authHeaders() },
    body: JSON.stringify(data),
  }))
}

export async function deletePlayer(id: string): Promise<void> {
  return handle<void>(await fetch(`/api/players/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  }))
}

export async function importPlayers(players: Omit<Player, 'id'>[]): Promise<Player[]> {
  return handle<Player[]>(await fetch('/api/players', {
    method: 'POST',
    headers: { ...JSON_HEADERS, ...authHeaders() },
    body: JSON.stringify(players),
  }))
}

export async function fetchSessions(): Promise<Session[]> {
  return handle<Session[]>(await fetch('/api/sessions'))
}

export async function fetchSession(id: string): Promise<Session & { games: Game[] }> {
  return handle<Session & { games: Game[] }>(await fetch(`/api/sessions/${id}`))
}

export async function createSession(teams: Session['teams']): Promise<Session> {
  return handle<Session>(await fetch('/api/sessions', {
    method: 'POST',
    headers: { ...JSON_HEADERS, ...authHeaders() },
    body: JSON.stringify({ teams }),
  }))
}

export async function deleteSession(id: string): Promise<void> {
  return handle<void>(await fetch(`/api/sessions/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  }))
}

export async function fetchStats(month?: string): Promise<StatsResponse> {
  const url = month ? `/api/stats?month=${month}` : '/api/stats'
  return handle<StatsResponse>(await fetch(url))
}

export async function deleteGame(id: string): Promise<void> {
  return handle<void>(await fetch(`/api/games/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  }))
}

export async function updateGame(id: string, score1: number, score2: number): Promise<Game> {
  return handle<Game>(await fetch(`/api/games/${id}`, {
    method: 'PATCH',
    headers: { ...JSON_HEADERS, ...authHeaders() },
    body: JSON.stringify({ score1, score2 }),
  }))
}

export async function recordGame(
  sessionId: string,
  game: Pick<Game, 'team1' | 'score1' | 'team2' | 'score2'>
): Promise<Game> {
  return handle<Game>(await fetch(`/api/sessions/${sessionId}/games`, {
    method: 'POST',
    headers: { ...JSON_HEADERS, ...authHeaders() },
    body: JSON.stringify(game),
  }))
}
