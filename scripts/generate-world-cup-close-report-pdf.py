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
APP_URL = "https://world-toto-lab.pages.dev/world-cup-strategy/"
TOTO_RULE_URL = "https://www.toto-dream.com/toto/about/index.html"
TOTO_SECOND_GUARANTEE_URL = "https://toto.cam/news/news_2019052001.php"
TOTO_BARA_URL = "https://totobara.com/"
DIXON_COLES_URL = "https://rss.onlinelibrary.wiley.com/doi/abs/10.1111/1467-9876.00065"
MARKET_ODDS_URL = "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2479770"
ELO_FORECAST_URL = "https://www.math.tugraz.at/~gilch/person/WC2018-Forecast.pdf"
FAVORITE_LONGSHOT_URL = "https://journals.sagepub.com/doi/10.1177/155862351100600404"

STAKE_YEN = 100
TOTAL_SALES_YEN = 289_166_800
RETURN_RATE = 0.5
OUTCOMES = ("1", "0", "2")
OUTCOME_INDEX = {outcome: index for index, outcome in enumerate(OUTCOMES)}
PRIZE_TIERS = (
    ("1等", 0, 0.70, True),
    ("2等", 1, 0.15, False),
    ("3等", 2, 0.15, False),
)
KNOWN_ACTUAL_RESULTS = {
    1: "0",
    2: "0",
    3: "1",
    4: "0",
    6: "0",
    11: "2",
    12: "1",
    13: "1",
}

# Initial snapshot from 2026-06-07. Used for the closing-time drift table.
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

def build_conditional_model_votes() -> list[tuple[float, float, float]]:
    rows: list[tuple[float, float, float]] = []
    for match_no, initial_votes in enumerate(INITIAL_VOTES, start=1):
        actual = KNOWN_ACTUAL_RESULTS.get(match_no)
        if not actual:
            rows.append(initial_votes)
            continue

        rows.append(tuple(1.0 if outcome == actual else 0.0 for outcome in OUTCOMES))
    return rows


# Match the app's close-report view: initial model line, with already-known results
# treated as conditional facts for post-close discussion.
MODEL_VOTES = build_conditional_model_votes()

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
class TierEv:
    estimated_payout_yen: float
    expected_return_yen: float
    hit_probability: float
    label: str


@dataclass(frozen=True)
class ComboRow:
    cash_probability: float
    ev_multiple: float
    expected_return_yen: float
    first_prize_expected_return_yen: float
    hit_probability: float
    payout_if_hit_yen: float
    public_probability: float
    signature: str
    strategy_bucket: str
    strategy_detail: str
    tier_evs: tuple[TierEv, ...]


@dataclass(frozen=True)
class CoverageSummary:
    exact_covered_count: int
    second_prize_coverage_rate: float
    second_prize_covered_count: int
    third_prize_coverage_rate: float
    third_prize_covered_count: int
    universe_count: int
    worst_distance_to_portfolio: int


@dataclass(frozen=True)
class PlanSummary:
    budget_yen: int
    cash_probability_upper_bound: float
    cost_yen: int
    ev_multiple: float
    expected_profit_yen: float
    expected_return_yen: float
    first_prize_expected_return_yen: float
    hit_probability: float
    line_count: int
    max_payout_yen: float
    min_payout_yen: float
    second_prize_coverage: CoverageSummary


@dataclass(frozen=True)
class OutcomePolicy:
    allowed_outcomes: tuple[str, ...]
    fixture: str
    label: str
    match_no: int
    reason: str


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


def hamming_distance(left: str, right: str) -> int:
    length = max(len(left), len(right))
    return sum((left[index] if index < len(left) else None) != (right[index] if index < len(right) else None) for index in range(length))


def ticket_strategy_bucket(ev_multiple: float, cash_probability: float, public_probability: float, signature: str) -> tuple[str, str]:
    orthodox_signature = "".join(OUTCOMES[max(range(3), key=lambda index: votes[index])] for votes in FINAL_VOTES)
    deviation_count = hamming_distance(signature, orthodox_signature)

    if deviation_count <= 1:
        return (
            "王道寄り",
            "公式人気順に近い。払戻は薄くなりやすいので、EVが残る時だけ採用。",
        )

    if public_probability <= 0.000001 and deviation_count >= 4:
        return (
            "ズラし強め",
            "crowdが薄い側へ寄せる候補。モデル根拠が弱い場合は感想戦で落とす。",
        )

    if cash_probability >= 0.01:
        return (
            "2等カバー補助",
            "1等一本より12/13圏内の面を増やすためのバラ買い補助枠。",
        )

    if ev_multiple >= 2:
        return (
            "高EV薄め",
            "期待回収は高いが当せん確率は薄い。上限口数を決めて積む候補。",
        )

    return (
        "分散補助",
        "上位候補と重ねすぎず、購入額を超える範囲でだけ置く候補。",
    )


def combo_probability(votes: list[tuple[float, float, float]], picks: tuple[int, ...]) -> float:
    probability = 1.0
    for index, pick in enumerate(picks):
        probability *= votes[index][pick]
    return probability


def tier_probability(votes: list[tuple[float, float, float]], picks: tuple[int, ...], miss_count: int) -> float:
    dp = [0.0 for _ in range(miss_count + 1)]
    dp[0] = 1.0

    for match_index, pick in enumerate(picks):
        hit_probability = votes[match_index][pick]
        miss_probability = 1 - hit_probability
        for misses in range(miss_count, -1, -1):
            dp[misses] = dp[misses] * hit_probability + (
                dp[misses - 1] * miss_probability if misses > 0 else 0
            )

    return dp[miss_count]


def estimated_tier_payout(public_probability: float, pool_share: float) -> float:
    expected_other_winners = (TOTAL_SALES_YEN / STAKE_YEN - 1) * public_probability
    prize_pool = TOTAL_SALES_YEN * RETURN_RATE * pool_share
    return prize_pool / (1 + expected_other_winners)


def prize_tier_evs(picks: tuple[int, ...]) -> tuple[TierEv, ...]:
    tiers: list[TierEv] = []

    for label, miss_count, pool_share, _carryover_eligible in PRIZE_TIERS:
        model_probability = tier_probability(MODEL_VOTES, picks, miss_count)
        public_probability = tier_probability(FINAL_VOTES, picks, miss_count)
        estimated_payout = estimated_tier_payout(public_probability, pool_share)
        tiers.append(
            TierEv(
                estimated_payout_yen=estimated_payout,
                expected_return_yen=model_probability * estimated_payout,
                hit_probability=model_probability,
                label=label,
            )
        )

    return tuple(tiers)


def probability_rows(votes: tuple[float, float, float]) -> list[tuple[int, float]]:
    return sorted(enumerate(votes), key=lambda entry: entry[1], reverse=True)


def outcome_policy(match_no: int, fixture: str, model_votes: tuple[float, float, float], official_votes: tuple[float, float, float]) -> OutcomePolicy:
    actual = KNOWN_ACTUAL_RESULTS.get(match_no)
    model_rows = probability_rows(model_votes)
    official_rows = probability_rows(official_votes)
    model_favorite_index, model_favorite_probability = model_rows[0]
    official_favorite_index, official_favorite_probability = official_rows[0]
    model_favorite = OUTCOMES[model_favorite_index]
    official_favorite = OUTCOMES[official_favorite_index]

    if actual:
        return OutcomePolicy(
            allowed_outcomes=(actual,),
            fixture=fixture,
            label="結果固定",
            match_no=match_no,
            reason=f"確定結果 {actual} を反映。ここに反する買い目は除外。",
        )

    if model_favorite_probability >= 0.70:
        return OutcomePolicy(
            allowed_outcomes=(model_favorite,),
            fixture=fixture,
            label="70%+ロック",
            match_no=match_no,
            reason=f"モデル本命 {model_favorite} が {pct(model_favorite_probability, 1)}。分散せず1点。",
        )

    top_gap = model_rows[0][1] - model_rows[1][1]
    official_spread = all(0.25 <= probability <= 0.45 for probability in official_votes)

    if top_gap <= 0.08 or official_spread:
        allowed = tuple(OUTCOMES[index] for index, probability in model_rows if probability >= 0.22)
        return OutcomePolicy(
            allowed_outcomes=allowed or OUTCOMES,
            fixture=fixture,
            label="割れ試合分散",
            match_no=match_no,
            reason=f"上位差 {top_gap * 100:.1f}pt。30%台で割れる試合として複数出目を残す。",
        )

    if official_favorite_probability >= 0.70 and official_favorite != model_favorite:
        allowed_indexes = []
        for index, _probability in model_rows[:2]:
            if index not in allowed_indexes:
                allowed_indexes.append(index)
        return OutcomePolicy(
            allowed_outcomes=tuple(OUTCOMES[index] for index in allowed_indexes),
            fixture=fixture,
            label="人気過剰外し",
            match_no=match_no,
            reason=f"公式人気は {official_favorite} に {pct(official_favorite_probability, 1)} 集中。モデル側を優先。",
        )

    return OutcomePolicy(
        allowed_outcomes=OUTCOMES,
        fixture=fixture,
        label="EV順で探索",
        match_no=match_no,
        reason="明確なロック条件ではないため、EV順の探索に委ねる。",
    )


OUTCOME_POLICIES = tuple(
    outcome_policy(index, fixture, model_votes, official_votes)
    for index, (fixture, model_votes, official_votes) in enumerate(zip(FIXTURES, MODEL_VOTES, FINAL_VOTES), start=1)
)


def enumerate_positive_rows() -> list[ComboRow]:
    rows: list[ComboRow] = []
    allowed_options = [
        tuple(OUTCOME_INDEX[outcome] for outcome in policy.allowed_outcomes)
        for policy in OUTCOME_POLICIES
    ]

    for picks in product(*allowed_options):
        hit_probability = tier_probability(MODEL_VOTES, picks, 0)
        public_probability = tier_probability(FINAL_VOTES, picks, 0)
        tiers = prize_tier_evs(picks)
        first_prize = tiers[0]
        expected_return = sum(tier.expected_return_yen for tier in tiers)
        ev_multiple = expected_return / STAKE_YEN

        if ev_multiple <= 1:
            continue

        signature = "".join(OUTCOMES[pick] for pick in picks)
        strategy_bucket, strategy_detail = ticket_strategy_bucket(
            ev_multiple,
            sum(tier.hit_probability for tier in tiers),
            public_probability,
            signature,
        )
        rows.append(
            ComboRow(
                cash_probability=sum(tier.hit_probability for tier in tiers),
                ev_multiple=ev_multiple,
                expected_return_yen=expected_return,
                first_prize_expected_return_yen=first_prize.expected_return_yen,
                hit_probability=hit_probability,
                payout_if_hit_yen=first_prize.estimated_payout_yen,
                public_probability=public_probability,
                signature=signature,
                strategy_bucket=strategy_bucket,
                strategy_detail=strategy_detail,
                tier_evs=tiers,
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


def build_coverage_summary(rows: list[ComboRow]) -> CoverageSummary:
    selected_signatures = [row.signature for row in rows]
    allowed_options = [policy.allowed_outcomes for policy in OUTCOME_POLICIES]
    exact_covered_count = 0
    second_prize_covered_count = 0
    third_prize_covered_count = 0
    universe_count = 0
    worst_distance_to_portfolio = 0

    for outcome_tuple in product(*allowed_options):
        universe_count += 1
        signature = "".join(outcome_tuple)
        distance = min(hamming_distance(signature, selected_signature) for selected_signature in selected_signatures)
        worst_distance_to_portfolio = max(worst_distance_to_portfolio, distance)

        if distance == 0:
            exact_covered_count += 1

        if distance <= 1:
            second_prize_covered_count += 1

        if distance <= 2:
            third_prize_covered_count += 1

    return CoverageSummary(
        exact_covered_count=exact_covered_count,
        second_prize_coverage_rate=second_prize_covered_count / universe_count,
        second_prize_covered_count=second_prize_covered_count,
        third_prize_coverage_rate=third_prize_covered_count / universe_count,
        third_prize_covered_count=third_prize_covered_count,
        universe_count=universe_count,
        worst_distance_to_portfolio=worst_distance_to_portfolio,
    )


def build_plan(rows: list[ComboRow], budget_yen: int) -> PlanSummary:
    line_count = min(len(rows), budget_yen // STAKE_YEN)
    selected = rows[:line_count]
    expected_return = sum(row.expected_return_yen for row in selected)
    first_prize_expected_return = sum(row.first_prize_expected_return_yen for row in selected)
    cost = line_count * STAKE_YEN
    payouts = [row.payout_if_hit_yen for row in selected]

    return PlanSummary(
        budget_yen=budget_yen,
        cash_probability_upper_bound=sum(row.cash_probability for row in selected),
        cost_yen=cost,
        ev_multiple=expected_return / cost,
        expected_profit_yen=expected_return - cost,
        expected_return_yen=expected_return,
        first_prize_expected_return_yen=first_prize_expected_return,
        hit_probability=sum(row.hit_probability for row in selected),
        line_count=line_count,
        max_payout_yen=max(payouts),
        min_payout_yen=min(payouts),
        second_prize_coverage=build_coverage_summary(selected),
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


def add_talk_board(story):
    story.append(p("ネタ話検討ボード", "title"))
    story.append(
        p(
            "飲みながら見るなら、まず数字の面白さと、どこがまだ仮説かを分けます。ボイスメモはこの順で話すと、次の改善プロンプトにしやすいです。",
            "subtitle",
        )
    )
    story.append(Spacer(1, 4 * mm))

    talk_rows = [
        [p("話題", "cell_bold"), p("今言えること", "cell_bold"), p("ツッコミどころ", "cell_bold")],
        [
            p("ネタの芯", "cell_bold"),
            p(
                f"1万円枠でも、プラス候補だけに絞ると{PLAN_100.line_count}口、購入額{yen(PLAN_100.cost_yen)}。1〜3等EVは{yen(PLAN_100.expected_return_yen)}。",
                "cell",
            ),
            p("ただし締切後・一部結果固定込みの感想戦です。買える時点の再現性が本題。", "cell"),
        ],
        [
            p("王道外し", "cell_bold"),
            p("公式人気順は安心感がある一方、同じ出目に票が寄るため1等払戻が薄くなりやすい。", "cell"),
            p("人気を外す根拠がモデルにあるか。単なる逆張りなら危険。", "cell"),
        ],
        [
            p("バラ買い", "cell_bold"),
            p("買うなら基本は1通り1口。期待値が高い候補を広く置き、同じ組み合わせを厚くしません。", "cell"),
            p("資金を使い切るより、100円EVを割る候補を切れるかが大事。", "cell"),
        ],
        [
            p("2等保証", "cell_bold"),
            p(
                f"候補宇宙{PLAN_100.second_prize_coverage.universe_count}通りに対して、1万円プランの2等カバー率は{pct(PLAN_100.second_prize_coverage.second_prize_coverage_rate, 1)}。",
                "cell",
            ),
            p("100%なら2等保証。未満なら保証ではなく、どの面を追加するかの議論に使います。", "cell"),
        ],
        [
            p("モデルの弱点", "cell_bold"),
            p("現状はW杯fallback priorが強く、Haziの肌感・外部オッズ・Elo・得点期待がまだ薄い。", "cell"),
            p("ここを詰めないと、表示EVが高くても本当の優位とは言い切れない。", "cell"),
        ],
    ]
    story.append(make_table(talk_rows, [36 * mm, 108 * mm, 100 * mm], standard_grid_style(), repeat_rows=1))
    story.append(Spacer(1, 5 * mm))

    story.append(p("ボイスメモで拾う問い", "section"))
    prompt_rows = [
        [p("No", "cell_bold"), p("問い", "cell_bold"), p("蒸留するときのタグ", "cell_bold")],
        [p("1", "center_cell"), p("この試合、人間なら1/0/2のどれを削れたか。理由は地力、日程、怪我、相性、モチベのどれか。", "cell"), p("strength / schedule / injury / matchup / motivation", "cell")],
        [p("2", "center_cell"), p("70%以上人気の試合は、本当に一本で良かったか。逆張りするなら何が根拠だったか。", "cell"), p("lock / fade / overbet", "cell")],
        [p("3", "center_cell"), p("30%台で割れた試合は、分散で良かったか。それとも片側に寄せる材料があったか。", "cell"), p("spread / draw / conviction", "cell")],
        [p("4", "center_cell"), p("2等カバーを増やすために、1等狙いから外してもよい試合はどれだったか。", "cell"), p("second prize / coverage / reduction", "cell")],
        [p("5", "center_cell"), p("締切前から最終投票率が動いた試合は、情報だったか、ただの人気流入だったか。", "cell"), p("closing move / info / crowd", "cell")],
        [p("6", "center_cell"), p("余った予算を使わない判断は妥当だったか。買いたい気持ちを止める条件は何か。", "cell"), p("budget discipline / threshold", "cell")],
    ]
    story.append(make_table(prompt_rows, [14 * mm, 158 * mm, 72 * mm], standard_grid_style(), repeat_rows=1))
    story.append(PageBreak())

    story.append(p("次に拾うとEVが現実に近づくロジック", "section"))
    story.append(
        p(
            "このページは実装予定メモです。今のPDFではまだモデル確率へ全自動では混ぜていません。感想戦で根拠が出たものから順番に入れます。",
            "subtitle",
        )
    )
    story.append(Spacer(1, 4 * mm))
    logic_rows = [
        [p("レーン", "cell_bold"), p("入れる理由", "cell_bold"), p("次の実装メモ", "cell_bold")],
        [p("市場/締切オッズ", "cell_bold"), p("予測市場や賭けオッズは強い基準線になりやすい。公式人気との差を見る軸にする。", "cell"), p(f"参考: {MARKET_ODDS_URL}", "small")],
        [p("Elo/チーム強度", "cell_bold"), p("試合別の勝率土台。fallback 36/28/36 から脱出するための最初の柱。", "cell"), p(f"参考: {ELO_FORECAST_URL}", "small")],
        [p("Poisson/Dixon-Coles", "cell_bold"), p("得点期待からドローを詰める。低得点相関を見ると0の扱いが改善しやすい。", "cell"), p(f"参考: {DIXON_COLES_URL}", "small")],
        [p("人気過剰バイアス", "cell_bold"), p("totoは当たるだけでなく、同じ等級に何口いるかが払戻を決める。人気の歪みがEV源泉。", "cell"), p(f"参考: {FAVORITE_LONGSHOT_URL}", "small")],
        [p("バラ買い2等保証", "cell_bold"), p("買い目と候補宇宙内の12/13以上カバーを並べて見ます。Hazi側の未共有ロジックは別メモ扱い。", "cell"), p(f"参考: {TOTO_SECOND_GUARANTEE_URL} / {TOTO_BARA_URL}", "small")],
    ]
    story.append(make_table(logic_rows, [42 * mm, 108 * mm, 94 * mm], standard_grid_style(), repeat_rows=1))


def add_page_one(story):
    story.append(p("W杯toto ネタ話・期待回収レポート", "title"))
    story.append(
        p(
            "第1634回 toto。締切後の確定試合込みで、1口いくらか、候補を何口置くか、1等・2等・3等込みで期待回収が購入額を超えるか、感想戦の論点までまとめます。",
            "subtitle",
        )
    )
    story.append(Spacer(1, 5 * mm))

    metric_table = make_table(
        [
            [
                metric_card("一口", yen(STAKE_YEN), "1通りを買う金額"),
                metric_card("10口枠", f"{PLAN_10.line_count}口", f"1〜3等EV {yen(PLAN_10.expected_return_yen)}"),
                metric_card("1万円枠", f"{PLAN_100.line_count}口", f"1〜3等EV {yen(PLAN_100.expected_return_yen)}"),
                metric_card("2等カバー", pct(PLAN_100.second_prize_coverage.second_prize_coverage_rate, 1), f"期待損益 {signed_yen(PLAN_100.expected_profit_yen)}"),
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
        [p("一口いくら?", "cell"), p(f"{yen(STAKE_YEN)}です。今回はプラス候補が{PLAN_100.line_count}口だけなので、10口枠でも1万円枠でも{yen(PLAN_100.cost_yen)}までしか使いません。", "cell")],
        [p("1万円で1万円以上戻る期待値はある?", "cell"), p(f"締切後の感想戦値ではあります。今回の候補だけに絞ると、購入額{yen(PLAN_100.cost_yen)}に対して1〜3等EVは{yen(PLAN_100.expected_return_yen)}、期待損益は{signed_yen(PLAN_100.expected_profit_yen)}です。買える時点の再現性は別途検証します。", "cell_bold")],
        [p("買うならどう買う?", "cell"), p(f"締切後なので購入指示ではありません。感想戦では上位{PLAN_100.line_count}通りを1口ずつ置いた前提で、どこが妥当かを議論します。", "cell")],
        [p("2等保証は織り込んでる?", "cell"), p(f"織り込みました。候補宇宙{PLAN_100.second_prize_coverage.universe_count}通りのうち、距離1以内の2等カバーは{PLAN_100.second_prize_coverage.second_prize_covered_count}通り、カバー率{pct(PLAN_100.second_prize_coverage.second_prize_coverage_rate, 1)}です。100%なら候補宇宙内2等保証、未満ならカバー率表示です。", "cell_bold")],
        [p("当たったらいくら戻る?", "cell"), p(f"1等なら、選んだ出目ごとの推定払戻は {yen(PLAN_100.min_payout_yen)} - {yen(PLAN_100.max_payout_yen)}。2等・3等は下位払戻として期待値に足しています。", "cell")],
        [p("友人に見せて大丈夫?", "cell"), p("この資料とアプリは購入履歴ではなく試算です。誰が何を買ったか、決済情報、購入済み履歴は扱いません。", "cell")],
    ]
    story.append(make_table(conclusion_rows, [48 * mm, 197 * mm], standard_grid_style()))
    story.append(Spacer(1, 5 * mm))

    story.append(p("予算別サマリー", "section"))
    plan_rows = [
        [p("予算", "cell_bold"), p("口数", "cell_bold"), p("1〜3等EV", "cell_bold"), p("1等分", "cell_bold"), p("期待損益", "cell_bold"), p("EV", "cell_bold"), p("2等カバー", "cell_bold")],
        [p("1口", "cell"), p(f"{PLAN_1.line_count}口", "cell"), p(yen(PLAN_1.expected_return_yen), "cell_bold"), p(yen(PLAN_1.first_prize_expected_return_yen), "cell"), p(signed_yen(PLAN_1.expected_profit_yen), "cell"), p(multiple(PLAN_1.ev_multiple), "cell"), p(pct(PLAN_1.second_prize_coverage.second_prize_coverage_rate, 1), "cell")],
        [p("10口枠", "cell"), p(f"{PLAN_10.line_count}口", "cell"), p(yen(PLAN_10.expected_return_yen), "cell_bold"), p(yen(PLAN_10.first_prize_expected_return_yen), "cell"), p(signed_yen(PLAN_10.expected_profit_yen), "cell"), p(multiple(PLAN_10.ev_multiple), "cell"), p(pct(PLAN_10.second_prize_coverage.second_prize_coverage_rate, 1), "cell")],
        [p("1万円枠", "cell"), p(f"{PLAN_100.line_count}口", "cell"), p(yen(PLAN_100.expected_return_yen), "cell_bold"), p(yen(PLAN_100.first_prize_expected_return_yen), "cell"), p(signed_yen(PLAN_100.expected_profit_yen), "cell_bold"), p(multiple(PLAN_100.ev_multiple), "cell_bold"), p(pct(PLAN_100.second_prize_coverage.second_prize_coverage_rate, 1), "cell_bold")],
    ]
    story.append(make_table(plan_rows, [25 * mm, 22 * mm, 38 * mm, 34 * mm, 34 * mm, 24 * mm, 38 * mm], standard_grid_style()))
    story.append(Spacer(1, 4 * mm))
    story.append(
        p(
            "注意: 期待回収は平均的な戻りの試算で、利益保証ではありません。今回は1等(13/13)、2等(12/13)、3等(11/13)の推定払戻を足しています。払戻圏内は複数口の合算上限目安です。",
            "small",
        )
    )


def add_ticket_table(story):
    story.append(p("買うならこの順 - 上位20通り", "title"))
    story.append(
        p(
            f"購入額より期待回収が高い候補だけを、1口ずつバラで買う前提です。今回は{PLAN_100.line_count}通りまでで止め、PDFでは上位20通りを載せます。",
            "subtitle",
        )
    )
    story.append(Spacer(1, 4 * mm))

    coverage = PLAN_100.second_prize_coverage
    story.append(
        p(
            f"1万円プランの2等カバー率は{pct(coverage.second_prize_coverage_rate, 1)}。候補宇宙{coverage.universe_count}通りのうち{coverage.second_prize_covered_count}通りが、購入ポートフォリオのどれかと1試合差以内です。",
            "small",
        )
    )
    story.append(Spacer(1, 3 * mm))

    rows = [[p("順", "cell_bold"), p("出目", "cell_bold"), p("戦略", "cell_bold"), p("1〜3等EV/口", "cell_bold"), p("EV", "cell_bold"), p("1等なら", "cell_bold"), p("払戻圏内", "cell_bold")]]
    for rank, row in enumerate(POSITIVE_ROWS[:20], start=1):
        rows.append(
            [
                p(str(rank), "center_cell"),
                p(row.signature, "cell_bold"),
                p(f"{row.strategy_bucket}<br/>{row.strategy_detail}", "cell"),
                p(yen(row.expected_return_yen), "cell_bold"),
                p(multiple(row.ev_multiple), "cell"),
                p(yen(row.payout_if_hit_yen), "cell"),
                p(pct(row.cash_probability, 4), "cell"),
            ]
        )

    story.append(make_table(rows, [12 * mm, 33 * mm, 70 * mm, 34 * mm, 22 * mm, 39 * mm, 32 * mm], standard_grid_style(), repeat_rows=1))
    story.append(Spacer(1, 5 * mm))

    story.append(PageBreak())
    story.append(p("王道で買った場合", "title"))
    story.append(p("公式人気どおりに買った場合も、1〜3等込みで見ます。人気側は当たった時の1等払戻が薄くなりやすい点に注意します。", "subtitle"))
    story.append(Spacer(1, 4 * mm))
    orthodox_signature = "".join(OUTCOMES[max(range(3), key=lambda index: votes[index])] for votes in FINAL_VOTES)
    orthodox_picks = tuple(OUTCOMES.index(char) for char in orthodox_signature)
    orthodox_tiers = prize_tier_evs(orthodox_picks)
    orthodox_expected = sum(tier.expected_return_yen for tier in orthodox_tiers)
    orthodox_cash_probability = sum(tier.hit_probability for tier in orthodox_tiers)
    orthodox_rows = [
        [p("出目", "cell_bold"), p("1等なら", "cell_bold"), p("1〜3等EV/口", "cell_bold"), p("1等分/口", "cell_bold"), p("EV", "cell_bold"), p("払戻圏内", "cell_bold")],
        [p(orthodox_signature, "cell_bold"), p(yen(orthodox_tiers[0].estimated_payout_yen), "cell"), p(yen(orthodox_expected), "cell"), p(yen(orthodox_tiers[0].expected_return_yen), "cell"), p(multiple(orthodox_expected / STAKE_YEN), "cell"), p(pct(orthodox_cash_probability, 4), "cell")],
    ]
    story.append(make_table(orthodox_rows, [48 * mm, 48 * mm, 42 * mm, 38 * mm, 28 * mm, 38 * mm], standard_grid_style()))
    story.append(
        p(
            "王道は安心感がありますが、同じ出目を買う人も多くなります。期待値が100円を下回るなら、厚く買う対象から外して上位候補に寄せます。",
            "small",
        )
    )


def add_method_page(story):
    story.append(p("計算の読み方", "title"))
    story.append(p("このページは、買う前に見る判断材料としての試算です。購入代行、精算、履歴表示ではありません。", "subtitle"))
    story.append(Spacer(1, 4 * mm))

    method_rows = [
        [p("項目", "cell_bold"), p("今回の扱い", "cell_bold")],
        [p("モデル確率", "cell"), p("現状はW杯フォールバック prior を軽量モデル線として使用。Haziの感想戦・ボイスメモで今後ここを強化します。", "cell")],
        [p("人気確率", "cell"), p("2026-06-12販売終了時点の確定公式投票率を使用。", "cell")],
        [p("売上", "cell"), p(f"確定売上 {yen(TOTAL_SALES_YEN)} を使用。1口100円なので推定総口数は {TOTAL_SALES_YEN // STAKE_YEN:,}口。", "cell")],
        [p("払戻", "cell"), p("売上 x 50%を原資に、1等70%、2等15%、3等15%へ配分。同じ等級に入る推定他当選口数で割ります。", "cell")],
        [p("期待回収", "cell"), p("1等・2等・3等それぞれのモデル当せん確率 x 推定払戻を足します。100円を超える出目だけを購入候補にします。", "cell")],
        [p("候補の絞り込み", "cell"), p("確定済みは結果固定。モデル70%以上は本命だけ。割れている試合は複数出目。公式人気が過剰ならモデル側を優先します。", "cell")],
        [p("含めていないもの", "cell"), p("税、実際の購入締切差、販売サイト側の最終確定配当、購入操作、購入済み履歴。", "cell")],
        [p("公式ルール", "cell"), p(f"1口100円、1等/2等/3等の等級と配分は公式説明を参照。{TOTO_RULE_URL}", "small")],
    ]
    story.append(make_table(method_rows, [42 * mm, 203 * mm], standard_grid_style()))
    story.append(Spacer(1, 5 * mm))

    story.append(p("購入候補の絞り込み", "section"))
    policy_rows = [[p("No", "cell_bold"), p("試合", "cell_bold"), p("判定", "cell_bold"), p("残す出目", "cell_bold"), p("理由", "cell_bold")]]
    for policy in OUTCOME_POLICIES:
        policy_rows.append(
            [
                p(str(policy.match_no), "center_cell"),
                p(policy.fixture, "cell"),
                p(policy.label, "cell_bold"),
                p(" / ".join(policy.allowed_outcomes), "cell_bold"),
                p(policy.reason, "cell"),
            ]
        )
    story.append(make_table(policy_rows, [12 * mm, 70 * mm, 30 * mm, 30 * mm, 103 * mm], standard_grid_style(), repeat_rows=1))
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
    story.append(p(f"toto公式ルール: {TOTO_RULE_URL}", "small"))


def draw_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(TEAL_DARK)
    canvas.rect(0, PAGE_H - 10 * mm, PAGE_W, 10 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont(FONT_BOLD, 8)
    canvas.drawString(16 * mm, PAGE_H - 6.5 * mm, "World Toto Lab discussion report")
    canvas.setFillColor(MUTED)
    canvas.setFont(FONT, 7.5)
    canvas.drawRightString(PAGE_W - 14 * mm, 8 * mm, f"Page {doc.page} / Generated 2026-06-15 JST")
    canvas.restoreState()


def build_pdf():
    for directory in (OUT_DIR, PUBLIC_DIR, TMP_DIR):
        directory.mkdir(parents=True, exist_ok=True)

    pdf_path = OUT_DIR / PDF_NAME
    public_pdf_path = PUBLIC_DIR / PDF_NAME

    story = []
    add_page_one(story)
    story.append(PageBreak())
    add_talk_board(story)
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
        title="World Toto Lab W杯toto ネタ話・期待回収レポート",
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
