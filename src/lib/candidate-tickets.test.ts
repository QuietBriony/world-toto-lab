import { describe, expect, it } from "vitest";

import {
  buildRoundDataQualitySummary,
  generateCandidateTickets,
} from "@/lib/candidate-tickets";
import { demoRoundTitle } from "@/lib/demo-data";
import type {
  Match,
  Pick,
  RoundEvAssumption,
  User,
} from "@/lib/types";

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: overrides.id ?? "admin-1",
    name: overrides.name ?? "Admin",
    role: overrides.role ?? "admin",
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

function buildMatch(matchNo: number, overrides: Partial<Match> = {}): Match {
  const has = <K extends keyof Match>(key: K) => Object.prototype.hasOwnProperty.call(overrides, key);

  return {
    id: overrides.id ?? `match-${matchNo}`,
    roundId: overrides.roundId ?? "round-1",
    fixtureMasterId: overrides.fixtureMasterId ?? null,
    officialMatchNo: overrides.officialMatchNo ?? matchNo,
    matchNo,
    homeTeam: overrides.homeTeam ?? `Home ${matchNo}`,
    awayTeam: overrides.awayTeam ?? `Away ${matchNo}`,
    kickoffTime: overrides.kickoffTime ?? `2026-06-${String(matchNo).padStart(2, "0")}T19:00:00.000Z`,
    venue: overrides.venue ?? `Venue ${matchNo}`,
    stage: overrides.stage ?? "Group Stage",
    officialVote1: has("officialVote1") ? (overrides.officialVote1 ?? null) : 0.5,
    officialVote0: has("officialVote0") ? (overrides.officialVote0 ?? null) : 0.25,
    officialVote2: has("officialVote2") ? (overrides.officialVote2 ?? null) : 0.25,
    marketProb1: has("marketProb1") ? (overrides.marketProb1 ?? null) : 0.48,
    marketProb0: has("marketProb0") ? (overrides.marketProb0 ?? null) : 0.27,
    marketProb2: has("marketProb2") ? (overrides.marketProb2 ?? null) : 0.25,
    modelProb1: has("modelProb1") ? (overrides.modelProb1 ?? null) : 0.55,
    modelProb0: has("modelProb0") ? (overrides.modelProb0 ?? null) : 0.2,
    modelProb2: has("modelProb2") ? (overrides.modelProb2 ?? null) : 0.25,
    consensusF: overrides.consensusF ?? 0,
    consensusD: overrides.consensusD ?? 0,
    consensusCall: overrides.consensusCall ?? null,
    disagreementScore: overrides.disagreementScore ?? null,
    exceptionCount: overrides.exceptionCount ?? null,
    confidence: overrides.confidence ?? null,
    category: overrides.category ?? null,
    recommendedOutcomes: overrides.recommendedOutcomes ?? null,
    tacticalNote: overrides.tacticalNote ?? null,
    injuryNote: overrides.injuryNote ?? null,
    motivationNote: overrides.motivationNote ?? null,
    adminNote: overrides.adminNote ?? null,
    actualResult: overrides.actualResult ?? null,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

function buildPick(matchId: string, userId: string, pick: "ONE" | "DRAW" | "TWO"): Pick {
  return {
    id: `${matchId}-${userId}`,
    roundId: "round-1",
    matchId,
    userId,
    pick,
    note: null,
    support: { kind: "manual" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function buildAssumption(overrides: Partial<RoundEvAssumption> = {}): RoundEvAssumption {
  return {
    id: "assumption-1",
    roundId: "round-1",
    stakeYen: 100,
    totalSalesYen: 100_000_000,
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

describe("candidate tickets", () => {
  it("builds orthodox model and public favorite candidates from top probabilities", () => {
    const matches = [
      buildMatch(1, { modelProb1: 0.6, modelProb0: 0.25, modelProb2: 0.15, officialVote2: 0.52, officialVote1: 0.3, officialVote0: 0.18 }),
      buildMatch(2, { modelProb0: 0.5, modelProb1: 0.25, modelProb2: 0.25, officialVote1: 0.48, officialVote0: 0.32, officialVote2: 0.2 }),
    ];

    const result = generateCandidateTickets({
      evAssumption: buildAssumption(),
      matches,
      picks: [],
      roundTitle: "round",
      scoutReports: [],
      users: [buildUser()],
    });

    expect(result.tickets.find((ticket) => ticket.label === "王道モデル")?.picks.map((pick) => pick.pick)).toEqual(["1", "0"]);
    expect(result.tickets.find((ticket) => ticket.label === "公式人気")?.picks.map((pick) => pick.pick)).toEqual(["2", "1"]);
  });

  it("builds human consensus candidate from avgF / avgD rules", () => {
    const matches = [
      buildMatch(1, { consensusD: 1.6, consensusF: 0 }),
      buildMatch(2, { consensusF: 3.4 }),
      buildMatch(3, { consensusF: -3.2 }),
    ];

    const result = generateCandidateTickets({
      evAssumption: buildAssumption(),
      matches,
      picks: [],
      roundTitle: "round",
      scoutReports: [],
      users: [buildUser()],
    });

    expect(result.tickets.find((ticket) => ticket.label === "人力コンセンサス")?.picks.map((pick) => pick.pick)).toEqual(["0", "1", "2"]);
  });

  it("prefers evMultiple >= 2.0 for EV hunters when strict EV is available", () => {
    const matches = [1, 2, 3, 4].map((matchNo) =>
      buildMatch(matchNo, {
        modelProb1: 0.62,
        modelProb0: 0.2,
        modelProb2: 0.18,
        officialVote1: 0.9,
        officialVote0: 0.05,
        officialVote2: 0.05,
      }),
    );

    const result = generateCandidateTickets({
      evAssumption: buildAssumption(),
      matches,
      picks: [],
      roundTitle: "round",
      scoutReports: [],
      users: [buildUser()],
    });

    const evHunters = result.tickets.filter((ticket) => ticket.strategyType === "ev_hunter");
    expect(evHunters.length).toBeGreaterThan(0);
    expect(evHunters.every((ticket) => (ticket.evMultiple ?? 0) >= 2)).toBe(true);
  });

  it("keeps EV hunter diversity with hamming distance >= 2 when multiple cards exist", () => {
    const matches = [1, 2, 3, 4].map((matchNo) =>
      buildMatch(matchNo, {
        modelProb1: 0.55,
        modelProb0: 0.24,
        modelProb2: 0.21,
        officialVote1: 0.82,
        officialVote0: 0.1,
        officialVote2: 0.08,
      }),
    );

    const result = generateCandidateTickets({
      evAssumption: buildAssumption(),
      matches,
      picks: [],
      roundTitle: "round",
      scoutReports: [],
      users: [buildUser()],
    });

    const hunterA = result.tickets.find((ticket) => ticket.label === "EVハンターA");
    const hunterB = result.tickets.find((ticket) => ticket.label === "EVハンターB");

    expect(hunterA).toBeTruthy();
    expect(hunterB).toBeTruthy();
    const distance = hunterA!.picks.reduce(
      (count, pick, index) => count + (pick.pick === hunterB!.picks[index]?.pick ? 0 : 1),
      0,
    );
    expect(distance).toBeGreaterThanOrEqual(2);
  });

  it("reports when no EV 200% candidate exists", () => {
    const matches = [1, 2, 3].map((matchNo) =>
      buildMatch(matchNo, {
        modelProb1: 0.55,
        modelProb0: 0.25,
        modelProb2: 0.2,
        officialVote1: 0.54,
        officialVote0: 0.26,
        officialVote2: 0.2,
      }),
    );

    const result = generateCandidateTickets({
      evAssumption: buildAssumption({
        totalSalesYen: 20_000,
      }),
      matches,
      picks: [],
      roundTitle: "round",
      scoutReports: [],
      users: [buildUser()],
    });

    expect(result.hasEv200Candidate).toBe(false);
  });

  it("detects missing official votes and demo data in data quality", () => {
    const matches = [
      buildMatch(1, { officialVote1: null, officialVote0: null, officialVote2: null }),
      buildMatch(2),
    ];

    const summary = buildRoundDataQualitySummary({
      evAssumption: buildAssumption({
        totalSalesYen: null,
      }),
      matches,
      picks: [buildPick(matches[0]!.id, "admin-1", "ONE")],
      roundTitle: demoRoundTitle,
      scoutReports: [{ userId: "admin-1" }],
      users: [buildUser()],
    });

    expect(summary.isDemoData).toBe(true);
    expect(summary.allOfficialVotesReady).toBe(false);
    expect(summary.message).toContain("デモデータ");
  });

  it("flags missing model probabilities in data quality", () => {
    const summary = buildRoundDataQualitySummary({
      evAssumption: buildAssumption(),
      matches: [buildMatch(1, { modelProb1: null, modelProb0: null, modelProb2: null })],
      picks: [],
      roundTitle: "round",
      scoutReports: [],
      users: [buildUser()],
    });

    expect(summary.allModelProbabilitiesReady).toBe(false);
    expect(summary.message).toContain("モデル確率");
  });
});
