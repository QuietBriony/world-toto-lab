# World Toto Lab

友人 10 人前後で使う、W杯toto / WINNER 向けの予想・分析・記録・振り返りダッシュボードです。

このリポジトリは **GitHub Pages で配信できる静的フロントエンド** として再構成しています。<br />
共有データの保存先は Cloudflare D1（Worker 経由）で、GitHub Pages から API を呼んで共有利用する MVP です。<br />
共有保存が未設定 / 一時到達不能になった場合でも、静的アプリ自体は起動し、ローカル保存（localStorage）や JSON export/import で最低限の予想・候補表示を継続できます。

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
そのため今回は、**Next.js static export + Cloudflare D1 + query param 方式**に寄せています。

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

これにより、**GitHub Pages から静的ファイルを配信しつつ、Round 作成・入力・集計は Cloudflare D1 へ保存**できます。

## 技術スタック

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- Cloudflare D1 + Workers（共有保存 API）
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

### 10. 全試合リスト / W杯日程取り込み

- `W杯日程から準備する` で FIFA公式記事 URL からその場で日程を取得できます
- `FIFA抽出ブックマーク` または抽出スクリプトで、FIFA公式ページの本文をこの画面へ持ち帰れます
- `全試合リスト` に保存
- `13試合を選ぶ` で試合を選び、`toto / mini toto / WINNER / custom` の Round を作成
- main は `FIFA公式 API -> article richtext -> date/match line 抽出` で、fallback として body text 抽出も残しています

### 11. 回を作る / toto公式回

- `回を作る` 画面で、通常は同期済みの公式toto回を選んで Round に反映します
- 一覧に無い回だけ CSV / TSV を貼り、`入力内容を確認` から補完します
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
  - 人気差スポット
  - 引き分け警報
  - 荒れ狙い
- 友人は `これ推し / 迷う / パス / 自分はこれ / コメント` を記録できます
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

- `全試合リスト` は `source` と `dataConfidence` を持ちます
- `Round` 側でも `roundSource` を保持します
- `Friend Pick Room` では `FIFA公式日程 / toto公式対象 / 手入力 / デモ / Proxy EV` などの由来を表示します
- デモデータが混じる Round では「本番分析には使わないでください」と明示します
- 公式人気が未入力の試合がある場合は「EVはProxy表示です」と出します

## Official Flow

### 1. FIFA公式日程の取り込み方法

1. `W杯日程から準備する` を開く
2. 既定で入っている FIFA公式日程 URL を確認して、`この画面で取得` を押します
3. FIFA公式 API から本文を読み、date / match line を自動で確認画面に入れます
4. home / away / date / group / venue を確認します
5. `全試合リスト` に保存します

補足:
- main 導線は FIFA公式 API の article richtext を読むので、スマホでも別タブ往復なしで使えます
- もし直接取得が通らない環境では、fallback の `FIFA抽出ブックマーク` または抽出スクリプトを使えます

### 2. 全試合リストとは何か

- W杯全体の日程を再利用可能なマスターデータとして持つテーブルです
- Round はこのマスターから何度でも組み直せます

### 3. 公式日程から Round を作る方法

1. `13試合を選ぶ` を開く
2. 試合をチェックする
3. 13試合なら `toto`、5試合なら `mini toto`、1試合なら `WINNER`、それ以外は `custom` を選ぶ
4. Round を作成する

### 4. toto公式対象試合を取り込む方法

1. `回を作る` を開く
2. `公式一覧を同期` でライブラリを更新する
3. `回を選ぶ` から対象回を選んで、この回で作る
4. 一覧に無い回だけ CSV / TSV を貼って、候補試合と公式人気を確認して保存する

### 5. 公式人気・売上・キャリーの入力方法

- 対象試合ごとの `official_vote_1 / 0 / 2`
- Round ごとの `stakeYen / totalSalesYen / returnRate / firstPrizeShare / carryoverYen / payoutCapYen`
- 公式情報として入った値は `toto_official_*` と `round_ev_assumptions` に保存します

## Candidate Cards の意味

- 王道モデル: 各試合で modelProb 最大を選ぶ比較軸
- 公式人気候補: toto民が一番選びそうな並びの比較軸
- 人力コンセンサス: Human Scout Card と Human Picks を使った人力推し
- EVハンター候補: 公式人気と被りにくさと modelProb のバランスを見た候補
- 人気差スポット: 王道から数試合だけ公式人気との差が大きい outcome を混ぜた候補
- 引き分け警報: avgD が高い試合で 0 を拾う候補
- 荒れ狙い: ネタ枠を明示した逆張り候補

## Friend Pick Room の使い方

1. `Simple View` で round の全体像を見る
2. `Friend Pick Room` で候補カードを比べる
3. `これ推し / 迷う / パス / 自分はこれ / コメント` を記録する
4. 必要なら `Simple View` で自分の13予想を更新する

## 将来メモ: Semantic Trading

ここは将来構想メモです。MVP にはまだ入っていません。
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
npm ci
```

### 2. 環境変数を入れる

環境変数なしでもローカル保存（localStorage）で起動できます。  
共有保存（Cloudflare D1）を使うときだけ、`.env.example` を参考に `.env.local` を作ってください。

```bash
NEXT_PUBLIC_STORAGE_MODE=cloudflare_d1
NEXT_PUBLIC_D1_API_BASE=https://world-toto-lab-api.<account>.workers.dev
```

## 共有保存に接続できないとき

共有保存（Cloudflare D1）が未設定 / 一時到達不能でも、GitHub Pages の静的ファイル配信は生きます。このアプリは起動時の health check で接続状態を確認し、失敗した場合はローカル保存モードへ fallback します。

表示されるモード:

- `Cloudflare共有保存`: D1 API に接続できる状態。Round、友人予想、コメント、候補 vote を共有保存します。
- `ローカル保存`: 共有保存を使わない、または接続できない状態。自分のブラウザの `localStorage` に保存します。
- `デモ`: サンプルデータだけで UI や試算を確認します。保存しません。

接続状態は画面右下のモードバッジで確認できます。共有保存に切り替えたいときは設定画面、または右上の `再接続` から health check を再実行します。

ローカル保存では、次の namespace 付き key に Round / Matches / Human Picks / Scout Reports / Research Memos / Candidate Tickets / Candidate Votes / Review Notes / Official Round snapshot / BIG Carryover assumptions などを保存します。

```text
world-toto-lab:v1:rounds
world-toto-lab:v1:currentRound
world-toto-lab:v1:picks
```

ローカル保存は同じブラウザ・同じ端末だけで有効です。友人と共有する場合は、画面共有、スクリーンショット、または Round 単位の JSON export/import を使ってください。

### JSON export/import

各 Round のナビゲーションにある `JSON export` で、Round 単位のバックアップを保存できます。export には次が含まれます。

- round
- matches
- picks
- scoutReports
- candidateTickets
- candidateVotes
- reviewNotes
- researchMemos
- roundEvAssumption
- users
- totoOfficialRound
- totoOfficialMatches
- metadata (`exportedAt`, `appVersion`, `dataMode`)

読み込みは画面上部の `JSON` ボタンから行います。import 前に preview が出るので、`別Roundとして取り込み` または `上書きで取り込み` を選んでください。共有保存モードで D1 に接続できる場合は共有保存へ、ローカル保存モード中または共有保存に接続できない場合は localStorage へ保存します。

共有保存を使わない運用にする場合は、環境変数を未設定のまま起動し、ローカル保存モードで Round を作成してください。URL query ベースの計算、サンプルデータ、localStorage 保存、JSON バックアップはそのまま使えます。

### 公式回の取り込み（CSV / 手入力 / JSON）

公式一覧の自動同期は廃止しました。`回を作る` 画面から、CSV / TSV の貼り付け、手入力、または JSON import で公式回を取り込みます。

公式人気や日程を手元に集めるときの参考ソース:

- `https://toto.yahoo.co.jp/schedule/toto`
  - 開催回の一覧が安定していて、各回の `くじ情報を見る` から公式詳細ページへ辿れます
- `store.toto-dream.com` の個別 `くじ情報` URL
  - 1回分だけ確認したいときの補助用です
- `sp.toto-dream.com` の個別 `くじ情報` URL
  - スマホ公式の `SalesTermtotoSP` で 13 試合、`VotetotoSP` で公式人気 `1 / 0 / 2` を確認できます

注意:

- 公式人気 (`official_vote_1 / 0 / 2`) は、取れる回だけ CSV / TSV で補完します
- `totoGOAL3` は通常の回作成ではなく `GOAL3 Value Board` へ分けて表示します

### 3. 共有保存（Cloudflare D1）をセットアップする

共有保存を使う場合は、D1 のスキーマ適用と Worker のデプロイが必要です。手順は [cloudflare/d1/README.md](cloudflare/d1/README.md) と [workers/api](workers/api/) を参照してください（ローカル保存だけで使うなら不要です）。

### 3.1 GitHub Pages ルートの疎通チェック

公開 URL の route が生きているかは、次でまとめて確認できます。

```bash
npm run check:pages
```

必要に応じて次を上書きしてください。

```bash
WORLD_TOTO_LAB_BASE_URL=https://world-toto-lab.pages.dev
WORLD_TOTO_LAB_ROUND_ID=<いま使う roundId>
WORLD_TOTO_LAB_USER_ID=<optional-user-id>
```

チェック対象は `/workspace`, `/big-carryover`, `/big-carryover` の共有URL復元, `/official-schedule-import`, `/fixture-selector`, `/toto-official-round-import`, `/toto-official-round-import` の WINNER 導線, `/simple-view`, `/pick-room`, `/winner-value`, `/consensus`, `/edge-board`, `/review`, `/ticket-generator` です。

### 3.2 共有保存でテーブル不足エラーが出る場合

共有保存モードで候補系などの読み込みに失敗する場合は、D1 のマイグレーション未適用が考えられます。[cloudflare/d1/README.md](cloudflare/d1/README.md) の手順で `migrations/` を再適用してください。テーブル定義の真実のソースは [cloudflare/d1/schema.sql](cloudflare/d1/schema.sql) です。

### 4. 開発サーバーを起動する

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## Round Mode / Play

Round は `W杯totoモード / 通常totoモード / WINNER / custom` を持ちます。  
ただし、確率・Edge・EV・人力シグナルのロジックは共通です。

- `W杯モード`
  - FIFA公式日程、グループ状況、移動/気候、予測市場、代表ニュースを重視
- `通常totoモード`
  - Jリーグ日程、ホーム/アウェイ、順位、休養、怪我、Research Memo、人力Scout、公式人気を重視

友人向けの最小導線:

- `/play`
  - 候補カードと自分の 1 / 0 / 2 入力だけを見るページ
- `/pick-room`
  - みんなで候補カードに投票するページ
- `/practice-lab`
  - 練習回や通常toto回の振り返りページ
- `/dev-playbook`
  - GitHub 招待後の開発ルールと Codex 並走ルール

通常totoで情報が薄い場合は、無理にそれっぽい確率を出さず `低信頼 / fallback` と明示します。

## Branch / Parallel Development Notes

現状の workflow は次の通りです。

- `.github/workflows/deploy-pages.yml`
  - `main` push で GitHub Pages を再ビルド / 再配信
- `.github/workflows/ci.yml`
  - `main` への PR で `lint` / `test` / `build` を実行

つまり、`main` は today の deploy branch です。
普段の作業は `main` へ直 push せず、`feature/*` などの作業 branch -> PR -> merge を推奨します。

並走メモ:

- 1タスク = 1ブランチ
- 1PR = 1目的
- 同じファイルを複数人または複数 AI で同時編集しない
- 特に `next.config.ts`, `src/lib/round-links.ts`, `src/lib/repository.ts`, `src/lib/types.ts`, `cloudflare/d1/schema.sql`, `workers/api/src/handler.ts` は直列で触る
- Pages / route / schema に触る変更では `npm run lint`, `npm run test`, `npm run build` を揃える
- もし GitHub 設定上 direct push できてしまっても、通常運用では branch + PR を前提にします

## GitHub Pages 公開手順

### 1. 公開用の値を入れる

GitHub Pages の build はローカル保存モードで動くため、Pages 配信だけならストレージ系の secret は不要です。

共有保存（Cloudflare D1）を使うビルドでは、`NEXT_PUBLIC_STORAGE_MODE` と `NEXT_PUBLIC_D1_API_BASE` をビルド環境（Cloudflare Pages 側のプロジェクト設定など）に入れてください。

### 2. GitHub Pages を GitHub Actions 配信にする

Repository Settings の Pages で `Build and deployment` を `GitHub Actions` にしてください。

### 3. `main` へ反映する

日常作業は branch + PR 推奨です。現状は `main` に入った内容がそのまま deploy 対象になります。
`.github/workflows/deploy-pages.yml` で `out/` を GitHub Pages へデプロイします。

Next.js 側は `GITHUB_REPOSITORY` を見て `basePath` / `assetPrefix` を自動設定します。  
`<user>.github.io/<repo>/` 形式の project pages を前提にしています。

## GitHub Pages 404 FAQ

### トップページ自体が 404 になる

- Repository Settings の Pages が `GitHub Actions` になっているか確認してください
- 最新の `Deploy GitHub Pages` workflow が `main` 上で成功しているか確認してください
- project pages なので、公開 URL は `https://<user>.github.io/<repo>/` です
- `https://<user>.github.io/` だけを開くと別サイトか 404 になります

### route を開くと 404 になる

- この repo は top-level の static route だけを export します
- Round / User / Match は path ではなく query param で渡します
  - 正: `/workspace/?round=<id>`
  - 正: `/pick-room/?round=<id>&user=<id>`
  - 誤: `/workspace/<roundId>`
- `trailingSlash: true` なので、手打ち URL は `/route/` 形式に寄せると安全です

### `_next` や asset だけ 404 になる

- `basePath` と `assetPrefix` は build 時の `GITHUB_REPOSITORY` から決まります
- repo 名を rename / transfer した後は、古い path が bundle に残るので再 build が必要です
- workflow 側では `out/.nojekyll` を作成済みです
- それでも asset 404 が出る場合は、最新 deploy と browser cache を確認してください

### query param つき URL でも 404 になる

- `?round=...` や `?user=...` 自体は 404 の原因ではありません
- 404 になる場合は、元の static path が存在しないか、repo path が抜けていることが多いです

## 共有保存（Cloudflare D1）の前提

今回は **認証なし共有 MVP** を優先しています。  
共有保存は Cloudflare D1（`workers/api` の Worker 経由）で、編集は共有リンクに含まれる書き込みトークン（`?round=<id>&edit=<token>`）で許可します。

これは次のトレードオフがあります。

- 編集リンク（トークン付き URL）を知っている人は編集できる
- 友人グループ向けの軽量運用には向く
- 公開 URL を広く拡散する用途には向かない

必要になったら次段で本格的な認証を入れてください。

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
- 実運用前の確認順は [docs/operational-smoke-checklist.md](docs/operational-smoke-checklist.md) にまとめています
- 画像アセットの差し替え方と `GPT Image 2` 向け prompt 方針は [docs/IMAGE_ART_DIRECTION.md](docs/IMAGE_ART_DIRECTION.md) にまとめています
