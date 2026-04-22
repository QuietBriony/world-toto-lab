# Development

World Toto Lab は、`Next.js 16 App Router + static export + GitHub Pages + Supabase` を前提にした共有 MVP です。  
通常のサーバー常駐アプリとは制約が違うため、開発フローもその前提に合わせます。

## Current Reality

- フロントエンドは `src/app` 配下の Next.js 16 App Router
- 配信は [next.config.ts](../next.config.ts) の `output: "export"` と `trailingSlash: true` を使った GitHub Pages static export
- `basePath` / `assetPrefix` は build 時の `GITHUB_REPOSITORY` を見て決まる
- データは Supabase をブラウザから直接利用する共有 MVP
- 今日の実際の deploy は `main` push 起点
  - `.github/workflows/deploy-pages.yml`: `main` push で Pages を再配信
  - `.github/workflows/deploy-supabase-functions.yml`: `main` push かつ対象 path 変更で Edge Functions を再配備
- 今後の推奨運用は `topic branch -> PR -> main merge`

GitHub の branch protection がまだ完全でなくても、`main` は live deploy branch として扱ってください。  
直 push は緊急 hotfix 以外では避ける前提です。

## Read Before Editing Code

実装前に最低限、次を読んでください。

- ルートの [AGENTS.md](../AGENTS.md)
- [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- この [docs/DEVELOPMENT.md](./DEVELOPMENT.md)
- タスクに関連する `node_modules/next/dist/docs/` のガイド

Next.js の route / config 変更でまず見る候補:

- `node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`
- `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/basePath.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/trailingSlash.md`

## Setup

推奨ローカル環境:

- Node.js 24 系
- npm
- Supabase プロジェクト

初回セットアップ:

1. 依存関係を入れる

```bash
npm ci
```

2. `.env.example` をもとに `.env.local` を作る

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
NEXT_PUBLIC_TOTO_OFFICIAL_ROUND_SYNC_FUNCTION_NAME=sync-toto-official-round-list
```

3. 新規 Supabase プロジェクトを使う場合は `supabase/schema.sql` を適用する
4. 開発サーバーを起動する

```bash
npm run dev
```

## Common Commands

```bash
npm run lint
npm run test
npm run build
npm run audit:schema
npm run check:supabase
npm run check:pages
```

- `lint`: ESLint
- `test`: Vitest
- `build`: static export を含む本番 build 確認
- `audit:schema`: コードと `supabase/schema.sql` の参照整合確認
- `check:supabase`: 接続先 Supabase の主要 relation / column を確認
- `check:pages`: 公開中 GitHub Pages の主要 route を確認

## Verification By Change Type

| 変更内容 | 最低限やること |
| --- | --- |
| `docs/**`, `README.md`, `.github` template のみ | Markdown 差分とリンク表記を見直す |
| UI / 集計ロジック | `npm run lint`, `npm run test`, `npm run build` |
| `repository.ts` / `schema.sql` | 上記に加えて `npm run audit:schema` |
| route / link / Pages まわり | 上記に加えて `npm run check:pages` か live URL 確認 |
| 本番 Supabase 疎通まわり | 上記に加えて `npm run check:supabase` |

実行できなかった確認は、PR に理由を書いて残します。

## Recommended Workflow

1. 最新 `main` を取り込む
2. 1タスク用の branch を切る
3. 触るファイルと触らないファイルを先に決める
4. 関連 docs と既存実装を読んでから小さく実装する
5. 必要な確認を回す
6. 変更理由、影響範囲、未実施確認を添えて PR を出す
7. merge で `main` に入れて deploy する

ブランチ名の目安:

- `main`
- `dev`
- `codex/<task-slug>`
- `docs/<task-slug>`
- `fix/<task-slug>`
- `feat/<task-slug>`

補足:

- `main`: 本番 Pages と Edge Functions の deploy branch
- `dev`: 任意の統合確認 branch。今は自動 preview を出していないので、必要ならローカル `npm run build` と `npm run check:pages` で確認する
- `experiment/*`: 壊して試す branch。review 前提で、本番 merge を急がない

## Branch And Parallel Development Rules

- 1タスク = 1ブランチ
- 1PR = 1目的
- 同じファイルを複数人または複数 AI で同時編集しない
- `main` への直 push は緊急対応だけに限定する
- route 変更、schema 変更、Edge Function 変更は別 PR に分けられるなら分ける

特に直列で触りたいホットスポット:

- `next.config.ts`
- `src/app/layout.tsx`
- `src/lib/round-links.ts`
- `src/lib/repository.ts`
- `src/lib/types.ts`
- `supabase/schema.sql`
- `supabase/functions/**`

## Pages Guardrails

この repo は static export 前提です。壊しやすいポイントは次です。

- `next.config.ts` の `output`, `trailingSlash`, `basePath`, `assetPrefix`
- build 時に存在しない dynamic route を増やすこと
- Server Actions, rewrites, redirects など server 前提の設計に戻すこと
- `basePath` を無視した手書き URL を増やすこと

route を触るときは、まず [src/lib/round-links.ts](../src/lib/round-links.ts) を確認してください。  
現行 route helper は `appRoute`, `buildHref`, `buildRoundHref`, `buildOfficialRoundImportHref` です。

対象切り替えは query param 方式です。

- Round: `?round=<id>`
- User: `?user=<id>`
- Match: `?match=<id>`

`/workspace/<roundId>` のような動的 path に戻さないでください。

## Supabase Guardrails

この MVP は `anon` クライアントから共有 DB を読む構成です。  
つまり、開発ミスがそのまま実データ事故になります。

- `delete` や大量更新は本当に必要かを先に確認する
- スキーマ変更は最小差分で行う
- 既存データの意味を黙って変えない
- hotfix SQL は履歴として残し、`schema.sql` を真実のソースに保つ

## Out Of Scope

この repo で追加しない領域:

- 決済
- 代理購入
- 配当分配
- 精算
- ユーザー間賭博

## Related Docs

- [docs/CONTRIBUTING.md](./CONTRIBUTING.md)
- [docs/AGENTS.md](./AGENTS.md)
- [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- [docs/operational-smoke-checklist.md](./operational-smoke-checklist.md)
