# World Toto Lab — Cloudflare Worker API

World Toto Lab の `cloudflare_d1` 保存モード用 REST API。ブラウザ（GitHub Pages / Cloudflare Pages）は
D1 へ直接接続せず、この Worker 経由でアクセスする。

- 実装: [src/index.ts](src/index.ts)（ルーティング + D1 アクセス）
- CORS: [src/cors.ts](src/cors.ts)（許可 origin のみ反射。ワイルドカード不使用）
- トークン: [src/tokens.ts](src/tokens.ts)（editToken / adminToken は SHA-256 で照合）
- スキーマ/マイグレーション: [`cloudflare/d1/`](../../cloudflare/d1/)

> このサブプロジェクトはルートの Next.js とは独立したツールチェーン（wrangler）。
> ルートの `tsconfig` / `eslint` からは除外されている。型検査は `npm run typecheck` を使う。

## セットアップ

```bash
cd workers/api
npm install

# 1) D1 database を作成（出力された database_id を wrangler.toml の placeholder に貼る）
npm run db:create

# 2) スキーマ適用（ローカル）
npm run db:migrate:local
# 本番:
npm run db:migrate:remote

# 3) ローカル起動
cp .dev.vars.example .dev.vars   # 必要なら ALLOWED_ORIGINS を調整
npm run dev

# 4) デプロイ
npm run deploy
```

デプロイ後の URL（例: `https://world-toto-lab-api.<account>.workers.dev`）を、
フロントの `.env.local` に設定する:

```bash
NEXT_PUBLIC_STORAGE_MODE=cloudflare_d1
NEXT_PUBLIC_D1_API_BASE=https://world-toto-lab-api.<account>.workers.dev
```

## エンドポイント

| Method | Path | 認可 | 説明 |
| --- | --- | --- | --- |
| GET | `/api/health` | public | 死活確認 |
| GET | `/api/rounds` | public | Round 一覧 |
| POST | `/api/rounds` | （新規） | Round 作成 → `shareCode/editToken/adminToken` を返す |
| GET | `/api/rounds/:id` | public | Round 取得 |
| PATCH | `/api/rounds/:id` | edit/admin | Round 更新 |
| GET/POST | `/api/rounds/:id/matches` | public / edit | 試合取得・一括 upsert |
| GET/POST | `/api/rounds/:id/picks` | public / edit | 予想取得・upsert |
| GET/POST | `/api/rounds/:id/scout-reports` | public / edit | Scout Card 取得・upsert |
| GET/POST | `/api/rounds/:id/candidate-tickets` | public / edit | 候補券取得・セット置換 |
| GET/POST | `/api/rounds/:id/candidate-votes` | public / edit | 投票取得・upsert |
| GET/POST | `/api/rounds/:id/review-notes` | public / edit | 振り返り取得・追記 |
| GET/POST | `/api/rounds/:id/research-memos` | public / edit | リサーチメモ取得・保存 |
| DELETE | `/api/rounds/:id/research-memos/:memoId` | edit | リサーチメモ削除 |
| POST | `/api/rounds/:id/ev-assumption` | edit | EV 前提保存 |
| GET | `/api/rounds/:id/export` | public | Round バンドル JSON |
| GET | `/api/state` | public | 全状態（D1 backed repository の読み取り用） |
| GET | `/api/users` | public | グローバルユーザー一覧 |
| POST | `/api/users` | public | ユーザー作成 |
| PATCH | `/api/users/:id` | public | ユーザー更新 |
| DELETE | `/api/users/:id` | public | ユーザー削除（冪等） |
| POST | `/api/import` | （新規） | バンドル取り込み → token を返す |

Round 配下の書き込みは `X-Edit-Token` か `X-Admin-Token` ヘッダが必要（フロントの `d1ApiAdapter` が自動付与）。
`/api/users` のミューテーション（POST/PATCH/DELETE）は現状トークン不要（グローバルユーザーは round スコープ外。多人数運用では将来厳格化予定）。
**Round 削除 API は提供しない**（本番データ保護）。ユーザー削除は冪等（存在しない id でも `{ ok: true }`）。

## 注意

- 実 `database_id` / token は **コミットしない**（`wrangler.toml` は placeholder のまま）。
- 購入代行・賭け金管理・配当分配・ユーザー間賭博は実装しない。
