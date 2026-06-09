# Storage Audit — Supabase 依存の洗い出し（移行前スナップショット）

> ⚠️ 状態: 完了済みの履歴メモ。この監査が対象にした Supabase 依存は **すべて撤去済み** で、
> 現在の保存先は **Cloudflare D1（共有）/ localStorage（ローカル）** のみ。Supabase 依存・`supabase/` ディレクトリ・
> `src/lib/supabase.ts`・schema 整合スクリプトはもう存在しない。以下は移行前の状態を記録した資料として残している
> （リンク先のうち `supabase/*` などは削除済み）。移行結果は [docs/CLOUDFLARE_D1_MIGRATION.md](./CLOUDFLARE_D1_MIGRATION.md) を参照。

World Toto Lab の保存（storage）まわりが、どこで Supabase に直接依存していたかを洗い出した監査メモ。
`Supabase 依存を薄くし、Cloudflare D1 を追加できる構造にする`ための前提資料だった。

> 当時の前提: このリポジトリは「Supabase 直結アプリ」ではなく、すでに
> **2層ストレージ抽象（Supabase ⇄ localStorage）+ モード判定 + バッジ + JSON export/import + health check** を持っていた。
> 本監査はその上に `StorageAdapter` 抽象層（[`src/lib/storage/`](../src/lib/storage)）を追加するための整理だった。

## 1. 全体構造

```
UI / hooks (use-app-data.ts)
   └─ repository.ts  ← 公開 facade。各関数が shouldUseLocalRepository() で分岐
        ├─ Supabase（@supabase/supabase-js, PostgREST）   … supabase.ts の client
        └─ local-repository.ts（window.localStorage）       … fallback
   data-mode.ts        ← runtime mode（demo|local|shared）+ preference 判定
   data-mode-provider  ← 起動時 health check / Data Mode Badge / JSON import UI
```

- ディスパッチ実体: [`src/lib/repository.ts`](../src/lib/repository.ts) の各公開関数の冒頭にある
  `if (shouldUseLocalRepository()) return localRepository.localXxx(...)`（約40箇所）。
- `StorageAdapter` という interface オブジェクトは（本対応前は）存在しない。2実装が並走しているだけ。

## 2. すでに存在する仕組み（指示と重複）

| 項目 | 状態 | 場所 |
| --- | --- | --- |
| localStorage fallback | 実装済み | [`local-repository.ts`](../src/lib/local-repository.ts)（`world-toto-lab:v1:*` 15キー） |
| storageMode | `DataMode = demo \| local \| shared`（`cloudflare_d1` 無し） | [`data-mode.ts`](../src/lib/data-mode.ts) |
| Data Mode Badge | 実装済み（共有/ローカル/デモ） | [`data-mode-provider.tsx`](../src/components/app/data-mode-provider.tsx) |
| JSON export/import | 実装済み + UI | `exportRoundJson` / `importRoundJson`（repository.ts） |
| Supabase health check | 実装済み | `checkSupabaseHealth`（supabase.ts） |
| 接続失敗時の継続表示 | 実装済み | data-mode-provider の接続パネル |

## 3. Supabase 直接依存（確認対象ごと）

行番号は監査時点の目安。すべて [`src/lib/repository.ts`](../src/lib/repository.ts) に集中する。
読み取りの入口は round 単位の `getRoundWorkspace` と全体集計の `listDashboardData`。

| 確認対象 | 主な関数（repository.ts） | Supabase テーブル |
| --- | --- | --- |
| Round 取得/保存 | `listDashboardData`, `getRoundWorkspace`, `createRound`, `updateRound`, `deleteRound`/`deleteRoundCascade`, `sharedRoundExists` | `rounds` |
| Match 取得/保存 | `getRoundWorkspace`, `updateMatch`, `bulkUpdateRoundMatches`, `syncRoundMatches`, `saveResults` | `matches` |
| Human Picks | `getRoundWorkspace`, `replacePicks` | `picks` |
| Human Scout Cards | `getRoundWorkspace`, `replaceScoutReports` | `human_scout_reports` |
| Candidate Tickets | `getRoundWorkspace`, `refreshCandidateTicketsForRound`, `replaceCandidateTickets` | `candidate_tickets` |
| Candidate Votes | `getRoundWorkspace`, `upsertCandidateVote` | `candidate_votes` |
| Review Notes | `getRoundWorkspace`, `addReviewNote` | `review_notes` |
| Research Memos | `getRoundWorkspace`, `saveResearchMemo`, `deleteResearchMemo` | `research_memos` |
| Official Round Library | `listTotoOfficialRoundLibrary`, `upsertTotoOfficialRoundLibraryFromSync`, `saveTotoOfficialRoundLibraryEntry`, `saveTotoOfficialRoundImport`, `instantiateTotoOfficialRoundLibraryEntry` | `toto_official_round_library`, `toto_official_rounds`, `toto_official_matches` |
| BIG Carryover assumptions | `getRoundWorkspace`, `saveRoundEvAssumption` | `round_ev_assumptions` |
| Generated Tickets | `getRoundWorkspace`, `replaceGeneratedTickets`, `clearGeneratedTicketsForRound` | `generated_tickets` |
| Users | `listDashboardData`, `createInitialUsers`, `createUser`, `updateUserProfile`, `deleteUserIfInactive`, `replaceDemoUsers` | `users` |
| Fixture Master | `listFixtureMaster`, `saveFixtureMasterEntries`, `createRoundFromFixtures` | `fixture_master` |

## 4. Supabase health check

- [`src/lib/supabase.ts`](../src/lib/supabase.ts) `checkSupabaseHealth()` … `rounds` に `head:true` count クエリで疎通確認。
  エラーを `missing_env / network_error / paused_or_unreachable / schema_mismatch / unknown / ok` に分類。
- [`scripts/check-production-supabase.js`](../scripts/check-production-supabase.js) … 15 テーブルの relation/column を本番疎通確認（CI/手動）。

## 5. Supabase client / env 参照

- client 生成: [`src/lib/supabase.ts`](../src/lib/supabase.ts) `getSupabaseClient()` / `requireSupabaseClient()` / `hasSupabaseEnv()`。
- env:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`（supabase.ts）
  - `NEXT_PUBLIC_TOTO_OFFICIAL_ROUND_SYNC_FUNCTION_NAME`（repository.ts）
  - `NEXT_PUBLIC_BIG_OFFICIAL_WATCH_FUNCTION_NAME`（repository.ts）
  - [`.env.example`](../.env.example)

## 6. Edge Functions（スクレイピング系。ストレージ本体ではない）

- `syncTotoOfficialRoundListFromOfficial` → `${supabaseUrl}/functions/v1/sync-toto-official-round-list`
- `syncBigOfficialWatchFromOfficial` → `${supabaseUrl}/functions/v1/sync-big-official-watch`
- 実体: [`supabase/functions/`](../supabase/functions)
- D1 化しても当面はこの2本を Supabase Functions のまま残す想定（公式サイト取得用のサーバ）。

## 7. migration / schema

- [`supabase/schema.sql`](../supabase/schema.sql)（15テーブル + RLS + triggers）
- [`supabase/migrations/`](../supabase/migrations)
- `supabase/production-hotfix-*.sql`（5本）
- スキーマ整合チェック: [`scripts/check-schema-ref.js`](../scripts/check-schema-ref.js)（`repository.ts` の `.from("x")` と schema.sql の差分）

## 8. localStorage（fallback 実体）

- [`src/lib/local-repository.ts`](../src/lib/local-repository.ts) … `world-toto-lab:v1:*` 名前空間に 15 キー。
  `readArray`/`writeArray`/`readLocalState`/`writeLocalState` + 各 `localXxx` 関数。
- [`src/lib/data-mode.ts`](../src/lib/data-mode.ts) … `world-toto-lab:v1:dataMode` に preference 保存。

## 9. 本対応で追加した抽象層（参考）

- [`src/lib/storage/`](../src/lib/storage) … `StorageAdapter` interface + `local/supabase/d1` adapter + mode 判定。
  既存 `repository.ts` は壊さず、その上に薄く乗せる追加方式。
- [`cloudflare/d1/`](../cloudflare/d1) … D1 schema / migration。
- [`workers/api/`](../workers/api) … D1 backend の Worker API。
- 詳細な移行手順: [docs/CLOUDFLARE_D1_MIGRATION.md](./CLOUDFLARE_D1_MIGRATION.md)

## 10. リスク / 注意

- `repository.ts` / `types.ts` / `supabase/schema.sql` は AGENTS.md のロック対象ホットファイル。改変は小 PR・直列・最小差分。
- Supabase 本番データは削除・全件更新しない。削除 API は当面非実装 or adminToken 必須。
- 実 Cloudflare token / database_id はコミットしない（`.env*` は gitignore 済み、`wrangler.toml` は placeholder）。
- 決済・代理購入・配当分配・精算・ユーザー間賭博は実装しない。
