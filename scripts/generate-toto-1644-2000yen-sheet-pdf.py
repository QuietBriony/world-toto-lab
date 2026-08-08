"""toto 第1644回 2,000円(20口)購入シート PDF.

出目ロジックは docs/toto-prediction-log.md の事前登録2仮説に沿う:
  A) 群衆本命線をアンカーにする（worldtoto の public favorite ベースライン）
  B) 引き分け過小4試合（M5広島/M4福岡/M6柏/M2C大阪）に 0 を差し込む
  C) 接戦3試合（M1/M8/M13）の逆側をカバーする
p_model(オッズ)不在のため「最適」ではなく「検証可能な構成」。EV<1 前提を明記する。
"""

from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
PDF_NAME = "toto-1644-2000yen-sheet-20260808-v1.pdf"
PUBLIC_DIR = ROOT / "public" / "reports"

MATCHES = [
    ("1", "FC東京-町田", "29.6/30.4/40.1"),
    ("2", "Ｃ大阪-岡山", "68.8/18.0/13.3"),
    ("3", "名古屋-清水", "58.8/22.9/18.3"),
    ("4", "福岡-神戸", "10.8/16.2/73.0"),
    ("5", "広島-千葉", "80.2/11.3/8.6"),
    ("6", "柏-水戸", "71.7/17.7/10.6"),
    ("7", "東京Ｖ-川崎Ｆ", "17.9/25.1/57.1"),
    ("8", "長崎-京都", "32.1/25.9/42.0"),
    ("9", "札幌-徳島", "57.1/22.9/20.1"),
    ("10", "藤枝-仙台", "17.0/24.6/58.4"),
    ("11", "八戸-富山", "20.0/23.5/56.5"),
    ("12", "山形-栃木Ｃ", "55.0/19.8/25.2"),
    ("13", "いわき-今治", "48.7/25.1/26.2"),
]

BASE = [2, 1, 1, 2, 1, 1, 2, 2, 1, 2, 2, 1, 1]  # 群衆本命線 (M1..M13)


def line(overrides: dict[int, int]) -> list[int]:
    """BASE に {matchNo(1始まり): 出目} を上書きした1口を返す。"""
    result = list(BASE)
    for match_no, outcome in overrides.items():
        result[match_no - 1] = outcome
    return result


LINES: list[tuple[str, dict[int, int]]] = [
    ("A 群衆本命線", {}),
    ("B 引分1差替 M5", {5: 0}),
    ("B 引分1差替 M4", {4: 0}),
    ("B 引分1差替 M6", {6: 0}),
    ("B 引分1差替 M2", {2: 0}),
    ("B 引分2差替 M2+M4", {2: 0, 4: 0}),
    ("B 引分2差替 M2+M5", {2: 0, 5: 0}),
    ("B 引分2差替 M2+M6", {2: 0, 6: 0}),
    ("B 引分2差替 M4+M5", {4: 0, 5: 0}),
    ("B 引分2差替 M4+M6", {4: 0, 6: 0}),
    ("B 引分2差替 M5+M6", {5: 0, 6: 0}),
    ("C 接戦 M1→0", {1: 0}),
    ("C 接戦 M1→1", {1: 1}),
    ("C 接戦 M8→1", {8: 1}),
    ("C 接戦 M8→0", {8: 0}),
    ("C 接戦 M13→0", {13: 0}),
    ("C 接戦 M13→2", {13: 2}),
    ("C+B M1→0+M5→0", {1: 0, 5: 0}),
    ("C+B M8→1+M5→0", {8: 1, 5: 0}),
    ("C 接戦2 M1→1+M8→1", {1: 1, 8: 1}),
]


def build() -> Path:
    pdfmetrics.registerFont(TTFont("YuGothic", "C:/Windows/Fonts/YuGothR.ttc", subfontIndex=0))
    pdfmetrics.registerFont(TTFont("YuGothic-Bold", "C:/Windows/Fonts/YuGothB.ttc", subfontIndex=0))
    base_styles = getSampleStyleSheet()
    body = ParagraphStyle("body", parent=base_styles["Normal"], fontName="YuGothic", fontSize=8.5, leading=13)
    warn = ParagraphStyle(
        "warn", parent=body, fontName="YuGothic-Bold", fontSize=9,
        textColor=colors.HexColor("#8a2b06"),
    )
    title = ParagraphStyle(
        "title", parent=base_styles["Title"], fontName="YuGothic-Bold", fontSize=14, leading=18,
    )

    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    out_path = PUBLIC_DIR / PDF_NAME
    doc = SimpleDocTemplate(
        str(out_path), pagesize=landscape(A4),
        leftMargin=12 * mm, rightMargin=12 * mm, topMargin=10 * mm, bottomMargin=10 * mm,
        title="toto 第1644回 2,000円購入シート",
    )
    story: list = []
    story.append(Paragraph("toto 第1644回　2,000円（20口）購入シート", title))
    story.append(Paragraph(
        "販売締切 <b>2026-08-08（土）ネット 14:35</b>／コンビニ 12:45　・　結果発表 08-09　・　"
        "出目根拠: docs/toto-prediction-log.md の事前登録（10:57 投票率スナップショット）", body))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "＜構成＞ A=群衆本命線1口（ベースライン）／ B=引き分け過小4試合（M2 C大阪・M4 福岡・M5 広島・M6 柏に"
        "群衆の0投票が11〜18%しか無い）へ 0 を1〜2個差し込む10口 ／ C=接戦3試合（M1・M8・M13）の逆側カバー9口。"
        "全20口が本命線から2差以内＝本命線がほぼ正しい時に2等・3等圏を厚くする設計。", body))
    story.append(Paragraph(
        "＜冷や水＞ オッズ(p_model)不在のため優位比は測れておらず、キャリー0円の回なので<b>期待値は約0.5＝"
        "期待損失は約1,000円</b>。これは検証データを買う2,000円であり、儲かる構成という主張ではない。", warn))
    story.append(Spacer(1, 6))

    header = ["口", "タイプ"] + [f"M{no}" for no, _, _ in MATCHES]
    rows: list[list[str]] = [header]
    for idx, (label, overrides) in enumerate(LINES, start=1):
        marks = line(overrides)
        rows.append([str(idx), label] + [str(v) for v in marks])

    col_widths = [8 * mm, 40 * mm] + [15.5 * mm] * 13
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    style = [
        ("FONTNAME", (0, 0), (-1, -1), "YuGothic"),
        ("FONTNAME", (0, 0), (-1, 0), "YuGothic-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#999999")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eef4")),
        ("ALIGN", (2, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
    ]
    # BASE からの差分セルをハイライト
    for row_idx, (_, overrides) in enumerate(LINES, start=1):
        for match_no in overrides:
            style.append((
                "BACKGROUND", (1 + match_no, row_idx), (1 + match_no, row_idx),
                colors.HexColor("#fdebc8"),
            ))
            style.append((
                "FONTNAME", (1 + match_no, row_idx), (1 + match_no, row_idx), "YuGothic-Bold",
            ))
    t.setStyle(TableStyle(style))
    story.append(t)
    story.append(Spacer(1, 5))

    legend_rows = [["No", "カード", "投票率 1/0/2 (%)"]] + [
        [no, card, votes] for no, card, votes in MATCHES
    ]
    lt = Table(legend_rows, colWidths=[10 * mm, 46 * mm, 40 * mm], repeatRows=1)
    lt.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "YuGothic"),
        ("FONTNAME", (0, 0), (-1, 0), "YuGothic-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#bbbbbb")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eef4")),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
    ]))
    story.append(lt)
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "出典: 投票率 = 公式 InitVoteRate（2026-08-08 10:57・売上83,981,000円時点）。"
        "1=ホーム90分勝ち・0=その他(延長含む引分等)・2=ホーム90分負け。太字ハイライト=本命線からの変更マス。"
        "購入するかどうか・実際に買う口数はユーザーの判断。", body))

    doc.build(story)
    return out_path


if __name__ == "__main__":
    print(f"OK: {build()}")
