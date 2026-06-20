import { describe, expect, it } from "vitest";

import {
  buildWorldCupToto1636PurchaseRows,
  randomTicketHitProbability,
  worldCupToto1635Review,
  worldCupToto1636NextPlan,
  worldCupToto1636PurchaseRows,
} from "@/lib/world-cup-toto-review-plan";

describe("world cup toto review plan", () => {
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

  it("builds a 36-line core and a 200-line discussion sheet for 1636", () => {
    const signatures = new Set(worldCupToto1636PurchaseRows.map((row) => row.signature));

    expect(worldCupToto1636NextPlan.coreLineCount).toBe(36);
    expect(worldCupToto1636NextPlan.recommendedBudgetYen).toBe(3_600);
    expect(worldCupToto1636PurchaseRows).toHaveLength(200);
    expect(signatures.size).toBe(200);
    expect(worldCupToto1636PurchaseRows.slice(0, 36).every((row) => row.bucket === "core")).toBe(true);
    expect(buildWorldCupToto1636PurchaseRows(36).every((row) => row.bucket === "core")).toBe(true);
  });
});
