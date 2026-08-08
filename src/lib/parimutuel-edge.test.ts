import { describe, expect, it } from "vitest";

import { bigTrueEvUpperBound } from "@/lib/big-carryover/calculator";
import {
  parimutuelEvBreakdown,
  prizePoolMultiple,
  requiredCrowdEdgeRatio,
  SPORTS_LOTTERY_RETURN_RATE,
} from "@/lib/parimutuel-edge";

describe("控除率の壁（必要な優位比）", () => {
  it("キャリー無しのスポーツくじは群衆の2.0倍の精度を要求する", () => {
    expect(requiredCrowdEdgeRatio({ returnRate: SPORTS_LOTTERY_RETURN_RATE })).toBeCloseTo(2, 10);
  });

  it("控除率が低い場ほど必要な優位比は1に近づく（モデルの価値は出口で決まる）", () => {
    const lottery = requiredCrowdEdgeRatio({ returnRate: 0.5 })!;
    const koei = requiredCrowdEdgeRatio({ returnRate: 0.75 })!; // 公営競技の目安
    const lowFee = requiredCrowdEdgeRatio({ returnRate: 0.98 })!; // 手数料数%の場

    expect(lottery).toBeCloseTo(2.0, 10);
    expect(koei).toBeCloseTo(1.333, 3);
    expect(lowFee).toBeCloseTo(1.02, 3);
    expect(lottery).toBeGreaterThan(koei);
    expect(koei).toBeGreaterThan(lowFee);
  });

  it("キャリーが厚いと必要な優位比が1を割る＝群衆と同じ予想でも+EVになる", () => {
    // 第1644回 MEGA BIG 相当: キャリー97.5億・最終売上9億なら原資倍率は11倍超。
    const required = requiredCrowdEdgeRatio({
      carryoverYen: 9_749_023_755,
      finalSalesYen: 900_000_000,
      returnRate: 0.5,
    })!;
    expect(required).toBeLessThan(1);
  });

  it("キャリーがあるのに売上不明なら null を返す（キャリーを黙って無視しない）", () => {
    expect(
      prizePoolMultiple({ carryoverYen: 5_000_000_000, finalSalesYen: null, returnRate: 0.5 }),
    ).toBeNull();
    // キャリー0なら売上に依存しないので払戻率をそのまま返す。
    expect(prizePoolMultiple({ carryoverYen: 0, finalSalesYen: null, returnRate: 0.5 })).toBe(0.5);
  });
});

describe("BIG レーンとの不変式一致", () => {
  it("群衆と同じ予想(p_model = p_public)のEVは bigTrueEvUpperBound と一致する", () => {
    const carryoverYen = 4_602_871_860;
    const finalSalesYen = 1_087_198_140;
    const returnRate = 0.5;

    const breakdown = parimutuelEvBreakdown({
      carryoverYen,
      crowdProbability: 0.25,
      finalSalesYen,
      modelProbability: 0.25,
      returnRate,
    });
    const bigUpperBound = bigTrueEvUpperBound({
      carryoverYen,
      projectedFinalSalesYen: finalSalesYen,
      returnRate,
    });

    expect(breakdown.crowdEdgeRatio).toBeCloseTo(1, 10);
    expect(breakdown.evMultiple).toBeCloseTo(bigUpperBound!, 10);
  });

  it("第1476回の実現アグリゲートEV(≈1.737)を再現する", () => {
    // 中止4試合・最終売上47.13億・キャリー58.3億。calculator.test.ts の実測不変式と同値。
    const breakdown = parimutuelEvBreakdown({
      carryoverYen: 5_830_000_000,
      crowdProbability: 0.1,
      finalSalesYen: 4_713_264_600,
      modelProbability: 0.1,
      returnRate: 0.5,
    });
    expect(breakdown.evMultiple).toBeCloseTo(1.7369, 3);
  });
});

describe("EV の分解（どちらの因子で勝ち負けしているか）", () => {
  it("群衆の2倍ちょうどの精度で損益分岐に乗る", () => {
    const breakdown = parimutuelEvBreakdown({
      crowdProbability: 0.2,
      modelProbability: 0.4,
      returnRate: 0.5,
    });
    expect(breakdown.crowdEdgeRatio).toBeCloseTo(2, 10);
    expect(breakdown.evMultiple).toBeCloseTo(1, 10);
    expect(breakdown.clearsTakeout).toBe(true);
  });

  it("ドイツ戦型（公衆73.8%・市場64.3%）は正しく当てても控除率を越えない", () => {
    // 第1637回 M01 の実例: 公衆がドイツを過信していると分かっても、優位比は 0.87 にしかならず
    // 2.0 には遠い。「公衆過信の発見」は割引理由であって +EV の理由ではない。
    const breakdown = parimutuelEvBreakdown({
      crowdProbability: 0.738,
      modelProbability: 0.643,
      returnRate: SPORTS_LOTTERY_RETURN_RATE,
    });
    expect(breakdown.crowdEdgeRatio).toBeCloseTo(0.871, 3);
    expect(breakdown.evMultiple).toBeLessThan(1);
    expect(breakdown.clearsTakeout).toBe(false);
    expect(breakdown.warnings.length).toBeGreaterThan(0);
  });

  it("逆側（公衆が嫌っている出目を市場が支持）なら優位比が立つ", () => {
    // 同じ試合の裏側: 公衆 26.2% に対し市場 35.7% を見込むなら優位比 1.36。
    // それでも r=0.5 では 0.68 で届かない＝toto側で勝つには群衆がもっと極端に外れている必要がある。
    const breakdown = parimutuelEvBreakdown({
      crowdProbability: 0.262,
      modelProbability: 0.357,
      returnRate: SPORTS_LOTTERY_RETURN_RATE,
    });
    expect(breakdown.crowdEdgeRatio).toBeCloseTo(1.363, 3);
    expect(breakdown.evMultiple).toBeCloseTo(0.681, 3);
    expect(breakdown.clearsTakeout).toBe(false);
  });

  it("p_public=0（誰も張っていない）は割れないので null で返す", () => {
    const breakdown = parimutuelEvBreakdown({
      crowdProbability: 0,
      modelProbability: 0.4,
      returnRate: 0.5,
    });
    expect(breakdown.evMultiple).toBeNull();
    expect(breakdown.warnings.length).toBeGreaterThan(0);
  });
});
