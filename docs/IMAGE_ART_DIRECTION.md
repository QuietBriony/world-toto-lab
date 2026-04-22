# IMAGE ART DIRECTION

World Toto Lab の画像アセット方針メモです。  
この repo では、実行時に画像生成せず、**開発時に作った画像を `public/art/` に置く**形を基本にします。

## ねらい

- GitHub Pages の静的配信を壊さない
- 画像が無くても UI は動く
- 後から `GPT Image 2` などで差し替えやすくする
- 文字は画像に焼かず、HTML/CSS 側で出す

## いま使っている枠

### 候補カードヘッダー

- `public/art/strategies/orthodox-model.webp`
- `public/art/strategies/ev-hunter.webp`
- `public/art/strategies/human-consensus.webp`
- `public/art/strategies/draw-alert.webp`
- `public/art/strategies/public-favorite.webp`
- `public/art/strategies/sleeping-value.webp`
- `public/art/strategies/upset.webp`

### ダッシュボードの体験バナー

- `public/art/banners/demo-lab.webp`
- `public/art/banners/big-watch.webp`
- `public/art/banners/goal3-board.webp`
- `public/art/banners/winner-board.webp`
- `public/art/banners/big-empty.webp`

## まず差し替える優先順

1. `候補カード`
2. `ダッシュボード体験バナー`
3. `BIG / GOAL3 / WINNER` の見出しバナー
4. 空状態イラスト

## 画像の作り方ルール

- 画像の中に日本語タイトルを入れない
- ロゴや実在クラブロゴは入れない
- 左側か中央に、文字を重ねるための空き領域を残す
- 横長の banner 構図にする
- 明るすぎず、白文字が読める暗部を残す
- プレイヤー人物は基本入れない
- 「ゲームっぽい UI の高揚感」は出すが、ギャンブル広告っぽさは出しすぎない

## `GPT Image 2` 向けの基本 prompt ひな型

```text
Use case: stylized-concept
Asset type: football prediction app banner background
Primary request: create a premium, playful sports UI background with no text
Scene/backdrop: stylized football stadium with subtle HUD overlays and layered card atmosphere
Subject: abstract match prediction energy, no players, no logos
Style/medium: polished 2.5D illustration, game-like but clean
Composition/framing: wide landscape banner, safe empty area for overlaid text
Lighting/mood: energetic evening glow, readable behind white text
Color palette: emerald, navy, cyan, warm gold accents
Materials/textures: glassy UI sheen, soft grain, subtle gradients
Constraints: no text, no watermark, no logos
```

## 候補タイプ別 prompt の方向

### 王道

- 芝のセンターライン
- 安定した対称性
- 落ち着いたスタジアム光

### 公式人気

- 人気が集まるボード感
- スコアパネル風
- 王道より少し明るい

### 人力推し

- 手書きメモ感
- 付箋やノートの質感を少しだけ混ぜる
- ただし文字は入れない

### EV狙い

- レーダーや差分ライン
- 右側に情報が集まる
- 左側は文字用に空ける

### 人気薄狙い

- 暗めの背景に細い光
- 目立ちすぎないが気になる感じ

### 引き分け警報

- 均衡した 2 色
- 青い警報光
- 対立というより拮抗感

### 荒れ狙い

- 斜めの勢い
- 強めの差し色
- 波乱の気配

## 実運用メモ

- まずは `public/art/` の既存ファイル名をそのまま置き換える
- 既存ファイルを上書きしたくない時は `*-v2.webp` を作って `src/lib/ui-art.ts` だけ差し替える
- 画像生成物は、採用版だけ repo に入れる
- 文字や数値は画像ではなく UI 側に残す

## 今回の採用方針

- `orthodox-model.webp`
- `ev-hunter.webp`
- `human-consensus.webp`
- `draw-alert.webp`
- `public-favorite.webp`
- `sleeping-value.webp`
- `upset.webp`
- `demo-lab.webp`
- `big-watch.webp`
- `goal3-board.webp`
- `winner-board.webp`
- `big-empty.webp`

の 12 枚は、実生成した画像を `webp` 化して採用しています。  
戦略カード側はこれで主要タイプがほぼ実画像化できたので、次は空状態やイベントカードを足していく方針です。
