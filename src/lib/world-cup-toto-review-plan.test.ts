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
  worldCupToto1636ResultReview,
  worldCupToto1637ActualPurchaseSummary,
  worldCupToto1637CloseMarketSnapshot,
  worldCupToto1637ContextModel,
  worldCupToto1637ExternalMarketOverlay,
  worldCupToto1637FinalLogic,
  worldCupToto1637LongshotInsurancePlans,
  worldCupToto1637LongshotInsuranceRules,
  worldCupToto1637Matches,
  worldCupToto1637MultiPlans,
  worldCupToto1637NextPlan,
  worldCupToto1637PurchaseRows,
  worldCupToto1637PurchaseRows200,
  worldCupToto1637PurchaseRows50,
  worldCupTotoLatestReportFileName,
  worldCupTotoNextLongshotInsuranceSheetFileName,
  worldCupTotoNextPurchaseSheet200FileName,
  worldCupTotoNextPurchaseSheet50FileName,
  worldCupTotoNextPurchaseSheetFileName,
  worldCupTotoOfficialVoteInterpretation,
  worldCupTotoPhaseHeuristics,
  worldCupTotoPolymarketBacktestAudit,
  worldCupTotoReportVersion,
  worldCupTotoVersionedPurchaseSheet200FileName,
  worldCupTotoVersionedPurchaseSheet50FileName,
  worldCupTotoVersionedPurchaseSheetFileName,
  worldCupTotoVersionedLongshotInsuranceSheetFileName,
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
    expect(worldCupToto1636NextPlan.salesAsOfLabel).toBe("2026-06-20 17:02 JST pre-close snapshot");
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

  it("keeps the group-stage phase heuristic separate from the ticket rows", () => {
    expect(worldCupToto1636PhaseDecision.label).toContain("第2戦");
    expect(worldCupTotoPhaseHeuristics.map((row) => row.phase)).toEqual(["matchday1", "matchday2", "matchday3"]);
    expect(worldCupTotoPhaseHeuristics.find((row) => row.phase === "matchday2")?.riskLabel).toBe("順当寄り");
  });

  it("captures the 1636 user slip result and logic update", () => {
    expect(worldCupToto1636ResultReview.actualSignature).toBe("1212110112100");
    expect(worldCupToto1636ResultReview.userStakeYen).toBe(8_000);
    expect(worldCupToto1636ResultReview.userEstimatedPayoutYen).toBe(650);
    expect(worldCupToto1636ResultReview.userEstimatedNetYen).toBe(-7_350);
    expect(worldCupToto1636ResultReview.firstPrizeYen).toBe(956_590);
    expect(worldCupToto1636ResultReview.secondPrizeYen).toBe(6_750);
    expect(worldCupToto1636ResultReview.thirdPrizeYen).toBe(650);
    expect(worldCupToto1636ResultReview.slips[0]).toMatchObject({
      hitCount: 11,
      missedMatchNumbers: [12, 13],
      possiblePrizeLabel: "3等圏",
      unitCount: 64,
    });
    expect(worldCupToto1636ResultReview.slips[1]).toMatchObject({
      hitCount: 10,
      missedMatchNumbers: [7, 12, 13],
      possiblePrizeLabel: "圏外",
      unitCount: 16,
    });
    expect(worldCupToto1636ResultReview.logicUpdates.join(" ")).toContain("M07, M12, and M13");
  });

  it("adds the 1637 deadline strategy and preliminary 10,000 yen sheet", () => {
    const unitCount = worldCupToto1637PurchaseRows.reduce((sum, row) => sum + row.unitCount, 0);
    const spreadMatches = worldCupToto1637Matches.filter((match) => match.riskBucket === "spread");

    expect(worldCupToto1637NextPlan.purchaseDeadlineLabel).toBe("2026-06-25 19:00 JST");
    expect(worldCupToto1637NextPlan.recommendedPurchaseWindowLabel).toBe("2026-06-25 18:35-18:50 JST");
    expect(worldCupToto1637NextPlan.totalSalesYen).toBe(357_285_900);
    expect(worldCupToto1637NextPlan.voteUnits).toBe(3_572_859);
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
    expect(worldCupToto1637NextPlan.longshotInsurancePlanUnitCounts).toEqual([128, 192]);
    expect(worldCupToto1637NextPlan.longshotInsuranceRecommendedUnitCount).toBe(128);
    expect(worldCupToto1637NextPlan.longshotInsuranceRecommendedBudgetYen).toBe(12_800);
    expect(worldCupToto1637NextPlan.longshotInsuranceSheetFileName).toBe(
      worldCupTotoNextLongshotInsuranceSheetFileName,
    );
    expect(worldCupToto1637MultiPlans.map((plan) => plan.budgetYen)).toEqual([2_700, 5_400, 10_800, 16_200]);
    expect(worldCupToto1637LongshotInsurancePlans.map((plan) => plan.budgetYen)).toEqual([12_800, 19_200]);
    expect(worldCupToto1637LongshotInsurancePlans[0]?.choices).toEqual([
      "1/2",
      "1/0",
      "2",
      "0/2",
      "0/2",
      "2",
      "0/2",
      "2",
      "2",
      "1/0",
      "2",
      "2",
      "1/0",
    ]);
    expect(worldCupToto1637MultiPlans[2]?.choices).toEqual([
      "2",
      "1/0",
      "2",
      "2/0/1",
      "0/2",
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
    expect(worldCupToto1637NextPlan.workflow.map((step) => step.timeLabel)).toContain("2026-06-25 18:33");
    expect(worldCupToto1637Matches.every((match) => match.contextFactors.length > 0)).toBe(true);
    expect(worldCupToto1637Matches.find((match) => match.matchNo === 1)?.recommendedOutcomes).toContain("0");
    expect(worldCupToto1637Matches.find((match) => match.matchNo === 2)?.votes["1"]).toBeCloseTo(0.6563, 4);
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
    expect(worldCupToto1637ExternalMarketOverlay.dataStatusLabel).toContain("Hazi input disabled");
    expect(worldCupToto1637ExternalMarketOverlay.dataStatusLabel).toContain("strong-account watch");
    expect(worldCupTotoOfficialVoteInterpretation.label).toContain("日本のtoto購入者");
    expect(worldCupToto1637FinalLogic.selectedPlanLabel).toBe("市場補強108口");
    expect(worldCupToto1637FinalLogic.lockRules).toHaveLength(6);
    expect(worldCupToto1637FinalLogic.lockRules.some((rule) => rule.decision === "expand144")).toBe(true);
    expect(worldCupToto1637FinalLogic.lockRules.find((rule) => rule.checkLabel.includes("M13"))?.upgradeCondition).toContain("162口");
    expect(marketRows).toHaveLength(13);
    expect(marketRows.every((row) => row.source === "Polymarket" && row.sourceSlug.startsWith("fwc-"))).toBe(true);
    expect(marketRows.find((row) => row.matchNo === 1)?.delta["1"]).toBeGreaterThan(0.07);
    expect(marketRows.find((row) => row.matchNo === 2)?.delta["2"]).toBeGreaterThan(0.1);
    expect(marketRows.find((row) => row.matchNo === 5)?.marketFavoriteOutcome).toBe("0");
    expect(marketRows.find((row) => row.matchNo === 7)?.marketFavoriteOutcome).toBe("0");
    expect(marketRows.find((row) => row.matchNo === 13)?.actionLabel).toContain("0は残す");
    expect(marketRows.find((row) => row.matchNo === 2)?.deltaSummaryLabel).toContain("厚い 2");
    expect(worldCupToto1637ExternalMarketOverlay.decisionRules.some((rule) => rule.includes("+8pt"))).toBe(true);
    expect(worldCupToto1637ExternalMarketOverlay.decisionRules.some((rule) => rule.includes("強アカWatch"))).toBe(true);
    expect(worldCupToto1637ExternalMarketOverlay.decisionRules.some((rule) => rule.includes("Longshot insurance"))).toBe(
      true,
    );
    const m1LongshotRule = worldCupToto1637LongshotInsuranceRules.find((rule) => rule.matchNo === 1);
    expect(m1LongshotRule?.qualifies).toBe(true);
    expect(m1LongshotRule?.triggerOutcome).toBe("1");
    expect(m1LongshotRule?.favoriteOutcome).toBe("2");
    expect(m1LongshotRule?.marketToOfficialRatio).toBeGreaterThan(1.8);
    expect(worldCupToto1637ExternalMarketOverlay.longshotInsuranceRules.map((rule) => rule.matchNo)).toEqual([1]);
    expect(worldCupToto1637ExternalMarketOverlay.longshotInsurancePlans.map((plan) => plan.unitCount)).toEqual([
      128,
      192,
    ]);
    expect(marketPlans.map((plan) => plan.unitCount)).toEqual([27, 54, 108, 144, 162]);
    expect(marketPlans[2]?.choices).toEqual([
      "2",
      "1/0",
      "2",
      "2/0/1",
      "0/2/1",
      "2",
      "1/0/2",
      "2",
      "2",
      "1",
      "2",
      "2",
      "1/0",
    ]);
    expect(marketPlans[3]?.choices[2]).toBe("2/0");
  });

  it("stores the 1637 close snapshot and anonymized actual purchase slips", () => {
    expect(worldCupToto1637CloseMarketSnapshot.salesYen).toBe(357_285_900);
    expect(worldCupToto1637CloseMarketSnapshot.voteUnits).toBe(3_572_859);
    expect(worldCupToto1637CloseMarketSnapshot.rows).toHaveLength(13);
    expect(worldCupToto1637CloseMarketSnapshot.rows.find((row) => row.matchNo === 2)?.delta["2"]).toBeGreaterThan(0.1);
    expect(worldCupToto1637CloseMarketSnapshot.rows.find((row) => row.matchNo === 5)?.marketProb["0"]).toBeGreaterThan(0.42);
    expect(worldCupToto1637CloseMarketSnapshot.privacyNote).toContain("reference numbers");

    expect(worldCupToto1637ActualPurchaseSummary.slips.map((slip) => slip.unitCount)).toEqual([144, 162, 64]);
    expect(worldCupToto1637ActualPurchaseSummary.totalUnitCount).toBe(370);
    expect(worldCupToto1637ActualPurchaseSummary.totalCostYen).toBe(37_000);
    expect(worldCupToto1637ActualPurchaseSummary.slips[0]?.choices).toEqual([
      "2",
      "1/0",
      "0/2",
      "1/0/2",
      "1/0/2",
      "2",
      "1/0",
      "2",
      "2",
      "1",
      "2",
      "2",
      "1/0",
    ]);
    expect(worldCupToto1637ActualPurchaseSummary.knownResults.map((row) => [row.matchNo, row.actual])).toEqual([
      [1, "1"],
      [2, "0"],
      [3, "2"],
      [4, "0"],
      [5, "0"],
      [6, "2"],
      [7, "0"],
      [8, "2"],
      [9, "2"],
      [10, "1"],
      [11, "2"],
      [12, "2"],
      [13, "1"],
    ]);
    expect(worldCupToto1637ActualPurchaseSummary.actualSignature).toBe("1020020221221");
    expect(worldCupToto1637ActualPurchaseSummary.progressRows).toHaveLength(3);
    expect(worldCupToto1637ActualPurchaseSummary.progressRows.map((row) => row.knownHitCount)).toEqual([12, 12, 12]);
    expect(worldCupToto1637ActualPurchaseSummary.progressRows.every((row) => row.knownMissMatchNumbers.includes(1))).toBe(true);
    expect(worldCupToto1637ActualPurchaseSummary.progressRows.every((row) => row.maxFinalHitCount === 12)).toBe(true);
    expect(worldCupToto1637ActualPurchaseSummary.progressRows.map((row) => row.secondPrizeUnitCount)).toEqual([1, 1, 1]);
    expect(worldCupToto1637ActualPurchaseSummary.progressRows.map((row) => row.thirdPrizeUnitCount)).toEqual([8, 9, 6]);
    expect(worldCupToto1637ActualPurchaseSummary.estimatedSecondPrizeYen).toBe(4_344);
    expect(worldCupToto1637ActualPurchaseSummary.estimatedThirdPrizeYen).toBe(527);
    expect(worldCupToto1637ActualPurchaseSummary.estimatedPayoutYen).toBe(25_153);
    expect(worldCupToto1637ActualPurchaseSummary.summary).toContain("2nd prize 3 units");
    expect(worldCupToto1637ActualPurchaseSummary.strategyUpdates[0]).toContain("longshot insurance");
    expect(worldCupToto1637ActualPurchaseSummary.privacyNote).not.toContain("9203");
  });

  it("keeps Polymarket historical backtests strict about same-timestamp data", () => {
    const auditRows = worldCupTotoPolymarketBacktestAudit.coverageRows;

    expect(worldCupTotoPolymarketBacktestAudit.summary).toContain("prices-history");
    expect(auditRows).toHaveLength(4);
    expect(auditRows.find((row) => row.roundNumber === 1634)?.status).toBe("blocked_closed_events");
    expect(auditRows.find((row) => row.roundNumber === 1635)?.verdict).toContain("Poly比較はtoken ID待ち");
    expect(auditRows.find((row) => row.roundNumber === 1636)?.status).toBe("partial_not_strict");
    expect(auditRows.find((row) => row.roundNumber === 1637)?.status).toBe("strict_ready");
    expect(worldCupTotoPolymarketBacktestAudit.implementationRules[0]).toContain("現在価格や決済価格を混ぜない");
    expect(worldCupTotoPolymarketBacktestAudit.decisionFor1637).toContain("市場補強108口");
  });

  it("separates mutable latest links from immutable report versions", () => {
    expect(worldCupTotoLatestReportFileName).toBe("world-cup-toto-latest.pdf");
    expect(worldCupTotoNextPurchaseSheetFileName).toBe("world-cup-toto-latest-purchase-sheet.csv");
    expect(worldCupTotoNextPurchaseSheet50FileName).toBe("world-cup-toto-latest-50-purchase-sheet.csv");
    expect(worldCupTotoNextPurchaseSheet200FileName).toBe("world-cup-toto-latest-200-purchase-sheet.csv");
    expect(worldCupTotoNextLongshotInsuranceSheetFileName).toBe(
      "world-cup-toto-latest-longshot-insurance-sheet.csv",
    );
    expect(worldCupTotoVersionedReportFileName).toBe("world-cup-toto-1634-1637-evolved-plan-20260628-v25.pdf");
    expect(worldCupTotoVersionedPurchaseSheet50FileName).toBe("world-cup-toto-1637-visual-5000-plan-20260626-v23.csv");
    expect(worldCupTotoVersionedPurchaseSheetFileName).toBe("world-cup-toto-1637-visual-10000-plan-20260626-v23.csv");
    expect(worldCupTotoVersionedPurchaseSheet200FileName).toBe("world-cup-toto-1637-visual-20000-plan-20260626-v23.csv");
    expect(worldCupTotoVersionedLongshotInsuranceSheetFileName).toBe(
      "world-cup-toto-1637-longshot-insurance-20260628-v24.csv",
    );
    expect(worldCupTotoReportVersion.label).toBe("2026-06-28 v25");
    expect(worldCupTotoReportVersion.publishedAtLabel).toBe("2026-06-28 13:05 JST");
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
    const longshotCsv = readFileSync(
      resolve(process.cwd(), "public", "reports", worldCupTotoVersionedLongshotInsuranceSheetFileName),
      "utf8",
    )
      .trim()
      .split(/\r?\n/);
    const latestLongshotCsv = readFileSync(
      resolve(process.cwd(), "public", "reports", worldCupTotoNextLongshotInsuranceSheetFileName),
      "utf8",
    )
      .trim()
      .split(/\r?\n/);

    expect(csv).toHaveLength(worldCupToto1637NextPlan.recommendedUnitCount + 1);
    expect(csv50).toHaveLength(51);
    expect(csv200).toHaveLength(worldCupToto1637NextPlan.maxRecommendedUnitCount + 1);
    expect(longshotCsv).toHaveLength(worldCupToto1637LongshotInsurancePlans.length + 1);
    expect(latestLongshotCsv).toEqual(longshotCsv);
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
    expect(longshotCsv[1]?.split(",").slice(0, 4)).toEqual([
      "Longshot insurance 128",
      "Manual 64 units",
      "128",
      "12800",
    ]);
    expect(longshotCsv[1]?.split(",").slice(17, 30)).toEqual(worldCupToto1637LongshotInsurancePlans[0]?.choices);
    expect(longshotCsv[2]?.split(",").slice(17, 30)).toEqual(worldCupToto1637LongshotInsurancePlans[1]?.choices);
  });
});
