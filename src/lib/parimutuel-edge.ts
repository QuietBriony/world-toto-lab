/**
 * パリミュチュエル共通の「控除率の壁」。BIG レーンと W杯 toto レーンで別々に扱っていた
 * 同一の不変式を1か所に置く。
 *
 * ── 導出 ───────────────────────────────────────────────────────────
 * 売上 S・払戻率 r・キャリー C の parimutuel で、ある出目 c に1口賭ける。
 * 群衆が c に張っている割合を p_public(c) とすると、c 的中時の当せん口数 ≈ S × p_public(c)。
 * 払戻原資は r×S + C なので、
 *
 *   1口払戻 = (r·S + C) / (S · p_public)
 *   EV      = p_model × 1口払戻 = (p_model / p_public) × (r + C/S)
 *
 * → **EV = 「群衆に対する優位比」×「原資倍率」** に分解される。
 *
 * 帰結1: キャリー無し(C=0)なら EV ≥ 1 の条件は p_model / p_public ≥ 1/r。
 *        r=0.50 のスポーツくじでは **群衆の2.0倍うまくないと勝てない**。
 * 帰結2: 群衆と同じ予想しかできない(p_model = p_public)とき EV = r + C/S。これは
 *        `bigTrueEvUpperBound()` が返す BIG の殺到極限EVと同じ式であり、両レーンは
 *        同一の不変式の別断面にすぎない。
 * 帰結3: 予想スキルは「原資倍率」を1に近づけられない。控除率が低い場ほど、同じ
 *        モデル精度がそのまま利益に変換される。**モデルの価値は出口の控除率で決まる。**
 *
 * ⚠️ この式は「1口賭けても群衆分布 p_public が動かない」ことを仮定している。
 *    自分の投入額が売上に対して無視できない規模になると、自分で自分の払戻を薄める。
 */

export type ParimutuelEvInput = {
  /** キャリーオーバー額(円)。無ければ 0。 */
  carryoverYen?: number | null;
  /** 群衆がその出目に張っている割合(0〜1)。公式投票率など。 */
  crowdProbability: number | null;
  /** 最終売上(円)。キャリーが 0 なら影響しない。 */
  finalSalesYen?: number | null;
  /** モデルが見るその出目の的中確率(0〜1)。 */
  modelProbability: number | null;
  /** 払戻率。スポーツくじ(toto/BIG)は約款で 0.50。 */
  returnRate: number | null;
};

function asFiniteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asPositiveNumber(value: number | null | undefined): number | null {
  const finite = asFiniteNumber(value);
  return finite !== null && finite > 0 ? finite : null;
}

/**
 * 原資倍率 r + C/S。群衆と同じ予想をしたときの EV に等しい。
 * @returns 倍率。C>0 なのに売上が不明なら null（キャリーを黙って無視しない）。
 */
export function prizePoolMultiple(input: {
  carryoverYen?: number | null;
  finalSalesYen?: number | null;
  returnRate: number | null;
}): number | null {
  const returnRate = asFiniteNumber(input.returnRate);
  if (returnRate === null) {
    return null;
  }

  const carryoverYen = asFiniteNumber(input.carryoverYen) ?? 0;
  if (carryoverYen === 0) {
    return returnRate;
  }

  const finalSalesYen = asPositiveNumber(input.finalSalesYen);
  if (finalSalesYen === null) {
    return null;
  }
  return returnRate + carryoverYen / finalSalesYen;
}

/**
 * EV ≥ 1 に必要な「群衆に対する優位比」p_model / p_public。
 *
 * r=0.50・キャリー無しなら 2.0＝群衆の2倍の精度が要る。キャリーが厚いほど下がり、
 * 原資倍率が1を超えると 1 未満＝群衆と同じ予想でも +EV になる（BIG の窓と同じ条件）。
 * @returns 必要比。原資倍率が出せなければ null。
 */
export function requiredCrowdEdgeRatio(input: {
  carryoverYen?: number | null;
  finalSalesYen?: number | null;
  returnRate: number | null;
}): number | null {
  const multiple = prizePoolMultiple(input);
  if (multiple === null || multiple <= 0) {
    return null;
  }
  return 1 / multiple;
}

export type ParimutuelEvBreakdown = {
  /** EV ≥ 1 を満たしているか。 */
  clearsTakeout: boolean;
  /** 実際の優位比 p_model / p_public。 */
  crowdEdgeRatio: number | null;
  evMultiple: number | null;
  /** 原資倍率 r + C/S。 */
  poolMultiple: number | null;
  /** EV ≥ 1 に必要だった優位比。 */
  requiredCrowdEdgeRatio: number | null;
  warnings: string[];
};

/**
 * 1口の EV を「優位比 × 原資倍率」に分解して返す。
 * どちらの因子が効いている(または足りない)のかを、合成後の数字だけ見て取り違えないための関数。
 */
export function parimutuelEvBreakdown(input: ParimutuelEvInput): ParimutuelEvBreakdown {
  const warnings: string[] = [];
  const poolMultiple = prizePoolMultiple(input);
  const required = requiredCrowdEdgeRatio(input);

  const modelProbability = asFiniteNumber(input.modelProbability);
  const crowdProbability = asPositiveNumber(input.crowdProbability);

  if (modelProbability === null || crowdProbability === null) {
    warnings.push(
      "p_model か p_public が不明なため EV を出せません（p_public=0 は「誰も張っていない」で割れないため不可）。",
    );
    return {
      clearsTakeout: false,
      crowdEdgeRatio: null,
      evMultiple: null,
      poolMultiple,
      requiredCrowdEdgeRatio: required,
      warnings,
    };
  }

  const crowdEdgeRatio = modelProbability / crowdProbability;
  const evMultiple = poolMultiple === null ? null : crowdEdgeRatio * poolMultiple;

  if (poolMultiple !== null && poolMultiple < 1 && crowdEdgeRatio <= 1) {
    warnings.push(
      `群衆と同等以下の予想精度では、控除率のぶん必ず負けます（原資倍率 ${poolMultiple.toFixed(3)}）。`,
    );
  }

  return {
    clearsTakeout: evMultiple !== null && evMultiple >= 1,
    crowdEdgeRatio,
    evMultiple,
    poolMultiple,
    requiredCrowdEdgeRatio: required,
    warnings,
  };
}

/**
 * スポーツくじ(toto / BIG / WINNER)の払戻率。約款で「売上金額の50%を払戻対象基礎額」と規定。
 * 出典: https://www.toto-dream.com/toto/about/ ／総務省 実効還元率資料
 * https://www.soumu.go.jp/main_content/000084191.pdf
 */
export const SPORTS_LOTTERY_RETURN_RATE = 0.5;
