import { describe, expect, it } from "vitest";

import {
  calculateNoVigProbabilities,
  decimalOddsToImpliedProbability,
} from "@/lib/odds";

describe("odds helpers", () => {
  it("converts decimal odds to implied probability", () => {
    expect(decimalOddsToImpliedProbability(2)).toBe(0.5);
    expect(decimalOddsToImpliedProbability(4)).toBe(0.25);
  });

  it("rejects invalid decimal odds", () => {
    expect(decimalOddsToImpliedProbability(null)).toBeNull();
    expect(decimalOddsToImpliedProbability(1)).toBeNull();
    expect(decimalOddsToImpliedProbability(Number.NaN)).toBeNull();
  });

  it("normalizes a 1X2 odds triplet into no-vig market probabilities", () => {
    const result = calculateNoVigProbabilities({
      odds1: 2,
      odds0: 3.5,
      odds2: 4,
    });

    expect(result.bookSum).toBeCloseTo(1 / 2 + 1 / 3.5 + 1 / 4, 8);
    expect(result.overround).toBeCloseTo(result.bookSum! - 1, 8);
    expect(result.marketProb1! + result.marketProb0! + result.marketProb2!).toBeCloseTo(1, 8);
    expect(result.marketProb1).toBeGreaterThan(result.marketProb2!);
    expect(result.warnings).toEqual([]);
  });

  it("returns null probabilities when any outcome price is missing", () => {
    const result = calculateNoVigProbabilities({
      odds1: 2,
      odds0: null,
      odds2: 4,
    });

    expect(result.marketProb1).toBeNull();
    expect(result.marketProb0).toBeNull();
    expect(result.marketProb2).toBeNull();
    expect(result.warnings).toContain("decimal odds must be finite numbers greater than 1.");
  });

  it("warns when the book sum is unusually high", () => {
    const result = calculateNoVigProbabilities({
      odds1: 1.3,
      odds0: 2,
      odds2: 2,
    });

    expect(result.overround).toBeGreaterThan(0.2);
    expect(result.warnings).toContain(
      "book sum is high; no-vig probabilities may be noisy for this market.",
    );
  });
});
