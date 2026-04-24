# Operational Smoke Checklist

更新日: 2026-04-21

## 目的

- 実データの Round を 1 本流し込む前に、GitHub Pages と Supabase の最低限の導線が生きているかを短時間で確認する
- 友人向け主導線の `Simple View` / `Friend Pick Room` と、管理導線の `回を作る` / `公式取り込み` を切り分けて確認する

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
WORLD_TOTO_LAB_ROUND_ID=<いま使う roundId>
WORLD_TOTO_LAB_USER_ID=<optional-user-id>
npm run check:pages
```

## 手動クリック確認

### 1. Dashboard

- `/world-toto-lab/` を開く
- `本番回を作る` または `回を作る`
- `GOAL3ボード`
- `BIGウォッチ`
- 本番ラウンドがある場合は `みんなで見る` / `候補カード` / `自分の予想`
- 主要ボタンがそれぞれ画面遷移する

### 1.5. BIG Carryover Monitor

- `/world-toto-lab/big-carryover/` を開く
- 概算EV、還元率からの上振れ、損益分岐との差が見える
- 入力欄を変えると概算値が更新される
- `この条件を共有` で開いた URL でも、イベント種別 / snapshot 日付 / イベント名 / 売上 / キャリー / 還元率 / 投下額 / 元ソース が復元される

### 2. Round Detail

- `/world-toto-lab/workspace/?round=<roundId>` を開く
- `次にやること` が見える
- 試合未設定なら `この回に試合を入れる`
- `W杯日程から準備する`
- 試合設定済みなら `みんなで見る`
- `Simple View`
- `Friend Pick Room`
- 上記導線が反応し、URL に `round=<roundId>` が残る

### 3. W杯日程から準備する

- `Round Context` が出る
- 新規導線なら `新規Round向け` と出れば正常
- `ラウンド詳細へ戻る` が押せる
- `13試合を選ぶ` が押せる
- `入力内容を確認` が押せる

### 4. 13試合を選ぶ

- `Round Context` が出る
- `公式日程を取り込む` に戻れる
- `ラウンド詳細へ戻る` が押せる
- fixture がある場合は選択できる

### 5. 回を作る

- `Round Context` が出る
- `ラウンド詳細へ戻る` が押せる
- `作り方を選ぶ` が見える
- `公式toto回から作る` が `回を選ぶ` へ移動する
- `CSV / 手入力で作る` が補完入力セクションを開く
- `公式一覧を同期`
- `同期結果:` が出る、または意味のある警告が出る
- `UNAUTHORIZED_INVALID_JWT_FORMAT` / `Invalid JWT` / 無反応にならない
- `公式一覧を同期してこの回で作る`
- `Friend Pick Room`
- 上記ボタン群が無反応でない

### 6. Simple View

- 画面が真っ白にならない
- `Friend Pick Room` に行ける
- `Advanced View` に戻れる
- `WINNER` / 1試合回なら `WINNER Value` が見える
- 1 / 0 / 2 ボタンが押せる

### 7. Friend Pick Room

- 候補カードが 0 件でも説明文が出る
- `Simple View` に戻れる
- `WINNER` / 1試合回なら `WINNER Value` に行ける
- メンバー切り替えボタンが押せる
- `Data Quality Card` が見える

### 8. WINNER Value Board

- `/winner-value?round=<roundId>` を開く
- `WINNER` / 1試合回なら outcome 比較表が出る
- 公式人気本命、注目 outcome、売上 snapshot、配当原資参考が見える
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
  - 既存 Round を開く導線なら URL の `round` query を確認
  - 新規作成導線なら `新規Round向け` が出るのが正常
- `candidate_tickets` 系の schema cache
  - `supabase/schema.sql` を再適用
- `rounds.competition_type` / `matches.recent_form_note` / `research_memos` 系の不足
  - `supabase/production-hotfix-round-context-research-memos.sql` を Supabase SQL Editor で適用
  - その後 `npm run check:supabase` を再実行
- route は 200 だが中身が変
  - `workspace?round=<id>&debug=1` で Debug Panel を見る

## まだ手動で見るべき項目

- iPhone 実機 Safari のタップ感
- `回を作る` の実データ 1 回分適用
- `Pick Room` の候補自動更新タイミング
