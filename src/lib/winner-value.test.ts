import { describe, expect, it } from "vitest";

import {
  isWinnerLikeRound,
  sortWinnerOutcomeEdges,
  summarizeWinnerOutcomeEdges,
  winnerReasonLabel,
} from "@/lib/winner-value";
import type { OutcomeEdge } from "@/lib/types";

function buildEdge(overrides: Partial<OutcomeEdge>): OutcomeEdge {
  return {
    edge: overrides.edge ?? null,
    fixture: overrides.fixture ?? "Home vs Away",
    matchId: overrides.matchId ?? "match-1",
    matchNo: overrides.matchNo ?? 1,
    marketProb: overrides.marketProb ?? null,
    modelFavorite: overrides.modelFavorite ?? false,
    modelProb: overrides.modelProb ?? null,
    officialVote: overrides.officialVote ?? null,
    outcome: overrides.outcome ?? "1",
    publicFavorite: overrides.publicFavorite ?? false,
    publicOverweight: overrides.publicOverweight ?? null,
    reasons: overrides.reasons ?? [],
    valueRatio: overrides.valueRatio ?? null,
  };
}

describe("winner value helpers", () => {
  it("detects winner-like rounds from product or single-match shape", () => {
    expect(
      isWinnerLikeRound({
        matchCount: 1,
        productType: "custom",
      }),
    ).toBe(true);

    expect(
      isWinnerLikeRound({
        matchCount: 13,
        productType: "winner",
      }),
    ).toBe(true);

    expect(
      isWinnerLikeRound({
        matchCount: 13,
        productType: "toto13",
      }),
    ).toBe(false);
  });

  it("translates known reason labels", () => {
    expect(winnerReasonLabel("valueRatio>=1.35")).toBe("倍率差");
    expect(winnerReasonLabel("popular_overweight")).toBe("人気過多");
  });

  it("prioritizes strong edge/value outcomes over overweight favorites", () => {
    const sorted = sortWinnerOutcomeEdges([
      buildEdge({
        outcome: "1",
        edge: 0.03,
        reasons: ["popular_overweight"],
        valueRatio: 1.05,
      }),
      buildEdge({
        outcome: "2",
        edge: 0.11,
        reasons: ["edge>=0.08", "valueRatio>=1.35"],
        valueRatio: 1.52,
      }),
    ]);

    expect(sorted[0]?.outcome).toBe("2");
  });

  it("summarizes edge candidates and popular overweight outcomes", () => {
    const summary = summarizeWinnerOutcomeEdges([
      buildEdge({
        outcome: "1",
        reasons: ["popular_overweight"],
        valueRatio: 1.01,
      }),
      buildEdge({
        outcome: "0",
        reasons: ["draw_alert"],
        valueRatio: 1.28,
      }),
      buildEdge({
        outcome: "2",
        edge: 0.09,
        reasons: ["edge>=0.08"],
        valueRatio: 1.41,
      }),
    ]);

    expect(summary.edgeCandidateCount).toBe(2);
    expect(summary.popularOverweightCount).toBe(1);
    expect(summary.bestValueRatio).toBe(1.41);
    expect(summary.topEdge?.outcome).toBe("2");
  });
});
