import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMarketNodeFromHyperliquidUrl } from "@/lib/market-sources/hyperliquid";
import {
  clearMarketSources,
  deleteMarketNode,
  getMarketNode,
  listMarketNodes,
  saveMarketNode,
  updateMarketNode,
} from "@/lib/market-sources/store";

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

const FRANCE_URL =
  "https://app.hyperliquid.xyz/trade/2026-world-cup-champion-france-yes";

describe("market sources store", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: new MemoryStorage() });
    clearMarketSources();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty list before anything is saved", () => {
    expect(listMarketNodes()).toEqual([]);
  });

  it("saves, reads, updates and deletes a MarketNode", () => {
    const node = createMarketNodeFromHyperliquidUrl(FRANCE_URL, { id: "node-1" })!;
    saveMarketNode(node);

    expect(listMarketNodes()).toHaveLength(1);
    expect(getMarketNode("node-1")?.team).toBe("France");

    const updated = updateMarketNode("node-1", { probability: 0.18, priceSource: "manual" });
    expect(updated?.probability).toBe(0.18);
    expect(getMarketNode("node-1")?.priceSource).toBe("manual");

    deleteMarketNode("node-1");
    expect(listMarketNodes()).toEqual([]);
  });

  it("upserts by id rather than duplicating", () => {
    const node = createMarketNodeFromHyperliquidUrl(FRANCE_URL, { id: "node-1" })!;
    saveMarketNode(node);
    saveMarketNode({ ...node, notes: "updated" });
    expect(listMarketNodes()).toHaveLength(1);
    expect(getMarketNode("node-1")?.notes).toBe("updated");
  });

  it("is SSR-safe: returns empty when window is unavailable", () => {
    vi.unstubAllGlobals();
    expect(listMarketNodes()).toEqual([]);
  });
});
