# Round Builder Audit

更新日: 2026-04-24

## 結論

- Round Builder の 5 導線のうち、実害があったのは `公式日程を取り込む` の `round` 引き継ぎ漏れでした。
- GitHub Pages の `/world-toto-lab/` base path 自体は、[next.config.ts](/C:/workspace/world-toto-lab/next.config.ts) の `basePath` / `assetPrefix` で既に吸収されていました。
- 以前の要件メモにあった `/workspace/import-schedule` 形式のネストルートは現行実装では古く、実際の route は top-level の static path です。
- 2026-04-24 時点では、入口を `回を作る` に寄せ、詳細な分岐は `/toto-official-round-import` 内の `作り方を選ぶ` に集約しています。

## Round Builder が動かなかった原因

1. `公式日程を取り込む` ボタンだけが `buildRoundHref(...)` を使っておらず、`round` query を引き継いでいませんでした。
2. `official-schedule-import` と `fixture-selector` 画面でも、相互リンクや戻り導線に `round` を引き継いでいない箇所がありました。
3. route 自体は存在していたので、「画面未実装」ではなく「今の Round に対する作業だと分かりにくい」状態でした。

## 実際に修正したファイル

- [src/app/workspace/page.tsx](/C:/workspace/world-toto-lab/src/app/workspace/page.tsx)
- [src/app/official-schedule-import/page.tsx](/C:/workspace/world-toto-lab/src/app/official-schedule-import/page.tsx)
- [src/app/fixture-selector/page.tsx](/C:/workspace/world-toto-lab/src/app/fixture-selector/page.tsx)
- [src/app/toto-official-round-import/page.tsx](/C:/workspace/world-toto-lab/src/app/toto-official-round-import/page.tsx)
- [src/components/app/round-context-card.tsx](/C:/workspace/world-toto-lab/src/components/app/round-context-card.tsx)

## 各ボタンの遷移先

- `この回に試合を入れる` -> `/toto-official-round-import?round=<roundId>&autoSync=1&sourcePreset=yahoo_toto_schedule&productType=<currentProductType>`
- `W杯日程から準備する` -> `/official-schedule-import?round=<roundId>`
- `13試合を選ぶ` -> `/fixture-selector?round=<roundId>`
- `公式toto回から作る` -> `/toto-official-round-import#official-round-library`
- `CSV / 手入力で作る` -> `/toto-official-round-import?round=<roundId>&productType=<currentProductType>&start=manual#manual-entry`
- `Simple View` -> `/simple-view?round=<roundId>&user=<userId>`
- `Friend Pick Room` -> `/pick-room?round=<roundId>&user=<userId>`

GitHub Pages 配信時は Next.js の `basePath` により、実 URL は `/world-toto-lab/...` 配下になります。

## base path 対応の内容

- 実装は top-level route を維持し、`next.config.ts` の `basePath` / `assetPrefix` に任せる方式を継続しました。
- `Link href="/pick-room?round=..."` のような書き方でも、GitHub Pages 配信では `/world-toto-lab/pick-room/?round=...` として解決されます。
- Round Builder 下に Debug Panel を追加し、`?debug=1` のときだけ現在 path と生成 href を確認できるようにしました。

## round id 引き継ぎの内容

- Round Builder 5 ボタンを round-aware に整理し、その後 `回を作る` 入口に集約しました。
- `official-schedule-import` から `fixture-selector`、`fixture-selector` から `official-schedule-import` への相互導線でも `round` を保持します。
- import 系 3 画面に `ラウンド詳細へ戻る` 導線を追加しました。

## Supabase 取得失敗時の挙動

- 既存の `ErrorNotice` はそのまま活かしつつ、import 系 3 画面の上部に `Round Context` カードを追加しました。
- `round` が無い新規導線では「新規Round向け」と表示し、そのまま作業を進められます。
- `round` はあるが取得失敗したときは「Roundデータを取得できませんでした。round idまたはSupabase接続を確認してください。」

## iPhone 幅での確認結果

- Round Builder ボタン列は `flex-wrap` のままで、44px 以上のタップ高を保っています。
- Debug Panel は `?debug=1` でのみ出る折りたたみ式なので、通常利用時の主導線を塞ぎません。
- `simple-view` / `pick-room` 側は既存の横スクロールや sticky 保存バーを維持しました。

補足:
- 今回はコードと公開 URL の監査を優先し、実機 Safari の手動操作まではこのセッションでは未実施です。

## まだ未実装の機能

- `/workspace/import-schedule` のようなネストルートは現行アプリでは採用していません。
- 公式日程 / 公式対象回の高度な自動取り込みや同期精度改善は別タスクです。
- 候補生成ロジックの高度化は今回の導線修正スコープ外です。

## 次にやるべきこと

1. GitHub Pages 反映後に live URL で `回を作る` から `作り方を選ぶ` の 3 導線を実クリック確認する
2. `official-schedule-import` から `fixture-selector`、`fixture-selector` からラウンド詳細の往復を確認する
3. `toto-official-round-import` で `CSV / 手入力で作る` が補完入力セクションを開くことを確認する
4. 実クリックで追加の導線不具合が見つかった場合は `debug=1` 付き URL で生成 href を確認する
