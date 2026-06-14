import { describe, expect, it } from "vitest";

import type { DashboardRoundSummary, Match, RoundEvAssumption } from "@/lib/types";
import {
  buildWorldCupStrategyDashboard,
  enumeratePositiveEvCombos,
  resolveFeaturedWorldTotoRoundNumber,
} from "@/lib/world-cup-strategy";

function buildMatch(matchNo: number, overrides: Partial<Match> = {}): Match {
  return {
    actualResult: null,
    adminAdjust0: null,
    adminAdjust1: null,
    adminAdjust2: null,
    adminNote: null,
    altitudeHumidityAdjust: null,
    availabilityAdjust: null,
    availabilityInfo: null,
    awayStrengthAdjust: null,
    awayTeam: `Away ${matchNo}`,
    category: null,
    conditionsAdjust: null,
    conditionsInfo: null,
    confidence: null,
    consensusCall: null,
    consensusD: null,
    consensusF: null,
    createdAt: "2026-06-07T08:56:00+09:00",
    disagreementScore: null,
    exceptionCount: null,
    fixtureMasterId: null,
    groupStandingMotivationAdjust: null,
    homeAdvantageAdjust: null,
    homeStrengthAdjust: null,
    homeTeam: `Home ${matchNo}`,
    id: `match-${matchNo}`,
    injuryNote: null,
    injurySuspensionAdjust: null,
    kickoffTime: null,
    leagueTableMotivationAdjust: null,
    marketProb0: null,
    marketProb1: null,
    marketProb2: null,
    matchNo,
    modelProb0: 0.2,
    modelProb1: 0.6,
    modelProb2: 0.2,
    motivationAdjust: null,
    motivationNote: null,
    officialMatchNo: matchNo,
    officialVote0: 0.15,
    officialVote1: 0.7,
    officialVote2: 0.15,
    recentFormNote: null,
    recommendedOutcomes: null,
    restDaysAdjust: null,
    rotationRiskAdjust: null,
    roundId: "round-1634",
    squadDepthAdjust: null,
    stage: null,
    tacticalAdjust: null,
    tacticalNote: null,
    tournamentPressureAdjust: null,
    travelAdjust: null,
    travelClimateAdjust: null,
    updatedAt: "2026-06-07T08:56:00+09:00",
    venue: null,
    ...overrides,
  };
}

function buildRound(matches: Match[]): DashboardRoundSummary {
  return {
    activeMatchCount: matches.length,
    budgetYen: null,
    candidateTicketCount: 0,
    competitionType: "world_cup",
    consensusCompletion: 0,
    createdAt: "2026-06-07T08:56:00+09:00",
    dataProfile: "worldcup_rich",
    id: "round-1634",
    matchCount: matches.length,
    matches,
    notes: null,
    outcomeSetJson: ["1", "0", "2"],
    participantIds: [],
    pickCount: 0,
    picks: [],
    primaryUse: "real_round_research",
    probabilityReadiness: "ready",
    productType: "toto13",
    requiredMatchCount: 13,
    resultedCount: 0,
    reviewNotes: [],
    roundSource: "toto_official_manual",
    scoutReports: [],
    sourceNote: "toto公式 第1634回 / 指定公示済み / 2026-06-07 08:48-08:56時点",
    sportContext: "national_team",
    status: "analyzing",
    title: "第1634回 toto W杯本番",
    topSignals: [],
    updatedAt: "2026-06-07T08:56:00+09:00",
    voidHandling: "manual",
  };
}

function buildAssumption(): RoundEvAssumption {
  return {
    carryoverYen: 0,
    createdAt: "2026-06-07T08:56:00+09:00",
    firstPrizeShare: 0.7,
    id: "assumption",
    note: null,
    payoutCapYen: null,
    returnRate: 0.5,
    roundId: "round-1634",
    stakeYen: 100,
    totalSalesYen: 100000,
    updatedAt: "2026-06-07T08:56:00+09:00",
  };
}

describe("world cup strategy", () => {
  it("recognizes the featured World Toto round", () => {
    expect(
      resolveFeaturedWorldTotoRoundNumber({
        sourceNote: "toto公式 第1634回 / 指定公示済み",
        title: "第1634回 toto W杯本番",
      }),
    ).toBe(1634);
  });

  it("keeps the published sales deadline for round 1634", () => {
    const strategy = buildWorldCupStrategyDashboard({
      now: new Date("2026-06-14T00:00:00+09:00"),
      rounds: [],
    });
    const round1634 = strategy.rounds[0];

    expect(round1634.featured.roundNumber).toBe(1634);
    expect(round1634.featured.salesEndAt).toBe("2026-06-12T19:00:00+09:00");
    expect(round1634.windowStatus).toBe("closed");
  });

  it("summarizes the known final vote snapshot for round 1634", () => {
    const strategy = buildWorldCupStrategyDashboard({
      now: new Date("2026-06-14T00:00:00+09:00"),
      rounds: [],
    });
    const snapshot = strategy.rounds[0].finalSnapshot;

    expect(snapshot?.sourceAsOfLabel).toBe("2026年06月12日販売終了時点");
    expect(snapshot?.totalSalesYen).toBe(289166800);
    expect(snapshot?.salesMultiple).toBeCloseTo(20.7159, 4);
    expect(snapshot?.favoriteChangeCount).toBe(0);
    expect(snapshot?.maxAbsVoteShareDeltaPt).toBeCloseTo(10.43, 2);
  });

  it("builds a strict orthodox EV line when model, official, and sales inputs are ready", () => {
    const strategy = buildWorldCupStrategyDashboard({
      now: new Date("2026-06-11T12:00:00+09:00"),
      rounds: [buildRound(Array.from({ length: 13 }, (_value, index) => buildMatch(index + 1)))],
    });
    const round1634 = strategy.rounds[0];

    expect(round1634.strictEvReady).toBe(true);
    expect(round1634.orthodoxLine?.strictEvReady).toBe(true);
    expect(round1634.orthodoxLine?.estimatedPayoutYen).toBeGreaterThan(0);
  });

  it("enumerates positive EV combinations in descending EV order", () => {
    const result = enumeratePositiveEvCombos({
      assumption: buildAssumption(),
      limit: 3,
      matches: [
        buildMatch(1, {
          modelProb0: 0.1,
          modelProb1: 0.1,
          modelProb2: 0.8,
          officialVote0: 0.05,
          officialVote1: 0.9,
          officialVote2: 0.05,
        }),
        buildMatch(2, {
          modelProb0: 0.1,
          modelProb1: 0.1,
          modelProb2: 0.8,
          officialVote0: 0.05,
          officialVote1: 0.9,
          officialVote2: 0.05,
        }),
      ],
    });

    expect(result.ready).toBe(true);
    expect(result.evaluatedCount).toBe(9);
    expect(result.totalPositiveCount).toBeGreaterThan(0);
    expect(result.rows[0].signature).toBe("22");
    expect(result.rows[0].evMultiple).toBeGreaterThan(result.rows[1].evMultiple);
  });

  it("explains missing strict EV inputs for unpublished future rounds", () => {
    const strategy = buildWorldCupStrategyDashboard({
      now: new Date("2026-06-14T00:00:00+09:00"),
      rounds: [buildRound(Array.from({ length: 13 }, (_value, index) => buildMatch(index + 1)))],
    });
    const round1635 = strategy.rounds[1];

    expect(round1635.strictEvReady).toBe(false);
    expect(round1635.strictEvMissingReasons).toContain("W杯toto回が未作成");
    expect(round1635.strictEvMissingReasons).toContain("売上総額が未公表");
  });
});
