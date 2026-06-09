import { describe, expect, it } from "vitest";

import type { ProbabilityEngineInput } from "@/lib/probability/engine";
import { createMarketNodeFromHyperliquidUrl } from "@/lib/market-sources/hyperliquid";
import {
  applyUpstreamTeamPriors,
  calculateModelProbabilitiesWithUpstream,
  computeUpstreamTeamPriorAdjustments,
  DEFAULT_CHAMPION_BASELINE,
  MAX_TEAM_PRIOR_ADJUST,
  normalizeMarketSignal,
  teamPriorAdjustment,
} from "@/lib/market-sources/signal";
import { defaultWeightForMarketType } from "@/lib/market-sources/types";

function makeEngineInput(overrides: Partial<ProbabilityEngineInput> = {}): ProbabilityEngineInput {
  return {
    competitionType: "world_cup",
    dataProfile: "worldcup_rich",
    crowdSmoothingWeight: null,
    consensusD: null,
    consensusF: null,
    marketProb0: null,
    marketProb1: null,
    marketProb2: null,
    officialVote0: null,
    officialVote1: null,
    officialVote2: null,
    adminAdjust0: null,
    adminAdjust1: null,
    adminAdjust2: null,
    altitudeHumidityAdjust: null,
    availabilityAdjust: null,
    awayStrengthAdjust: null,
    conditionsAdjust: null,
    groupStandingMotivationAdjust: null,
    homeAdvantageAdjust: null,
    homeStrengthAdjust: null,
    injurySuspensionAdjust: null,
    leagueTableMotivationAdjust: null,
    motivationAdjust: null,
    restDaysAdjust: null,
    rotationRiskAdjust: null,
    squadDepthAdjust: null,
    tacticalAdjust: null,
    tournamentPressureAdjust: null,
    travelAdjust: null,
    travelClimateAdjust: null,
    ...overrides,
  };
}

function franceChampionNode(probability: number) {
  return createMarketNodeFromHyperliquidUrl(
    "https://app.hyperliquid.xyz/trade/2026-world-cup-champion-france-yes",
    { manualPrice: { probability }, now: "2026-06-09T00:00:00.000Z" },
  )!;
}

describe("weighting defaults", () => {
  it("uses 0.20 for outright_champion", () => {
    expect(defaultWeightForMarketType("outright_champion")).toBe(0.2);
  });

  it("uses 0.50 for group markets and 1.00 for individual match", () => {
    expect(defaultWeightForMarketType("group_winner")).toBe(0.5);
    expect(defaultWeightForMarketType("group_qualification")).toBe(0.5);
    expect(defaultWeightForMarketType("individual_match_1x2")).toBe(1.0);
    expect(defaultWeightForMarketType("player_availability")).toBe(0.3);
  });
});

describe("normalizeMarketSignal", () => {
  it("is zero at baseline, positive above, negative below, and clamped to [-1,1]", () => {
    expect(normalizeMarketSignal(DEFAULT_CHAMPION_BASELINE, DEFAULT_CHAMPION_BASELINE)).toBe(0);
    expect(normalizeMarketSignal(0.2, DEFAULT_CHAMPION_BASELINE)).toBeGreaterThan(0);
    expect(normalizeMarketSignal(0.0, DEFAULT_CHAMPION_BASELINE)).toBeLessThanOrEqual(0);
    expect(normalizeMarketSignal(0.99, DEFAULT_CHAMPION_BASELINE)).toBeLessThanOrEqual(1);
    expect(normalizeMarketSignal(0.99, DEFAULT_CHAMPION_BASELINE)).toBeGreaterThanOrEqual(-1);
  });
});

describe("teamPriorAdjustment ±0.03 cap", () => {
  it("never exceeds ±0.03 across the full probability range, even at weight 1.0", () => {
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const adj = teamPriorAdjustment({ probability: Math.min(p, 1), weight: 1.0 });
      expect(Math.abs(adj)).toBeLessThanOrEqual(MAX_TEAM_PRIOR_ADJUST + 1e-9);
    }
  });

  it("returns 0 when probability is null", () => {
    expect(teamPriorAdjustment({ probability: null, weight: 0.2 })).toBe(0);
  });

  it("is positive for a strong favorite and capped at 0.03", () => {
    const adj = teamPriorAdjustment({ probability: 0.2, weight: 0.2 });
    expect(adj).toBeGreaterThan(0);
    expect(adj).toBeLessThanOrEqual(MAX_TEAM_PRIOR_ADJUST + 1e-9);
  });
});

describe("computeUpstreamTeamPriorAdjustments", () => {
  it("nudges the home side when the champion market team is the home team", () => {
    const node = franceChampionNode(0.18);
    const result = computeUpstreamTeamPriorAdjustments(
      { homeTeam: "フランス", awayTeam: "日本" },
      [node],
    );
    expect(result.homeStrengthDelta).toBeGreaterThan(0);
    expect(result.homeStrengthDelta).toBeLessThanOrEqual(MAX_TEAM_PRIOR_ADJUST + 1e-9);
    expect(result.awayStrengthDelta).toBe(0);
    expect(result.contributions).toHaveLength(1);
    expect(result.contributions[0]?.side).toBe("home");
  });

  it("nudges the away side when the champion team plays away", () => {
    const node = franceChampionNode(0.18);
    const result = computeUpstreamTeamPriorAdjustments(
      { homeTeam: "日本", awayTeam: "フランス" },
      [node],
    );
    expect(result.awayStrengthDelta).toBeGreaterThan(0);
    expect(result.awayStrengthDelta).toBeLessThanOrEqual(MAX_TEAM_PRIOR_ADJUST + 1e-9);
    expect(result.homeStrengthDelta).toBe(0);
  });

  it("never exceeds ±0.03 per side even with multiple sources for the same team", () => {
    const nodes = [franceChampionNode(0.18), franceChampionNode(0.22), franceChampionNode(0.3)];
    const result = computeUpstreamTeamPriorAdjustments(
      { homeTeam: "フランス", awayTeam: "日本" },
      nodes,
    );
    expect(result.homeStrengthDelta).toBeLessThanOrEqual(MAX_TEAM_PRIOR_ADJUST + 1e-9);
  });

  it("ignores teams not in the match", () => {
    const node = franceChampionNode(0.18);
    const result = computeUpstreamTeamPriorAdjustments(
      { homeTeam: "ブラジル", awayTeam: "日本" },
      [node],
    );
    expect(result.homeStrengthDelta).toBe(0);
    expect(result.awayStrengthDelta).toBe(0);
    expect(result.contributions).toHaveLength(0);
  });
});

describe("applyUpstreamTeamPriors", () => {
  it("adds to existing strength adjustments without overwriting them", () => {
    const input = makeEngineInput({ homeStrengthAdjust: 0.01 });
    const adjusted = applyUpstreamTeamPriors(input, {
      homeStrengthDelta: 0.03,
      awayStrengthDelta: 0,
    });
    expect(adjusted.homeStrengthAdjust).toBeCloseTo(0.04, 6);
    // 元の入力は変更しない（純粋）。
    expect(input.homeStrengthAdjust).toBe(0.01);
  });
});

describe("calculateModelProbabilitiesWithUpstream", () => {
  it("nudges the match probability only slightly (does not overwrite it)", () => {
    const node = franceChampionNode(0.2);
    const { base, adjusted, adjustments } = calculateModelProbabilitiesWithUpstream(
      makeEngineInput(),
      { homeTeam: "フランス", awayTeam: "日本" },
      [node],
    );
    expect(adjustments.homeStrengthDelta).toBeLessThanOrEqual(MAX_TEAM_PRIOR_ADJUST + 1e-9);
    // France が home なので 1 の確率は上がるが、変化は小さい。
    expect(adjusted.modelProb1).toBeGreaterThan(base.modelProb1);
    expect(Math.abs(adjusted.modelProb1 - base.modelProb1)).toBeLessThan(0.05);
  });
});
