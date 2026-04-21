# Operational Smoke Checklist

更新日: 2026-04-21

## 目的

- 実データの Round を 1 本流し込む前に、GitHub Pages と Supabase の最低限の導線が生きているかを短時間で確認する
- 友人向け主導線の `Simple View` / `Friend Pick Room` と、管理導線の `Round Builder` / `公式取り込み` を切り分けて確認する

## 事前確認

1. GitHub Pages 最新 deploy が success
2. `npm run check:supabase` で `critical failures: 0`
3. 対象 Round ID を 1 本決める

## 自動スモーク

```bash
npm run check:pages
```

必要に応じて環境変数を上書きします。

```bash
WORLD_TOTO_LAB_BASE_URL=https://quietbriony.github.io/world-toto-lab
WORLD_TOTO_LAB_ROUND_ID=47f5d6b8-5120-46a3-b434-7312b11cb98a
WORLD_TOTO_LAB_USER_ID=<optional-user-id>
npm run check:pages
```

## 手動クリック確認

### 1. Dashboard

- `/world-toto-lab/` を開く
- `公式日程を取り込む`
- `Fixture Selector`
- `toto を同期して選ぶ`
- `mini toto を同期して選ぶ`
- 4 ボタンがそれぞれ画面遷移する

### 2. Round Detail

- `/world-toto-lab/workspace/?round=<roundId>` を開く
- `Round Builder` が見える
- `toto で作る`
- `mini toto で作る`
- `公式日程を取り込む`
- `Fixture Selector`
- `現在の product で公式回を見る`
- `Simple View`
- `Friend Pick Room`
- 上記導線が反応し、URL に `round=<roundId>` が残る

### 3. Official Schedule Import

- `Round Context` が出る
- `Round Detailへ戻る` が押せる
- `Fixture Selector` が押せる
- `Parse Preview` が押せる

### 4. Fixture Selector

- `Round Context` が出る
- `公式日程を取り込む` に戻れる
- `Round Detailへ戻る` が押せる
- fixture がある場合は選択できる

### 5. Toto Official Round Import

- `Round Context` が出る
- `Round Detailへ戻る` が押せる
- `公式一覧を同期`
- `公式一覧を同期してPick Roomへ`
- `Friend Pick Room`
- 上記ボタン群が無反応でない

### 6. Simple View

- 画面が真っ白にならない
- `Friend Pick Room` に行ける
- `Advanced View` に戻れる
- `winner` / 1試合回なら `WINNER Value` が見える
- 1 / 0 / 2 ボタンが押せる

### 7. Friend Pick Room

- 候補カードが 0 件でも説明文が出る
- `Simple View` に戻れる
- `winner` / 1試合回なら `WINNER Value` に行ける
- メンバー切り替えボタンが押せる
- `Data Quality Card` が見える

### 8. WINNER Value Board

- `/winner-value?round=<roundId>` を開く
- `winner` / 1試合回なら outcome 比較表が出る
- 複数試合回なら `優位ボードへ` の補助導線が見える

### 9. 詳細候補配分

- `/ticket-generator?round=<roundId>` を開く
- `Friend Pick Room`
- `ラウンド詳細`
- 戻り導線が見える

## エラー時の切り分け

- `読み込みに失敗しました`
  - まず `npm run check:supabase`
- `Round ID が見つかりません`
  - URL の `round` query を確認
- `candidate_tickets` 系の schema cache
  - `supabase/schema.sql` を再適用
- route は 200 だが中身が変
  - `workspace?round=<id>&debug=1` で Debug Panel を見る

## まだ手動で見るべき項目

- iPhone 実機 Safari のタップ感
- `Toto Official Round Import` の実データ 1 回分適用
- `Pick Room` の候補自動更新タイミング
