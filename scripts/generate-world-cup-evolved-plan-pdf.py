from __future__ import annotations

import csv
import shutil
from dataclasses import dataclass
from math import comb
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
PDF_NAME = "world-cup-toto-1634-1636-evolved-plan-20260620-v5.pdf"
CSV_NAME = "world-cup-toto-1636-hot10-20000-plan-20260620-v5.csv"
PDF_ALIASES = (
    PDF_NAME,
    "world-cup-toto-latest.pdf",
    "world-cup-toto-1634-1636-evolved-plan.pdf",
)
CSV_ALIASES = (
    CSV_NAME,
    "world-cup-toto-latest-purchase-sheet.csv",
    "world-cup-toto-1636-hot10-20000-plan.csv",
)
OUT_PDF_DIR = ROOT / "output" / "pdf"
OUT_CSV_DIR = ROOT / "output" / "purchase-sheets"
PUBLIC_DIR = ROOT / "public" / "reports"

STAKE_YEN = 100
OUTCOMES = ("1", "0", "2")
TOTO13_OUTCOME_COUNT = 3**13
SNAPSHOT_1636_LABEL = "2026-06-20 17:02 JST"
TOTAL_SALES_1636_YEN = 222_065_900
RETURN_RATE = 0.5
TIER_DEFS = (
    ("1等", 0, 0.70, True),
    ("2等", 1, 0.15, False),
    ("3等", 2, 0.15, False),
)

SOURCE_TOTO_RULE_URL = "https://www.toto-dream.com/toto/about/"
SOURCE_SPANN_SKIERA_URL = "https://onlinelibrary.wiley.com/doi/10.1002/for.1091"
SOURCE_DIXON_COLES_URL = "https://rss.onlinelibrary.wiley.com/doi/abs/10.1111/1467-9876.00065"
SOURCE_FAVORITE_LONGSHOT_URL = "https://www.nber.org/papers/w15923"
SOURCE_1634_RESULT_URL = (
    "https://sp.toto-dream.com/dcs/subos/screen/si04/ssin007/"
    "PGSSIN00701FwdLotDetailRslttoto.form?holdCntId=1634&commodityId=01&meetingFiscalYear=2026"
)
SOURCE_1634_VOTE_URL = (
    "https://sp.toto-dream.com/dcs/subos/screen/si01/ssin025/"
    "PGSSIN02501ForwardVotetotoSP.form?holdCntId=1634&commodityId=01&gameAssortment=A&fromId=SSIN026"
)
SOURCE_1635_RESULT_URL = (
    "https://sp.toto-dream.com/dcs/subos/screen/si04/ssin007/"
    "PGSSIN00701FwdLotDetailRslttoto.form?holdCntId=1635&commodityId=01&meetingFiscalYear=2026"
)
SOURCE_1636_BUY_URL = "https://sp.toto-dream.com/dcs/subos/screen/ss01/sssl021/PGSSSL02101InittotoSP.form"
SOURCE_1636_VOTE_URL = (
    "https://sp.toto-dream.com/dcs/subos/screen/si01/ssin025/"
    "PGSSIN02501ForwardVotetotoSP.form?commodityId=01&fromId=SSIN026&gameAssortment=A&holdCntId=1636"
)


@dataclass(frozen=True)
class ResultMatch:
    no: int
    home: str
    away: str
    score: str
    actual: str
    votes: tuple[float, float, float]


@dataclass(frozen=True)
class PlanMatch:
    no: int
    home: str
    away: str
    kickoff: str
    votes: tuple[float, float, float]
    allowed: tuple[str, ...]
    rule: str


MATCHES_1634 = [
    ResultMatch(1, "カタール", "スイス", "1-1", "0", (0.0512, 0.1062, 0.8426)),
    ResultMatch(2, "ブラジル", "モロッコ", "1-1", "0", (0.5570, 0.2589, 0.1841)),
    ResultMatch(3, "ドイツ", "キュラソー", "7-1", "1", (0.9526, 0.0296, 0.0178)),
    ResultMatch(4, "オランダ", "日本", "2-2", "0", (0.3679, 0.3095, 0.3226)),
    ResultMatch(5, "ベルギー", "エジプト", "1-1", "0", (0.7275, 0.1731, 0.0994)),
    ResultMatch(6, "カナダ", "ボスニア", "1-1", "0", (0.5050, 0.3012, 0.1938)),
    ResultMatch(7, "コートジボワール", "エクアドル", "1-0", "1", (0.2711, 0.3158, 0.4131)),
    ResultMatch(8, "スペイン", "カーボベルデ", "0-0", "0", (0.9400, 0.0406, 0.0194)),
    ResultMatch(9, "サウジアラビア", "ウルグアイ", "1-1", "0", (0.0782, 0.1557, 0.7661)),
    ResultMatch(10, "スウェーデン", "チュニジア", "5-1", "1", (0.5296, 0.2895, 0.1809)),
    ResultMatch(11, "ハイチ", "スコットランド", "0-1", "2", (0.0712, 0.1130, 0.8158)),
    ResultMatch(12, "オーストラリア", "トルコ", "2-0", "1", (0.1962, 0.2893, 0.5145)),
    ResultMatch(13, "アメリカ", "パラグアイ", "4-1", "1", (0.5591, 0.2620, 0.1789)),
]

PREVIOUS_1634_ROWS = [
    (1, "0010102122211", 5, 1932.66),
    (2, "0010102121211", 4, 1849.37),
    (3, "0010102120211", 5, 1836.32),
    (4, "0010101122211", 4, 1821.56),
    (5, "0010101121211", 3, 1764.55),
    (6, "0010101120211", 4, 1742.71),
    (7, "0010100122211", 5, 1676.63),
    (8, "0010100121211", 4, 1615.67),
    (9, "0010100120211", 5, 1599.45),
]

MATCHES_1635 = [
    ResultMatch(1, "フランス", "セネガル", "3-1", "1", (0.6976, 0.2124, 0.0900)),
    ResultMatch(2, "アルゼンチン", "アルジェリア", "3-0", "1", (0.7537, 0.1739, 0.0724)),
    ResultMatch(3, "イングランド", "クロアチア", "4-2", "1", (0.4683, 0.3323, 0.1994)),
    ResultMatch(4, "メキシコ", "韓国", "1-0", "1", (0.5117, 0.3079, 0.1804)),
    ResultMatch(5, "スコットランド", "モロッコ", "0-1", "2", (0.1128, 0.2082, 0.6790)),
    ResultMatch(6, "オーストリア", "ヨルダン", "3-1", "1", (0.7437, 0.1862, 0.0701)),
    ResultMatch(7, "ウズベキスタン", "コロンビア", "1-3", "2", (0.0653, 0.1818, 0.7529)),
    ResultMatch(8, "チェコ", "南アフリカ", "1-1", "0", (0.5331, 0.2887, 0.1782)),
    ResultMatch(9, "カナダ", "カタール", "6-0", "1", (0.5909, 0.2792, 0.1299)),
    ResultMatch(10, "ブラジル", "ハイチ", "3-0", "1", (0.9322, 0.0473, 0.0205)),
    ResultMatch(11, "ポルトガル", "コンゴ民主共和国", "1-1", "0", (0.8590, 0.1006, 0.0404)),
    ResultMatch(12, "ガーナ", "パナマ", "1-0", "1", (0.4409, 0.2991, 0.2600)),
    ResultMatch(13, "スイス", "ボスニア", "4-1", "1", (0.5941, 0.2729, 0.1330)),
]

MATCHES_1636 = [
    PlanMatch(1, "ドイツ", "コートジボワール", "06/21 05:00", (0.7125, 0.2123, 0.0752), ("1",), "70%超は勝ち固定"),
    PlanMatch(2, "チュニジア", "日本", "06/21 13:00", (0.0798, 0.2292, 0.6910), ("2", "0"), "日本勝ち軸 + ドロー"),
    PlanMatch(3, "アルゼンチン", "オーストリア", "06/23 02:00", (0.7591, 0.1840, 0.0569), ("1",), "70%超は勝ち固定"),
    PlanMatch(4, "パナマ", "クロアチア", "06/24 08:00", (0.0428, 0.1325, 0.8247), ("2",), "80%超アウェイ固定"),
    PlanMatch(5, "コロンビア", "コンゴ民主共和国", "06/24 11:00", (0.7060, 0.2264, 0.0676), ("1",), "70%超は勝ち固定"),
    PlanMatch(6, "オランダ", "スウェーデン", "06/21 02:00", (0.4985, 0.3152, 0.1863), ("1", "0", "2"), "割れる試合は全分散"),
    PlanMatch(7, "ウルグアイ", "カーボベルデ", "06/22 07:00", (0.7138, 0.2236, 0.0626), ("1",), "70%超は勝ち固定"),
    PlanMatch(8, "ノルウェー", "セネガル", "06/23 09:00", (0.4495, 0.2928, 0.2577), ("1", "0", "2"), "30%台なので全分散"),
    PlanMatch(9, "ポルトガル", "ウズベキスタン", "06/24 02:00", (0.8075, 0.1492, 0.0433), ("1",), "80%超は勝ち固定"),
    PlanMatch(10, "ヨルダン", "アルジェリア", "06/23 12:00", (0.1496, 0.3319, 0.5185), ("2", "0"), "アウェイ勝ち軸 + ドロー"),
    PlanMatch(11, "スペイン", "サウジアラビア", "06/22 01:00", (0.8381, 0.1246, 0.0373), ("1",), "80%超は勝ち固定"),
    PlanMatch(12, "イングランド", "ガーナ", "06/24 05:00", (0.8433, 0.1169, 0.0398), ("1",), "80%超は勝ち固定"),
    PlanMatch(13, "エクアドル", "キュラソー", "06/21 09:00", (0.8500, 0.1122, 0.0378), ("1",), "80%超は勝ち固定"),
]


def register_fonts() -> tuple[str, str]:
    regular_path = Path("C:/Windows/Fonts/YuGothR.ttc")
    bold_path = Path("C:/Windows/Fonts/YuGothB.ttc")
    if not regular_path.exists() or not bold_path.exists():
        raise FileNotFoundError("Yu Gothic fonts were not found under C:/Windows/Fonts.")
    pdfmetrics.registerFont(TTFont("YuGothic", str(regular_path), subfontIndex=0))
    pdfmetrics.registerFont(TTFont("YuGothic-Bold", str(bold_path), subfontIndex=0))
    return "YuGothic", "YuGothic-Bold"


FONT, FONT_BOLD = register_fonts()

INK = colors.HexColor("#0f172a")
MUTED = colors.HexColor("#64748b")
TEAL = colors.HexColor("#0f766e")
TEAL_LIGHT = colors.HexColor("#ccfbf1")
AMBER_LIGHT = colors.HexColor("#fef3c7")
SLATE_LIGHT = colors.HexColor("#f8fafc")
BORDER = colors.HexColor("#cbd5e1")


def yen(value: float | int | None) -> str:
    if value is None:
        return "-"
    return f"{round(value):,}円"


def signed_yen(value: float | int | None) -> str:
    if value is None:
        return "-"
    sign = "+" if value >= 0 else ""
    return f"{sign}{yen(value)}"


def pct(value: float | None, digits: int = 2) -> str:
    if value is None:
        return "-"
    return f"{value * 100:.{digits}f}%"


def multiple(value: float | None) -> str:
    if value is None:
        return "-"
    return f"{value:.2f}倍"


def favorite(votes: tuple[float, float, float]) -> str:
    return max(zip(OUTCOMES, votes, strict=True), key=lambda item: item[1])[0]


def signature(outcomes: list[str] | tuple[str, ...]) -> str:
    return "".join(outcomes)


def display_outcomes(outcomes: tuple[str, ...]) -> str:
    return "/".join(outcomes)


def actual_signature(matches: list[ResultMatch]) -> str:
    return signature([match.actual for match in matches])


def favorite_signature(matches: list[ResultMatch | PlanMatch]) -> str:
    return signature([favorite(match.votes) for match in matches])


def miss_count(left: str, right: str) -> int:
    return sum(1 for left_char, right_char in zip(left, right, strict=True) if left_char != right_char)


def random_probability(ticket_count: int, max_misses: int) -> float:
    ways = sum(comb(13, misses) * (2**misses) for misses in range(max_misses + 1))
    per_ticket = ways / TOTO13_OUTCOME_COUNT
    return 1 - (1 - per_ticket) ** ticket_count


def outcome_probability(outcome: str, probs: tuple[float, float, float]) -> float:
    return probs[OUTCOMES.index(outcome)]


def normalize(values: list[float]) -> tuple[float, float, float]:
    clipped = [max(value, 0.01) for value in values]
    total = sum(clipped)
    return tuple(value / total for value in clipped)  # type: ignore[return-value]


def proxy_probs(match: PlanMatch) -> tuple[float, float, float]:
    weights = []
    for outcome, vote in zip(OUTCOMES, match.votes, strict=True):
        if outcome in match.allowed:
            boost = 1.08 if len(match.allowed) == 1 else 1.04
        else:
            boost = 0.84
        weights.append(vote * boost)

    if len(match.allowed) == 3:
        weights = [weight * 0.96 + (1 / 3) * 0.04 for weight in weights]

    return normalize(weights)


def row_probability(row: tuple[str, ...], probs_by_match: list[tuple[float, float, float]]) -> float:
    probability = 1.0
    for index, outcome in enumerate(row):
        probability *= outcome_probability(outcome, probs_by_match[index])
    return probability


def tier_probability(selected_probs: list[float], miss_count_value: int) -> float:
    if miss_count_value == 0:
        product = 1.0
        for probability in selected_probs:
            product *= probability
        return product

    dp = [0.0 for _ in range(miss_count_value + 1)]
    dp[0] = 1.0
    for hit_probability in selected_probs:
        miss_probability = 1 - hit_probability
        for misses in range(miss_count_value, -1, -1):
            dp[misses] = dp[misses] * hit_probability + (dp[misses - 1] * miss_probability if misses > 0 else 0)
    return dp[miss_count_value]


def ticket_ev(row: tuple[str, ...], model_probs: list[tuple[float, float, float]], public_probs: list[tuple[float, float, float]]) -> dict[str, float]:
    selected_model = [outcome_probability(outcome, model_probs[index]) for index, outcome in enumerate(row)]
    selected_public = [outcome_probability(outcome, public_probs[index]) for index, outcome in enumerate(row)]
    total_return = 0.0
    first_payout = 0.0
    cash_probability = 0.0

    for label, misses, pool_share, carryover_eligible in TIER_DEFS:
        p_model = tier_probability(selected_model, misses)
        p_public = tier_probability(selected_public, misses)
        expected_other_winners = max(0.0, (TOTAL_SALES_1636_YEN / STAKE_YEN - 1) * p_public)
        carryover = 0.0 if not carryover_eligible else 0.0
        prize_pool = TOTAL_SALES_1636_YEN * RETURN_RATE * pool_share + carryover
        payout = prize_pool / (1 + expected_other_winners)
        expected_return = p_model * payout
        total_return += expected_return
        cash_probability += p_model
        if label == "1等":
            first_payout = payout

    return {
        "cash_probability": cash_probability,
        "ev_multiple": total_return / STAKE_YEN,
        "expected_return_yen": total_return,
        "first_payout_yen": first_payout,
    }


def build_core_rows() -> list[tuple[str, ...]]:
    rows: list[tuple[str, ...]] = [()]
    for match in MATCHES_1636:
        rows = [row + (outcome,) for row in rows for outcome in match.allowed]
    return rows


def build_purchase_rows(unit_budget: int = 200) -> list[dict[str, object]]:
    core_rows = build_core_rows()
    core_signatures = {signature(row) for row in core_rows}
    rows_by_signature = {signature(row): row for row in core_rows}
    public_probs = [match.votes for match in MATCHES_1636]
    proxy_by_match = [proxy_probs(match) for match in MATCHES_1636]

    for row in core_rows:
        for match_index, match in enumerate(MATCHES_1636):
            allowed = set(match.allowed)
            for outcome in OUTCOMES:
                if outcome in allowed:
                    continue
                next_row = list(row)
                next_row[match_index] = outcome
                rows_by_signature[signature(tuple(next_row))] = tuple(next_row)

    sorted_rows = sorted(
        rows_by_signature.values(),
        key=lambda row: (
            0 if signature(row) in core_signatures else 1,
            -ticket_ev(row, proxy_by_match, public_probs)["ev_multiple"],
            -row_probability(row, proxy_by_match),
            signature(row),
        ),
    )

    purchase_rows: list[dict[str, object]] = []
    cumulative_units = 0
    for index, row in enumerate(sorted_rows, start=1):
        row_signature = signature(row)
        units = 2 if index <= 10 else 1
        if cumulative_units + units > unit_budget:
            break
        cumulative_units += units
        if index <= 10:
            bucket = "hot"
            note = "激アツ枠。最大2口まで。的中範囲は広がらないので厚張りしすぎない。"
        elif row_signature in core_signatures:
            bucket = "core"
            note = "推奨コア。1口ずつバラで置く。"
        else:
            bucket = "hedge"
            note = "追加ヘッジ。20,000円上限の議論用で、全買い推奨ではない。"
        ev = ticket_ev(row, proxy_by_match, public_probs)
        purchase_rows.append(
            {
                "rank": index,
                "bucket": bucket,
                "units": units,
                "amount_cumulative_yen": cumulative_units * STAKE_YEN,
                "signature": row_signature,
                "picks": row,
                "note": note,
                "ev_multiple": ev["ev_multiple"],
                "expected_return_yen": ev["expected_return_yen"],
            }
        )

    return purchase_rows


PURCHASE_ROWS_1636 = build_purchase_rows()
ACTUAL_1634 = actual_signature(MATCHES_1634)
FAVORITE_1634 = favorite_signature(MATCHES_1634)
ACTUAL_1635 = actual_signature(MATCHES_1635)
FAVORITE_1635 = favorite_signature(MATCHES_1635)
FAVORITE_1636 = favorite_signature(MATCHES_1636)


def recommended_entries() -> list[dict[str, object]]:
    rows = []
    units = 0
    for row in PURCHASE_ROWS_1636:
        next_units = units + int(row["units"])
        if next_units > 46:
            break
        rows.append(row)
        units = next_units
    return rows


def plan_ev_summary(rows: list[dict[str, object]]) -> dict[str, float]:
    units = sum(int(row["units"]) for row in rows)
    cost = units * STAKE_YEN
    expected_return = sum(float(row["expected_return_yen"]) * int(row["units"]) for row in rows)
    return {
        "cost_yen": cost,
        "ev_multiple": expected_return / cost if cost > 0 else 0.0,
        "expected_profit_yen": expected_return - cost,
        "expected_return_yen": expected_return,
        "units": units,
    }


def public_favorite_ev() -> dict[str, float]:
    public_probs = [match.votes for match in MATCHES_1636]
    row = tuple(favorite(match.votes) for match in MATCHES_1636)
    return ticket_ev(row, public_probs, public_probs)


def top_proxy_ev() -> dict[str, float | str]:
    top = max(PURCHASE_ROWS_1636, key=lambda row: float(row["ev_multiple"]))
    return {
        "signature": str(top["signature"]),
        "ev_multiple": float(top["ev_multiple"]),
        "expected_return_yen": float(top["expected_return_yen"]),
    }


def build_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", parent=base["Title"], fontName=FONT_BOLD, fontSize=20, leading=26, textColor=INK, spaceAfter=5 * mm, alignment=TA_LEFT),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName=FONT_BOLD, fontSize=13.2, leading=17, textColor=INK, spaceBefore=2 * mm, spaceAfter=2.5 * mm),
        "body": ParagraphStyle("body", parent=base["BodyText"], fontName=FONT, fontSize=9.1, leading=13.6, textColor=INK, spaceAfter=2.4 * mm),
        "small": ParagraphStyle("small", parent=base["BodyText"], fontName=FONT, fontSize=7.2, leading=9.4, textColor=MUTED),
        "cell": ParagraphStyle("cell", parent=base["BodyText"], fontName=FONT, fontSize=7.4, leading=9.8, textColor=INK),
        "cell_bold": ParagraphStyle("cell_bold", parent=base["BodyText"], fontName=FONT_BOLD, fontSize=7.5, leading=9.8, textColor=INK),
    }


STYLES = build_styles()


def copy_report_aliases(source: Path, output_dir: Path, public_dir: Path, names: tuple[str, ...]) -> None:
    for name in names:
        output_path = output_dir / name
        public_path = public_dir / name
        if output_path.resolve() != source.resolve():
            shutil.copy2(source, output_path)
        shutil.copy2(source, public_path)


def p(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text.replace("\n", "<br/>"), STYLES[style])


def table(data: list[list[object]], col_widths: list[float], header_rows: int = 1) -> Table:
    wrapped = [
        [
            cell if hasattr(cell, "wrap") else p(str(cell), "cell" if row_index >= header_rows else "cell_bold")
            for cell in row
        ]
        for row_index, row in enumerate(data)
    ]
    result = Table(wrapped, colWidths=col_widths, repeatRows=header_rows)
    result.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), FONT),
                ("FONTNAME", (0, 0), (-1, header_rows - 1), FONT_BOLD),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 0), (-1, 0), TEAL),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SLATE_LIGHT]),
                ("GRID", (0, 0), (-1, -1), 0.35, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return result


def summary_table() -> Table:
    plan = plan_ev_summary(recommended_entries())
    rows = [
        ["質問", "今回の答え"],
        ["1口いくら?", "toto13は1口100円。基本は同じ組み合わせを厚くせず、1口ずつバラで置く。"],
        ["今回はいくら買う?", f"推奨コアは46口 = {yen(plan['cost_yen'])}。20,000円CSVは議論用の上限で、全買い推奨ではない。"],
        ["当たったら?", "1等は選んだ出目の同時当せん口数で変わる。2等/3等も期待値に足す。"],
        ["EVは上がった?", f"market proxy上の46口はEV {multiple(plan['ev_multiple'])}、期待損益 {signed_yen(plan['expected_profit_yen'])}。ただし実オッズ未接続なのでproxy扱い。"],
        ["買い方", "Hot10だけ2口まで。それ以外は1口。2口化は戻りを厚くするだけで、的中範囲は広がらない。"],
    ]
    result = table(rows, [38 * mm, 140 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), TEAL_LIGHT)]))
    return result


def ev_glossary_table() -> Table:
    rows = [
        ["用語", "ざっくり意味", "式/読み方"],
        ["EV", "平均でいくら戻る見込みか。利益保証ではない。", "EV倍率 = 期待回収額 / 購入額"],
        ["p_model", "モデルが見た実際の当たりやすさ。", "予測市場、オッズ、Elo、得点モデル、Hazi補正で作る"],
        ["p_public", "公式投票率から見た混み具合。", "同じ出目に人が多いほど払戻が薄くなる"],
        ["予測市場EV", "当たりそうなのに人が少ない出目を拾う見方。", "p_model x 推定払戻"],
        ["期待損益", "期待回収から購入額を引いたもの。", "プラスなら理論上は購入額超え"],
    ]
    return table(rows, [25 * mm, 78 * mm, 65 * mm])


def market_ev_table() -> Table:
    random_ev = RETURN_RATE
    public_ev = public_favorite_ev()
    top_ev = top_proxy_ev()
    plan = plan_ev_summary(recommended_entries())
    rows = [
        ["戦略", "購入額", "期待回収", "EV", "ランダム比", "読み"],
        ["総当たり/ランダム基準", yen(STAKE_YEN), yen(STAKE_YEN * random_ev), multiple(random_ev), "+0.00倍", "売上50%還元の基準線。"],
        ["公式人気ど真ん中", yen(STAKE_YEN), yen(public_ev["expected_return_yen"]), multiple(public_ev["ev_multiple"]), f"{public_ev['ev_multiple'] - random_ev:+.2f}倍", f"出目 {FAVORITE_1636}。人が多く払戻は薄くなりやすい。"],
        ["market proxy上位1口", yen(STAKE_YEN), yen(float(top_ev["expected_return_yen"])), multiple(float(top_ev["ev_multiple"])), f"{float(top_ev['ev_multiple']) - random_ev:+.2f}倍", f"出目 {top_ev['signature']}。実オッズ未接続なのでproxy。"],
        ["proxy EV 46口", yen(plan["cost_yen"]), yen(plan["expected_return_yen"]), multiple(plan["ev_multiple"]), f"{plan['ev_multiple'] - random_ev:+.2f}倍", "1-3等EV込み。買い目議論用の推奨コア。"],
    ]
    result = table(rows, [32 * mm, 22 * mm, 26 * mm, 18 * mm, 22 * mm, 51 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 3), (-1, 4), AMBER_LIGHT)]))
    return result


def phase_logic_table() -> Table:
    rows = [
        ["対象", "読み", "買い目への使い方"],
        ["1634寄り: 初戦", "情報不足で荒れやすい。強人気でもドロー事故を拾う余地がある。", "強人気固定に寄せすぎない。"],
        ["1636寄り: 第2戦", "初戦情報が入り、条件戦にはまだ寄り切らない。順当が増えやすい。", "強人気固定を基本に、割れる試合だけ分散。"],
        ["1637寄り: 第3戦", "勝点、温存、引き分けOK、得失点差で歪む。", "勝点条件を別ロジックで足す。"],
    ]
    result = table(rows, [28 * mm, 72 * mm, 68 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), TEAL_LIGHT)]))
    return result


def previous_logic_table() -> Table:
    rows = [["順", "前回PDF候補", "実結果との差", "前回EV倍率"]]
    for rank, sig, misses, ev_multiple in PREVIOUS_1634_ROWS:
        rows.append([rank, sig, f"{misses}試合ズレ", f"{ev_multiple:.2f}倍"])
    return table(rows, [12 * mm, 58 * mm, 34 * mm, 30 * mm])


def mismatch_table(matches: list[ResultMatch], title: str) -> Table:
    rows = [["No", title, "スコア", "実出目", "人気出目"]]
    for match in matches:
        popular = favorite(match.votes)
        if match.actual != popular:
            rows.append([match.no, f"{match.home} vs {match.away}", match.score, match.actual, popular])
    return table(rows, [10 * mm, 78 * mm, 20 * mm, 18 * mm, 18 * mm])


def random_table() -> Table:
    rows = [["購入", "費用", "1等", "2等以上", "3等以上"]]
    for line_count in [10, 46, 100, 200]:
        rows.append([f"{line_count}口", yen(line_count * STAKE_YEN), pct(random_probability(line_count, 0), 5), pct(random_probability(line_count, 1), 3), pct(random_probability(line_count, 2), 2)])
    return table(rows, [24 * mm, 30 * mm, 38 * mm, 38 * mm, 38 * mm])


def policy_table() -> Table:
    rows = [["No", "試合", "公式投票 1/0/2", "残す出目", "ルール"]]
    for match in MATCHES_1636:
        rows.append([match.no, f"{match.home} vs {match.away}\n{match.kickoff}", " / ".join(pct(vote, 1) for vote in match.votes), display_outcomes(match.allowed), match.rule])
    return table(rows, [9 * mm, 54 * mm, 37 * mm, 16 * mm, 44 * mm])


def hot_table() -> Table:
    rows = [["順", "買い目", "口数", "累計", "EV/口", "区分"]]
    for row in PURCHASE_ROWS_1636[:20]:
        rows.append([row["rank"], row["signature"], row["units"], yen(int(row["amount_cumulative_yen"])), multiple(float(row["ev_multiple"])), row["bucket"]])
    return table(rows, [10 * mm, 50 * mm, 14 * mm, 22 * mm, 22 * mm, 18 * mm])


def automation_table() -> Table:
    rows = [
        ["方法", "使い方", "評価"],
        ["買い目CSV", "このPDF/CSVの順に、公式購入画面へ手入力で転記する。unit_count=2は同じ買い目を2口。", "今回の推奨。"],
        ["公式ランダム", "金額だけ指定して公式側に任せる。", "今回の戦略とは別物。検証用ならあり。"],
        ["らくらく購入", "予想は公式側が自動選択する。", "指定買い目ではないので今回のCSVとは別。"],
        ["完全自動購入", "ログイン、購入、決済まで自動化する。", "対象外。購入と決済は人が行う。"],
    ]
    return table(rows, [28 * mm, 97 * mm, 43 * mm])


def build_pdf() -> Path:
    OUT_PDF_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    pdf_path = OUT_PDF_DIR / PDF_NAME
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        rightMargin=12 * mm,
        leftMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=10 * mm,
        title="W杯toto 1634-1636 EV改善メモ v5",
    )

    story = [
        p("W杯toto 1634-1636 EV改善メモ v5", "title"),
        p("目的はシンプルです。1口いくらか、当たったらどれくらい戻るか、10口や1万円ならどの出目をどう置くか、そしてランダムよりEVが上がっているのかを見ます。"),
        p(f"1636の公式投票率と売上は {SNAPSHOT_1636_LABEL} 時点。売上は {yen(TOTAL_SALES_1636_YEN)}。latest PDF/CSVはこのv5へ差し替えます。", "small"),
        summary_table(),
        Spacer(1, 4 * mm),
        p("EVをわかりやすく", "h2"),
        ev_glossary_table(),
        Spacer(1, 4 * mm),
        p("総当たりEVより上がったか", "h2"),
        p("結論: proxy上は上がっています。ただし、実ブックメーカーオッズや予測市場価格をまだ接続していないので、ここではmarket proxyとして扱います。真EVと言い切る前に、次回は締切直前の外部オッズをp_modelに入れます。"),
        market_ev_table(),
        Spacer(1, 4 * mm),
        p("根拠として置くロジック", "h2"),
        table(
            [
                ["ロジック", "使い方", "参考"],
                ["予測市場/オッズ", "p_modelの土台。公式投票率ではなく実際の勝率側に置く。", SOURCE_SPANN_SKIERA_URL],
                ["Dixon-Coles", "得点分布からドローを詰める。", SOURCE_DIXON_COLES_URL],
                ["favorite-longshot bias", "穴なら何でも良いではなく、p_model > p_publicだけ拾う。", SOURCE_FAVORITE_LONGSHOT_URL],
                ["toto公式ルール", "1口100円、1等70%、2等15%、3等15%。", SOURCE_TOTO_RULE_URL],
            ],
            [34 * mm, 78 * mm, 58 * mm],
        ),
        PageBreak(),
        p("1634/1635の感想戦", "title"),
        p(f"1634実結果は {ACTUAL_1634}。公式人気順 {FAVORITE_1634} は9試合ズレ。前回PDFのEV候補9本も最良で3試合ズレで、1/2/3等は出せていません。"),
        previous_logic_table(),
        Spacer(1, 4 * mm),
        p("1634で人気出目とズレた試合", "h2"),
        mismatch_table(MATCHES_1634, "1634試合"),
        Spacer(1, 4 * mm),
        p(f"1635実結果は {ACTUAL_1635}。公式人気順 {FAVORITE_1635} は2試合ズレで3等相当。第2戦寄りは順当が増える、というHaziコメントと整合します。"),
        mismatch_table(MATCHES_1635, "1635試合"),
        PageBreak(),
        p("1636の買い方", "title"),
        p("1636は第2戦寄りとして、強人気は固定し、割れる試合だけ分散します。推奨コアは36ユニーク買い目 + Hot10だけ2口 = 46口/4,600円。20,000円CSVは議論用の上限です。"),
        phase_logic_table(),
        Spacer(1, 4 * mm),
        p("ランダムでどれくらい当たるか", "h2"),
        random_table(),
        Spacer(1, 4 * mm),
        p("出目を残すルール", "h2"),
        policy_table(),
        PageBreak(),
        p("Hot10と購入シート先頭", "title"),
        p("Hot10だけ2口まで。これは当たった時の戻りを厚くするだけで、的中範囲や2等カバー範囲は広がりません。したがって最大10本までに制限します。"),
        hot_table(),
        Spacer(1, 4 * mm),
        p("なるべく自動で買う方法", "h2"),
        automation_table(),
        Spacer(1, 4 * mm),
        p("注意: この資料は購入判断メモであり、購入代行、決済、精算、利益保証ではありません。実購入は公式画面で本人が確認して行います。", "small"),
        p(f"公式/データソース: 1634結果 {SOURCE_1634_RESULT_URL} / 1634投票 {SOURCE_1634_VOTE_URL} / 1635結果 {SOURCE_1635_RESULT_URL} / 1636購入画面 {SOURCE_1636_BUY_URL} / 1636投票 {SOURCE_1636_VOTE_URL}", "small"),
    ]
    doc.build(story)
    copy_report_aliases(pdf_path, OUT_PDF_DIR, PUBLIC_DIR, PDF_ALIASES)
    return pdf_path


def build_csv() -> Path:
    OUT_CSV_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    csv_path = OUT_CSV_DIR / CSV_NAME
    with csv_path.open("w", newline="", encoding="utf-8-sig") as output:
        writer = csv.writer(output)
        writer.writerow([
            "rank",
            "bucket",
            "unit_count",
            "amount_cumulative_yen",
            "signature",
            *[f"match_{index}" for index in range(1, 14)],
            "proxy_ev_multiple",
            "proxy_expected_return_yen",
            "note",
        ])
        for row in PURCHASE_ROWS_1636:
            writer.writerow([
                row["rank"],
                row["bucket"],
                row["units"],
                row["amount_cumulative_yen"],
                row["signature"],
                *row["picks"],
                f"{float(row['ev_multiple']):.6f}",
                f"{float(row['expected_return_yen']):.2f}",
                row["note"],
            ])
    copy_report_aliases(csv_path, OUT_CSV_DIR, PUBLIC_DIR, CSV_ALIASES)
    return csv_path


def main() -> None:
    pdf_path = build_pdf()
    csv_path = build_csv()
    print(f"PDF: {pdf_path}")
    print(f"CSV: {csv_path}")
    print(f"purchase_rows={len(PURCHASE_ROWS_1636)} units={sum(int(row['units']) for row in PURCHASE_ROWS_1636)}")
    print(f"recommended_units={sum(int(row['units']) for row in recommended_entries())}")
    print(f"recommended_ev={plan_ev_summary(recommended_entries())['ev_multiple']:.4f}")


if __name__ == "__main__":
    main()
