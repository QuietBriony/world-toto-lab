import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setRuntimeDataMode } from "@/lib/data-mode";
import {
  buildLocalRoundBundle,
  localCreateRound,
  localGetRoundWorkspace,
  localImportRoundBundle,
  localListDashboardData,
} from "@/lib/local-repository";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function installWindow(storage = new MemoryStorage()) {
  vi.stubGlobal("window", { localStorage: storage });
  return storage;
}

const localKeys = {
  currentRound: "world-toto-lab:v1:currentRound",
  matches: "world-toto-lab:v1:matches",
  rounds: "world-toto-lab:v1:rounds",
  users: "world-toto-lab:v1:users",
};

describe("local repository", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    setRuntimeDataMode("local");
    storage = installWindow();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores a created round, placeholder matches, users, and current round in localStorage", async () => {
    const roundId = await localCreateRound({
      budgetYen: null,
      matchCount: 2,
      notes: "local-only smoke",
      productType: "mini_toto",
      requiredMatchCount: 2,
      status: "draft",
      title: "Local fallback round",
    });

    const rounds = JSON.parse(storage.getItem(localKeys.rounds) ?? "[]") as Array<{ id: string; title: string }>;
    const matches = JSON.parse(storage.getItem(localKeys.matches) ?? "[]") as Array<{ roundId: string }>;
    const users = JSON.parse(storage.getItem(localKeys.users) ?? "[]") as unknown[];

    expect(storage.getItem(localKeys.currentRound)).toBe(roundId);
    expect(rounds).toEqual([
      expect.objectContaining({
        id: roundId,
        title: "Local fallback round",
      }),
    ]);
    expect(matches).toHaveLength(2);
    expect(matches.every((match) => match.roundId === roundId)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
  });

  it("exports a workspace bundle and imports copies with remapped ids", async () => {
    const roundId = await localCreateRound({
      budgetYen: 1200,
      matchCount: 1,
      notes: "bundle smoke",
      productType: "mini_toto",
      requiredMatchCount: 1,
      status: "analyzing",
      title: "Bundle source",
    });
    const workspace = await localGetRoundWorkspace(roundId);

    expect(workspace).not.toBeNull();

    const bundle = buildLocalRoundBundle(workspace!, "local");
    const copiedRoundId = await localImportRoundBundle(bundle, "copy");
    const copiedWorkspace = await localGetRoundWorkspace(copiedRoundId);
    const dashboard = await localListDashboardData();

    expect(copiedRoundId).not.toBe(roundId);
    expect(storage.getItem(localKeys.currentRound)).toBe(copiedRoundId);
    expect(copiedWorkspace?.round.title).toBe("Bundle source (local import)");
    expect(copiedWorkspace?.round.matches).toHaveLength(1);
    expect(copiedWorkspace?.round.matches[0]?.id).not.toBe(workspace?.round.matches[0]?.id);
    expect(dashboard.rounds.map((round) => round.id).sort()).toEqual(
      [roundId, copiedRoundId].sort(),
    );
  });

  it("does not mutate localStorage while demo mode is active", async () => {
    setRuntimeDataMode("demo");

    await expect(
      localCreateRound({
        budgetYen: null,
        matchCount: 1,
        notes: null,
        status: "draft",
        title: "Blocked demo write",
      }),
    ).rejects.toThrow("デモモードでは保存しません");

    expect(storage.length).toBe(0);
  });
});
