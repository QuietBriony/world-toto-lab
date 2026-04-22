import { describe, expect, it } from "vitest";

import { buildPlayDraftValues, buildPlayPageSummary } from "@/lib/play-page";
import { buildPracticeLabMetrics } from "@/lib/practice-lab";
import type { CandidateTicket, Match, Pick, RoundWorkspaceRound } from "@/lib/types";

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
    matchNo: partial.matchNo ?? 1,
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
    roundId: "round-1",
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

function makePick(partial: Partial<Pick> = {}) {
  return {
    createdAt: "",
    id: partial.id ?? "pick-1",
    match: undefined,
    matchId: partial.matchId ?? "match-1",
    note: null,
    pick: partial.pick ?? "ONE",
    roundId: "round-1",
    updatedAt: "",
    user: undefined,
    userId: partial.userId ?? "user-1",
  } as Pick;
}

function makeCandidate(partial: Partial<CandidateTicket> = {}) {
  return {
    contrarianCount: 1,
    createdAt: "",
    dataQuality: "complete",
    drawCount: 1,
    estimatedPayoutYen: 100000,
    evMultiple: 2,
    evPercent: 200,
    grossEvYen: 200,
    hitProbability: 0.01,
    humanAlignmentScore: 0.5,
    id: partial.id ?? "candidate-1",
    label: partial.label ?? "王道",
    pModelCombo: 0.01,
    pPublicCombo: 0.01,
    picks: partial.picks ?? [{ matchNo: 1, pick: "1" }],
    proxyScore: null,
    publicOverlapScore: null,
    rationale: null,
    roundId: "round-1",
    strategyType: partial.strategyType ?? "orthodox_model",
    updatedAt: "",
    warning: null,
  } as CandidateTicket;
}

function makeRound(overrides: Partial<RoundWorkspaceRound> = {}) {
  return {
    activeMatchCount: 13,
    budgetYen: null,
    candidateTickets: [makeCandidate()],
    candidateVotes: [],
    competitionType: "world_cup",
    createdAt: "",
    dataProfile: "worldcup_rich",
    evAssumption: null,
    generatedTickets: [],
    id: "round-1",
    matches: [makeMatch()],
    notes: null,
    outcomeSetJson: ["1", "0", "2"],
    participantIds: [],
    picks: [makePick()],
    primaryUse: "friend_game",
    probabilityReadiness: "ready",
    productType: "toto13",
    requiredMatchCount: 13,
    researchMemos: [],
    reviewNotes: [],
    roundSource: "user_manual",
    scoutReports: [],
    sourceNote: null,
    sportContext: "national_team",
    status: "draft",
    title: "round",
    totoOfficialMatches: [],
    totoOfficialRound: null,
    updatedAt: "",
    voidHandling: "manual",
    ...overrides,
  } as RoundWorkspaceRound;
}

describe("play page helpers", () => {
  it("builds candidate and participant counts for the play page", () => {
    const round = makeRound({
      candidateTickets: [makeCandidate({ id: "c1" }), makeCandidate({ id: "c2" })],
      picks: [makePick({ userId: "user-1" }), makePick({ id: "pick-2", userId: "user-2" })],
    });

    const summary = buildPlayPageSummary(round);

    expect(summary.candidateCount).toBe(2);
    expect(summary.inputtedUserCount).toBe(2);
  });

  it("builds a saved draft for a user", () => {
    const round = makeRound({
      picks: [makePick({ matchId: "match-1", pick: "DRAW", userId: "user-9" })],
    });

    expect(buildPlayDraftValues(round, "user-9")).toEqual({ "match-1": "0" });
  });

  it("computes practice metrics from actual results and candidate picks", () => {
    const round = makeRound({
      candidateTickets: [
        makeCandidate({
          picks: [
            { matchNo: 1, pick: "1" },
            { matchNo: 2, pick: "0" },
          ],
          strategyType: "ev_hunter",
        }),
      ],
      matches: [
        makeMatch({
          actualResult: "ONE",
          id: "match-1",
          matchNo: 1,
          modelProb1: 0.5,
          modelProb0: 0.2,
          modelProb2: 0.3,
          officialVote1: 0.45,
          officialVote0: 0.25,
          officialVote2: 0.3,
        }),
        makeMatch({
          actualResult: "DRAW",
          category: "draw_candidate",
          id: "match-2",
          matchNo: 2,
          modelProb1: 0.3,
          modelProb0: 0.4,
          modelProb2: 0.3,
          officialVote1: 0.45,
          officialVote0: 0.25,
          officialVote2: 0.3,
        }),
      ],
    });

    const metrics = buildPracticeLabMetrics(round);

    expect(metrics.resolvedMatchCount).toBe(2);
    expect(metrics.modelFavoriteHitCount).toBe(2);
    expect(metrics.officialFavoriteHitCount).toBe(1);
    expect(metrics.drawAlertHitCount).toBe(1);
    expect(metrics.candidateHitCount).toBe(2);
  });
});
