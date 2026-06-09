# Market Sources

World Toto Lab に、予測市場 / perp 市場 / bookmaker などの「市場シグナル」を read-only で取り込み、
Human Scout や公式投票と並べて比較するためのレイヤーです。

最初の対応ソースは **Hyperliquid のW杯関連市場**（優勝市場など）です。

- 画面: `/market-sources`（`?round=<id>` でラウンドに紐づく Signal Board / 反映プレビューを表示）
- モジュール: [src/lib/market-sources/](../src/lib/market-sources)
- 保存: ブラウザ localStorage の独立 namespace（`world-toto-lab:market-sources:v1`）。
  既存の Supabase / Cloudflare D1 スキーマや `repository.ts` には一切触れていません。

## 何に使うか

- W杯の **優勝市場（outright champion）** などを、チームの「地力に対する上流シグナル」として観測する。
- 同じチームについて **Polymarket / Bookmaker / Hyperliquid / Human Scout / 公式投票** を横並びで比較する（Signal Board）。
- 市場の見方が割れているか（disagreement）を確認する。

## 重要: これは read-only です

この連携は **read-only な市場データソース** です。アプリは次を **行いません**。

- 売買・注文（order / trade execution）
- wallet 接続（wallet connect）
- 取引署名・資金移動

使うのは Hyperliquid の公開 **info endpoint**（`https://api.hyperliquid.xyz/info`）だけです。
取引用の `exchange` endpoint は使いません。これは [no-trading テスト](../src/lib/market-sources/no-trading.test.ts)
で「取引系のエクスポートを足していないこと」を機械的に担保しています。

> このアプリは購入代行・賭け金管理・配当分配・ユーザー間賭博・Hyperliquidでの売買を行いません。

## 優勝市場は「上流シグナル」（個別試合の1X2とは違う）

優勝市場（例: *2026 World Cup Champion - France YES*）は、
**個別試合の90分 1/0/2 を直接決めるものではありません。**

- 優勝市場 = `marketType: outright_champion` / `signalLayer: upstream_team_prior`
- 個別試合 = `marketType: individual_match_1x2` / `signalLayer: downstream_match_signal`

優勝市場は「France の地力・市場評価」を表すだけなので、個別試合へは **weight 付きで軽く** 反映します。

### モデルへの反映（最大 ±0.03）

France に関係する試合のモデル確率を計算するとき、優勝市場を **直接上書きしません**。
次のように team-prior 補正へ変換し、`homeStrengthAdjust` / `awayStrengthAdjust` へ
**加算（additive）** します（既存の手入力補正は上書きしません）。

```text
teamPriorAdjustment = normalizeMarketSignal(championProbability, baselineChampionProbability) * weight
（その後 片側あたり 最大 ±0.03 で clip）
```

- `team == match.homeTeam` のとき `homeStrengthAdjust += smallAdjustment`
- `team == match.awayTeam` のとき `awayStrengthAdjust += smallAdjustment`
- `smallAdjustment` は **最大 ±0.03**。複数ソースが重なっても片側合計は ±0.03 を超えません。

実装は [signal.ts](../src/lib/market-sources/signal.ts)（純粋関数）で、既存の
[probability/engine.ts](../src/lib/probability/engine.ts) は **変更していません**。
`/market-sources` の「試合モデルへの反映プレビュー」で、補正前→補正後を確認できます。

## weight の既定値

| marketType | weight | signalLayer |
| --- | --- | --- |
| `outright_champion` | 0.20 | upstream_team_prior |
| `group_winner` / `group_qualification` | 0.50 | midstream_group_signal |
| `individual_match_1x2` | 1.00 | downstream_match_signal |
| `player_availability` | 0.30 | news_signal |
| `injury_news` | 0.30 | news_signal |
| `manual_signal` | 0.50 | manual_signal |

## API 取得には symbol mapping が必要

Hyperliquid の **UI slug**（例: `2026-world-cup-champion-france-yes`）と、
API の **coin 名** は一致しない可能性があります。そのため UI slug ⇄ coin の
対応表（`HyperliquidSymbolMapping`）を持ちます。

- 対応表は [hyperliquid.ts](../src/lib/market-sources/hyperliquid.ts) の `HYPERLIQUID_SYMBOL_MAP`。
- **最初は手入力で構いません**（既定は空でも動きます）。
- mapping が無い場合は、**URL だけを MarketNode として保存し、価格は手入力扱い** になります。
  画面では「mappingなし（手入力）」と表示され、`APIで取得を試す` は失敗（取得不可）になります。

info endpoint のクエリ（read-only）:

```text
POST https://api.hyperliquid.xyz/info
allMids        : { "type": "allMids" }
l2Book         : { "type": "l2Book", "coin": "<coin>" }
candleSnapshot : { "type": "candleSnapshot", "req": { "coin": "<coin>", "interval": "1h", "startTime": ..., "endTime": ... } }
```

## Polymarket / Bookmaker / Hyperliquid を比較して使う方針

1つのソースを過大評価しないために、**並べて見る**のが基本方針です。

- **Hyperliquid**: perp/予測市場。優勝市場を上流シグナルとして観測。
- **Polymarket**: 予測市場。優勝・突破などのアウトカム確率。
- **Bookmaker**: ブックメーカーのオッズ由来確率。
- **Human Scout**: 人力の地力/調子方向（F）。
- **公式投票（Official Toto Vote）**: 公式人気。Edge/EV 比較用で、モデル本体へは強く混ぜない。

Signal Board ではチームごとにこれらを横並びで表示し、`signal disagreement`（ソース間のばらつき）を出します。

France の例:

```text
France:
- Hyperliquid: 優勝 xx%（上流シグナル）
- Polymarket : 優勝 xx%
- Bookmaker  : 優勝 xx%
- Human      : F +x.x
- 公式投票    : 人気高/低
- Comment    : Hyperliquidは上流シグナル。個別試合は別途1X2で確認。
```

## データモデル

[types.ts](../src/lib/market-sources/types.ts) に定義。

- `MarketNode`: 1つの市場アウトカム（source / marketType / competition / team / outcomeLabel /
  probability・mid・spread・liquidity… / signalLayer / weight / dataConfidence / lastFetchedAt / notes）。
- `MarketRelation`: ノード同士、またはノードと toto 側エンティティ（team_prior / match / round /
  candidate_ticket）の関係（same_direction / opposite_direction / leader_follower / weak_signal /
  causal / manual）。

これは docs/ARCHITECTURE.md「Future Memo: Semantic Trading」で構想されていた `MarketNode` /
`MarketRelation` の最小実装です。

## データ品質の警告

[quality.ts](../src/lib/market-sources/quality.ts) が次を出します。

- mapping なし
- liquidity 不明
- spread 広い
- API 取得失敗
- manual price（手入力価格）
- old price（古い価格）
- source market is upstream only（上流シグナルである注意）

## チーム名の照合（EN ↔ JA）

slug は英語（`france`）ですが、本アプリの試合・強度モデルは日本語名（`フランス`）です。
[team-names.ts](../src/lib/market-sources/team-names.ts) が英語名と日本語名を同一チームとして照合します。

## テスト

[src/lib/market-sources/](../src/lib/market-sources) に同居:

- `hyperliquid.test.ts`: URL parser / slug 推定 / MarketNode 生成 / mapping なし→手入力 / info ビルダー
- `signal.test.ts`: outright_champion の weight=0.20 / 個別試合補正が ±0.03 を超えない / additive 反映
- `no-trading.test.ts`: 取引・wallet・注文サーフェスが存在しないこと / info endpoint のみ
- `store.test.ts`: localStorage 往復 / SSR セーフ
- `signal-board.test.ts`: ソース横並びの集計
- `quality.test.ts`: 警告の判定
