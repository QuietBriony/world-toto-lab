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

const commonUnresolvedRules = [
  "2等以下の当せん金上限と端数処理を公式ルールで確認する（1等の1口上限は確定済み）",
  "各等級の繰越対象フラグを公式ルールで確認する",
  "1等上限を超過した分の行き先（次回繰越か否か）を公式ルールで確認する",
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
    ],
    ticketPriceYen: 300,
    tiers: [
      tier({ allocationShare: 0.76, capYen: 600_000_000, missedCount: 0, odds: 4_782_969, tierName: "1等" }),
      tier({ allocationShare: 0.09, missedCount: 1, odds: 170_820, tierName: "2等" }),
      tier({ allocationShare: 0.02, missedCount: 2, odds: 13_140, tierName: "3等" }),
      tier({ allocationShare: 0.04, missedCount: 3, odds: 1_643, tierName: "4等" }),
      tier({ allocationShare: 0.04, missedCount: 4, odds: 299, tierName: "5等" }),
      tier({ allocationShare: 0.05, missedCount: 5, odds: 75, tierName: "6等" }),
    ],
    unresolvedRules: [
      ...commonUnresolvedRules,
      // 公式算式は「売上の40%＋キャリー」だが、商品ページの 1等配分76% × 還元率50% = 38% で2pt乖離する。
      // 40% が丸めなのか、還元率が52.6%なのか、1等配分が80%なのかを一次ソースで確定する。
      // 現行の真EVは 38% を採用＝1等EVが保守側（過小）に出る。MEGA BIGは 35% = 0.5×0.70 で完全一致。
      "BIGの1等原資率が公式算式の40%か、1等配分76%×還元率50%=38%かを一次ソースで確定する",
    ],
  },
  MEGA_BIG: {
    capWithoutCarryoverYen: null,
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
      // 楽天toto は「1等最高7億円」、Yahoo! toto は「7億20円」と表記が割れる（後者は表記崩れの疑い）。
      // キャリー回しか売買判断に使わないため真EVには影響しないが、確定するまで null のままにする。
      "MEGA BIGの通常時(キャリーなし)1等上限を確認する（7億円か7億2,000万円かでソースが割れている）",
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
