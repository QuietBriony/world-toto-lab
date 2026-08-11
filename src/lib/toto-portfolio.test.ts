import { describe, expect, it } from "vitest";

import {
  defaultTotoPrizeParams,
  distanceProbabilities,
  evaluateTotoPortfolio,
  optimizeTotoPortfolio,
  payoutForTruth,
  topModelCombinations,
  TOTO_COMBINATION_COUNT,
  TOTO_MATCH_COUNT,
  type Outcome,
  type TotoMatchProbabilities,
} from "@/lib/toto-portfolio";

// ── 第1644回の実測（出典 toto.rakuten.co.jp/toto/result/1644/）────────────
// 1等 5,136,700円×7口 / 2等 50,690円×152口 / 3等 4,090円×1,882口
const ROUND_1644_PAYOUTS = [
  { payoutYen: 5_136_700, share: 0.7, winners: 7 },
  { payoutYen: 50_690, share: 0.15, winners: 152 },
  { payoutYen: 4_090, share: 0.15, winners: 1_882 },
];

// 第1644回 10:57 時点の投票率（公式 InitVoteRate）
const ROUND_1644_CROWD: readonly (readonly [number, number, number])[] = [
  [0.2956, 0.3039, 0.4005], [0.6876, 0.1795, 0.1329], [0.5883, 0.2292, 0.1825],
  [0.1078, 0.162, 0.7302], [0.8018, 0.1126, 0.0856], [0.7173, 0.1771, 0.1056],
  [0.1789, 0.2506, 0.5705], [0.3209, 0.2591, 0.42], [0.5707, 0.2285, 0.2008],
  [0.1696, 0.2464, 0.584], [0.1997, 0.2352, 0.5651], [0.5497, 0.1983, 0.252],
  [0.4869, 0.2508, 0.2623],
];
// 確定出目 2-1-2-2-1-1-0-1-1-1-1-1-1 → index 表現（0='1', 1='0', 2='2'）
const ROUND_1644_TRUTH: Outcome[] = [2, 0, 2, 2, 0, 0, 1, 0, 0, 0, 0, 0, 0];

const uniformMatches = (): TotoMatchProbabilities[] =>
  Array.from({ length: TOTO_MATCH_COUNT }, () => ({
    crowd: [1 / 3, 1 / 3, 1 / 3] as const,
    model: [1 / 3, 1 / 3, 1 / 3] as const,
  }));

const round1644Matches = (): TotoMatchProbabilities[] =>
  ROUND_1644_CROWD.map((crowd) => ({ crowd, model: crowd }));

describe("賞金構造（第1644回の実配当で検証）", () => {
  it("等級配分 70/15/15 と還元率0.5 は、3等級とも同じ売上に逆算される", () => {
    const implied = ROUND_1644_PAYOUTS.map(
      (t) => (t.payoutYen * t.winners) / (t.share * 0.5),
    );
    // 3等級の逆算売上が 1.027億円 に収束する（互いに 0.2% 以内）
    for (const s of implied) {
      expect(s).toBeGreaterThan(102_000_000);
      expect(s).toBeLessThan(103_000_000);
    }
    const spread = (Math.max(...implied) - Math.min(...implied)) / Math.min(...implied);
    expect(spread).toBeLessThan(0.002);
  });
});

describe("距離確率", () => {
  it("一様な13試合では P(d=0)=1/3^13、P(d=1)=26倍、P(d=2)=312倍になる", () => {
    const ms = uniformMatches();
    const picks = Array<Outcome>(TOTO_MATCH_COUNT).fill(0);
    const [d0, d1, d2] = distanceProbabilities(picks, ms, "model");

    expect(d0).toBeCloseTo(1 / TOTO_COMBINATION_COUNT, 12);
    expect(d1 / d0).toBeCloseTo(2 * TOTO_MATCH_COUNT, 9); // 26通り
    expect(d2 / d0).toBeCloseTo(4 * ((TOTO_MATCH_COUNT * (TOTO_MATCH_COUNT - 1)) / 2), 9); // 312通り
  });

  it("距離0〜2の確率合計は1未満（3外し以上が残る）", () => {
    const ms = round1644Matches();
    const [d0, d1, d2] = distanceProbabilities(ROUND_1644_TRUTH, ms, "model");
    expect(d0 + d1 + d2).toBeGreaterThan(0);
    expect(d0 + d1 + d2).toBeLessThan(1);
  });
});

describe("群衆の当せん口数モデル（1644で較正）", () => {
  it("積モデルは第1644回の1等7口を説明できる（一様モデルは1桁外す）", () => {
    const ms = round1644Matches();
    const N = 102_734_000 / 100; // 実配当から逆算した売上 ÷ 100円
    const [d0] = distanceProbabilities(ROUND_1644_TRUTH, ms, "crowd");
    const productModel = N * d0;
    const uniformModel = N / TOTO_COMBINATION_COUNT;

    expect(productModel).toBeGreaterThan(4);
    expect(productModel).toBeLessThan(15); // 実際は7口
    expect(uniformModel).toBeLessThan(1); // 一様だと0.6口＝10倍外す
  });

  it("2等・3等の期待口数も実測(152口/1,882口)のオーダーに乗る", () => {
    const ms = round1644Matches();
    const N = 102_734_000 / 100;
    const [, d1, d2] = distanceProbabilities(ROUND_1644_TRUTH, ms, "crowd");
    expect(N * d1).toBeGreaterThan(50);
    expect(N * d1).toBeLessThan(500);
    expect(N * d2).toBeGreaterThan(500);
    expect(N * d2).toBeLessThan(6000);
  });
});

describe("払戻の自己希薄化", () => {
  it("同じ券を増やすと1口あたり払戻が下がる（自分でプールを薄める）", () => {
    const ms = round1644Matches();
    const one = payoutForTruth(ROUND_1644_TRUTH, [ROUND_1644_TRUTH], ms, defaultTotoPrizeParams);
    const ten = payoutForTruth(
      ROUND_1644_TRUTH,
      Array.from({ length: 10 }, () => ROUND_1644_TRUTH),
      ms,
      defaultTotoPrizeParams,
    );
    const perUnitOne = one.tiers.find((t) => t.tier === 1)!.payoutPerUnitYen;
    const perUnitTen = ten.tiers.find((t) => t.tier === 1)!.payoutPerUnitYen;
    expect(perUnitTen).toBeLessThan(perUnitOne);
    // 総額は増えるが比例はしない
    expect(ten.totalYen).toBeGreaterThan(one.totalYen);
    expect(ten.totalYen).toBeLessThan(one.totalYen * 10);
  });

  it("1等の1口上限が効く（上限を下げると払戻も下がる）", () => {
    const ms = round1644Matches();
    const capped = payoutForTruth(ROUND_1644_TRUTH, [ROUND_1644_TRUTH], ms, {
      ...defaultTotoPrizeParams,
      firstPrizeCapYen: 1_000_000,
    });
    expect(capped.tiers.find((t) => t.tier === 1)!.payoutPerUnitYen).toBe(1_000_000);
  });
});

describe("ポートフォリオ評価", () => {
  it("券を増やすと2等・3等の到達確率が上がる", () => {
    const ms = round1644Matches();
    const single = evaluateTotoPortfolio([ROUND_1644_TRUTH], ms);
    const plan = optimizeTotoPortfolio(ms, 20, defaultTotoPrizeParams, { candidatePoolSize: 60 });

    expect(plan.tickets).toHaveLength(20);
    expect(plan.evaluation.tierHitProbability[1]).toBeGreaterThan(
      single.tierHitProbability[1],
    );
    expect(plan.evaluation.tierHitProbability[2]).toBeGreaterThan(
      single.tierHitProbability[2],
    );
  });

  it("モデル=群衆（優位なし）の回では、どう組んでもEVは還元率付近で頭打ちになる", () => {
    const ms = round1644Matches(); // model = crowd
    const plan = optimizeTotoPortfolio(ms, 20, defaultTotoPrizeParams, { candidatePoolSize: 60 });
    expect(plan.evaluation.evMultiple).not.toBeNull();
    expect(plan.evaluation.evMultiple!).toBeLessThan(1);
  });

  it("キャリーが乗ると同じ券構成のEVが上がる（原資倍率 r + C/S）", () => {
    const ms = round1644Matches();
    const tickets = optimizeTotoPortfolio(ms, 10, defaultTotoPrizeParams, {
      candidatePoolSize: 40,
    }).tickets;
    const plain = evaluateTotoPortfolio(tickets, ms, defaultTotoPrizeParams);
    const withCarry = evaluateTotoPortfolio(tickets, ms, {
      ...defaultTotoPrizeParams,
      carryoverYen: 36_000_000,
      firstPrizeCapYen: 500_000_000,
    });
    expect(withCarry.evMultiple!).toBeGreaterThan(plain.evMultiple!);
  });

  it("重複する券を二重計上しない（同じ券を2枚持ってもカバー範囲は広がらない）", () => {
    const ms = round1644Matches();
    const one = evaluateTotoPortfolio([ROUND_1644_TRUTH], ms);
    const dup = evaluateTotoPortfolio([ROUND_1644_TRUTH, ROUND_1644_TRUTH], ms);
    for (let d = 0; d < 3; d += 1) {
      expect(dup.tierHitProbability[d]).toBeCloseTo(one.tierHitProbability[d], 12);
    }
  });
});

describe("候補列挙", () => {
  it("モデル確率の降順で返し、先頭はモデル本命線になる", () => {
    const ms = round1644Matches();
    const top = topModelCombinations(ms, 10);
    expect(top).toHaveLength(10);
    for (let i = 1; i < top.length; i += 1) {
      expect(top[i - 1].probability).toBeGreaterThanOrEqual(top[i].probability);
    }
    const favourite = ms.map((m) =>
      m.model.indexOf(Math.max(...m.model)) as Outcome,
    );
    expect(top[0].picks).toEqual(favourite);
  });
});
