# Agents Guide

この文書は、World Toto Lab で AI を安全に並走させるための repo ローカルルールです。  
最優先は「速さ」ではなく「静的配信と共有データを壊さないこと」です。

## Start Here

AI に実装を任せる前に、最低限次を読んでください。

1. ルートの [AGENTS.md](../AGENTS.md)
2. [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
3. [docs/DEVELOPMENT.md](./DEVELOPMENT.md)
4. タスクに関連する `node_modules/next/dist/docs/` のガイド

特に route / config 変更で読む候補:

- `node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`
- `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/basePath.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/trailingSlash.md`

## Repo Facts You Should Assume

- フロントエンドは Next.js 16 App Router で、`src/app` に route がある
- Pages 配信は static export 前提
- `next.config.ts` で `output: "export"`, `trailingSlash: true`, repo-aware `basePath` と `assetPrefix` を使っている
- route context は動的 path ではなく query param で渡す
  - `?round=<id>`
  - `?user=<id>`
  - `?match=<id>`
- 共通 route helper は [src/lib/round-links.ts](../src/lib/round-links.ts)
  - `appRoute`
  - `buildHref`
  - `buildRoundHref`
  - `buildOfficialRoundImportHref`
- 今日の deploy は `main` push 起点
- 推奨運用は branch + PR
- Supabase は共有 DB で、`anon` からの操作ミスも本番影響になる

## Default Roles

Codex:

- 基本実装担当
- 小さな仕様の具体化
- 画面追加
- 既存コード修正
- `lint` / `test` / `build` の確認

Claude など他 AI:

- 設計レビュー
- 仕様レビュー
- 文言レビュー
- リスク洗い出し

別 AI に直接コードを書かせる場合は、必ず別ブランチ・小 PR・限定ファイルで行います。

## Non-Negotiable Rules

1. 普段の作業では `main` へ直接 push しない
2. 1タスク = 1ブランチ
3. 1PR = 1目的
4. 同じファイルを複数 AI に同時編集させない
5. `repository.ts` / `schema.sql` / `next.config.ts` の同時編集は禁止
6. DB 変更は最小差分にする
7. Supabase 本番データを消さない
8. GitHub Pages の `basePath` と static export を壊さない
9. 決済、代理購入、配当、精算、ユーザー間賭博は実装しない
10. PR には確認内容、影響範囲、未実施項目を書く

## File Ownership Rules

AI を動かす前に、触ってよい範囲を決めます。

例:

- Codex: `src/app/dev-playbook/page.tsx`, `src/lib/round-links.ts`
- Claude: コード変更なし、PR 文面レビューのみ

特にロック対象のホットファイル:

- `next.config.ts`
- `src/app/layout.tsx`
- `src/lib/round-links.ts`
- `src/lib/repository.ts`
- `src/lib/types.ts`
- `supabase/schema.sql`
- `supabase/functions/**`

これらは「1回に1 AI」運用を前提にしてください。

## Good Parallel Examples

- AI A: `docs/**`
- AI B: `src/app/dev-playbook/page.tsx`
- AI C: コード変更なしで仕様レビュー

## Bad Parallel Examples

- AI A と AI B が同時に `src/lib/repository.ts` を編集する
- AI A が `schema.sql`、AI B がそれに依存する `types.ts` を別々に変える
- Claude が大きくコードを書き、Codex が同じ branch で上書きする
- 1つの PR に複数 AI の未整理な差分を混ぜる

## Required Task Hand-Off Template

AI に依頼するときは、最低でも次を書きます。

```text
Goal:
Branch:
Files you may edit:
Files you must not edit:
Out of scope:
Definition of done:
Checks to run:
```

この 7 行がない依頼は、AI 並走事故を起こしやすいです。

## Decision Rules During Implementation

- 想定より修正範囲が広がったら、いったん止めて PR を分割する
- 別 AI の差分が同じファイルに入りそうなら、並走ではなく直列に切り替える
- schema 変更は UI 変更と無理に同じ PR に混ぜない
- hotfix でも、まず「削除せずに足す」方法を優先する

## Supabase Safety Rules

この repo は GitHub Pages から直接 Supabase を使う都合で、`anon` 権限が広いです。  
AI の誤操作がそのまま本番影響になります。

禁止:

- 気軽な `delete`
- 全件更新での掃除
- 既存カラムの意味の黙った変更
- `schema.sql` の全面書き換え

推奨:

- `alter table ... add column if not exists`
- 互換性を残す差分
- 既存データを壊さない追加方式

## Pages And Routing Rules

この app は static export です。

禁止:

- Server Actions 前提の実装
- build 時に出せない動的ルート設計
- `basePath` を無視した手書き URL
- `/workspace/<roundId>` のような path 依存への回帰

推奨:

- `Link` を使う
- `src/lib/round-links.ts` の route 定義を使う
- route を増やしたら `npm run build` と route check を確認する
- query param 方式を維持する

## PR Expectations

PR には最低限、次を書きます。

- 目的
- 変更点
- 影響範囲
- テスト結果または未実施理由
- スクリーンショットやログ
- AI 使用状況

## If Unsure

- まず Codex 単独で小さく進める
- 別 AI はレビュー専用に回す
- ファイル境界が曖昧なら並走しない

速度より、構造を壊さないことを優先します。

## Branch Strategy Reference

- `main`: 本番 deploy branch。通常運用では PR merge だけで更新
- `dev`: 統合確認用。自動 preview はまだ無いのでローカル build で見る
- `feature/*`: 機能追加
- `fix/*`: バグ修正
- `docs/*`: ドキュメント
- `experiment/*`: 試験実装。main へ直接混ぜない
