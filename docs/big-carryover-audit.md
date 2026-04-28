# BIG / MEGA BIG Carryover Audit

作成日: 2026-04-28

## 対象

- 画面: `src/app/big-carryover/page.tsx`
- 既存共通ロジック: `src/lib/big-carryover.ts`
- 公式同期ロジック: `src/lib/big-official.ts`
- 追加計算器: `src/lib/big-carryover/calculator.ts`

## 現行ロジックの確認結果

### big-carryover画面の計算式

修正前は `calculateBigCarryoverSummary` が次の式を `approxEvMultiple` として返していた。

```text
approxEvMultiple = returnRate + carryoverYen / salesYen
```

これは次と同じ意味になる。

```text
(carryoverYen + salesYen * returnRate) / salesYen
```

MEGA BIG 第1625回のように売上 `191,591,400円`、キャリー `6,299,582,550円`、払戻率 `50%` を入れると約 `3338%` になる。ただし、この値は「キャリー圧」または「粗い上振れ指標」であり、BIG / MEGA BIG の真EVではない。

### URL queryの扱い

修正前の `src/app/big-carryover/page.tsx` は以下を `useSearchParams()` から読み取り、初期 state に入れていた。

- `eventType`
- `label`
- `snapshotDate`
- `sales`
- `carryover`
- `returnRate`
- `spend`
- `sourceUrl`
- `shock`
- `note`

`sales` は売上想定として扱われ、現在売上と最終売上の区別はなかった。`spend` は投下額ごとの期待損益表示に使われていたため、購入判断を強める見え方になりやすかった。

修正後は `sales` を現在売上、`projectedSales` をユーザー入力の最終売上として分けた。`spend` は旧URL互換の観点では存在し得るが、画面上の計算や共有URLには使わない。

追加した query:

- `productType`
- `projectedSales`
- `ticketPrice`
- `firstPrizeOdds`
- `firstPrizeCap`

### 現在の「概算」表示が意味していたもの

修正前の公式同期カードとメイン統計では、`approxEvMultiple` が「概算」「概算EV」「EV倍率」として表示されていた。実態は売上とキャリーだけを使った naive carry pressure で、以下を含まない。

- キャリーが今回払い出される確率
- 1等が出る確率
- 1等上限
- 複数当選時の分配
- 等級別配分
- 当選なし時のキャリー継続
- BIG / MEGA BIG のランダム発券性

修正後は `キャリー圧` として表示し、`真EV未計算` を別枠で出す。

### BIG / MEGA BIG 商品別の既存データ構造

公式同期側の `BigOfficialSnapshot` は以下を持つ。

- `productKey`: `big` / `mega_big` / `hyakuen_big` / `big1000` / `mini_big`
- `productLabel`
- `stakeYen`
- `totalSalesYen`
- `returnRate`
- `carryoverYen`
- `officialRoundName`
- `officialRoundNumber`
- `salesStartAt`
- `salesEndAt`
- `snapshotAt`
- `sourceText`
- `sourceUrl`

修正前は商品別の1等オッズ・1等上限を carryover 画面で扱っていなかった。修正後は `src/lib/big-carryover/calculator.ts` に `BIG` / `MEGA_BIG` / `100YEN_BIG` / `custom` の入力型と補助デフォルトを分離した。

### 「特大上振れ候補」表示の判定条件

修正前は `approxEvMultiple >= 1.7` で `特大上振れ候補`、`approxEvMultiple >= 1` で `期待値大` のように表示していた。

この判定は売上とキャリーだけを見るには便利だが、真EVのように読めるため BIG / MEGA BIG では誤解を招く。修正後は以下へ変更した。

- `要公式確認`
- `粗い上振れ指標`
- `ルール確認前`
- `見送り`

### 誤解を与えやすかった表示

- `概算EV`
- `EV倍率`
- `期待損益`
- `期待値プラス圏`
- `期待値大`
- `特大上振れ候補`
- 投下額ごとの期待損益

修正後は BIG carryover 画面からこれらを外し、キャリー圧・1等発生確率・上限proxy・真EV未計算を分離した。

## 修正後の計算器

追加: `src/lib/big-carryover/calculator.ts`

入力:

- `productType`
- `ticketPriceYen`
- `currentSalesYen`
- `projectedFinalSalesYen`
- `returnRate`
- `carryoverYen`
- `firstPrizeOdds`
- `firstPrizeCapYen`
- `prizeTiersJson`

出力:

- `naiveCarryPressure`
- `ticketCountEstimate`
- `expectedFirstPrizeWinners`
- `probAtLeastOneFirstPrize`
- `capAdjustedNaiveCarryPressure`
- `capAdjustedWarning`
- `trueEvStatus`
- `warnings`

採用した式:

```text
ticketCount = projectedFinalSalesYen / ticketPriceYen
expectedFirstPrizeWinners = ticketCount / firstPrizeOdds
probAtLeastOneFirstPrize = 1 - (1 - 1 / firstPrizeOdds) ^ ticketCount
naiveCarryPressure = (carryoverYen + projectedFinalSalesYen * returnRate) / projectedFinalSalesYen
```

`capAdjustedNaiveCarryPressure` は1等上限だけを反映した proxy で、真EVではない。

## 真EVの扱い

`trueEvStatus` は以下の4段階。

- `unavailable`: 必須入力不足
- `proxy_only`: 売上・キャリー・オッズ等はあるが、等級配分などがない
- `partial`: 等級データはあるが、配分・上限・繰越条件に不足がある
- `complete`: 等級配分・上限・繰越対象フラグまで揃っている

現時点の公式同期 snapshot だけでは `complete` にはしない。BIG / MEGA BIG では公式ルール確認が完了するまで `真EV未計算` と表示する。

## Supabase / Pages への影響

- Supabase schema と本番データは変更しない。
- `next.config.ts`、`basePath`、`assetPrefix` は変更しない。
- 既存 `/big-carryover` static route と query-param 方式を維持する。
- 購入代行、賭け金管理、配当分配、ユーザー間賭博は実装しない。
