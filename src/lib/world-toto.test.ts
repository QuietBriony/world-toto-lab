import { describe, expect, it } from "vitest";

import {
  isLikelyWorldTotoLibraryEntry,
  isLikelyWorldTotoRound,
  looksLikeWorldTotoText,
  resolveWorldTotoProductLabel,
} from "@/lib/world-toto";

describe("world toto helpers", () => {
  it("detects explicit world toto wording", () => {
    expect(looksLikeWorldTotoText("第1700回 ワールドtoto")).toBe(true);
    expect(looksLikeWorldTotoText("2026 FIFA World Cup")).toBe(true);
    expect(looksLikeWorldTotoText("第1628回 toto")).toBe(false);
  });

  it("treats explicit world toto library entries as world toto", () => {
    expect(
      isLikelyWorldTotoLibraryEntry({
        id: "1",
        title: "第1700回 ワールドtoto",
        notes: null,
        productType: "toto13",
        requiredMatchCount: 13,
        outcomeSetJson: ["1", "0", "2"],
        sourceNote: "スポーツくじオフィシャルサイト くじ情報",
        voidHandling: "manual",
        officialRoundName: "第1700回 ワールドtoto",
        officialRoundNumber: 1700,
        salesStartAt: null,
        salesEndAt: null,
        resultStatus: "draft",
        stakeYen: 100,
        totalSalesYen: null,
        returnRate: 0.5,
        firstPrizeShare: 0.7,
        carryoverYen: 0,
        payoutCapYen: null,
        sourceUrl: null,
        sourceText: null,
        matchCount: 13,
        matches: [],
        createdAt: "2026-04-22T00:00:00+09:00",
        updatedAt: "2026-04-22T00:00:00+09:00",
      }),
    ).toBe(true);
  });

  it("uses world cup stage hints for toto13 rounds", () => {
    expect(
      isLikelyWorldTotoRound({
        title: "第1628回 toto",
        productType: "toto13",
        matchCount: 13,
        matches: [
          { stage: "Group A", sourceText: null },
          { stage: "Group B", sourceText: null },
          { stage: "Group C", sourceText: null },
          { stage: "Group D", sourceText: null },
        ],
      }),
    ).toBe(true);
  });

  it("resolves a world toto aware product label", () => {
    expect(
      resolveWorldTotoProductLabel(
        {
          productType: "toto13",
          title: "第1700回 toto",
          matchCount: 13,
          matches: [{ stage: "Group A" }, { stage: "Group B" }, { stage: "Group C" }],
        },
        "toto",
      ),
    ).toBe("World Toto");
    expect(
      resolveWorldTotoProductLabel(
        {
          productType: "mini_toto",
          title: "第1700回 mini toto",
          matchCount: 5,
        },
        "mini toto",
      ),
    ).toBe("mini toto");
  });
});
