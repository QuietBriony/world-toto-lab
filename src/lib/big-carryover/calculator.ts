export type BigCarryoverProductType = "BIG" | "MEGA_BIG" | "100YEN_BIG" | "custom";

export type BigTrueEvStatus = "unavailable" | "proxy_only" | "partial" | "complete";

export type BigPrizeTier = {
  allocationShare: number | null;
  capYen: number | null;
  carryoverEligible: boolean;
  odds: number | null;
  tierName: string;
};

export type BigCarryoverCalculatorInput = {
  carryoverYen: number | null;
  currentSalesYen: number | null;
  firstPrizeCapYen: number | null;
  firstPrizeOdds: number | null;
  prizeTiersJson?: BigPrizeTier[] | null;
  productType: BigCarryoverProductType;
  projectedFinalSalesYen: number | null;
  returnRate: number | null;
  ticketPriceYen: number | null;
};

export type BigCarryoverCalculation = {
  capAdjustedNaiveCarryPressure: number | null;
  capAdjustedWarning: string | null;
  expectedFirstPrizeWinners: number | null;
  naiveCarryPressure: number | null;
  probAtLeastOneFirstPrize: number | null;
  projectedFinalSalesYen: number | null;
  ticketCountEstimate: number | null;
  trueEvStatus: BigTrueEvStatus;
  warnings: string[];
};

export type BigCarryoverProductDefaults = {
  firstPrizeCapYen: number | null;
  firstPrizeOdds: number | null;
  label: string;
  note: string;
  ticketPriceYen: number;
};

export type BigCarryoverPositionLabel =
  | "見送り"
  | "要公式確認"
  | "小額娯楽枠"
  | "ルール確認済み上振れ候補";

export type BigCarryoverSalesScenario = {
  calculation: BigCarryoverCalculation;
  key: string;
  label: string;
  note: string;
  projectedFinalSalesYen: number | null;
};

export const bigCarryoverProductDefaults: Record<
  BigCarryoverProductType,
  BigCarryoverProductDefaults
> = {
  BIG: {
    firstPrizeCapYen: 600_000_000,
    firstPrizeOdds: 4_782_969,
    label: "BIG",
    note: "14試合 x 3択を前提にした入力補助です。上限と配分は公式ルール確認が必要です。",
    ticketPriceYen: 300,
  },
  MEGA_BIG: {
    firstPrizeCapYen: 1_200_000_000,
    firstPrizeOdds: 16_777_216,
    label: "MEGA BIG",
    note: "12試合 x 4択を前提にした入力補助です。上限と配分は公式ルール確認が必要です。",
    ticketPriceYen: 300,
  },
  "100YEN_BIG": {
    firstPrizeCapYen: 200_000_000,
    firstPrizeOdds: 4_782_969,
    label: "100円BIG",
    note: "BIG系の簡易入力補助です。上限と配分は公式ルール確認が必要です。",
    ticketPriceYen: 100,
  },
  custom: {
    firstPrizeCapYen: null,
    firstPrizeOdds: null,
    label: "custom",
    note: "商品ルールを手入力するための枠です。",
    ticketPriceYen: 300,
  },
};

export const bigTrueEvStatusLabel: Record<BigTrueEvStatus, string> = {
  complete: "真EV計算可",
  partial: "真EVは部分材料のみ",
  proxy_only: "真EV未計算",
  unavailable: "真EV未計算",
};

function asFiniteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asPositiveNumber(value: number | null | undefined): number | null {
  const finite = asFiniteNumber(value);
  return finite !== null && finite > 0 ? finite : null;
}

function hasCompletePrizeTierData(prizeTiersJson: BigPrizeTier[] | null | undefined) {
  if (!prizeTiersJson || prizeTiersJson.length === 0) {
    return false;
  }

  return prizeTiersJson.every(
    (tier) =>
      Boolean(tier.tierName.trim()) &&
      asPositiveNumber(tier.odds) !== null &&
      asFiniteNumber(tier.allocationShare) !== null &&
      asFiniteNumber(tier.capYen) !== null &&
      typeof tier.carryoverEligible === "boolean",
  );
}

function resolveTrueEvStatus(input: {
  hasBaseProxy: boolean;
  prizeTiersJson: BigPrizeTier[] | null | undefined;
}): BigTrueEvStatus {
  if (!input.hasBaseProxy) {
    return "unavailable";
  }

  if (!input.prizeTiersJson || input.prizeTiersJson.length === 0) {
    return "proxy_only";
  }

  return hasCompletePrizeTierData(input.prizeTiersJson) ? "complete" : "partial";
}

export function normalizeBigCarryoverProductType(
  value: string | null | undefined,
): BigCarryoverProductType {
  const normalized = value?.trim().toUpperCase().replaceAll("-", "_").replaceAll(" ", "_");

  if (normalized === "MEGA_BIG" || normalized === "MEGABIG") {
    return "MEGA_BIG";
  }

  if (normalized === "100YEN_BIG" || normalized === "100円BIG" || normalized === "HYAKUEN_BIG") {
    return "100YEN_BIG";
  }

  if (normalized === "CUSTOM") {
    return "custom";
  }

  return "BIG";
}

export function bigCarryoverProductTypeFromOfficialKey(
  productKey: string | null | undefined,
): BigCarryoverProductType {
  if (productKey === "mega_big") {
    return "MEGA_BIG";
  }

  if (productKey === "hyakuen_big") {
    return "100YEN_BIG";
  }

  if (productKey === "big") {
    return "BIG";
  }

  return "custom";
}

export function calculateBigCarryover(input: BigCarryoverCalculatorInput): BigCarryoverCalculation {
  const carryoverYen = asFiniteNumber(input.carryoverYen);
  const currentSalesYen = asPositiveNumber(input.currentSalesYen);
  const firstPrizeCapYen = asPositiveNumber(input.firstPrizeCapYen);
  const firstPrizeOdds = asPositiveNumber(input.firstPrizeOdds);
  const projectedFinalSalesYen = asPositiveNumber(input.projectedFinalSalesYen);
  const returnRate = asFiniteNumber(input.returnRate);
  const ticketPriceYen = asPositiveNumber(input.ticketPriceYen);

  const hasBaseProxy =
    carryoverYen !== null && projectedFinalSalesYen !== null && returnRate !== null;
  const naivePrizePoolProxy = hasBaseProxy
    ? carryoverYen + projectedFinalSalesYen * returnRate
    : null;
  const naiveCarryPressure =
    naivePrizePoolProxy !== null && projectedFinalSalesYen !== null
      ? naivePrizePoolProxy / projectedFinalSalesYen
      : null;

  const ticketCountEstimate =
    projectedFinalSalesYen !== null && ticketPriceYen !== null
      ? projectedFinalSalesYen / ticketPriceYen
      : null;
  const expectedFirstPrizeWinners =
    ticketCountEstimate !== null && firstPrizeOdds !== null
      ? ticketCountEstimate / firstPrizeOdds
      : null;
  const probAtLeastOneFirstPrize =
    ticketCountEstimate !== null && firstPrizeOdds !== null && firstPrizeOdds > 1
      ? 1 - Math.exp(ticketCountEstimate * Math.log1p(-1 / firstPrizeOdds))
      : null;

  const capAdjustedNaiveCarryPressure =
    naivePrizePoolProxy !== null && projectedFinalSalesYen !== null && firstPrizeCapYen !== null
      ? Math.min(naivePrizePoolProxy, firstPrizeCapYen) / projectedFinalSalesYen
      : null;
  const capAdjustedWarning =
    naivePrizePoolProxy !== null && firstPrizeCapYen !== null && naivePrizePoolProxy > firstPrizeCapYen
      ? `1等上限 ${firstPrizeCapYen.toLocaleString("ja-JP")}円 を超えるため、キャリー圧を真EVとして読めません。`
      : firstPrizeCapYen !== null
        ? `1等上限 ${firstPrizeCapYen.toLocaleString("ja-JP")}円 は反映条件の公式確認が必要です。`
        : null;

  const trueEvStatus = resolveTrueEvStatus({
    hasBaseProxy: hasBaseProxy && firstPrizeOdds !== null && ticketPriceYen !== null,
    prizeTiersJson: input.prizeTiersJson,
  });

  const warnings: string[] = [];

  if (naiveCarryPressure !== null) {
    warnings.push("キャリー圧は粗い上振れ指標であり、真EVではありません。");
  }

  if (currentSalesYen !== null && projectedFinalSalesYen !== null && projectedFinalSalesYen > currentSalesYen) {
    warnings.push("最終売上が現在売上より増えるほど、同じキャリー額のキャリー圧は低下します。");
  }

  if (firstPrizeOdds === null) {
    warnings.push("1等確率が未入力のため、1等発生確率を表示できません。");
  }

  if (capAdjustedWarning) {
    warnings.push(capAdjustedWarning);
  }

  if (trueEvStatus !== "complete") {
    warnings.push("等級配分・上限・キャリー反映ルールが揃っていないため、真EVは表示しません。");
  }

  if (input.productType === "BIG" || input.productType === "MEGA_BIG" || input.productType === "100YEN_BIG") {
    warnings.push("BIG/MEGA BIGはランダム発券であり、買い目選択によるエッジはありません。");
  }

  return {
    capAdjustedNaiveCarryPressure,
    capAdjustedWarning,
    expectedFirstPrizeWinners,
    naiveCarryPressure,
    probAtLeastOneFirstPrize,
    projectedFinalSalesYen,
    ticketCountEstimate,
    trueEvStatus,
    warnings: Array.from(new Set(warnings)),
  };
}

// ── 造船太郎レバー: 試合中止 × キャリーオーバー の真EV検出 ───────────────────
// 各商品の「試合数 × 1試合あたりの択数」。中止M試合は全員的中扱い＝必要的中数が減り、
// P(1等)=1/outcomes^(matches-M) に跳ね上がる（MEGA=×4/中止, BIG=×3/中止）。
export const BIG_MATCH_STRUCTURE: Record<
  BigCarryoverProductType,
  { matches: number; outcomesPerMatch: number } | null
> = {
  BIG: { matches: 14, outcomesPerMatch: 3 },
  MEGA_BIG: { matches: 12, outcomesPerMatch: 4 },
  "100YEN_BIG": { matches: 14, outcomesPerMatch: 3 },
  custom: null,
};

// 5試合以上中止はくじ不成立＝全額払戻。狙い目は中止1〜4試合。
export const BIG_VOID_CANCEL_THRESHOLD = 5;
// 1等配分（還元のうち1等へ回る割合）。custom 等で商品配分が不明なときのフォールバック。
export const BIG_DEFAULT_FIRST_PRIZE_SHARE = 0.5;

// 商品ごとの1等がプールに占める配分。rules.ts の bigOfficialRuleProfiles の
// 1等 allocationShare と一致（BIG/100円BIG=公式商品ページ確認済、MEGA BIG=パートナー参照値）。
// calculator.test.ts で profile と一致することを固定している。
// これを既定に使うことで、造船太郎レバーの真EVが暫定0.5でなく公式配分で算出される。
export const BIG_FIRST_PRIZE_ALLOCATION_SHARE: Record<
  BigCarryoverProductType,
  number | null
> = {
  BIG: 0.76,
  MEGA_BIG: 0.7,
  "100YEN_BIG": 0.76,
  custom: null,
};

export type BigOpportunityStatus =
  | "void_refund"
  | "positive_ev"
  | "near_breakeven"
  | "sub_breakeven"
  | "unavailable";

export const bigOpportunityStatusLabel: Record<BigOpportunityStatus, string> = {
  void_refund: "くじ不成立（全額払戻）",
  positive_ev: "+EV 買い向かい候補",
  near_breakeven: "損益分岐手前・監視",
  sub_breakeven: "見送り（EV<1）",
  unavailable: "真EV未計算",
};

export type BigTrueEvInput = {
  carryoverYen: number | null;
  cancelledMatches?: number | null;
  firstPrizeCapYen: number | null;
  firstPrizeShare?: number | null;
  productType: BigCarryoverProductType;
  projectedFinalSalesYen: number | null;
  returnRate: number | null;
  ticketPriceYen: number | null;
};

export type BigTrueEvResult = {
  adjustedFirstPrizeOdds: number | null;
  cancelBoostMultiple: number | null;
  cancelledMatches: number;
  estimatedFirstPrizePayoutYen: number | null;
  expectedCoWinners: number | null;
  firstPrizeEvMultiple: number | null;
  firstPrizeWinProbability: number | null;
  lowerTierEvFloor: number | null;
  status: BigOpportunityStatus;
  trueEvMultiple: number | null;
  warnings: string[];
};

/**
 * 試合中止数 M とキャリーオーバーから 1口の真EV（倍率）を算出する。
 * EV = 1等EV + 下位等の概算還元。1等EV = P(1等) × 1口払戻見込 / 口単価。
 *   P(1等) = 1 / outcomes^(matches - M)
 *   1口払戻見込 = min( (予想売上×還元率×1等配分 + キャリー) / (1+期待同時当選者), 1等上限/口 )
 *   期待同時当選者 = (予想売上/口単価 - 1) × P(1等)   ← 売上殺到で薄まる
 * ※上限は「1口あたりの最高当せん額」（同時当選で按分した後に適用）。
 */
export function calculateBigTrueEv(input: BigTrueEvInput): BigTrueEvResult {
  const warnings: string[] = [];
  const cancelledMatches = Math.max(0, Math.floor(asFiniteNumber(input.cancelledMatches) ?? 0));
  const base: Omit<BigTrueEvResult, "status" | "trueEvMultiple"> = {
    adjustedFirstPrizeOdds: null,
    cancelBoostMultiple: null,
    cancelledMatches,
    estimatedFirstPrizePayoutYen: null,
    expectedCoWinners: null,
    firstPrizeEvMultiple: null,
    firstPrizeWinProbability: null,
    lowerTierEvFloor: null,
    warnings,
  };

  if (cancelledMatches >= BIG_VOID_CANCEL_THRESHOLD) {
    warnings.push(
      `中止 ${cancelledMatches} 試合は ${BIG_VOID_CANCEL_THRESHOLD} 以上＝くじ不成立で全額払戻（実質EV 1.00倍）。`,
    );
    return { ...base, status: "void_refund", trueEvMultiple: 1 };
  }

  const struct = BIG_MATCH_STRUCTURE[input.productType];
  const carryoverYen = asFiniteNumber(input.carryoverYen);
  const projectedFinalSalesYen = asPositiveNumber(input.projectedFinalSalesYen);
  const returnRate = asFiniteNumber(input.returnRate);
  const ticketPriceYen = asPositiveNumber(input.ticketPriceYen);
  const firstPrizeCapYen = asPositiveNumber(input.firstPrizeCapYen);
  const providedFirstPrizeShare = asFiniteNumber(input.firstPrizeShare);
  const profileFirstPrizeShare = BIG_FIRST_PRIZE_ALLOCATION_SHARE[input.productType];
  const firstPrizeShare =
    providedFirstPrizeShare ?? profileFirstPrizeShare ?? BIG_DEFAULT_FIRST_PRIZE_SHARE;

  if (!struct) {
    warnings.push("custom は試合数・択数が未確定のため真EVを計算できません。");
    return { ...base, status: "unavailable", trueEvMultiple: null };
  }
  if (carryoverYen === null || projectedFinalSalesYen === null || returnRate === null || ticketPriceYen === null) {
    warnings.push("キャリー・予想売上・還元率・口単価のいずれかが未入力のため真EV未計算。");
    return { ...base, status: "unavailable", trueEvMultiple: null };
  }

  const adjustedFirstPrizeOdds = Math.pow(struct.outcomesPerMatch, struct.matches - cancelledMatches);
  const cancelBoostMultiple = Math.pow(struct.outcomesPerMatch, cancelledMatches);
  const p1 = 1 / adjustedFirstPrizeOdds;
  const ticketCount = projectedFinalSalesYen / ticketPriceYen;
  const expectedCoWinners = Math.max(0, (ticketCount - 1) * p1);
  const firstPrizePool = projectedFinalSalesYen * returnRate * firstPrizeShare + carryoverYen;
  const rawPayout = firstPrizePool / (1 + expectedCoWinners);
  const payoutPerUnit = firstPrizeCapYen !== null ? Math.min(rawPayout, firstPrizeCapYen) : rawPayout;
  const firstPrizeEvMultiple = (p1 * payoutPerUnit) / ticketPriceYen;
  const lowerTierEvFloor = returnRate * (1 - firstPrizeShare); // 下位等で常に戻る概算
  const trueEvMultiple = firstPrizeEvMultiple + lowerTierEvFloor;

  if (firstPrizeCapYen !== null && rawPayout > firstPrizeCapYen) {
    warnings.push(
      `1口払戻が上限 ${firstPrizeCapYen.toLocaleString("ja-JP")}円 に張り付き、超過分はEVに反映されません。`,
    );
  }
  if (cancelledMatches === 0) {
    warnings.push("中止0試合＝確率ブースト無し。大型キャリーでも+EV化しにくい（造船太郎条件は中止1〜4＋大型キャリー）。");
  }
  if (carryoverYen <= 0) {
    warnings.push("キャリー無し＝中止で確率が上がっても原資は還元率止まり。EVは最大でも還元率程度。");
  }
  if (providedFirstPrizeShare === null && profileFirstPrizeShare !== null) {
    warnings.push(
      input.productType === "MEGA_BIG"
        ? `1等配分 ${(firstPrizeShare * 100).toFixed(0)}% は捕捉済み等級配分（MEGA BIGはパートナー参照値。公式商品ページで最終確認推奨）。`
        : `1等配分 ${(firstPrizeShare * 100).toFixed(0)}% は公式商品ページ準拠の等級配分。`,
    );
  } else {
    warnings.push(`1等配分 ${(firstPrizeShare * 100).toFixed(0)}% は暫定値。公式の等級配分確認で精度が上がります。`);
  }
  if (cancelledMatches === BIG_VOID_CANCEL_THRESHOLD - 1) {
    warnings.push(
      `中止 ${cancelledMatches} 試合＝あと1試合中止で ${BIG_VOID_CANCEL_THRESHOLD} 到達＝くじ不成立(全額払戻・実質EV1.0)に転落。大型台風ほど「当たり」でなく「払戻」で終わるリスク。`,
    );
  }
  warnings.push("BIG/MEGA BIGはランダム発券。買い目選択のエッジは無く、+EV回に量を入れる戦略です。");

  const status: BigOpportunityStatus =
    trueEvMultiple >= 1 ? "positive_ev" : trueEvMultiple >= 0.85 ? "near_breakeven" : "sub_breakeven";

  return {
    ...base,
    adjustedFirstPrizeOdds,
    cancelBoostMultiple,
    estimatedFirstPrizePayoutYen: payoutPerUnit,
    expectedCoWinners,
    firstPrizeEvMultiple,
    firstPrizeWinProbability: p1,
    lowerTierEvFloor,
    status,
    trueEvMultiple,
  };
}

/**
 * 監視用: 現在のキャリー/予想売上で「中止が何試合あれば +EV になるか」を返す。
 * 1〜(不成立閾値-1) で最小の中止数。中止4でも+EVに届かなければ null（キャリー不足）。
 * → "この回は荒天で N 試合中止すれば造船太郎窓が開く" という監視シグナル。
 */
export function minimumCancellationsForPositiveEv(
  input: Omit<BigTrueEvInput, "cancelledMatches">,
): number | null {
  for (let m = 1; m < BIG_VOID_CANCEL_THRESHOLD; m += 1) {
    if (calculateBigTrueEv({ ...input, cancelledMatches: m }).status === "positive_ev") {
      return m;
    }
  }
  return null;
}

// ── 最終売上を第一変数として扱う（殺到＝織り込みで真EVが希薄化する研究結論の反映）──
// 研究(2026-07-06): 1口配当 ≈ 0.5×空間 + キャリー×空間÷最終売上。エッジ(キャリー項)は
// 最終売上に反比例＝群衆の織り込み(殺到)が進むほどEVは還元率へ収束する。1476は通常~7億→
// 47.1億(≈7x)に殺到し269口山分け、速報286%→実現173%へ減衰。

/**
 * +EVを保てる最終売上の上限（＝「この売上を超えたら買わない」天井）。
 * 指定の中止数で trueEV が 1 を割る売上を二分探索で返す。trueEV は売上増で単調減少し
 * 売上→∞ で還元率(≈0.5)へ収束するため、低売上で+EVなら交点は一意。
 * @returns 天井(円)。低売上でも+EVでなければ null（この中止数では窓が開かない）。
 *   maxSalesYen まで+EVが続く場合は maxSalesYen を返す（実質どれだけ売れても+EV）。
 */
export function salesCeilingForPositiveEv(
  input: Omit<BigTrueEvInput, "projectedFinalSalesYen">,
  options?: { maxSalesYen?: number; minSalesYen?: number },
): number | null {
  const minSalesYen = asPositiveNumber(options?.minSalesYen) ?? 10_000_000;
  const maxSalesYen = asPositiveNumber(options?.maxSalesYen) ?? 2_000_000_000_000;
  const evAt = (sales: number) =>
    calculateBigTrueEv({ ...input, projectedFinalSalesYen: sales }).trueEvMultiple ?? null;

  const optimistic = evAt(minSalesYen);
  if (optimistic === null || optimistic < 1) {
    return null;
  }
  if ((evAt(maxSalesYen) ?? 0) >= 1) {
    return maxSalesYen;
  }

  let lo = minSalesYen;
  let hi = maxSalesYen;
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if ((evAt(mid) ?? 0) >= 1) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo;
}

// 通常回の最終売上目安（殺到判定のベースライン）。研究: 通常 MEGA BIG ≈ 6.95億。
// BIG/100円BIG は一次ソース未確認のため null（呼び出し側が実測ベースラインを渡す）。
export const BIG_BASELINE_FINAL_SALES_YEN: Record<BigCarryoverProductType, number | null> = {
  MEGA_BIG: 700_000_000,
  BIG: null,
  "100YEN_BIG": null,
  custom: null,
};

export type BigAnticipationLevel = "calm" | "elevated" | "flooded" | "unknown";

export const bigAnticipationLevelLabel: Record<BigAnticipationLevel, string> = {
  calm: "平常（織り込み薄・EVは濃いまま）",
  elevated: "上振れ（織り込み進行・EV希薄化中）",
  flooded: "殺到（織り込み済・EVは還元率付近へ）",
  unknown: "ベースライン不明で判定不可",
};

export type BigAnticipationAssessment = {
  level: BigAnticipationLevel;
  note: string;
  surgeRatio: number | null;
};

/**
 * 現在売上を通常回ベースラインと比べ、群衆の織り込み（殺到）度合いを分類する監視シグナル。
 * 殺到＝同時当選者が激増して1口配当が希薄化＝EVが還元率付近へ低下。買い場は殺到しきる前。
 */
export function classifyBigCarryoverAnticipation(input: {
  baselineFinalSalesYen: number | null;
  currentSalesYen: number | null;
}): BigAnticipationAssessment {
  const current = asPositiveNumber(input.currentSalesYen);
  const baseline = asPositiveNumber(input.baselineFinalSalesYen);

  if (current === null || baseline === null) {
    return {
      level: "unknown",
      note: "現在売上または通常回ベースラインが無く、殺到度は判定できません。",
      surgeRatio: null,
    };
  }

  const surgeRatio = current / baseline;

  if (surgeRatio >= 5) {
    return {
      level: "flooded",
      note: "通常回の5倍以上＝殺到。同時当選者が激増し1口配当が希薄化、EVは還元率付近まで低下しがち＝買い場としては手遅れ寄り（1476は約7倍で実現173%まで減衰）。",
      surgeRatio,
    };
  }
  if (surgeRatio >= 2) {
    return {
      level: "elevated",
      note: "通常回の2倍以上＝織り込み進行中でEVは低下方向。salesCeilingForPositiveEv の天井との距離を確認し、超える前に判断。",
      surgeRatio,
    };
  }
  return {
    level: "calm",
    note: "通常回並み＝まだ織り込み薄。中止が起きれば低売上×確率ブーストで最も濃いEVになりうる（未確定・低売上のまま中止が最濃）。",
    surgeRatio,
  };
}

export function classifyBigCarryoverPosition(
  calculation: Pick<BigCarryoverCalculation, "naiveCarryPressure" | "trueEvStatus">,
): BigCarryoverPositionLabel {
  if (calculation.naiveCarryPressure === null || calculation.naiveCarryPressure < 1) {
    return "見送り";
  }

  if (calculation.trueEvStatus !== "complete") {
    return "要公式確認";
  }

  if (calculation.naiveCarryPressure >= 1.2) {
    return "ルール確認済み上振れ候補";
  }

  return "小額娯楽枠";
}

export function buildBigCarryoverSalesScenarios(
  input: BigCarryoverCalculatorInput,
): BigCarryoverSalesScenario[] {
  const scenarios = [
    {
      key: "current",
      label: "現在売上",
      note: "現在売上ベースのキャリー圧。最終売上が増えると低下します。",
      projectedFinalSalesYen: asPositiveNumber(input.currentSalesYen),
    },
    {
      key: "final-1b",
      label: "最終売上 10億円",
      note: "最終売上シナリオ",
      projectedFinalSalesYen: 1_000_000_000,
    },
    {
      key: "final-3b",
      label: "最終売上 30億円",
      note: "最終売上シナリオ",
      projectedFinalSalesYen: 3_000_000_000,
    },
    {
      key: "final-8b",
      label: "最終売上 80億円",
      note: "最終売上シナリオ",
      projectedFinalSalesYen: 8_000_000_000,
    },
    {
      key: "final-12b",
      label: "最終売上 120億円",
      note: "最終売上シナリオ",
      projectedFinalSalesYen: 12_000_000_000,
    },
    {
      key: "custom",
      label: "ユーザー入力",
      note: "入力した最終売上シナリオ",
      projectedFinalSalesYen: asPositiveNumber(input.projectedFinalSalesYen),
    },
  ];

  return scenarios.map((scenario) => ({
    ...scenario,
    calculation: calculateBigCarryover({
      ...input,
      projectedFinalSalesYen: scenario.projectedFinalSalesYen,
    }),
  }));
}
