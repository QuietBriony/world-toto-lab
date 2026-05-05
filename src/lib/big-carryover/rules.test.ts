import { describe, expect, it } from "vitest";

import {
  BIG_TRUE_EV_REQUIRED_RULE_FIELDS,
  bigOfficialRuleProfiles,
  buildCalculatorPrizeTiersIfReady,
  getBigOfficialRuleProfile,
  getBigTrueEvRuleReadiness,
} from "@/lib/big-carryover/rules";
import type { BigCarryoverProductType } from "@/lib/big-carryover/calculator";

function allocationSum(productType: Exclude<BigCarryoverProductType, "custom">) {
  return bigOfficialRuleProfiles[productType].tiers.reduce(
    (total, tier) => total + tier.allocationShare,
    0,
  );
}

describe("BIG official rule profiles", () => {
  it("captures BIG and 100 yen BIG core official product fields", () => {
    expect(bigOfficialRuleProfiles.BIG.ticketPriceYen).toBe(300);
    expect(bigOfficialRuleProfiles.BIG.matchCount).toBe(14);
    expect(bigOfficialRuleProfiles.BIG.outcomeChoiceCount).toBe(3);
    expect(bigOfficialRuleProfiles.BIG.firstPrizeOdds).toBe(3 ** 14);
    expect(bigOfficialRuleProfiles.BIG.firstPrizeCapYen).toBe(600_000_000);

    expect(bigOfficialRuleProfiles["100YEN_BIG"].ticketPriceYen).toBe(100);
    expect(bigOfficialRuleProfiles["100YEN_BIG"].matchCount).toBe(14);
    expect(bigOfficialRuleProfiles["100YEN_BIG"].firstPrizeOdds).toBe(3 ** 14);
    expect(bigOfficialRuleProfiles["100YEN_BIG"].firstPrizeCapYen).toBe(200_000_000);
  });

  it("captures MEGA BIG as partner-reference material until official rule confirmation is complete", () => {
    expect(bigOfficialRuleProfiles.MEGA_BIG.sourceStatus).toBe("partner_reference");
    expect(bigOfficialRuleProfiles.MEGA_BIG.ticketPriceYen).toBe(300);
    expect(bigOfficialRuleProfiles.MEGA_BIG.matchCount).toBe(12);
    expect(bigOfficialRuleProfiles.MEGA_BIG.outcomeChoiceCount).toBe(4);
    expect(bigOfficialRuleProfiles.MEGA_BIG.firstPrizeOdds).toBe(4 ** 12);
    expect(bigOfficialRuleProfiles.MEGA_BIG.firstPrizeCapYen).toBe(1_200_000_000);
  });

  it("keeps prize allocation shares normalized within each captured profile", () => {
    expect(allocationSum("BIG")).toBeCloseTo(1, 6);
    expect(allocationSum("MEGA_BIG")).toBeCloseTo(1, 6);
    expect(allocationSum("100YEN_BIG")).toBeCloseTo(1, 6);
  });

  it("requires operational rule confirmation before calculator tiers can make true EV complete", () => {
    const productTypes: BigCarryoverProductType[] = [
      "BIG",
      "MEGA_BIG",
      "100YEN_BIG",
      "custom",
    ];

    productTypes.forEach((productType) => {
      const profile = getBigOfficialRuleProfile(productType);

      expect(getBigTrueEvRuleReadiness(profile)).not.toBe("ready_for_formula_spike");
      expect(buildCalculatorPrizeTiersIfReady(productType)).toBeNull();
    });
  });

  it("documents the required fields for a future true EV implementation gate", () => {
    expect(BIG_TRUE_EV_REQUIRED_RULE_FIELDS).toContain("tierCarryoverEligibility");
    expect(BIG_TRUE_EV_REQUIRED_RULE_FIELDS).toContain("carryoverContinuationRule");
    expect(BIG_TRUE_EV_REQUIRED_RULE_FIELDS).toContain("voidOrMinimumMatchRule");
    expect(BIG_TRUE_EV_REQUIRED_RULE_FIELDS).toContain("specialRoundOverrideRule");
  });
});
