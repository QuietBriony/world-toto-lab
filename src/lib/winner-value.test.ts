import { describe, expect, it } from "vitest";

import {
  buildWinnerOfficialSnapshot,
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

  it("builds a winner snapshot from official round data", () => {
    const snapshot = buildWinnerOfficialSnapshot({
      activeEdges: [
        buildEdge({
          outcome: "1",
          officialVote: 0.54,
          reasons: ["popular_overweight"],
          valueRatio: 1.02,
        }),
        buildEdge({
          outcome: "2",
          edge: 0.09,
          officialVote: 0.19,
          reasons: ["edge>=0.08", "valueRatio>=1.35"],
          valueRatio: 1.44,
        }),
      ],
      evAssumption: null,
      officialRound: {
        carryoverYen: 300_000_000,
        createdAt: "2026-04-21T00:00:00Z",
        firstPrizeShare: 0.7,
        id: "official-1",
        officialRoundName: "第1628回 WINNER",
        officialRoundNumber: 1628,
        payoutCapYen: null,
        productType: "winner",
        resultStatus: "selling",
        returnRate: 0.5,
        roundId: "round-1",
        salesEndAt: "2026-04-22T03:00:00Z",
        salesStartAt: null,
        sourceText: null,
        sourceUrl: null,
        stakeYen: 100,
        totalSalesYen: 2_000_000_000,
        updatedAt: "2026-04-21T00:00:00Z",
      },
    });

    expect(snapshot.sourceKind).toBe("official");
    expect(snapshot.officialFavorite?.outcome).toBe("1");
    expect(snapshot.topValueEdge?.outcome).toBe("2");
    expect(snapshot.estimatedPoolYen).toBe(1_000_000_000);
  });

  it("prefers a meaningful EV assumption over the official snapshot", () => {
    const snapshot = buildWinnerOfficialSnapshot({
      activeEdges: [buildEdge({ outcome: "0", officialVote: 0.26, reasons: ["draw_alert"] })],
      evAssumption: {
        carryoverYen: 500_000_000,
        createdAt: "2026-04-21T00:00:00Z",
        firstPrizeShare: 0.7,
        id: "ev-1",
        note: "manual override",
        payoutCapYen: null,
        returnRate: 0.5,
        roundId: "round-1",
        stakeYen: 100,
        totalSalesYen: 1_500_000_000,
        updatedAt: "2026-04-21T00:00:00Z",
      },
      officialRound: null,
    });

    expect(snapshot.sourceKind).toBe("analysis");
    expect(snapshot.hasAnalysisOverride).toBe(true);
    expect(snapshot.totalSalesYen).toBe(1_500_000_000);
    expect(snapshot.estimatedPoolYen).toBe(1_025_000_000);
  });
});
