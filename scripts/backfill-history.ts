#!/usr/bin/env bun
/**
 * Parses stats.txt and generates SQL to backfill historical sessions and games.
 *
 * Usage:
 *   bun scripts/backfill-history.ts > migrations/backfill.sql
 *   bunx wrangler d1 execute football-team-splitter --remote --file=migrations/backfill.sql
 */

import { readFileSync } from 'fs'

const STATS_FILE = process.argv[2] ?? './stats.txt'
const API_BASE = 'https://football-team-splitter.pages.dev'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawSession {
  dateStr: string   // "23.05.26"
  gameLabel: string // "Game 1", "Game 2", …
  players: { blue: string[]; green: string[]; orange: string[] }
  games: { team1: string; score1: number; team2: string; score2: number }[]
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function parseDateStr(dateStr: string, gameNum: number): number {
  const [d, m, y] = dateStr.split('.')
  // Game N offset: noon + (N-1)*30 min so multiple sessions on same day are ordered
  const hour = 12
  const min = (gameNum - 1) * 30
  return new Date(2000 + parseInt(y), parseInt(m) - 1, parseInt(d), hour, min).getTime()
}

// ── TSV parsing ───────────────────────────────────────────────────────────────

// Values to reject when collecting player names from the teams columns
const NOT_PLAYER = new Set([
  'Blue', 'Green', 'Orange', 'Teams',
  'Pts', 'Pts/game', 'GD', 'GD/game', 'GF', 'GF/game', 'GA', 'GA/game',
  '# of games', 'W', 'D', 'L',
])

function isPlayerName(s: string): boolean {
  if (!s || s.trim() === '') return false
  if (NOT_PLAYER.has(s)) return false
  // Reject stat numbers (integers, floats, negatives) — these appear in embedded summary tables
  if (/^-?\d+(\.\d+)?$/.test(s)) return false
  // Reject stat labels with slashes or # (GD/game, # of games, etc.)
  if (s.includes('/') || s.startsWith('#')) return false
  return true
}

function isNum(s: string): boolean {
  return /^\d+$/.test(s)
}

function parseSessions(text: string): RawSession[] {
  const sessions: RawSession[] = []
  let cur: RawSession | null = null
  let ready = false   // true once we've seen the Blue/Green/Orange sub-header

  for (const raw of text.split('\n')) {
    const c = raw.split('\t')
    const col = (i: number) => (c[i] ?? '').trim()

    const c0 = col(0)
    const c1 = col(1)
    const c2 = col(2)
    const c3 = col(3)
    const c4 = col(4)

    // ── Session date header: "Game DD.MM.YY" at col0 ─────────────────────────
    if (/^Game \d{2}\.\d{2}\.\d{2}$/.test(c0)) {
      if (cur && cur.games.length > 0) sessions.push(cur)
      cur = {
        dateStr: c0.slice(5),   // "DD.MM.YY"
        gameLabel: 'Game 1',
        players: { blue: [], green: [], orange: [] },
        games: [],
      }
      ready = false
      continue
    }

    if (!cur) continue

    // ── Sub-header: Blue / Green / Orange at cols 2-4 ─────────────────────────
    if (c2 === 'Blue' && c3 === 'Green' && c4 === 'Orange') {
      const m = raw.match(/Game\s+(\d+)(?!\.)/)   // "Game 1" but not "Game 23.05.26"
      if (m) cur.gameLabel = `Game ${m[1]}`
      ready = true
      continue
    }

    if (!ready) continue

    // ── Game data row: col1 must be a positive integer ────────────────────────
    if (!isNum(c1) || c1 === '0') continue

    // Scores: exactly two of {col2, col3, col4} must be numeric
    const scored: { team: string; score: number }[] = []
    if (isNum(c2)) scored.push({ team: 'blue',   score: parseInt(c2) })
    if (isNum(c3)) scored.push({ team: 'green',  score: parseInt(c3) })
    if (isNum(c4)) scored.push({ team: 'orange', score: parseInt(c4) })

    if (scored.length === 2) {
      cur.games.push({
        team1: scored[0].team, score1: scored[0].score,
        team2: scored[1].team, score2: scored[1].score,
      })
    }

    // Player names: cols 6, 7, 8
    // When col6 is a team color, cols 7-8 are stat numbers — skip the whole row's players
    const p6 = col(6), p7 = col(7), p8 = col(8)
    if (isPlayerName(p6) && !cur.players.blue.includes(p6))   cur.players.blue.push(p6)
    if (isPlayerName(p7) && !cur.players.green.includes(p7))  cur.players.green.push(p7)
    if (isPlayerName(p8) && !cur.players.orange.includes(p8)) cur.players.orange.push(p8)
  }

  if (cur && cur.games.length > 0) sessions.push(cur)

  // File is newest-first; reverse so timestamps are chronological
  return sessions.reverse()
}

// ── Player matching ───────────────────────────────────────────────────────────

function matchName(
  statsName: string,
  dbPlayers: { id: string; name: string }[],
): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/\.$/, '').trim()
  const sn = norm(statsName)

  // 1. Exact (case-insensitive, trailing dot stripped)
  for (const p of dbPlayers) if (norm(p.name) === sn) return p.id

  // 2. DB name starts with stats name  e.g. "Alisher K" → "Alisher Kh."
  for (const p of dbPlayers) if (norm(p.name).startsWith(sn)) return p.id

  // 3. Stats name starts with DB name  e.g. "Baurzhan" → "Baurzhan B."
  for (const p of dbPlayers) if (sn.startsWith(norm(p.name))) return p.id

  // 4. First-word match only when unambiguous
  const fw = sn.split(' ')[0]
  const hits = dbPlayers.filter(p => norm(p.name).split(' ')[0] === fw)
  if (hits.length === 1) return hits[0].id

  return null
}

// ── SQL helpers ───────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/'/g, "''")
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Fetch current players from deployed API
  process.stderr.write('Fetching players from API…\n')
  const res = await fetch(`${API_BASE}/api/players`)
  if (!res.ok) {
    process.stderr.write(`Failed to fetch players: ${res.status}\n`)
    process.exit(1)
  }
  const dbPlayers: { id: string; name: string }[] = await res.json()
  process.stderr.write(`  ${dbPlayers.length} players found in DB\n\n`)

  // Parse stats file
  const text = readFileSync(STATS_FILE, 'utf-8')
  const sessions = parseSessions(text)
  process.stderr.write(`Parsed ${sessions.length} sessions from ${STATS_FILE}\n\n`)

  // Collect all unique player names across all sessions
  const allNames = new Set<string>()
  for (const s of sessions) {
    for (const n of [...s.players.blue, ...s.players.green, ...s.players.orange]) {
      allNames.add(n)
    }
  }

  // Build name → DB id map
  const nameToId = new Map<string, string>()
  const unmatched: string[] = []

  for (const name of allNames) {
    const id = matchName(name, dbPlayers)
    if (id) {
      const dbName = dbPlayers.find(p => p.id === id)!.name
      nameToId.set(name, id)
      if (name !== dbName) {
        process.stderr.write(`  matched  "${name}" → "${dbName}"\n`)
      }
    } else {
      unmatched.push(name)
    }
  }

  if (unmatched.length) {
    process.stderr.write(`\nUnmatched player names (no playerIds will be stored for these):\n`)
    for (const n of unmatched.sort()) process.stderr.write(`  ✗ "${n}"\n`)
  }

  process.stderr.write(`\nMatched ${nameToId.size}/${allNames.size} player names\n\n`)

  // Generate SQL
  const lines: string[] = [
    '-- Backfill: historical sessions and games from stats.txt',
    `-- Generated: ${new Date().toISOString()}`,
    '',
  ]

  let totalGames = 0

  for (const session of sessions) {
    const sessionId = crypto.randomUUID()
    const gameNum = parseInt(session.gameLabel.replace('Game ', '')) || 1
    const playedAt = parseDateStr(session.dateStr, gameNum)

    const teams = [
      {
        color: 'blue',
        playerIds: session.players.blue.map(n => nameToId.get(n)).filter(Boolean),
      },
      {
        color: 'green',
        playerIds: session.players.green.map(n => nameToId.get(n)).filter(Boolean),
      },
      {
        color: 'orange',
        playerIds: session.players.orange.map(n => nameToId.get(n)).filter(Boolean),
      },
    ]

    const label = `${session.dateStr} ${session.gameLabel}`
    lines.push(`-- ${label} (${session.games.length} games)`)
    lines.push(
      `INSERT INTO sessions (id, teams, played_at) VALUES ('${sessionId}', '${esc(JSON.stringify(teams))}', ${playedAt});`
    )

    for (const g of session.games) {
      const gid = crypto.randomUUID()
      lines.push(
        `INSERT INTO games (id, session_id, team1, score1, team2, score2, played_at) VALUES ('${gid}', '${sessionId}', '${g.team1}', ${g.score1}, '${g.team2}', ${g.score2}, ${playedAt});`
      )
      totalGames++
    }

    lines.push('')
  }

  process.stdout.write(lines.join('\n'))

  process.stderr.write(`\nGenerated SQL for:\n`)
  process.stderr.write(`  ${sessions.length} sessions\n`)
  process.stderr.write(`  ${totalGames} games\n`)
  process.stderr.write(`\nRun:\n  bunx wrangler d1 execute football-team-splitter --remote --file=migrations/backfill.sql\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
