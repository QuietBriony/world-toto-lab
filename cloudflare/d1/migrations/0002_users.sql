-- Migration 0002: global users table
--
-- アプリは「友人グループ＝共有ユーザー」を round 横断で参照するため、
-- グローバルな users テーブルが必要（picks 等は user_id を参照）。
-- 適用: D1 Console に貼って実行、または wrangler d1 migrations apply。

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
