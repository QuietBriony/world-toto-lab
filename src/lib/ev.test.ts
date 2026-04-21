import { describe, expect, it } from "vitest";

import {
  calculateEstimatedPayout,
  calculateExpectedOtherWinners,
  calculateProxyScore,
  calculateTicketEv,
} from "@/lib/ev";
import type { RoundEvAssumption } from "@/lib/types";

function buildAssumption(overrides: Partial<RoundEvAssumption> = {}): RoundEvAssumption {
  return {
    id: "assumption-1",
    roundId: "round-1",
    stakeYen: 100,
    totalSalesYen: 10_000_000,
    returnRate: 0.5,
    firstPrizeShare: 0.7,
    carryoverYen: 0,
    payoutCapYen: null,
    note: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ev", () => {
  it("calculates combo probabilities and evMultiple from products", () => {
    const result = calculateTicketEv({
      assumption: buildAssumption(),
      selectedModelProbabilities: [0.5, 0.2, 0.1],
      selectedOfficialProbabilities: [0.4, 0.25, 0.1],
    });

    expect(result.pModelCombo).toBeCloseTo(0.01);
    expect(result.pPublicCombo).toBeCloseTo(0.01);
    expect(result.evMultiple).toBeCloseTo(0.3497, 4);
  });

  it("calculates expected other winners", () => {
    const expectedOtherWinners = calculateExpectedOtherWinners({
      pPublicCombo: 0.01,
      totalSalesYen: 10_000_000,
      stakeYen: 100,
    });

    expect(expectedOtherWinners).toBeCloseTo(999.99, 2);
  });

  it("reflects carryover in payout", () => {
    const payout = calculateEstimatedPayout({
      assumption: buildAssumption({
        carryoverYen: 5_000_000,
      }),
      pPublicCombo: 0.01,
    });

    expect(payout).toBeCloseTo(8_491.59, 1);
  });

  it("applies payout cap", () => {
    const payout = calculateEstimatedPayout({
      assumption: buildAssumption({
        payoutCapYen: 50_000,
      }),
      pPublicCombo: 0.00001,
    });

    expect(payout).toBe(50_000);
  });

  it("returns proxy-only ev when totalSalesYen is missing", () => {
    const result = calculateTicketEv({
      assumption: buildAssumption({
        totalSalesYen: null,
      }),
      selectedModelProbabilities: [0.4, 0.3],
      selectedOfficialProbabilities: [0.35, 0.2],
    });

    expect(result.strictAvailable).toBe(false);
    expect(result.evMultiple).toBeNull();
    expect(result.pModelCombo).toBeCloseTo(0.12);
    expect(result.pPublicCombo).toBeCloseTo(0.07);
  });

  it("calculates proxy score from model, public, and human alignment", () => {
    const proxy = calculateProxyScore({
      humanAlignmentScore: 0.6,
      selectedOfficialProbabilities: [0.6, 0.2],
      selectedScoringProbabilities: [0.4, 0.3],
      selectedModelProbabilities: [0.4, 0.3],
      upsetPenalty: 0.5,
    });

    expect(proxy).toBeGreaterThan(-3);
    expect(proxy).toBeLessThan(5);
  });
});
