import { describe, expect, it } from "vitest";

import { worldCupMarketSignalByMatchNo } from "@/lib/world-cup-market-signal";
import { worldCupToto1637ExternalMarketOverlay } from "@/lib/world-cup-toto-review-plan";

describe("worldCupMarketSignalByMatchNo", () => {
  it("returns an empty map for rounds without a market overlay", () => {
    expect(worldCupMarketSignalByMatchNo(1634).size).toBe(0);
    expect(worldCupMarketSignalByMatchNo(-1).size).toBe(0);
  });

  it("derives every 1637 signal from the exported overlay (no hardcoded values)", () => {
    const signals = worldCupMarketSignalByMatchNo(1637);
    const overlay = worldCupToto1637ExternalMarketOverlay;

    expect(signals.size).toBe(overlay.comparisonRows.length);
    for (const row of overlay.comparisonRows) {
      const signal = signals.get(row.matchNo);
      expect(signal).toBeDefined();
      // 市場確率は overlay の marketProb をそのまま転写（review-plan.ts を編集せず読むだけ）。
      expect(signal?.marketProb1).toBe(row.marketProb["1"]);
      expect(signal?.marketProb0).toBe(row.marketProb["0"]);
      expect(signal?.marketProb2).toBe(row.marketProb["2"]);
      // 公衆票は overlay の officialProb（= plan match の votes）から派生。
      expect(signal?.officialVote2).toBe(row.officialProb["2"]);
    }
  });

  it("captures the crowd-overconfidence gap on M01 (market prices the public favorite lower)", () => {
    const signal = worldCupMarketSignalByMatchNo(1637).get(1);
    expect(signal).toBeDefined();
    expect(signal?.officialVote2).not.toBeNull();
    expect(signal?.officialVote1).not.toBeNull();

    // 値はハードコードせず、質的関係だけを assert（スナップショット drift に堅牢）。
    // 公衆本命(ドイツ=2)を市場はより低く評価＝公衆過信シグナル。
    expect(signal!.marketProb2).toBeLessThan(signal!.officialVote2 as number);
    // 逆にアンダードッグ(エクアドル=1)は市場の方が高く評価している。
    expect(signal!.marketProb1).toBeGreaterThan(signal!.officialVote1 as number);
  });
});
