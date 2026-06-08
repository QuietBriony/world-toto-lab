import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setRuntimeDataMode } from "@/lib/data-mode";
import { createLocalStorageAdapter } from "@/lib/storage/localStorageAdapter";

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

describe("localStorageAdapter", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: new MemoryStorage() });
    setRuntimeDataMode("local");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setRuntimeDataMode("local");
  });

  it("reports an ok health status when localStorage is available", async () => {
    const adapter = createLocalStorageAdapter();
    expect(adapter.mode).toBe("local");
    expect((await adapter.health()).status).toBe("ok");
  });

  it("creates a round, lists it, and round-trips it through export/import", async () => {
    const adapter = createLocalStorageAdapter();

    const roundId = await adapter.createRound({
      budgetYen: null,
      notes: null,
      status: "draft",
      title: "Local Round",
      matchCount: 3,
    });
    expect(typeof roundId).toBe("string");

    const rounds = await adapter.getRounds();
    expect(rounds.some((round) => round.id === roundId)).toBe(true);

    const bundle = await adapter.exportRoundBundle(roundId);
    expect(bundle.round.title).toBe("Local Round");
    expect(Array.isArray(bundle.matches)).toBe(true);

    const importedId = await adapter.importRoundBundle(bundle, "copy");
    expect(typeof importedId).toBe("string");

    const afterImport = await adapter.getRounds();
    expect(afterImport.length).toBeGreaterThanOrEqual(rounds.length);
  });
});
