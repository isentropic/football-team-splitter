DROP TABLE IF EXISTS players;

CREATE TABLE players (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  pace      REAL NOT NULL DEFAULT 5,
  shooting  REAL NOT NULL DEFAULT 5,
  passing   REAL NOT NULL DEFAULT 5,
  dribbling REAL NOT NULL DEFAULT 5,
  defending REAL NOT NULL DEFAULT 5,
  physique  REAL NOT NULL DEFAULT 5,
  morale    REAL NOT NULL DEFAULT 5
);
