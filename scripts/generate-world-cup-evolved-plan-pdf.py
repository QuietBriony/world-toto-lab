from __future__ import annotations

import csv
import shutil
from dataclasses import dataclass
from math import comb, log
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
PDF_NAME = "world-cup-toto-1634-1637-evolved-plan-20260628-v26.pdf"
CSV_50_NAME = "world-cup-toto-1637-visual-5000-plan-20260626-v23.csv"
CSV_NAME = "world-cup-toto-1637-visual-10000-plan-20260626-v23.csv"
CSV_200_NAME = "world-cup-toto-1637-visual-20000-plan-20260626-v23.csv"
LONGSHOT_INSURANCE_CSV_NAME = "world-cup-toto-1637-longshot-insurance-20260628-v24.csv"
PDF_ALIASES = (
    PDF_NAME,
    "world-cup-toto-latest.pdf",
    "world-cup-toto-1634-1636-evolved-plan.pdf",
)
CSV_50_ALIASES = (
    CSV_50_NAME,
    "world-cup-toto-latest-50-purchase-sheet.csv",
    "world-cup-toto-latest-5000-purchase-sheet.csv",
)
CSV_ALIASES = (
    CSV_NAME,
    "world-cup-toto-latest-purchase-sheet.csv",
    "world-cup-toto-latest-100-purchase-sheet.csv",
    "world-cup-toto-latest-10000-purchase-sheet.csv",
)
CSV_200_ALIASES = (
    CSV_200_NAME,
    "world-cup-toto-latest-200-purchase-sheet.csv",
    "world-cup-toto-latest-20000-purchase-sheet.csv",
)
LONGSHOT_INSURANCE_CSV_ALIASES = (
    LONGSHOT_INSURANCE_CSV_NAME,
    "world-cup-toto-latest-longshot-insurance-sheet.csv",
)
OUT_PDF_DIR = ROOT / "output" / "pdf"
OUT_CSV_DIR = ROOT / "output" / "purchase-sheets"
PUBLIC_DIR = ROOT / "public" / "reports"

STAKE_YEN = 100
DRAW_HEDGE_THRESHOLD = 0.20
RECOMMENDED_1636_UNIT_CAP = 200
OUTCOMES = ("1", "0", "2")
TOTO13_OUTCOME_COUNT = 3**13
SNAPSHOT_1636_LABEL = "2026-06-20 17:02 JST"
SNAPSHOT_1636_PRE_CLOSE_SALES_YEN = 222_065_900
FINAL_SALES_1636_YEN = 273_312_700
TOTAL_SALES_1636_YEN = SNAPSHOT_1636_PRE_CLOSE_SALES_YEN
SNAPSHOT_1637_VOTE_LABEL = "2026-06-25 18:22 JST"
SNAPSHOT_1637_SALES_LABEL = "2026-06-25 sales close"
TOTAL_SALES_1637_YEN = 357_285_900
VOTE_UNITS_1637 = 3_572_859
RETURN_RATE = 0.5
TIER_DEFS = (
    ("1等", 0, 0.70, True),
    ("2等", 1, 0.15, False),
    ("3等", 2, 0.15, False),
)

SOURCE_TOTO_RULE_URL = "https://www.toto-dream.com/toto/about/"
SOURCE_TOTO_TOP_URL = "https://www.toto-dream.com/"
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
SOURCE_1636_INFO_URL = "https://store.toto-dream.com/dcs/subos/screen/pi01/spin000/PGSPIN00001DisptotoLotInfo.form?holdCntId=1636"
SOURCE_1636_RESULT_URL = (
    "https://sp.toto-dream.com/dcs/subos/screen/si04/ssin007/"
    "PGSSIN00701FwdLotDetailRslttoto.form?holdCntId=1636&commodityId=01&meetingFiscalYear=2026"
)
SOURCE_1636_VOTE_URL = (
    "https://sp.toto-dream.com/dcs/subos/screen/si01/ssin025/"
    "PGSSIN02501ForwardVotetotoSP.form?commodityId=01&fromId=SSIN026&gameAssortment=A&holdCntId=1636"
)
SOURCE_1637_SALES_URL = (
    "https://sp.toto-dream.com/dcs/subos/screen/si01/ssin025/"
    "PGSSIN02501ForwardSalesTermtotoSP.form?holdCntId=1637"
)
SOURCE_1637_VOTE_URL = (
    "https://sp.toto-dream.com/dcs/subos/screen/si01/ssin025/"
    "PGSSIN02501ForwardVotetotoSP.form?commodityId=01&fromId=SSIN026&gameAssortment=A&holdCntId=1637"
)
SOURCE_POLYMARKET_SPORTS_URL = "https://docs.polymarket.us/api-reference/sports/overview"
SOURCE_POLYMARKET_MARKETS_URL = "https://docs.polymarket.us/api-reference/markets/get-markets"
SOURCE_POLYMARKET_BBO_URL = "https://docs.polymarket.us/api-reference/markets/get-market-bbo"
SOURCE_POLYMARKET_SPORTS_EVENTS_URL = "https://gateway.polymarket.us/v2/sports/soccer/events?limit=100&offset=0&type=sport&section=general"
SOURCE_POLYMARKET_ORDERBOOK_URL = "https://docs.polymarket.us/api-reference/markets/get-market-book"
SOURCE_KALSHI_MARKET_DATA_URL = "https://docs.kalshi.com/getting_started/quick_start_market_data"
SOURCE_BETFAIR_EXCHANGE_URL = "https://developer.betfair.com/exchange-api/"
SOURCE_ODDS_API_URL = "https://the-odds-api.com/liveapi/guides/v4/"


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
    risk: str = "core"


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
    PlanMatch(1, "ドイツ", "コートジボワール", "06/21 05:00", (0.7125, 0.2123, 0.0752), ("1", "0"), "勝ち軸 + 20%ドロー"),
    PlanMatch(2, "チュニジア", "日本", "06/21 13:00", (0.0798, 0.2292, 0.6910), ("2", "0"), "日本勝ち軸 + ドロー"),
    PlanMatch(3, "アルゼンチン", "オーストリア", "06/23 02:00", (0.7591, 0.1840, 0.0569), ("1",), "70%超は勝ち固定"),
    PlanMatch(4, "パナマ", "クロアチア", "06/24 08:00", (0.0428, 0.1325, 0.8247), ("2",), "80%超アウェイ固定"),
    PlanMatch(5, "コロンビア", "コンゴ民主共和国", "06/24 11:00", (0.7060, 0.2264, 0.0676), ("1", "0"), "勝ち軸 + 20%ドロー"),
    PlanMatch(6, "オランダ", "スウェーデン", "06/21 02:00", (0.4985, 0.3152, 0.1863), ("1", "0", "2"), "割れる試合は全分散"),
    PlanMatch(7, "ウルグアイ", "カーボベルデ", "06/22 07:00", (0.7138, 0.2236, 0.0626), ("1", "0"), "勝ち軸 + 20%ドロー"),
    PlanMatch(8, "ノルウェー", "セネガル", "06/23 09:00", (0.4495, 0.2928, 0.2577), ("1", "0", "2"), "30%台なので全分散"),
    PlanMatch(9, "ポルトガル", "ウズベキスタン", "06/24 02:00", (0.8075, 0.1492, 0.0433), ("1",), "80%超は勝ち固定"),
    PlanMatch(10, "ヨルダン", "アルジェリア", "06/23 12:00", (0.1496, 0.3319, 0.5185), ("2", "0"), "アウェイ勝ち軸 + ドロー"),
    PlanMatch(11, "スペイン", "サウジアラビア", "06/22 01:00", (0.8381, 0.1246, 0.0373), ("1",), "80%超は勝ち固定"),
    PlanMatch(12, "イングランド", "ガーナ", "06/24 05:00", (0.8433, 0.1169, 0.0398), ("1",), "80%超は勝ち固定"),
    PlanMatch(13, "エクアドル", "キュラソー", "06/21 09:00", (0.8500, 0.1122, 0.0378), ("1",), "80%超は勝ち固定"),
]

MATCHES_1637 = [
    PlanMatch(1, "エクアドル", "ドイツ", "06/26 05:00", (0.0899, 0.1669, 0.7432), ("2", "0"), "強豪人気 + 第3戦ドロー", "semi"),
    PlanMatch(2, "日本", "スウェーデン", "06/26 08:00", (0.6540, 0.2400, 0.1060), ("1", "0"), "日本勝ち軸 + ドロー", "flex"),
    PlanMatch(3, "ウルグアイ", "スペイン", "06/27 09:00", (0.0724, 0.2026, 0.7250), ("2", "0"), "スペイン軸 + 条件戦ドロー", "semi"),
    PlanMatch(4, "コロンビア", "ポルトガル", "06/28 08:30", (0.2209, 0.3195, 0.4596), ("2", "0", "1"), "30%台を全分散", "spread"),
    PlanMatch(5, "アルジェリア", "オーストリア", "06/28 11:00", (0.2037, 0.3293, 0.4670), ("0", "2"), "ドロー上振れ + オーストリア軸", "flex"),
    PlanMatch(6, "チュニジア", "オランダ", "06/26 08:00", (0.0213, 0.0436, 0.9351), ("2", "0"), "90%超人気 + 薄いドロー", "semi"),
    PlanMatch(7, "パラグアイ", "オーストラリア", "06/26 11:00", (0.3120, 0.3471, 0.3409), ("1", "0", "2"), "ほぼ三分で全分散", "spread"),
    PlanMatch(8, "ノルウェー", "フランス", "06/27 04:00", (0.1282, 0.2385, 0.6333), ("2", "0"), "フランス軸 + 条件戦ドロー", "semi"),
    PlanMatch(9, "パナマ", "イングランド", "06/28 06:00", (0.0231, 0.0657, 0.9112), ("2",), "補正ありでも勝ち固定", "lock"),
    PlanMatch(10, "コンゴ民主共和国", "ウズベキスタン", "06/28 08:30", (0.5448, 0.2913, 0.1639), ("1", "0", "2"), "30%台に散る全分散", "spread"),
    PlanMatch(11, "ヨルダン", "アルゼンチン", "06/28 11:00", (0.0226, 0.0527, 0.9247), ("2",), "補正ありでも勝ち固定", "lock"),
    PlanMatch(12, "ニュージーランド", "ベルギー", "06/27 12:00", (0.0432, 0.1312, 0.8256), ("2", "0"), "強豪人気 + 薄いドロー", "semi"),
    PlanMatch(13, "クロアチア", "ガーナ", "06/28 06:00", (0.5900, 0.2770, 0.1330), ("1", "0"), "クロアチア軸 + 条件戦ドロー", "semi"),
]

MULTI_PLANS_1637 = [
    {
        "label": "分散核",
        "choices": ("2", "1", "2", "2/0/1", "2", "2", "1/0/2", "2", "2", "1/0/2", "2", "2", "1"),
        "note": "30%台に散る3試合だけ全分散する最小形。",
    },
    {
        "label": "5千円級",
        "choices": ("2", "1/0", "2", "2/0/1", "2", "2", "1/0/2", "2", "2", "1/0/2", "2", "2", "1"),
        "note": "分散核に日本戦ドローを足す。",
    },
    {
        "label": "1万円級",
        "choices": ("2", "1/0", "2", "2/0/1", "0/2", "2", "1/0/2", "2", "2", "1/0/2", "2", "2", "1"),
        "note": "5千円級にアルジェリア vs オーストリアのドローを足す標準案。",
    },
    {
        "label": "200口以内広め",
        "choices": ("2", "1/0", "2", "2/0/1", "0/2/1", "2", "1/0/2", "2", "2", "1/0/2", "2", "2", "1"),
        "note": "M05も全分散にして、200口以内で広げる上限案。",
    },
]

POLYMARKET_1637_ROWS = [
    {
        "no": 1,
        "market": (0.1616, 0.1818, 0.6566),
        "delta": (0.0717, 0.0149, -0.0866),
        "volume": 4_399_026,
        "slug": "fwc-ecu-ger-2026-06-25",
        "action": "Germany本線。ただし公式75%弱より市場は66%で、全分散の優先度はM04/M05/M07未満。",
    },
    {
        "no": 2,
        "market": (0.5149, 0.2673, 0.2178),
        "delta": (-0.1391, 0.0273, 0.1118),
        "volume": 1_224_141,
        "slug": "fwc-jpn-swe-2026-06-25",
        "action": "日本人気が重い。108口では1/0、162口以上なら2追加候補。",
    },
    {
        "no": 3,
        "market": (0.1200, 0.2300, 0.6500),
        "delta": (0.0476, 0.0274, -0.0750),
        "volume": 200_903,
        "slug": "fwc-uru-esp-2026-06-26",
        "action": "スペイン本線。市場ドロー22%超なので1636反省版では0を入れる。",
    },
    {
        "no": 4,
        "market": (0.2300, 0.2400, 0.5300),
        "delta": (0.0091, -0.0795, 0.0704),
        "volume": 257_359,
        "slug": "fwc-col-por-2026-06-27",
        "action": "市場はPortugal寄り。ただし公式は割れているので108口では1/0/2へ広げる。",
    },
    {
        "no": 5,
        "market": (0.2424, 0.4242, 0.3333),
        "delta": (0.0387, 0.0949, -0.1337),
        "volume": 157_379,
        "slug": "fwc-alg-aut-2026-06-27",
        "action": "市場はドロー本命。Austria固定ではなく0を最優先で残す。",
    },
    {
        "no": 6,
        "market": (0.0396, 0.0792, 0.8812),
        "delta": (0.0183, 0.0356, -0.0539),
        "volume": 1_148_489,
        "slug": "fwc-tun-ned-2026-06-25",
        "action": "Netherlands本線。公式93%ほどは硬くないが、200口以内では本線優先。",
    },
    {
        "no": 7,
        "market": (0.3400, 0.4300, 0.2300),
        "delta": (0.0280, 0.0829, -0.1109),
        "volume": 562_017,
        "slug": "fwc-par-aus-2026-06-25",
        "action": "市場はドロー本命。ここは現行どおり全分散を維持。",
    },
    {
        "no": 8,
        "market": (0.1980, 0.2079, 0.5941),
        "delta": (0.0698, -0.0306, -0.0392),
        "volume": 443_121,
        "slug": "fwc-nor-fra-2026-06-26",
        "action": "France本線。市場はNorwayを公式より評価するが、優先度はM02/M05/M07未満。",
    },
    {
        "no": 9,
        "market": (0.0594, 0.1188, 0.8218),
        "delta": (0.0363, 0.0531, -0.0894),
        "volume": 184_977,
        "slug": "fwc-pan-eng-2026-06-27",
        "action": "Englandはまだ本線。ただし公式91%ほど硬くはないので締切ニュースで0を検討。",
    },
    {
        "no": 10,
        "market": (0.5612, 0.2245, 0.2143),
        "delta": (0.0164, -0.0668, 0.0504),
        "volume": 105_453,
        "slug": "fwc-cod-uzb-2026-06-27",
        "action": "市場もCongo DR寄り。公式ドローは高いが、市場補強108では1単独にする。",
    },
    {
        "no": 11,
        "market": (0.0588, 0.1275, 0.8137),
        "delta": (0.0362, 0.0748, -0.1110),
        "volume": 160_945,
        "slug": "fwc-jor-arg-2026-06-27",
        "action": "Argentinaは本線継続。公式ほど硬くはないが200口以内では2優先。",
    },
    {
        "no": 12,
        "market": (0.0505, 0.1212, 0.8283),
        "delta": (0.0073, -0.0100, 0.0027),
        "volume": 304_028,
        "slug": "fwc-nzl-bel-2026-06-26",
        "action": "Belgium本線。外部市場だけならドロー追加優先度は低い。",
    },
    {
        "no": 13,
        "market": (0.5455, 0.2929, 0.1616),
        "delta": (-0.0445, 0.0159, 0.0286),
        "volume": 101_255,
        "slug": "fwc-cro-gha-2026-06-27",
        "action": "Croatia本線だが、公式ドロー27%と市場ドロー29%なので0は残す。",
    },
]

MARKET_ADJUSTED_MULTI_PLANS_1637 = [
    {
        "label": "市場補強27口",
        "choices": ("2", "1", "2", "2/0/1", "0/2/1", "2", "1/0/2", "2", "2", "1", "2", "2", "1"),
        "note": "M04/M05/M07を全分散する最小形。M05はドロー本命読み。",
    },
    {
        "label": "市場補強54口",
        "choices": ("2", "1/0", "2", "2/0/1", "0/2/1", "2", "1/0/2", "2", "2", "1", "2", "2", "1"),
        "note": "54口級では日本戦M02のドローを追加。日本人気の重さを受ける。",
    },
    {
        "label": "市場補強108口",
        "choices": ("2", "1/0", "2", "2/0/1", "0/2/1", "2", "1/0/2", "2", "2", "1", "2", "2", "1/0"),
        "note": "暫定確定案。M04/M05/M07を広げ、M02とM13のドローを残す。",
    },
    {
        "label": "1636反省144口",
        "choices": ("2", "1/0", "2/0", "2/0/1", "0/2/1", "2", "1/0", "2", "2", "1", "2", "2", "1/0"),
        "note": "強人気ドロー対策。108口からM03の0を足し、M07は市場で薄い2を外す。",
    },
    {
        "label": "市場補強162口",
        "choices": ("2", "1/0/2", "2", "2/0/1", "0/2/1", "2", "1/0/2", "2", "2", "1", "2", "2", "1/0"),
        "note": "広め案。108口案からM02を全分散へ広げ、Sweden上振れを200口以内で拾う。",
    },
]

LONGSHOT_INSURANCE_PLANS_1637 = [
    {
        "label": "長穴保険128口",
        "base": "人力64口",
        "choices": ("1/2", "1/0", "2", "0/2", "0/2", "2", "0/2", "2", "2", "1/0", "2", "2", "1/0"),
        "note": "通常枠とは別。M01エクアドル勝ちを人力64口風シートに足す。",
    },
    {
        "label": "長穴保険192口",
        "base": "1636反省144口",
        "choices": ("1/2", "1/0", "0/2", "0/2", "1/0/2", "2", "1/0", "2", "2", "1", "2", "2", "1/0"),
        "note": "M01エクアドル勝ちを足し、M04を0/2へ絞って200口以内に収める。",
    },
]

LONGSHOT_TRIGGER_RULES = [
    "公式本命が70%以上、外部市場では66%以下。",
    "公式本命が市場で-8pt以上薄くなっている。",
    "非ドロー弱者側が+8pt以上、かつ市場/公式比が1.5倍以上。",
    "弱者勝ちの市場確率が15%以上。単なる超低確率は買わない。",
    "発火時もメインには混ぜず、別枠シートで管理する。",
]

LONGSHOT_BUDGET_LADDER = [
    "基本はメインマルチ1枚。非発火ならメイン拡張かドロー保険。",
    "発火時は、薄いメイン拡張より先に長穴保険へ予算を回す。",
    "200口以内なら、1637は市場54口+保険128口=182口/18,200円。",
    "余力があれば、市場108口+保険128口=236口/23,600円。",
    "非発火なら長穴保険は買わない。別の保険へ切り替える。",
]

LONGSHOT_ROUND_AUDIT_ROWS = [
    {
        "round": "1634",
        "status": "判定不能",
        "read": "公式人気順は大きく外れたが、同時刻Polyデータがない。",
        "replay": "非ドロー長穴ではなく、ドロー荒れ保険として扱う。",
        "lesson": "ドロー多発は弱者勝ち追加だけでは拾いにくい。",
    },
    {
        "round": "1635",
        "status": "非発火",
        "read": "第2戦寄りで順当。公式人気順のズレは小さい。",
        "replay": "メインを中心にし、強人気ドローだけ軽く残す。",
        "lesson": "順当回で長穴保険を無理に作らない。",
    },
    {
        "round": "1636",
        "status": "ドロー保険",
        "read": "カーボベルデ系は弱者勝ちでなくドロー軽視の問題。",
        "replay": "モデル/市場ドロー20%前後なら、70%本命相手でも0を残す。",
        "lesson": "ドロー保険は長穴保険と別ルールで管理する。",
    },
    {
        "round": "1637",
        "status": "発火",
        "read": "M01エクアドルは公式9.1%/市場17.2%。ドイツは公式73.8%/市場64.3%。",
        "replay": "200口以内なら市場54口+長穴128口=182口/18,200円。",
        "lesson": "長穴保険128口は1等まで届いていた。",
    },
]

NEXT_ACTION_ROWS = [
    ["1637払戻", "公式当せん金表が出たら、概算値を確定値へ差し替える。"],
    ["決勝T期間", "totoは休止なので、13試合マルチではなくWINNER監視に切り替える。"],
    ["8/1前", "2026-07-31に通常toto用のメイン/ドロー保険/長穴保険を再点検する。"],
    ["8/1以降", "2026-08-01 08:00にtoto再開予定。次回を取り込んで同じ発火判定を回す。"],
]

CONTEXT_FACTOR_LABELS = {
    "neutral_venue": "中立地",
    "country_name_bias": "国名人気",
    "group_situation": "グループ状況",
    "draw_ok": "引き分けOK",
    "rotation_risk": "主力温存",
}

CONTEXT_1637 = {
    1: (("neutral_venue", (0.01, 0.02, 0.00)), ("country_name_bias", (0.02, 0.04, -0.03)), ("group_situation", (0.02, 0.03, 0.00)), ("draw_ok", (0.00, 0.06, -0.02)), ("rotation_risk", (0.02, 0.05, -0.04))),
    2: (("neutral_venue", (0.00, 0.02, 0.01)), ("country_name_bias", (-0.02, 0.04, 0.02)), ("group_situation", (0.00, 0.04, 0.00)), ("draw_ok", (-0.01, 0.05, 0.00))),
    3: (("neutral_venue", (0.01, 0.02, 0.00)), ("country_name_bias", (0.02, 0.04, -0.03)), ("group_situation", (0.01, 0.04, 0.00)), ("draw_ok", (0.00, 0.05, -0.02)), ("rotation_risk", (0.02, 0.04, -0.03))),
    4: (("neutral_venue", (0.00, 0.02, 0.00)), ("country_name_bias", (0.02, 0.03, -0.02)), ("group_situation", (0.02, 0.03, 0.01)), ("draw_ok", (0.00, 0.04, 0.00)), ("rotation_risk", (0.02, 0.03, -0.02))),
    5: (("neutral_venue", (0.01, 0.02, 0.00)), ("group_situation", (0.02, 0.04, 0.00)), ("draw_ok", (0.00, 0.05, -0.01)), ("rotation_risk", (0.02, 0.03, -0.02))),
    6: (("neutral_venue", (0.01, 0.02, 0.00)), ("country_name_bias", (0.02, 0.04, -0.04)), ("group_situation", (0.00, 0.03, 0.00)), ("draw_ok", (0.00, 0.06, -0.03)), ("rotation_risk", (0.02, 0.05, -0.05))),
    7: (("neutral_venue", (0.00, 0.02, 0.00)), ("group_situation", (0.02, 0.03, 0.02)), ("draw_ok", (0.00, 0.04, 0.00))),
    8: (("neutral_venue", (0.01, 0.02, 0.00)), ("country_name_bias", (0.02, 0.04, -0.03)), ("group_situation", (0.01, 0.03, 0.00)), ("draw_ok", (0.00, 0.05, -0.02)), ("rotation_risk", (0.02, 0.04, -0.04))),
    9: (("neutral_venue", (0.01, 0.01, 0.00)), ("country_name_bias", (0.00, 0.03, -0.03)), ("rotation_risk", (0.01, 0.03, -0.03))),
    10: (("neutral_venue", (0.00, 0.02, 0.00)), ("group_situation", (0.02, 0.03, 0.02)), ("draw_ok", (0.00, 0.04, 0.00))),
    11: (("neutral_venue", (0.01, 0.01, 0.00)), ("country_name_bias", (0.00, 0.03, -0.03)), ("rotation_risk", (0.01, 0.03, -0.03))),
    12: (("neutral_venue", (0.01, 0.02, 0.00)), ("country_name_bias", (0.02, 0.04, -0.04)), ("group_situation", (0.00, 0.03, 0.00)), ("draw_ok", (0.00, 0.06, -0.02)), ("rotation_risk", (0.02, 0.05, -0.04))),
    13: (("neutral_venue", (0.00, 0.02, 0.01)), ("country_name_bias", (-0.02, 0.03, 0.01)), ("group_situation", (0.00, 0.04, 0.01)), ("draw_ok", (-0.02, 0.06, 0.00)), ("rotation_risk", (-0.03, 0.04, 0.02))),
}


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


def signed_pct_point(value: float | None, digits: int = 1) -> str:
    if value is None:
        return "-"
    sign = "+" if value > 0 else ""
    return f"{sign}{value * 100:.{digits}f}pt"


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


def match_label(match: PlanMatch) -> str:
    return f"M{match.no:02d} {match.home} vs {match.away}"


def outcome_label(match: PlanMatch, outcome: str) -> str:
    if outcome == "1":
        return f"1: {match.home}勝ち"
    if outcome == "0":
        return "0: 引き分け"
    if outcome == "2":
        return f"2: {match.away}勝ち"
    return outcome


def compact_pick_list(picks: tuple[str, ...] | list[str]) -> str:
    return " ".join(str(item) for item in picks)


def choice_count(choice: str) -> int:
    return len(choice.split("/"))


def multi_plan_units(plan: dict[str, object]) -> int:
    units = 1
    for choice in plan["choices"]:
        units *= choice_count(str(choice))
    return units


def multi_plan_formula(plan: dict[str, object]) -> str:
    counts = [choice_count(str(choice)) for choice in plan["choices"]]
    parts: list[str] = []
    for count in sorted(set(counts), reverse=True):
        if count <= 1:
            continue
        quantity = counts.count(count)
        parts.append(f"{count}^{quantity}" if quantity > 1 else str(count))
    return " x ".join(parts) if parts else "1"


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


def context_adjustment(match: PlanMatch, outcome: str) -> float:
    outcome_index = OUTCOMES.index(outcome)
    return sum(adjustments[outcome_index] for _, adjustments in CONTEXT_1637.get(match.no, ()))


def context_factor_names(match: PlanMatch) -> str:
    return " / ".join(CONTEXT_FACTOR_LABELS[key] for key, _ in CONTEXT_1637.get(match.no, ()))


def proxy_probs(match: PlanMatch) -> tuple[float, float, float]:
    weights = []
    for outcome, vote in zip(OUTCOMES, match.votes, strict=True):
        if outcome in match.allowed:
            boost = 1.08 if len(match.allowed) == 1 else 1.04
        else:
            boost = 0.84
        context_boost = min(1.22, max(0.78, 1 + context_adjustment(match, outcome)))
        weights.append(vote * boost * context_boost)

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


def build_allowed_rows(matches: list[PlanMatch]) -> list[tuple[str, ...]]:
    rows: list[tuple[str, ...]] = [()]
    for match in matches:
        rows = [row + (outcome,) for row in rows for outcome in match.allowed]
    return rows


def row_proxy_score(row: tuple[str, ...], matches: list[PlanMatch]) -> float:
    proxy_by_match = [proxy_probs(match) for match in matches]
    score = 0.0
    for index, outcome in enumerate(row):
        match = matches[index]
        proxy_probability = outcome_probability(outcome, proxy_by_match[index])
        public_probability = outcome_probability(outcome, match.votes)
        value_gap = max(0.0, proxy_probability - public_probability)
        context_score = context_adjustment(match, outcome)
        variance_bonus = 0.02 if len(match.allowed) >= 3 else 0.0
        score += log(proxy_probability) + value_gap * 1.2 + (1 - public_probability) * 0.04 + context_score * 0.55 + variance_bonus
    return score


def build_purchase_rows_1637(unique_line_limit: int = 100) -> list[dict[str, object]]:
    sorted_rows = sorted(
        build_allowed_rows(MATCHES_1637),
        key=lambda row: (-row_proxy_score(row, MATCHES_1637), signature(row)),
    )
    purchase_rows: list[dict[str, object]] = []
    cumulative_units = 0
    for index, row in enumerate(sorted_rows[:unique_line_limit], start=1):
        units = 1
        cumulative_units += units
        bucket = "direct"
        note = "暫定1637枠。最終再計算で残れば1口だけ買う。"
        purchase_rows.append(
            {
                "rank": index,
                "bucket": bucket,
                "units": units,
                "amount_cumulative_yen": cumulative_units * STAKE_YEN,
                "signature": signature(row),
                "picks": row,
                "note": note,
                "proxy_score": row_proxy_score(row, MATCHES_1637),
            }
        )
    return purchase_rows


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
PURCHASE_ROWS_1637_50 = build_purchase_rows_1637(50)
PURCHASE_ROWS_1637 = build_purchase_rows_1637(100)
PURCHASE_ROWS_1637_200 = build_purchase_rows_1637(200)
CORE_LINE_COUNT_1636 = len(build_allowed_rows(MATCHES_1636))
CORE_BUDGET_1636_YEN = CORE_LINE_COUNT_1636 * STAKE_YEN
ACTUAL_1634 = actual_signature(MATCHES_1634)
FAVORITE_1634 = favorite_signature(MATCHES_1634)
ACTUAL_1635 = actual_signature(MATCHES_1635)
FAVORITE_1635 = favorite_signature(MATCHES_1635)
FAVORITE_1636 = favorite_signature(MATCHES_1636)
FAVORITE_1637 = favorite_signature(MATCHES_1637)


def recommended_entries() -> list[dict[str, object]]:
    rows = []
    units = 0
    for row in PURCHASE_ROWS_1636:
        next_units = units + int(row["units"])
        if next_units > RECOMMENDED_1636_UNIT_CAP:
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
        ["明日の1637はいくら?", "基本は市場補強108口=10,800円。1636反省を強く入れるなら144口=14,400円。残高が薄ければ54口=5,400円。"],
        ["1636はいくらだった?", f"20%ドロー閾値込みの候補宇宙は{CORE_LINE_COUNT_1636:,}通り = {yen(CORE_BUDGET_1636_YEN)}。表示シートは上位{int(plan['units'])}口 = {yen(plan['cost_yen'])}に制限。"],
        ["当たったら?", "1等は選んだ出目の同時当せん口数で変わる。2等/3等も期待値に足す。"],
        ["EVは上がった?", f"market proxy上の{int(plan['units'])}口はEV {multiple(plan['ev_multiple'])}、期待損益 {signed_yen(plan['expected_profit_yen'])}。ただし実オッズ未接続なのでproxy扱い。"],
        ["いつ買う?", "1637は6/25 18:35-18:50 JSTが目安。18:32に公式投票率/売上を取り直し、18:55で打ち切る。"],
        ["買い方", "M01-M13で指定された出目をマルチ選択する。各行CSVの細かい買い目一覧は主導線にしない。"],
    ]
    result = table(rows, [38 * mm, 140 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), TEAL_LIGHT)]))
    return result


def ev_glossary_table() -> Table:
    rows = [
        ["用語", "ざっくり意味", "式/読み方"],
        ["EV", "平均でいくら戻る見込みか。利益保証ではない。", "EV倍率 = 期待回収額 / 購入額"],
        ["p_model", "モデルが見た実際の当たりやすさ。", "予測市場、オッズ、Elo、得点モデル、強アカWatchで作る"],
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
        [f"proxy EV {int(plan['units'])}口", yen(plan["cost_yen"]), yen(plan["expected_return_yen"]), multiple(plan["ev_multiple"]), f"{plan['ev_multiple'] - random_ev:+.2f}倍", "1-3等EV込み。20%ドロー閾値を反映した上限シート。"],
    ]
    result = table(rows, [32 * mm, 22 * mm, 26 * mm, 18 * mm, 22 * mm, 51 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 3), (-1, 4), AMBER_LIGHT)]))
    return result


def phase_logic_table() -> Table:
    rows = [
        ["対象", "読み", "買い目への使い方"],
        ["1634寄り: 初戦", "情報不足で荒れやすい。強人気でもドロー事故を拾う余地がある。", "強人気固定に寄せすぎない。"],
        ["1636寄り: 第2戦", "初戦情報が入り、条件戦にはまだ寄り切らない。順当が増えやすい。", "強人気固定を基本に、ドロー20%以上は残す。"],
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
    for line_count in [10, 100, RECOMMENDED_1636_UNIT_CAP, CORE_LINE_COUNT_1636]:
        rows.append([f"{line_count}口", yen(line_count * STAKE_YEN), pct(random_probability(line_count, 0), 5), pct(random_probability(line_count, 1), 3), pct(random_probability(line_count, 2), 2)])
    return table(rows, [24 * mm, 30 * mm, 38 * mm, 38 * mm, 38 * mm])


def policy_table() -> Table:
    rows = [["No", "試合", "公式投票 1/0/2", "残す出目", "ルール"]]
    for match in MATCHES_1636:
        rows.append([match.no, f"{match.home} vs {match.away}\n{match.kickoff}", " / ".join(pct(vote, 1) for vote in match.votes), display_outcomes(match.allowed), match.rule])
    return table(rows, [9 * mm, 54 * mm, 37 * mm, 16 * mm, 44 * mm])


def result_review_1636_table() -> Table:
    rows = [
        ["項目", "内容"],
        ["実出目", "1212110112100。公式第1636回toto結果で確定。"],
        ["最終売上", f"{yen(FINAL_SALES_1636_YEN)}。購入前EV再現は {SNAPSHOT_1636_LABEL} の {yen(SNAPSHOT_1636_PRE_CLOSE_SALES_YEN)} を使う。"],
        ["ユーザー購入", "64口=6,400円 + 16口=1,600円、合計80口=8,000円。"],
        ["当たり具合", "64口側はM12/M13を外して11/13、3等。16口側はM07/M12/M13を外して10/13で圏外。"],
        ["確定払戻", "3等650円。1等956,590円、2等6,750円、3等650円で公式確定。ユーザー合計は650円、差引-7,350円。"],
        ["学び", "M12 England-Ghana、M13 Ecuador-Curacaoはいずれも80%台強人気のドロー。強人気でも外部市場ドロー20%前後は軽視しない。"],
    ]
    result = table(rows, [34 * mm, 134 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), AMBER_LIGHT)]))
    return result


def result_logic_update_1636_table() -> Table:
    rows = [
        ["更新ルール", "1637への反映"],
        ["公式ドロー20%以上", "引き続き買い目候補へ残す。M05/M07/M10型の保険。"],
        ["強人気 + 外部市場ドロー20%前後", "70%以上の本命でも単独固定を解除候補にする。M03/M13を最終確認。"],
        ["口数が足りない時", "全分散を増やすより、強人気ドローを先に守る。"],
        ["明日の分岐", "基本108口。M03市場ドロー20%超が残れば1636反省144口へ上げる。残高優先なら54口へ落とす。"],
    ]
    result = table(rows, [46 * mm, 122 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), AMBER_LIGHT)]))
    return result


def strategy_1637_summary_table() -> Table:
    rows = [
        ["項目", "1637の暫定方針"],
        ["ステータス", f"公式投票率 {SNAPSHOT_1637_VOTE_LABEL}、売上 {SNAPSHOT_1637_SALES_LABEL} 時点。売上は {yen(TOTAL_SALES_1637_YEN)}。"],
        ["買うタイミング", "今は買わない。6/25 18:32に再取得、18:35-18:50に購入、18:55で打ち切り。ネット販売締切は19:00。"],
        ["予算", "基本は市場補強108口=10,800円。1636反省を強く入れるなら144口=14,400円。200口以内広めは162口=16,200円。"],
        ["なぜギリ?", "公式投票率と売上は動く。締切直前ほど払戻推定と人気ズレの推定誤差が小さい。"],
        ["注意", "購入/決済の自動化は対象外。マルチ指定の口数と金額を人が公式画面で確認して入力する。"],
    ]
    result = table(rows, [34 * mm, 134 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), TEAL_LIGHT)]))
    return result


def operation_1637_table() -> Table:
    rows = [
        ["時刻", "やること", "担当"],
        ["6/25 18:32", "公式投票率と売上を取り直し、PDFとマルチ選択表を再生成する。", "system"],
        ["6/25 18:30", "強人気ロック、条件戦ドロー、30%台分散、M03ドロー20%超を目視確認する。", "human"],
        ["6/25 18:35-18:50", "予算に合わせて54/108/144/162口のマルチ指定を公式画面へ入力する。", "human"],
        ["6/25 18:55", "購入確定を止める。締切19:00に食い込まない。", "human"],
    ]
    return table(rows, [30 * mm, 104 * mm, 26 * mm])


def policy_table_1637() -> Table:
    rows = [["No", "試合", "公式投票 1/0/2", "残す出目", "区分/ルール", "W杯補正"]]
    for match in MATCHES_1637:
        rows.append([
            match.no,
            f"{match.home} vs {match.away}\n{match.kickoff}",
            " / ".join(pct(vote, 1) for vote in match.votes),
            display_outcomes(match.allowed),
            f"{match.risk}: {match.rule}",
            context_factor_names(match),
        ])
    return table(rows, [8 * mm, 40 * mm, 32 * mm, 15 * mm, 32 * mm, 41 * mm])


def hot_table_1637() -> Table:
    rows = [["順", "買い目", "口数", "累計", "score", "区分"]]
    for row in PURCHASE_ROWS_1637[:20]:
        rows.append([
            row["rank"],
            row["signature"],
            1,
            yen(int(row["rank"]) * STAKE_YEN),
            f"{float(row['proxy_score']):.4f}",
            row["bucket"],
        ])
    return table(rows, [10 * mm, 50 * mm, 16 * mm, 24 * mm, 24 * mm, 22 * mm])


def budget_plan_summary_1637() -> Table:
    core_line_count = len(build_allowed_rows(MATCHES_1637))
    rows = [
        ["項目", "内容"],
        ["全推奨コア", f"{core_line_count:,}通り x {STAKE_YEN}円 = {yen(core_line_count * STAKE_YEN)}。これは広すぎるので実用購入対象にはしない。"],
        ["50口以内プラン", f"{len(PURCHASE_ROWS_1637_50)}通り / {sum(int(row['units']) for row in PURCHASE_ROWS_1637_50)}口 / {yen(len(PURCHASE_ROWS_1637_50) * STAKE_YEN)}。PDF内に全50行を載せる。"],
        ["100口以内プラン", f"{len(PURCHASE_ROWS_1637)}通り / {sum(int(row['units']) for row in PURCHASE_ROWS_1637)}口 / {yen(len(PURCHASE_ROWS_1637) * STAKE_YEN)}。標準プラン。CSVで全100行を確認する。"],
        ["200口以内プラン", f"{len(PURCHASE_ROWS_1637_200)}通り / {sum(int(row['units']) for row in PURCHASE_ROWS_1637_200)}口 / {yen(len(PURCHASE_ROWS_1637_200) * STAKE_YEN)}。広めに拾うプラン。CSVで全200行を確認する。"],
        ["入力順", "PDFのM01-M13対応表を見て、公式の普通購入画面で試合No.順に1/0/2を押す。CSVは各試合列に「2: ドイツ勝ち」のようなラベルも出す。"],
        ["読み方", "1=ホーム勝ち、0=引き分け、2=アウェイ勝ち。signature はM01からM13までの数字をつなげた確認用。"],
        ["CSV", "latest-50/100/200-purchase-sheet は検算用に残す。latest-purchase-sheet は100口版の別名。v23ではPDFのマルチ表を主導線にする。"],
        ["注意", "CSV/PDFは転記用メモ。購入、決済、自動投票は対象外。締切直前の再計算後に人が公式画面で確認して入力する。"],
    ]
    result = table(rows, [34 * mm, 134 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), TEAL_LIGHT)]))
    return result


def match_button_table_1637() -> Table:
    rows = [["No", "対象試合", "1", "0", "2", "推奨で残す出目"]]
    for match in MATCHES_1637:
        rows.append([
            f"M{match.no:02d}",
            f"{match.home} vs {match.away}\n{match.kickoff}",
            f"{match.home}勝ち\n{pct(match.votes[0], 1)}",
            f"引き分け\n{pct(match.votes[1], 1)}",
            f"{match.away}勝ち\n{pct(match.votes[2], 1)}",
            f"{display_outcomes(match.allowed)}\n{match.rule}",
        ])
    return table(rows, [10 * mm, 39 * mm, 25 * mm, 24 * mm, 25 * mm, 45 * mm])


def multi_plan_summary_table_1637() -> Table:
    core_line_count = len(build_allowed_rows(MATCHES_1637))
    rows = [["プラン", "選び方", "計算", "合計口数", "金額"]]
    for plan in MULTI_PLANS_1637:
        units = multi_plan_units(plan)
        rows.append([
            plan["label"],
            plan["note"],
            multi_plan_formula(plan),
            f"{units:,}口",
            yen(units * STAKE_YEN),
        ])
    rows.append([
        "全推奨コア",
        "残している出目を全部マルチ指定する参考値。実用購入対象にはしない。",
        "allowed all",
        f"{core_line_count:,}口",
        yen(core_line_count * STAKE_YEN),
    ])
    result = table(rows, [24 * mm, 72 * mm, 22 * mm, 22 * mm, 28 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), TEAL_LIGHT)]))
    return result


def multi_plan_matrix_table_1637() -> Table:
    headers = ["No", "対象試合", *[str(plan["label"]) for plan in MULTI_PLANS_1637], "メモ"]
    rows = [headers]
    for index, match in enumerate(MATCHES_1637):
        rows.append([
            f"M{match.no:02d}",
            f"{match.home} vs {match.away}\n{match.kickoff}",
            *[plan["choices"][index] for plan in MULTI_PLANS_1637],
            match.rule,
        ])
    return table(rows, [10 * mm, 38 * mm, 18 * mm, 18 * mm, 18 * mm, 24 * mm, 42 * mm])


def visual_purchase_table_1637(
    rows_source: list[dict[str, object]],
    start_rank: int,
    end_rank: int,
) -> Table:
    rows = [["rank", "累計", *[f"M{index:02d}" for index in range(1, 14)], "signature"]]
    for row in rows_source[start_rank - 1:end_rank]:
        picks = tuple(str(item) for item in row["picks"])
        rows.append([
            row["rank"],
            yen(int(row["rank"]) * STAKE_YEN),
            *picks,
            row["signature"],
        ])
    return table(rows, [10 * mm, 16 * mm, *([9 * mm] * 13), 30 * mm])


def visual_purchase_preview_table_1637(
    rows_source: list[dict[str, object]],
    start_rank: int,
    end_rank: int,
) -> Table:
    rows = [["rank", "累計", "M01-M04", "M05-M08", "M09-M13", "signature"]]
    for row in rows_source[start_rank - 1:end_rank]:
        picks = tuple(str(item) for item in row["picks"])
        rows.append([
            row["rank"],
            yen(int(row["rank"]) * STAKE_YEN),
            compact_pick_list(picks[:4]),
            compact_pick_list(picks[4:8]),
            compact_pick_list(picks[8:]),
            row["signature"],
        ])
    return table(rows, [13 * mm, 19 * mm, 29 * mm, 29 * mm, 35 * mm, 43 * mm])


def external_market_source_table() -> Table:
    rows = [
        ["ソース", "使い方", "v23での扱い"],
        ["公式投票率", "p_public。toto参加者の偏りを見る。", "現行の主ソース。締切直前に再取得。"],
        ["Polymarket", "Sports APIのW杯1X2価格を外部p_model候補にする。", "1637の13試合を公開APIで照合済み。強アカウントより市場価格を優先。"],
        ["Kalshi", "公開market data/orderbookがあれば二値市場の補助確率にする。", "サッカー該当市場がある時だけ採用。"],
        ["Betfair Exchange", "取引所オッズ、出来高、価格変化を締切直前のp_modelに使う。", "流動性がある試合なら高優先。"],
        ["Odds API/Bookmakers", "複数ブックの1X2オッズをvig除去して事前確率にする。", "公式確率以外の標準レイヤー候補。"],
    ]
    return table(rows, [30 * mm, 72 * mm, 66 * mm])


def polymarket_overlay_table_1637() -> Table:
    rows = [["No", "試合", "公式 1/0/2", "Polymarket 1/0/2", "最大+", "公式との差", "反映"]]
    for row in POLYMARKET_1637_ROWS:
        match = MATCHES_1637[int(row["no"]) - 1]
        delta = tuple(float(item) for item in row["delta"])
        best_index = max(range(3), key=lambda index: delta[index])
        worst_index = min(range(3), key=lambda index: delta[index])
        gap_label = f"厚い {OUTCOMES[best_index]} {signed_pct_point(delta[best_index])}\n薄い {OUTCOMES[worst_index]} {signed_pct_point(delta[worst_index])}"
        rows.append([
            f"M{int(row['no']):02d}",
            f"{match.home} vs {match.away}",
            " / ".join(pct(value, 1) for value in match.votes),
            " / ".join(pct(value, 1) for value in row["market"]),
            f"{OUTCOMES[best_index]} {signed_pct_point(delta[best_index])}",
            gap_label,
            row["action"],
        ])
    result = table(rows, [10 * mm, 27 * mm, 27 * mm, 30 * mm, 17 * mm, 25 * mm, 32 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), AMBER_LIGHT)]))
    return result


def market_adjusted_plan_summary_table_1637() -> Table:
    rows = [["プラン", "計算", "口数", "金額", "意味"]]
    for plan in MARKET_ADJUSTED_MULTI_PLANS_1637:
        units = multi_plan_units(plan)
        rows.append([
            plan["label"],
            multi_plan_formula(plan),
            f"{units:,}口",
            yen(units * STAKE_YEN),
            plan["note"],
        ])
    result = table(rows, [30 * mm, 26 * mm, 20 * mm, 24 * mm, 68 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), AMBER_LIGHT)]))
    return result


def market_adjusted_plan_matrix_table_1637() -> Table:
    headers = ["No", "対象試合", *[str(plan["label"]).replace("市場補強", "") for plan in MARKET_ADJUSTED_MULTI_PLANS_1637], "メモ"]
    rows = [headers]
    for index, match in enumerate(MATCHES_1637):
        rows.append([
            f"M{match.no:02d}",
            f"{match.home} vs {match.away}",
            *[plan["choices"][index] for plan in MARKET_ADJUSTED_MULTI_PLANS_1637],
            POLYMARKET_1637_ROWS[index]["action"],
        ])
    return table(rows, [9 * mm, 30 * mm, 17 * mm, 17 * mm, 18 * mm, 19 * mm, 18 * mm, 40 * mm])


def longshot_insurance_plan_table_1637() -> Table:
    rows = [["プラン", "ベース", "M01-M04", "M05-M08", "M09-M13", "口数", "金額", "メモ"]]
    for plan in LONGSHOT_INSURANCE_PLANS_1637:
        choices = tuple(str(choice) for choice in plan["choices"])
        units = multi_plan_units(plan)
        rows.append([
            plan["label"],
            plan["base"],
            " ".join(choices[:4]),
            " ".join(choices[4:8]),
            " ".join(choices[8:13]),
            f"{units:,}",
            yen(units * STAKE_YEN),
            plan["note"],
        ])
    result = table(rows, [22 * mm, 24 * mm, 25 * mm, 25 * mm, 30 * mm, 14 * mm, 18 * mm, 32 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), AMBER_LIGHT)]))
    return result


def longshot_trigger_rule_table() -> Table:
    rows = [["発火条件", "予算の積み方"]]
    max_len = max(len(LONGSHOT_TRIGGER_RULES), len(LONGSHOT_BUDGET_LADDER))
    for index in range(max_len):
        rows.append([
            LONGSHOT_TRIGGER_RULES[index] if index < len(LONGSHOT_TRIGGER_RULES) else "",
            LONGSHOT_BUDGET_LADDER[index] if index < len(LONGSHOT_BUDGET_LADDER) else "",
        ])
    result = table(rows, [82 * mm, 86 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), AMBER_LIGHT)]))
    return result


def longshot_round_audit_table() -> Table:
    rows = [["回", "状態", "読み", "戻るなら", "次に残すこと"]]
    for row in LONGSHOT_ROUND_AUDIT_ROWS:
        rows.append([row["round"], row["status"], row["read"], row["replay"], row["lesson"]])
    result = table(rows, [13 * mm, 24 * mm, 42 * mm, 45 * mm, 44 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), TEAL_LIGHT)]))
    return result


def next_action_table() -> Table:
    rows = [["次", "やること"], *NEXT_ACTION_ROWS]
    result = table(rows, [34 * mm, 134 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), TEAL_LIGHT)]))
    return result


def final_market_decision_rule_table() -> Table:
    rows = [
        ["ルール", "実行"],
        ["+8pt以上", "p_market - p_public が+8pt以上の出目は、公式で薄くても昇格候補。"],
        ["本命-12pt以上", "公式本命が市場で-12pt以上なら単独ロック解除。"],
        ["ドロー20%以上", "p_marketの0が20%以上なら締切版で0を残す候補に戻す。"],
        ["200口以内", "優先順は M05/M07/M04 → 日本戦M02 → M13ドロー → M03反省ドロー。M01は条件付き。"],
    ]
    result = table(rows, [36 * mm, 132 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), AMBER_LIGHT)]))
    return result


def final_lock_trigger_table_1637() -> Table:
    rows = [
        ["判定軸", "現在の読み", "108口維持", "変える条件"],
        [
            "M01 Ecuador-Germany",
            "公式Germany 74.4% / 市場Germany 65.7%。M01全分散の根拠は薄くなった。",
            "108口ではGermany単独。市場Draw 20%未満なら維持。",
            "Germany 62%未満またはDraw 20%以上なら144/162口で0追加。Ecuador+Draw 40%以上なら全分散検討。",
        ],
        [
            "M02 Japan-Sweden",
            "公式Japan 65.3% / 市場Japan 52.5%。日本人気を買いすぎない。",
            "市場Japan 55%以下、Draw 25%以上なら1/0維持。",
            "Sweden 24%以上または差分+14pt超なら162口で2追加。Japan 60%以上なら54口へ縮小候補。",
        ],
        [
            "M03 Uruguay-Spain",
            "公式Spain 72.5% / 市場Spain 65.7%、Draw 22.2%。1636反省では0候補。",
            "残高優先なら108口でSpain単独のまま。",
            "市場Drawが20%以上なら、M07のAustraliaを外した144口で0を入れる。",
        ],
        [
            "M05 Algeria-Austria",
            "公式Austria 46.7% / 市場Draw 42.9%、Austria 33.7%。公式ほど片寄っていない。",
            "市場Draw 35%以上、またはAustria 45%以下なら1/0/2維持。",
            "Austria 50%以上へ戻れば54口へ縮小。Draw 40%以上なら144/162口でも厚め維持。",
        ],
        [
            "M07 Paraguay-Australia",
            "公式は三分割、PolymarketはDraw 42.4%。108口では全分散。",
            "Draw 35%以上、または3出目が30%前後で割れ続けるなら全分散維持。",
            "144口へ上げる場合は、市場で薄いAustraliaを削ってM03ドローへ回す。",
        ],
        [
            "M13 Croatia-Ghana",
            "公式Croatia 59.1% / 市場Croatia 54.6%、Draw 29.3%。0を外さない。",
            "Croatia 65%以下、またはDraw 20%以上なら1/0維持。",
            "Croatia 68%以上かつDraw 18%未満なら54口へ縮小。Ghana 20%以上なら162口で1/0/2へ拡張。",
        ],
    ]
    result = table(rows, [31 * mm, 45 * mm, 45 * mm, 47 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), TEAL_LIGHT)]))
    return result


def final_logic_table_1637() -> Table:
    rows = [
        ["論点", "v23での読み"],
        ["公式投票率", "日本のtoto購入者の人気。勝率ではなく、払戻が薄くなる混み具合として読む。"],
        ["バックテスト", "1634は公式人気順が9ズレ、1635は2ズレで3等相当。1636は強人気ドローを外して3等止まり。"],
        ["外部市場", "18:22公式と18:31 PolymarketではM05/M07のドロー、M02の日本人気、M13のドローを重視。M01全分散は下げる。"],
        ["暫定確定", "基本は市場補強108口=10,800円。M03ドローまで強く拾う場合だけ144口=14,400円。"],
        ["当日運用", "18:22版でPDFを更新済み。18:32に再取得できるなら最後に確認し、18:35-18:50に手入力。18:55以降は触らない。"],
    ]
    result = table(rows, [36 * mm, 132 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), TEAL_LIGHT)]))
    return result


def polymarket_backtest_audit_table() -> Table:
    rows = [
        ["回", "公式データ", "Polymarket取得", "判定"],
        ["1634", "締切時点の公式投票率あり / 結果確定", "Sports API通常一覧では対象13試合を再発見できず", "Poly優位とは未判定。token IDが見つかれば再検証。"],
        ["1635", "締切時点の公式投票率あり / 結果確定", "Sports API通常一覧では対象13試合を再発見できず", "公式人気順は3等圏。Poly比較はtoken ID待ち。"],
        ["1636", "2026-06-20 17:02公式投票率あり / 一部進行中", "通常一覧で7/13試合だけ確認。開始後/終了後が混ざる", "厳密比較には使わない。結果確定後に履歴tokenが取れた分だけ検証。"],
        ["1637", "2026-06-25 18:22公式投票率あり / 未開催", "2026-06-25 18:31時点のSports APIで13/13試合を照合済み", "前向き利用可。この18時台スナップショットを購入前検証の本線にする。"],
    ]
    result = table(rows, [16 * mm, 48 * mm, 54 * mm, 50 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), TEAL_LIGHT)]))
    return result


def polymarket_backtest_rules_table() -> Table:
    rows = [
        ["ルール", "理由"],
        ["現在価格を過去回に混ぜない", "結果後価格や決済価格を入れると後出し検証になる。"],
        ["販売締切前timestampだけ使う", "公式投票率と同じ時刻のp_marketで比較する。"],
        ["token IDが取れない回は未判定", "Polyなら良かった、とは言わない。公式のみバックテストとして残す。"],
        ["1637は同時刻保存を最優先", "今回から検証母集団を作れる。最適ロジックを後で厳密に評価できる。"],
    ]
    result = table(rows, [46 * mm, 122 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), AMBER_LIGHT)]))
    return result


def source_blend_table() -> Table:
    rows = [
        ["入力", "重みの目安", "理由"],
        ["公式投票率", "35%", "toto内の混み具合。配当側の歪みを読むため必須。"],
        ["Polymarket/ブック/取引所", "50%", "実勝率の近似。Hazi入力なしの今回は外部市場を厚めに見る。"],
        ["W杯コンテキスト", "20%", "中立地、国名人気、勝点条件、引き分けOK、温存を反映。"],
        ["強アカWatch", "補助", "価格は上書きしない。人気国No、ドロー、弱者側の大口痕跡がある時だけロック解除やヘッジ維持に使う。"],
    ]
    return table(rows, [38 * mm, 28 * mm, 102 * mm])


def budget_plan_table_1637(start_rank: int, end_rank: int) -> Table:
    rows = [["rank", "区分", "口数", "累計", "signature / M01-M13"]]
    for row in PURCHASE_ROWS_1637[start_rank - 1:end_rank]:
        rows.append([
            row["rank"],
            row["bucket"],
            1,
            yen(int(row["rank"]) * STAKE_YEN),
            row["signature"],
        ])
    return table(rows, [13 * mm, 18 * mm, 14 * mm, 28 * mm, 76 * mm])


def hot_table() -> Table:
    rows = [["順", "買い目", "口数", "累計", "EV/口", "区分"]]
    for row in PURCHASE_ROWS_1636[:20]:
        rows.append([row["rank"], row["signature"], row["units"], yen(int(row["amount_cumulative_yen"])), multiple(float(row["ev_multiple"])), row["bucket"]])
    return table(rows, [10 * mm, 50 * mm, 14 * mm, 22 * mm, 22 * mm, 18 * mm])


def automation_table() -> Table:
    rows = [
        ["方法", "使い方", "評価"],
        ["補助CSV", "latest-50/100/200-purchase-sheet は検算用に残す。PDFのマルチ指定が主導線。", "補助扱い。"],
        ["公式ランダム", "金額だけ指定して公式側に任せる。", "今回の戦略とは別物。検証用ならあり。"],
        ["らくらく購入", "予想は公式側が自動選択する。", "指定買い目ではないので今回のCSVとは別。"],
        ["完全自動購入", "ログイン、購入、決済まで自動化する。", "対象外。購入と決済は人が行う。"],
    ]
    return table(rows, [28 * mm, 97 * mm, 43 * mm])


def actual_purchase_progress_1637_table() -> Table:
    rows = [
        ["Item", "Post-result read"],
        ["Official toto status", "Soccer FT scores are complete. Official toto payout table was still pending at 2026-06-28 13:05 JST."],
        ["Final signature", "1020020221221. M04 Colombia-Portugal and M05 Algeria-Austria both finished draw; M10 DR Congo and M11 Argentina won."],
        ["Actual purchase", "370 units total. Slip A hit 2nd x1 + 3rd x8. Slip B hit 2nd x1 + 3rd x9. Slip C hit 2nd x1 + 3rd x6."],
        ["Payout estimate", "Close-vote estimate: 2nd about 4,344 yen, 3rd about 527 yen. User estimate: about 25,153 yen before official payout table."],
        ["Strategy update", "The 128-unit longshot insurance sheet would have hit 1st. When its trigger fires, fund it before broad low-edge add-ons."],
        ["200-unit rewind", "For 1637, market-adjusted 54 units + longshot insurance 128 units = 182 units / 18,200 yen."],
        ["Next rule", "Core market-adjusted 108/162 remains useful for 2nd/3rd coverage, but triggered longshot insurance becomes the default upside sleeve."],
    ]
    result = table(rows, [42 * mm, 126 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), TEAL_LIGHT)]))
    return result


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
        title="W杯toto 1634-1637 EV改善メモ v26",
    )

    story = [
        p("W杯toto 1634-1637 EV改善メモ v26", "title"),
        p("目的はシンプルです。1口いくらか、当たったらどれくらい戻るか、10口や1万円ならどの出目をどう置くか、そしてランダムよりEVが上がっているのかを見ます。"),
        p(f"1637の公式投票率は {SNAPSHOT_1637_VOTE_LABEL}、売上は {SNAPSHOT_1637_SALES_LABEL} 時点。現在売上は {yen(TOTAL_SALES_1637_YEN)}、投票数は {VOTE_UNITS_1637:,}口。latest PDFはこのv26へ差し替えます。", "small"),
        p("公式投票率は勝率そのものではなく、日本のtoto購入者の人気です。払戻の薄さを見るp_publicとして使い、勝率寄りのp_modelはPolymarketなどの外部市場とW杯文脈で補います。", "small"),
        summary_table(),
        Spacer(1, 4 * mm),
        p("1636結果からの反省", "h2"),
        result_review_1636_table(),
        Spacer(1, 4 * mm),
        result_logic_update_1636_table(),
        Spacer(1, 4 * mm),
        p("EVをわかりやすく", "h2"),
        ev_glossary_table(),
        Spacer(1, 4 * mm),
        p("総当たりEVより上がったか", "h2"),
        p("結論: proxy上は上がっています。v23ではPolymarketの試合別1X2を再取得し、6/25 18:22公式投票率と比較しています。ただし、ブックメーカー複数社のvig除去やBetfair板はまだ未接続なので、真EVではなく外部市場proxyとして扱います。"),
        market_ev_table(),
        Spacer(1, 5 * mm),
        p("1637の最適戦略", "title"),
        p("1637は第3戦寄りの条件戦として扱います。現時点の暫定マルチ選択表は作りますが、買うのは締切直前に公式投票率と売上を取り直してからです。"),
        strategy_1637_summary_table(),
        Spacer(1, 4 * mm),
        p("当日の回し方", "h2"),
        operation_1637_table(),
        Spacer(1, 4 * mm),
        p("1637実購入の途中チェック", "h2"),
        actual_purchase_progress_1637_table(),
        Spacer(1, 4 * mm),
        p("出目を残すルール", "h2"),
        p(f"公式人気順だけなら {FAVORITE_1637}。ただし第3戦は中立地、国名人気、勝点条件、温存、引き分けOKで人気順からズレる余地があります。v23ではこの補正とPolymarket差分をマルチ選択の残し方に入れています。"),
        policy_table_1637(),
        Spacer(1, 4 * mm),
        p("マルチ指定の合計口数", "h2"),
        p("公式マルチでは、各試合で選んだ出目数を掛け算したものが購入口数です。下の表だけ見れば、どの出目を残すと何口・いくらかがわかります。"),
        multi_plan_summary_table_1637(),
        PageBreak(),
        p("1637 普通購入画面で押す対応表", "title"),
        p("1口100円です。M01からM13まで、選ぶプランの列に書いた 1/0/2 をマルチで押します。1=ホーム勝ち、0=引き分け、2=アウェイ勝ちです。"),
        match_button_table_1637(),
        PageBreak(),
        p("1637 マルチ出目サマリ", "title"),
        p("CSVの各行詳細は使いません。選ぶプランの列だけを見て、M01からM13へ同じ出目を入れます。"),
        multi_plan_matrix_table_1637(),
        PageBreak(),
        p("外部市場を入れると何が変わるか", "title"),
        p("Hazi入力は使わず、人間メモ重みは0にします。ここではPolymarketの公開Sports APIから取得できたW杯1X2価格をp_marketとして、toto公式投票率p_publicとの差を見ます。価格はSports APIの1X2価格を3出目合計100%へ正規化したものです。取得は2026-06-25 18:31 JST相当です。"),
        polymarket_overlay_table_1637(),
        Spacer(1, 4 * mm),
        p("最終選択へ折り込むルール", "h2"),
        final_market_decision_rule_table(),
        p("1637 最終ロック判定表", "h2"),
        p("6/25 18:32に再取得した時、この表の条件で108口を維持するか、144/162口へ広げるか、54口へ落とすかを決めます。現時点では108口維持です。"),
        final_lock_trigger_table_1637(),
        PageBreak(),
        p("1637 市場補強版マルチ指定", "title"),
        p("締切直前も同じ市場差なら、通常の1万円級より市場補強108口を優先候補にします。広めに行くなら162口。どちらも200口以内です。"),
        market_adjusted_plan_summary_table_1637(),
        Spacer(1, 4 * mm),
        market_adjusted_plan_matrix_table_1637(),
        Spacer(1, 4 * mm),
        p("長穴保険は常時ONではない", "h2"),
        p("長穴保険は、公式人気が本命へ寄りすぎ、外部市場が非ドローの弱者側を明確に持ち上げた時だけ発火します。発火しない回では買わず、メイン拡張かドロー保険へ予算を回します。"),
        longshot_trigger_rule_table(),
        Spacer(1, 4 * mm),
        p("1634-1637 長穴トリガー棚卸し", "h2"),
        longshot_round_audit_table(),
        Spacer(1, 4 * mm),
        p("次にいつ何をやるか", "h2"),
        p("公式告知では、totoは2026-06-25 19:00から2026-08-01 08:00まで販売休止予定です。W杯決勝トーナメント中はtotoマルチではなくWINNER監視へ切り替えます。", "small"),
        next_action_table(),
        Spacer(1, 4 * mm),
        p("長穴保険シート", "h2"),
        p("1637を巻き戻すなら、200口以内は市場補強54口 + 長穴保険128口 = 182口 / 18,200円。余力がある時だけ市場補強108口 + 長穴保険128口へ上げます。"),
        longshot_insurance_plan_table_1637(),
        PageBreak(),
        p("外部市場で推奨を補強する", "title"),
        p("強アカウントを丸ごとコピーするより、公開市場価格、板の厚み、出来高、ブックメーカーの1X2確率をp_modelへ混ぜる方が再現性があります。今回の1637ではPolymarketの試合別1X2が取れたので、外部市場サンプルとして使っています。強アカWatchは、履歴が取れる場合だけ人気国No・ドロー・弱者側を残す補助シグナルにします。"),
        external_market_source_table(),
        Spacer(1, 4 * mm),
        p("Poly同時刻バックテスト監査", "h2"),
        p("Polymarketにはprices-historyがありますが、過去回に現在価格や決済価格を混ぜると後出しになります。1634/1635は終了済みSports eventのtoken IDがまだ解けていないため、Polyなら良かったとはまだ言いません。"),
        polymarket_backtest_audit_table(),
        Spacer(1, 4 * mm),
        polymarket_backtest_rules_table(),
        Spacer(1, 4 * mm),
        p("1637 暫定確定ロジック", "h2"),
        final_logic_table_1637(),
        PageBreak(),
        p("締切直前のブレンド案", "h2"),
        source_blend_table(),
        Spacer(1, 4 * mm),
        p("根拠として置くロジック", "h2"),
        table(
            [
                ["ロジック", "使い方", "参考"],
                ["予測市場/オッズ", "p_modelの土台。公式投票率ではなく実際の勝率側に置く。", SOURCE_SPANN_SKIERA_URL],
                ["Dixon-Coles", "得点分布からドローを詰める。", SOURCE_DIXON_COLES_URL],
                ["favorite-longshot bias", "穴なら何でも良いではなく、p_model > p_publicだけ拾う。", SOURCE_FAVORITE_LONGSHOT_URL],
                ["toto公式ルール", "1口100円、1等70%、2等15%、3等15%。", SOURCE_TOTO_RULE_URL],
                ["Polymarket", "Sports API/Markets/BBOから試合別1X2価格と出来高を外部p_model候補にする。", SOURCE_POLYMARKET_SPORTS_URL],
                ["Polymarket BBO", "市場価格のbid/ask中点を取り、3出目で正規化して比較する。", SOURCE_POLYMARKET_BBO_URL],
                ["Kalshi", "公開market data/orderbookがある時だけ補助確率として使う。", SOURCE_KALSHI_MARKET_DATA_URL],
                ["Betfair/Odds API", "取引所オッズと複数ブックの1X2をvig除去して混ぜる。", SOURCE_ODDS_API_URL],
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
        p(f"1635実結果は {ACTUAL_1635}。公式人気順 {FAVORITE_1635} は2試合ズレで3等相当。第2戦寄りは順当が増える、というフェーズ仮説と整合します。"),
        mismatch_table(MATCHES_1635, "1635試合"),
        PageBreak(),
        p("1636の買い方", "title"),
        p(f"1636は第2戦寄りとして順当寄りを軸にします。ただしカーボベルデの反省として、事前ドロー確率{int(DRAW_HEDGE_THRESHOLD * 100)}%以上は強人気でも買い目候補に残します。候補宇宙は{CORE_LINE_COUNT_1636:,}通り/{yen(CORE_BUDGET_1636_YEN)}、表示シートは上位{int(plan_ev_summary(recommended_entries())['units'])}口/{yen(plan_ev_summary(recommended_entries())['cost_yen'])}に制限します。"),
        phase_logic_table(),
        Spacer(1, 4 * mm),
        p("ランダムでどれくらい当たるか", "h2"),
        random_table(),
        Spacer(1, 4 * mm),
        p("出目を残すルール", "h2"),
        policy_table(),
        PageBreak(),
        p("1636旧シート先頭", "title"),
        p("1636では上位を厚くする案も試しましたが、v23の1637方針ではCSV行詳細よりマルチ選択表で口数と金額を確認します。"),
        hot_table(),
        Spacer(1, 4 * mm),
        p("なるべく自動で買う方法", "h2"),
        automation_table(),
        Spacer(1, 4 * mm),
        p("注意: この資料は購入判断メモであり、購入代行、決済、精算、利益保証ではありません。実購入は公式画面で本人が確認して行います。", "small"),
        p(f"公式/データソース: 公式トップ販売休止告知 {SOURCE_TOTO_TOP_URL} / 1634結果 {SOURCE_1634_RESULT_URL} / 1634投票 {SOURCE_1634_VOTE_URL} / 1635結果 {SOURCE_1635_RESULT_URL} / 1636結果 {SOURCE_1636_RESULT_URL} / 1636くじ情報 {SOURCE_1636_INFO_URL} / 1636購入画面 {SOURCE_1636_BUY_URL} / 1636投票 {SOURCE_1636_VOTE_URL} / 1637投票 {SOURCE_1637_VOTE_URL} / 1637販売 {SOURCE_1637_SALES_URL} / Polymarket docs {SOURCE_POLYMARKET_SPORTS_URL} / Polymarket sample {SOURCE_POLYMARKET_SPORTS_EVENTS_URL} / Kalshi {SOURCE_KALSHI_MARKET_DATA_URL} / Betfair {SOURCE_BETFAIR_EXCHANGE_URL} / Odds API {SOURCE_ODDS_API_URL}", "small"),
    ]
    doc.build(story)
    copy_report_aliases(pdf_path, OUT_PDF_DIR, PUBLIC_DIR, PDF_ALIASES)
    return pdf_path


def entry_rows_1637(
    purchase_rows: list[dict[str, object]],
) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for row in purchase_rows:
        rows.append({
            "rank": len(rows) + 1,
            "source_rank": row["rank"],
            "bucket": "direct",
            "unit_count": 1,
            "amount_cumulative_yen": (len(rows) + 1) * STAKE_YEN,
            "signature": row["signature"],
            "picks": row["picks"],
            "proxy_score": row["proxy_score"],
            "note": "重複なしの直接購入行。1行を1口だけ買う。",
        })
    return rows


def write_purchase_csv(csv_path: Path, rows: list[dict[str, object]], aliases: tuple[str, ...]) -> None:
    with csv_path.open("w", newline="", encoding="utf-8-sig") as output:
        writer = csv.writer(output, lineterminator="\n")
        writer.writerow([
            "rank",
            "amount_cumulative_yen",
            "pick_list",
            *[match_label(match) for match in MATCHES_1637],
            "signature",
            *[f"match_{index}" for index in range(1, 14)],
            "bucket",
            "source_rank",
            "unit_count",
            "proxy_score",
            "note",
        ])
        for row in rows:
            picks = tuple(str(item) for item in row["picks"])
            writer.writerow([
                row["rank"],
                row["amount_cumulative_yen"],
                compact_pick_list(picks),
                *[outcome_label(match, picks[index]) for index, match in enumerate(MATCHES_1637)],
                row["signature"],
                *picks,
                row["bucket"],
                row["source_rank"],
                row["unit_count"],
                f"{float(row['proxy_score']):.6f}",
                row["note"],
            ])
    copy_report_aliases(csv_path, OUT_CSV_DIR, PUBLIC_DIR, aliases)


def write_longshot_insurance_csv(csv_path: Path, aliases: tuple[str, ...]) -> None:
    with csv_path.open("w", newline="", encoding="utf-8-sig") as output:
        writer = csv.writer(output, lineterminator="\n")
        writer.writerow([
            "plan_label",
            "base_plan",
            "unit_count",
            "cost_yen",
            *[match_label(match) for match in MATCHES_1637],
            *[f"match_{index}" for index in range(1, 14)],
            "trigger",
            "note",
        ])
        for plan in LONGSHOT_INSURANCE_PLANS_1637:
            choices = tuple(str(choice) for choice in plan["choices"])
            units = multi_plan_units(plan)
            writer.writerow([
                plan["label"],
                plan["base"],
                units,
                units * STAKE_YEN,
                *[choices[index] for index in range(13)],
                *choices,
                "M01 Ecuador win market-over-public insurance",
                plan["note"],
            ])
    copy_report_aliases(csv_path, OUT_CSV_DIR, PUBLIC_DIR, aliases)


def build_csv() -> dict[str, Path]:
    OUT_CSV_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    csv_50_path = OUT_CSV_DIR / CSV_50_NAME
    csv_path = OUT_CSV_DIR / CSV_NAME
    csv_200_path = OUT_CSV_DIR / CSV_200_NAME
    longshot_csv_path = OUT_CSV_DIR / LONGSHOT_INSURANCE_CSV_NAME

    write_purchase_csv(csv_50_path, entry_rows_1637(PURCHASE_ROWS_1637_50), CSV_50_ALIASES)
    write_purchase_csv(csv_path, entry_rows_1637(PURCHASE_ROWS_1637), CSV_ALIASES)
    write_purchase_csv(csv_200_path, entry_rows_1637(PURCHASE_ROWS_1637_200), CSV_200_ALIASES)
    write_longshot_insurance_csv(longshot_csv_path, LONGSHOT_INSURANCE_CSV_ALIASES)

    return {
        "all_50": csv_50_path,
        "all": csv_path,
        "all_200": csv_200_path,
        "longshot": longshot_csv_path,
    }


def main() -> None:
    pdf_path = build_pdf()
    csv_paths = build_csv()
    print(f"PDF: {pdf_path}")
    print(f"CSV_50: {csv_paths['all_50']}")
    print(f"CSV: {csv_paths['all']}")
    print(f"CSV_200: {csv_paths['all_200']}")
    print(f"CSV_LONGSHOT: {csv_paths['longshot']}")
    print(f"purchase_rows={len(PURCHASE_ROWS_1636)} units={sum(int(row['units']) for row in PURCHASE_ROWS_1636)}")
    print(f"purchase_rows_1637_50={len(PURCHASE_ROWS_1637_50)} units={sum(int(row['units']) for row in PURCHASE_ROWS_1637_50)}")
    print(f"purchase_rows_1637={len(PURCHASE_ROWS_1637)} units={sum(int(row['units']) for row in PURCHASE_ROWS_1637)}")
    print(f"purchase_rows_1637_200={len(PURCHASE_ROWS_1637_200)} units={sum(int(row['units']) for row in PURCHASE_ROWS_1637_200)}")
    print(f"recommended_units={sum(int(row['units']) for row in recommended_entries())}")
    print(f"recommended_ev={plan_ev_summary(recommended_entries())['ev_multiple']:.4f}")


if __name__ == "__main__":
    main()
