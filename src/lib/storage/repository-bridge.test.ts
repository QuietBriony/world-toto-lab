import { describe, expect, it, vi } from "vitest";

import {
  createRepositoryAdapter,
  toBaseRound,
  type RepositoryBackend,
} from "@/lib/storage/repository-bridge";
import type { Pick, RoundBundle } from "@/lib/storage/types";
import type { Round, RoundWorkspaceRound } from "@/lib/types";

function makePick(overrides: Partial<Pick>): Pick {
  return {
    id: overrides.id ?? `pick-${overrides.matchId ?? "x"}`,
    roundId: overrides.roundId ?? "round-1",
    matchId: overrides.matchId ?? "match-1",
    userId: overrides.userId ?? "user-1",
    pick: overrides.pick ?? "ONE",
    note: overrides.note ?? null,
    support: overrides.support ?? { kind: "manual" },
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

function makeWorkspaceRound(
  overrides: Partial<RoundWorkspaceRound> = {},
): RoundWorkspaceRound {
  const base: Round = {
    id: "round-1",
    title: "Original Title",
    status: "draft",
    budgetYen: 1000,
    notes: "original notes",
    competitionType: "domestic_toto",
    productType: "toto13",
    sportContext: "j_league",
    primaryUse: "friend_game",
    requiredMatchCount: 13,
    activeMatchCount: 13,
    dataProfile: "domestic_standard",
    probabilityReadiness: "partial",
    roundSource: "user_manual",
    sourceNote: null,
    outcomeSetJson: ["1", "0", "2"],
    voidHandling: "manual",
    participantIds: ["user-1"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  return {
    ...base,
    matches: [],
    picks: [],
    scoutReports: [],
    researchMemos: [],
    generatedTickets: [],
    evAssumption: null,
    candidateTickets: [],
    candidateVotes: [],
    totoOfficialRound: null,
    totoOfficialMatches: [],
    reviewNotes: [],
    ...overrides,
  };
}

function makeBackend(round: RoundWorkspaceRound) {
  return {
    listRounds: vi.fn(async () => [round]),
    getWorkspaceRound: vi.fn(async () => round),
    createRound: vi.fn(async () => "new-round-id"),
    updateRound: vi.fn(async () => undefined),
    deleteRound: vi.fn(async () => undefined),
    bulkUpdateMatches: vi.fn(async () => undefined),
    replacePicks: vi.fn(async () => undefined),
    replaceScoutReports: vi.fn(async () => undefined),
    replaceCandidateTickets: vi.fn(async () => undefined),
    upsertCandidateVote: vi.fn(async () => undefined),
    addReviewNote: vi.fn(async () => undefined),
    exportBundle: vi.fn(async () => ({ round } as unknown as RoundBundle)),
    importBundle: vi.fn(async () => "imported-round-id"),
  } satisfies RepositoryBackend;
}

describe("createRepositoryAdapter", () => {
  it("exposes the mode and strips rounds down to base fields", async () => {
    const round = makeWorkspaceRound({
      matches: [{ id: "m1" } as unknown as RoundWorkspaceRound["matches"][number]],
    });
    const backend = makeBackend(round);
    const adapter = createRepositoryAdapter("supabase", backend, async () => ({
      status: "ok",
      message: "ok",
      checkedAt: "2026-01-01T00:00:00.000Z",
    }));

    expect(adapter.mode).toBe("supabase");

    const rounds = await adapter.getRounds();
    expect(rounds).toHaveLength(1);
    // base Round が返り、matches などの workspace 専用フィールドは含まない
    expect(rounds[0]).not.toHaveProperty("matches");
    expect(rounds[0].id).toBe("round-1");
  });

  it("merges an update patch with the current round (partial update)", async () => {
    const backend = makeBackend(makeWorkspaceRound());
    const adapter = createRepositoryAdapter("local", backend, async () => ({
      status: "ok",
      message: "ok",
      checkedAt: "2026-01-01T00:00:00.000Z",
    }));

    await adapter.updateRound("round-1", { title: "Updated Title" });

    expect(backend.updateRound).toHaveBeenCalledTimes(1);
    const arg = backend.updateRound.mock.calls[0][0];
    expect(arg.roundId).toBe("round-1");
    expect(arg.title).toBe("Updated Title");
    // 未指定フィールドは現状維持
    expect(arg.status).toBe("draft");
    expect(arg.budgetYen).toBe(1000);
    expect(arg.notes).toBe("original notes");
    expect(arg.competitionType).toBe("domestic_toto");
  });

  it("adds a new pick while keeping the user's existing picks", async () => {
    const round = makeWorkspaceRound({
      picks: [makePick({ matchId: "m1", userId: "user-1", pick: "ONE" })],
    });
    const backend = makeBackend(round);
    const adapter = createRepositoryAdapter("local", backend, async () => ({
      status: "ok",
      message: "ok",
      checkedAt: "2026-01-01T00:00:00.000Z",
    }));

    await adapter.upsertPick("round-1", "user-1", "m2", "TWO");

    const arg = backend.replacePicks.mock.calls[0][0];
    expect(arg.roundId).toBe("round-1");
    expect(arg.userId).toBe("user-1");
    expect(arg.picks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ matchId: "m1", pick: "ONE" }),
        expect.objectContaining({ matchId: "m2", pick: "TWO" }),
      ]),
    );
  });

  it("overwrites an existing pick for the same match", async () => {
    const round = makeWorkspaceRound({
      picks: [makePick({ matchId: "m1", userId: "user-1", pick: "ONE" })],
    });
    const backend = makeBackend(round);
    const adapter = createRepositoryAdapter("local", backend, async () => ({
      status: "ok",
      message: "ok",
      checkedAt: "2026-01-01T00:00:00.000Z",
    }));

    await adapter.upsertPick("round-1", "user-1", "m1", "DRAW");

    const arg = backend.replacePicks.mock.calls[0][0];
    expect(arg.picks).toHaveLength(1);
    expect(arg.picks[0]).toMatchObject({ matchId: "m1", pick: "DRAW" });
  });

  it("delegates export and defaults import strategy to copy", async () => {
    const backend = makeBackend(makeWorkspaceRound());
    const adapter = createRepositoryAdapter("local", backend, async () => ({
      status: "ok",
      message: "ok",
      checkedAt: "2026-01-01T00:00:00.000Z",
    }));

    await adapter.exportRoundBundle("round-1");
    expect(backend.exportBundle).toHaveBeenCalledWith("round-1");

    const bundle = { round: makeWorkspaceRound() } as unknown as RoundBundle;
    const importedId = await adapter.importRoundBundle(bundle);
    expect(importedId).toBe("imported-round-id");
    expect(backend.importBundle).toHaveBeenCalledWith(bundle, "copy");
  });
});

describe("toBaseRound", () => {
  it("keeps only base Round keys", () => {
    const enriched = makeWorkspaceRound();
    const base = toBaseRound(enriched);
    expect(base).not.toHaveProperty("matches");
    expect(base).not.toHaveProperty("candidateTickets");
    expect(Object.keys(base).sort()).toEqual(
      [
        "activeMatchCount",
        "budgetYen",
        "competitionType",
        "createdAt",
        "dataProfile",
        "id",
        "notes",
        "outcomeSetJson",
        "participantIds",
        "primaryUse",
        "probabilityReadiness",
        "productType",
        "requiredMatchCount",
        "roundSource",
        "sourceNote",
        "sportContext",
        "status",
        "title",
        "updatedAt",
        "voidHandling",
      ].sort(),
    );
  });
});
