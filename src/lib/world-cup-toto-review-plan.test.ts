import { describe, expect, it } from "vitest";

import {
  buildWorldCupToto1636PurchaseRows,
  randomTicketHitProbability,
  worldCupToto1634Review,
  worldCupToto1635Review,
  worldCupToto1636NextPlan,
  worldCupToto1636PurchaseRows,
} from "@/lib/world-cup-toto-review-plan";

describe("world cup toto review plan", () => {
  it("captures the 1634 previous-report miss for the postmortem", () => {
    expect(worldCupToto1634Review.actualSignature).toBe("0010001001211");
    expect(worldCupToto1634Review.publicFavoriteSignature).toBe("2111112121221");
    expect(worldCupToto1634Review.publicFavoriteMisses).toBe(9);
    expect(worldCupToto1634Review.previousReportPositiveLineCount).toBe(9);
    expect(worldCupToto1634Review.previousReportBestDistance).toBe(3);
    expect(worldCupToto1634Review.previousReportTopRows[0]?.signature).toBe("0010102122211");
  });

  it("replays the 1635 public favorite postmortem", () => {
    expect(worldCupToto1635Review.actualSignature).toBe("1111212011011");
    expect(worldCupToto1635Review.publicFavoriteSignature).toBe("1111212111111");
    expect(worldCupToto1635Review.publicFavoriteMisses).toBe(2);
    expect(worldCupToto1635Review.publicFavoritePrize).toEqual({
      label: "3rd",
      payoutYen: 220,
    });
  });

  it("keeps random-ticket odds tied to the 13-match outcome space", () => {
    const exact200 = 1 - (1 - 1 / 3 ** 13) ** 200;

    expect(randomTicketHitProbability(200, 0)).toBeCloseTo(exact200, 12);
    expect(randomTicketHitProbability(200, 2)).toBeGreaterThan(0.04);
  });

  it("builds a 36-line core with hot doubles and a 20,000 yen discussion sheet for 1636", () => {
    const signatures = new Set(worldCupToto1636PurchaseRows.map((row) => row.signature));
    const unitCount = worldCupToto1636PurchaseRows.reduce((sum, row) => sum + row.unitCount, 0);

    expect(worldCupToto1636NextPlan.coreLineCount).toBe(36);
    expect(worldCupToto1636NextPlan.recommendedUnitCount).toBe(46);
    expect(worldCupToto1636NextPlan.recommendedBudgetYen).toBe(4_600);
    expect(worldCupToto1636PurchaseRows).toHaveLength(190);
    expect(signatures.size).toBe(190);
    expect(unitCount).toBe(200);
    expect(worldCupToto1636PurchaseRows.slice(0, 10).every((row) => row.bucket === "hot" && row.unitCount === 2)).toBe(true);
    expect(buildWorldCupToto1636PurchaseRows(46).reduce((sum, row) => sum + row.unitCount, 0)).toBe(46);
  });
});
