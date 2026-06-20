from __future__ import annotations

from itertools import product
from math import comb
from pathlib import Path
import csv
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
PDF_NAME = "world-cup-toto-1635-review-1636-plan.pdf"
CSV_NAME = "world-cup-toto-1636-20000-plan.csv"
OUT_PDF_DIR = ROOT / "output" / "pdf"
OUT_CSV_DIR = ROOT / "output" / "purchase-sheets"
PUBLIC_DIR = ROOT / "public" / "reports"

STAKE_YEN = 100
OUTCOMES = ("1", "0", "2")
TOTO13_OUTCOME_COUNT = 3**13

SOURCE_1635_RESULT_URL = (
    "https://sp.toto-dream.com/dcs/subos/screen/si04/ssin007/"
    "PGSSIN00701FwdLotDetailRslttoto.form?holdCntId=1635&commodityId=01&meetingFiscalYear=2026"
)
SOURCE_1635_VOTE_URL = (
    "https://sp.toto-dream.com/dcs/subos/screen/si01/ssin025/"
    "PGSSIN02501InitVoteTotoSP.form?meetingFiscalYear=2026&commodityId=01&holdCntId=1635"
    "&gameAssortment=A&fromId=SSIN008"
)
SOURCE_1636_SALES_URL = (
    "https://sp.toto-dream.com/dcs/subos/screen/si01/ssin025/"
    "PGSSIN02501ForwardSalesTermtotoSP.form?holdCntId=1636"
)
SOURCE_1636_VOTE_URL = (
    "https://sp.toto-dream.com/dcs/subos/screen/si01/ssin025/"
    "PGSSIN02501ForwardVotetotoSP.form?commodityId=01&fromId=SSIN026&gameAssortment=A&holdCntId=1636"
)
SOURCE_MULTI_RANDOM_URL = "https://store.toto-dream.com/guide/pc/store_multi_random.html"

MATCHES_1635 = [
    (1, "フランス", "セネガル", "3-1", "1", (0.6976, 0.2124, 0.0900)),
    (2, "アルゼンチン", "アルジェリア", "3-0", "1", (0.7537, 0.1739, 0.0724)),
    (3, "イングランド", "クロアチア", "4-2", "1", (0.4683, 0.3323, 0.1994)),
    (4, "メキシコ", "韓国", "1-0", "1", (0.5117, 0.3079, 0.1804)),
    (5, "スコットランド", "モロッコ", "0-1", "2", (0.1128, 0.2082, 0.6790)),
    (6, "オーストリア", "ヨルダン", "3-1", "1", (0.7437, 0.1862, 0.0701)),
    (7, "ウズベキスタン", "コロンビア", "1-3", "2", (0.0653, 0.1818, 0.7529)),
    (8, "チェコ", "南アフリカ", "1-1", "0", (0.5331, 0.2887, 0.1782)),
    (9, "カナダ", "カタール", "6-0", "1", (0.5909, 0.2792, 0.1299)),
    (10, "ブラジル", "ハイチ", "3-0", "1", (0.9322, 0.0473, 0.0205)),
    (11, "ポルトガル", "コンゴ民主共和国", "1-1", "0", (0.8590, 0.1006, 0.0404)),
    (12, "ガーナ", "パナマ", "1-0", "1", (0.4409, 0.2991, 0.2600)),
    (13, "スイス", "ボスニア・ヘルツェゴビナ", "4-1", "1", (0.5941, 0.2729, 0.1330)),
]

MATCHES_1636 = [
    (1, "ドイツ", "コートジボワール", "06/21 05:00", (0.7224, 0.2051, 0.0725), ("1",), "70%超の勝ち固定"),
    (2, "チュニジア", "日本", "06/21 13:00", (0.0783, 0.2260, 0.6957), ("2", "0"), "日本勝ち軸+ドロー"),
    (3, "アルゼンチン", "オーストリア", "06/23 02:00", (0.7660, 0.1774, 0.0566), ("1",), "70%超の勝ち固定"),
    (4, "パナマ", "クロアチア", "06/24 08:00", (0.0441, 0.1333, 0.8226), ("2",), "80%超のアウェイ固定"),
    (5, "コロンビア", "コンゴ民主共和国", "06/24 11:00", (0.7159, 0.2192, 0.0649), ("1",), "70%超の勝ち固定"),
    (6, "オランダ", "スウェーデン", "06/21 02:00", (0.4994, 0.3155, 0.1851), ("1", "0", "2"), "割れる試合は全分散"),
    (7, "ウルグアイ", "カーボベルデ", "06/22 07:00", (0.7186, 0.2203, 0.0611), ("1",), "70%超の勝ち固定"),
    (8, "ノルウェー", "セネガル", "06/23 09:00", (0.4508, 0.2922, 0.2570), ("1", "0", "2"), "30%帯が散るので全分散"),
    (9, "ポルトガル", "ウズベキスタン", "06/24 02:00", (0.8086, 0.1461, 0.0453), ("1",), "80%超の勝ち固定"),
    (10, "ヨルダン", "アルジェリア", "06/23 12:00", (0.1467, 0.3327, 0.5206), ("2", "0"), "アウェイ勝ち軸+ドロー"),
    (11, "スペイン", "サウジアラビア", "06/22 01:00", (0.8364, 0.1233, 0.0403), ("1",), "80%超の勝ち固定"),
    (12, "イングランド", "ガーナ", "06/24 05:00", (0.8450, 0.1147, 0.0403), ("1",), "80%超の勝ち固定"),
    (13, "エクアドル", "キュラソー", "06/21 09:00", (0.8444, 0.1148, 0.0408), ("1",), "80%超の勝ち固定"),
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
PAGE_W, PAGE_H = landscape(A4)

INK = colors.HexColor("#0f172a")
MUTED = colors.HexColor("#64748b")
TEAL = colors.HexColor("#0f766e")
TEAL_LIGHT = colors.HexColor("#ccfbf1")
AMBER_LIGHT = colors.HexColor("#fef3c7")
SLATE_LIGHT = colors.HexColor("#f8fafc")
BORDER = colors.HexColor("#cbd5e1")


def yen(value: float | int) -> str:
    return f"{round(value):,}円"


def pct(value: float, digits: int = 2) -> str:
    return f"{value * 100:.{digits}f}%"


def favorite(votes: tuple[float, float, float]) -> str:
    return max(zip(OUTCOMES, votes, strict=True), key=lambda item: item[1])[0]


def signature(outcomes: list[str] | tuple[str, ...]) -> str:
    return "".join(outcomes)


def miss_count(left: str, right: str) -> int:
    return sum(1 for left_char, right_char in zip(left, right, strict=True) if left_char != right_char)


def random_probability(ticket_count: int, max_misses: int) -> float:
    ways = sum(comb(13, misses) * (2**misses) for misses in range(max_misses + 1))
    per_ticket = ways / TOTO13_OUTCOME_COUNT
    return 1 - (1 - per_ticket) ** ticket_count


def outcome_probability(outcome: str, votes: tuple[float, float, float]) -> float:
    return votes[OUTCOMES.index(outcome)]


def row_probability(row: tuple[str, ...]) -> float:
    probability = 1.0
    for index, outcome in enumerate(row):
        probability *= outcome_probability(outcome, MATCHES_1636[index][4])
    return probability


def build_core_rows() -> list[tuple[str, ...]]:
    rows = [()]
    for match in MATCHES_1636:
        allowed = match[5]
        rows = [row + (outcome,) for row in rows for outcome in allowed]
    return rows


def build_purchase_rows(limit: int = 200) -> list[dict[str, object]]:
    core_rows = build_core_rows()
    core_signatures = {signature(row) for row in core_rows}
    rows_by_signature = {signature(row): row for row in core_rows}

    for row in core_rows:
        for match_index, match in enumerate(MATCHES_1636):
            allowed = set(match[5])
            for outcome in OUTCOMES:
                if outcome in allowed:
                    continue
                next_row = list(row)
                next_row[match_index] = outcome
                rows_by_signature[signature(tuple(next_row))] = tuple(next_row)

    rows = sorted(
        rows_by_signature.values(),
        key=lambda row: (
            0 if signature(row) in core_signatures else 1,
            -row_probability(row),
            signature(row),
        ),
    )

    return [
        {
            "rank": index + 1,
            "bucket": "core" if signature(row) in core_signatures else "hedge",
            "amount_cumulative_yen": (index + 1) * STAKE_YEN,
            "signature": signature(row),
            "picks": row,
            "note": "推奨コア" if signature(row) in core_signatures else "追加ヘッジ",
        }
        for index, row in enumerate(rows[:limit])
    ]


ACTUAL_1635 = signature([match[4] for match in MATCHES_1635])
FAVORITE_1635 = signature([favorite(match[5]) for match in MATCHES_1635])
FAVORITE_1635_MISSES = miss_count(ACTUAL_1635, FAVORITE_1635)
PURCHASE_ROWS_1636 = build_purchase_rows()


def styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "title",
            parent=base["Title"],
            fontName=FONT_BOLD,
            fontSize=22,
            leading=28,
            textColor=INK,
            spaceAfter=7 * mm,
            alignment=TA_LEFT,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontName=FONT_BOLD,
            fontSize=14,
            leading=18,
            textColor=INK,
            spaceBefore=2 * mm,
            spaceAfter=3 * mm,
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=9.2,
            leading=14,
            textColor=INK,
            spaceAfter=2.5 * mm,
        ),
        "small": ParagraphStyle(
            "small",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=7.6,
            leading=10.4,
            textColor=MUTED,
        ),
    }


STYLES = styles()


def p(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text.replace("\n", "<br/>"), STYLES[style])


def table(data: list[list[object]], col_widths: list[float], header_rows: int = 1) -> Table:
    wrapped = [
        [
            cell
            if hasattr(cell, "wrap")
            else p(str(cell), "small" if row_index >= header_rows else "body")
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
                ("FONTSIZE", (0, 0), (-1, -1), 7.7),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 0), (-1, 0), TEAL),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SLATE_LIGHT]),
                ("GRID", (0, 0), (-1, -1), 0.35, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return result


def summary_table() -> Table:
    data = [
        ["問い", "今の答え"],
        ["一口いくら?", yen(STAKE_YEN)],
        ["1635回の人気順は?", f"{FAVORITE_1635}。実結果 {ACTUAL_1635} に対して2試合ズレで3等 {yen(220)}"],
        ["10口や2万円ランダムは?", f"200口でも1等は {pct(random_probability(200, 0), 4)}、3等以上は {pct(random_probability(200, 2), 2)}"],
        ["1636回を買うなら?", "推奨コア36口=3,600円。20,000円CSVは議論用上限で、全買い推奨ではない"],
        ["買い方は?", "同じ出目を重ねず、1通り1口のバラ。強人気固定、割れる試合だけ分散"],
    ]
    result = table(data, [52 * mm, 205 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), TEAL_LIGHT)]))
    return result


def result_1635_table() -> Table:
    rows = [["No", "試合", "結果", "実出目", "人気出目", "ズレ"]]
    for match_no, home, away, score, actual, votes in MATCHES_1635:
        popular = favorite(votes)
        rows.append(
            [
                match_no,
                f"{home} vs {away}",
                score,
                actual,
                popular,
                "ズレ" if actual != popular else "",
            ]
        )
    return table(rows, [12 * mm, 86 * mm, 22 * mm, 22 * mm, 24 * mm, 22 * mm])


def random_table() -> Table:
    rows = [["購入", "費用", "1等", "2等以上", "3等以上"]]
    for line_count in [1, 10, 100, 200]:
        rows.append(
            [
                f"{line_count}口",
                yen(line_count * STAKE_YEN),
                pct(random_probability(line_count, 0), 5),
                pct(random_probability(line_count, 1), 3),
                pct(random_probability(line_count, 2), 2),
            ]
        )
    return table(rows, [30 * mm, 36 * mm, 48 * mm, 48 * mm, 48 * mm])


def policy_table() -> Table:
    rows = [["No", "試合", "公式投票 1/0/2", "残す出目", "ルール"]]
    for match_no, home, away, kickoff, votes, allowed, rule in MATCHES_1636:
        rows.append(
            [
                match_no,
                f"{home} vs {away}\n{kickoff}",
                " / ".join(pct(vote, 1) for vote in votes),
                "".join(allowed),
                rule,
            ]
        )
    return table(rows, [11 * mm, 60 * mm, 45 * mm, 24 * mm, 55 * mm])


def purchase_preview_table() -> Table:
    left_rows = PURCHASE_ROWS_1636[:18]
    right_rows = PURCHASE_ROWS_1636[18:36]
    rows = [["順位", "買い目", "累計", "順位", "買い目", "累計"]]
    for index in range(18):
        left = left_rows[index]
        right = right_rows[index]
        rows.append(
            [
                left["rank"],
                left["signature"],
                yen(int(left["amount_cumulative_yen"])),
                right["rank"],
                right["signature"],
                yen(int(right["amount_cumulative_yen"])),
            ]
        )
    return table(rows, [15 * mm, 54 * mm, 28 * mm, 15 * mm, 54 * mm, 28 * mm])


def build_pdf() -> Path:
    OUT_PDF_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    pdf_path = OUT_PDF_DIR / PDF_NAME
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=landscape(A4),
        rightMargin=14 * mm,
        leftMargin=14 * mm,
        topMargin=12 * mm,
        bottomMargin=10 * mm,
        title="W杯toto 1635総括と1636購入候補",
    )

    story = [
        p("W杯toto 1635総括と1636購入候補", "title"),
        p("結論だけ。1口100円、買うなら同じ出目を重ねず1通り1口。期待値プラスは未証明なので、1636回は36口=3,600円をコア推奨、20,000円CSVは議論用上限です。"),
        summary_table(),
        Spacer(1, 5 * mm),
        p("今回の前提", "h2"),
        p("第1635回は公式の販売終了時点投票と速報結果を突き合わせました。第1636回は2026-06-20 14:51時点の公式投票と、同日19:00締切を前提にしています。"),
        p("注意: この資料は購入判断メモであり、利益や当選を保証しません。CSVは公式入稿形式ではなく、転記と感想戦のための買い目表です。", "small"),
        PageBreak(),
        p("第1635回 事後検証", "title"),
        p(f"実結果は {ACTUAL_1635}。販売終了時点の公式人気順は {FAVORITE_1635} で、ズレは {FAVORITE_1635_MISSES} 試合でした。つまり、人気順1口だけなら3等 {yen(220)} です。"),
        result_1635_table(),
        Spacer(1, 4 * mm),
        p("賞金: 1等 1,202,060円、2等 1,740円、3等 220円。総売上は252,729,800円、投票口数は2,527,298口です。", "small"),
        PageBreak(),
        p("ランダム購入の現実性", "title"),
        p("完全ランダムは、2万円=200口でも1等確率がかなり低いです。3等以上まで見ると話題にはできますが、当てに行く買い方としては分散の設計が必要です。"),
        random_table(),
        Spacer(1, 5 * mm),
        p("2等保証の考え方", "h2"),
        p("Haziの言う「バラ買い2等保証」は、全部ランダムに広げるのではなく、候補宇宙を絞ったうえで距離1以内を厚く覆う発想です。今回はまず強人気固定と割れる試合の分散で36口に落とし、追加ヘッジはCSVで議論できる形にしました。"),
        p("公式のマルチランダムは購入金額を指定してコンピュータに出目を選ばせる機能です。ただし、今回の推奨CSVはランダムではなく、公式投票を使った手動転記用の買い目リストです。", "small"),
        PageBreak(),
        p("第1636回 買い目方針", "title"),
        p("推奨コアは36口=3,600円。70%超の強人気は原則固定、日本戦・オランダ戦・ノルウェー戦・ヨルダン戦のような割れる面だけ残します。"),
        policy_table(),
        PageBreak(),
        p("第1636回 推奨コア36口", "title"),
        p("この36口を1口ずつバラで転記します。20,000円CSVは、この36口の後ろに追加ヘッジを164口足した議論用の上限シートです。"),
        purchase_preview_table(),
        Spacer(1, 3 * mm),
        p(f"ソース: 1635結果 {SOURCE_1635_RESULT_URL} / 1635投票 {SOURCE_1635_VOTE_URL} / 1636販売 {SOURCE_1636_SALES_URL} / 1636投票 {SOURCE_1636_VOTE_URL} / マルチランダム {SOURCE_MULTI_RANDOM_URL}", "small"),
    ]

    doc.build(story)
    public_pdf_path = PUBLIC_DIR / PDF_NAME
    shutil.copy2(pdf_path, public_pdf_path)
    return pdf_path


def build_csv() -> Path:
    OUT_CSV_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    csv_path = OUT_CSV_DIR / CSV_NAME
    with csv_path.open("w", newline="", encoding="utf-8-sig") as output:
        writer = csv.writer(output)
        writer.writerow(
            [
                "rank",
                "bucket",
                "amount_cumulative_yen",
                "signature",
                *[f"match_{index}" for index in range(1, 14)],
                "note",
            ]
        )
        for row in PURCHASE_ROWS_1636:
            writer.writerow(
                [
                    row["rank"],
                    row["bucket"],
                    row["amount_cumulative_yen"],
                    row["signature"],
                    *row["picks"],
                    row["note"],
                ]
            )

    public_csv_path = PUBLIC_DIR / CSV_NAME
    shutil.copy2(csv_path, public_csv_path)
    return csv_path


def main() -> None:
    pdf_path = build_pdf()
    csv_path = build_csv()
    print(f"PDF: {pdf_path}")
    print(f"CSV: {csv_path}")


if __name__ == "__main__":
    main()
