import { describe, expect, it } from "vitest";

import type { BigOfficialSnapshot } from "@/lib/big-official";
import {
  buildBigEvOpportunityCards,
  buildEvOpportunityCards,
  evOpportunitySourceUrls,
  publicGamblingWatchItems,
} from "@/lib/ev-opportunities";
import { buildWorldCupStrategyDashboard } from "@/lib/world-cup-strategy";

function sampleBigSnapshot(overrides: Partial<BigOfficialSnapshot> = {}): BigOfficialSnapshot {
  return {
    carryoverYen: 6_299_582_550,
    fetchedAt: "2026-06-20T06:00:00.000Z",
    officialRoundName: "第1625回 MEGA BIG",
    officialRoundNumber: 1625,
    productKey: "mega_big",
    productLabel: "MEGA BIG",
    resultDate: "2026-06-21",
    returnRate: 0.5,
    salesEndAt: "2026-06-20",
    salesStartAt: "2026-06-15",
    snapshotAt: "2026-06-20T15:00:00+09:00",
    sourceText: "前開催回からの繰越金（キャリーオーバー） 6,299,582,550円",
    sourceUrl: "https://www.toto-dream.com/big/",
    stakeYen: 300,
    totalSalesYen: 191_591_400,
    ...overrides,
  };
}

describe("EV opportunity board", () => {
  it("keeps public gambling ideas as research-only watch items", () => {
    expect(publicGamblingWatchItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "jra-ultra-premium" }),
        expect.objectContaining({ id: "keirin-dokanto" }),
        expect.objectContaining({ id: "boatrace-odds-drift" }),
      ]),
    );
    expect(publicGamblingWatchItems.every((item) => item.status === "research_only")).toBe(true);
    expect(evOpportunitySourceUrls.jraUltraPremiumUrl).toContain("jra.go.jp");
    expect(evOpportunitySourceUrls.keirinDokantoUrl).toContain("keirin.jp");
  });

  it("labels BIG carryover cards as random-ticket watch items, not true EV picks", () => {
    const [card] = buildBigEvOpportunityCards([sampleBigSnapshot()]);

    expect(card?.category).toBe("big");
    expect(card?.confidenceLabel).toBe("真EV未計算");
    expect(card?.nextActionLabel).toBe("BIGウォッチで確認");
    expect(card?.warningLabel).toContain("ランダム発券");
    expect(card?.evLabel).toContain("キャリー圧");
  });

  it("builds a sorted cross-product opportunity list for the dashboard", () => {
    const cards = buildEvOpportunityCards({
      bigOfficialSnapshots: [sampleBigSnapshot()],
      domesticRoundCount: 1,
      domesticRoundId: "round-domestic",
      domesticRoundTitle: "第9999回 toto",
      goal3Entries: [],
      winnerRoundId: "round-winner",
      winnerRoundTitle: "WINNER テスト回",
      worldCupStrategy: buildWorldCupStrategyDashboard({
        includePositiveCombos: false,
        now: new Date("2026-06-20T12:00:00+09:00"),
        rounds: [],
      }),
    });
    const categories = new Set(cards.map((card) => card.category));

    expect(categories).toEqual(
      new Set(["big", "goal3", "public_gambling_watch", "toto", "winner"]),
    );
    expect(cards[0]?.status).toBe("hot");
    expect(cards.some((card) => card.id === "domestic-toto")).toBe(true);
    expect(cards.some((card) => card.id === "winner-value")).toBe(true);
  });
});
