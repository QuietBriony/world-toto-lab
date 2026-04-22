# Contributing

World Toto Lab への contribution は歓迎です。  
ただしこの repo は `main` から GitHub Pages と Supabase 運用に直結しているため、変更は小さく、目的を絞って進めます。

## Working Agreement

- 普段の作業は `main` へ直 push せず、branch + PR を使う
- 1タスク = 1ブランチ
- 1PR = 1目的
- 作業前に「どのファイルを触るか」を決める
- 同じファイルを複数人または複数 AI で同時編集しない

現状の workflow は `main` push で deploy します。  
GitHub の設定がまだ緩くても、運用上は `main` を protected branch 相当で扱ってください。

## Good Fits

歓迎する変更:

- UI 改善
- 分析体験の改善
- ドキュメント整備
- データ入力支援
- 既存フローの安全性向上
- GitHub Pages / Supabase 運用改善

Issue を先に切ってほしい変更:

- route 追加や大きな情報設計変更
- `src/lib/repository.ts` や `supabase/schema.sql` を触る変更
- Edge Function の仕様変更
- 複数画面をまたぐ大きな refactor

受けない変更:

- 決済
- 代理購入
- 配当分配
- 精算
- ユーザー間賭博

## Suggested Flow

1. Issue を作るか、既存 Issue に紐づける
2. 作業目的を 1 行で言える状態にする
3. branch を切る
4. 触るファイルと触らないファイルを決める
5. 実装する
6. 必要な確認を回す
7. PR に背景、変更点、影響範囲、未実施確認を書く

ブランチ名の例:

- `main`
- `dev`
- `codex/<task-slug>`
- `docs/<task-slug>`
- `fix/<task-slug>`
- `feature/<task-slug>`
- `experiment/<task-slug>`

## Keep PRs Small

良い PR の例:

- `pick-room` の文言だけ直す
- PR / Issue template を整える
- `schema.sql` に必要最小限の列を 1 つ追加する
- `round-links.ts` のリンク生成だけ修正する

避けたい PR の例:

- UI 改修 + 大規模 refactor + schema 変更 + docs 更新をまとめる
- 「ついで修正」を積み上げて review 観点がぼやける
- route / data / deploy の変更を 1 本に押し込む

## Pages And Supabase Constraints

GitHub Pages:

- この app は static export 前提
- `next.config.ts` の `output: "export"`, `trailingSlash`, `basePath`, `assetPrefix` を壊さない
- route は query param 方式を維持する
- link 生成は `src/lib/round-links.ts` を優先する

Supabase:

- 共有本番データを前提にしている
- 本番データを消さない
- 不要な全件更新をしない
- `schema.sql` の変更は最小差分にする
- schema 変更時は `npm run audit:schema` を確認する

## PR Checklist

PR には最低限、次を含めてください。

- 何を変えたか
- なぜ必要か
- 影響範囲
- テスト結果または未実施理由
- スクリーンショットやログ
- 残課題や懸念があればそのメモ

最低限の確認:

```bash
npm run lint
npm run test
npm run build
```

変更内容に応じて次も使ってください。

```bash
npm run audit:schema
npm run check:supabase
npm run check:pages
```

## AI Collaboration

- Codex を基本実装担当にする
- Claude 等は設計レビュー / 仕様レビューまでを原則にする
- 別 AI に直接コードを書かせるなら、別 branch・小 PR・限定ファイルで行う
- 同じファイルを複数 AI に同時編集させない

## Review Criteria

- 1PR 1目的になっているか
- Pages / `basePath` / static export を壊していないか
- Supabase 本番データに危険がないか
- 並走ルールを破っていないか
- 仕様より refactor の比重が大きくなっていないか

## Related Docs

- [docs/DEVELOPMENT.md](./DEVELOPMENT.md)
- [docs/AGENTS.md](./AGENTS.md)
- [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
