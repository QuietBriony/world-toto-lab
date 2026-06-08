-- Migration 0001: initial World Toto Lab D1 schema
--
-- 適用: wrangler d1 migrations apply <DB_NAME> [--local|--remote]
-- このマイグレーションの累積結果は cloudflare/d1/schema.sql と一致する（真実のソース）。
-- すべて IF NOT EXISTS / 追加方式。既存データを壊さない。

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rounds (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'analyzing', 'locked', 'resulted', 'reviewed')),
  share_code TEXT,
  edit_token_hash TEXT,
  admin_token_hash TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY NOT NULL,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  match_no INTEGER NOT NULL,
  home_team TEXT,
  away_team TEXT,
  actual_result TEXT CHECK (actual_result IS NULL OR actual_result IN ('ONE', 'DRAW', 'TWO')),
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS picks (
  id TEXT PRIMARY KEY NOT NULL,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  pick TEXT NOT NULL CHECK (pick IN ('ONE', 'DRAW', 'TWO')),
  note TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS scout_reports (
  id TEXT PRIMARY KEY NOT NULL,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS candidate_tickets (
  id TEXT PRIMARY KEY NOT NULL,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS candidate_votes (
  id TEXT PRIMARY KEY NOT NULL,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  candidate_ticket_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('like', 'maybe', 'pass', 'bought_myself')),
  comment TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS review_notes (
  id TEXT PRIMARY KEY NOT NULL,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  match_id TEXT,
  user_id TEXT,
  note TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS research_memos (
  id TEXT PRIMARY KEY NOT NULL,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  match_id TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS official_rounds (
  id TEXT PRIMARY KEY NOT NULL,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS big_carryover_assumptions (
  id TEXT PRIMARY KEY NOT NULL,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS matches_round_no_idx
  ON matches (round_id, match_no);
CREATE UNIQUE INDEX IF NOT EXISTS picks_round_user_match_idx
  ON picks (round_id, user_id, match_id);
CREATE UNIQUE INDEX IF NOT EXISTS scout_reports_round_user_match_idx
  ON scout_reports (round_id, user_id, match_id);
CREATE UNIQUE INDEX IF NOT EXISTS candidate_tickets_round_label_idx
  ON candidate_tickets (round_id, label);
CREATE UNIQUE INDEX IF NOT EXISTS candidate_votes_round_ticket_user_idx
  ON candidate_votes (round_id, candidate_ticket_id, user_id);
CREATE INDEX IF NOT EXISTS review_notes_round_idx
  ON review_notes (round_id);
CREATE INDEX IF NOT EXISTS research_memos_round_idx
  ON research_memos (round_id);
CREATE UNIQUE INDEX IF NOT EXISTS official_rounds_round_idx
  ON official_rounds (round_id);
CREATE UNIQUE INDEX IF NOT EXISTS big_carryover_round_idx
  ON big_carryover_assumptions (round_id);
CREATE INDEX IF NOT EXISTS rounds_share_code_idx
  ON rounds (share_code);

CREATE TRIGGER IF NOT EXISTS rounds_set_updated_at
AFTER UPDATE ON rounds FOR EACH ROW BEGIN
  UPDATE rounds SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS matches_set_updated_at
AFTER UPDATE ON matches FOR EACH ROW BEGIN
  UPDATE matches SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS picks_set_updated_at
AFTER UPDATE ON picks FOR EACH ROW BEGIN
  UPDATE picks SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS scout_reports_set_updated_at
AFTER UPDATE ON scout_reports FOR EACH ROW BEGIN
  UPDATE scout_reports SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS candidate_tickets_set_updated_at
AFTER UPDATE ON candidate_tickets FOR EACH ROW BEGIN
  UPDATE candidate_tickets SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS candidate_votes_set_updated_at
AFTER UPDATE ON candidate_votes FOR EACH ROW BEGIN
  UPDATE candidate_votes SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS review_notes_set_updated_at
AFTER UPDATE ON review_notes FOR EACH ROW BEGIN
  UPDATE review_notes SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS research_memos_set_updated_at
AFTER UPDATE ON research_memos FOR EACH ROW BEGIN
  UPDATE research_memos SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS official_rounds_set_updated_at
AFTER UPDATE ON official_rounds FOR EACH ROW BEGIN
  UPDATE official_rounds SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS big_carryover_set_updated_at
AFTER UPDATE ON big_carryover_assumptions FOR EACH ROW BEGIN
  UPDATE big_carryover_assumptions SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
END;
