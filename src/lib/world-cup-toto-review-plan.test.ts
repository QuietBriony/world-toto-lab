import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildWorldCupToto1636PurchaseRows,
  buildWorldCupToto1637PurchaseRows,
  randomTicketHitProbability,
  WORLD_CUP_TOTO_DRAW_HEDGE_THRESHOLD,
  worldCupToto1634Review,
  worldCupToto1635Review,
  worldCupToto1636Matches,
  worldCupToto1636NextPlan,
  worldCupToto1636PhaseDecision,
  worldCupToto1636PurchaseRows,
  worldCupToto1637ContextModel,
  worldCupToto1637ExternalMarketOverlay,
  worldCupToto1637FinalLogic,
  worldCupToto1637Matches,
  worldCupToto1637MultiPlans,
  worldCupToto1637NextPlan,
  worldCupToto1637PurchaseRows,
  worldCupToto1637PurchaseRows200,
  worldCupToto1637PurchaseRows50,
  worldCupTotoLatestReportFileName,
  worldCupTotoNextPurchaseSheet200FileName,
  worldCupTotoNextPurchaseSheet50FileName,
  worldCupTotoNextPurchaseSheetFileName,
  worldCupTotoOfficialVoteInterpretation,
  worldCupTotoPhaseHeuristics,
  worldCupTotoReportVersion,
  worldCupTotoVersionedPurchaseSheet200FileName,
  worldCupTotoVersionedPurchaseSheet50FileName,
  worldCupTotoVersionedPurchaseSheetFileName,
  worldCupTotoVersionedReportFileName,
} from "@/lib/world-cup-toto-review-plan";

describe("world cup toto review plan", () => {
  it("captures the 1634 previous-report miss for the postmortem", () => {
    expect(worldCupToto1634Review.actualSignature).toBe("0010001001211");
    expect(worldCupToto1634Review.publicFavoriteSignature).toBe("2111112121221");
    expect(worldCupToto1634Review.publicFavoriteMisses).toBe(9);
    expect(worldCupToto1634Review.previousReportPositiveLineCount).toBe(9);
    expect(worldCupToto1634Review.previousReportBestDistance).toBe(3);
    expect(worldCupToto1634Review.previousReportTopRows[0]?.signature).toBe("0010102122211");
  });

  it("replays the 1635 public favorite postmortem", () => {
    expect(worldCupToto1635Review.actualSignature).toBe("1111212011011");
    expect(worldCupToto1635Review.publicFavoriteSignature).toBe("1111212111111");
    expect(worldCupToto1635Review.publicFavoriteMisses).toBe(2);
    expect(worldCupToto1635Review.publicFavoritePrize).toEqual({
      label: "3rd",
      payoutYen: 220,
    });
  });

  it("keeps random-ticket odds tied to the 13-match outcome space", () => {
    const exact200 = 1 - (1 - 1 / 3 ** 13) ** 200;

    expect(randomTicketHitProbability(200, 0)).toBeCloseTo(exact200, 12);
    expect(randomTicketHitProbability(200, 2)).toBeGreaterThan(0.04);
  });

  it("builds a 20,000 yen 1636 replay sheet with 20% draw hedges", () => {
    const signatures = new Set(worldCupToto1636PurchaseRows.map((row) => row.signature));
    const unitCount = worldCupToto1636PurchaseRows.reduce((sum, row) => sum + row.unitCount, 0);
    const drawHedgeMatches = worldCupToto1636Matches.filter(
      (match) => match.votes["0"] >= WORLD_CUP_TOTO_DRAW_HEDGE_THRESHOLD,
    );

    expect(worldCupToto1636NextPlan.drawHedgeThreshold).toBe(0.2);
    expect(worldCupToto1636NextPlan.coreLineCount).toBe(288);
    expect(worldCupToto1636NextPlan.baseCoreBudgetYen).toBe(28_800);
    expect(worldCupToto1636NextPlan.recommendedUnitCount).toBe(200);
    expect(worldCupToto1636NextPlan.recommendedBudgetYen).toBe(20_000);
    expect(worldCupToto1636NextPlan.salesAsOfLabel).toBe("2026-06-20 17:02 JST");
    expect(worldCupToto1636NextPlan.totalSalesYen).toBe(222_065_900);
    expect(worldCupToto1636PurchaseRows).toHaveLength(190);
    expect(signatures.size).toBe(190);
    expect(unitCount).toBe(200);
    expect(worldCupToto1636PurchaseRows[0]?.signature).toBe("1212020212111");
    expect(worldCupToto1636PurchaseRows[9]?.signature).toBe("0212021210111");
    expect(drawHedgeMatches.map((match) => match.matchNo)).toEqual([1, 2, 5, 6, 7, 8, 10]);
    expect(drawHedgeMatches.every((match) => match.recommendedOutcomes.includes("0"))).toBe(true);
    expect(worldCupToto1636Matches.find((match) => match.matchNo === 7)?.recommendedOutcomes).toContain("0");
    expect(worldCupToto1636PurchaseRows.slice(0, 10).every((row) => row.bucket === "hot" && row.unitCount === 2)).toBe(true);
    expect(buildWorldCupToto1636PurchaseRows(46).reduce((sum, row) => sum + row.unitCount, 0)).toBe(46);
  });

  it("keeps Hazi's group-stage phase heuristic separate from the ticket rows", () => {
    expect(worldCupToto1636PhaseDecision.label).toContain("第2戦");
    expect(worldCupTotoPhaseHeuristics.map((row) => row.phase)).toEqual(["matchday1", "matchday2", "matchday3"]);
    expect(worldCupTotoPhaseHeuristics.find((row) => row.phase === "matchday2")?.riskLabel).toBe("順当寄り");
  });

  it("adds the 1637 deadline strategy and preliminary 10,000 yen sheet", () => {
    const unitCount = worldCupToto1637PurchaseRows.reduce((sum, row) => sum + row.unitCount, 0);
    const spreadMatches = worldCupToto1637Matches.filter((match) => match.riskBucket === "spread");

    expect(worldCupToto1637NextPlan.purchaseDeadlineLabel).toBe("2026-06-25 19:00 JST");
    expect(worldCupToto1637NextPlan.recommendedPurchaseWindowLabel).toBe("2026-06-25 18:35-18:50 JST");
    expect(worldCupToto1637NextPlan.totalSalesYen).toBe(43_181_300);
    expect(worldCupToto1637NextPlan.voteUnits).toBe(431_813);
    expect(worldCupToto1637NextPlan.coreLineCount).toBe(6_912);
    expect(worldCupToto1637NextPlan.preliminaryUniqueLineCount).toBe(100);
    expect(worldCupToto1637NextPlan.recommendedUnitCount).toBe(100);
    expect(worldCupToto1637NextPlan.recommendedBudgetYen).toBe(10_000);
    expect(worldCupToto1637NextPlan.maxRecommendedUniqueLineCount).toBe(200);
    expect(worldCupToto1637NextPlan.maxRecommendedUnitCount).toBe(200);
    expect(worldCupToto1637NextPlan.maxRecommendedBudgetYen).toBe(20_000);
    expect(worldCupToto1637NextPlan.directPurchasePlanUnitCounts).toEqual([50, 100, 200]);
    expect(worldCupToto1637NextPlan.hotDoublePatternCount).toBe(0);
    expect(worldCupToto1637NextPlan.multiPurchasePlanUnitCounts).toEqual([27, 54, 108, 162]);
    expect(worldCupToto1637MultiPlans.map((plan) => plan.budgetYen)).toEqual([2_700, 5_400, 10_800, 16_200]);
    expect(worldCupToto1637MultiPlans[2]?.choices).toEqual([
      "2",
      "1/0",
      "2",
      "2/0/1",
      "2/0",
      "2",
      "1/0/2",
      "2",
      "2",
      "1/0/2",
      "2",
      "2",
      "1",
    ]);
    expect(spreadMatches.map((match) => match.matchNo)).toEqual([4, 7, 10]);
    expect(worldCupToto1637ContextModel.factors.map((factor) => factor.key)).toEqual([
      "neutral_venue",
      "country_name_bias",
      "group_situation",
      "draw_ok",
      "rotation_risk",
    ]);
    expect(worldCupToto1637NextPlan.workflow.map((step) => step.timeLabel)).toContain("2026-06-25 18:27");
    expect(worldCupToto1637Matches.every((match) => match.contextFactors.length > 0)).toBe(true);
    expect(worldCupToto1637Matches.find((match) => match.matchNo === 1)?.recommendedOutcomes).toContain("0");
    expect(worldCupToto1637Matches.find((match) => match.matchNo === 2)?.votes["1"]).toBeCloseTo(0.6454, 4);
    expect(worldCupToto1637Matches.find((match) => match.matchNo === 6)?.riskBucket).toBe("semi");
    expect(worldCupToto1637PurchaseRows50).toHaveLength(50);
    expect(worldCupToto1637PurchaseRows).toHaveLength(100);
    expect(worldCupToto1637PurchaseRows200).toHaveLength(200);
    expect(unitCount).toBe(100);
    expect(worldCupToto1637PurchaseRows50.reduce((sum, row) => sum + row.unitCount, 0)).toBe(50);
    expect(worldCupToto1637PurchaseRows200.reduce((sum, row) => sum + row.unitCount, 0)).toBe(200);
    expect(worldCupToto1637PurchaseRows[0]?.signature).toHaveLength(13);
    expect(worldCupToto1637PurchaseRows.every((row) => row.bucket === "direct" && row.unitCount === 1)).toBe(true);
    expect(buildWorldCupToto1637PurchaseRows(20).reduce((sum, row) => sum + row.unitCount, 0)).toBe(20);
  });

  it("shows how external market prices change the 1637 final selection", () => {
    const marketRows = worldCupToto1637ExternalMarketOverlay.comparisonRows;
    const marketPlans = worldCupToto1637ExternalMarketOverlay.marketAdjustedPlans;

    expect(worldCupToto1637ExternalMarketOverlay.dataStatusLabel).toContain("Polymarket");
    expect(worldCupToto1637ExternalMarketOverlay.dataStatusLabel).toContain("Hazi comment not included");
    expect(worldCupTotoOfficialVoteInterpretation.label).toContain("日本のtoto購入者");
    expect(worldCupToto1637FinalLogic.selectedPlanLabel).toBe("市場補強108口");
    expect(marketRows).toHaveLength(13);
    expect(marketRows.every((row) => row.source === "Polymarket" && row.sourceSlug.startsWith("fwc-"))).toBe(true);
    expect(marketRows.find((row) => row.matchNo === 1)?.delta["1"]).toBeGreaterThan(0.2);
    expect(marketRows.find((row) => row.matchNo === 2)?.delta["2"]).toBeGreaterThan(0.1);
    expect(marketRows.find((row) => row.matchNo === 5)?.marketProb["1"]).toBeGreaterThan(0.3);
    expect(marketRows.find((row) => row.matchNo === 7)?.marketFavoriteOutcome).toBe("0");
    expect(marketRows.find((row) => row.matchNo === 13)?.actionLabel).toContain("0を足す");
    expect(worldCupToto1637ExternalMarketOverlay.decisionRules.some((rule) => rule.includes("+8pt"))).toBe(true);
    expect(marketPlans.map((plan) => plan.unitCount)).toEqual([27, 54, 108, 162]);
    expect(marketPlans[2]?.choices).toEqual([
      "2/0/1",
      "1/0",
      "2",
      "2",
      "2/0/1",
      "2",
      "1/0/2",
      "2",
      "2",
      "1",
      "2",
      "2",
      "1/0",
    ]);
  });

  it("separates mutable latest links from immutable report versions", () => {
    expect(worldCupTotoLatestReportFileName).toBe("world-cup-toto-latest.pdf");
    expect(worldCupTotoNextPurchaseSheetFileName).toBe("world-cup-toto-latest-purchase-sheet.csv");
    expect(worldCupTotoNextPurchaseSheet50FileName).toBe("world-cup-toto-latest-50-purchase-sheet.csv");
    expect(worldCupTotoNextPurchaseSheet200FileName).toBe("world-cup-toto-latest-200-purchase-sheet.csv");
    expect(worldCupTotoVersionedReportFileName).toBe("world-cup-toto-1634-1637-evolved-plan-20260622-v15.pdf");
    expect(worldCupTotoVersionedPurchaseSheet50FileName).toBe("world-cup-toto-1637-visual-5000-plan-20260622-v15.csv");
    expect(worldCupTotoVersionedPurchaseSheetFileName).toBe("world-cup-toto-1637-visual-10000-plan-20260622-v15.csv");
    expect(worldCupTotoVersionedPurchaseSheet200FileName).toBe("world-cup-toto-1637-visual-20000-plan-20260622-v15.csv");
    expect(worldCupTotoReportVersion.label).toBe("2026-06-22 v15");
    expect(worldCupTotoReportVersion.publishedAtLabel).toBe("2026-06-22 21:55 JST");
    expect(worldCupTotoReportVersion.pdfSha256).toHaveLength(64);
    expect(worldCupTotoReportVersion.csv50Sha256).toHaveLength(64);
    expect(worldCupTotoReportVersion.csvSha256).toHaveLength(64);
    expect(worldCupTotoReportVersion.csv200Sha256).toHaveLength(64);
  });

  it("keeps the generated 1637 CSV aligned with the in-app purchase rows", () => {
    const csv = readFileSync(
      resolve(process.cwd(), "public", "reports", worldCupTotoVersionedPurchaseSheetFileName),
      "utf8",
    )
      .trim()
      .split(/\r?\n/);
    const latestCsv = readFileSync(resolve(process.cwd(), "public", "reports", worldCupTotoNextPurchaseSheetFileName), "utf8")
      .trim()
      .split(/\r?\n/);
    const csv50 = readFileSync(
      resolve(process.cwd(), "public", "reports", worldCupTotoVersionedPurchaseSheet50FileName),
      "utf8",
    )
      .trim()
      .split(/\r?\n/);
    const csv200 = readFileSync(
      resolve(process.cwd(), "public", "reports", worldCupTotoVersionedPurchaseSheet200FileName),
      "utf8",
    )
      .trim()
      .split(/\r?\n/);

    expect(csv).toHaveLength(worldCupToto1637NextPlan.recommendedUnitCount + 1);
    expect(csv50).toHaveLength(51);
    expect(csv200).toHaveLength(worldCupToto1637NextPlan.maxRecommendedUnitCount + 1);
    expect(csv[0]?.split(",").slice(0, 17)).toEqual([
      "rank",
      "amount_cumulative_yen",
      "pick_list",
      "M01 エクアドル vs ドイツ",
      "M02 日本 vs スウェーデン",
      "M03 ウルグアイ vs スペイン",
      "M04 コロンビア vs ポルトガル",
      "M05 アルジェリア vs オーストリア",
      "M06 チュニジア vs オランダ",
      "M07 パラグアイ vs オーストラリア",
      "M08 ノルウェー vs フランス",
      "M09 パナマ vs イングランド",
      "M10 コンゴ民主共和国 vs ウズベキスタン",
      "M11 ヨルダン vs アルゼンチン",
      "M12 ニュージーランド vs ベルギー",
      "M13 クロアチア vs ガーナ",
      "signature",
    ]);
    expect(csv[0]?.split(",").slice(17, 30)).toEqual(
      Array.from({ length: 13 }, (_, index) => `match_${index + 1}`),
    );
    expect(csv50[1]?.split(",")[3]).toBe("2: ドイツ勝ち");
    expect(csv50[1]?.split(",")[16]).toBe(worldCupToto1637PurchaseRows50[0]?.signature);
    expect(latestCsv[1]?.split(",")[16]).toBe(worldCupToto1637PurchaseRows[0]?.signature);
    expect(csv[1]?.split(",")[16]).toBe(worldCupToto1637PurchaseRows[0]?.signature);
    expect(csv200[1]?.split(",")[16]).toBe(worldCupToto1637PurchaseRows200[0]?.signature);
    expect(csv[100]?.split(",")[1]).toBe("10000");
    expect(csv50[50]?.split(",")[1]).toBe("5000");
    expect(csv200[200]?.split(",")[1]).toBe("20000");
    expect(csv.every((line, index) => index === 0 || line.split(",")[30] === "direct")).toBe(true);
  });
});
