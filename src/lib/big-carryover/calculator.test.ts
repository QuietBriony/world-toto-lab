import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  bigTrueEvStatusLabel,
  calculateBigCarryover,
} from "@/lib/big-carryover/calculator";

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
