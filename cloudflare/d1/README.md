# Cloudflare D1 schema / migrations

World Toto Lab の `cloudflare_d1` 保存モード用 SQLite スキーマ。

- [schema.sql](schema.sql) — 真実のソース（全テーブル/インデックス/トリガの最終形）
- [migrations/0001_init.sql](migrations/0001_init.sql) — wrangler で適用する初期マイグレーション

`migrations/` の累積結果は `schema.sql` と一致する。

## 設計メモ

- D1 は SQLite 系。Postgres 固有型 / JSONB は使わない。
- 各行は「検索・一意制約に使う列」+「ドメインオブジェクト全体を JSON 化した `data` 列(TEXT)」のハイブリッド。
- `id` は Worker 側で `crypto.randomUUID()` 採番（SQLite に uuid 型は無い）。
- `created_at` / `updated_at` は ISO8601 文字列。`updated_at` は AFTER UPDATE トリガで自動更新。
- すべて `IF NOT EXISTS` の追加方式。破壊的変更は置かない。

## テーブル

`rounds` / `matches` / `picks` / `scout_reports` / `candidate_tickets` /
`candidate_votes` / `review_notes` / `research_memos` / `official_rounds` /
`big_carryover_assumptions`

## 適用方法

[`workers/api`](../../workers/api/) から wrangler で適用する:

```bash
cd workers/api
npm run db:migrate:local    # ローカル
npm run db:migrate:remote   # 本番
```

直接 SQL を流す場合:

```bash
wrangler d1 execute world-toto-lab --file=../../cloudflare/d1/migrations/0001_init.sql --local
```
