"""toto 第1644回 2,000円(20口)購入シート スマホ入力用・縦版 (v2).

スマホの購入画面は「試合が縦に並び、各試合で 1/0/2 を選ぶ」ため、
行=試合(13行)・列=口 のマークシート型に組む。1列ぶん上から下へ入力→下端の✓欄を塗る。
出目は v1 (generate-toto-1644-2000yen-sheet-pdf.py) と同一。
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
PDF_NAME = "toto-1644-2000yen-sheet-20260808-v2-mobile.pdf"
PUBLIC_DIR = ROOT / "public" / "reports"

# (No, 短縮カード名, KO)
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

BASE = [2, 1, 1, 2, 1, 1, 2, 2, 1, 2, 2, 1, 1]

OVERRIDES: list[dict[int, int]] = [
    {},
    {5: 0},
    {4: 0},
    {6: 0},
    {2: 0},
    {2: 0, 4: 0},
    {2: 0, 5: 0},
    {2: 0, 6: 0},
    {4: 0, 5: 0},
    {4: 0, 6: 0},
    {5: 0, 6: 0},
    {1: 0},
    {1: 1},
    {8: 1},
    {8: 0},
    {13: 0},
    {13: 2},
    {1: 0, 5: 0},
    {8: 1, 5: 0},
    {1: 1, 8: 1},
]


def line(overrides: dict[int, int]) -> list[int]:
    result = list(BASE)
    for match_no, outcome in overrides.items():
        result[match_no - 1] = outcome
    return result


def sheet_table(start: int, end: int) -> Table:
    """口 start..end (1始まり・両端含む) のマークシート型テーブル。"""
    lines = [line(OVERRIDES[i - 1]) for i in range(start, end + 1)]
    n = len(lines)

    header = ["No", "カード", "KO"] + [f"口{i}" for i in range(start, end + 1)]
    rows: list[list[str]] = [header]
    for m_idx, (no, card, ko) in enumerate(MATCHES):
        rows.append([no, card, ko] + [str(marks[m_idx]) for marks in lines])
    rows.append(["", "入力したら✓", ""] + ["□"] * n)

    t = Table(rows, colWidths=[7 * mm, 27 * mm, 16 * mm] + [12.8 * mm] * n, repeatRows=1)
    style = [
        ("FONTNAME", (0, 0), (-1, -1), "YuGothic"),
        ("FONTNAME", (0, 0), (-1, 0), "YuGothic-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTSIZE", (3, 1), (-1, -2), 11.5),  # マーク数字は大きく
        ("FONTSIZE", (0, -1), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#999999")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eef4")),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f2f2ee")),
        ("ALIGN", (2, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 1), (-1, -2), 4.2),
        ("BOTTOMPADDING", (0, 1), (-1, -2), 4.2),
        # 偶数列に薄い縞で列迷子防止
    ]
    for col in range(3, 3 + n):
        if (start + col - 3) % 2 == 0:
            style.append(("BACKGROUND", (col, 1), (col, len(MATCHES)), colors.HexColor("#f6f9fb")))
    # 本命線からの変更マスを強調
    for l_idx, i in enumerate(range(start, end + 1)):
        for match_no in OVERRIDES[i - 1]:
            style.append((
                "BACKGROUND", (3 + l_idx, match_no), (3 + l_idx, match_no),
                colors.HexColor("#fdd9a0"),
            ))
            style.append((
                "FONTNAME", (3 + l_idx, match_no), (3 + l_idx, match_no), "YuGothic-Bold",
            ))
    t.setStyle(TableStyle(style))
    return t


def build() -> Path:
    pdfmetrics.registerFont(TTFont("YuGothic", "C:/Windows/Fonts/YuGothR.ttc", subfontIndex=0))
    pdfmetrics.registerFont(TTFont("YuGothic-Bold", "C:/Windows/Fonts/YuGothB.ttc", subfontIndex=0))
    base_styles = getSampleStyleSheet()
    body = ParagraphStyle("body", parent=base_styles["Normal"], fontName="YuGothic", fontSize=8.5, leading=13)
    big = ParagraphStyle("big", parent=body, fontName="YuGothic-Bold", fontSize=11,
                         textColor=colors.HexColor("#8a2b06"))
    title = ParagraphStyle("title", parent=base_styles["Title"], fontName="YuGothic-Bold",
                           fontSize=14, leading=18)

    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    out_path = PUBLIC_DIR / PDF_NAME
    doc = SimpleDocTemplate(
        str(out_path), pagesize=A4,
        leftMargin=11 * mm, rightMargin=11 * mm, topMargin=11 * mm, bottomMargin=11 * mm,
        title="toto 第1644回 2,000円購入シート（スマホ入力用）",
    )
    story: list = []
    story.append(Paragraph("toto 第1644回　2,000円（20口）購入シート — スマホ入力用", title))
    story.append(Paragraph("締切: 本日 8/8（土） ネット <b>14:35</b>（コンビニ 12:45）", big))
    story.append(Paragraph(
        "使い方: 購入画面で「シングル」を選び、<b>1列（＝1口）ずつ</b>上から下へ 13 試合をマーク → "
        "その口をカートに入れたら列の下の ✓ を塗る → 次の列へ。"
        "オレンジのマスだけが「口1（本命線）」と違う箇所。1=ホーム勝ち／0=その他（引分等）／2=ホーム負け。", body))
    story.append(Spacer(1, 5))

    story.append(Paragraph("口1〜10（口1=群衆本命線・口2〜口10は引き分け差し込み）", body))
    story.append(sheet_table(1, 10))
    story.append(Spacer(1, 7))
    story.append(Paragraph("口11〜20（引き分け差し込み続き＋接戦3試合の逆側カバー）", body))
    story.append(sheet_table(11, 20))
    story.append(Spacer(1, 5))
    story.append(Paragraph(
        "20口 × 100円 = 2,000円。キャリー0円・優位比未測定のため期待値は約0.5（期待損失 約1,000円）＝"
        "検証データを買う位置づけ。購入判断・実際の口数はユーザー。"
        "出目根拠: docs/toto-prediction-log.md（10:57 投票率スナップショット・commit 5361c3f）。", body))

    doc.build(story)
    return out_path


if __name__ == "__main__":
    print(f"OK: {build()}")
