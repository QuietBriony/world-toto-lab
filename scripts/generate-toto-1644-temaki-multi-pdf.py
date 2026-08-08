"""toto 第1644回 手組相当・マルチ2回入力シート (v5).

手組20口(v2)は積の形でないためマルチ1発では買えない。同じ狙い(引分過小+接戦カバー)を
マルチ2発に再構成する:
  入力① 引分マルチ 16口 = M2/M4/M5/M6 ダブル (v4 と同一)
  入力② 接戦マルチ  4口 = M1{2,0} × M8{2,1} ダブル
計20口=2,000円。①を既に購入済みなら②(400円)の追加だけで手組相当になる。
"""

from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
PDF_NAME = "toto-1644-temaki-multi-sheet-20260808-v5.pdf"
PUBLIC_DIR = ROOT / "public" / "reports"

# (No, カード, KO)
MATCHES = [
    ("1", "FC東京-町田", "8/8 19:00"),
    ("2", "Ｃ大阪-岡山", "8/8 19:00"),
    ("3", "名古屋-清水", "8/8 19:00"),
    ("4", "福岡-神戸", "8/8 19:00"),
    ("5", "広島-千葉", "8/8 19:15"),
    ("6", "柏-水戸", "8/8 19:00"),
    ("7", "東京Ｖ-川崎", "8/9 18:00"),
    ("8", "長崎-京都", "8/9 19:00"),
    ("9", "札幌-徳島", "8/8 14:45"),
    ("10", "藤枝-仙台", "8/8 18:30"),
    ("11", "八戸-富山", "8/8 18:30"),
    ("12", "山形-栃木Ｃ", "8/9 19:00"),
    ("13", "いわき-今治", "8/9 18:00"),
]

# 入力①・②の 押すマーク (match_no -> marks)
ENTRY1 = {1: ["2"], 2: ["1", "0"], 3: ["1"], 4: ["0", "2"], 5: ["1", "0"], 6: ["1", "0"],
          7: ["2"], 8: ["2"], 9: ["1"], 10: ["2"], 11: ["2"], 12: ["1"], 13: ["1"]}
ENTRY2 = {1: ["2", "0"], 2: ["1"], 3: ["1"], 4: ["2"], 5: ["1"], 6: ["1"],
          7: ["2"], 8: ["2", "1"], 9: ["1"], 10: ["2"], 11: ["2"], 12: ["1"], 13: ["1"]}


def entry_table(entry: dict[int, list[str]]) -> Table:
    header = ["No", "カード", "KO", "押すマーク", ""]
    rows: list[list[str]] = [header]
    for no, card, ko in MATCHES:
        marks = entry[int(no)]
        rows.append([no, card, ko, "　".join(marks), "ダブル" if len(marks) > 1 else ""])

    t = Table(rows, colWidths=[9 * mm, 40 * mm, 21 * mm, 36 * mm, 18 * mm], repeatRows=1)
    style = [
        ("FONTNAME", (0, 0), (-1, -1), "YuGothic"),
        ("FONTNAME", (0, 0), (-1, 0), "YuGothic-Bold"),
        ("FONTNAME", (3, 1), (3, -1), "YuGothic-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTSIZE", (3, 1), (3, -1), 13),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#999999")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eef4")),
        ("ALIGN", (2, 0), (3, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 1), (-1, -1), 3.4),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 3.4),
    ]
    for row_idx, (no, _, _) in enumerate(MATCHES, start=1):
        if len(entry[int(no)]) > 1:
            style.append(("BACKGROUND", (3, row_idx), (4, row_idx), colors.HexColor("#fdd9a0")))
    t.setStyle(TableStyle(style))
    return t


def build() -> Path:
    pdfmetrics.registerFont(TTFont("YuGothic", "C:/Windows/Fonts/YuGothR.ttc", subfontIndex=0))
    pdfmetrics.registerFont(TTFont("YuGothic-Bold", "C:/Windows/Fonts/YuGothB.ttc", subfontIndex=0))
    base_styles = getSampleStyleSheet()
    body = ParagraphStyle("body", parent=base_styles["Normal"], fontName="YuGothic", fontSize=9, leading=13.5)
    big = ParagraphStyle("big", parent=body, fontName="YuGothic-Bold", fontSize=11,
                         textColor=colors.HexColor("#8a2b06"))
    h2 = ParagraphStyle("h2", parent=body, fontName="YuGothic-Bold", fontSize=11.5, spaceBefore=6)
    title = ParagraphStyle("title", parent=base_styles["Title"], fontName="YuGothic-Bold",
                           fontSize=14.5, leading=18)

    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    out_path = PUBLIC_DIR / PDF_NAME
    doc = SimpleDocTemplate(
        str(out_path), pagesize=A4,
        leftMargin=16 * mm, rightMargin=16 * mm, topMargin=12 * mm, bottomMargin=12 * mm,
        title="toto 第1644回 手組相当・マルチ2回入力シート",
    )
    story: list = []
    story.append(Paragraph("toto 第1644回　手組相当・マルチ2回入力（計20口＝2,000円）", title))
    story.append(Paragraph("締切: 本日 8/8（土） ネット 14:35（コンビニ 12:45）", big))
    story.append(Paragraph(
        "マルチ入力を<b>2回</b>やるだけで手組20口相当になる。各回とも「マルチ」を選び、"
        "各行の数字を全部押す → 口数表示を確認してカートへ。"
        "<b>入力①は先のマルチ版(v4)と同一</b>なので、すでに①を買っていれば<b>入力②(400円)の追加だけ</b>でよい。", body))

    story.append(Paragraph("入力①　引き分けマルチ — 16口 / 1,600円（v4 と同一）", h2))
    story.append(entry_table(ENTRY1))
    story.append(Spacer(1, 6))
    story.append(Paragraph("入力②　接戦マルチ — 4口 / 400円", h2))
    story.append(entry_table(ENTRY2))
    story.append(Spacer(1, 6))

    story.append(Paragraph(
        "＜中身＞ ①は引き分け過小4試合（Ｃ大阪・福岡・広島・柏）に0を差し込む全16通り（事前登録仮説B）。"
        "②は接戦2試合の逆側カバー: FC東京-町田を「町田勝ち or 引き分け」、長崎-京都を「京都勝ち or 長崎勝ち」の"
        "2×2=4通り（仮説Cの主力2試合）。手組v2との差分: いわき-今治の逆側・接戦×引分の複合線は落ち、"
        "代わりに引分3〜4個の深い線と M1×M8 同時ブレ線が入る。狙い（引分過小＋接戦カバー）は同等。", body))
    story.append(Paragraph(
        "＜冷や水＞ キャリー0円・優位比未測定のため期待値は約0.5（期待損失 約1,000円）＝検証データを買う位置づけ。"
        "購入判断・実際の口数はユーザー。<b>実際に買った構成（①のみ／①＋②）を購入後に共有</b>してほしい。", body))
    story.append(Paragraph(
        "出目根拠: docs/toto-prediction-log.md（10:57 投票率スナップショット・commit 5361c3f）", body))

    doc.build(story)
    return out_path


if __name__ == "__main__":
    print(f"OK: {build()}")
