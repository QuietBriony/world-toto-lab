# Operational Smoke Checklist

## 2026-07-08 latest smoke status

- GitHub Pages public route smoke passed with `npm run check:pages` (`failures: 0`).
- Strict real-round route smoke passed with `WORLD_TOTO_LAB_ROUND_ID=47f5d6b8-5120-46a3-b434-7312b11cb98a` and `WORLD_TOTO_LAB_REQUIRE_ROUND=1` (`failures: 0`).
- A real `WORLD_TOTO_LAB_USER_ID` was not available from the public route. The Cloudflare Pages `/api/rounds` probe required a passphrase, so the user-id part remains a separate operator gate.
- No D1 write, delete, schema change, secret read, purchase flow, or settlement flow was attempted.

## 2026-08-06 — user-id smoke の範囲を確定

`WORLD_TOTO_LAB_USER_ID` 付きで再実行し `failures: 0`。あわせて、**この smoke で実 user id を待つ意味はない**ことが分かったので記録する。

- static export なので `?user=<id>` は HTTP ステータスを変えられない。実在しない id（書式のみ有効）でも全 route 200 で、実 id との差が出ない
- つまり `check:pages` が測れるのは **route の到達性まで**。user 固有データが実際に描画されるかは、ブラウザ内の D1 読み取り（クライアント側）で決まるため、この HTTP チェックの射程外
- したがって「実 user id が取れるまで保留」は、このチェックに関しては空振りのゲート。user 固有描画を確認したいなら、ライブ画面での目視か別の検証手段が要る

更新日: 2026-04-21

## 目的

- 実データの Round を 1 本流し込む前に、Pages 配信と共有保存（Cloudflare D1）の最低限の導線が生きているかを短時間で確認する
- 友人向け主導線の `Simple View` / `Friend Pick Room` と、管理導線の `回を作る` / `公式取り込み` を切り分けて確認する

## 事前確認

1. Pages 最新 deploy が success
2. 共有保存を使う場合、ビルド環境に `NEXT_PUBLIC_STORAGE_MODE=cloudflare_d1` / `NEXT_PUBLIC_D1_API_BASE` が入っている
3. 共有保存を使う場合、Worker / D1 が応答する（モードバッジが `Cloudflare共有保存`）
4. 対象 Round ID と、可能なら User ID を 1 本決める

## 自動スモーク

```bash
npm run check:pages
```

必要に応じて環境変数を上書きします。

```bash
WORLD_TOTO_LAB_BASE_URL=https://world-toto-lab.pages.dev
WORLD_TOTO_LAB_ROUND_ID=<いま使う roundId>
WORLD_TOTO_LAB_USER_ID=<optional-user-id>
WORLD_TOTO_LAB_REQUIRE_ROUND=1
npm run check:pages
```

`WORLD_TOTO_LAB_REQUIRE_ROUND=1` を付けると、Round ID 未指定の軽量 route check ではなく、実 Round 導線の確認として扱います。  
User ID は未指定でも 200 確認はできますが、実運用前は友人 1 人分の ID を入れて `Simple View` / `Friend Pick Room` の URL 復元も確認してください。

共有保存（Cloudflare D1）側は、アプリ右下のモードバッジが `Cloudflare共有保存` になり、Round の読み書きが反映されることで確認します。

`ローカル保存` のままになる場合は、`.env.local` の `NEXT_PUBLIC_STORAGE_MODE` / `NEXT_PUBLIC_D1_API_BASE` と、Worker / D1 側の health を確認してから、アプリ右上の `再接続` を押します。

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
- キャリー圧、1等発生確率、上限調整後proxy、真EV未計算が分かれて見える
- 入力欄を変えると概算値が更新される
- `この条件を共有` で開いた URL でも、イベント種別 / snapshot 日付 / イベント名 / 売上 / キャリー / 還元率 / 投下額 / 元ソース が復元される
- **公式同期一覧に BIG系5商品が自動で並ぶ**（貼り付け不要。Cloudflare Pages 配信のみ。github.io では Functions が無いため空になり、貼り付け導線が出るのが正）
  - キャリー表示が公式ページと一致する。特に `-`（前回未抽せん）は **「繰越確定待ち」であって「キャリーなし」ではない**
  - 公式が `0円` と明記している商品だけが「キャリーなし / 見送り」になる

### 2. Round Detail

- `/world-toto-lab/workspace/?round=<roundId>` を開く
- `次にやること` が見える
- 試合未設定なら `この回に試合を入れる`
- `W杯日程から準備する`
- 試合設定済みなら `みんなで見る`
- `Simple View`
- `Friend Pick Room`
- 上記導線が反応し、URL に `round=<roundId>` が残る
- 結果入力済みの回なら `振り返りへ` が見え、`review?round=<roundId>` へ進める

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
- 公式**一覧**（toto 回リスト）の自動同期は廃止済みのため、`公式一覧を同期` は「自動同期は廃止されました」の案内を返す（無反応にならない）
  - BIG くじ情報の自動取得は別系統で、こちらは生きている（下記 `BIGウォッチ` を参照）
- CSV / 手入力 / JSON import で回を取り込める
- `Friend Pick Room`
- 上記ボタン群が無反応でない

### 6. Simple View

- 画面が真っ白にならない
- メンバー切り替え後も URL に `round=<roundId>&user=<userId>` が残る
- `Friend Pick Room` に行ける
- `Advanced View` に戻れる
- `WINNER` / 1試合回なら `WINNER Value` が見える
- 1 / 0 / 2 ボタンが押せる
- 保存後に保存メッセージまたは入力済み数の更新が見える

### 7. Friend Pick Room

- 候補カードが 0 件でも説明文が出る
- `Simple View` に戻れる
- `WINNER` / 1試合回なら `WINNER Value` に行ける
- メンバー切り替えボタンが押せる
- `Data Quality Card` が見える
- 候補カードの `これ推し / 迷う / パス / 自分はこれ / コメント` が保存できる

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
  - まずモードバッジを見る。`Cloudflare共有保存` でないなら共有保存に接続できていない
  - 共有保存なら Worker / D1 の health と `NEXT_PUBLIC_D1_API_BASE` を確認する
- `Round ID が見つかりません`
  - 既存 Round を開く導線なら URL の `round` query を確認
  - 新規作成導線なら `新規Round向け` が出るのが正常
- 共有保存でテーブル不足エラーが出る
  - D1 のマイグレーション未適用が疑わしい。[cloudflare/d1/README.md](../cloudflare/d1/README.md) の手順で `migrations/` を再適用する
- route は 200 だが中身が変
  - `workspace?round=<id>&debug=1` で Debug Panel を見る
- `check:pages` が軽量確認だけで終わる
  - `WORLD_TOTO_LAB_REQUIRE_ROUND=1` と `WORLD_TOTO_LAB_ROUND_ID=<id>` を付けて再実行する

## まだ手動で見るべき項目

- iPhone 実機 Safari のタップ感
- `回を作る` の実データ 1 回分適用
- `Pick Room` の候補自動更新タイミング
