# Cloudflare D1 Migration Guide

World Toto Lab の共有保存先を、Supabase に加えて **Cloudflare D1** でも使えるようにするための移行ガイド。

> 方針: いきなり完全移行はしない。`StorageAdapter` 抽象 + localStorage fallback + D1 adapter +
> D1 schema/migration + 本ドキュメントまでが第一段階。実際の Cloudflare account 設定や
> `database_id` 投入は人間が dashboard / wrangler で行う。

関連:
- 監査: [docs/storage-audit.md](./storage-audit.md)
- 抽象層: [`src/lib/storage/`](../src/lib/storage)
- スキーマ: [`cloudflare/d1/`](../cloudflare/d1)
- Worker: [`workers/api/`](../workers/api)

---

## 1. なぜ D1 を使うか

- Supabase Free project が inactive pause される運用上のリスクがある。
- World Toto Lab は友人 10 人程度の規模。重い RDB は不要。
- Cloudflare D1 は serverless SQLite。Cloudflare Pages/Workers から使え、無料枠で十分。
- GitHub Pages（静的配信）はそのまま、データだけ Cloudflare 側に逃がせる。

## 2. Supabase との違い

| 観点 | Supabase | Cloudflare D1 |
| --- | --- | --- |
| DB | PostgreSQL | SQLite 系 |
| 接続 | ブラウザから PostgREST 直叩き（anon key） | ブラウザ→Worker→D1（直接接続しない） |
| 型 | jsonb / timestamptz / uuid 等 | TEXT / INTEGER / REAL（JSON は TEXT） |
| 認可 | RLS（anon が広め） | Worker 側の editToken/adminToken + CORS |
| pause | Free は inactive pause あり | Workers/D1 無料枠は常時 |
| Edge Functions | あり（公式スクレイピング） | 当面は Supabase Functions を併用 |

> D1 では Postgres 固有型・JSONB を使わない。配列/オブジェクトは `JSON.stringify` して TEXT 列に保存し、読み出し時に `JSON.parse` する。

## 3. D1 の無料枠（目安）

- 5GB ストレージ / database
- 1 日あたり 500 万行読み取り・10 万行書き込み（無料枠の目安。最新値は公式を確認）
- World Toto Lab の規模（friends 10 人・round 数十）では十分に収まる。

## 4. Cloudflare Pages / Workers 構成

- 現状ホスティングは GitHub Pages。最初は **Worker API（[`workers/api`](../workers/api)）** だけ追加する。
  - GitHub Pages（静的フロント） → Worker API（`*.workers.dev`） → D1
- 将来 Cloudflare Pages へ移す場合も、Worker の fetch ハンドラを
  `functions/api/[[path]].ts`（Pages Functions）へほぼそのまま移植できる構成にしてある。

実装は共有化済み: ルーティング/D1/認可は [`workers/api/src/handler.ts`](../workers/api/src/handler.ts) の
`handleApiRequest` にあり、Worker（[`workers/api/src/index.ts`](../workers/api/src/index.ts)）と
Pages Functions（[`functions/api/[[path]].ts`](../functions/api/)）の両方が同じ実装を使う。

## 4.5 推奨: Cloudflare Pages + Functions（ダッシュボード方式・ARM64 対応）

> **Windows ARM64 など wrangler CLI が動かない環境ではこちら。** wrangler は `workerd` に依存し、
> 一部プラットフォーム（win32 arm64 等）でローカル実行できない。Pages 方式なら **ビルドは Cloudflare 側**で走るので影響を受けない。tree-doctor / mogri と同じダッシュボード運用に揃う。

すべて Cloudflare ダッシュボード（既存の GitHub 連携アカウントでOK）で完結する。CLI 不要。

1. **D1 作成**: Storage & Databases → D1 → Create database → 名前 `world-toto-lab`。
2. **スキーマ適用**: 作成した D1 → **Console** タブに
   [`cloudflare/d1/migrations/0001_init.sql`](../cloudflare/d1/migrations/0001_init.sql) の中身を貼って Run（wrangler 不要）。
3. **Pages 作成**: Workers & Pages → Create → Pages → **Connect to Git** → `world-toto-lab` を選択。
   Build command `npm run build` / Output directory `out`（Functions は `functions/` を自動検出）。
4. **D1 バインド**: その Pages プロジェクト → Settings → Bindings（または Functions）→ D1 database bindings →
   Variable name **`DB`** → 作成した DB を選択（Production / Preview 両方）。
5. **環境変数**: Settings → Variables and Secrets に
   `NEXT_PUBLIC_STORAGE_MODE=cloudflare_d1`、`NEXT_PUBLIC_D1_API_BASE=https://<project>.pages.dev`。
6. **デプロイ**: push で自動ビルド。完了後 `https://<project>.pages.dev/api/health` が `{"status":"ok"}` を返す。
7. **確認**: アプリの `/settings` で「Cloudflare共有保存：接続OK」、JSON インポートで D1 へ移行可能。

> GitHub Pages 版（`quietbriony.github.io/world-toto-lab`）はそのまま残る（並行運用）。
> 同一オリジン（Pages 配信）なら CORS は不要。別オリジン運用時も `*.pages.dev` / `github.io` は
> [`workers/api/src/cors.ts`](../workers/api/src/cors.ts) で許可済み。

以降の §5〜§7 は **wrangler CLI 方式**（ARM64 以外／CLI を使いたい場合の代替）。

## 5. D1 database 作成手順

```bash
cd workers/api
npm install
npm run db:create        # = wrangler d1 create world-toto-lab
```

出力された `database_id` を [`workers/api/wrangler.toml`](../workers/api/wrangler.toml) の
`database_id = "<fill-in-after-create>"` に貼る。

> 実 `database_id` や token は **コミットしない**。`wrangler.toml` は placeholder のまま git 管理する。

## 6. wrangler 設定

[`workers/api/wrangler.toml`](../workers/api/wrangler.toml):

```toml
name = "world-toto-lab-api"
main = "src/index.ts"
compatibility_date = "2024-11-01"

[[d1_databases]]
binding = "DB"
database_name = "world-toto-lab"
database_id = "<fill-in-after-create>"
migrations_dir = "../../cloudflare/d1/migrations"

[vars]
# ALLOWED_ORIGINS = "https://quietbriony.github.io,https://world-toto-lab.pages.dev"
```

`ALLOWED_ORIGINS` は本番の許可 origin（カンマ区切り）。未設定なら [`src/cors.ts`](../workers/api/src/cors.ts) の既定値。

## 7. migration 実行

```bash
cd workers/api
npm run db:migrate:local    # ローカル（.wrangler 配下の sqlite）
npm run db:migrate:remote   # 本番 D1
```

スキーマの真実のソースは [`cloudflare/d1/schema.sql`](../cloudflare/d1/schema.sql)、
適用単位は [`cloudflare/d1/migrations/0001_init.sql`](../cloudflare/d1/migrations/0001_init.sql)。

## 8. GitHub Pages から Worker API へ接続する方法

1. Worker をデプロイ:
   ```bash
   cd workers/api && npm run deploy
   ```
   URL 例: `https://world-toto-lab-api.<account>.workers.dev`
2. フロントの `.env.local`（および Pages build の env）に設定:
   ```bash
   NEXT_PUBLIC_STORAGE_MODE=cloudflare_d1
   NEXT_PUBLIC_D1_API_BASE=https://world-toto-lab-api.<account>.workers.dev
   ```
3. CORS の許可 origin に GitHub Pages の origin（`https://quietbriony.github.io`）が含まれることを確認。
4. 起動時、`resolveStorageMode`（[`src/lib/storage/index.ts`](../src/lib/storage/index.ts)）が
   D1 API base を検出して `cloudflare_d1` モードになる。

## 9. Supabase から JSON export

既存の JSON export を使う（保存先非依存）。

- UI: Data Mode バッジ → 「JSON」/ Settings から Round ごとに export。
- コード: `StorageAdapter.exportRoundBundle(roundId)` または既存 `exportRoundJson(roundId)`。
- Supabase モードで Round を開き、Round 単位で JSON を書き出す。

## 10. D1 へ import

1. フロントを `cloudflare_d1` モードにする（§8）。
2. Settings / Data Mode の「JSON を読み込む」で、§9 の JSON を読み込む。
   - `StorageAdapter.importRoundBundle(bundle, "copy")` → Worker `POST /api/import`。
   - Worker が D1 に round/matches/picks/scout/candidate/review/research/official/EV を保存し、
     `shareCode/editToken/adminToken` を返す（フロントが localStorage に保管）。
3. `copy` は別 Round として、`overwrite` は同一 round_id へ上書き。

> Supabase → JSON → D1 の一方向移行。Supabase 本番データは消さない。

## 11. rollback 方法

- フロントを元に戻す: `.env.local` の `NEXT_PUBLIC_STORAGE_MODE` / `NEXT_PUBLIC_D1_API_BASE` を外す
  → 自動判定で Supabase（env があれば）or local に戻る。
- D1 を消したい場合のみ（任意）: `wrangler d1 ...` で drop。**Supabase 側は触らない**。
- Worker をやめる: `wrangler delete`（Pages/GitHub Pages 配信には影響しない）。
- いつでも JSON export を取っておけば、保存先間を往復できる。

## 12. localStorage fallback

- D1 API が落ちている / 未設定でも、アプリは真っ白にせず localStorage で継続する。
- 表示メッセージ（想定）: 「Cloudflare共有保存に接続できません。ローカル保存で続けます。」
- 実装: `d1ApiAdapter.health()` が `unreachable` を返す場合、上位（mode 判定 / Settings）で
  localStorage adapter へフォールバックする設計。既存の Supabase fallback と同じ思想。

---

## 受け入れ条件との対応

1. Supabase なしでも localStorage で使える → 既存 fallback 維持
2. Cloudflare D1 API adapter → [`d1ApiAdapter.ts`](../src/lib/storage/d1ApiAdapter.ts)
3. D1 schema/migration → [`cloudflare/d1/`](../cloudflare/d1)
4. GitHub Pages から D1 API へ接続できる設計 → §8 + Worker CORS
5. Data Mode Badge で保存先が分かる → 既存バッジ（cloudflare 表示は後続フェーズで拡張）
6. JSON export/import で Supabase → D1 移行 → §9–10
7. Supabase 本番データを消さない → 一方向移行・削除 API 非提供
8. 本物の token / database_id をコミットしない → placeholder + `.env*` gitignore
9. 既存 Pages を壊さない → 追加方式（既存 repository.ts 不変）
10. 購入代行・賭け金管理・配当分配・ユーザー間賭博は実装しない
