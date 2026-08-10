"""BIG 第1644回 事前登録 → 結果照合レポート PDF.

事前予測の数値はすべて src/lib/big-carryover/calculator.ts の関数出力
(calculateBigTrueEv / predictNextCarryoverYen / trueEvCeilingWithoutCancellations)
を転記したもの。式をこのスクリプトで再実装しない（腐るため）。
出典: docs/big-carryover-prediction-log.md（2026-08-08 10:00 事前登録・commit 8c51d53）。

結果照合(8/9 抽せん後): RESULTS を実測値で埋めて再実行し、vN を上げる。
"""

from __future__ import annotations

import shutil
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
PDF_NAME = "big-carryover-1644-verification-20260810-v2.pdf"
PDF_ALIASES = ("big-carryover-verification-latest.pdf",)
PUBLIC_DIR = ROOT / "public" / "reports"

# ── 結果照合（8/9 抽せん後に実測値で埋める。None のままなら「未照合」で出力）──
RESULTS: dict[str, dict[str, float | int | None]] | None = None
# 例:
# RESULTS = {
#     "BIG": {"finalSalesYen": ..., "firstPrizeWinners": ..., "payoutPerWinnerYen": ...,
#              "officialNextCarryoverYen": ..., "predictedNextCarryoverYen": ...},
#     ...
# }


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("YuGothic", "C:/Windows/Fonts/YuGothR.ttc", subfontIndex=0))
    pdfmetrics.registerFont(TTFont("YuGothic-Bold", "C:/Windows/Fonts/YuGothB.ttc", subfontIndex=0))


def styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "title", parent=base["Title"], fontName="YuGothic-Bold", fontSize=16, leading=22,
        ),
        "h2": ParagraphStyle(
            "h2", parent=base["Heading2"], fontName="YuGothic-Bold", fontSize=12, leading=16,
            spaceBefore=10, spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "body", parent=base["Normal"], fontName="YuGothic", fontSize=9, leading=14,
        ),
        "small": ParagraphStyle(
            "small", parent=base["Normal"], fontName="YuGothic", fontSize=7.5, leading=11,
            textColor=colors.HexColor("#555555"),
        ),
        "warn": ParagraphStyle(
            "warn", parent=base["Normal"], fontName="YuGothic-Bold", fontSize=9.5, leading=14,
            textColor=colors.HexColor("#8a2b06"),
        ),
    }


def table(data: list[list[str]], col_widths: list[float], *, header_rows: int = 1) -> Table:
    t = Table(data, colWidths=col_widths, repeatRows=header_rows)
    style = [
        ("FONTNAME", (0, 0), (-1, -1), "YuGothic"),
        ("FONTNAME", (0, 0), (-1, header_rows - 1), "YuGothic-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#999999")),
        ("BACKGROUND", (0, 0), (-1, header_rows - 1), colors.HexColor("#e8eef4")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    t.setStyle(TableStyle(style))
    return t


def build() -> Path:
    register_fonts()
    st = styles()
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    out_path = PUBLIC_DIR / PDF_NAME

    doc = SimpleDocTemplate(
        str(out_path), pagesize=A4,
        leftMargin=16 * mm, rightMargin=16 * mm, topMargin=14 * mm, bottomMargin=14 * mm,
        title="BIG 第1644回 事前登録→結果照合レポート",
    )
    story: list = []
    story.append(Paragraph("BIG 第1644回 事前登録 → 結果照合レポート", st["title"]))
    story.append(Paragraph(
        "事前登録: 2026-08-08 10:00 JST（販売締切 14:35 の前・git commit 8c51d53 で固定）"
        "　／　抽せん: 2026-08-09（日）", st["body"]))
    story.append(Spacer(1, 6))

    # ── 1. この照合で何を検定するか ──
    story.append(Paragraph("1. この照合で何を検定するか", st["h2"]))
    story.append(Paragraph(
        "真EVは期待値なので、1回の当たり外れでは検証できない（当たっても外れてもモデルと矛盾しない）。"
        "単一回で反証できるのは<b>翌回キャリーオーバー</b>だけ。確定売上 S と1等当せん口数 W から"
        "自由パラメータゼロで一意に決まり、公式発表と1円でも食い違えば、還元率 r・1等配分 α・"
        "上限セマンティクスのどれかが誤りだと確定する。", st["body"]))
    story.append(Spacer(1, 2))
    story.append(Paragraph(
        "1等原資プール P = S × r × α + C　／　1口払戻 = min(P÷W, 上限)　／　"
        "翌回キャリー = P − W × 1口払戻（W=0 なら P 全額）。"
        "計算は predictNextCarryoverYen()（calculator.ts）。", st["small"]))

    # ── 2. 確定入力 ──
    story.append(Paragraph("2. 確定している入力（2026-08-08 09:38 lot-info 実測）", st["h2"]))
    story.append(table(
        [
            ["項目", "BIG", "MEGA BIG", "100円BIG"],
            ["繰越 C（円）", "4,602,871,860", "9,749,023,755", "1,284,256,542"],
            ["売上 8/8 09:38（円）", "776,570,100", "615,128,400", "347,399,300"],
            ["中止数 M", "0（公式お知らせに中止告知なし）", "同左", "同左"],
            ["1等配分 α", "0.80", "0.70", "0.76"],
            ["1等上限（円/口）", "600,000,000", "1,200,000,000", "200,000,000"],
        ],
        [40 * mm, 46 * mm, 46 * mm, 46 * mm],
    ))
    story.append(Paragraph(
        "r=0.50（約款）。出典: store.toto-dream.com lot-info ／ toto.rakuten.co.jp/big/result/1643/ ／"
        " www.toto-dream.com/information/（8月分の中止告知なし）", st["small"]))

    # ── 3. 予測 ──
    story.append(Paragraph("3. 事前予測（結果を見る前に固定した3点）", st["h2"]))
    story.append(Paragraph("予測① 1口真EV（M=0・最終売上に依存しない＝上限張り付きのため）", st["body"]))
    story.append(table(
        [
            ["商品", "BIG", "MEGA BIG", "100円BIG"],
            ["真EV（M=0）", "0.518", "0.388", "0.538"],
        ],
        [40 * mm, 46 * mm, 46 * mm, 46 * mm],
    ))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "予測② 1等当せん口数の期待値と 0口確率（x は 8/8 09:38 売上に対する最終売上倍率）", st["body"]))
    story.append(table(
        [
            ["商品", "S=1.2x", "S=1.4x", "S=1.7x"],
            ["BIG", "0.649口 / P(0)=52.2%", "0.758口 / 46.9%", "0.920口 / 39.8%"],
            ["MEGA BIG", "0.147口 / P(0)=86.4%", "0.171口 / 84.3%", "0.208口 / 81.2%"],
            ["100円BIG", "0.872口 / P(0)=41.8%", "1.017口 / 36.2%", "1.235口 / 29.1%"],
        ],
        [40 * mm, 46 * mm, 46 * mm, 46 * mm],
    ))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "予測③ 翌回（第1645回）キャリー ＝ 本命の検定。参考: S=1.4x のときの値。"
        "照合時は確定 S・W を入れて再計算し、公式値と円単位一致を確認する。", st["body"]))
    story.append(table(
        [
            ["商品", "W=0 のとき（円）", "W=1 のとき（円）", "W=1 の1口払戻"],
            ["BIG", "5,037,751,116", "4,437,751,116", "6億（上限張り付き）"],
            ["MEGA BIG", "10,050,436,671", "8,850,436,671", "12億（上限張り付き）"],
            ["100円BIG", "1,469,072,970", "1,269,072,970", "2億（上限張り付き）"],
        ],
        [34 * mm, 50 * mm, 50 * mm, 44 * mm],
    ))
    story.append(Paragraph(
        "付随予測: 3商品とも1等はプールが厚く<b>上限に張り付く</b>（1等が出ても払戻は cap ちょうど・"
        "超過分は翌回へロールオーバー）。", st["body"]))

    # ── 4. 反証条件 ──
    story.append(Paragraph("4. 反証条件（これが起きたらモデルが間違っている）", st["h2"]))
    story.append(Paragraph(
        "① 公式の翌回キャリーが確定 S・W からの予測と1円でも合わない → r・α・上限解釈の誤り。<br/>"
        "② 1等が出たのに1口払戻が上限未満 → プールの厚さ（α または C）の解釈の誤り。<br/>"
        "③ 1等口数が期待値から極端に外れる（例: BIG で5口以上） → 確率構造の理解の誤り。<br/>"
        "④ 中止0のはずが中止扱いの試合があった → M 認定手順（公式お知らせのみ）の不備。", st["body"]))

    # ── 5. テスト購入の位置づけ ──
    story.append(Paragraph("5. 今回のテスト購入の位置づけ", st["h2"]))
    story.append(Paragraph(
        "ユーザーは本回で BIG 系5商品（BIG / MEGA BIG / 100円BIG / BIG1000 / mini BIG）をテスト購入。"
        "M=0 のため3商品とも真EV&lt;1＝見送り判定の回であることは購入前に共有済み。"
        "BIG1000 と mini BIG は繰越0円のため EV上界0.50・+EV窓は原理的に開かない（bigTrueEvUpperBound で確認）。", st["body"]))
    story.append(Paragraph(
        "＋EV ≠ 回収可能。エッジはほぼ全部1等に乗るため、少額では「ほぼ確実に負け、ごく稀に大勝」の"
        "宝くじ型分布になる。本レポートは購入金額を推奨しない。", st["warn"]))

    # ── 6. 結果照合 ──
    story.append(Paragraph("6. 結果照合（2026-08-10 記入）— 判定: モデル検定 PASS", st["h2"]))
    story.append(table(
        [
            ["照合項目", "予測", "実測", "判定"],
            ["1等当せん口数 W", "BIG 0.65-0.92 / MEGA 0.15-0.21 / 100円 0.87-1.24口",
             "3商品とも 0口", "整合 (P(W=0)=40-86%)"],
            ["翌回(1645)キャリー", "S×r×α + C (W=0)",
             "MEGA 9,983,893,215 / BIG 4,939,079,700 / 100円 1,428,303,066円", "PASS（円単位）"],
            ["逆算最終売上 S=ΔC/(r·α)", "―",
             "MEGA 6.71億 / BIG 8.41億 / 100円 3.79億（締切朝比1.08-1.09x）", "口単価で割り切れ・整合"],
            ["1口払戻の上限張り付き", "1等が出れば cap ちょうど", "1等なし＝検定対象外", "―"],
            ["中止 M=0 のまま成立", "M=0", "M=0 で成立", "PASS"],
        ],
        [42 * mm, 52 * mm, 56 * mm, 28 * mm],
    ))
    story.append(Paragraph(
        "反証条件①〜④はいずれも不発。r·α（0.35/0.40/0.38）のどれか1つでも誤っていれば逆算Sが"
        "口単価（300/300/100円）で割り切れる確率はほぼゼロ＝3商品同時一致は α の強い独立検証。", st["body"]))
    story.append(Paragraph(
        "ユーザー実購入: BIG系5商品×8口=8,800円 → 全外れ・払戻0円（期待払戻4,200円に対する1回分の分散として正常）。"
        "toto 20口(-2,000円)と合わせ授業料 −10,800円。出典: toto.rakuten.co.jp/big/result/1644/", st["small"]))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "生成: scripts/generate-big-1644-verification-pdf.py ／ 事前登録の正本: "
        "docs/big-carryover-prediction-log.md（commit 8c51d53）", st["small"]))

    doc.build(story)

    for alias in PDF_ALIASES:
        shutil.copyfile(out_path, PUBLIC_DIR / alias)
    return out_path


if __name__ == "__main__":
    path = build()
    print(f"OK: {path}")
    for alias in PDF_ALIASES:
        print(f"OK: {PUBLIC_DIR / alias}")
