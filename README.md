# World Toto Lab

友人 10 人前後で使う、W杯toto / WINNER 向けの予想・分析・記録・振り返りダッシュボードです。

このリポジトリは **GitHub Pages で配信できる静的フロントエンド** として再構成しています。  
データ保存先は Supabase を使い、GitHub Pages から直接アクセスして共有利用する MVP です。

## このアプリが扱わないもの

- 公式totoの購入代行
- 賭け金管理
- 配当分配
- 代理購入
- ユーザー間の賭博や精算
- 賞金付きランキング表示

UI 上でも以下を常時表示します。

- このサイトは娯楽・分析・記録用です
- 的中や利益を保証するものではありません
- 公式totoの購入代行、賭け金管理、配当分配は行いません
- 19歳未満の利用・購入を想定しません
- 各自の判断で公式サービスを利用してください

## GitHub Pages 向けに変えたこと

### 流用した部分

- 画面要件と注意文言
- Human Consensus / Edge / Review / Ticket Generator の集計ロジック
- 既存の UI コンポーネントとレイアウト

### 外した部分

- Prisma
- SQLite
- Server Actions
- `[roundId]` / `[matchId]` の動的ルート前提

### 最短移行方針

GitHub Pages は静的配信なので、build 後に増える Round を動的ルートで増やし続ける構成と相性がよくありません。  
そのため今回は、**Next.js static export + Supabase + query param 方式**に寄せています。

- 静的 route:
  - `/`
  - `/workspace`
  - `/picks`
  - `/scout-cards`
  - `/consensus`
  - `/edge-board`
  - `/ticket-generator`
  - `/review`
  - `/match-editor`
- 対象 Round は `?round=<id>` で切り替え
- 対象 User は `?user=<id>` で切り替え
- Match Editor は `?round=<id>&match=<id>` で開く

これにより、**GitHub Pages から静的ファイルを配信しつつ、Round 作成・入力・集計は Supabase へ保存**できます。

## 技術スタック

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- Supabase JavaScript client
- GitHub Pages static export

## できること

### 1. Dashboard / Round 一覧

- 開催回一覧
- status
- 試合数
- 入力済み予想数
- 結果確定数
- 人力コンセンサス完成率
- Edge が大きい試合トップ 3
- Round 作成

### 2. Round Detail

- 13 試合の一覧
- Official / Market / Model の 1/0/2 比較
- Edge 1/0/2
- Human F / D / Human Consensus
- AI Recommended
- Category
- バッジ
- Actual Result
- Round 設定更新

### 3. Match Editor

- 試合基本情報
- 公式投票率、外部市場確率、モデル確率
- confidence / category / recommendedOutcomes
- tactical / injury / motivation / admin note

### 4. Human Picks

- 各ユーザーの 13 試合予想入力
- 全員の予想一覧
- 人力投票分布
- 一番割れている試合
- AI 推奨と人間予想の一致率

### 5. Human Scout Card

- 各試合ごとの人力スコアリングカード
- 5 項目 + drawAlert
- 仮結論
- 例外フラグ
- 自動計算の方向スコア F

### 6. Human Consensus Board

- avgF
- medianF
- avgD
- consensusCall
- disagreementScore
- exceptionCount
- 代表メモ

### 7. Edge Board

- 13 試合 × 3 outcome = 39 行
- edge と valueScore の一覧
- Include / Exclude 判断

### 8. Ticket Generator

- 予算入力
- mode 選択
- humanWeight
- maxContrarianMatches
- includeDrawPolicy
- 本線 / バランス / 荒れ狙いの候補比較

### 9. Results & Review

- AI 推奨の的中数
- 人力コンセンサスの的中数
- 公式投票率本命の的中数
- 市場本命の的中数
- 各ユーザーの的中数
- F 方向的中率
- drawAlert / exceptionFlag の振り返り
- 一致 / 対立パターンの振り返り
- 反省メモ

## ローカル起動

### 1. 依存関係を入れる

```bash
npm install
```

### 2. 環境変数を入れる

`.env.example` を参考に `.env.local` を作ってください。

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

### 3. Supabase にテーブルを作る

Supabase SQL Editor で [supabase/schema.sql](/C:/workspace/world-toto-lab/supabase/schema.sql) を実行してください。

### 4. 開発サーバーを起動する

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## GitHub Pages 公開手順

### 1. GitHub リポジトリに公開用の値を入れる

Repository Secrets に以下を設定してください。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. GitHub Pages を GitHub Actions 配信にする

Repository Settings の Pages で `Build and deployment` を `GitHub Actions` にしてください。

### 3. `main` に push する

`.github/workflows/deploy-pages.yml` で `out/` を GitHub Pages へデプロイします。

Next.js 側は `GITHUB_REPOSITORY` を見て `basePath` / `assetPrefix` を自動設定します。  
`<user>.github.io/<repo>/` 形式の project pages を前提にしています。

## Supabase 側の前提

今回は **認証なし共有 MVP** を優先しています。  
そのため `supabase/schema.sql` では、anon クライアントから読み書きできる RLS policy を設定しています。

これは次のトレードオフがあります。

- URL を知っている人は編集できる
- 友人グループ向けの軽量運用には向く
- 公開 URL を広く拡散する用途には向かない

必要になったら次段で Supabase Auth を入れてください。

## Ticket Generator のロジック

この画面は厳密な確率最適化ではなく、買い目候補を並べ替えるためのスコアリングです。

入力:

- `budgetYen`
- `pricePerTicket = 100`
- `maxTickets = budgetYen / 100`
- `mode: conservative / balanced / upset`
- `humanWeight`
- `maxContrarianMatches`
- `includeDrawPolicy`

スコアの考え方:

```text
ticketScore =
sum(log(modelProb_selected_outcome))
+ alpha * sum(edge_selected_outcome)
+ beta * sum(1 - officialVoteShare_selected_outcome)
+ gamma * humanAlignmentScore
- penaltyForTooManyUpsets
```

mode ごとの重み:

- conservative: alpha 0.5 / beta 0.2 / gamma 0.5
- balanced: alpha 1.0 / beta 0.5 / gamma 0.8
- upset: alpha 1.5 / beta 1.0 / gamma 1.0

## Human Scout Card の意味

入力項目:

- ①地力・直近内容
- ②出場可能戦力
- ③開催条件
- ④戦術相性
- ⑤微修正 M
- 引き分け警戒 D

方向スコア:

```text
F = ① + ② + ③ + ④ + M
```

意味:

- F がプラスなら Home / 1 寄り
- F がマイナスなら Away / 2 寄り
- F が ±1 以内で D が高いなら Draw / 0 候補
- D = 2 は強い引き分け警戒

## この MVP でまだやっていないこと

- 認証
- 権限制御つきの共有
- CSV Import
- 外部 API 自動取得
- リアルタイム同期
  - 現状は保存後の再取得と定期再取得で追従します
- 高度な Ticket 最適化
- 金銭、配当、代理購入、精算の扱い

## 補足

- Dashboard からサンプル 10 人を投入できます
- Match Editor は静的 route の都合で `/match-editor?round=...&match=...` です
- GitHub Pages 対応を優先するため、動的 route より query param 方式を採用しています
