# Friend Pick Room 要件定義

repo-first で現行 `world-toto-lab` を監査したうえで、今回の相談文を実装前提の仕様に落としたメモです。

## 1. 結論

- 相談内容の方向性はかなり良い。
- ただし現リポジトリには既に近い機能が多く、ゼロから新規開発する前提の書き方だとズレる。
- 実装方針は「既存の `Round Detail / Picks / Consensus / Edge Board / Ticket Generator` を残しつつ、友人向けの主画面として `Friend Pick Room` を追加する」が最も安全。
- GitHub Pages 向け static export 構成なので、URL と生成フローはその制約に合わせる必要がある。

## 2. 現状監査

### 2-1. 技術前提

- Next.js 16 App Router + `output: "export"` + query param 運用
- GitHub Pages 配信前提
- Supabase をクライアントから直接参照
- 認証なし共有 MVP
- 既存ルートは静的 route で、`?round=` と `?user=` で対象を切り替える

参考:

- `src/lib/round-links.ts`
- `next.config.ts`
- `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`

### 2-2. 既にあるデータ

- `users`
- `rounds`
- `matches`
- `picks`
- `human_scout_reports`
- `generated_tickets`
- `review_notes`

参考:

- `supabase/schema.sql`
- `src/lib/types.ts`
- `src/lib/repository.ts`

### 2-3. 既にある画面

- ダッシュボード: `src/app/page.tsx`
- Round Detail: `src/app/workspace/page.tsx`
- Human Picks: `src/app/picks/page.tsx`
- Human Scout Card: `src/app/scout-cards/page.tsx`
- Human Consensus: `src/app/consensus/page.tsx`
- Edge Board: `src/app/edge-board/page.tsx`
- Ticket Generator: `src/app/ticket-generator/page.tsx`
- Review: `src/app/review/page.tsx`

### 2-4. 既にあるロジック

- `matches` に `official_vote_* / market_prob_* / model_prob_*` がある
- `matches` に `consensus_f / consensus_d / consensus_call` がある
- `human_scout_reports` から人力コンセンサスを再計算して `matches` に反映している
- `generated_tickets` は既に候補配分の保存先として存在するが、今回ほしい Candidate Card のスキーマとは別物
- `picks` は 13試合の単票入力用で、ユーザーのロールは `admin=予想者`, `member=ウォッチ`

参考:

- `src/lib/domain.ts`
- `src/lib/tickets.ts`
- `src/lib/pick-support.ts`
- `src/lib/users.ts`

## 3. 相談文と現状のズレ

### 3-1. そのまま採用できる要望

- 友人向けのシンプル UI を最優先にする
- 候補を数本のカードで見せる
- 王道 / 人力 / EV / 引き分け / 荒れ狙い を並べる
- 既存 Supabase データを壊さず追加する
- 金銭管理や配当分配を扱わない
- README とテストを増やす

### 3-2. repo-first で言い換えるべき点

- URL は `/workspace/round/[roundId]/pick-room` ではなく静的 route にする
  - 推奨: `/pick-room?round=<id>&user=<id>`
- `Human Picks` は現行スキーマではウォッチの支持コピーも含む
  - 候補生成の多数派計算には `予想者(admin)` の手入力だけを使う
- `AI試算済み` という UI 表現は現状だと provenance を持っていない
  - 推奨表示: `モデル確率 13/13` または `モデル確率入力済み`
- 既存 `generated_tickets` は mode ベースの旧候補なので、今回の Candidate Card と混在させない
  - 新テーブル追加が安全
- `demo_data` は現状 row 単位のフラグではない
  - まずは `demoRoundTitle` / デモユーザー名から round 単位で判定する

### 3-3. 既に部分的に実装済みのもの

- Round Detail の上部には既に overview card がある
- Picks 画面には既に 13試合のポチポチ UI がある
- Consensus / Edge Board / Ticket Generator は advanced view として流用可能

## 4. 今回のMVPスコープ

### 4-1. 主目的

このアプリの主目的を、現行の「分析導線」から次へ寄せる。

> 王道・人力・EV候補を数本だけ並べて、友人がスマホで見て、どれで行くかポチポチ決められる状態にする。

### 4-2. 今回追加する主画面

1. `Friend Pick Room`
2. `Candidate Comparison Table`
3. `Data Quality Card`
4. `EV計算前提` 編集 UI

### 4-3. 今回は既存画面を活かす

- `Round Detail` は advanced / setup 用として残す
- `Picks` は永続化先を変えずに simple 化する
- `Consensus` と `Edge Board` は advanced view として残す
- `Ticket Generator` は旧候補配分ページとして残し、将来的に Candidate Cards と整理統合する

## 5. URL/画面構成

static export 前提のため、動的セグメント追加ではなく静的 route を増やす。

### 5-1. 追加ルート

- `/pick-room?round=<id>&user=<id>`
  - 友人向けの主画面
- `/simple-view?round=<id>`
  - Round Detail の簡略版

### 5-2. 既存ルートの扱い

- `/picks?round=<id>&user=<id>`
  - 永続化先はそのまま
  - UI をより simple / mobile-first に調整

### 5-3. Round Nav の扱い

- `Friend Pick Room` を主導線に追加
- `Simple View` を `Round Detail` の前段または別リンクとして追加
- 既存 `Round Detail / Picks / Consensus / Edge Board / Ticket Generator / Review` は advanced 導線として残す

## 6. 追加データモデル

既存 schema の破壊的変更は避け、追加テーブルのみで対応する。

### 6-1. `round_ev_assumptions`

- `id uuid primary key default gen_random_uuid()`
- `round_id uuid not null references rounds(id) on delete cascade`
- `stake_yen integer not null default 100`
- `total_sales_yen bigint null`
- `return_rate double precision not null default 0.50`
- `first_prize_share double precision not null default 0.70`
- `carryover_yen bigint not null default 0`
- `payout_cap_yen bigint null`
- `note text null`
- `created_at timestamptz not null default timezone('utc', now())`
- `updated_at timestamptz not null default timezone('utc', now())`
- `unique (round_id)`

補足:

- `round.notes` は既に参加メンバー情報のエンコードに使っているため流用しない

### 6-2. `candidate_tickets`

- `id uuid primary key default gen_random_uuid()`
- `round_id uuid not null references rounds(id) on delete cascade`
- `label text not null`
- `strategy_type text not null check (...)`
- `picks_json jsonb not null`
- `p_model_combo double precision null`
- `p_public_combo double precision null`
- `estimated_payout_yen double precision null`
- `gross_ev_yen double precision null`
- `ev_multiple double precision null`
- `ev_percent double precision null`
- `proxy_score double precision null`
- `hit_probability double precision null`
- `public_overlap_score double precision null`
- `contrarian_count integer not null default 0`
- `draw_count integer not null default 0`
- `human_alignment_score double precision null`
- `data_quality text not null check (...)`
- `rationale text null`
- `warning text null`
- `created_at timestamptz not null default timezone('utc', now())`
- `updated_at timestamptz not null default timezone('utc', now())`
- `unique (round_id, label)`

`strategy_type`:

- `orthodox_model`
- `public_favorite`
- `human_consensus`
- `ev_hunter`
- `draw_alert`
- `upset`

`data_quality`:

- `complete`
- `missing_official_vote`
- `missing_model_prob`
- `proxy_only`
- `demo_data`

### 6-3. `candidate_votes`

- `id uuid primary key default gen_random_uuid()`
- `round_id uuid not null references rounds(id) on delete cascade`
- `candidate_ticket_id uuid not null references candidate_tickets(id) on delete cascade`
- `user_id uuid not null references users(id) on delete cascade`
- `vote text not null check (...)`
- `comment text null`
- `created_at timestamptz not null default timezone('utc', now())`
- `updated_at timestamptz not null default timezone('utc', now())`
- `unique (round_id, candidate_ticket_id, user_id)`

`vote`:

- `like`
- `maybe`
- `pass`
- `bought_myself`

### 6-4. RLS / index / trigger

既存 schema と同じ方針で追加する。

- `round_id` index
- `candidate_ticket_id` index
- `set_updated_at` trigger
- anon の `select / insert / update / delete` policy

## 7. 候補生成の前提

### 7-1. 入力ソース

- モデル確率: `matches.model_prob_*`
- 公式人気: `matches.official_vote_*`
- 市場確率 fallback: `matches.market_prob_*`
- 人力コンセンサス: `matches.consensus_f / consensus_d / consensus_call`
- 人力多数派:
  - `picks` のうち `admin` ロールの手入力を主対象に集計
  - `member` の支持コピーは多数派計算に混ぜない

### 7-2. 候補再生成のタイミング

server job は置かない。

MVP では以下の動きにする。

- `Friend Pick Room` を開いたとき、候補が未生成または stale ならクライアントで自動生成
- 生成後に Supabase へ保存
- 手動の `候補を再生成` ボタンも置く

stale 判定対象:

- `matches.updated_at`
- `picks.updated_at`
- `human_scout_reports.updated_at`
- `round_ev_assumptions.updated_at`

## 8. EV 計算仕様

### 8-1. strict EV

13試合の候補チケット `t` に対して次を計算する。

```text
p_model_combo(t)
= Π modelProb_i(selectedOutcome_i)

p_public_combo(t)
= Π officialVote_i(selectedOutcome_i)

totalTicketsEstimate
= totalSalesYen / stakeYen

firstPrizePoolEstimate
= totalSalesYen * returnRate * firstPrizeShare + carryoverYen

expectedOtherWinners
= max(0, (totalTicketsEstimate - 1) * p_public_combo)

estimatedPayoutIfHit
= firstPrizePoolEstimate / (1 + expectedOtherWinners)

if payoutCapYen != null:
  estimatedPayoutIfHit = min(estimatedPayoutIfHit, payoutCapYen)

grossEVYen
= p_model_combo * estimatedPayoutIfHit

evMultiple
= grossEVYen / stakeYen

evPercent
= evMultiple * 100
```

### 8-2. strict EV を出す条件

strict EV は以下が揃うときのみ出す。

- 13試合すべてに selected outcome の `modelProb` がある
- 13試合すべてに selected outcome の `officialVote` がある
- `round_ev_assumptions.total_sales_yen` がある
- round が demo 扱いではない

### 8-3. strict EV を出せないとき

`proxyScore` を出す。

```text
proxyScore
= sum(log(modelProb_selected))
+ alpha * sum(modelProb_selected - officialVote_selected)
+ beta * sum(1 - officialVote_selected)
+ gamma * humanAlignmentScore
- upsetPenalty
```

補足:

- `alpha / beta / gamma` は MVP ではコード定数にする
- 値は UI で編集させない
- 実装時に定数を確定し、README とテストに固定する

### 8-4. UI の注意文

すべての strict EV / proxy 表示の近くに以下を出す。

> 推定EVは、入力されたモデル確率・公式人気・売上想定・配当原資想定から計算した参考値です。的中や利益を保証するものではありません。

## 9. Candidate Card 生成仕様

### 9-1. 王道モデル候補

- 各試合で `modelProb` 最大を採用
- `modelProb` が欠ける場合は `marketProb`
- それもなければ `officialVote`
- fallback した場合は `warning` を残す

### 9-2. 公式人気候補

- 各試合で `officialVote` 最大を採用
- 比較用として必ず出す

### 9-3. 人力コンセンサス候補

各試合で次を適用する。

```text
if avgD >= 1.5 and abs(avgF) <= 2:
  pick = "0"
else if avgF >= 3:
  pick = "1"
else if avgF <= -3:
  pick = "2"
else:
  predictor manual picks の多数派
  それもなければ modelProb 最大
```

### 9-4. 引き分け警報候補

- `avgD` が高い試合で `0` を優先
- `drawCount > 4` なら warning

### 9-5. 荒れ狙い候補

- `officialVote` 本命と異なる outcome を多めに採用
- ただし `contrarianCount > 4` は除外
- UI では必ず `荒れ狙い` と明示

### 9-6. EV ハンター候補

MVP では beam search を第一候補にする。

理由:

- 現行は client-side / static export 前提
- 低スペック端末で `3^13` 全探索を毎回 main thread で回すのは重い
- worker 化は後続改善に回せる

初期仕様:

- 各試合 2〜3 outcome を候補化
- beam 上位のみ保持
- 上位候補から diversity filter を適用

フィルタ:

- `evMultiple >= 2.0` を優先
- `modelProb < 0.12` の outcome を 5個以上含む候補は除外
- `contrarianCount > 4` は除外
- `drawCount > 4` は除外
- strict EV 不可なら `proxyScore` 順で代替

多様性:

- 既採用候補との Hamming distance が 2未満ならスキップ

出力ラベル:

- `EVハンターA`
- `EVハンターB`
- `EVハンターC`
- `EVハンターD`
- `EVハンターE`

候補が不足する場合:

- あるものだけ出す
- `EV 200%以上候補なし` を表示可能にする

## 10. 派生メトリクス

### 10-1. `hit_probability`

- MVP では `p_model_combo` をそのまま格納する

### 10-2. `public_overlap_score`

- MVP では selected outcome の `officialVote` 平均値を使う
- `p_public_combo` は strict EV 用、`public_overlap_score` は比較 UI 用として分ける

### 10-3. `contrarian_count`

- selected outcome がその試合の `officialVote` 最大と異なる件数

### 10-4. `draw_count`

- selected outcome が `"0"` の件数

### 10-5. `human_alignment_score`

試合ごとに以下を加点し、13試合合計を 0〜1 に正規化する。

- candidate pick が human consensus と一致: `+1`
- candidate pick が predictor manual picks 多数派と一致: `+0.5`
- `avgD >= 1.5` のとき `0`: `+1`
- `avgF >= 3` のとき `1`: `+1`
- `avgF <= -3` のとき `2`: `+1`

あわせて UI 表示用に以下も算出する。

- 人力多数派と違う試合数
- F/D と矛盾する試合数
- 引き分け警報を拾った数

## 11. Data Quality 仕様

### 11-1. round 単位の確認項目

- 試合数が 13/13 か
- `modelProb` が 13/13 か
- `officialVote` が 13/13 か
- 各試合の `officialVote` 合計が概ね 1 か
- 各試合の `modelProb` 合計が概ね 1 か
- `totalSalesYen` が入っているか
- predictor manual picks が何人分あるか
- human scout reports が何人分あるか
- demo round か

### 11-2. 許容誤差

- 合計チェックは `0.98 <= sum <= 1.02` を初期基準にする

### 11-3. Data Quality Card の表示

Pick Room 上部に常時表示する。

例:

```text
データ状態
- 日程: 13/13
- モデル確率: 13/13
- 公式人気: 9/13
- 人力予想: 6人
- EV計算前提: 未入力

公式人気が未入力の試合があるため、EVはProxy表示です。
```

### 11-4. `data_quality` の優先順

1. `demo_data`
2. `proxy_only`
3. `missing_model_prob`
4. `missing_official_vote`
5. `complete`

補足:

- 単一 enum では足りない情報は `warning` に追記する

## 12. Friend Pick Room UI 要件

### 12-1. 上部サマリー

- Round 名
- 13試合入力状況
- 公式人気入力状況
- モデル確率入力状況
- 人力予想人数
- EV計算前提入力状況

### 12-2. カード表示

各 Candidate Card に表示するもの:

- ラベル
- 13ピックの compact 表示
- 推定EV または EV Proxy
- 推定的中確率
- 推定配当
- 逆張り数
- 引き分け数
- 人力一致率
- 注意バッジ
- rationale

### 12-3. 操作

- `これに投票`
- `迷う`
- `パス`
- `自分はこれ`
- コメント入力

UI 文言:

- ボタン文言は簡単にする
- 内部値は `bought_myself` を使う
- 表示は `自分はこれ` を優先し、`買った` の強調は控える

### 12-4. 候補下部の集計

各カードの下に以下を表示する。

- `like`
- `maybe`
- `pass`
- `bought_myself`
- コメント件数

### 12-5. 重要な比較文

EV候補の近くに必ず以下を出す。

> EVハンター候補は、的中率を下げる代わりに、公式人気と被りにくい結果を含めた候補です。

## 13. 自分の13予想 UI

### 13-1. 実装方針

- 永続化は既存 `picks` をそのまま使う
- 新しい pick table は作らない
- `src/app/picks/page.tsx` を simple / mobile-first に寄せるか、simple mode を追加する

### 13-2. 表示内容

各試合:

- 対戦カード
- `[1 ホーム] [0 引分] [2 アウェイ]`
- 公式人気
- 王道モデル
- 人力コンセンサス
- 引き分け警報

入力後の集計:

- 自分の13並び
- 王道モデルとの一致率
- 人力多数派との一致率
- 公式人気との一致率
- 逆張り数
- 引き分け数

## 14. Simple View 要件

Round Detail の情報量が多い問題に対して、別 route の簡略画面を用意する。

表示するもの:

1. 13試合
2. 自分の予想ボタン
3. 王道モデル
4. 人力コンセンサス
5. 公式人気
6. 引き分け警報
7. Friend Pick Room への導線

隠すもの:

- 詳細確率表
- edge の生表
- advanced note 群

## 15. Candidate Comparison Table

列:

- 候補名
- タイプ
- 13ピック
- 推定EV
- 的中確率
- 推定配当
- 逆張り数
- 引き分け数
- 人力一致率
- 投票数
- コメント数

表示順:

1. 王道モデル
2. 公式人気
3. 人力コンセンサス
4. EVハンターA
5. EVハンターB
6. EVハンターC
7. 引き分け警報
8. 荒れ狙い

## 16. デモデータ判定

現状では row 単位の `is_demo` はないため、MVP の `demo_data` は round 単位で判定する。

判定条件:

- `isDemoRoundTitle(round.title)` が true
- または選択ユーザーがデモユーザーのみ

注意:

- 本番とデモを明確に切り替えるには、将来的には `rounds.is_demo boolean` の追加が望ましい
- 今回は既存データ破壊を避けるため見送る

## 17. 実装順

1. schema 追加
2. `repository.ts` と `types.ts` に Candidate 系を追加
3. EV utility 追加
4. Data Quality utility 追加
5. Candidate generation utility 追加
6. Pick Room UI
7. Simple View / simple picks 調整
8. Comparison Table
9. README 更新
10. テスト追加

## 18. テスト方針

現状は test runner が入っていないため、先に test 基盤を追加する。

推奨:

- `vitest`
- `npm test` script 追加
- 純粋関数中心に `src/lib/*.test.ts`

追加対象:

### 18-1. EV calculation

- `p_model_combo`
- `p_public_combo`
- `expectedOtherWinners`
- `evMultiple`
- `carryover`
- `payoutCap`

### 18-2. Candidate generation

- 王道モデル候補
- 公式人気候補
- 人力コンセンサス候補
- EVハンター候補の `evMultiple >= 2.0` 優先
- diversity filter

### 18-3. Data quality

- officialVote 未入力時は strict EV ではなく proxy
- demo round は warning
- modelProb 欠損時の fallback warning

## 19. README 追加項目

- Friend Pick Room の使い方
- Candidate Cards の意味
- 王道モデル / 公式人気 / 人力コンセンサス / EVハンター の違い
- strict EV の計算式
- strict EV が保証でない理由
- officialVote 未入力時に EV ではなく proxy を出す理由
- 友人投票の使い方
- 金銭管理や配当分配をしないこと

## 20. 非MVP

- 認証
- user session 固定
- Edge Functions でのサーバー側候補生成
- Web Worker 全探索
- `rounds.is_demo` の追加
- candidate comment のスレッド化
- リアルタイム同期

## 21. フルスタックエンジニア向けの相談文

現行 repo に合わせるなら、元の文面より次の書き方のほうがズレにくい。

### 推奨版

あなたは既存の `World Toto Lab` を改善するフルスタックエンジニアです。

この repo は `Next.js 16 App Router + static export + Supabase` 構成で、GitHub Pages 配信を前提にしています。  
そのため、まず repo の現状を監査し、既存の `Round Detail / Picks / Consensus / Edge Board / Ticket Generator` を活かしながら、友人10人前後がスマホで使いやすい `Friend Pick Room` を追加してください。

前提:

- 既存の Supabase データを壊さない
- 破壊的変更は避け、追加テーブルで対応する
- static export 制約に合わせ、dynamic route ではなく既存の query param 方式を優先する
- `Human Picks` の多数派計算には、ウォッチの支持コピーではなく予想者の手入力を使う
- このアプリは予想・分析・投票・記録・振り返り用であり、購入代行、賭け金管理、配当分配、ユーザー間賭博は扱わない

今回の主ゴール:

- 「総当たりで買うサイト」ではなく、「王道・人力・EV候補を数本だけ見せて、友人がどれで行くか投票できる画面」を作る
- 主画面は `Friend Pick Room`
- 候補カードは `王道モデル / 公式人気 / 人力コンセンサス / EVハンター / 引き分け警報 / 荒れ狙い`
- strict EV が出せない場合は proxy 表示にフォールバックする
- advanced な数値は既存の画面へ逃がし、友人向け UI は極力シンプルにする

追加してほしいもの:

- `round_ev_assumptions`
- `candidate_tickets`
- `candidate_votes`
- EV / proxy 計算 utility
- candidate generation utility
- `Friend Pick Room`
- `Data Quality Card`
- `Candidate Comparison Table`
- simple 化した自分の13予想 UI
- README とテスト

UI 文言の制約:

- `必勝 / 勝てる / 最適解 / 利益保証 / 高精度AI / 確実` は使わない
- `王道 / 人力推し / EV狙い / 引き分け警報 / 荒れ狙い / 参考値 / 要確認` を優先する

実装前にやってほしいこと:

1. 現状 audit
2. 既存機能との対応関係の整理
3. 追加 schema と route の提案
4. MVP と非MVP の切り分け
5. そのうえで実装

## 22. 一言メモ

元の相談文は「やりたいこと」は十分伝わっています。  
repo-first で精度を上げるなら、`既存 route / static export / 既存 roles / generated_tickets との違い` を先に明示すると、実装者の迷いがかなり減ります。
