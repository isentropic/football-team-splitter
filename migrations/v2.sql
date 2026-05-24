CREATE TABLE IF NOT EXISTS sessions (
  id        TEXT PRIMARY KEY,
  teams     TEXT NOT NULL,
  played_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  team1      TEXT NOT NULL,
  team2      TEXT NOT NULL,
  score1     INTEGER NOT NULL,
  score2     INTEGER NOT NULL,
  played_at  INTEGER NOT NULL
);
