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
- Human Consensus / 優位ボード / Review / 候補配分 の集計ロジック
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
  - `/big-carryover`
  - `/picks`
  - `/scout-cards`
  - `/consensus`
  - `/edge-board`
  - `/ticket-generator`
  - `/review`
  - `/match-editor`
  - `/official-schedule-import`
  - `/fixture-selector`
  - `/toto-official-round-import`
  - `/simple-view`
  - `/pick-room`
  - `/winner-value`
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
- 試合日程のまとめ貼り付け入力
- 公式人気 / 市場確率からの AI まとめ試算
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
- キックオフ予定が入った試合は Dashboard の「今後の試合予定」に表示
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

### 7. 優位ボード

- 13 試合 × 3 outcome = 39 行
- 一般人気 / AI / 予想者 / ウォッチ支持 / 合成優位の一覧
- コア候補 / ダークホース / 監視候補の判定

### 8. 詳細候補配分

- 上位候補数
- mode 選択
- humanWeight
- maxContrarianMatches
- includeDrawPolicy
- 本線 / バランス / 荒れ狙いの配分案比較
- `Friend Pick Room` より細かく理由タグや内部スコアを見たいときの管理寄り画面

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

### 10. Fixture Master / 公式日程取り込み

- `Official Schedule Import Wizard` で FIFA公式記事 URL からその場で日程を取得できます
- `FIFA抽出ブックマーク` または抽出スクリプトで、FIFA公式ページの本文をこの画面へ持ち帰れます
- `Fixture Master` に保存
- `Fixture Selector` で試合を選び、`toto / mini toto / WINNER / custom` の Round を作成
- main は `FIFA公式 API -> article richtext -> date/match line 抽出` で、fallback として body text 抽出も残しています

### 11. Toto Official Round Import

- `Toto Official Round Import` で対象試合 CSV / TSV を preview
- 公式投票率 `0.52 / 52% / 52` をすべて受け付けます
- 合計が 1 から大きくズレる場合は警告します
- `toto_official_rounds / toto_official_matches` に公式スナップショットを保存しつつ、既存 `matches` にも同期します
- 売上・キャリー・配当前提は `round_ev_assumptions` に反映します

### 12. Candidate Cards / Friend Pick Room

- `Friend Pick Room` は友人向けのシンプル画面です
- 表示候補は数本だけです。大量購入を促すための画面ではありません
- 候補カードは次を並べます
  - 王道モデル
  - 公式人気
  - 人力コンセンサス
  - EVハンターA〜E
  - 眠ってる期待値
  - 引き分け警報
  - 荒れ狙い
- 友人は `これ推し / 迷う / パス / 自分はこれで買った / コメント` を記録できます
- `買った` は記録だけで、決済や精算は扱いません

### 13. Simple View / 自分の13予想

- `Simple View` は友人向けの軽い閲覧・入力画面です
- 13試合または N試合の一覧
- 自分の `1 / 0 / 2` をその場で保存
- 公式人気、AI候補、人力コンセンサス、引き分け警報を補助表示
- 入力後は AI一致率、人力一致率、公式人気一致率、逆張り数、引き分け数を見られます

### 14. WINNER Value Board

- `WINNER Value Board` は 1試合の `1 / 0 / 2` を outcome 単位で見比べる画面です
- `official vote` の本命と、AI が注目している outcome を同じ場所で確認できます
- `売上 / キャリー / 配当原資参考` は `toto公式取り込み` または `EV計算前提` の snapshot を表示します
- `EV計算前提` がある場合は、公式値ではなく分析 snapshot を優先します

### 15. BIG Carryover Monitor

- `BIG Carryover Monitor` は Round とは別の運用ページです
- `BIG event / carryover event` を shareable な snapshot として管理し、話題回の熱さをざっくり比較します
- `イベント種別` と `snapshot 日付` を持てるので、キャリー監視と高還元ウォッチを分けて残せます
- `この条件を共有` で、イベント種別 / snapshot 日付 / 売上 / キャリー / 還元率 / 投下額 / 元ソース をまとめて復元できます

## EV と Proxy

### 推定EVの計算式

```text
pModelCombo(t) = Π modelProb_i(selectedOutcome_i)
pPublicCombo(t) = Π officialVote_i(selectedOutcome_i)

totalTicketsEstimate = totalSalesYen / stakeYen
firstPrizePoolEstimate = totalSalesYen * returnRate * firstPrizeShare + carryoverYen
expectedOtherWinners = max(0, (totalTicketsEstimate - 1) * pPublicCombo)
estimatedPayoutIfHit = firstPrizePoolEstimate / (1 + expectedOtherWinners)

if payoutCapYen is set:
  estimatedPayoutIfHit = min(estimatedPayoutIfHit, payoutCapYen)

grossEVYen = pModelCombo * estimatedPayoutIfHit
evMultiple = grossEVYen / stakeYen
evPercent = evMultiple * 100
```

### EV Proxy とは

売上や配当原資の前提が未入力のときは、厳密 EV を出さず `Proxy` 表示にします。

```text
proxyScore =
sum(log(modelProb_selected))
+ alpha * sum(modelProb_selected - officialVote_selected)
+ beta * sum(1 - officialVote_selected)
+ gamma * humanAlignmentScore
- upsetPenalty
```

- `officialVote` が不足していると Proxy 寄りになります
- `totalSalesYen` が未入力なら厳密 EV は出しません
- `EV 200%以上候補なし` をそのまま表示します
- 無理に候補を捏造しません

### なぜ推定EVは保証ではないか

- モデル確率、公式人気、売上想定、キャリー、配当原資想定はすべて入力値依存です
- 実際の購入分布や同着人数は事前に確定しません
- そのため、的中や利益を保証するものではありません

## 公式データとデモデータ

- `Fixture Master` は `source` と `dataConfidence` を持ちます
- `Round` 側でも `roundSource` を保持します
- `Friend Pick Room` では `FIFA公式日程 / toto公式対象 / 手入力 / デモ / Proxy EV` などの由来を表示します
- デモデータが混じる Round では「本番分析には使わないでください」と明示します
- 公式人気が未入力の試合がある場合は「EVはProxy表示です」と出します

## Official Flow

### 1. FIFA公式日程の取り込み方法

1. `Official Schedule Import Wizard` を開く
2. 既定で入っている FIFA公式日程 URL を確認して、`この画面で取得` を押します
3. FIFA公式 API から本文を読み、date / match line を自動で preview に入れます
4. home / away / date / group / venue を確認します
5. `Fixture Master` に保存します

補足:
- main 導線は FIFA公式 API の article richtext を読むので、スマホでも別タブ往復なしで使えます
- もし直接取得が通らない環境では、fallback の `FIFA抽出ブックマーク` または抽出スクリプトを使えます

### 2. Fixture Master とは何か

- W杯全体の日程を再利用可能なマスターデータとして持つテーブルです
- Round はこのマスターから何度でも組み直せます

### 3. 公式日程から Round を作る方法

1. `Fixture Selector` を開く
2. 試合をチェックする
3. 13試合なら `toto`、5試合なら `mini toto`、1試合なら `WINNER`、それ以外は `custom` を選ぶ
4. Round を作成する

### 4. toto公式対象試合を取り込む方法

1. `Toto Official Round Import` を開く
2. 対象試合 CSV / TSV を貼る
3. 公式人気や fixture candidate を確認する
4. 保存して Round に反映する

### 5. 公式人気・売上・キャリーの入力方法

- 対象試合ごとの `official_vote_1 / 0 / 2`
- Round ごとの `stakeYen / totalSalesYen / returnRate / firstPrizeShare / carryoverYen / payoutCapYen`
- 公式情報として入った値は `toto_official_*` と `round_ev_assumptions` に保存します

## Candidate Cards の意味

- 王道モデル: 各試合で modelProb 最大を選ぶ比較軸
- 公式人気候補: toto民が一番選びそうな並びの比較軸
- 人力コンセンサス: Human Scout Card と Human Picks を使った人力推し
- EVハンター候補: 公式人気と被りにくさと modelProb のバランスを見た候補
- 眠ってる期待値: 王道から数試合だけ高 edge outcome を混ぜた候補
- 引き分け警報: avgD が高い試合で 0 を拾う候補
- 荒れ狙い: ネタ枠を明示した逆張り候補

## Friend Pick Room の使い方

1. `Simple View` で round の全体像を見る
2. `Friend Pick Room` で候補カードを比べる
3. `これ推し / 迷う / パス / 自分はこれで買った / コメント` を記録する
4. 必要なら `Simple View` で自分の13予想を更新する

## 将来拡張メモ

将来的には `Semantic Trading` 的な発想で、市場関係グラフを持てるようにします。

- MarketNode 例
  - FIFA公式日程
  - toto公式対象試合
  - Polymarket の優勝市場
  - グループ首位 / 突破市場
  - 個別試合市場
  - 選手出場市場
  - 怪我ニュース
  - 人力スコア
- MarketRelation 例
  - `same_outcome`
  - `opposite_outcome`
  - `leader_follower`
  - `weak_signal`
  - `causal`

MVP では未実装で、README 上の将来設計メモとして残しています。

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
NEXT_PUBLIC_TOTO_OFFICIAL_ROUND_SYNC_FUNCTION_NAME=sync-toto-official-round-list
```

### 公式一覧の一発同期（推奨導線）

`Round Builder` の `toto で作る` / `mini toto で作る` から入ると、
`Toto Official Round Import` で対象 product に絞った状態からおすすめソースをそのまま同期できます。

現状のおすすめ同期元は次です。

- `https://toto.yahoo.co.jp/schedule/toto`
  - 開催回の一覧が安定していて、各回の `くじ情報を見る` から公式詳細ページへ辿れます
  - Edge Function はこの一覧から販売中 / これからの回を拾い、公式詳細ページを追加取得して `toto / mini toto-A / mini toto-B` をライブラリ化します
- `store.toto-dream.com` の個別 `くじ情報` URL
  - 1回分だけ直接読みたいときの補助用です

`Toto Official Round Import` で `公式一覧を同期` すると  
`Supabase Edge Function` (`sync-toto-official-round-list`) を経由して取り込みます。

Edge Function は次を行います。

- 公開URLからHTML/JSON/CSVを取得
- Yahoo! toto 販売スケジュールなら、開催回一覧を抽出し、必要な回だけ公式 `くじ情報` ページも追って詳細を埋める
- `store.toto-dream.com` の `くじ情報` ページなら、`toto / mini toto-A / mini toto-B / totoGOAL3` の対象情報・販売終了・売上速報を抽出する
- 取り得る形式を順に試行して回情報を正規化
- 取り込めない場合は警告を返して、手入力フローへフォールバック

注意:

- `totoGOAL3` は公式同期対象に含めますが、Round Builder 本体ではなく `GOAL3 Value Board` へ分けて表示します
- 公式人気 (`official_vote_1 / 0 / 2`) は一覧ページや `くじ情報` ページだけでは揃わない場合があるため、必要なら CSV / TSV で補完します

GitHub Pages 側はこのFunction名を `NEXT_PUBLIC_TOTO_OFFICIAL_ROUND_SYNC_FUNCTION_NAME` から参照します。  
未設定でも既定名 `sync-toto-official-round-list` を使います。

運用メモ:

- この Function は `sb_publishable_...` 形式の公開キーでも叩けるよう、`supabase/config.toml` で `verify_jwt = false` にしています
- 代わりに取得先URLは Yahoo! toto / スポーツくじオフィシャルのホストに制限しています
- Supabase の新しい publishable key を使う場合は、Function 側にも `SB_PUBLISHABLE_KEY` secret を入れてください
- 手動 deploy するときも `supabase/functions/sync-toto-official-round-list` は `--no-verify-jwt` 相当の設定を維持してください

### 3. Supabase にテーブルを作る

Supabase SQL Editor で [supabase/schema.sql](/C:/workspace/world-toto-lab/supabase/schema.sql) を実行してください。

### 3.1 コードとスキーマの整合監査

デプロイ前に、`repository.ts` で参照しているテーブル名と `schema.sql` の定義ズレを検査できます。

```bash
npm run audit:schema
```

ズレがない場合は「`all repository tables are present in schema.sql`」で終了します。  
ズレがある場合は不足テーブル名を赤字で一覧表示します。

CI でも `npm run audit:schema` を通し、`main` への push 時点でスキーマ参照不整合を検知できるようにしています。

### 3.2 本番 Supabase の疎通チェック

GitHub Pages 上で読み込み失敗が出た場合、まず接続先 DB の実体を確認すると速いです。

```bash
npm run check:supabase
```

`.env.local` / `.env` / 実行環境の環境変数に以下を設定して実行してください。

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

`critical` が全て `OK` の場合は、接続先DBに必要テーブルと主要カラムが揃っています。  
`MISSING_COLUMN` や `MISSING_RELATION` が出た場合は、本番 Supabase に `supabase/schema.sql` を再適用してください。  
`candidate_tickets` / `candidate_votes` は現状 UI 側でフェイルセーフを入れていますが、`missing` が出るなら SQL 再実行が推奨です。

### 3.3 GitHub Pages ルートの疎通チェック

公開 URL の route が生きているかは、次でまとめて確認できます。

```bash
npm run check:pages
```

必要に応じて次を上書きしてください。

```bash
WORLD_TOTO_LAB_BASE_URL=https://quietbriony.github.io/world-toto-lab
WORLD_TOTO_LAB_ROUND_ID=47f5d6b8-5120-46a3-b434-7312b11cb98a
WORLD_TOTO_LAB_USER_ID=<optional-user-id>
```

チェック対象は `/workspace`, `/big-carryover`, `/big-carryover` の共有URL復元, `/official-schedule-import`, `/fixture-selector`, `/toto-official-round-import`, `/toto-official-round-import` の WINNER 導線, `/simple-view`, `/pick-room`, `/winner-value`, `/consensus`, `/edge-board`, `/review`, `/ticket-generator` です。

### 3.4 まだ候補系テーブルがない場合（`candidate_tickets` / `candidate_votes`）

次のエラーが出る場合は、実運用DBへ候補系テーブルが未反映です。

- `Failed to load candidate tickets: Could not find the table 'public.candidate_tickets' in the schema cache`

下記をSupabase SQL Editorで実行してください。

```sql
create table if not exists public.candidate_tickets (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  label text not null,
  strategy_type text not null check (
    strategy_type in ('orthodox_model', 'public_favorite', 'human_consensus', 'ev_hunter', 'sleeping_value', 'draw_alert', 'upset')
  ),
  picks_json jsonb not null,
  p_model_combo double precision,
  p_public_combo double precision,
  estimated_payout_yen double precision,
  gross_ev_yen double precision,
  ev_multiple double precision,
  ev_percent double precision,
  proxy_score double precision,
  hit_probability double precision,
  public_overlap_score double precision,
  contrarian_count integer not null default 0,
  draw_count integer not null default 0,
  human_alignment_score double precision,
  data_quality text not null check (
    data_quality in ('complete', 'missing_official_vote', 'missing_model_prob', 'proxy_only', 'demo_data')
  ),
  rationale text,
  warning text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.candidate_votes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  candidate_ticket_id uuid not null references public.candidate_tickets(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  vote text not null check (vote in ('like', 'maybe', 'pass', 'bought_myself')),
  comment text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
```

必要なら、`public.candidate_tickets` / `public.candidate_votes` の `RLS` ポリシーが有効か、`anon` 向けの `select / insert / update / delete` が開放されているかも確認してください。

作成後、`Settings > API` の `Project URL` / `anon key` が `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` と一致していることを確認し、再デプロイして再読込してください。

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

## 候補配分のロジック

この画面は厳密な確率最適化ではなく、どの候補から見るかを並べ替えるためのスコアリングです。

入力:

- `candidateLimit`
- `mode: conservative / balanced / upset`
- `humanWeight`
- `maxContrarianMatches`
- `includeDrawPolicy`

スコアの考え方:

```text
ticketScore =
sum(log(compositeProb_selected_outcome))
+ alpha * sum(compositeAdvantage_selected_outcome)
+ beta * sum(attentionShare_selected_outcome)
+ gamma * predictorSupport
+ delta * darkHorseScore
- penaltyForTooManyDarkhorses
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
- 外部モデルとの連携による AI 確率の自動投入
- 外部 API からの試合予定全面自動取得
- リアルタイム同期
  - 現状は保存後の再取得と定期再取得で追従します
- 高度な候補配分最適化
- 金銭、配当、代理購入、精算の扱い

## 補足

- Dashboard からサンプル 10 人を投入できます
- Match Editor は静的 route の都合で `/match-editor?round=...&match=...` です
- GitHub Pages 対応を優先するため、動的 route より query param 方式を採用しています
- 実運用前の確認順は [docs/operational-smoke-checklist.md](/C:/workspace/world-toto-lab/docs/operational-smoke-checklist.md) にまとめています
