# Supabase Status / Local Fallback

World Toto Lab は `GitHub Pages + static export + Supabase` の共有 MVP です。Supabase は友人共有の保存先ですが、GitHub Pages の静的アプリそのものとは別です。そのため Supabase project が paused になっても、Pages の配信とローカル利用は継続できます。

## Supabase project が paused になるとは

Free project は activity が少ないと pause 対象になる可能性があります。paused 状態では Supabase API / PostgREST / Edge Functions への接続が失敗し、共有保存や公式同期が使えなくなります。

pause 後 90 日以内なら、Supabase Dashboard から対象 project を開き、案内に従って unpause できます。

## World Toto Lab への影響

Supabase が使えるとき:

- Round を共有保存できる
- Friend Pick Room の投票やコメントを共有保存できる
- Candidate Vote を共有保存できる
- 公式回ライブラリや research memo を共有保存できる

Supabase が paused / 未設定 / 到達不能のとき:

- GitHub Pages の画面は起動する
- Data Mode Badge に `ローカル保存`、`Supabase未接続`、または `Supabase停止の可能性` が出る
- Round / Matches / Human Picks / Scout Reports / Research Memos / Candidate Tickets / Candidate Votes / Review Notes / Official Round snapshot / BIG Carryover assumptions は localStorage に保存できる
- Friend Pick Room はリアルタイム共有ではなく、自分の端末だけの保存になる
- Edge Function 経由の公式同期は使えない

## GitHub Pages は生きること

この repo は `next.config.ts` の `output: "export"` と query param routing を前提にしています。Supabase が落ちても、静的 route と URL query ベースの計算は壊れません。

生きる機能:

- Dashboard / Round 作成のローカル保存
- Match 編集のローカル保存
- Human Picks / Human Scout Card のローカル保存
- Candidate Tickets / Friend Pick Room のローカル保存
- BIG Carryover の URL query 試算
- サンプルデータによる Demo Mode
- JSON export/import

## Supabase 依存機能

共有保存モードでのみ期待どおりに動くもの:

- 友人の予想共有
- Round の共有保存
- コメント共有
- Candidate Vote 共有
- Official Round Library の共有保存
- Research Memo の共有保存
- Supabase Edge Function 経由の公式一覧同期

Supabase が止まっている時は、これらは localStorage fallback または手入力に切り替わります。

## Data Mode

アプリ起動時に軽い health check を行います。keep-alive 目的の定期アクセスではなく、実際にアプリを開いた時の接続確認だけです。

判定:

- `ok`: Supabase に接続できる
- `missing_env`: `NEXT_PUBLIC_SUPABASE_URL` または `NEXT_PUBLIC_SUPABASE_ANON_KEY` がない
- `network_error`: ブラウザから Supabase に到達できない
- `paused_or_unreachable`: project paused、または一時的に到達不能の可能性
- `schema_mismatch`: 接続できたが必要テーブルがない、または schema がずれている
- `unknown`: その他の未分類エラー

モード:

- `共有保存`: Supabase を使う
- `ローカル保存`: localStorage を使う
- `デモ`: サンプルだけ表示し、保存しない

## local fallback

localStorage key は `world-toto-lab:v1:*` で名前空間を分けています。

代表例:

```text
world-toto-lab:v1:rounds
world-toto-lab:v1:currentRound
world-toto-lab:v1:picks
world-toto-lab:v1:matches
world-toto-lab:v1:scoutReports
world-toto-lab:v1:candidateTickets
world-toto-lab:v1:candidateVotes
world-toto-lab:v1:researchMemos
world-toto-lab:v1:reviewNotes
world-toto-lab:v1:totoOfficialRounds
world-toto-lab:v1:totoOfficialMatches
world-toto-lab:v1:bigCarryoverAssumptions
```

注意:

- localStorage は端末とブラウザごとの保存です
- ブラウザのデータ削除で消えます
- 友人間共有には JSON export/import、スクリーンショット、画面共有を使います

## backup / export 手順

1. 対象 Round を開く
2. Round ナビゲーションの `JSON export` を押す
3. 保存された JSON をバックアップとして残す

JSON には Round、Matches、Picks、Scout Reports、Research Memos、Candidate Tickets、Candidate Votes、Review Notes、BIG Carryover assumptions、Official Round snapshot、Users、metadata が入ります。

## import 手順

1. 画面上部の `JSON`、または接続失敗パネルの `JSONを読み込む` を押す
2. export 済み JSON を選ぶ
3. preview で Round 名、試合数、予想数などを確認する
4. `別Roundとして取り込み` または `上書きで取り込み` を選ぶ

共有保存モードで Supabase に接続できる場合は共有保存へ保存します。ローカル保存モード中、または Supabase に接続できない場合は localStorage へ保存します。

## unpause 手順

1. Supabase Dashboard にログインする
2. `world-toto-lab` project を開く
3. pause / inactive project の案内に従って unpause する
4. project が起動するまで待つ
5. World Toto Lab で `再接続` を押す
6. Data Mode Badge が `共有保存` / `Supabase OK` に戻ることを確認する

## 本番前チェックリスト

- Supabase project が paused ではない
- `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` が Pages build に設定されている
- `npm run audit:schema` が通る
- 必要に応じて `npm run check:supabase` で本番 schema を確認する
- 主要 Round を 1 件 JSON export してバックアップする
- Friend Pick Room で共有保存モード表示を確認する
- Supabase を意図的に使わない運用時は、ローカル保存モード表示と JSON import/export を確認する
- W杯本番で安定運用するなら Pro plan または別 backend を検討する

## 禁止事項

この fallback はアプリを最低限生かすためのものです。次は実装しません。

- 購入代行
- 賭け金管理
- 配当分配
- ユーザー間賭博
- Supabase 本番データの削除
- Free project の pause 回避を目的にした過度な keep-alive
