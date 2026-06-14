from __future__ import annotations

from dataclasses import dataclass
from itertools import product
from pathlib import Path
import shutil

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
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
APP_URL = "https://quietbriony.github.io/world-toto-lab/world-cup-strategy/"

STAKE_YEN = 100
TOTAL_SALES_YEN = 289_166_800
RETURN_RATE = 0.5
FIRST_PRIZE_SHARE = 0.7
FIRST_PRIZE_POOL_YEN = TOTAL_SALES_YEN * RETURN_RATE * FIRST_PRIZE_SHARE
OUTCOMES = ("1", "0", "2")

# Initial snapshot from 2026-06-07. The app uses this as the light model line.
INITIAL_VOTES = [
    (0.0792, 0.1223, 0.7985),
    (0.6613, 0.1962, 0.1425),
    (0.9041, 0.0531, 0.0428),
    (0.3690, 0.3066, 0.3244),
    (0.8024, 0.1218, 0.0758),
    (0.5207, 0.2645, 0.2148),
    (0.2725, 0.2902, 0.4373),
    (0.9029, 0.0525, 0.0446),
    (0.0951, 0.1232, 0.7817),
    (0.5270, 0.2852, 0.1878),
    (0.0635, 0.0991, 0.8374),
    (0.2264, 0.2788, 0.4948),
    (0.5910, 0.2174, 0.1916),
]

# Final official vote snapshot from 2026-06-12 sales close.
FINAL_VOTES = [
    (0.0512, 0.1062, 0.8426),
    (0.5570, 0.2589, 0.1841),
    (0.9526, 0.0296, 0.0178),
    (0.3679, 0.3095, 0.3226),
    (0.7275, 0.1731, 0.0994),
    (0.5050, 0.3012, 0.1938),
    (0.2711, 0.3158, 0.4131),
    (0.9400, 0.0406, 0.0194),
    (0.0782, 0.1557, 0.7661),
    (0.5296, 0.2895, 0.1809),
    (0.0712, 0.1130, 0.8158),
    (0.1962, 0.2893, 0.5145),
    (0.5591, 0.2620, 0.1789),
]

FIXTURES = [
    "カタール - スイス",
    "ブラジル - モロッコ",
    "ドイツ - キュラソー",
    "オランダ - 日本",
    "ベルギー - エジプト",
    "カナダ - ボスニア",
    "コートジボワール - エクアドル",
    "スペイン - カーボベルデ",
    "サウジアラビア - ウルグアイ",
    "スウェーデン - チュニジア",
    "ハイチ - スコットランド",
    "オーストラリア - トルコ",
    "アメリカ - パラグアイ",
]


@dataclass(frozen=True)
class ComboRow:
    ev_multiple: float
    expected_return_yen: float
    hit_probability: float
    payout_if_hit_yen: float
    public_probability: float
    signature: str


@dataclass(frozen=True)
class PlanSummary:
    budget_yen: int
    cost_yen: int
    ev_multiple: float
    expected_profit_yen: float
    expected_return_yen: float
    hit_probability: float
    line_count: int
    max_payout_yen: float
    min_payout_yen: float


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
INK = colors.HexColor("#0f172a")


def yen(value: float | int) -> str:
    return f"{round(value):,}円"


def pct(value: float, digits: int = 3) -> str:
    return f"{value * 100:.{digits}f}%"


def multiple(value: float) -> str:
    return f"{value:.2f}倍"


def signed_yen(value: float) -> str:
    sign = "+" if value >= 0 else ""
    return f"{sign}{yen(value)}"


def combo_probability(votes: list[tuple[float, float, float]], picks: tuple[int, ...]) -> float:
    probability = 1.0
    for index, pick in enumerate(picks):
        probability *= votes[index][pick]
    return probability


def estimated_payout(public_probability: float) -> float:
    expected_other_winners = (TOTAL_SALES_YEN / STAKE_YEN - 1) * public_probability
    return FIRST_PRIZE_POOL_YEN / (1 + expected_other_winners)


def enumerate_positive_rows() -> list[ComboRow]:
    rows: list[ComboRow] = []

    for picks in product(range(3), repeat=13):
        hit_probability = combo_probability(INITIAL_VOTES, picks)
        public_probability = combo_probability(FINAL_VOTES, picks)
        payout = estimated_payout(public_probability)
        expected_return = hit_probability * payout
        ev_multiple = expected_return / STAKE_YEN

        if ev_multiple <= 1:
            continue

        rows.append(
            ComboRow(
                ev_multiple=ev_multiple,
                expected_return_yen=expected_return,
                hit_probability=hit_probability,
                payout_if_hit_yen=payout,
                public_probability=public_probability,
                signature="".join(OUTCOMES[pick] for pick in picks),
            )
        )

    return sorted(
        rows,
        key=lambda row: (
            row.ev_multiple,
            row.expected_return_yen,
            row.hit_probability,
            row.signature,
        ),
        reverse=True,
    )


def build_plan(rows: list[ComboRow], budget_yen: int) -> PlanSummary:
    line_count = min(len(rows), budget_yen // STAKE_YEN)
    selected = rows[:line_count]
    expected_return = sum(row.expected_return_yen for row in selected)
    cost = line_count * STAKE_YEN
    payouts = [row.payout_if_hit_yen for row in selected]

    return PlanSummary(
        budget_yen=budget_yen,
        cost_yen=cost,
        ev_multiple=expected_return / cost,
        expected_profit_yen=expected_return - cost,
        expected_return_yen=expected_return,
        hit_probability=sum(row.hit_probability for row in selected),
        line_count=line_count,
        max_payout_yen=max(payouts),
        min_payout_yen=min(payouts),
    )


POSITIVE_ROWS = enumerate_positive_rows()
PLAN_1 = build_plan(POSITIVE_ROWS, 100)
PLAN_10 = build_plan(POSITIVE_ROWS, 1000)
PLAN_100 = build_plan(POSITIVE_ROWS, 10000)


def build_styles():
    styles = getSampleStyleSheet()
    base = ParagraphStyle(
        "BaseJP",
        parent=styles["Normal"],
        fontName=FONT,
        fontSize=9.2,
        leading=13.4,
        textColor=colors.HexColor("#172033"),
        alignment=TA_LEFT,
    )
    return {
        "base": base,
        "title": ParagraphStyle(
            "TitleJP",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=22,
            leading=28,
            textColor=INK,
            spaceAfter=6,
        ),
        "subtitle": ParagraphStyle(
            "SubtitleJP",
            parent=base,
            fontSize=10.5,
            leading=16,
            textColor=colors.HexColor("#475569"),
        ),
        "section": ParagraphStyle(
            "SectionJP",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=14,
            leading=19,
            textColor=TEAL_DARK,
            spaceBefore=8,
            spaceAfter=6,
        ),
        "small": ParagraphStyle(
            "SmallJP",
            parent=base,
            fontSize=7.6,
            leading=10.2,
            textColor=MUTED,
        ),
        "cell": ParagraphStyle(
            "CellJP",
            parent=base,
            fontSize=7.7,
            leading=10.3,
        ),
        "cell_bold": ParagraphStyle(
            "CellBoldJP",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=7.7,
            leading=10.3,
        ),
        "metric_label": ParagraphStyle(
            "MetricLabelJP",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=7.3,
            leading=9.5,
            textColor=TEAL,
        ),
        "metric_value": ParagraphStyle(
            "MetricValueJP",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=14.5,
            leading=17.5,
            textColor=INK,
        ),
        "center_cell": ParagraphStyle(
            "CenterCellJP",
            parent=base,
            fontSize=7.7,
            leading=10.3,
            alignment=TA_CENTER,
        ),
    }


STYLES = build_styles()


def p(text: str, style_name: str = "base") -> Paragraph:
    return Paragraph(text, STYLES[style_name])


def make_table(data, col_widths, style_commands, repeat_rows: int = 0):
    table = Table(data, colWidths=col_widths, repeatRows=repeat_rows)
    table.setStyle(TableStyle(style_commands))
    return table


def standard_grid_style(header: bool = True, row_bands: bool = True):
    commands = [
        ("GRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
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


def metric_card(label: str, value: str, note: str):
    return [p(label, "metric_label"), p(value, "metric_value"), p(note, "small")]


def add_page_one(story):
    story.append(p("W杯toto 買い方・期待回収レポート", "title"))
    story.append(
        p(
            "第1634回 toto。1口いくらか、10口と1万円ならどう買うか、期待回収が購入額を超えるかを先にまとめます。",
            "subtitle",
        )
    )
    story.append(Spacer(1, 5 * mm))

    metric_table = make_table(
        [
            [
                metric_card("一口", yen(STAKE_YEN), "1通りを買う金額"),
                metric_card("10口", yen(PLAN_10.cost_yen), f"期待回収 {yen(PLAN_10.expected_return_yen)}"),
                metric_card("1万円", f"{PLAN_100.line_count}口", f"期待回収 {yen(PLAN_100.expected_return_yen)}"),
                metric_card("判定", "購入額以上", f"期待損益 {signed_yen(PLAN_100.expected_profit_yen)}"),
            ]
        ],
        [61 * mm, 61 * mm, 61 * mm, 61 * mm],
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

    story.append(p("結論", "section"))
    conclusion_rows = [
        [p("問い", "cell_bold"), p("答え", "cell_bold")],
        [p("一口いくら?", "cell"), p(f"{yen(STAKE_YEN)}です。10口なら{yen(PLAN_10.cost_yen)}、1万円なら100口です。", "cell")],
        [p("1万円で1万円以上戻る期待値はある?", "cell"), p(f"あります。今回の1万円プランは期待回収{yen(PLAN_100.expected_return_yen)}、期待損益{signed_yen(PLAN_100.expected_profit_yen)}です。", "cell_bold")],
        [p("買うならどう買う?", "cell"), p(f"上位{PLAN_100.line_count}通りを1口ずつ。最上位の出目は {POSITIVE_ROWS[0].signature} です。", "cell")],
        [p("当たったらいくら戻る?", "cell"), p(f"1万円プラン内では、13試合的中時の推定払戻は {yen(PLAN_100.min_payout_yen)} - {yen(PLAN_100.max_payout_yen)} です。出目ごとに変わります。", "cell")],
        [p("友人に見せて大丈夫?", "cell"), p("この資料とアプリは購入履歴ではなく試算です。誰が何を買ったか、決済情報、購入済み履歴は扱いません。", "cell")],
    ]
    story.append(make_table(conclusion_rows, [48 * mm, 197 * mm], standard_grid_style()))
    story.append(Spacer(1, 5 * mm))

    story.append(p("予算別サマリー", "section"))
    plan_rows = [
        [p("予算", "cell_bold"), p("口数", "cell_bold"), p("期待回収", "cell_bold"), p("期待損益", "cell_bold"), p("EV", "cell_bold"), p("13試合当たったら", "cell_bold")],
        [p("1口", "cell"), p(f"{PLAN_1.line_count}口", "cell"), p(yen(PLAN_1.expected_return_yen), "cell_bold"), p(signed_yen(PLAN_1.expected_profit_yen), "cell"), p(multiple(PLAN_1.ev_multiple), "cell"), p(yen(PLAN_1.max_payout_yen), "cell")],
        [p("10口", "cell"), p(f"{PLAN_10.line_count}口", "cell"), p(yen(PLAN_10.expected_return_yen), "cell_bold"), p(signed_yen(PLAN_10.expected_profit_yen), "cell"), p(multiple(PLAN_10.ev_multiple), "cell"), p(f"{yen(PLAN_10.min_payout_yen)} - {yen(PLAN_10.max_payout_yen)}", "cell")],
        [p("1万円", "cell"), p(f"{PLAN_100.line_count}口", "cell"), p(yen(PLAN_100.expected_return_yen), "cell_bold"), p(signed_yen(PLAN_100.expected_profit_yen), "cell_bold"), p(multiple(PLAN_100.ev_multiple), "cell_bold"), p(f"{yen(PLAN_100.min_payout_yen)} - {yen(PLAN_100.max_payout_yen)}", "cell")],
    ]
    story.append(make_table(plan_rows, [28 * mm, 25 * mm, 42 * mm, 42 * mm, 28 * mm, 80 * mm], standard_grid_style()))
    story.append(Spacer(1, 4 * mm))
    story.append(
        p(
            "注意: これは1等、つまり13試合すべて的中した場合だけの期待値です。2等・3等は含めていません。期待値がプラスでも単発では外れる可能性が高く、利益保証ではありません。",
            "small",
        )
    )


def add_ticket_table(story):
    story.append(p("買うならこの順 - 上位20通り", "title"))
    story.append(
        p(
            "1万円プランでは上位100通りを1口ずつ買う前提です。PDFでは読みやすさ優先で上位20通りを載せ、アプリには100通りを表示します。",
            "subtitle",
        )
    )
    story.append(Spacer(1, 4 * mm))

    rows = [[p("順", "cell_bold"), p("出目", "cell_bold"), p("期待回収/口", "cell_bold"), p("EV", "cell_bold"), p("13試合当たったら", "cell_bold"), p("的中率", "cell_bold"), p("人気重複", "cell_bold")]]
    for rank, row in enumerate(POSITIVE_ROWS[:20], start=1):
        rows.append(
            [
                p(str(rank), "center_cell"),
                p(row.signature, "cell_bold"),
                p(yen(row.expected_return_yen), "cell_bold"),
                p(multiple(row.ev_multiple), "cell"),
                p(yen(row.payout_if_hit_yen), "cell"),
                p(pct(row.hit_probability, 5), "cell"),
                p(pct(row.public_probability, 5), "cell"),
            ]
        )

    story.append(make_table(rows, [14 * mm, 42 * mm, 34 * mm, 26 * mm, 48 * mm, 40 * mm, 40 * mm], standard_grid_style(), repeat_rows=1))
    story.append(Spacer(1, 5 * mm))

    story.append(PageBreak())
    story.append(p("王道で勝った場合", "title"))
    story.append(p("公式人気どおりに13試合すべて当てた場合の見え方です。", "subtitle"))
    story.append(Spacer(1, 4 * mm))
    orthodox_signature = "".join(OUTCOMES[max(range(3), key=lambda index: votes[index])] for votes in FINAL_VOTES)
    orthodox_hit = combo_probability(INITIAL_VOTES, tuple(OUTCOMES.index(char) for char in orthodox_signature))
    orthodox_public = combo_probability(FINAL_VOTES, tuple(OUTCOMES.index(char) for char in orthodox_signature))
    orthodox_payout = estimated_payout(orthodox_public)
    orthodox_expected = orthodox_hit * orthodox_payout
    orthodox_rows = [
        [p("出目", "cell_bold"), p("13試合当たったら", "cell_bold"), p("1口期待回収", "cell_bold"), p("EV", "cell_bold")],
        [p(orthodox_signature, "cell_bold"), p(yen(orthodox_payout), "cell"), p(yen(orthodox_expected), "cell"), p(multiple(orthodox_expected / STAKE_YEN), "cell")],
    ]
    story.append(make_table(orthodox_rows, [64 * mm, 58 * mm, 58 * mm, 34 * mm], standard_grid_style()))
    story.append(
        p(
            "公式人気どおりの王道出目は、当たった場合の払戻が小さくなりやすいため、今回の1等期待回収は100円未満です。",
            "small",
        )
    )


def add_method_page(story):
    story.append(p("計算の読み方", "title"))
    story.append(p("このページは、買う前に見る判断材料としての試算です。購入代行、精算、履歴表示ではありません。", "subtitle"))
    story.append(Spacer(1, 4 * mm))

    method_rows = [
        [p("項目", "cell_bold"), p("今回の扱い", "cell_bold")],
        [p("モデル確率", "cell"), p("2026-06-07 08:48-08:56時点の公式投票率を軽量モデル線として使用。", "cell")],
        [p("人気確率", "cell"), p("2026-06-12販売終了時点の確定公式投票率を使用。", "cell")],
        [p("売上", "cell"), p(f"確定売上 {yen(TOTAL_SALES_YEN)} を使用。1口100円なので推定総口数は {TOTAL_SALES_YEN // STAKE_YEN:,}口。", "cell")],
        [p("払戻", "cell"), p("売上 x 50% x 1等配分70%を1等原資とし、同じ出目の推定他当選口数で割ります。", "cell")],
        [p("期待回収", "cell"), p("モデル的中率 x 13試合的中時の推定払戻。100円を超える出目だけを購入候補にします。", "cell")],
        [p("含めていないもの", "cell"), p("2等・3等、税、実際の購入締切差、販売サイト側の最終確定配当、購入操作。", "cell")],
    ]
    story.append(make_table(method_rows, [42 * mm, 203 * mm], standard_grid_style()))
    story.append(Spacer(1, 5 * mm))

    story.append(p("締切前スナップショットとの差分", "section"))
    drift_rows = [[p("No", "cell_bold"), p("試合", "cell_bold"), p("最大ズレ", "cell_bold"), p("初期 -> 確定", "cell_bold")]]
    drift_candidates = []
    for index, (fixture, initial, final) in enumerate(zip(FIXTURES, INITIAL_VOTES, FINAL_VOTES), start=1):
        deltas = [(OUTCOMES[outcome_index], (final[outcome_index] - initial[outcome_index]) * 100, initial[outcome_index], final[outcome_index]) for outcome_index in range(3)]
        outcome, delta, before, after = max(deltas, key=lambda entry: abs(entry[1]))
        drift_candidates.append((abs(delta), index, fixture, outcome, delta, before, after))
    for _abs_delta, index, fixture, outcome, delta, before, after in sorted(drift_candidates, reverse=True)[:8]:
        drift_rows.append(
            [
                p(str(index), "center_cell"),
                p(fixture, "cell"),
                p(f"{outcome} {delta:+.2f}pt", "cell_bold"),
                p(f"{before * 100:.2f}% -> {after * 100:.2f}%", "cell"),
            ]
        )
    story.append(make_table(drift_rows, [14 * mm, 110 * mm, 44 * mm, 76 * mm], standard_grid_style()))
    story.append(Spacer(1, 4 * mm))
    story.append(p(f"アプリ: {APP_URL}", "small"))
    story.append(p(f"公式確定値ソース: {SOURCE_URL}", "small"))


def draw_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(TEAL_DARK)
    canvas.rect(0, PAGE_H - 10 * mm, PAGE_W, 10 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont(FONT_BOLD, 8)
    canvas.drawString(16 * mm, PAGE_H - 6.5 * mm, "World Toto Lab buying report")
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
    add_ticket_table(story)
    story.append(PageBreak())
    add_method_page(story)

    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=landscape(A4),
        rightMargin=14 * mm,
        leftMargin=14 * mm,
        topMargin=18 * mm,
        bottomMargin=15 * mm,
        title="World Toto Lab W杯toto 買い方・期待回収レポート",
        author="World Toto Lab",
    )
    doc.build(story, onFirstPage=draw_page, onLaterPages=draw_page)
    shutil.copy2(pdf_path, public_pdf_path)
    print(pdf_path)
    print(public_pdf_path)
    print(f"positive_rows={len(POSITIVE_ROWS)}")
    print(f"plan_10000_expected_return={PLAN_100.expected_return_yen:.2f}")


if __name__ == "__main__":
    build_pdf()
