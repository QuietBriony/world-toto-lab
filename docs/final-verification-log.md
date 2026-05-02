# Final Verification Log

更新日: 2026-05-02

## 2026-05-02 運用完成版仕上げ

### 対象環境

- Branch: `codex/operational-finish-implementation`
- 目的: 友人10人前後で実回を迷わず回せる運用完成版へ寄せる
- 方針: static export / query param routing / Supabase anon共有MVPを維持し、schema変更なし

### 実装確認

- PR用 CI を追加し、pull request で `lint` / `test` / `audit:schema` / `build` を確認するようにした
- `check:supabase` の未設定時メッセージを改善し、`.env.local` と GitHub Actions secrets の必要値を明示した
- `check:pages` に `WORLD_TOTO_LAB_REQUIRE_ROUND=1` を追加し、実Round smokeと軽量route確認を分けられるようにした
- `RoundRequiredNotice` / `ConfigurationNotice` / `ErrorNotice` に次の行き先を追加した
- `Simple View` / `Play` / `Pick Room` の候補0件時の説明と導線を補強した
- `Review` に候補カードの結果比較を追加した
- `Match Editor` に確率合計ズレの目立つ警告を追加した
- 候補カードの missing model / missing official / EV前提不足 / 確率合計ズレ / 1試合商品 のテストを追加した

### 自動検証

以下を実行し、成功を確認しました。

- `npm run lint`
- `npm run test`
  - 17 files passed
  - 100 tests passed
- `npm run audit:schema`
  - repository tables and `supabase/schema.sql` are consistent
- `npm run build`
  - Next.js 16 static export succeeded
  - 23 static pages generated
- `npm run check:pages`
  - lightweight live Pages route check succeeded
  - failures: 0

### 未完了 / 残リスク

- `npm run check:supabase` はこのローカル環境に `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` が無く、実DB疎通は未実施。
  - 改善後のエラーメッセージで `.env.local` と GitHub Actions secrets の設定手順が出ることは確認済み。
- 実 Round ID / User ID 付きの live Pages smoke は未実施。
  - 実運用前に `WORLD_TOTO_LAB_REQUIRE_ROUND=1` と `WORLD_TOTO_LAB_ROUND_ID=<id>` を付けて再確認する。
- iPhone実機Safariの手動タップ確認は未実施。

## 対象環境

- GitHub Pages: `https://quietbriony.github.io/world-toto-lab`
- Round ID: `47f5d6b8-5120-46a3-b434-7312b11cb98a`
- ブランチ: `main`

## 自動検証

以下を実行し、すべて成功を確認しました。

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run audit:schema`
- `npm run check:pages`

追加確認:

- `/winner-value?round=<id>` が live GitHub Pages で `200` 応答
- `/toto-official-round-import?round=<id>&productType=winner&sourcePreset=toto_official_detail` が live GitHub Pages で `200` 応答
- `/big-carryover?eventType=carryover_event&snapshotDate=2026-04-21...` が live GitHub Pages で `200` 応答

## Playwright 実クリック確認

一時 runner を使って、live GitHub Pages に対して headless Playwright で確認しました。

### desktop flow

1. `/workspace?round=<id>` を開く
2. `次にやること` を開く
3. `W杯日程から準備する` -> `official-schedule-import`
4. `13試合を選ぶ` -> `fixture-selector`
5. `ラウンド詳細へ戻る` -> `workspace`
6. `この回に試合を入れる` -> `toto-official-round-import`
7. `ラウンド詳細へ戻る` -> `workspace`
8. `Simple View` -> `simple-view`
9. `Friend Pick Room` -> `pick-room`
10. `Advanced View` -> `workspace`
11. `/review?round=<id>` を直接開く

結果:

- すべて成功
- `round` query は維持
- 画面遷移は壊れず
- `Round Context` と戻り導線が表示

### iPhone 幅 flow

Playwright の `iPhone 13` 相当 viewport / user-agent / touch 設定で確認しました。

1. `/workspace?round=<id>` を開く
2. `次にやること` を開く
3. `Simple View` へ遷移
4. `1 / 0 / 2` ボタンをタップ
5. `現在の選択` が表示されることを確認
6. `Friend Pick Room` へ遷移
7. `これ推し` ボタンが表示されることを確認

結果:

- タップ導線は成立
- `Simple View` と `Friend Pick Room` は iPhone 幅で主要操作が可能

## 残っている既知項目

- 2026-04-24 時点の workflow は `actions/checkout@v6`, `actions/configure-pages@v6`, `actions/setup-node@v6`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5` へ更新済みです
- 以前記録していた `actions/configure-pages@v5` / `actions/deploy-pages@v4` の Node 20 deprecation warning は、現行 workflow 側では既知残課題ではありません

## 判定

- アプリ本体の導線、公開 route、主要画面遷移、iPhone 幅の主要タップ導線は確認済み
- 現時点の追加確認は、最新 UI の `回を作る` 導線で再スモークすることです
