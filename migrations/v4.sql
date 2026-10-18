CREATE TABLE IF NOT EXISTS award_ballots (
  year INTEGER NOT NULL,
  voter_id TEXT NOT NULL,
  ballot TEXT NOT NULL CHECK (json_valid(ballot)),
  submitted_at INTEGER NOT NULL,
  PRIMARY KEY (year, voter_id)
);
