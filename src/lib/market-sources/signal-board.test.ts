import { describe, expect, it } from "vitest";

import type { Match } from "@/lib/types";
import { buildSignalBoard } from "@/lib/market-sources/signal-board";
import type { MarketNode, MarketSource } from "@/lib/market-sources/types";

function makeMatch(overrides: Partial<Match>): Match {
  return {
    id: overrides.id ?? "m1",
    roundId: "r1",
    fixtureMasterId: null,
    officialMatchNo: null,
    matchNo: overrides.matchNo ?? 1,
    homeTeam: overrides.homeTeam ?? "France",
    awayTeam: overrides.awayTeam ?? "Japan",
    kickoffTime: null,
    venue: null,
    stage: null,
    officialVote1: null,
    officialVote0: null,
    officialVote2: null,
    marketProb1: null,
    marketProb0: null,
    marketProb2: null,
    modelProb1: null,
    modelProb0: null,
    modelProb2: null,
    consensusF: null,
    consensusD: null,
    consensusCall: null,
    disagreementScore: null,
    exceptionCount: null,
    confidence: null,
    category: null,
    recommendedOutcomes: null,
    tacticalNote: null,
    injuryNote: null,
    motivationNote: null,
    adminNote: null,
    recentFormNote: null,
    availabilityInfo: null,
    conditionsInfo: null,
    homeStrengthAdjust: null,
    awayStrengthAdjust: null,
    availabilityAdjust: null,
    conditionsAdjust: null,
    tacticalAdjust: null,
    motivationAdjust: null,
    adminAdjust1: null,
    adminAdjust0: null,
    adminAdjust2: null,
    homeAdvantageAdjust: null,
    restDaysAdjust: null,
    travelAdjust: null,
    leagueTableMotivationAdjust: null,
    injurySuspensionAdjust: null,
    rotationRiskAdjust: null,
    groupStandingMotivationAdjust: null,
    travelClimateAdjust: null,
    altitudeHumidityAdjust: null,
    squadDepthAdjust: null,
    tournamentPressureAdjust: null,
    actualResult: null,
    createdAt: "2026-06-09T00:00:00.000Z",
    updatedAt: "2026-06-09T00:00:00.000Z",
    ...overrides,
  };
}

function makeChampionNode(source: MarketSource, team: string, probability: number): MarketNode {
  return {
    id: `${source}-${team}`,
    source,
    externalUrl: `https://example.test/${source}/${team}`,
    externalSymbol: null,
    slug: null,
    marketType: "outright_champion",
    competition: "fifa_world_cup_2026",
    team,
    outcomeLabel: "YES",
    probability,
    rawPrice: probability,
    bid: null,
    ask: null,
    mid: probability,
    spread: null,
    liquidityScore: null,
    volume: null,
    openInterest: null,
    signalLayer: "upstream_team_prior",
    weight: 0.2,
    dataConfidence: "medium",
    lastFetchedAt: "2026-06-09T00:00:00.000Z",
    notes: null,
    priceSource: "manual",
    lastApiError: null,
    createdAt: "2026-06-09T00:00:00.000Z",
    updatedAt: "2026-06-09T00:00:00.000Z",
  };
}

describe("buildSignalBoard", () => {
  const matches = [
    makeMatch({
      id: "m1",
      matchNo: 1,
      homeTeam: "フランス",
      awayTeam: "日本",
      consensusF: 3,
      officialVote1: 0.55,
      officialVote2: 0.25,
    }),
  ];
  const nodes = [
    makeChampionNode("hyperliquid", "France", 0.18),
    makeChampionNode("polymarket", "France", 0.15),
    makeChampionNode("bookmaker", "France", 0.16),
  ];

  it("lines up Hyperliquid / Polymarket / Bookmaker / Human / Official per team", () => {
    const board = buildSignalBoard({ matches, nodes });
    const france = board.rows.find((row) => row.teamCanonical === "France");
    expect(france).toBeDefined();
    expect(france?.hyperliquidChampion).toBeCloseTo(0.18, 6);
    expect(france?.polymarketChampion).toBeCloseTo(0.15, 6);
    expect(france?.bookmakerChampion).toBeCloseTo(0.16, 6);
    expect(france?.championSourceCount).toBe(3);
    // human F は France(home) 視点でそのまま。
    expect(france?.humanStrengthF).toBeCloseTo(3, 6);
    expect(france?.officialVotePopularity).toBeCloseTo(0.55, 6);
    // disagreement = max - min = 0.18 - 0.15 = 0.03
    expect(france?.championProbSpread).toBeCloseTo(0.03, 6);
  });

  it("orients human F to the away team and leaves champion columns null when no market exists", () => {
    const board = buildSignalBoard({ matches, nodes });
    const japan = board.rows.find((row) => row.teamCanonical === "Japan");
    expect(japan).toBeDefined();
    expect(japan?.hyperliquidChampion).toBeNull();
    expect(japan?.polymarketChampion).toBeNull();
    expect(japan?.bookmakerChampion).toBeNull();
    expect(japan?.championProbSpread).toBeNull();
    // 日本は away なので consensusF の符号反転。
    expect(japan?.humanStrengthF).toBeCloseTo(-3, 6);
    expect(japan?.officialVotePopularity).toBeCloseTo(0.25, 6);
  });

  it("sorts teams with champion markets first", () => {
    const board = buildSignalBoard({ matches, nodes });
    expect(board.rows[0]?.teamCanonical).toBe("France");
  });

  it("uses the Japanese display name when available", () => {
    const board = buildSignalBoard({ matches, nodes });
    const france = board.rows.find((row) => row.teamCanonical === "France");
    expect(france?.team).toBe("フランス");
  });
});
