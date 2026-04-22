import { describe, expect, it } from "vitest";

import { evaluateMatchReadiness, summarizeRoundReadiness } from "@/lib/probability/readiness";
import type { Match, ResearchMemo } from "@/lib/types";

function makeMatch(partial: Partial<Match> = {}) {
  return {
    actualResult: null,
    adminAdjust0: null,
    adminAdjust1: null,
    adminAdjust2: null,
    adminNote: null,
    altitudeHumidityAdjust: null,
    availabilityAdjust: null,
    availabilityInfo: null,
    awayTeam: "Away",
    awayStrengthAdjust: null,
    category: null,
    confidence: null,
    consensusCall: null,
    consensusD: null,
    consensusF: null,
    conditionsAdjust: null,
    conditionsInfo: null,
    createdAt: "",
    disagreementScore: null,
    exceptionCount: null,
    fixtureMasterId: null,
    groupStandingMotivationAdjust: null,
    homeAdvantageAdjust: null,
    homeStrengthAdjust: null,
    homeTeam: "Home",
    id: partial.id ?? "match-1",
    injuryNote: null,
    injurySuspensionAdjust: null,
    kickoffTime: null,
    leagueTableMotivationAdjust: null,
    marketProb0: null,
    marketProb1: null,
    marketProb2: null,
    matchNo: 1,
    modelProb0: null,
    modelProb1: null,
    modelProb2: null,
    motivationAdjust: null,
    motivationNote: null,
    officialMatchNo: null,
    officialVote0: null,
    officialVote1: null,
    officialVote2: null,
    recentFormNote: null,
    recommendedOutcomes: null,
    restDaysAdjust: null,
    rotationRiskAdjust: null,
    squadDepthAdjust: null,
    stage: null,
    tacticalAdjust: null,
    tacticalNote: null,
    tournamentPressureAdjust: null,
    travelAdjust: null,
    travelClimateAdjust: null,
    updatedAt: "",
    venue: null,
    ...partial,
  } as Match;
}

function makeMemo(partial: Partial<ResearchMemo> = {}) {
  return {
    confidence: "medium",
    createdAt: "",
    createdBy: "user-1",
    id: partial.id ?? "memo-1",
    matchId: partial.matchId ?? null,
    memoType: "recent_form",
    roundId: "round-1",
    sourceDate: null,
    sourceName: null,
    sourceUrl: null,
    summary: "summary",
    team: null,
    title: "title",
    updatedAt: "",
    ...partial,
  } as ResearchMemo;
}

describe("readiness", () => {
  it("classifies high readiness", () => {
    const result = evaluateMatchReadiness({
      match: makeMatch({
        availabilityInfo: "starter check",
        conditionsInfo: "weather",
        consensusD: 1.4,
        consensusF: 3,
        marketProb0: 0.25,
        marketProb1: 0.4,
        marketProb2: 0.35,
        officialVote0: 0.26,
        officialVote1: 0.45,
        officialVote2: 0.29,
        recentFormNote: "WWD",
      }),
    });

    expect(result.level).toBe("high");
  });

  it("classifies medium readiness for domestic manual adjustments without market probs", () => {
    const result = evaluateMatchReadiness({
      match: makeMatch({
        consensusF: 2,
        homeAdvantageAdjust: 0.05,
        officialVote0: 0.25,
        officialVote1: 0.45,
        officialVote2: 0.3,
      }),
    });

    expect(result.level).toBe("medium");
  });

  it("classifies low readiness when only official vote exists", () => {
    const result = evaluateMatchReadiness({
      match: makeMatch({
        officialVote0: 0.28,
        officialVote1: 0.44,
        officialVote2: 0.28,
      }),
    });

    expect(result.level).toBe("low");
    expect(result.message).toContain("低信頼");
  });

  it("classifies fallback when only schedule exists", () => {
    const result = evaluateMatchReadiness({
      match: makeMatch(),
    });

    expect(result.level).toBe("fallback");
  });

  it("uses research memos as supporting inputs", () => {
    const result = evaluateMatchReadiness({
      match: makeMatch({
        officialVote0: 0.25,
        officialVote1: 0.4,
        officialVote2: 0.35,
      }),
      researchMemos: [makeMemo({ memoType: "injury" }), makeMemo({ memoType: "motivation" })],
    });

    expect(result.hasAvailabilityInfo).toBe(true);
    expect(result.hasMotivationInfo).toBe(true);
  });

  it("summarizes round readiness", () => {
    const result = summarizeRoundReadiness({
      matches: [
        makeMatch({
          consensusF: 2,
          marketProb0: 0.25,
          marketProb1: 0.45,
          marketProb2: 0.3,
          officialVote0: 0.27,
          officialVote1: 0.4,
          officialVote2: 0.33,
          recentFormNote: "good",
        }),
        makeMatch({
          id: "match-2",
          consensusF: 1,
          officialVote0: 0.25,
          officialVote1: 0.45,
          officialVote2: 0.3,
          rotationRiskAdjust: 0.03,
        }),
      ],
      round: { competitionType: "domestic_toto" },
    });

    expect(result.level).toBe("partial");
  });
});
