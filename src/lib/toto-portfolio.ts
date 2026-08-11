/**
 * toto（13試合3択）の 1等/2等/3等 カバレッジ最適化。
 *
 * ── なぜ「1等狙い」をやめるのか ────────────────────────────────
 * 2026-08-10 のバックテスト（docs/toto-edge-backtest.md）で、最適券の理論EVは
 * 中央値 3.79 と +EV だが P(1等) = 1/48,722 ＝ 年30回×200口(60万円)でも到達確率
 * 11.6% と判明した。エッジは実在するのに分布が宝くじ型で回収できない。
 * 一方 2等(1外し)・3等(2外し)は当せん口数が桁違いに多く（第1644回: 1等7口 /
 * 2等152口 / 3等1,882口）、**同じモデル精度を現実的な頻度の回収に変換できる**。
 *
 * ── 賞金構造（第1644回の実配当で円単位に検証済み。テスト参照）──────────
 *   払戻原資 = 売上 × 還元率0.5 + キャリー
 *   1等 70% / 2等 15% / 3等 15%
 *   1等 = 13試合的中 / 2等 = 1外し / 3等 = 2外し
 *
 * ── 確率の数え方 ───────────────────────────────────────────────
 * 券 x に対し「真の結果が x からハミング距離 d」の確率は、r_i = (1-p_i)/p_i と置くと
 *   P(d=0) = Π p_i,  P(d=1) = Π p_i × e1(r),  P(d=2) = Π p_i × e2(r)
 * （e1,e2 は基本対称式）。群衆側も同じ形で「その真結果に対する当せん口数」を出す。
 *
 * ★群衆の組み合わせ分布は「投票率の積」を採る。第1644回の実測で検証済み:
 *   予測 8.8〜10.5口 に対し実際の1等 7口（一様分布モデルは 0.63口＝1桁外す）。
 *   積モデルはやや多めに当せん者を見積もる＝払戻を控えめに出す保守側の誤差。
 *   ※ここに「一様床」を足すと、観測済みの投票率に再度混ぜることになり
 *     「優位ゼロなら EV ≤ 還元率」の不変式が壊れる（テストで検出済み）。
 *
 * ⚠️ 本モジュールは購入額を推奨しない。EVと到達確率を出すだけで、判断は人間が行う。
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

/**
 * 券 picks から見た「真の結果がハミング距離 0/1/2 にある確率」。
 * @param source "model" なら的中確率、"crowd" なら群衆がその距離の券を持つ割合。
 */
export function distanceProbabilities(
  picks: readonly Outcome[],
  matches: readonly TotoMatchProbabilities[],
  source: "model" | "crowd",
): [number, number, number] {
  let base = 1;
  const ratios: number[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const p = matches[i][source][picks[i]];
    if (!(p > 0)) {
      return [0, 0, 0];
    }
    base *= p;
    ratios.push((1 - p) / p);
  }
  // 基本対称式 e1, e2
  let e1 = 0;
  let e2 = 0;
  for (const r of ratios) {
    e2 += e1 * r;
    e1 += r;
  }
  return [base, base * e1, base * e2];
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
  const pool = params.salesYen * params.returnRate + params.carryoverYen;
  const ticketCount = params.salesYen / params.stakeYen;
  const crowdDist = distanceProbabilities(truth, matches, "crowd");

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
    const tierPool = pool * params.tierShares[d];
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
  /** 少なくとも1等/2等/3等に当たる確率。 */
  tierHitProbability: [number, number, number];
};

/**
 * ポートフォリオの期待回収額。カバー範囲（各券の距離2以内）を列挙して厳密に評価する。
 * 券が重なっても二重計上しない（最小距離だけを採る）。
 */
export function evaluateTotoPortfolio(
  tickets: readonly (readonly Outcome[])[],
  matches: readonly TotoMatchProbabilities[],
  params: TotoPrizeParams = defaultTotoPrizeParams,
): TotoPortfolioEvaluation {
  const covered = new Map<string, { truth: Outcome[]; distance: number }>();
  for (const ticket of tickets) {
    for (const { truth, distance } of neighbourhood(ticket, matches.length)) {
      const key = truth.join("");
      const prev = covered.get(key);
      if (!prev || distance < prev.distance) covered.set(key, { truth, distance });
    }
  }

  let expectedReturnYen = 0;
  const tierHitProbability: [number, number, number] = [0, 0, 0];
  for (const { truth, distance } of covered.values()) {
    let p = 1;
    for (let i = 0; i < matches.length; i += 1) p *= matches[i].model[truth[i]];
    if (p <= 0) continue;
    tierHitProbability[distance] += p;
    expectedReturnYen += p * payoutForTruth(truth, tickets, matches, params).totalYen;
  }

  const costYen = tickets.length * params.stakeYen;
  return {
    costYen,
    evMultiple: costYen > 0 ? expectedReturnYen / costYen : null,
    expectedReturnYen,
    tierHitProbability,
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
 * 予算（口数）内で期待回収額を最大化する券の組を貪欲に選ぶ。
 * 各ステップで「追加したときの期待回収の伸びが最大」の券を採る＝カバレッジが自然に広がる。
 */
export function optimizeTotoPortfolio(
  matches: readonly TotoMatchProbabilities[],
  budgetTickets: number,
  params: TotoPrizeParams = defaultTotoPrizeParams,
  options?: { candidatePoolSize?: number },
): TotoPortfolioPlan {
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
