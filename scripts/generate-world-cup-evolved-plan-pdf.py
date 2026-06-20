from __future__ import annotations

from itertools import product
from math import comb
from pathlib import Path
import csv
import shutil

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
PDF_NAME = "world-cup-toto-1634-1636-evolved-plan-20260620-v2.pdf"
CSV_NAME = "world-cup-toto-1636-hot10-20000-plan-20260620-v2.csv"
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

MATCHES_1634 = [
    (1, "カタール", "スイス", "1-1", "0", (0.0512, 0.1062, 0.8426)),
    (2, "ブラジル", "モロッコ", "1-1", "0", (0.5570, 0.2589, 0.1841)),
    (3, "ドイツ", "キュラソー", "7-1", "1", (0.9526, 0.0296, 0.0178)),
    (4, "オランダ", "日本", "2-2", "0", (0.3679, 0.3095, 0.3226)),
    (5, "ベルギー", "エジプト", "1-1", "0", (0.7275, 0.1731, 0.0994)),
    (6, "カナダ", "ボスニア", "1-1", "0", (0.5050, 0.3012, 0.1938)),
    (7, "コートジボワール", "エクアドル", "1-0", "1", (0.2711, 0.3158, 0.4131)),
    (8, "スペイン", "カーボベルデ", "0-0", "0", (0.9400, 0.0406, 0.0194)),
    (9, "サウジアラビア", "ウルグアイ", "1-1", "0", (0.0782, 0.1557, 0.7661)),
    (10, "スウェーデン", "チュニジア", "5-1", "1", (0.5296, 0.2895, 0.1809)),
    (11, "ハイチ", "スコットランド", "0-1", "2", (0.0712, 0.1130, 0.8158)),
    (12, "オーストラリア", "トルコ", "2-0", "1", (0.1962, 0.2893, 0.5145)),
    (13, "アメリカ", "パラグアイ", "4-1", "1", (0.5591, 0.2620, 0.1789)),
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
    (13, "スイス", "ボスニア", "4-1", "1", (0.5941, 0.2729, 0.1330)),
]

MATCHES_1636 = [
    (1, "ドイツ", "コートジボワール", "06/21 05:00", (0.7224, 0.2051, 0.0725), ("1",), "70%超は固定"),
    (2, "チュニジア", "日本", "06/21 13:00", (0.0783, 0.2260, 0.6957), ("2", "0"), "日本勝ち軸+ドロー"),
    (3, "アルゼンチン", "オーストリア", "06/23 02:00", (0.7660, 0.1774, 0.0566), ("1",), "70%超は固定"),
    (4, "パナマ", "クロアチア", "06/24 08:00", (0.0441, 0.1333, 0.8226), ("2",), "80%超アウェイ固定"),
    (5, "コロンビア", "コンゴ民主共和国", "06/24 11:00", (0.7159, 0.2192, 0.0649), ("1",), "70%超は固定"),
    (6, "オランダ", "スウェーデン", "06/21 02:00", (0.4994, 0.3155, 0.1851), ("1", "0", "2"), "割れる試合は全分散"),
    (7, "ウルグアイ", "カーボベルデ", "06/22 07:00", (0.7186, 0.2203, 0.0611), ("1",), "70%超は固定"),
    (8, "ノルウェー", "セネガル", "06/23 09:00", (0.4508, 0.2922, 0.2570), ("1", "0", "2"), "30%帯なので全分散"),
    (9, "ポルトガル", "ウズベキスタン", "06/24 02:00", (0.8086, 0.1461, 0.0453), ("1",), "80%超は固定"),
    (10, "ヨルダン", "アルジェリア", "06/23 12:00", (0.1467, 0.3327, 0.5206), ("2", "0"), "アウェイ勝ち軸+ドロー"),
    (11, "スペイン", "サウジアラビア", "06/22 01:00", (0.8364, 0.1233, 0.0403), ("1",), "80%超は固定"),
    (12, "イングランド", "ガーナ", "06/24 05:00", (0.8450, 0.1147, 0.0403), ("1",), "80%超は固定"),
    (13, "エクアドル", "キュラソー", "06/21 09:00", (0.8444, 0.1148, 0.0408), ("1",), "80%超は固定"),
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


def actual_signature(matches: list[tuple]) -> str:
    return signature([match[4] for match in matches])


def favorite_signature(matches: list[tuple]) -> str:
    return signature([favorite(match[5]) for match in matches])


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
        rows = [row + (outcome,) for row in rows for outcome in match[5]]
    return rows


def build_purchase_rows(unit_budget: int = 200) -> list[dict[str, object]]:
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

    sorted_rows = sorted(
        rows_by_signature.values(),
        key=lambda row: (
            0 if signature(row) in core_signatures else 1,
            -row_probability(row),
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
            note = "激アツ枠。最大2口まで。"
        elif row_signature in core_signatures:
            bucket = "core"
            note = "推奨コア。1口。"
        else:
            bucket = "hedge"
            note = "追加ヘッジ。20,000円上限の議論用。"
        purchase_rows.append(
            {
                "rank": index,
                "bucket": bucket,
                "units": units,
                "amount_cumulative_yen": cumulative_units * STAKE_YEN,
                "signature": row_signature,
                "picks": row,
                "note": note,
            }
        )

    return purchase_rows


PURCHASE_ROWS_1636 = build_purchase_rows()
ACTUAL_1634 = actual_signature(MATCHES_1634)
FAVORITE_1634 = favorite_signature(MATCHES_1634)
ACTUAL_1635 = actual_signature(MATCHES_1635)
FAVORITE_1635 = favorite_signature(MATCHES_1635)


def build_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", parent=base["Title"], fontName=FONT_BOLD, fontSize=21, leading=27, textColor=INK, spaceAfter=6 * mm, alignment=TA_LEFT),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName=FONT_BOLD, fontSize=13.5, leading=17, textColor=INK, spaceBefore=2 * mm, spaceAfter=3 * mm),
        "body": ParagraphStyle("body", parent=base["BodyText"], fontName=FONT, fontSize=9.2, leading=14, textColor=INK, spaceAfter=2.5 * mm),
        "small": ParagraphStyle("small", parent=base["BodyText"], fontName=FONT, fontSize=7.4, leading=10, textColor=MUTED),
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
            cell if hasattr(cell, "wrap") else p(str(cell), "small" if row_index >= header_rows else "body")
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
                ("FONTSIZE", (0, 0), (-1, -1), 7.5),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 0), (-1, 0), TEAL),
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
    rows = [
        ["問い", "答え"],
        ["1635までは終わった?", "1634/1635とも結果あり。1635は速報扱いだが、結果・賞金・販売終了時点投票まで取れています。"],
        ["1634は当たり目を出せていた?", f"前回PDFのEV候補9本は、実結果 {ACTUAL_1634} に対して最良でも3試合ズレ。1/2/3等は出せていません。"],
        ["なぜ外れた?", "結果固定後の感想戦ロジックと、買える時点の予想ロジックが混ざった。ベルギー/スペイン/ウルグアイなど強人気の引き分けを拾い切れていない。"],
        ["1636の改善買い", "36ユニーク買い目をコアにし、激アツ上位10本だけ2口。合計46口=4,600円を推奨コアにする。"],
        ["20,000円CSV", "上位10本を2口、残りは1口。190ユニーク/200口で、転記・議論用の上限シート。"],
    ]
    result = table(rows, [38 * mm, 140 * mm])
    result.setStyle(TableStyle([("BACKGROUND", (0, 1), (0, -1), TEAL_LIGHT)]))
    return result


def automation_table() -> Table:
    rows = [
        ["方法", "使い方", "今回の評価"],
        ["買い目CSV", "このPDF/CSVの順に、公式購入画面へ手入力・転記する。unit_count=2だけ同じ買い目を2口。", "推奨。狙い筋を保てる。"],
        ["公式マルチ/ランダム", "購入金額を指定し、公式側のコンピュータに出目選択を任せる。", "楽だが、こちらの36口+hot10戦略とは別物。"],
        ["らくらく購入", "販売前または販売中の開催回を予約し、toto予想はコンピュータが行う。", "指定買い目は置けない。継続/予約向け。"],
        ["ボット購入", "ログイン、カート投入、決済を自動化する。", "対象外。実購入・認証・決済操作は人が行う。"],
    ]
    return table(rows, [30 * mm, 95 * mm, 49 * mm])


def previous_logic_table() -> Table:
    rows = [["順", "前回PDF候補", "実結果との差", "前回EV倍率"]]
    for rank, sig, misses, ev_multiple in PREVIOUS_1634_ROWS:
        rows.append([rank, sig, f"{misses}試合ズレ", f"{ev_multiple:.2f}倍"])
    return table(rows, [12 * mm, 58 * mm, 34 * mm, 30 * mm])


def mismatch_table(matches: list[tuple], title: str) -> Table:
    rows = [["No", title, "スコア", "実出目", "人気出目"]]
    for match_no, home, away, score, actual, votes in matches:
        popular = favorite(votes)
        if actual != popular:
            rows.append([match_no, f"{home} vs {away}", score, actual, popular])
    return table(rows, [10 * mm, 78 * mm, 20 * mm, 18 * mm, 18 * mm])


def random_table() -> Table:
    rows = [["購入", "費用", "1等", "2等以上", "3等以上"]]
    for line_count in [10, 46, 100, 200]:
        rows.append([f"{line_count}口", yen(line_count * STAKE_YEN), pct(random_probability(line_count, 0), 5), pct(random_probability(line_count, 1), 3), pct(random_probability(line_count, 2), 2)])
    return table(rows, [24 * mm, 30 * mm, 38 * mm, 38 * mm, 38 * mm])


def policy_table() -> Table:
    rows = [["No", "試合", "公式投票 1/0/2", "出目", "ルール"]]
    for match_no, home, away, kickoff, votes, allowed, rule in MATCHES_1636:
        rows.append([match_no, f"{home} vs {away}\n{kickoff}", " / ".join(pct(vote, 1) for vote in votes), "".join(allowed), rule])
    return table(rows, [9 * mm, 54 * mm, 37 * mm, 16 * mm, 44 * mm])


def hot_table() -> Table:
    rows = [["順", "買い目", "口数", "累計", "区分"]]
    for row in PURCHASE_ROWS_1636[:20]:
        rows.append([row["rank"], row["signature"], row["units"], yen(int(row["amount_cumulative_yen"])), row["bucket"]])
    return table(rows, [12 * mm, 58 * mm, 16 * mm, 26 * mm, 22 * mm])


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
        title="W杯toto 1634-1636 進化版購入メモ",
    )

    story = [
        p("W杯toto 1634-1636 進化版購入メモ", "title"),
        p("1634の失敗を踏まえ、1636は「強人気固定 + 割れ試合分散 + 激アツ10本だけ2口」に変えます。2口化は期待値が本当に高い時だけ効く一方、当たる範囲は広がらないため最大10本までに制限します。"),
        summary_table(),
        Spacer(1, 4 * mm),
        p("買うタイミング", "h2"),
        p("買うなら締切直前。ただし2026-06-20 19:00のネット締切に対し、公式投票を取り直してから転記する時間が必要です。目安は締切90分前から30分前。19:00を過ぎたら購入判断ではなく感想戦に切り替えます。"),
        p("なるべく自動で買う方法", "h2"),
        automation_table(),
        p("注意: この資料は購入判断メモであり、当選・利益を保証しません。CSVは公式アップロード形式ではなく、手入力/転記/感想戦用です。", "small"),
        PageBreak(),
        p("1634の反省: 当たり目は出せていなかった", "title"),
        p(f"1634実結果は {ACTUAL_1634}。1等0口でキャリー、2等7,229,170円、3等219,060円。公式人気順 {FAVORITE_1634} は9試合ズレでした。前回PDFのEV候補9本も、最良で3試合ズレです。"),
        previous_logic_table(),
        Spacer(1, 4 * mm),
        p("人気順とズレた試合", "h2"),
        mismatch_table(MATCHES_1634, "1634試合"),
        PageBreak(),
        p("1635の確認: 人気順1口なら3等", "title"),
        p(f"1635実結果は {ACTUAL_1635}。販売終了時点の人気順 {FAVORITE_1635} は2試合ズレで、1口なら3等220円でした。ここから、人気順を完全に捨てるより、強人気と割れ試合を分ける方針にします。"),
        mismatch_table(MATCHES_1635, "1635試合"),
        Spacer(1, 4 * mm),
        p("改善ルール", "h2"),
        p("1. 結果固定ロジックは感想戦専用に分ける。2. 70%超の強人気は基本固定だが、1634のような強人気ドロー事故があるので、上位10本の2口化だけに資金を寄せすぎない。3. 2等保証は候補宇宙内の話として表示し、全3^13通りを保証しているように見せない。"),
        PageBreak(),
        p("1636の買い方: 46口コア + 20,000円上限CSV", "title"),
        p("推奨コアは36ユニーク買い目に、激アツ上位10本をもう1口ずつ足した46口=4,600円。ランダム200口より、狙い筋を作ってからヘッジを足す方針です。"),
        random_table(),
        Spacer(1, 4 * mm),
        policy_table(),
        PageBreak(),
        p("1636 激アツ10本と購入シート先頭", "title"),
        p("上位10本だけ2口。11本目以降は1口です。2口化は当たった時の戻りを増やすだけで、当たる確率や2等カバー範囲は増えません。"),
        hot_table(),
        Spacer(1, 4 * mm),
        p("CSVには190ユニーク買い目/200口分を入れています。PDFでは先頭20行だけ表示し、全行はCSVで確認します。", "small"),
        p(f"ソース: 1634結果 {SOURCE_1634_RESULT_URL} / 1634投票 {SOURCE_1634_VOTE_URL} / 1635結果 {SOURCE_1635_RESULT_URL} / 1636購入画面 {SOURCE_1636_BUY_URL} / 1636投票 {SOURCE_1636_VOTE_URL}", "small"),
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
        writer.writerow(["rank", "bucket", "unit_count", "amount_cumulative_yen", "signature", *[f"match_{index}" for index in range(1, 14)], "note"])
        for row in PURCHASE_ROWS_1636:
            writer.writerow([row["rank"], row["bucket"], row["units"], row["amount_cumulative_yen"], row["signature"], *row["picks"], row["note"]])
    copy_report_aliases(csv_path, OUT_CSV_DIR, PUBLIC_DIR, CSV_ALIASES)
    return csv_path


def main() -> None:
    pdf_path = build_pdf()
    csv_path = build_csv()
    print(f"PDF: {pdf_path}")
    print(f"CSV: {csv_path}")
    print(f"purchase_rows={len(PURCHASE_ROWS_1636)} units={sum(int(row['units']) for row in PURCHASE_ROWS_1636)}")


if __name__ == "__main__":
    main()
