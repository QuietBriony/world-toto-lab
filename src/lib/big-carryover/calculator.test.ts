import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BIG_FIRST_PRIZE_ALLOCATION_SHARE,
  bigTrueEvStatusLabel,
  calculateBigCarryover,
  calculateBigTrueEv,
  minimumCancellationsForPositiveEv,
} from "@/lib/big-carryover/calculator";
import { bigOfficialRuleProfiles } from "@/lib/big-carryover/rules";

describe("BIG carryover calculator", () => {
  it("calculates naive carry pressure", () => {
    const result = calculateBigCarryover({
      carryoverYen: 6_299_582_550,
      currentSalesYen: 191_591_400,
      firstPrizeCapYen: 1_200_000_000,
      firstPrizeOdds: 16_777_216,
      productType: "MEGA_BIG",
      projectedFinalSalesYen: 191_591_400,
      returnRate: 0.5,
      ticketPriceYen: 300,
    });

    expect(result.naiveCarryPressure).toBeCloseTo(
      (6_299_582_550 + 191_591_400 * 0.5) / 191_591_400,
      8,
    );
    expect(result.naiveCarryPressure).toBeGreaterThan(33);
  });

  it("lowers carry pressure when projected final sales increase", () => {
    const currentSales = calculateBigCarryover({
      carryoverYen: 6_299_582_550,
      currentSalesYen: 191_591_400,
      firstPrizeCapYen: 1_200_000_000,
      firstPrizeOdds: 16_777_216,
      productType: "MEGA_BIG",
      projectedFinalSalesYen: 191_591_400,
      returnRate: 0.5,
      ticketPriceYen: 300,
    });
    const finalSales = calculateBigCarryover({
      carryoverYen: 6_299_582_550,
      currentSalesYen: 191_591_400,
      firstPrizeCapYen: 1_200_000_000,
      firstPrizeOdds: 16_777_216,
      productType: "MEGA_BIG",
      projectedFinalSalesYen: 12_000_000_000,
      returnRate: 0.5,
      ticketPriceYen: 300,
    });

    expect(finalSales.naiveCarryPressure).toBeLessThan(currentSales.naiveCarryPressure!);
  });

  it("calculates expected first prize winners from first prize odds", () => {
    const result = calculateBigCarryover({
      carryoverYen: 4_000_000_000,
      currentSalesYen: 3_000_000_000,
      firstPrizeCapYen: 600_000_000,
      firstPrizeOdds: 4_782_969,
      productType: "BIG",
      projectedFinalSalesYen: 3_000_000_000,
      returnRate: 0.5,
      ticketPriceYen: 300,
    });

    expect(result.ticketCountEstimate).toBe(10_000_000);
    expect(result.expectedFirstPrizeWinners).toBeCloseTo(10_000_000 / 4_782_969, 8);
  });

  it("calculates the probability of at least one first prize", () => {
    const result = calculateBigCarryover({
      carryoverYen: 4_000_000_000,
      currentSalesYen: 3_000_000_000,
      firstPrizeCapYen: 600_000_000,
      firstPrizeOdds: 4_782_969,
      productType: "BIG",
      projectedFinalSalesYen: 3_000_000_000,
      returnRate: 0.5,
      ticketPriceYen: 300,
    });

    expect(result.probAtLeastOneFirstPrize).toBeCloseTo(
      1 - (1 - 1 / 4_782_969) ** 10_000_000,
      8,
    );
  });

  it("returns a cap warning when a first prize cap is present", () => {
    const result = calculateBigCarryover({
      carryoverYen: 6_299_582_550,
      currentSalesYen: 191_591_400,
      firstPrizeCapYen: 1_200_000_000,
      firstPrizeOdds: 16_777_216,
      productType: "MEGA_BIG",
      projectedFinalSalesYen: 191_591_400,
      returnRate: 0.5,
      ticketPriceYen: 300,
    });

    expect(result.capAdjustedWarning).toContain("1等上限");
    expect(result.capAdjustedNaiveCarryPressure).toBeLessThan(result.naiveCarryPressure!);
  });

  it("does not mark true EV complete when tier and official rule data are missing", () => {
    const result = calculateBigCarryover({
      carryoverYen: 6_299_582_550,
      currentSalesYen: 191_591_400,
      firstPrizeCapYen: 1_200_000_000,
      firstPrizeOdds: 16_777_216,
      productType: "MEGA_BIG",
      projectedFinalSalesYen: 191_591_400,
      returnRate: 0.5,
      ticketPriceYen: 300,
    });

    expect(result.trueEvStatus).toBe("proxy_only");
    expect(bigTrueEvStatusLabel[result.trueEvStatus]).toBe("真EV未計算");
  });

  it("keeps the 3338 percent style value out of true EV", () => {
    const result = calculateBigCarryover({
      carryoverYen: 6_299_582_550,
      currentSalesYen: 191_591_400,
      firstPrizeCapYen: 1_200_000_000,
      firstPrizeOdds: 16_777_216,
      productType: "MEGA_BIG",
      projectedFinalSalesYen: 191_591_400,
      returnRate: 0.5,
      ticketPriceYen: 300,
    });

    expect(Math.round((result.naiveCarryPressure ?? 0) * 100)).toBe(3338);
    expect(bigTrueEvStatusLabel[result.trueEvStatus]).toBe("真EV未計算");
  });

  it("does not reintroduce buy-30x style wording in BIG carryover UI code", () => {
    const files = [
      "src/app/big-carryover/page.tsx",
      "src/lib/big-carryover.ts",
      "src/lib/big-official.ts",
    ];
    const joined = files
      .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
      .join("\n");

    expect(joined).not.toMatch(/買えば.{0,12}(30倍|33倍)/u);
    expect(joined).not.toMatch(/全力買い|必勝|利益保証|激アツ確定|特大上振れ候補/u);
  });
});

describe("calculateBigTrueEv（造船太郎レバー: 試合中止×キャリー）", () => {
  // 2024-08-31 第1476回 MEGA BIG 相当（台風で4試合中止・キャリー58.3億）。
  const round1476 = {
    productType: "MEGA_BIG" as const,
    carryoverYen: 5_830_000_000,
    projectedFinalSalesYen: 4_710_000_000,
    returnRate: 0.5,
    ticketPriceYen: 300,
    firstPrizeCapYen: 1_200_000_000,
  };

  it("4試合中止で1等確率が256倍・1/65536になる（MEGA BIGは×4/中止）", () => {
    const r = calculateBigTrueEv({ ...round1476, cancelledMatches: 4 });
    expect(r.cancelBoostMultiple).toBe(256);
    expect(r.adjustedFirstPrizeOdds).toBe(65_536);
    expect(r.firstPrizeWinProbability).toBeCloseTo(1 / 65_536, 10);
  });

  it("第1476回相当は +EV（trueEV>1）になり buy-in 候補として検出される", () => {
    const r = calculateBigTrueEv({ ...round1476, cancelledMatches: 4 });
    expect(r.status).toBe("positive_ev");
    expect(r.trueEvMultiple).toBeGreaterThan(1);
    // 値はハードコードせず、実例の桁（1.4〜2.1倍／1口払戻 数千万円）に収まることを確認。
    expect(r.trueEvMultiple).toBeLessThan(2.1);
    expect(r.estimatedFirstPrizePayoutYen).toBeGreaterThan(10_000_000); // 1000万超
    expect(r.estimatedFirstPrizePayoutYen).toBeLessThan(100_000_000);
  });

  it("中止が無ければ同じ大型キャリーでも +EV にならない（確率ブースト必須）", () => {
    const r = calculateBigTrueEv({ ...round1476, cancelledMatches: 0 });
    expect(r.status).toBe("sub_breakeven");
    expect(r.trueEvMultiple).toBeLessThan(1);
  });

  it("キャリーが無ければ中止4でも +EV にならない（据え置き原資必須）", () => {
    const r = calculateBigTrueEv({ ...round1476, carryoverYen: 0, cancelledMatches: 4 });
    expect(r.status).toBe("sub_breakeven");
    expect(r.trueEvMultiple).toBeLessThan(1); // ≒ 還元率どまり
  });

  it("売上が膨らむほど（同時当選増で）EVは低下する", () => {
    const early = calculateBigTrueEv({ ...round1476, projectedFinalSalesYen: 2_000_000_000, cancelledMatches: 4 });
    const late = calculateBigTrueEv({ ...round1476, projectedFinalSalesYen: 8_000_000_000, cancelledMatches: 4 });
    expect(early.trueEvMultiple!).toBeGreaterThan(late.trueEvMultiple!);
    expect(early.expectedCoWinners!).toBeLessThan(late.expectedCoWinners!);
  });

  it("5試合以上中止はくじ不成立＝全額払戻（実質EV1.0）", () => {
    const r = calculateBigTrueEv({ ...round1476, cancelledMatches: 5 });
    expect(r.status).toBe("void_refund");
    expect(r.trueEvMultiple).toBe(1);
  });

  it("通常BIGは3択ベース（×3/中止・1/3^(14-M)）", () => {
    const r = calculateBigTrueEv({
      productType: "BIG",
      carryoverYen: 2_000_000_000,
      projectedFinalSalesYen: 1_000_000_000,
      returnRate: 0.5,
      ticketPriceYen: 300,
      firstPrizeCapYen: 600_000_000,
      cancelledMatches: 3,
    });
    expect(r.cancelBoostMultiple).toBe(27); // 3^3
    expect(r.adjustedFirstPrizeOdds).toBe(3 ** 11);
  });

  it("監視シグナル: 大型キャリーは少ない中止数で+EV窓が開く / 小型キャリーは届かない", () => {
    const big = minimumCancellationsForPositiveEv(round1476); // キャリー58.3億
    expect(big).not.toBeNull();
    expect(big!).toBeGreaterThanOrEqual(1);
    expect(big!).toBeLessThanOrEqual(4);

    const tiny = minimumCancellationsForPositiveEv({ ...round1476, carryoverYen: 100_000_000 });
    expect(tiny).toBeNull(); // 中止4でも届かない
  });

  it("入力不足は真EV未計算（unavailable）", () => {
    const r = calculateBigTrueEv({
      productType: "MEGA_BIG",
      carryoverYen: null,
      projectedFinalSalesYen: 4_710_000_000,
      returnRate: 0.5,
      ticketPriceYen: 300,
      firstPrizeCapYen: 1_200_000_000,
      cancelledMatches: 4,
    });
    expect(r.status).toBe("unavailable");
    expect(r.trueEvMultiple).toBeNull();
  });

  it("既定の1等配分は公式ルール捕捉(rules.ts)の1等 allocationShare と一致する", () => {
    (["BIG", "MEGA_BIG", "100YEN_BIG"] as const).forEach((productType) => {
      const firstTier = bigOfficialRuleProfiles[productType].tiers.find(
        (tierRule) => tierRule.tierName === "1等",
      );
      expect(firstTier).toBeDefined();
      expect(BIG_FIRST_PRIZE_ALLOCATION_SHARE[productType]).toBe(firstTier!.allocationShare);
    });
  });

  it("firstPrizeShare 未指定なら暫定0.5でなく商品の公式配分(MEGA=0.70)を使う", () => {
    const withDefault = calculateBigTrueEv({ ...round1476, cancelledMatches: 4 });
    const withOfficialShare = calculateBigTrueEv({
      ...round1476,
      cancelledMatches: 4,
      firstPrizeShare: 0.7,
    });
    const withOldPlaceholder = calculateBigTrueEv({
      ...round1476,
      cancelledMatches: 4,
      firstPrizeShare: 0.5,
    });
    // 既定は公式配分0.70と一致し、旧プレースホルダ0.5とは別値になる。
    expect(withDefault.trueEvMultiple).toBeCloseTo(withOfficialShare.trueEvMultiple!, 10);
    expect(withDefault.trueEvMultiple).not.toBeCloseTo(withOldPlaceholder.trueEvMultiple!, 7);
    // 暫定文言ではなく捕捉済み配分の注記が出る。
    expect(withDefault.warnings.some((w) => w.includes("捕捉済み等級配分"))).toBe(true);
    expect(withDefault.warnings.some((w) => w.includes("暫定値"))).toBe(false);
  });

  it("中止4試合＝あと1で不成立、の overshoot 警告を出す（研究由来のvoid超過シグナル）", () => {
    const four = calculateBigTrueEv({ ...round1476, cancelledMatches: 4 });
    expect(four.warnings.some((w) => w.includes("くじ不成立") && w.includes("転落"))).toBe(true);
    const three = calculateBigTrueEv({ ...round1476, cancelledMatches: 3 });
    expect(three.warnings.some((w) => w.includes("転落"))).toBe(false);
  });
});
