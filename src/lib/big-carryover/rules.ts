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

const commonUnresolvedRules = [
  "当せん等級ごとの上限と端数処理を公式ルールで確認する",
  "各等級の繰越対象フラグを公式ルールで確認する",
  "中止・不成立・最低成立試合数が等級判定と繰越に与える影響を確認する",
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
    unresolvedRules: [...commonUnresolvedRules],
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
      "MEGA BIGの通常時1等上限を公式商品ページまたは約款で確認する",
      "MEGA BIGの商品ページ相当の公式一次ソースで配分割合を再確認する",
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
