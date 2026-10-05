import type { BigCarryoverProductType, BigPrizeTier } from "@/lib/big-carryover/calculator";

export type BigRuleSourceStatus =
  | "official_confirmed"
  | "partner_reference"
  | "conflict_requires_confirmation";

export type BigRuleSource = {
  checkedOn: string;
  label: string;
  note: string;
  url: string;
};

export type CapturedBigPrizeTierRule = {
  allocationShare: number;
  capYen: number | null;
  carryoverEligible: boolean | null;
  missedCount: number;
  odds: number;
  tierName: string;
};

export type BigOfficialRuleProfile = {
  capWithoutCarryoverYen: number | null;
  exactCombinationCount: number;
  firstPrizeCapYen: number | null;
  firstPrizeOdds: number;
  matchCount: number;
  outcomeChoiceCount: number;
  productType: BigCarryoverProductType;
  returnRate: number;
  sourceStatus: BigRuleSourceStatus;
  sources: BigRuleSource[];
  ticketPriceYen: number;
  tiers: CapturedBigPrizeTierRule[];
  unresolvedRules: string[];
};

export type BigTrueEvRuleReadiness =
  | "not_ready"
  | "needs_rule_confirmation"
  | "ready_for_formula_spike";

type CapturedBigCarryoverProductType = Exclude<BigCarryoverProductType, "custom">;

export const BIG_TRUE_EV_REQUIRED_RULE_FIELDS = [
  "ticketPriceYen",
  "returnRate",
  "matchCount",
  "outcomeChoiceCount",
  "tierOdds",
  "tierAllocationShare",
  "tierCaps",
  "tierCarryoverEligibility",
  "carryoverContinuationRule",
  "voidOrMinimumMatchRule",
  "specialRoundOverrideRule",
] as const;

const checkedOn = "2026-05-05";

function tier(input: {
  allocationShare: number;
  capYen?: number | null;
  carryoverEligible?: boolean | null;
  missedCount: number;
  odds: number;
  tierName: string;
}): CapturedBigPrizeTierRule {
  return {
    allocationShare: input.allocationShare,
    capYen: input.capYen ?? null,
    carryoverEligible: input.carryoverEligible ?? null,
    missedCount: input.missedCount,
    odds: input.odds,
    tierName: input.tierName,
  };
}

// 2026-07-10 に確定した規程（unresolved から外したもの）:
//  - 1等上限は「按分後の1口あたり」に適用される。公式算式が
//    「(売上のうちN% + キャリーオーバー) ÷ 当せん口数 ≦ 上限額」と、不等号を除算の後ろに置く。
//  - 最低成立試合数: MEGA BIG=8試合未満、BIG・100円BIG=10試合未満 で不成立(全額払戻)。
//    → いずれも中止 M≥5 で不成立（calculator.ts の bigVoidCancelThreshold が構造から導出）。
//  - 中止試合は、どの選択肢にマークしていても全員的中扱い。
const carryoverFormulaSource: BigRuleSource = {
  checkedOn: "2026-07-10",
  label: "Yahoo! toto キャリーオーバー解説",
  note: "1等当せん金の公式算式。BIG=(売上の40%+キャリー)÷当せん口数≦6億円、MEGA BIG=(売上の35%+キャリー)÷当せん口数≦12億円。上限が1口あたり（按分後）であることを確定。キャリーオーバーなし時の1等上限も記載。",
  url: "https://toto.yahoo.co.jp/guide/carryover",
};

const voidThresholdSource: BigRuleSource = {
  checkedOn: "2026-07-10",
  label: "楽天銀行 スポーツくじFAQ（指定試合中止時の取扱い）",
  note: "中止試合は全マーク的中扱い。不成立の最低成立試合数: MEGA BIG 8試合未満 / BIG・100円BIG 10試合未満 / BIG1000 8試合未満 / mini BIG 6試合未満。",
  url: "https://toto.faq.rakuten.net/s/article/000014471",
};

// 公式の回別結果ページ（store.toto-dream.com/.../PGSPIN01401Lnk...）を過去15回ぶん取得・独立検証した
// 実データバックテスト。売上・全等級口数・当せん金・繰越から、還元率r・1等配分α・上限ロールオーバーを実測。
const backtestSource: BigRuleSource = {
  checkedOn: "2026-07-10",
  label: "公式回別結果ページ 実データバックテスト（過去15回・第1476/1625〜1638回）",
  note:
    "還元率 r=0.500（第1476回で総払戻=売上×r+キャリー、carryover→0クリアで実現EV=1.7369=0.5+C/S）。" +
    "1等配分 α: MEGA=0.70・BIG=0.80・100円=0.76（下位還元 r(1−α) と cap 超過ロールオーバーで円単位一致）。" +
    "上限超過分は翌回キャリーへロールオーバー（BIG第1630/1633回・100円第1627/1638回で円単位確認）。",
  url: "https://store.toto-dream.com/dcs/subos/screen/pi05/spin014/PGSPIN01401LnkHoldCntLotResultLstBIG.form?holdCntId=1476",
};

// 当せん金の端数処理。法令の一次ソース（法改正のお知らせ）と、300円商品が30円単位になる実測。
const payoutTruncationSource: BigRuleSource = {
  checkedOn: "2026-08-17",
  label: "toto公式『法律改正に伴う当せん金算出ルール等の変更のお知らせ』（2020-12-15）",
  note:
    "スポーツ振興投票の実施等に関する法律 第15条（端数処理）の改正。第1214回（2020-12-19 販売開始）から" +
    "「一円未満の端数を切り捨てる」→「十円未満の端数を切り捨てる」。あわせて MEGA BIG のキャリーオーバー" +
    "なし時の1等最高当せん金額が『7億2円』→『7億20円』へ変更（＝7億円ちょうどではない）。",
  url: "https://www.toto-dream.com/information/20201215.html",
};

const payoutTruncationBacktestSource: BigRuleSource = {
  checkedOn: "2026-08-17",
  label: "公式回別結果ページ 端数処理バックテスト（第1644/1645回・全等級25件）",
  note:
    "実際の切り捨て単位は **口単価÷10**（BIG/MEGA BIG=30円・100円BIG=10円）。法文の『十円』は100円口あたりの" +
    "単位で、300円の1口には3倍で効くと読むのが観測と整合する（10円単位を300円商品に当てると BIG 5等・6等等で外れる）。" +
    "2〜6等の公表当せん金25件すべてが floor(売上×還元率×等級配分÷当せん口数 ÷ 単位)×単位 と1円単位で一致。" +
    "第1645回（MEGA BIG 1口・100円BIG 2口が cap 張り付き）で、この切り捨てを入れないと翌回キャリーが +15円 / +2円 ずれる。",
  url: "https://store.toto-dream.com/dcs/subos/screen/pi05/spin014/PGSPIN01401LnkHoldCntLotResultLstBIG.form?holdCntId=1645",
};

const commonUnresolvedRules = [
  "2等以下の当せん金上限を公式ルールで確認する（端数処理は解決済み＝口単価÷10 円単位で切り捨て）",
  "各等級の繰越対象フラグを公式ルールで確認する",
  // 「1等上限超過分の行き先」は実データで解決（翌回キャリーへロールオーバー・backtestSource 参照）。
  "不成立・中止が下位等級の判定と繰越に与える影響を確認する（最低成立試合数そのものは確定済み）",
  "特別開催回の上限・配分 override を通常回と分ける",
] as const;

export const bigOfficialRuleProfiles: Record<
  CapturedBigCarryoverProductType,
  BigOfficialRuleProfile
> = {
  BIG: {
    capWithoutCarryoverYen: 300_000_000,
    exactCombinationCount: 4_782_969,
    firstPrizeCapYen: 600_000_000,
    firstPrizeOdds: 4_782_969,
    matchCount: 14,
    outcomeChoiceCount: 3,
    productType: "BIG",
    returnRate: 0.5,
    sourceStatus: "official_confirmed",
    sources: [
      {
        checkedOn,
        label: "toto official BIG product page",
        note: "Ticket price, tier definitions, theoretical odds, prize allocation, first prize caps.",
        url: "https://sp.toto-dream.com/big/about/big.html",
      },
      carryoverFormulaSource,
      voidThresholdSource,
      backtestSource,
      payoutTruncationSource,
      payoutTruncationBacktestSource,
    ],
    ticketPriceYen: 300,
    // 1等配分 0.80 は実データで確定（第1630/1633回の cap 超過ロールオーバーが円単位一致・公式算式「売上の40%」= r0.5×α0.80 と整合）。
    // 旧値0.76は下位floorを過大評価する反保守だった。
    // 下位等の内訳（0.07/0.02/0.03/0.03/0.05）も 2026-08-17 に実測確定: 端数切り捨て(30円単位)を入れると
    // 第1644/1645回の2〜6等 公表当せん金10件が1円単位で再現される（calculator.test.ts で固定）。
    tiers: [
      tier({ allocationShare: 0.8, capYen: 600_000_000, missedCount: 0, odds: 4_782_969, tierName: "1等" }),
      tier({ allocationShare: 0.07, missedCount: 1, odds: 170_820, tierName: "2等" }),
      tier({ allocationShare: 0.02, missedCount: 2, odds: 13_140, tierName: "3等" }),
      tier({ allocationShare: 0.03, missedCount: 3, odds: 1_643, tierName: "4等" }),
      tier({ allocationShare: 0.03, missedCount: 4, odds: 299, tierName: "5等" }),
      tier({ allocationShare: 0.05, missedCount: 5, odds: 75, tierName: "6等" }),
    ],
    unresolvedRules: [
      ...commonUnresolvedRules,
      // 1等原資率は実データで「売上の40%」= 還元率0.5×1等配分0.80 と確定（旧38%説は棄却）。
      // 残るのは下位等の内訳（合計0.20は確定、各等級の正確な配分は実現回1回ぶんの近似）。
      "BIG下位等（2〜6等）の各配分割合を公式一次ソースで確認する（実測では2回分の全当せん金を1円単位で再現済み・残るのは一次ソース照合のみ）",
    ],
  },
  MEGA_BIG: {
    // 7億20円。2020年の端数処理改正（1円未満→10円未満切り捨て）に伴い『7億2円』→『7億20円』へ
    // 改定されたもの（payoutTruncationSource）。「7億2,000万円」説は桁の読み違いで誤り。
    capWithoutCarryoverYen: 700_000_020,
    exactCombinationCount: 16_777_216,
    firstPrizeCapYen: 1_200_000_000,
    firstPrizeOdds: 16_777_216,
    matchCount: 12,
    outcomeChoiceCount: 4,
    productType: "MEGA_BIG",
    returnRate: 0.5,
    sourceStatus: "partner_reference",
    sources: [
      {
        checkedOn,
        label: "SMBC MEGA BIG glossary",
        note: "Partner reference for ticket price, match count, tier allocation, and theoretical odds.",
        url: "https://www.smbc.co.jp/kojin/toto/yougo/16.html",
      },
      {
        checkedOn,
        label: "toto official MEGA BIG result pages",
        note: "Result pages confirm observed sales, winners, payout, and carryover fields by round.",
        url: "https://sp.toto-dream.com/dcs/subos/screen/si05/ssin003/PGSSIN00301FwdSelectBIGSerLotDRM02.form?commodityId=14&holdCntId=1514",
      },
      carryoverFormulaSource,
      voidThresholdSource,
      {
        checkedOn: "2026-07-10",
        label: "楽天toto MEGA BIG 商品ページ",
        note: "1等配分70%を明記。キャリーオーバーあり1等最高12億円/なし7億円。公式算式の『売上の35%』= 還元率50% × 1等配分70% と一致し、配分0.70を独立に裏付ける。",
        url: "https://toto.rakuten.co.jp/big/mega/",
      },
      backtestSource,
      payoutTruncationSource,
      payoutTruncationBacktestSource,
    ],
    ticketPriceYen: 300,
    tiers: [
      tier({ allocationShare: 0.7, capYen: 1_200_000_000, missedCount: 0, odds: 16_777_216, tierName: "1等" }),
      tier({ allocationShare: 0.14, missedCount: 1, odds: 466_034, tierName: "2等" }),
      tier({ allocationShare: 0.02, missedCount: 2, odds: 28_244, tierName: "3等" }),
      tier({ allocationShare: 0.03, missedCount: 3, odds: 2_824, tierName: "4等" }),
      tier({ allocationShare: 0.05, missedCount: 4, odds: 419, tierName: "5等" }),
      tier({ allocationShare: 0.06, missedCount: 5, odds: 87, tierName: "6等" }),
    ],
    unresolvedRules: [
      ...commonUnresolvedRules,
      // 解決済み: 通常時(キャリーなし)1等上限は 7億20円。Yahoo! toto の「7億20円」が表記崩れではなく
      // 正しく、楽天totoの「7億円」が丸め表記だった（toto公式の法改正お知らせで確定・payoutTruncationSource）。
      "MEGA BIGの配分70%・還元率50%を toto公式ドメインの一次ソースで再確認する（現状はパートナー2社が一致）",
    ],
  },
  "100YEN_BIG": {
    capWithoutCarryoverYen: 100_000_000,
    exactCombinationCount: 4_782_969,
    firstPrizeCapYen: 200_000_000,
    firstPrizeOdds: 4_782_969,
    matchCount: 14,
    outcomeChoiceCount: 3,
    productType: "100YEN_BIG",
    returnRate: 0.5,
    sourceStatus: "official_confirmed",
    sources: [
      {
        checkedOn,
        label: "toto official 100 yen BIG product page",
        note: "Ticket price, tier definitions, theoretical odds, prize allocation, first prize caps.",
        url: "https://sp.toto-dream.com/big/about/100enbig.html",
      },
      carryoverFormulaSource,
      voidThresholdSource,
      backtestSource,
      payoutTruncationSource,
      payoutTruncationBacktestSource,
    ],
    ticketPriceYen: 100,
    tiers: [
      tier({ allocationShare: 0.76, capYen: 200_000_000, missedCount: 0, odds: 4_782_969, tierName: "1等" }),
      tier({ allocationShare: 0.1, missedCount: 1, odds: 170_820, tierName: "2等" }),
      tier({ allocationShare: 0.04, missedCount: 2, odds: 13_140, tierName: "3等" }),
      tier({ allocationShare: 0.04, missedCount: 3, odds: 1_643, tierName: "4等" }),
      tier({ allocationShare: 0.06, missedCount: 4, odds: 299, tierName: "5等" }),
    ],
    unresolvedRules: [...commonUnresolvedRules],
  },
};

function allocationSum(profile: BigOfficialRuleProfile) {
  return profile.tiers.reduce((total, tierRule) => total + tierRule.allocationShare, 0);
}

function hasCompleteTierOperationalRules(profile: BigOfficialRuleProfile) {
  return profile.tiers.every(
    (tierRule) => tierRule.capYen !== null && tierRule.carryoverEligible !== null,
  );
}

export function getBigOfficialRuleProfile(productType: BigCarryoverProductType) {
  if (productType === "custom") {
    return null;
  }

  return bigOfficialRuleProfiles[productType] ?? null;
}

export function getBigTrueEvRuleReadiness(
  profile: BigOfficialRuleProfile | null,
): BigTrueEvRuleReadiness {
  if (!profile) {
    return "not_ready";
  }

  if (
    profile.sourceStatus !== "official_confirmed" ||
    profile.unresolvedRules.length > 0 ||
    Math.abs(allocationSum(profile) - 1) > 0.001 ||
    !hasCompleteTierOperationalRules(profile)
  ) {
    return "needs_rule_confirmation";
  }

  return "ready_for_formula_spike";
}

export function buildCalculatorPrizeTiersIfReady(
  productType: BigCarryoverProductType,
): BigPrizeTier[] | null {
  const profile = getBigOfficialRuleProfile(productType);

  if (getBigTrueEvRuleReadiness(profile) !== "ready_for_formula_spike" || !profile) {
    return null;
  }

  return profile.tiers.map((tierRule) => ({
    allocationShare: tierRule.allocationShare,
    capYen: tierRule.capYen,
    carryoverEligible: tierRule.carryoverEligible ?? false,
    odds: tierRule.odds,
    tierName: tierRule.tierName,
  }));
}
