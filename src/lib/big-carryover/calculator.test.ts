import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  absoluteSalesCeilingForPositiveEv,
  BIG_BASELINE_FINAL_SALES_YEN,
  BIG_FIRST_PRIZE_ALLOCATION_SHARE,
  BIG_VOID_CANCEL_THRESHOLD,
  bigCarryoverProductDefaults,
  bigPayoutTruncationUnitYen,
  bigTrueEvStatusLabel,
  bigTrueEvUpperBound,
  bigVoidCancelThreshold,
  truncateBigPayoutYen,
  calculateBigCarryover,
  calculateBigTrueEv,
  classifyBigCarryoverAnticipation,
  bigProductCrossoverCancellations,
  breakevenCancellationProbability,
  minimumCancellationsForPositiveEv,
  predictNextCarryoverYen,
  rankBigProductsByTrueEv,
  trueEvCeilingWithoutCancellations,
  salesCeilingForPositiveEv,
  type BigProductCandidate,
} from "@/lib/big-carryover/calculator";
import { bigOfficialRuleProfiles } from "@/lib/big-carryover/rules";

describe("BIG carryover calculator", () => {
  it("calculates naive carry pressure", () => {
    const result = calculateBigCarryover({
      carryoverYen: 6_299_582_550,
      currentSalesYen: 191_591_400,
      firstPrizeCapYen: 1_200_000_000,
      firstPrizeOdds: 16_777_216,
      productType: "MEGA_BIG",
      projectedFinalSalesYen: 191_591_400,
      returnRate: 0.5,
      ticketPriceYen: 300,
    });

    expect(result.naiveCarryPressure).toBeCloseTo(
      (6_299_582_550 + 191_591_400 * 0.5) / 191_591_400,
      8,
    );
    expect(result.naiveCarryPressure).toBeGreaterThan(33);
  });

  it("lowers carry pressure when projected final sales increase", () => {
    const currentSales = calculateBigCarryover({
      carryoverYen: 6_299_582_550,
      currentSalesYen: 191_591_400,
      firstPrizeCapYen: 1_200_000_000,
      firstPrizeOdds: 16_777_216,
      productType: "MEGA_BIG",
      projectedFinalSalesYen: 191_591_400,
      returnRate: 0.5,
      ticketPriceYen: 300,
    });
    const finalSales = calculateBigCarryover({
      carryoverYen: 6_299_582_550,
      currentSalesYen: 191_591_400,
      firstPrizeCapYen: 1_200_000_000,
      firstPrizeOdds: 16_777_216,
      productType: "MEGA_BIG",
      projectedFinalSalesYen: 12_000_000_000,
      returnRate: 0.5,
      ticketPriceYen: 300,
    });

    expect(finalSales.naiveCarryPressure).toBeLessThan(currentSales.naiveCarryPressure!);
  });

  it("calculates expected first prize winners from first prize odds", () => {
    const result = calculateBigCarryover({
      carryoverYen: 4_000_000_000,
      currentSalesYen: 3_000_000_000,
      firstPrizeCapYen: 600_000_000,
      firstPrizeOdds: 4_782_969,
      productType: "BIG",
      projectedFinalSalesYen: 3_000_000_000,
      returnRate: 0.5,
      ticketPriceYen: 300,
    });

    expect(result.ticketCountEstimate).toBe(10_000_000);
    expect(result.expectedFirstPrizeWinners).toBeCloseTo(10_000_000 / 4_782_969, 8);
  });

  it("calculates the probability of at least one first prize", () => {
    const result = calculateBigCarryover({
      carryoverYen: 4_000_000_000,
      currentSalesYen: 3_000_000_000,
      firstPrizeCapYen: 600_000_000,
      firstPrizeOdds: 4_782_969,
      productType: "BIG",
      projectedFinalSalesYen: 3_000_000_000,
      returnRate: 0.5,
      ticketPriceYen: 300,
    });

    expect(result.probAtLeastOneFirstPrize).toBeCloseTo(
      1 - (1 - 1 / 4_782_969) ** 10_000_000,
      8,
    );
  });

  it("returns a cap warning when a first prize cap is present", () => {
    const result = calculateBigCarryover({
      carryoverYen: 6_299_582_550,
      currentSalesYen: 191_591_400,
      firstPrizeCapYen: 1_200_000_000,
      firstPrizeOdds: 16_777_216,
      productType: "MEGA_BIG",
      projectedFinalSalesYen: 191_591_400,
      returnRate: 0.5,
      ticketPriceYen: 300,
    });

    expect(result.capAdjustedWarning).toContain("1等上限");
    expect(result.capAdjustedNaiveCarryPressure).toBeLessThan(result.naiveCarryPressure!);
  });

  it("does not mark true EV complete when tier and official rule data are missing", () => {
    const result = calculateBigCarryover({
      carryoverYen: 6_299_582_550,
      currentSalesYen: 191_591_400,
      firstPrizeCapYen: 1_200_000_000,
      firstPrizeOdds: 16_777_216,
      productType: "MEGA_BIG",
      projectedFinalSalesYen: 191_591_400,
      returnRate: 0.5,
      ticketPriceYen: 300,
    });

    expect(result.trueEvStatus).toBe("proxy_only");
    expect(bigTrueEvStatusLabel[result.trueEvStatus]).toBe("真EV未計算");
  });

  it("keeps the 3338 percent style value out of true EV", () => {
    const result = calculateBigCarryover({
      carryoverYen: 6_299_582_550,
      currentSalesYen: 191_591_400,
      firstPrizeCapYen: 1_200_000_000,
      firstPrizeOdds: 16_777_216,
      productType: "MEGA_BIG",
      projectedFinalSalesYen: 191_591_400,
      returnRate: 0.5,
      ticketPriceYen: 300,
    });

    expect(Math.round((result.naiveCarryPressure ?? 0) * 100)).toBe(3338);
    expect(bigTrueEvStatusLabel[result.trueEvStatus]).toBe("真EV未計算");
  });

  it("does not reintroduce buy-30x style wording in BIG carryover UI code", () => {
    const files = [
      "src/app/big-carryover/page.tsx",
      "src/lib/big-carryover.ts",
      "src/lib/big-official.ts",
    ];
    const joined = files
      .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
      .join("\n");

    expect(joined).not.toMatch(/買えば.{0,12}(30倍|33倍)/u);
    expect(joined).not.toMatch(/全力買い|必勝|利益保証|激アツ確定|特大上振れ候補/u);
  });
});

describe("calculateBigTrueEv（造船太郎レバー: 試合中止×キャリー）", () => {
  // 2024-08-31 第1476回 MEGA BIG 相当（台風で4試合中止・キャリー58.3億）。
  const round1476 = {
    productType: "MEGA_BIG" as const,
    carryoverYen: 5_830_000_000,
    projectedFinalSalesYen: 4_710_000_000,
    returnRate: 0.5,
    ticketPriceYen: 300,
    firstPrizeCapYen: 1_200_000_000,
  };

  it("4試合中止で1等確率が256倍・1/65536になる（MEGA BIGは×4/中止）", () => {
    const r = calculateBigTrueEv({ ...round1476, cancelledMatches: 4 });
    expect(r.cancelBoostMultiple).toBe(256);
    expect(r.adjustedFirstPrizeOdds).toBe(65_536);
    expect(r.firstPrizeWinProbability).toBeCloseTo(1 / 65_536, 10);
  });

  it("第1476回相当は +EV（trueEV>1）になり buy-in 候補として検出される", () => {
    const r = calculateBigTrueEv({ ...round1476, cancelledMatches: 4 });
    expect(r.status).toBe("positive_ev");
    expect(r.trueEvMultiple).toBeGreaterThan(1);
    // 値はハードコードせず、実例の桁（1.4〜2.1倍／1口払戻 数千万円）に収まることを確認。
    expect(r.trueEvMultiple).toBeLessThan(2.1);
    expect(r.estimatedFirstPrizePayoutYen).toBeGreaterThan(10_000_000); // 1000万超
    expect(r.estimatedFirstPrizePayoutYen).toBeLessThan(100_000_000);
  });

  it("中止が無ければ同じ大型キャリーでも +EV にならない（確率ブースト必須）", () => {
    const r = calculateBigTrueEv({ ...round1476, cancelledMatches: 0 });
    expect(r.status).toBe("sub_breakeven");
    expect(r.trueEvMultiple).toBeLessThan(1);
  });

  it("キャリーが無ければ中止4でも +EV にならない（据え置き原資必須）", () => {
    const r = calculateBigTrueEv({ ...round1476, carryoverYen: 0, cancelledMatches: 4 });
    expect(r.status).toBe("sub_breakeven");
    expect(r.trueEvMultiple).toBeLessThan(1); // ≒ 還元率どまり
  });

  it("売上が膨らむほど（同時当選増で）EVは低下する", () => {
    const early = calculateBigTrueEv({ ...round1476, projectedFinalSalesYen: 2_000_000_000, cancelledMatches: 4 });
    const late = calculateBigTrueEv({ ...round1476, projectedFinalSalesYen: 8_000_000_000, cancelledMatches: 4 });
    expect(early.trueEvMultiple!).toBeGreaterThan(late.trueEvMultiple!);
    expect(early.expectedCoWinners!).toBeLessThan(late.expectedCoWinners!);
  });

  it("5試合以上中止はくじ不成立＝全額払戻（実質EV1.0）", () => {
    const r = calculateBigTrueEv({ ...round1476, cancelledMatches: 5 });
    expect(r.status).toBe("void_refund");
    expect(r.trueEvMultiple).toBe(1);
  });

  it("通常BIGは3択ベース（×3/中止・1/3^(14-M)）", () => {
    const r = calculateBigTrueEv({
      productType: "BIG",
      carryoverYen: 2_000_000_000,
      projectedFinalSalesYen: 1_000_000_000,
      returnRate: 0.5,
      ticketPriceYen: 300,
      firstPrizeCapYen: 600_000_000,
      cancelledMatches: 3,
    });
    expect(r.cancelBoostMultiple).toBe(27); // 3^3
    expect(r.adjustedFirstPrizeOdds).toBe(3 ** 11);
  });

  it("監視シグナル: 大型キャリーは少ない中止数で+EV窓が開く / 小型キャリーは届かない", () => {
    const big = minimumCancellationsForPositiveEv(round1476); // キャリー58.3億
    expect(big).not.toBeNull();
    expect(big!).toBeGreaterThanOrEqual(1);
    expect(big!).toBeLessThanOrEqual(4);

    const tiny = minimumCancellationsForPositiveEv({ ...round1476, carryoverYen: 100_000_000 });
    expect(tiny).toBeNull(); // 中止4でも届かない
  });

  it("入力不足は真EV未計算（unavailable）", () => {
    const r = calculateBigTrueEv({
      productType: "MEGA_BIG",
      carryoverYen: null,
      projectedFinalSalesYen: 4_710_000_000,
      returnRate: 0.5,
      ticketPriceYen: 300,
      firstPrizeCapYen: 1_200_000_000,
      cancelledMatches: 4,
    });
    expect(r.status).toBe("unavailable");
    expect(r.trueEvMultiple).toBeNull();
  });

  it("既定の1等配分は公式ルール捕捉(rules.ts)の1等 allocationShare と一致する", () => {
    (["BIG", "MEGA_BIG", "100YEN_BIG"] as const).forEach((productType) => {
      const firstTier = bigOfficialRuleProfiles[productType].tiers.find(
        (tierRule) => tierRule.tierName === "1等",
      );
      expect(firstTier).toBeDefined();
      expect(BIG_FIRST_PRIZE_ALLOCATION_SHARE[productType]).toBe(firstTier!.allocationShare);
    });
  });

  it("firstPrizeShare 未指定なら暫定0.5でなく商品の公式配分(MEGA=0.70)を使う", () => {
    const withDefault = calculateBigTrueEv({ ...round1476, cancelledMatches: 4 });
    const withOfficialShare = calculateBigTrueEv({
      ...round1476,
      cancelledMatches: 4,
      firstPrizeShare: 0.7,
    });
    const withOldPlaceholder = calculateBigTrueEv({
      ...round1476,
      cancelledMatches: 4,
      firstPrizeShare: 0.5,
    });
    // 既定は公式配分0.70と一致し、旧プレースホルダ0.5とは別値になる。
    expect(withDefault.trueEvMultiple).toBeCloseTo(withOfficialShare.trueEvMultiple!, 10);
    expect(withDefault.trueEvMultiple).not.toBeCloseTo(withOldPlaceholder.trueEvMultiple!, 7);
    // 暫定文言ではなく実証済み配分の注記が出る。
    expect(withDefault.warnings.some((w) => w.includes("実証済みの等級配分"))).toBe(true);
    expect(withDefault.warnings.some((w) => w.includes("暫定値"))).toBe(false);
  });

  it("中止4試合＝あと1で不成立、の overshoot 警告を出す（研究由来のvoid超過シグナル）", () => {
    const four = calculateBigTrueEv({ ...round1476, cancelledMatches: 4 });
    expect(four.warnings.some((w) => w.includes("くじ不成立") && w.includes("転落"))).toBe(true);
    const three = calculateBigTrueEv({ ...round1476, cancelledMatches: 3 });
    expect(three.warnings.some((w) => w.includes("転落"))).toBe(false);
  });
});

describe("salesCeilingForPositiveEv（+EVを保てる最終売上の天井）", () => {
  const round1476 = {
    productType: "MEGA_BIG" as const,
    carryoverYen: 5_830_000_000,
    returnRate: 0.5,
    ticketPriceYen: 300,
    firstPrizeCapYen: 1_200_000_000,
  };

  it("+EV化しない中止数(中止0)は天井 null（窓が開かない）", () => {
    expect(salesCeilingForPositiveEv({ ...round1476, cancelledMatches: 0 })).toBeNull();
  });

  it("中止4は有限の天井を返し、その前後で+EV↔EV<1 が切り替わる", () => {
    const ceiling = salesCeilingForPositiveEv({ ...round1476, cancelledMatches: 4 });
    expect(ceiling).not.toBeNull();
    expect(ceiling!).toBeGreaterThan(0);

    const justUnder = calculateBigTrueEv({
      ...round1476,
      cancelledMatches: 4,
      projectedFinalSalesYen: ceiling! * 0.9,
    });
    const justOver = calculateBigTrueEv({
      ...round1476,
      cancelledMatches: 4,
      projectedFinalSalesYen: ceiling! * 1.1,
    });
    expect(justUnder.trueEvMultiple!).toBeGreaterThanOrEqual(1);
    expect(justOver.trueEvMultiple!).toBeLessThan(1);
  });

  it("中止数が多いほど天井は高い（空間が小さく希薄化に強い）", () => {
    const m1 = salesCeilingForPositiveEv({ ...round1476, cancelledMatches: 1 });
    const m4 = salesCeilingForPositiveEv({ ...round1476, cancelledMatches: 4 });
    expect(m1).not.toBeNull();
    expect(m4).not.toBeNull();
    expect(m4!).toBeGreaterThanOrEqual(m1!);
  });

  it("実効天井は、中止数によらない絶対天井 C/(1-還元率) を超えない", () => {
    const absolute = absoluteSalesCeilingForPositiveEv(round1476)!;

    for (let m = 1; m < BIG_VOID_CANCEL_THRESHOLD; m += 1) {
      const ceiling = salesCeilingForPositiveEv({ ...round1476, cancelledMatches: m });
      if (ceiling !== null) {
        expect(ceiling).toBeLessThanOrEqual(absolute * (1 + 1e-9));
      }
    }
  });
});

describe("不成立閾値は商品ごとの最低成立試合数から導出する", () => {
  it("BIG / MEGA BIG / 100円BIG はいずれも中止5試合で不成立に導出される", () => {
    // MEGA BIG=8試合未満(12試合)、BIG・100円BIG=10試合未満(14試合) → いずれも M≥5。
    expect(bigVoidCancelThreshold("MEGA_BIG")).toBe(5);
    expect(bigVoidCancelThreshold("BIG")).toBe(5);
    expect(bigVoidCancelThreshold("100YEN_BIG")).toBe(5);
    expect(bigVoidCancelThreshold("MEGA_BIG")).toBe(BIG_VOID_CANCEL_THRESHOLD);
  });

  it("custom は試合構造が不明なため閾値を導出できない", () => {
    expect(bigVoidCancelThreshold("custom")).toBeNull();
  });
});

describe("1等上限は『按分後の1口』に適用される（公式算式の不等号位置）", () => {
  // 公式: (売上のうちN% + キャリー) ÷ 当せん口数 ≦ 上限額。
  // 除算の後ろに不等号があるため、同時当選者が複数いても各口は上限額まで受け取れる。
  // 原資プール側を先に切る解釈だと 1口 = min(pool,cap)/(1+同時当選) となり、低売上域で符号が反転する。
  const round1639 = {
    productType: "MEGA_BIG" as const,
    carryoverYen: 8_832_707_550,
    returnRate: 0.5,
    ticketPriceYen: 300,
    firstPrizeCapYen: 1_200_000_000,
    projectedFinalSalesYen: 1_000_000_000,
  };

  it("原資が上限を超えても、1口払戻は上限額そのもの（口数で割った額ではない）", () => {
    const result = calculateBigTrueEv({ ...round1639, cancelledMatches: 1 });

    expect(result.estimatedFirstPrizePayoutYen).toBe(1_200_000_000);

    // プール側を先に切る誤解釈だと、これより小さくなる。
    const poolFirstInterpretation =
      Math.min(
        round1639.projectedFinalSalesYen * 0.5 * 0.7 + round1639.carryoverYen,
        round1639.firstPrizeCapYen,
      ) /
      (1 + result.expectedCoWinners!);

    expect(result.estimatedFirstPrizePayoutYen!).toBeGreaterThan(poolFirstInterpretation);
  });

  it("第1639回(キャリー88.3億)は中止1試合で+EV、中止0では見送り", () => {
    const noCancel = calculateBigTrueEv({ ...round1639, cancelledMatches: 0 });
    const oneCancel = calculateBigTrueEv({ ...round1639, cancelledMatches: 1 });

    expect(noCancel.status).toBe("sub_breakeven");
    expect(oneCancel.status).toBe("positive_ev");
    expect(oneCancel.trueEvMultiple!).toBeGreaterThan(1);
    expect(minimumCancellationsForPositiveEv(round1639)).toBe(1);
  });
});

describe("不変式: 真EV ≤ 還元率 + キャリー ÷ 最終売上", () => {
  // パリミュチュエルは原資を全額払い出すため、1等配分・上限・中止数によらず上界が立つ。
  // 上限が張り付けば超過分は払い出されず、EV は上界からさらに離れる。
  // ※ 不成立(M≥閾値)は「払戻」であってプールからの払出ではないため対象外。
  const products = ["BIG", "MEGA_BIG", "100YEN_BIG"] as const;
  const carryovers = [100_000_000, 5_830_000_000, 8_832_707_550];
  const sales = [100_000_000, 1_000_000_000, 10_000_000_000, 100_000_000_000];

  it("全商品 × 中止0〜4 × キャリー × 売上 のグリッドで上界を破らない", () => {
    for (const productType of products) {
      const defaults = bigCarryoverProductDefaults[productType];

      for (const carryoverYen of carryovers) {
        for (const projectedFinalSalesYen of sales) {
          for (let cancelledMatches = 0; cancelledMatches < BIG_VOID_CANCEL_THRESHOLD; cancelledMatches += 1) {
            const input = {
              cancelledMatches,
              carryoverYen,
              firstPrizeCapYen: defaults.firstPrizeCapYen,
              productType,
              projectedFinalSalesYen,
              returnRate: 0.5,
              ticketPriceYen: defaults.ticketPriceYen,
            };
            const ev = calculateBigTrueEv(input).trueEvMultiple;
            const bound = bigTrueEvUpperBound(input);

            expect(ev).not.toBeNull();
            expect(bound).not.toBeNull();
            expect(ev!).toBeLessThanOrEqual(bound! * (1 + 1e-9));
          }
        }
      }
    }
  });

  it("殺到レジーム（同時当選者が多い）では上界にほぼ張り付き、1等配分が相殺される", () => {
    // 第1476回の実績条件: 中止4・最終売上47.1億・キャリー58.3億 → 実現≈1.73倍。
    const input = {
      cancelledMatches: 4,
      carryoverYen: 5_830_000_000,
      firstPrizeCapYen: 1_200_000_000,
      productType: "MEGA_BIG" as const,
      projectedFinalSalesYen: 4_710_000_000,
      returnRate: 0.5,
      ticketPriceYen: 300,
    };
    const result = calculateBigTrueEv(input);
    const bound = bigTrueEvUpperBound(input)!;

    expect(result.expectedCoWinners!).toBeGreaterThan(100); // 殺到レジーム
    expect(result.trueEvMultiple!).toBeLessThanOrEqual(bound);
    expect(result.trueEvMultiple! / bound).toBeGreaterThan(0.99);
  });

  it("最終売上→∞ で真EVは還元率へ収束する（キャリー項が消える）", () => {
    const huge = calculateBigTrueEv({
      cancelledMatches: 4,
      carryoverYen: 8_832_707_550,
      firstPrizeCapYen: 1_200_000_000,
      productType: "MEGA_BIG",
      projectedFinalSalesYen: 100_000_000_000_000,
      returnRate: 0.5,
      ticketPriceYen: 300,
    });

    expect(huge.trueEvMultiple!).toBeCloseTo(0.5, 3);
  });

  it("絶対天井は還元率0.5ならキャリーの2倍（この売上を超えたら何試合中止でも+EVは無い）", () => {
    expect(absoluteSalesCeilingForPositiveEv({ carryoverYen: 8_832_707_550, returnRate: 0.5 })).toBeCloseTo(
      17_665_415_100,
      0,
    );
    expect(absoluteSalesCeilingForPositiveEv({ carryoverYen: 0, returnRate: 0.5 })).toBeNull();
    expect(absoluteSalesCeilingForPositiveEv({ carryoverYen: 1_000_000_000, returnRate: 1 })).toBeNull();
  });
});

describe("classifyBigCarryoverAnticipation（殺到＝織り込みの監視シグナル）", () => {
  const baseline = BIG_BASELINE_FINAL_SALES_YEN.MEGA_BIG!;

  // 公式回別結果ページ（store.toto-dream.com …holdCntId=N）の「売上金額」＝確定売上。
  // 第1627〜1647回のうち **Jリーグ回のみ**（1629/1634/1636〜1643/1646 は代表戦・海外クラブ回
  // なので除外、1635 は欠番）。全20回ぶんの材料は predictNextCarryoverYen のチェーン検定
  // （前回の公表繰越＋今回の売上・1等口数 → 今回の公表繰越）54件を1円単位でPASSしている。
  const jLeagueFinalSalesYen: Record<
    "BIG" | "MEGA_BIG" | "100YEN_BIG",
    [round: number, salesYen: number][]
  > = {
    BIG: [
      [1627, 635_024_400], [1628, 658_616_100], [1630, 588_478_800],
      [1631, 759_428_100], [1632, 661_732_200], [1633, 767_529_300],
      [1644, 840_519_600], [1645, 766_363_800], [1647, 530_048_400],
    ],
    MEGA_BIG: [
      [1627, 499_835_700], [1628, 497_542_200], [1630, 472_039_800],
      [1631, 672_824_400], [1632, 552_605_100], [1633, 668_160_300],
      [1644, 671_055_600], [1645, 678_493_800], [1647, 409_477_200],
    ],
    "100YEN_BIG": [
      [1627, 280_466_800], [1628, 265_158_600], [1630, 260_885_000],
      [1631, 356_230_200], [1632, 309_841_400], [1633, 360_415_200],
      [1644, 379_069_800], [1645, 372_546_200], [1647, 240_864_900],
    ],
  };
  const measuredProducts = ["BIG", "MEGA_BIG", "100YEN_BIG"] as const;

  it("ベースラインは実測Jリーグ回の中央値を1,000万円単位に丸めた値（3商品とも実測で埋まっている）", () => {
    for (const productType of measuredProducts) {
      const sorted = jLeagueFinalSalesYen[productType].map(([, s]) => s).sort((a, b) => a - b);
      expect(sorted.length % 2).toBe(1); // n=9（奇数）＝中央値は補間なしの実測1点
      const median = sorted[Math.floor(sorted.length / 2)];
      expect(BIG_BASELINE_FINAL_SALES_YEN[productType]).toBe(Math.round(median / 10_000_000) * 10_000_000);
    }
    expect(BIG_BASELINE_FINAL_SALES_YEN.BIG).toBe(660_000_000);
    expect(BIG_BASELINE_FINAL_SALES_YEN.MEGA_BIG).toBe(550_000_000);
    expect(BIG_BASELINE_FINAL_SALES_YEN["100YEN_BIG"]).toBe(310_000_000);
    // custom は商品が特定できない＝どの実測系列にも紐づかないので意図的に null（unknown で返す）。
    expect(BIG_BASELINE_FINAL_SALES_YEN.custom).toBeNull();
  });

  it("実測の通常回は9回×3商品すべて calm（中央値比 0.7〜1.3倍に収まり閾値2倍に触れない）", () => {
    for (const productType of measuredProducts) {
      for (const [round, salesYen] of jLeagueFinalSalesYen[productType]) {
        const assessment = classifyBigCarryoverAnticipation({
          baselineFinalSalesYen: BIG_BASELINE_FINAL_SALES_YEN[productType],
          currentSalesYen: salesYen,
        });
        expect(`${productType}/${round}: ${assessment.level}`).toBe(`${productType}/${round}: calm`);
        expect(assessment.surgeRatio!).toBeGreaterThan(0.7);
        expect(assessment.surgeRatio!).toBeLessThan(1.3);
      }
    }
  });

  it("大型キャリー回でも売上は膨らまない（第1647回 MEGA はキャリー93.2億で実測の最低売上）", () => {
    // キャリー額と売上の相関は実測 r≈0。「キャリーが大きい回は売上も多いはず」という直感が
    // ベースラインを吊り上げていたので、最反例を固定しておく。
    const round1647 = classifyBigCarryoverAnticipation({
      baselineFinalSalesYen: BIG_BASELINE_FINAL_SALES_YEN.MEGA_BIG,
      currentSalesYen: 409_477_200,
    });
    expect(round1647.level).toBe("calm");
    expect(round1647.surgeRatio!).toBeLessThan(1);
  });

  it("旧ベースライン7.00億は実測2.5倍の殺到を calm と誤認する（反保守の回帰防止）", () => {
    const surged2_5x = 550_000_000 * 2.5; // 実測ベースラインの2.5倍 = 13.75億
    expect(
      classifyBigCarryoverAnticipation({ baselineFinalSalesYen: 700_000_000, currentSalesYen: surged2_5x }).level,
    ).toBe("calm");
    expect(
      classifyBigCarryoverAnticipation({
        baselineFinalSalesYen: BIG_BASELINE_FINAL_SALES_YEN.MEGA_BIG,
        currentSalesYen: surged2_5x,
      }).level,
    ).toBe("elevated");
  });

  it("通常回並みは calm、2倍で elevated、5倍以上(1476≈8.5倍)で flooded", () => {
    expect(
      classifyBigCarryoverAnticipation({ baselineFinalSalesYen: baseline, currentSalesYen: baseline }).level,
    ).toBe("calm");
    expect(
      classifyBigCarryoverAnticipation({ baselineFinalSalesYen: baseline, currentSalesYen: baseline * 2.2 }).level,
    ).toBe("elevated");
    const flooded = classifyBigCarryoverAnticipation({
      baselineFinalSalesYen: baseline,
      currentSalesYen: 4_710_000_000, // 1476 実売上。実測ベースライン5.5億に対し ≈8.5倍
    });
    expect(flooded.level).toBe("flooded");
    expect(flooded.surgeRatio!).toBeGreaterThan(5);
  });

  it("ベースライン/現在売上が無ければ unknown", () => {
    expect(
      classifyBigCarryoverAnticipation({ baselineFinalSalesYen: null, currentSalesYen: 1_000_000_000 }).level,
    ).toBe("unknown");
    expect(
      classifyBigCarryoverAnticipation({ baselineFinalSalesYen: baseline, currentSalesYen: null }).level,
    ).toBe("unknown");
  });
});

describe("実データバックテストによる規程パラメータの実証（2026-07-10・過去15回）", () => {
  // 1等上限超過分は翌回キャリーへロールオーバーする。逆算は本番関数 predictNextCarryoverYen に
  // 昇格済み（テスト内に式を再実装すると、本体の改訂とズレて検定にならないため）。
  const rolloverExcess = (
    productType: "BIG" | "MEGA_BIG" | "100YEN_BIG",
    salesYen: number,
    carryInYen: number,
    winners: number,
    firstPrizeShare = BIG_FIRST_PRIZE_ALLOCATION_SHARE[productType]!,
  ) =>
    predictNextCarryoverYen({
      carryoverYen: carryInYen,
      firstPrizeCapYen: bigCarryoverProductDefaults[productType].firstPrizeCapYen,
      firstPrizeShare,
      firstPrizeWinnerCount: winners,
      productType,
      returnRate: 0.5,
      salesYen,
    }).nextCarryoverYen;

  // 公式回別結果ページ（store.toto-dream.com …holdCntId=N）で確認した cap 張り付き回の全件。
  // 前回繰越は「1つ前の回」の公表繰越額、翌回繰越は「その回」の公表繰越額。
  // toBeCloseTo ではなく toBe で固定する: 旧実装は 100円BIG で 4〜8円ずれていたが、
  // 許容差 -2/-3（±50〜±500円）の assert がそれを吸収して「円単位一致」に見せていた。
  it.each`
    round     | productType     | salesYen       | carryInYen       | winners | expected
    ${1630}   | ${"BIG"}        | ${588_478_800} | ${3_388_562_460} | ${1}    | ${3_023_953_980}
    ${1633}   | ${"BIG"}        | ${767_529_300} | ${3_592_418_100} | ${1}    | ${3_299_429_820}
    ${1627}   | ${"100YEN_BIG"} | ${280_466_800} | ${830_439_682}   | ${3}    | ${337_017_060}
    ${1632}   | ${"100YEN_BIG"} | ${309_841_400} | ${760_298_262}   | ${1}    | ${678_037_990}
    ${1633}   | ${"100YEN_BIG"} | ${360_415_200} | ${678_037_990}   | ${1}    | ${614_995_760}
    ${1638}   | ${"100YEN_BIG"} | ${380_017_200} | ${788_386_072}   | ${1}    | ${732_792_600}
    ${1645}   | ${"MEGA_BIG"}   | ${678_493_800} | ${9_983_893_215} | ${1}    | ${9_021_366_030}
    ${1645}   | ${"100YEN_BIG"} | ${372_546_200} | ${1_428_303_066} | ${2}    | ${1_169_870_620}
  `(
    "第$round回 $productType の上限超過ロールオーバーが公式発表と1円単位で一致する",
    ({ productType, salesYen, carryInYen, winners, expected }) => {
      expect(rolloverExcess(productType, salesYen, carryInYen, winners)).toBe(expected);
    },
  );

  it("BIG 1等配分は0.80が正しく、旧値0.76では第1630回が約1,177万円ずれる", () => {
    expect(rolloverExcess("BIG", 588_478_800, 3_388_562_460, 1, 0.76)).not.toBeCloseTo(3_023_953_980, -6);
  });

  it("1等0口の回は端数切り捨てが起きず、単位の倍数でない額がそのまま繰り越される", () => {
    // 第1644回 MEGA BIG: 9,983,893,215 は 30 の倍数ではない（余り15）。W=0 では按分が発生せず
    // 切り捨ても起きないことの実測の裏付け。ここを一律に切り捨てると 1645 の入力が壊れる。
    const mega = rolloverExcess("MEGA_BIG", 671_055_600, 9_749_023_755, 0);
    expect(mega).toBe(9_983_893_215);
    expect(mega! % 30).toBe(15);
    // 第1631回 100円BIG: 760,298,262 は 10 の倍数ではない（余り2）。
    expect(rolloverExcess("100YEN_BIG", 356_230_200, 624_930_786, 0)).toBe(760_298_262);
    // 第1645回 BIG: W=0 かつ偶然 30 の倍数 → 切り捨ての有無に関わらず一致する回。
    expect(rolloverExcess("BIG", 766_363_800, 4_939_079_700, 0)).toBe(5_245_625_220);
  });

  it("1等0口の回は1等原資が全額そのまま翌回キャリーになる（超過分ではなくプール全額）", () => {
    const p = predictNextCarryoverYen({
      carryoverYen: 3_388_562_460,
      firstPrizeCapYen: 600_000_000,
      firstPrizeShare: 0.8,
      firstPrizeWinnerCount: 0,
      productType: "BIG",
      returnRate: 0.5,
      salesYen: 588_478_800,
    });
    expect(p.nextCarryoverYen).toBeCloseTo(588_478_800 * 0.5 * 0.8 + 3_388_562_460, -2);
    expect(p.payoutPerWinnerYen).toBeNull();
    expect(p.capBound).toBe(false);
  });

  it("材料が欠けたら黙って0を返さず null で返す（キャリー未確定の '-' を0扱いする事故の再発防止）", () => {
    const noCarry = predictNextCarryoverYen({
      carryoverYen: null,
      firstPrizeCapYen: 600_000_000,
      firstPrizeWinnerCount: 0,
      productType: "BIG",
      returnRate: 0.5,
      salesYen: 588_478_800,
    });
    expect(noCarry.nextCarryoverYen).toBeNull();
    expect(noCarry.warnings.length).toBeGreaterThan(0);

    const noWinnerCount = predictNextCarryoverYen({
      carryoverYen: 3_388_562_460,
      firstPrizeCapYen: 600_000_000,
      firstPrizeWinnerCount: null,
      productType: "BIG",
      returnRate: 0.5,
      salesYen: 588_478_800,
    });
    expect(noWinnerCount.nextCarryoverYen).toBeNull();
  });

  describe("当せん金の端数切り捨て（口単価÷10 円単位・2026-08-17 実測確定）", () => {
    it("切り捨て単位は BIG/MEGA BIG=30円・100円BIG=10円", () => {
      expect(bigPayoutTruncationUnitYen(bigCarryoverProductDefaults.BIG.ticketPriceYen)).toBe(30);
      expect(bigPayoutTruncationUnitYen(bigCarryoverProductDefaults.MEGA_BIG.ticketPriceYen)).toBe(30);
      expect(bigPayoutTruncationUnitYen(bigCarryoverProductDefaults["100YEN_BIG"].ticketPriceYen)).toBe(10);
      // 単位不明なら黙って丸めず素通しする（0や誤単位で潰さない）。
      expect(bigPayoutTruncationUnitYen(null)).toBeNull();
      expect(truncateBigPayoutYen(1_234.5, null)).toBe(1_234.5);
      expect(truncateBigPayoutYen(3_170.53, 300)).toBe(3_150);
    });

    // 公式回別結果ページの全等級を、rules.ts の等級配分 × 端数切り捨てだけで再現する。
    // 25件中1件でも外れたら、配分 α か切り捨て単位のどちらかが誤り。
    // ここが通ることは BIG 下位等の配分（0.07/0.02/0.03/0.03/0.05）の実測裏付けでもある。
    const observedTierPayouts: Record<
      "BIG" | "MEGA_BIG" | "100YEN_BIG",
      { round: number; salesYen: number; tiers: [winners: number, payoutYen: number][] }[]
    > = {
      // tiers は 2等から順（1等は cap 張り付き/0口のため別テストで検定）
      BIG: [
        {
          round: 1644,
          salesYen: 840_519_600,
          tiers: [[19, 1_548_300], [223, 37_680], [1_737, 7_230], [9_216, 1_350], [37_455, 540]],
        },
        {
          round: 1645,
          salesYen: 766_363_800,
          tiers: [[15, 1_788_180], [205, 37_380], [1_575, 7_290], [8_607, 1_320], [34_155, 540]],
        },
      ],
      MEGA_BIG: [
        {
          round: 1644,
          salesYen: 671_055_600,
          tiers: [[7, 6_710_550], [95, 70_620], [759, 13_260], [5_381, 3_090], [25_390, 780]],
        },
        {
          round: 1645,
          salesYen: 678_493_800,
          tiers: [[8, 5_936_820], [75, 90_450], [744, 13_650], [5_350, 3_150], [25_887, 780]],
        },
      ],
      "100YEN_BIG": [
        {
          round: 1644,
          salesYen: 379_069_800,
          tiers: [[22, 861_520], [299, 25_350], [2_356, 3_210], [12_750, 890]],
        },
        {
          round: 1645,
          salesYen: 372_546_200,
          tiers: [[18, 1_034_850], [280, 26_610], [2_304, 3_230], [12_307, 900]],
        },
      ],
    };

    it.each(Object.keys(observedTierPayouts) as (keyof typeof observedTierPayouts)[])(
      "%s の2等以下の公表当せん金を『原資÷口数を単位切り捨て』だけで全件再現する",
      (productType) => {
        const profile = bigOfficialRuleProfiles[productType];
        for (const { round, salesYen, tiers } of observedTierPayouts[productType]) {
          tiers.forEach(([winners, payoutYen], index) => {
            const share = profile.tiers[index + 1].allocationShare; // +1 で1等を飛ばす
            const predicted = truncateBigPayoutYen(
              (salesYen * profile.returnRate * share) / winners,
              profile.ticketPriceYen,
            );
            expect(
              predicted,
              `第${round}回 ${productType} ${index + 2}等（${winners}口）`,
            ).toBe(payoutYen);
          });
        }
      },
    );
  });

  it("第1476回は原資全額払出で アグリゲートEV = 還元率 + C/S（不変式を実測で確認）", () => {
    const S = 4_713_264_600;
    const C = 5_830_000_000;
    const firstPaid = 269 * 24_800_430;
    const lowerPaid = (5_719 + 60_688 + 362_450 + 1_359_880 + 3_262_701) * 300; // 全て300円の床
    const totalPaid = firstPaid + lowerPaid;

    expect((totalPaid - C) / S).toBeCloseTo(0.5, 3); // 還元率0.5を実測（0.50002）
    expect(totalPaid / S).toBeCloseTo(0.5 + C / S, 3); // アグリゲートEV=不変式上界=1.7369
  });

  it("cap-bound な BIG M=1 窓では 1等EV は配分に無反応で、正しい0.80は floor 経由で 0.76 よりEVを下げる", () => {
    // Fable検算: 現況BIG窓は raw按分>cap で 1等が張り付く。0.76は floor を過大評価しEVを+0.02過大に出す反保守だった。
    const base = {
      productType: "BIG" as const,
      carryoverYen: 4_525_370_220,
      returnRate: 0.5,
      ticketPriceYen: 300,
      firstPrizeCapYen: 600_000_000,
      projectedFinalSalesYen: 1_158_000_000,
      cancelledMatches: 1,
    };
    const at80 = calculateBigTrueEv({ ...base, firstPrizeShare: 0.8 });
    const at76 = calculateBigTrueEv({ ...base, firstPrizeShare: 0.76 });

    expect(at80.estimatedFirstPrizePayoutYen).toBe(600_000_000); // cap 張り付き
    expect(at80.firstPrizeEvMultiple).toBeCloseTo(at76.firstPrizeEvMultiple!, 10); // 1等EVは配分に無反応
    expect(at80.trueEvMultiple!).toBeLessThan(at76.trueEvMultiple!); // 正しい0.80の方が低い
    expect(at76.trueEvMultiple! - at80.trueEvMultiple!).toBeCloseTo(0.02, 3); // 差はちょうど floor 差 0.02
  });

  it("中止3試合以上では下位等の床崩れ警告を出す（per-unit1等は楽観・下位floorは保守）", () => {
    const highM = calculateBigTrueEv({
      productType: "MEGA_BIG",
      carryoverYen: 5_830_000_000,
      returnRate: 0.5,
      ticketPriceYen: 300,
      firstPrizeCapYen: 1_200_000_000,
      projectedFinalSalesYen: 4_710_000_000,
      cancelledMatches: 4,
    });
    expect(highM.warnings.some((w) => w.includes("床"))).toBe(true);
  });
});

// 第1644回(2026-08-08締切)の実測値。lot-info 2026-08-07 07:50 時点 / 楽天toto 1643 結果と一致。
const ROUND_1644 = {
  BIG: { carryoverYen: 4_602_871_860, calmFinalSalesYen: 1_200_000_000, surgeFinalSalesYen: 5_000_000_000 },
  MEGA_BIG: { carryoverYen: 9_749_023_755, calmFinalSalesYen: 900_000_000, surgeFinalSalesYen: 4_000_000_000 },
  "100YEN_BIG": { carryoverYen: 1_284_256_542, calmFinalSalesYen: 500_000_000, surgeFinalSalesYen: 2_500_000_000 },
} as const;

const candidate = (
  productType: keyof typeof ROUND_1644,
  scenario: "calm" | "surge",
): BigProductCandidate => ({
  carryoverYen: ROUND_1644[productType].carryoverYen,
  productType,
  projectedFinalSalesYen:
    scenario === "calm"
      ? ROUND_1644[productType].calmFinalSalesYen
      : ROUND_1644[productType].surgeFinalSalesYen,
});

describe("BIG 商品選択（どれを買うか）", () => {
  it("中止0〜1試合では BIG が MEGA BIG に勝つ（1等上限が大きい方が有利という直感は誤り）", () => {
    for (const [m, scenario] of [[0, "calm"], [1, "surge"]] as const) {
      const ranked = rankBigProductsByTrueEv(
        [candidate("BIG", scenario), candidate("MEGA_BIG", scenario)],
        { cancelledMatches: m, returnRate: 0.5 },
      );
      expect(ranked[0].productType).toBe("BIG");
    }
  });

  it("cap 張り付き域では BIG の1等EVが MEGA BIG の約1.75倍になる（確率3.51倍差 vs 賞金2倍差）", () => {
    const [big, mega] = ["BIG", "MEGA_BIG"].map(
      (p) =>
        rankBigProductsByTrueEv([candidate(p as "BIG" | "MEGA_BIG", "calm")], {
          cancelledMatches: 0,
          returnRate: 0.5,
        })[0],
    );
    expect(big.estimatedFirstPrizePayoutYen).toBe(600_000_000);
    expect(mega.estimatedFirstPrizePayoutYen).toBe(1_200_000_000);
    expect((big.firstPrizeEvMultiple ?? 0) / (mega.firstPrizeEvMultiple ?? 1)).toBeCloseTo(1.754, 2);
  });

  it("中止2試合で MEGA BIG が逆転する（BIGは同時当選で払戻が崩れ、MEGAは上限近くを1口で取れる）", () => {
    const crossover = bigProductCrossoverCancellations({
      challenger: candidate("MEGA_BIG", "surge"),
      incumbent: candidate("BIG", "surge"),
      returnRate: 0.5,
    });
    expect(crossover).toBe(2);

    const ranked = rankBigProductsByTrueEv(
      [candidate("BIG", "surge"), candidate("MEGA_BIG", "surge")],
      { cancelledMatches: 2, returnRate: 0.5 },
    );
    expect(ranked[0].productType).toBe("MEGA_BIG");
  });

  it("100円BIG は絶対天井が低く、中止が判明して殺到した時点で +EV にならない", () => {
    const ceiling = absoluteSalesCeilingForPositiveEv({
      carryoverYen: ROUND_1644["100YEN_BIG"].carryoverYen,
      returnRate: 0.5,
    });
    expect(ceiling).toBeCloseTo(2_568_513_084, 0);

    const ranked = rankBigProductsByTrueEv([candidate("100YEN_BIG", "surge")], {
      cancelledMatches: 1,
      returnRate: 0.5,
    });
    expect(ranked[0].trueEvMultiple).toBeLessThan(1);
  });

  it("中止未確定のまま買う場合の損益分岐中止確率を返す（BIGは約6割必要・100円BIGは分岐しない）", () => {
    const bigP = breakevenCancellationProbability({
      returnRate: 0.5,
      withCancellation: candidate("BIG", "surge"),
      withoutCancellation: candidate("BIG", "calm"),
    });
    expect(bigP).toBeGreaterThan(0.55);
    expect(bigP).toBeLessThan(0.65);

    const hyakuenP = breakevenCancellationProbability({
      returnRate: 0.5,
      withCancellation: candidate("100YEN_BIG", "surge"),
      withoutCancellation: candidate("100YEN_BIG", "calm"),
    });
    expect(hyakuenP).toBeGreaterThan(1);
  });

  it("締切後中止パス（ゲートB型）は殺到しないぶん損益分岐が下がる（1644のBIGで約61%→約58%）", () => {
    // 露出試合のKOが締切より後の回は、中止が決まっても誰も織り込めない＝中止分岐も平常売上。
    const beforeDeadlineAnnounce = breakevenCancellationProbability({
      returnRate: 0.5,
      withCancellation: candidate("BIG", "surge"),
      withoutCancellation: candidate("BIG", "calm"),
    })!;
    const afterDeadlineCancel = breakevenCancellationProbability({
      returnRate: 0.5,
      withCancellation: candidate("BIG", "calm"),
      withoutCancellation: candidate("BIG", "calm"),
    })!;
    expect(afterDeadlineCancel).toBeLessThan(beforeDeadlineAnnounce);
    expect(afterDeadlineCancel).toBeGreaterThan(0.5);
    expect(afterDeadlineCancel).toBeLessThan(0.6);
  });

  it("1等上限があるため、中止0試合の回はキャリーがいくら積もっても+EVにならない", () => {
    for (const productType of ["BIG", "MEGA_BIG", "100YEN_BIG"] as const) {
      const ceiling = trueEvCeilingWithoutCancellations(productType, 0.5);
      expect(ceiling).not.toBeNull();
      expect(ceiling!).toBeLessThan(1);

      // キャリーを900億まで積んでも M=0 の真EVは天井に張り付いたまま動かない。
      const absurdCarryover = rankBigProductsByTrueEv(
        [{ carryoverYen: 90_000_000_000, productType, projectedFinalSalesYen: 1_000_000_000 }],
        { cancelledMatches: 0, returnRate: 0.5 },
      )[0];
      expect(absurdCarryover.trueEvMultiple).toBeCloseTo(ceiling!, 6);
      expect(absurdCarryover.trueEvMultiple!).toBeLessThan(1);
    }
  });

  it("エッジの源泉はキャリーではなく中止ブースト（同じキャリーでM=1にすると+EVへ跳ねる）", () => {
    const noCancel = rankBigProductsByTrueEv([candidate("BIG", "calm")], {
      cancelledMatches: 0,
      returnRate: 0.5,
    })[0];
    const oneCancel = rankBigProductsByTrueEv([candidate("BIG", "surge")], {
      cancelledMatches: 1,
      returnRate: 0.5,
    })[0];
    expect(noCancel.trueEvMultiple!).toBeLessThan(1);
    expect(oneCancel.trueEvMultiple!).toBeGreaterThan(1);
  });
});
