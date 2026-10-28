/**
 * Research-only toto（13試合3択）の等級別カバレッジ計算。
 * 旧 feat/toto-tier-coverage の案を分離・修正。UI/DB/モデル設定には接続しない。
 * 試合間・群衆投票の独立性を仮定する。払戻は期待当せん口数を分母に置く近似であり、
 * 当せん口数の確率分布を積分した厳密EVではない。実証済みの優位や利益を主張しない。
 * 1等原資 = 売上 × 還元率 × 1等配分 + キャリー。2等・3等にはキャリーを足さない。
 * 公式参照: https://www.toto-dream.com/toto/how/index.html （2026-10-28）
 * 購入・資金配分・自動運用は対象外。詳しくは docs/toto-tier-coverage-research.md。
 */

export type Outcome = 0 | 1 | 2; // 0='1'(ホーム勝) 1='0'(引分等) 2='2'(ホーム負)

export type TotoMatchProbabilities = {
  /** オッズ由来のモデル確率 [1, 0, 2]。合計1。 */
  model: readonly [number, number, number];
  /** 公式投票率から見た群衆シェア [1, 0, 2]。合計1。 */
  crowd: readonly [number, number, number];
};

export type TotoPrizeParams = {
  carryoverYen: number;
  /** 1等の1口上限（通常1億・キャリー時5億）。null で上限なし。 */
  firstPrizeCapYen: number | null;
  returnRate: number;
  salesYen: number;
  stakeYen: number;
  /** [1等, 2等, 3等] の配分。既定 0.70/0.15/0.15。 */
  tierShares: readonly [number, number, number];
};

export const TOTO_MATCH_COUNT = 13;
export const TOTO_COMBINATION_COUNT = 3 ** TOTO_MATCH_COUNT; // 1,594,323

export const defaultTotoPrizeParams: TotoPrizeParams = {
  carryoverYen: 0,
  firstPrizeCapYen: 100_000_000,
  returnRate: 0.5,
  salesYen: 100_000_000,
  stakeYen: 100,
  tierShares: [0.7, 0.15, 0.15],
};

function asPositive(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function validateMatches(matches: readonly TotoMatchProbabilities[]): void {
  if (matches.length !== TOTO_MATCH_COUNT) throw new RangeError("Exactly 13 matches required");
  for (const match of matches) {
    for (const row of [match.model, match.crowd]) {
      if (row.length !== 3 || row.some((p) => !Number.isFinite(p) || p < 0 || p > 1)
        || Math.abs(row.reduce((a, b) => a + b, 0) - 1) > 1e-8) {
        throw new RangeError("Probabilities must be finite, nonnegative and sum to one");
      }
    }
  }
}

function validatePicks(picks: readonly Outcome[]): void {
  if (picks.length !== TOTO_MATCH_COUNT || picks.some((p) => p !== 0 && p !== 1 && p !== 2)) {
    throw new RangeError("A ticket/truth must contain 13 outcome indices");
  }
}

function validatePortfolio(tickets: readonly (readonly Outcome[])[], matches: readonly TotoMatchProbabilities[], params: TotoPrizeParams): void {
  validateMatches(matches);
  tickets.forEach(validatePicks);
  const nonnegative = [params.salesYen, params.carryoverYen, params.returnRate, ...params.tierShares];
  if (nonnegative.some((v) => !Number.isFinite(v) || v < 0)
    || !Number.isFinite(params.stakeYen) || params.stakeYen <= 0
    || params.returnRate > 1 || params.tierShares.length !== 3
    || Math.abs(params.tierShares.reduce((a, b) => a + b, 0) - 1) > 1e-8
    || (params.firstPrizeCapYen !== null && asPositive(params.firstPrizeCapYen) === null)
    || params.salesYen / params.stakeYen < tickets.length) {
    throw new RangeError("Invalid prize assumptions or portfolio cost exceeds total sales");
  }
}

/**
 * 券 picks から見た「真の結果がハミング距離 0/1/2 にある確率」。
 * @param source "model" なら的中確率、"crowd" なら群衆がその距離の券を持つ割合。
 */
export function distanceProbabilities(
  picks: readonly Outcome[],
  matches: readonly TotoMatchProbabilities[],
  source: "model" | "crowd",
): [number, number, number] {
  validateMatches(matches);
  validatePicks(picks);
  return distanceProbabilitiesUnchecked(picks, matches, source);
}

function distanceProbabilitiesUnchecked(picks: readonly Outcome[], matches: readonly TotoMatchProbabilities[], source: "model" | "crowd"): [number, number, number] {
  let d0 = 1;
  let d1 = 0;
  let d2 = 0;
  for (let i = 0; i < matches.length; i += 1) {
    const p = matches[i][source][picks[i]];
    // Truncated Bernoulli convolution; p=0 and p=1 remain valid.
    d2 = d2 * p + d1 * (1 - p);
    d1 = d1 * p + d0 * (1 - p);
    d0 *= p;
  }
  return [d0, d1, d2];
}

export type TotoTierOutcome = {
  /** 自分の券のうちこの等級に該当した口数。 */
  myWinners: number;
  /** 群衆側の期待当せん口数。 */
  expectedCrowdWinners: number;
  payoutPerUnitYen: number;
  tier: 1 | 2 | 3;
};

/**
 * ある「真の結果」が起きたときの、ポートフォリオの払戻額（円）。
 * 自分の当せん口数もプールを薄めるので分母に加える（自己希薄化）。
 */
export function payoutForTruth(
  truth: readonly Outcome[],
  tickets: readonly (readonly Outcome[])[],
  matches: readonly TotoMatchProbabilities[],
  params: TotoPrizeParams,
): { totalYen: number; tiers: TotoTierOutcome[] } {
  validatePortfolio(tickets, matches, params);
  validatePicks(truth);
  return payoutForTruthUnchecked(truth, tickets, matches, params);
}

function payoutForTruthUnchecked(truth: readonly Outcome[], tickets: readonly (readonly Outcome[])[], matches: readonly TotoMatchProbabilities[], params: TotoPrizeParams): { totalYen: number; tiers: TotoTierOutcome[] } {
  const pool = params.salesYen * params.returnRate;
  const ticketCount = params.salesYen / params.stakeYen;
  const crowdDist = distanceProbabilitiesUnchecked(truth, matches, "crowd");

  const myCounts = [0, 0, 0];
  for (const t of tickets) {
    let d = 0;
    for (let i = 0; i < matches.length && d <= 2; i += 1) {
      if (t[i] !== truth[i]) d += 1;
    }
    if (d <= 2) myCounts[d] += 1;
  }

  const tiers: TotoTierOutcome[] = [];
  let totalYen = 0;
  for (let d = 0; d < 3; d += 1) {
    if (myCounts[d] === 0) continue;
    const expectedCrowdWinners = Math.max(0, (ticketCount - tickets.length) * crowdDist[d]);
    const tierPool = pool * params.tierShares[d] + (d === 0 ? params.carryoverYen : 0);
    const denom = expectedCrowdWinners + myCounts[d];
    let perUnit = denom > 0 ? tierPool / denom : 0;
    const cap = asPositive(d === 0 ? params.firstPrizeCapYen : null);
    if (cap !== null) perUnit = Math.min(perUnit, cap);
    totalYen += perUnit * myCounts[d];
    tiers.push({
      expectedCrowdWinners,
      myWinners: myCounts[d],
      payoutPerUnitYen: perUnit,
      tier: (d + 1) as 1 | 2 | 3,
    });
  }
  return { totalYen, tiers };
}

export type TotoPortfolioEvaluation = {
  costYen: number;
  evMultiple: number | null;
  expectedReturnYen: number;
  /** 各等級に少なくとも1口当たる確率。等級間は重なるので合算禁止。 */
  tierHitProbability: [number, number, number];
  /** いずれかの等級に少なくとも1口当たる確率（和集合）。 */
  anyTierHitProbability: number;
};

/**
 * 独立モデルのカバー範囲を列挙し、近似払戻を確率加重する。
 * 真結果は重複除去、等級は同じ真結果で同時成立し得る。期待口数による払戻近似は残る。
 */
export function evaluateTotoPortfolio(
  tickets: readonly (readonly Outcome[])[],
  matches: readonly TotoMatchProbabilities[],
  params: TotoPrizeParams = defaultTotoPrizeParams,
): TotoPortfolioEvaluation {
  validatePortfolio(tickets, matches, params);
  const covered = new Map<string, Outcome[]>();
  for (const ticket of tickets) {
    for (const { truth } of neighbourhood(ticket, matches.length)) {
      const key = truth.join("");
      covered.set(key, truth);
    }
  }

  let expectedReturnYen = 0;
  let anyTierHitProbability = 0;
  const tierHitProbability: [number, number, number] = [0, 0, 0];
  for (const truth of covered.values()) {
    let p = 1;
    for (let i = 0; i < matches.length; i += 1) p *= matches[i].model[truth[i]];
    if (p <= 0) continue;
    const payout = payoutForTruthUnchecked(truth, tickets, matches, params);
    for (const tier of payout.tiers) tierHitProbability[tier.tier - 1] += p;
    anyTierHitProbability += p;
    expectedReturnYen += p * payout.totalYen;
  }

  const costYen = tickets.length * params.stakeYen;
  return {
    costYen,
    evMultiple: costYen > 0 ? expectedReturnYen / costYen : null,
    expectedReturnYen,
    tierHitProbability,
    anyTierHitProbability,
  };
}

/** 券からハミング距離2以内の全組み合わせ（1 + 26 + 312 = 339通り）。 */
function* neighbourhood(
  ticket: readonly Outcome[],
  n: number,
): Generator<{ truth: Outcome[]; distance: number }> {
  yield { truth: [...ticket], distance: 0 };
  for (let i = 0; i < n; i += 1) {
    for (let a = 0 as Outcome; a < 3; a = (a + 1) as Outcome) {
      if (a === ticket[i]) continue;
      const t = [...ticket];
      t[i] = a;
      yield { truth: t, distance: 1 };
      for (let j = i + 1; j < n; j += 1) {
        for (let b = 0 as Outcome; b < 3; b = (b + 1) as Outcome) {
          if (b === ticket[j]) continue;
          const t2 = [...t];
          t2[j] = b;
          yield { truth: t2, distance: 2 };
        }
      }
    }
  }
}

/**
 * モデル確率が高い順に候補券を列挙する（ビーム探索）。全 1,594,323 通りを回さずに
 * 最適化の候補プールを作るための下ごしらえ。
 */
export function topModelCombinations(
  matches: readonly TotoMatchProbabilities[],
  limit: number,
): { picks: Outcome[]; probability: number }[] {
  validateMatches(matches);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new RangeError("Candidate limit must be 1..1000");
  let beam: { picks: Outcome[]; probability: number }[] = [{ picks: [], probability: 1 }];
  for (const match of matches) {
    const next: { picks: Outcome[]; probability: number }[] = [];
    for (const node of beam) {
      for (let k = 0 as Outcome; k < 3; k = (k + 1) as Outcome) {
        const p = match.model[k];
        if (p > 0) next.push({ picks: [...node.picks, k], probability: node.probability * p });
      }
    }
    next.sort((a, b) => b.probability - a.probability);
    beam = next.slice(0, Math.max(limit, 1));
  }
  return beam;
}

export type TotoPortfolioPlan = {
  evaluation: TotoPortfolioEvaluation;
  tickets: Outcome[][];
};

/**
 * 指定口数内で近似期待回収額が増える券を貪欲に選ぶ（大域最適の保証なし）。
 * 各ステップで「追加したときの期待回収の伸びが最大」の券を採る＝カバレッジが自然に広がる。
 */
export function optimizeTotoPortfolio(
  matches: readonly TotoMatchProbabilities[],
  budgetTickets: number,
  params: TotoPrizeParams = defaultTotoPrizeParams,
  options?: { candidatePoolSize?: number },
): TotoPortfolioPlan {
  validatePortfolio([], matches, params);
  if (!Number.isSafeInteger(budgetTickets) || budgetTickets < 0 || budgetTickets > 100
    || budgetTickets > params.salesYen / params.stakeYen) throw new RangeError("Research ticket limit must be 0..100 within total sales");
  if (budgetTickets === 0) return { tickets: [], evaluation: evaluateTotoPortfolio([], matches, params) };
  const pool = topModelCombinations(matches, options?.candidatePoolSize ?? 400);
  const chosen: Outcome[][] = [];
  let currentReturn = 0;

  for (let n = 0; n < budgetTickets && pool.length > 0; n += 1) {
    let bestIdx = -1;
    let bestReturn = currentReturn;
    for (let i = 0; i < pool.length; i += 1) {
      const trial = [...chosen, pool[i].picks];
      const r = evaluateTotoPortfolio(trial, matches, params).expectedReturnYen;
      if (r > bestReturn + 1e-9) {
        bestReturn = r;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) break;
    chosen.push(pool[bestIdx].picks);
    currentReturn = bestReturn;
    pool.splice(bestIdx, 1);
  }

  return { evaluation: evaluateTotoPortfolio(chosen, matches, params), tickets: chosen };
}
