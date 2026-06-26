import { describe, expect, it } from "vitest";

import type { DashboardRoundSummary, Match, RoundEvAssumption } from "@/lib/types";
import {
  buildWorldCupStrategyDashboard,
  calculateWorldCupSecondPrizeCoverage,
  enumeratePositiveEvCombos,
  hammingDistance,
  outcomePolicyFor,
  resolveFeaturedWorldTotoRoundNumber,
  worldCupEvGlossaryRows,
} from "@/lib/world-cup-strategy";
import { modelSeed } from "@/lib/world-toto-strength";

function buildMatch(matchNo: number, overrides: Partial<Match> = {}): Match {
  return {
    actualResult: null,
    adminAdjust0: null,
    adminAdjust1: null,
    adminAdjust2: null,
    adminNote: null,
    altitudeHumidityAdjust: null,
    availabilityAdjust: null,
    availabilityInfo: null,
    awayStrengthAdjust: null,
    awayTeam: `Away ${matchNo}`,
    category: null,
    conditionsAdjust: null,
    conditionsInfo: null,
    confidence: null,
    consensusCall: null,
    consensusD: null,
    consensusF: null,
    createdAt: "2026-06-07T08:56:00+09:00",
    disagreementScore: null,
    exceptionCount: null,
    fixtureMasterId: null,
    groupStandingMotivationAdjust: null,
    homeAdvantageAdjust: null,
    homeStrengthAdjust: null,
    homeTeam: `Home ${matchNo}`,
    id: `match-${matchNo}`,
    injuryNote: null,
    injurySuspensionAdjust: null,
    kickoffTime: null,
    leagueTableMotivationAdjust: null,
    marketProb0: null,
    marketProb1: null,
    marketProb2: null,
    matchNo,
    modelProb0: 0.2,
    modelProb1: 0.6,
    modelProb2: 0.2,
    motivationAdjust: null,
    motivationNote: null,
    officialMatchNo: matchNo,
    officialVote0: 0.15,
    officialVote1: 0.7,
    officialVote2: 0.15,
    recentFormNote: null,
    recommendedOutcomes: null,
    restDaysAdjust: null,
    rotationRiskAdjust: null,
    roundId: "round-1634",
    squadDepthAdjust: null,
    stage: null,
    tacticalAdjust: null,
    tacticalNote: null,
    tournamentPressureAdjust: null,
    travelAdjust: null,
    travelClimateAdjust: null,
    updatedAt: "2026-06-07T08:56:00+09:00",
    venue: null,
    ...overrides,
  };
}

function buildRound(matches: Match[]): DashboardRoundSummary {
  return {
    activeMatchCount: matches.length,
    budgetYen: null,
    candidateTicketCount: 0,
    competitionType: "world_cup",
    consensusCompletion: 0,
    createdAt: "2026-06-07T08:56:00+09:00",
    dataProfile: "worldcup_rich",
    id: "round-1634",
    matchCount: matches.length,
    matches,
    notes: null,
    outcomeSetJson: ["1", "0", "2"],
    participantIds: [],
    pickCount: 0,
    picks: [],
    primaryUse: "real_round_research",
    probabilityReadiness: "ready",
    productType: "toto13",
    requiredMatchCount: 13,
    resultedCount: 0,
    reviewNotes: [],
    roundSource: "toto_official_manual",
    scoutReports: [],
    sourceNote: "toto公式 第1634回 / 指定公示済み / 2026-06-07 08:48-08:56時点",
    sportContext: "national_team",
    status: "analyzing",
    title: "第1634回 toto W杯本番",
    topSignals: [],
    updatedAt: "2026-06-07T08:56:00+09:00",
    voidHandling: "manual",
  };
}

function buildAssumption(): RoundEvAssumption {
  return {
    carryoverYen: 0,
    createdAt: "2026-06-07T08:56:00+09:00",
    firstPrizeShare: 0.7,
    id: "assumption",
    note: null,
    payoutCapYen: null,
    returnRate: 0.5,
    roundId: "round-1634",
    stakeYen: 100,
    totalSalesYen: 100000,
    updatedAt: "2026-06-07T08:56:00+09:00",
  };
}

describe("world cup strategy", () => {
  it("calculates signature distance for prize coverage", () => {
    expect(hammingDistance("102", "102")).toBe(0);
    expect(hammingDistance("102", "112")).toBe(1);
    expect(hammingDistance("102", "220")).toBe(3);
  });

  it("marks second prize guarantee only when the declared universe is fully covered", () => {
    const guaranteed = calculateWorldCupSecondPrizeCoverage({
      outcomePolicies: [
        { allowedOutcomes: ["1", "0"] },
        { allowedOutcomes: ["1", "0"] },
      ],
      rows: [{ signature: "11" }, { signature: "00" }],
    });
    const partial = calculateWorldCupSecondPrizeCoverage({
      outcomePolicies: [
        { allowedOutcomes: ["1", "0"] },
        { allowedOutcomes: ["1", "0"] },
        { allowedOutcomes: ["1", "0"] },
      ],
      rows: [{ signature: "111" }],
    });

    expect(guaranteed.ready).toBe(true);
    expect(guaranteed.guaranteedSecondPrize).toBe(true);
    expect(guaranteed.secondPrizeCoverageRate).toBe(1);
    expect(guaranteed.exactCoveredCount).toBe(2);
    expect(partial.ready).toBe(true);
    expect(partial.guaranteedSecondPrize).toBe(false);
    expect(partial.secondPrizeCoverageRate).toBe(0.5);
  });

  it("recognizes the featured World Toto round", () => {
    expect(
      resolveFeaturedWorldTotoRoundNumber({
        sourceNote: "toto公式 第1634回 / 指定公示済み",
        title: "第1634回 toto W杯本番",
      }),
    ).toBe(1634);
  });

  it("keeps the published sales deadline for round 1634", () => {
    const strategy = buildWorldCupStrategyDashboard({
      now: new Date("2026-06-14T00:00:00+09:00"),
      rounds: [],
    });
    const round1634 = strategy.rounds[0];

    expect(round1634.featured.roundNumber).toBe(1634);
    expect(round1634.featured.salesEndAt).toBe("2026-06-12T19:00:00+09:00");
    expect(round1634.windowStatus).toBe("closed");
  });

  it("summarizes the known final vote snapshot for round 1634", () => {
    const strategy = buildWorldCupStrategyDashboard({
      now: new Date("2026-06-14T00:00:00+09:00"),
      rounds: [],
    });
    const snapshot = strategy.rounds[0].finalSnapshot;

    expect(snapshot?.sourceAsOfLabel).toBe("2026年06月12日販売終了時点");
    expect(snapshot?.totalSalesYen).toBe(289166800);
    expect(snapshot?.salesMultiple).toBeCloseTo(20.7159, 4);
    expect(snapshot?.favoriteChangeCount).toBe(0);
    expect(snapshot?.maxAbsVoteShareDeltaPt).toBeCloseTo(10.43, 2);
  });

  it("builds a strict orthodox EV line when model, official, and sales inputs are ready", () => {
    const strategy = buildWorldCupStrategyDashboard({
      now: new Date("2026-06-11T12:00:00+09:00"),
      rounds: [buildRound(Array.from({ length: 13 }, (_value, index) => buildMatch(index + 1)))],
    });
    const round1634 = strategy.rounds[0];

    expect(round1634.strictEvReady).toBe(true);
    expect(round1634.orthodoxLine?.strictEvReady).toBe(true);
    expect(round1634.orthodoxLine?.estimatedPayoutYen).toBeGreaterThan(0);
  });

  it("uses the final sales snapshot for closed round 1634 EV inputs", () => {
    const strategy = buildWorldCupStrategyDashboard({
      now: new Date("2026-06-14T00:00:00+09:00"),
      rounds: [buildRound(Array.from({ length: 13 }, (_value, index) => buildMatch(index + 1)))],
    });
    const round1634 = strategy.rounds[0];

    expect(round1634.strictEvReady).toBe(true);
    expect(round1634.evAssumption?.totalSalesYen).toBe(289166800);
    expect(round1634.featured.totalSalesYen).toBe(13958700);
  });

  it("builds visible portfolio picks from the built-in closed round 1634 snapshot", () => {
    const strategy = buildWorldCupStrategyDashboard({
      includePositiveCombos: true,
      now: new Date("2026-06-15T12:00:00+09:00"),
      positiveComboLimit: 120,
      rounds: [],
    });
    const round1634 = strategy.rounds[0];
    const plan10000 = round1634.portfolioPlans.find((plan) => plan.budgetYen === 10000);

    expect(round1634.strictEvReady).toBe(true);
    expect(round1634.strictEvMissingReasons).toEqual([]);
    expect(round1634.positiveEv.rows.length).toBeGreaterThan(0);
    expect(plan10000?.lineCount).toBeGreaterThan(0);
    expect(plan10000?.lineCount).toBeLessThanOrEqual(100);
    expect(plan10000?.costYen).toBe((plan10000?.lineCount ?? 0) * 100);
    expect(plan10000?.expectedReturnYen).toBeGreaterThan(plan10000?.costYen ?? 0);
    expect(plan10000?.secondPrizeCoverage.ready).toBe(true);
    expect(plan10000?.secondPrizeCoverage.secondPrizeCoverageRate).toBe(1);
    expect(plan10000?.rows[0]?.strategyBucket).toBeTruthy();
    expect(round1634.marketEvComparisonRows.map((row) => row.key)).toContain("market_proxy_portfolio");
    expect(round1634.marketEvVerdict).toContain("market proxy");
  });

  it("documents EV terms and separates official crowd from predictive market proxy", () => {
    const seed = modelSeed({
      awayTeam: "繧ｹ繧､繧ｹ",
      homeTeam: "繧ｫ繧ｿ繝ｼ繝ｫ",
      officialVote0: 0.1,
      officialVote1: 0.2,
      officialVote2: 0.7,
    });

    expect(worldCupEvGlossaryRows.map((row) => row.term)).toEqual(
      expect.arrayContaining(["EV", "p_model", "p_public", "予測市場EV", "期待損益"]),
    );
    expect(seed.modelSource).toBe("team_strength_with_official_crowd");
    expect(seed.marketProb0).not.toBe(0.1);
    expect(seed.marketProb1).not.toBe(0.2);
    expect(seed.marketProb2).not.toBe(0.7);
  });

  it("turns a closed final snapshot into a review command", () => {
    const strategy = buildWorldCupStrategyDashboard({
      now: new Date("2026-06-14T00:00:00+09:00"),
      rounds: [buildRound(Array.from({ length: 13 }, (_value, index) => buildMatch(index + 1)))],
    });
    const round1634 = strategy.rounds[0];

    expect(round1634.commandStatusLabel).toBe("締切後の感想戦");
    expect(round1634.recommendedActionLabel).toBe("確定値で感想戦");
    expect(round1634.orthodoxDecisionLabel).toBe("王道は外す候補");
    expect(round1634.timingChecklist.find((item) => item.actionLabel === "確定値で感想戦")?.enabled).toBe(true);
  });

  it("asks for official data refresh on a buyable round with missing EV inputs", () => {
    const strategy = buildWorldCupStrategyDashboard({
      now: new Date("2026-06-14T00:00:00+09:00"),
      rounds: [buildRound(Array.from({ length: 13 }, (_value, index) => buildMatch(index + 1)))],
    });
    const round1635 = strategy.rounds[1];

    expect(round1635.windowStatus).toBe("selling");
    expect(round1635.commandStatusLabel).toBe("買える・データ待ち");
    expect(round1635.recommendedActionLabel).toBe("公式データを再取得");
    expect(round1635.timingChecklist[0].enabled).toBe(true);
  });

  it("builds practical budget plans for 10 tickets and 100 tickets", () => {
    const valueMatches = Array.from({ length: 13 }, (_value, index) =>
      buildMatch(index + 1, {
        modelProb0: 0.18,
        modelProb1: 0.18,
        modelProb2: 0.64,
        officialVote0: 0.05,
        officialVote1: 0.9,
        officialVote2: 0.05,
      }),
    );
    const strategy = buildWorldCupStrategyDashboard({
      includePositiveCombos: true,
      now: new Date("2026-06-11T12:00:00+09:00"),
      positiveComboLimit: 120,
      rounds: [buildRound(valueMatches)],
    });
    const round1634 = strategy.rounds[0];
    const plan1000 = round1634.portfolioPlans.find((plan) => plan.budgetYen === 1000);
    const plan10000 = round1634.portfolioPlans.find((plan) => plan.budgetYen === 10000);

    expect(plan1000?.requestedLineCount).toBe(10);
    expect(plan1000?.lineCount).toBe(10);
    expect(plan1000?.costYen).toBe(1000);
    expect(plan1000?.meetsBudget).toBe(true);
    expect(plan10000?.requestedLineCount).toBe(100);
    expect(plan10000?.lineCount).toBe(100);
    expect(plan10000?.costYen).toBe(10000);
    expect(plan10000?.expectedReturnYen).toBeGreaterThan(10000);
    expect(plan10000?.firstPrizeExpectedReturnYen).toBeLessThan(plan10000?.expectedReturnYen ?? 0);
    expect(plan10000?.cashProbabilityUpperBound).toBeGreaterThan(plan10000?.hitProbabilityUpperBound ?? 0);
    expect(plan10000?.secondPrizeCoverage.ready).toBe(true);
    expect(plan10000?.secondPrizeCoverage.universeCount).toBeGreaterThan(0);
    expect(plan10000?.secondPrizeCoverage.secondPrizeCoverageRate).toBeGreaterThan(0);
    expect(round1634.primaryPortfolioPlan?.budgetYen).toBe(10000);
  });

  it("keeps practical budget plans when the positive EV table is omitted", () => {
    const valueMatches = Array.from({ length: 13 }, (_value, index) =>
      buildMatch(index + 1, {
        modelProb0: 0.18,
        modelProb1: 0.18,
        modelProb2: 0.64,
        officialVote0: 0.05,
        officialVote1: 0.9,
        officialVote2: 0.05,
      }),
    );
    const strategy = buildWorldCupStrategyDashboard({
      includePositiveCombos: false,
      now: new Date("2026-06-11T12:00:00+09:00"),
      rounds: [buildRound(valueMatches)],
    });
    const round1634 = strategy.rounds[0];
    const plan10000 = round1634.portfolioPlans.find((plan) => plan.budgetYen === 10000);

    expect(round1634.positiveEv.rows).toHaveLength(0);
    expect(plan10000?.lineCount).toBe(100);
    expect(plan10000?.expectedReturnYen).toBeGreaterThan(10000);
    expect(round1634.primaryPortfolioPlan?.budgetYen).toBe(10000);
  });

  it("enumerates positive EV combinations in descending EV order", () => {
    const result = enumeratePositiveEvCombos({
      assumption: buildAssumption(),
      limit: 3,
      matches: [
        buildMatch(1, {
          modelProb0: 0.1,
          modelProb1: 0.1,
          modelProb2: 0.8,
          officialVote0: 0.05,
          officialVote1: 0.9,
          officialVote2: 0.05,
        }),
        buildMatch(2, {
          modelProb0: 0.1,
          modelProb1: 0.1,
          modelProb2: 0.8,
          officialVote0: 0.05,
          officialVote1: 0.9,
          officialVote2: 0.05,
        }),
      ],
    });

    expect(result.ready).toBe(true);
    expect(result.evaluatedCount).toBe(9);
    expect(result.totalPositiveCount).toBeGreaterThan(0);
    expect(result.rows[0].signature).toBe("22");
    expect(result.rows[0].evMultiple).toBeGreaterThan(result.rows[1].evMultiple);
    expect(result.rows[0].prizeTiers).toHaveLength(1);
  });

  it("includes second and third prize tiers in 13-match positive EV rows", () => {
    const valueMatches = Array.from({ length: 13 }, (_value, index) =>
      buildMatch(index + 1, {
        modelProb0: 0.18,
        modelProb1: 0.18,
        modelProb2: 0.64,
        officialVote0: 0.05,
        officialVote1: 0.9,
        officialVote2: 0.05,
      }),
    );
    const result = enumeratePositiveEvCombos({
      assumption: buildAssumption(),
      limit: 1,
      matches: valueMatches,
    });

    expect(result.rows[0]?.prizeTiers.map((tier) => tier.label)).toEqual(["1等", "2等", "3等"]);
    expect(result.rows[0]?.expectedReturnYen).toBeGreaterThan(
      result.rows[0]?.firstPrizeExpectedReturnYen ?? 0,
    );
    expect(result.rows[0]?.cashProbability).toBeGreaterThan(result.rows[0]?.hitProbability ?? 0);
  });

  it("guards the candidate universe so all-open 13-match rounds stay fast (no 3^13 freeze)", () => {
    // 13 試合すべて open（本命 < 65% でロックされない）＝本来 3^13 = 1,594,323 通り。
    // ガードが各試合をモデル上位 2 出目に縮約し、宇宙を 2^13 = 8192 以下へ抑える。
    const openMatches = Array.from({ length: 13 }, (_value, index) =>
      buildMatch(index + 1, {
        modelProb0: 0.33,
        modelProb1: 0.34,
        modelProb2: 0.33,
        officialVote0: 0.33,
        officialVote1: 0.34,
        officialVote2: 0.33,
      }),
    );
    const result = enumeratePositiveEvCombos({
      assumption: buildAssumption(),
      limit: 50,
      matches: openMatches,
    });

    expect(result.ready).toBe(true);
    // 159万通りを全探索せず、縮約後の宇宙（≤ 2^13）だけを評価する。
    expect(result.evaluatedCount).not.toBeNull();
    expect(result.evaluatedCount ?? 0).toBeLessThanOrEqual(8192);
    expect(result.evaluatedCount ?? 0).toBeGreaterThan(0);
    // 縮約が起きたので truncated=true（一部の最下位モデル出目を除外）。
    expect(result.truncated).toBe(true);
  });

  it("does not truncate rounds whose universe is within the limit", () => {
    const result = enumeratePositiveEvCombos({
      assumption: buildAssumption(),
      limit: 3,
      matches: [
        buildMatch(1, { modelProb0: 0.1, modelProb1: 0.1, modelProb2: 0.8 }),
        buildMatch(2, { modelProb0: 0.1, modelProb1: 0.1, modelProb2: 0.8 }),
      ],
    });

    // 2 試合 = 3^2 = 9 通りは上限内なので全 outcome を評価（縮約なし）。
    expect(result.ready).toBe(true);
    expect(result.evaluatedCount).toBe(9);
  });

  it("recalibrated 65% lock fires for strong favorites on the featured rounds", () => {
    // featured 第1636回は team-strength prior でモデル本命の最大が約0.699。
    // 旧閾値 0.7 では1件もロックされず候補宇宙が膨張していたが、0.65 では強い本命が
    // ロックされるようになる（buildWorldCupStrategyDashboard は実モデル確率を再計算する）。
    const dash = buildWorldCupStrategyDashboard({ rounds: [], includePositiveCombos: false });
    const round1636 = dash.rounds.find((round) => round.featured.roundNumber === 1636);

    expect(round1636).toBeTruthy();
    const lockPolicies = round1636!.outcomePolicies.filter(
      (policy) => policy.kind === "model_lock",
    );
    expect(lockPolicies.length).toBeGreaterThan(0);
    expect(lockPolicies[0]?.label).toBe("65%以上ロック");
    // ロックは1出目だけを残す。
    expect(lockPolicies[0]?.allowedOutcomes).toHaveLength(1);
  });

  it("fixes known actual results and locks 70 percent model favorites in portfolio search", () => {
    const actualByMatchNo = new Map<number, "1" | "0" | "2">([
      [1, "0"],
      [2, "0"],
      [3, "1"],
      [4, "0"],
      [6, "0"],
      [11, "2"],
      [12, "1"],
      [13, "1"],
    ]);
    const matches = Array.from({ length: 13 }, (_value, index) => {
      const matchNo = index + 1;
      const target = actualByMatchNo.get(matchNo) ?? "2";

      return buildMatch(matchNo, {
        modelProb0: target === "0" ? 0.8 : 0.1,
        modelProb1: target === "1" ? 0.8 : 0.1,
        modelProb2: target === "2" ? 0.8 : 0.1,
        officialVote0: target === "0" ? 0.05 : target === "1" ? 0.9 : 0.05,
        officialVote1: target === "1" ? 0.05 : target === "2" ? 0.9 : 0.05,
        officialVote2: target === "2" ? 0.05 : target === "0" ? 0.9 : 0.05,
      });
    });
    const strategy = buildWorldCupStrategyDashboard({
      includePositiveCombos: true,
      now: new Date("2026-06-14T00:00:00+09:00"),
      positiveComboLimit: 3,
      rounds: [buildRound(matches)],
    });
    const round1634 = strategy.rounds[0];

    expect(round1634.outcomePolicies.find((policy) => policy.matchNo === 1)?.kind).toBe("actual_fixed");
    expect(round1634.outcomePolicies.find((policy) => policy.matchNo === 1)?.allowedOutcomes).toEqual(["0"]);
    expect(round1634.outcomePolicies.find((policy) => policy.matchNo === 5)?.kind).toBe("model_lock");
    expect(round1634.positiveEv.evaluatedCount).toBe(1);
    expect(round1634.positiveEv.rows[0]?.picks.find((pick) => pick.matchNo === 1)?.pick).toBe("0");
    expect(round1634.positiveEv.rows[0]?.picks.find((pick) => pick.matchNo === 11)?.pick).toBe("2");
    expect(round1634.evSourceRows.map((row) => row.label)).toContain("EV式");
    expect(round1634.predictionLogicRows.map((row) => row.label)).toContain("Poisson / Dixon-Colesでドローを詰める");
    expect(round1634.postMortemPrompts.length).toBeGreaterThan(0);
  });

  it("uses the 1635 final snapshot and result for postmortem analysis", () => {
    const strategy = buildWorldCupStrategyDashboard({
      now: new Date("2026-06-20T12:00:00+09:00"),
      rounds: [buildRound(Array.from({ length: 13 }, (_value, index) => buildMatch(index + 1)))],
    });
    const round1635 = strategy.rounds[1];

    expect(round1635.strictEvReady).toBe(true);
    expect(round1635.finalSnapshot?.totalSalesYen).toBe(252_729_800);
    expect(round1635.outcomePolicies.find((policy) => policy.matchNo === 8)?.allowedOutcomes).toEqual(["0"]);
    expect(round1635.outcomePolicies.find((policy) => policy.matchNo === 11)?.allowedOutcomes).toEqual(["0"]);
  });

  it("explains missing strict EV inputs for unpublished future rounds", () => {
    const strategy = buildWorldCupStrategyDashboard({
      now: new Date("2026-06-14T00:00:00+09:00"),
      rounds: [buildRound(Array.from({ length: 13 }, (_value, index) => buildMatch(index + 1)))],
    });
    const round1637 = strategy.rounds[3];

    expect(round1637.strictEvReady).toBe(false);
    expect(round1637.strictEvMissingReasons).toContain("売上総額が未確定");
    expect(round1637.strictEvMissingReasons).toContain("公式投票率が不足");
  });

  it("hedges crowd overconfidence when the market is cooler on the same favorite", () => {
    // 公式人気は本命(2)に78%集中だが、市場ベースのモデルは同じ本命を58%止まり(-20pt)。
    // value_fade(人気過剰外し)は「本命がズレる」専用なので拾えない過信ギャップを本命過信ヘッジで拾う。
    const policy = outcomePolicyFor(
      buildMatch(1, {
        modelProb0: 0.24,
        modelProb1: 0.18,
        modelProb2: 0.58,
        officialVote0: 0.12,
        officialVote1: 0.1,
        officialVote2: 0.78,
      }),
    );

    expect(policy.kind).toBe("value_fade");
    expect(policy.label).toBe("本命過信ヘッジ");
    // 単独ロックせず、分(0) と本命(2) を残す。
    expect(policy.allowedOutcomes).toContain("0");
    expect(policy.allowedOutcomes).toContain("2");
    expect(policy.allowedOutcomes).not.toHaveLength(1);
  });

  it("does not hedge when market and public agree the favorite is strong (gap < 8pt)", () => {
    // 公式70% / モデル64% = gap 6pt < 8pt。市場も本命を強いと見ているのでヘッジしない。
    const policy = outcomePolicyFor(
      buildMatch(1, {
        modelProb0: 0.2,
        modelProb1: 0.16,
        modelProb2: 0.64,
        officialVote0: 0.15,
        officialVote1: 0.15,
        officialVote2: 0.7,
      }),
    );

    expect(policy.label).not.toBe("本命過信ヘッジ");
    expect(policy.kind).toBe("open");
  });
});
