from pathlib import Path
import shutil

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "output" / "pdf"
PUBLIC_DIR = ROOT / "public" / "reports"
TMP_DIR = ROOT / "tmp" / "pdfs"
PDF_NAME = "world-cup-toto-1634-close-report.pdf"

SOURCE_URL = (
    "https://sp.toto-dream.com/dcs/subos/screen/si01/ssin025/"
    "PGSSIN02501ForwardVotetotoSP.form?holdCntId=1634&commodityId=01"
    "&gameAssortment=A&fromId=SSIN026"
)
PROD_URL = "https://quietbriony.github.io/world-toto-lab/world-cup-strategy/"
COMMIT = "79af965 Add World Cup toto strategy dashboard"
RUN_ID = "27498072797"


def register_fonts() -> tuple[str, str]:
    regular_path = Path("C:/Windows/Fonts/YuGothR.ttc")
    bold_path = Path("C:/Windows/Fonts/YuGothB.ttc")
    if not regular_path.exists() or not bold_path.exists():
        raise FileNotFoundError("Yu Gothic fonts were not found under C:/Windows/Fonts.")

    pdfmetrics.registerFont(TTFont("YuGothic", str(regular_path), subfontIndex=0))
    pdfmetrics.registerFont(TTFont("YuGothic-Bold", str(bold_path), subfontIndex=0))
    return "YuGothic", "YuGothic-Bold"


FONT, FONT_BOLD = register_fonts()
PAGE_W, PAGE_H = landscape(A4)

TEAL = colors.HexColor("#0f766e")
TEAL_DARK = colors.HexColor("#064e3b")
TEAL_LIGHT = colors.HexColor("#ccfbf1")
AMBER_LIGHT = colors.HexColor("#fef3c7")
SLATE_LIGHT = colors.HexColor("#f8fafc")
BORDER = colors.HexColor("#cbd5e1")
MUTED = colors.HexColor("#64748b")


def build_styles():
    styles = getSampleStyleSheet()
    base = ParagraphStyle(
        "BaseJP",
        parent=styles["Normal"],
        fontName=FONT,
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#172033"),
        alignment=TA_LEFT,
    )
    return {
        "base": base,
        "title": ParagraphStyle(
            "TitleJP",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=24,
            leading=31,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=8,
        ),
        "subtitle": ParagraphStyle(
            "SubtitleJP",
            parent=base,
            fontSize=11,
            leading=17,
            textColor=colors.HexColor("#475569"),
        ),
        "section": ParagraphStyle(
            "SectionJP",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=15,
            leading=20,
            textColor=TEAL_DARK,
            spaceBefore=8,
            spaceAfter=6,
        ),
        "small": ParagraphStyle(
            "SmallJP",
            parent=base,
            fontSize=8,
            leading=11,
            textColor=MUTED,
        ),
        "cell": ParagraphStyle(
            "CellJP",
            parent=base,
            fontSize=8.2,
            leading=10.8,
        ),
        "cell_bold": ParagraphStyle(
            "CellBoldJP",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=8.2,
            leading=10.8,
        ),
        "metric_label": ParagraphStyle(
            "MetricLabelJP",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=7.8,
            leading=10,
            textColor=TEAL,
        ),
        "metric_value": ParagraphStyle(
            "MetricValueJP",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=15,
            leading=18,
            textColor=colors.HexColor("#0f172a"),
        ),
    }


STYLES = build_styles()


def p(text: str, style_name: str = "base") -> Paragraph:
    return Paragraph(text, STYLES[style_name])


def make_table(data, col_widths, style_commands):
    table = Table(data, colWidths=col_widths)
    table.setStyle(TableStyle(style_commands))
    return table


def standard_grid_style(header=True, row_bands=True):
    commands = [
        ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        commands.extend(
            [
                ("BACKGROUND", (0, 0), (-1, 0), TEAL_DARK),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
            ]
        )
    if row_bands:
        commands.append(("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SLATE_LIGHT]))
    return commands


def add_page_one(story):
    story.append(p("World Toto Lab - W杯toto 締めレポート", "title"))
    story.append(p("第1634回 toto 確定値確認 / W杯締切EV戦略 / 本番デプロイ完了", "subtitle"))
    story.append(Spacer(1, 5 * mm))

    metric_table = make_table(
        [
            [
                [p("本番URL", "metric_label"), p("/world-cup-strategy/", "metric_value"), p("GitHub Pagesで200確認済み", "small")],
                [p("確定売上", "metric_label"), p("289,166,800円", "metric_value"), p("2026年06月12日販売終了時点", "small")],
                [p("初期比", "metric_label"), p("20.72x", "metric_value"), p("13,958,700円 -> 289,166,800円", "small")],
                [p("最大人気ズレ", "metric_label"), p("10.43pt", "metric_value"), p("ブラジル勝ち: 66.13% -> 55.70%", "small")],
            ]
        ],
        [62 * mm, 62 * mm, 62 * mm, 62 * mm],
        [
            ("BACKGROUND", (0, 0), (-1, -1), SLATE_LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.8, BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#e2e8f0")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
        ],
    )
    story.append(metric_table)
    story.append(Spacer(1, 6 * mm))

    story.append(p("本番締め状況", "section"))
    deploy_rows = [
        [p("項目", "cell_bold"), p("状態", "cell_bold"), p("確認内容", "cell_bold")],
        [p("マージ", "cell"), p("完了", "cell_bold"), p("feature/world-cup-strategy-final-close を main へ fast-forward merge", "cell")],
        [p("push", "cell"), p("完了", "cell_bold"), p("origin/main に push 済み。HEAD は 79af965", "cell")],
        [p("GitHub Pages", "cell"), p("成功", "cell_bold"), p(f"Deploy GitHub Pages run {RUN_ID} が success", "cell")],
        [p("本番ルート", "cell"), p("成功", "cell_bold"), p("npm run check:pages で /world-cup-strategy/ を含む全ルート 200", "cell")],
        [p("ローカル検証", "cell"), p("成功", "cell_bold"), p("lint / test / build / Browser DOM確認を通過", "cell")],
    ]
    story.append(make_table(deploy_rows, [38 * mm, 35 * mm, 172 * mm], standard_grid_style()))
    story.append(Spacer(1, 5 * mm))

    story.append(p("今回入れたもの", "section"))
    change_rows = [
        [p("画面", "cell_bold"), p("/world-cup-strategy/ を追加。W杯toto第1634〜1637回の締切、王道EV、EV>100%候補、ポートフォリオを確認可能。", "cell")],
        [p("ダッシュボード", "cell_bold"), p("W杯締切EV戦略カードを追加。第1634回は「確定値あり」と表示。", "cell")],
        [p("確定値", "cell_bold"), p("第1634回の公式投票結果ページから、販売終了時点の売上・投票率を確定値として表示。", "cell")],
        [p("レポート", "cell_bold"), p("docs に詳細レポートを追加し、このPDFを public/reports に配置。", "cell")],
    ]
    change_table = make_table(
        change_rows,
        [35 * mm, 210 * mm],
        [
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#e2e8f0")),
            ("BACKGROUND", (0, 0), (0, -1), TEAL_LIGHT),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ],
    )
    story.append(change_table)
    story.append(Spacer(1, 4 * mm))
    story.append(p(f"本番URL: {PROD_URL}", "small"))
    story.append(p(f"Commit: {COMMIT}", "small"))


def add_page_two(story):
    story.append(p("第1634回 確定値と初期差分", "title"))
    story.append(
        p(
            "公式投票結果ページは販売終了時点の確定値を返す。細かい時系列は未保存のため復元不可だが、6/7朝の初期スナップショットから6/12販売終了時点への二点差分は確認できる。",
            "subtitle",
        )
    )
    story.append(Spacer(1, 4 * mm))

    final_rows = [
        [p("指標", "cell_bold"), p("値", "cell_bold"), p("読み方", "cell_bold")],
        [p("確定売上", "cell"), p("289,166,800円", "cell_bold"), p("販売終了時点の合計売上。初期プリセットの20.72倍。", "cell")],
        [p("合計投票口数", "cell"), p("2,891,668口", "cell_bold"), p("1口100円。EV計算の想定他当せん者に直結。", "cell")],
        [p("本命変化", "cell"), p("0試合", "cell_bold"), p("13試合すべてで公式人気の本命は変わらず。", "cell")],
        [p("最大ズレ", "cell"), p("10.43pt", "cell_bold"), p("単体では数ptでも13試合の積ではEVに大きく効く。", "cell")],
    ]
    story.append(make_table(final_rows, [42 * mm, 50 * mm, 153 * mm], standard_grid_style()))
    story.append(Spacer(1, 5 * mm))

    story.append(p("人気率ズレ上位", "section"))
    drift_data = [
        (2, "ブラジル - モロッコ", "1", "1", "1 -10.43pt", "66.13% -> 55.70%"),
        (5, "ベルギー - エジプト", "1", "1", "1 -7.49pt", "80.24% -> 72.75%"),
        (2, "ブラジル - モロッコ", "1", "1", "0 +6.27pt", "19.62% -> 25.89%"),
        (5, "ベルギー - エジプト", "1", "1", "0 +5.13pt", "12.18% -> 17.31%"),
        (3, "ドイツ - キュラソー", "1", "1", "1 +4.85pt", "90.41% -> 95.26%"),
        (13, "アメリカ - パラグアイ", "1", "1", "0 +4.46pt", "21.74% -> 26.20%"),
        (1, "カタール - スイス", "2", "2", "2 +4.41pt", "79.85% -> 84.26%"),
        (2, "ブラジル - モロッコ", "1", "1", "2 +4.16pt", "14.25% -> 18.41%"),
    ]
    drift_rows = [[p("No", "cell_bold"), p("試合", "cell_bold"), p("初期本命", "cell_bold"), p("確定本命", "cell_bold"), p("最大ズレ", "cell_bold"), p("比率", "cell_bold")]]
    for row in drift_data:
        drift_rows.append([p(str(row[0]), "cell"), p(row[1], "cell"), p(row[2], "cell"), p(row[3], "cell"), p(row[4], "cell_bold"), p(row[5], "cell")])
    story.append(make_table(drift_rows, [16 * mm, 72 * mm, 28 * mm, 28 * mm, 42 * mm, 59 * mm], standard_grid_style()))
    story.append(Spacer(1, 5 * mm))

    story.append(PageBreak())
    story.append(p("次の打ち手", "title"))
    story.append(p("確定値取得を一回きりで終わらせず、締切直前EVの精度を次回以降も上げるための実装順です。", "subtitle"))
    story.append(Spacer(1, 5 * mm))
    action_rows = [
        [p("P0", "cell_bold"), p("公式投票結果HTMLパーサー", "cell_bold"), p("ForwardVotetotoSPから投票率・売上・販売終了時点を構造化して保存する。", "cell")],
        [p("P0", "cell_bold"), p("スナップショット履歴", "cell_bold"), p("初期 / 締切前 / 確定を上書きせず保存し、EVランキングの出入りを比較する。", "cell")],
        [p("P1", "cell_bold"), p("販売中の定点保存", "cell_bold"), p("24h / 6h / 3h / 1h / 30m / 10m / 確定で手動またはWorker保存。", "cell")],
        [p("P2", "cell_bold"), p("D1共有化", "cell_bold"), p("localで固めてから、schema追加とWorker APIを別PRで共有保存へ拡張。", "cell")],
    ]
    action_table = make_table(
        action_rows,
        [16 * mm, 64 * mm, 165 * mm],
        [
            ("BACKGROUND", (0, 0), (0, -1), AMBER_LIGHT),
            ("GRID", (0, 0), (-1, -1), 0.35, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ],
    )
    story.append(action_table)
    story.append(Spacer(1, 4 * mm))
    story.append(p(f"公式確定値ソース: {SOURCE_URL}", "small"))


def draw_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(TEAL_DARK)
    canvas.rect(0, PAGE_H - 10 * mm, PAGE_W, 10 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont(FONT_BOLD, 8)
    canvas.drawString(16 * mm, PAGE_H - 6.5 * mm, "World Toto Lab production close report")
    canvas.setFillColor(MUTED)
    canvas.setFont(FONT, 7.5)
    canvas.drawRightString(PAGE_W - 14 * mm, 8 * mm, f"Page {doc.page} / Generated 2026-06-14 JST")
    canvas.restoreState()


def build_pdf():
    for directory in (OUT_DIR, PUBLIC_DIR, TMP_DIR):
        directory.mkdir(parents=True, exist_ok=True)

    pdf_path = OUT_DIR / PDF_NAME
    public_pdf_path = PUBLIC_DIR / PDF_NAME

    story = []
    add_page_one(story)
    story.append(PageBreak())
    add_page_two(story)

    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=landscape(A4),
        rightMargin=14 * mm,
        leftMargin=14 * mm,
        topMargin=18 * mm,
        bottomMargin=15 * mm,
        title="World Toto Lab W杯toto 締めレポート",
        author="World Toto Lab",
    )
    doc.build(story, onFirstPage=draw_page, onLaterPages=draw_page)
    shutil.copy2(pdf_path, public_pdf_path)
    print(pdf_path)
    print(public_pdf_path)


if __name__ == "__main__":
    build_pdf()
