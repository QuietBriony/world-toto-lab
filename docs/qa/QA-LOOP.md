# QA-LOOP — 自走QAループ運用メモ

World Toto Lab の機能を「ユーザーストーリー化 → テスト/ビルド検証 → 不具合修正 → 再検証」の
4フェーズで少しずつ回す自走ループの運用ドキュメント。**人間が読むための説明**であり、状態は
[LOOP-STATE.md](./LOOP-STATE.md) と [feature-stories.csv](./feature-stories.csv) が持つ。

## 単一正典

- [feature-stories.csv](./feature-stories.csv) が唯一の正典。1行=1機能ストーリー。
- 列: `ID,区分,機能,ユーザーストーリー,期待挙動(file:line),P1_story,P2_テスト結果,P2_不具合,P3_修正,P4_再テスト,human_gate,備考`
- CSV は全フィールドをダブルクオートで囲む（日本語にカンマ/コロンが入るため）。

## フェーズ

| Phase | 名前 | 1チャンクの作業 | 完了マーク |
| --- | --- | --- | --- |
| 1 | ストーリー化 | `src/app/*/page.tsx` の各ルート＋`src/lib` のロジックから機能を**3〜5件**ユーザーストーリー化。既存 `src/**/*.test.*` を根拠に `期待挙動(file:line)` を埋める。 | `P1_story` |
| 2 | 検証 | `npm test`(vitest) ＋ `npm run lint` ＋ `npm run build` ＋ `npm run check:pages`。必要なら `npm run dev` で各ルートを preview 実走。結果を `P2_テスト結果`、見つけた不具合を `P2_不具合` へ。 | `P2_*` |
| 3 | 修正 | 不具合を**1件だけ** working tree のみで修正 → `npm test`/`npm run lint`/`npm run build` が緑 → `P3_修正`。テストが無い不具合は再発防止に `*.test.*` を1本足す。 | `P3_修正` |
| 4 | 再検証 | 該当テスト＋preview で再検証 → `P4_再テスト`。ページの見た目の好みだけ `human_gate=yes` で人間へ。 | `P4_再テスト` |

毎チャンク CSV と LOOP-STATE を書き換える。フェーズが満了したら `current_phase` を +1。

## ハードルール（このループでも厳守）

ルート [AGENTS.md](../../AGENTS.md) / [docs/AGENTS.md](../AGENTS.md) / [docs/DEVELOPMENT.md](../DEVELOPMENT.md) より:

1. 普段の作業で `main` へ直 push しない（**無人 push は号令まで保留**）。1タスク=1ブランチ / 1PR=1目的。
2. ホットファイルは「1回に1 AI」直列: `next.config.ts` / `src/app/layout.tsx` / `src/lib/round-links.ts` / `src/lib/repository.ts` / `src/lib/types.ts` / `cloudflare/d1/schema.sql` / `workers/api/src/handler.ts`。
3. 共有 D1 の他人データを消さない。schema 変更は最小差分（足す方向）。
4. static export / `basePath` / query-param ルーティングを壊さない。
5. 決済・代理購入・配当・精算・ユーザー間賭博は実装しない。
6. `src/lib/market-sources/**` は別レーン（read-only）。触らない。
7. このループの修正は **Phase 3 で working tree のみ**。コミット/PR は人間の号令まで保留。
8. React Compiler 有効。安定済み計算に手動 `useMemo` を足すと lint エラー。重い純計算は plain `const`。

## 1チャンクの定義

- 毎回 LOOP-STATE と CSV を読み `current_phase` を判定し、**1チャンクだけ**進める。
- Phase 1: 3〜5ストーリー追加。
- Phase 2: 検証コマンド一式を1回し。
- Phase 3: 不具合**1件**修正。
- Phase 4: 該当ストーリーの再検証。
- Phase 4 満了でループ停止し、要約を ledger（無ければ [RESULT.md](./RESULT.md)）に追記。
