"""toto 第1644回 マルチ一発入力シート (v4).

スマホの「マルチ」入力: 試合ごとに押すマークを複数選ぶと組み合わせが自動で口数になる。
引き分け過小4試合(M2/M4/M5/M6)をダブルにして 2^4=16口=1,600円 を1回の入力で済ませる。
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
PDF_NAME = "toto-1644-multi-sheet-20260808-v4.pdf"
PUBLIC_DIR = ROOT / "public" / "reports"

# (No, カード, KO, 押すマーク list, 補足)
ROWS = [
    ("1", "FC東京-町田", "8/8 19:00", ["2"], ""),
    ("2", "Ｃ大阪-岡山", "8/8 19:00", ["1", "0"], "ダブル"),
    ("3", "名古屋-清水", "8/8 19:00", ["1"], ""),
    ("4", "福岡-神戸", "8/8 19:00", ["0", "2"], "ダブル"),
    ("5", "広島-千葉", "8/8 19:15", ["1", "0"], "ダブル"),
    ("6", "柏-水戸", "8/8 19:00", ["1", "0"], "ダブル"),
    ("7", "東京Ｖ-川崎", "8/9 18:00", ["2"], ""),
    ("8", "長崎-京都", "8/9 19:00", ["2"], ""),
    ("9", "札幌-徳島", "8/8 14:45", ["1"], ""),
    ("10", "藤枝-仙台", "8/8 18:30", ["2"], ""),
    ("11", "八戸-富山", "8/8 18:30", ["2"], ""),
    ("12", "山形-栃木Ｃ", "8/9 19:00", ["1"], ""),
    ("13", "いわき-今治", "8/9 18:00", ["1"], ""),
]


def build() -> Path:
    pdfmetrics.registerFont(TTFont("YuGothic", "C:/Windows/Fonts/YuGothR.ttc", subfontIndex=0))
    pdfmetrics.registerFont(TTFont("YuGothic-Bold", "C:/Windows/Fonts/YuGothB.ttc", subfontIndex=0))
    base_styles = getSampleStyleSheet()
    body = ParagraphStyle("body", parent=base_styles["Normal"], fontName="YuGothic", fontSize=9, leading=14)
    big = ParagraphStyle("big", parent=body, fontName="YuGothic-Bold", fontSize=11.5,
                         textColor=colors.HexColor("#8a2b06"))
    title = ParagraphStyle("title", parent=base_styles["Title"], fontName="YuGothic-Bold",
                           fontSize=15, leading=19)

    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    out_path = PUBLIC_DIR / PDF_NAME
    doc = SimpleDocTemplate(
        str(out_path), pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm, topMargin=14 * mm, bottomMargin=14 * mm,
        title="toto 第1644回 マルチ一発入力シート",
    )
    story: list = []
    story.append(Paragraph("toto 第1644回　マルチ一発入力シート（16口＝1,600円）", title))
    story.append(Paragraph("締切: 本日 8/8（土） ネット 14:35（コンビニ 12:45）", big))
    story.append(Paragraph(
        "使い方: 購入画面で「<b>マルチ</b>」を選び、上から試合順に、<b>各行に書いてある数字を全部</b>押す"
        "（1個の行は1個だけ・「ダブル」の行は2個とも）。最後に組み合わせ数が <b>16口 / 1,600円</b> に"
        "なっていることを確認して購入。入力は1回で終わり。", body))
    story.append(Spacer(1, 8))

    header = ["No", "カード", "KO", "押すマーク", ""]
    rows: list[list[str]] = [header]
    for no, card, ko, marks, note in ROWS:
        rows.append([no, card, ko, "　".join(marks), note])

    t = Table(rows, colWidths=[10 * mm, 42 * mm, 22 * mm, 40 * mm, 20 * mm], repeatRows=1)
    style = [
        ("FONTNAME", (0, 0), (-1, -1), "YuGothic"),
        ("FONTNAME", (0, 0), (-1, 0), "YuGothic-Bold"),
        ("FONTNAME", (3, 1), (3, -1), "YuGothic-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("FONTSIZE", (3, 1), (3, -1), 15),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#999999")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eef4")),
        ("ALIGN", (2, 0), (3, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 1), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
    ]
    for row_idx, (_, _, _, marks, _) in enumerate(ROWS, start=1):
        if len(marks) > 1:
            style.append(("BACKGROUND", (3, row_idx), (4, row_idx), colors.HexColor("#fdd9a0")))
    t.setStyle(TableStyle(style))
    story.append(t)
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        "＜中身＞ オレンジの4試合（Ｃ大阪・福岡・広島・柏）は、群衆の引き分け投票が11〜18%しかない"
        "「引き分け過小」試合（事前登録済み仮説）。本命＋引き分けのダブルにすることで、"
        "本命線〜引き分け4個まで全16通りをカバーする。他9試合は群衆本命に固定。", body))
    story.append(Paragraph(
        "＜冷や水＞ キャリー0円・優位比未測定のため期待値は約0.5（期待損失 約800円）＝検証データを買う"
        "位置づけ。購入判断・実際の口数はユーザー。手組み20口版（v2）とは構成が異なるので、"
        "<b>どちらを買ったかを購入後に共有</b>してもらえると明日の照合が正確になる。", body))
    story.append(Paragraph(
        "出目根拠: docs/toto-prediction-log.md（10:57 投票率スナップショット・commit 5361c3f）", body))

    doc.build(story)
    return out_path


if __name__ == "__main__":
    print(f"OK: {build()}")
