import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  absoluteSalesCeilingForPositiveEv,
  BIG_BASELINE_FINAL_SALES_YEN,
  BIG_FIRST_PRIZE_ALLOCATION_SHARE,
  BIG_VOID_CANCEL_THRESHOLD,
  bigCarryoverProductDefaults,
  bigTrueEvStatusLabel,
  bigTrueEvUpperBound,
  bigVoidCancelThreshold,
  calculateBigCarryover,
  calculateBigTrueEv,
  classifyBigCarryoverAnticipation,
  minimumCancellationsForPositiveEv,
  salesCeilingForPositiveEv,
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
    // 暫定文言ではなく捕捉済み配分の注記が出る。
    expect(withDefault.warnings.some((w) => w.includes("捕捉済み等級配分"))).toBe(true);
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

  it("通常 MEGA BIG ベースラインは 6.95億相当（7億）で捕捉済み", () => {
    expect(BIG_BASELINE_FINAL_SALES_YEN.MEGA_BIG).toBe(700_000_000);
  });

  it("通常回並みは calm、2倍で elevated、5倍以上(1476≈7倍)で flooded", () => {
    expect(
      classifyBigCarryoverAnticipation({ baselineFinalSalesYen: baseline, currentSalesYen: baseline }).level,
    ).toBe("calm");
    expect(
      classifyBigCarryoverAnticipation({ baselineFinalSalesYen: baseline, currentSalesYen: baseline * 2.2 }).level,
    ).toBe("elevated");
    const flooded = classifyBigCarryoverAnticipation({
      baselineFinalSalesYen: baseline,
      currentSalesYen: 4_710_000_000, // 1476 実売上 ≈ 6.7倍
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
