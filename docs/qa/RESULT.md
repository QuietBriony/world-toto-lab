# QA-LOOP 結果サマリ

> 自走QAループ（Phase1ストーリー化 → Phase2検証 → Phase3修正 → Phase4再検証）の 1 サイクル完了ログ。
> 単一正典は [feature-stories.csv](./feature-stories.csv)、状態は [LOOP-STATE.md](./LOOP-STATE.md)、運用は [QA-LOOP.md](./QA-LOOP.md)。

## サイクル1（2026-06-24, iteration 1〜6）

### 結論：**全検証グリーン・不具合ゼロ**。working tree 変更なし、コミット/PR なし（無人 push 保留）。

核心機能 12 件（S01〜S12）をユーザーストーリー化し、**3 つの独立した手法**で検証。いずれも不具合は検出されず。

### Phase 1 — ストーリー化（12件）

| ID | 機能 | 区分 |
|---|---|---|
| S01 | EV機会ボード | 分析 |
| S02 | 試合確率の準備度判定 | ロジック |
| S03 | W杯戦略の候補宇宙ガード | ロジック |
| S04 | 共有保存とローカルfallback（facade） | 基盤 |
| S05 | 候補チケット生成 | ロジック |
| S06 | 友達プレイ画面（play/pick-room） | 友達導線 |
| S07 | 練習ラボ指標 | 練習/振り返り |
| S08 | WINNER妙味判定 | 分析 |
| S09 | totoGOAL3 妙味ウォッチ | 分析 |
| S10 | 招待リンク生成（admin非漏洩） | 友達導線 |
| S11 | BIGキャリーオーバー圧 | 分析 |
| S12 | toto公式回CSV取り込み | 編集/取込 |

全件 `期待挙動(file:line)` を実コード＋既存テストで裏付け済み。

### Phase 2 — 検証（3手法すべて緑）

1. **自動コマンドスイート**
   - `npm test`（vitest）= **285 passed / 43 files / 1.63s**
   - `npm run lint` = **0 errors**
   - `npm run build` = **28 static pages** 全 prerender 成功
   - `npm run check:pages` = **failures: 0**（live Pages 200）
2. **facade 静的監査（S04）** — `repository.ts` 全 export 関数を監査。D1-backed 22 関数すべてが `isCloudflareD1Mode()` 分岐を持ち、always-local 関数も silent no-op にならない（明示エラー / demo専用 / 呼び出しページが `setMode("local")` を強制）。**過去 PR #C/#D/#J/#H で潰した「共有D1で黙ってno-op」再発バグ class は残存ゼロ。**
3. **preview smoke（dev サーバ実走 5 ルート）**
   - `/` … console clean、EV preview panel 描画（#73 モバイル導線 / #74 EV順序を live 確認）
   - `/world-cup-strategy` … **domInteractive 89ms**・17表・凍結なし（#72 宇宙ガード live 確認）
   - `/ev-opportunities` … self-link **0** / tap<44px **0** / 6カード（#74 #77 live 確認）
   - `/play` … no-round 状態を正常描画、error なし
   - `/big-carryover` … 「真EV未計算」あり・**煽り文言なし**（S11 回帰ガード live 確認）
   - 全ルートで **console error/warning ゼロ**

### Phase 3 — 修正

- **修正対象なし**（Phase 2 で不具合ゼロ）。minimal-diff 原則に従い、無理に変更は加えていない。

### Phase 4 — 再検証

- 不具合がないため再検証は不要。preview 実走で挙動を確認済みの S01/S03/S06/S11 は live グリーンを併記。

### human_gate（人間判断待ち）

- なし。見た目の好みで人間に上げる項目は発生せず。

## 補足：このサイクルでカバーしていない範囲（次サイクル候補）

- ストーリー化は核心 12 機能のみ。**未ストーリー化のルート（14）**：consensus / edge-board / review / scout-cards / simple-view / picks / match-editor / workspace / official-schedule-import / dev-playbook / hazi / settings / fixture-selector / official 系。
- これら（特に監査回数の少ない match-editor / workspace / consensus / edge-board）は潜在不具合が残る可能性が相対的に高い。**`/loop` を再実行すれば Phase 1 から coverage を拡張**できる。
- `src/lib/market-sources/**` は別レーン（read-only）のため意図的に対象外。

## 学び（サイクル1）

- 監査結果を実装する前に必ず現コードを再確認（並走 Codex が先に直していることがある）。
- 自動テストが緑なのは CI ゲートと同等なので想定どおり。**QA の価値は静的監査と preview 実走で「テストが触れていない経路」を見ること**にある。今回は再発バグ class（facade no-op）の全面再監査でクローズを裏取りできた。

---

## サイクル2（2026-06-24, iteration 7）

### 結論：**残14ルートを監査し confirmed 不具合4件を working tree で修正・全緑**。コミット/PR は号令まで保留。

multi-agent workflow（read-only 監査エージェント5 + 各疑い項目に adversarial verify）で残ルートを **27 ストーリー化（S13-S39）**、**疑い4件すべてが confirmed（0 refuted）**。4件とも自分で実コードを再確認のうえ working tree で最小修正し、`npm test/lint/build` 全緑＋preview 実走で確認。

### Phase 1 — ストーリー化（S13-S39, 27件）
match-editor / workspace / consensus / edge-board / review / scout-cards / simple-view / picks / official-schedule-import / fixture-selector / settings / hazi / dev-playbook を網羅。各 file:line 根拠付き。

### Phase 2 — 監査（4 confirmed / 0 refuted）

| ID | route | severity | 不具合 |
| --- | --- | --- | --- |
| D1 | /match-editor | high | kickoff の datetime-local が TZ 非対称。初期化=UTC壁時計・保存=ローカル解釈で、JST では見出し(Asia/Tokyo)と9hズレ＋**無編集保存でも毎回-9hドリフト**。 |
| D2 | /match-editor | medium | memo 保存成功後の `event.currentTarget.reset()` が await 跨ぎで currentTarget=null→TypeError→catchで**偽の「保存失敗」**＋入力欄未クリア（メモは保存済）。 |
| D3 | /simple-view | medium | メンバー切替が picks/scout-cards にある未保存ガードを欠き、**未保存の1/0/2が無警告で消える**（1端末回し見の主用途で事故）。 |
| D4 | /settings | high | `dataModeToStorageMode` が cloudflare_d1 を一律 local に落とし、**共有D1本番で Round一覧/JSONエクスポートが端末 localStorage を読む**（代表的な D1 分岐漏れ→共有 no-op class）。 |

### Phase 3 — 修正（4件・すべて page.tsx／hot ファイル不使用）

- **D1**: TZ 変換を新lib `src/lib/datetime-local.ts`（`isoToTokyoDateTimeLocal`/`tokyoDateTimeLocalToIso`、DST無の +09:00 固定）に抽出し往復不変に統一。match-editor の init/save を置換。`formatDateTime`/`domain.ts` は不変。
- **D2**: `await` 前に `const form = event.currentTarget` を退避し `new FormData(form)`/`form.reset()` に置換。
- **D3**: picks/scout-cards と同形の未保存判定（draft vs サーバ picks、初回同期前は誤検知回避）＋ `window.confirm` の `handleSwitchUser` ＋ `beforeunload` を simple-view に追加。
- **D4**: 自前 `dataModeToStorageMode` を廃し、テスト済 `resolveStorageMode({preference: mode, d1ApiBase})` に委譲。`explicitMode` は渡さず provider の health フォールバック判断を尊重。

### Phase 4 — 再検証
- `npm test` = **291 passed / 44 files**（+6 `datetime-local.test.ts`: 往復不変/JST境界/不正値）、`npm run lint` = 0、`npm run build` = 28 pages。
- preview 実走: `/settings`（『ローカル保存』維持＝local dev で回帰なし）・`/match-editor`・`/simple-view` すべて console error ゼロ・描画緑。

### 未実施（号令待ち）
- 4件の **コミット/PR 化**（無人 push 保留）。1PR=1目的で D1+D2(match-editor) / D3(simple-view) / D4(settings)+datetime-local lib に分けるのが安全。

## 学び（サイクル2）

- workflow の confirmed findings も**実装前に必ず自分で実コードを再確認**してから修正する（今回は4件とも正しかったが、fix 方針は agent 提案より保守的に調整＝D4 で explicitMode を渡さず runtime mode を尊重）。
- D1/D4 は「テストが緑でも UI/設定経路に潜む」典型。**ロジックを lib に抽出すると回帰テストが書け、再発も防げる**（datetime-local）。
- D4 は S04 で「クローズ済」と判断した facade no-op class の**別系統（settings 独自の storage mode 解決）**だった。`repository.ts` facade は健全でも、ページが独自に storage adapter を解決する箇所は別途監査が要る。
