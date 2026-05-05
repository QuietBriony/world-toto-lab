# BIG / MEGA BIG True EV Rule Capture

作成日: 2026-05-05

## Goal

BIG / MEGA BIG の `trueEvStatus = "complete"` を出す前に、公式ルール材料をコードで確認できる形にする。今回のスライスでは真EV計算そのものは追加しない。

## Current State

- 既存の `src/lib/big-carryover/calculator.ts` は `naiveCarryPressure` と `trueEvStatus` を分けている。
- 新規 `src/lib/big-carryover/rules.ts` は商品ルールの候補値と未解決項目を保持する。
- `buildCalculatorPrizeTiersIfReady()` は、未解決項目が残る限り `null` を返す。これにより、捕捉した配分値だけで真EV計算可へ進まない。

## Captured Sources

| Product | Source | Captured fields | Status |
| --- | --- | --- | --- |
| BIG | [toto official BIG product page](https://sp.toto-dream.com/big/about/big.html) | 口単価、対象試合数、1等上限、理論確率、当せん金配分割合 | official confirmed |
| 100円BIG | [toto official 100 yen BIG product page](https://sp.toto-dream.com/big/about/100enbig.html) | 口単価、対象試合数、1等上限、理論確率、当せん金配分割合 | official confirmed |
| MEGA BIG | [SMBC MEGA BIG glossary](https://www.smbc.co.jp/kojin/toto/yougo/16.html), [toto official result example](https://sp.toto-dream.com/dcs/subos/screen/si05/ssin003/PGSSIN00301FwdSelectBIGSerLotDRM02.form?commodityId=14&holdCntId=1514) | 口単価、対象試合数、1等上限、理論確率、当せん金配分割合、実績ページ上の売上/当せん/繰越項目 | partner reference |

## True EV Gate

真EV計算へ進むには、最低限この材料を揃える。

- `ticketPriceYen`
- `returnRate`
- `matchCount`
- `outcomeChoiceCount`
- tierごとの理論確率
- tierごとの配分割合
- tierごとの上限
- tierごとの繰越対象フラグ
- 繰越継続ルール
- 中止・不成立・最低成立試合数の扱い
- 特別開催回の上限/配分 override

## Unresolved

- 2等以下を含む等級ごとの上限と端数処理。
- 等級ごとの繰越対象フラグ。
- 中止、不成立、最低成立試合数が等級判定と繰越に与える影響。
- 特別開催回が通常回の上限や配分を変える条件。
- MEGA BIG の通常時1等上限と配分割合を、公式商品ページまたは約款で再確認すること。

## Next Slice

1. 公式約款または商品詳細で未解決項目を確認する。
2. `rules.ts` の `unresolvedRules` を商品別に減らす。
3. すべての運用ルールが揃った商品だけ、`buildCalculatorPrizeTiersIfReady()` が tier 配列を返すようにする。
4. その次のPRで、複数当せん時の分配、上限、繰越継続を含む真EV式を実装する。
