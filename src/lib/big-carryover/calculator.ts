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
//
// minimumEstablishedMatches = 公式が定める「これ未満しか成立しなければ、くじ不成立(全額払戻)」
// の成立試合数。MEGA BIG=8試合未満、BIG・100円BIG=10試合未満（2026-07-10 確認）。
// 不成立となる中止数 M は matches - minimumEstablishedMatches + 1 で導出する。
// ※ BIG1000(8試合未満)・mini BIG(6試合未満)は閾値が異なるため、追加時はここに定義すること。
export const BIG_MATCH_STRUCTURE: Record<
  BigCarryoverProductType,
  { matches: number; minimumEstablishedMatches: number; outcomesPerMatch: number } | null
> = {
  BIG: { matches: 14, minimumEstablishedMatches: 10, outcomesPerMatch: 3 },
  MEGA_BIG: { matches: 12, minimumEstablishedMatches: 8, outcomesPerMatch: 4 },
  "100YEN_BIG": { matches: 14, minimumEstablishedMatches: 10, outcomesPerMatch: 3 },
  custom: null,
};

/**
 * この中止数に達するとくじ不成立＝全額払戻（実質EV 1.00倍）。狙い目は 1〜(閾値-1) 試合。
 * BIG / MEGA BIG / 100円BIG はいずれも 5 に導出されるが、商品ごとに規定が異なるため
 * 定数ではなく構造から導く。custom は試合数不明のため null。
 */
export function bigVoidCancelThreshold(productType: BigCarryoverProductType): number | null {
  const struct = BIG_MATCH_STRUCTURE[productType];
  return struct ? struct.matches - struct.minimumEstablishedMatches + 1 : null;
}

// BIG/MEGA BIG/100円BIG に共通する不成立中止数（bigVoidCancelThreshold の導出結果と一致することを
// calculator.test.ts で固定）。custom 等、構造不明時のフォールバックにも使う。
export const BIG_VOID_CANCEL_THRESHOLD = 5;
// 1等配分（還元のうち1等へ回る割合）。custom 等で商品配分が不明なときのフォールバック。
export const BIG_DEFAULT_FIRST_PRIZE_SHARE = 0.5;

// 商品ごとの1等がプールに占める配分（＝還元のうち1等へ回る割合）。rules.ts の
// bigOfficialRuleProfiles の 1等 allocationShare と一致（calculator.test.ts で固定）。
// これを既定に使うことで、造船太郎レバーの真EVが暫定0.5でなく実配分で算出される。
//
// 2026-07-10 実データバックテスト（過去15回の公式結果を取得・独立検証）で円単位に確定:
//  - MEGA_BIG=0.70（平常14回の下位還元 r(1−α) が 0.1494〜0.1498 に密集）。
//  - BIG=0.80（第1630/1633回: 1等6億cap の超過分が翌回キャリー額に**円単位一致**。
//    売上の1等分 r·α=0.40＋下位分 r(1−α)=0.099 → r=0.499≈0.50・α=0.80。公式BIG算式「売上の40%」と整合）。
//    ※ 旧値0.76は下位floorを過大評価し cap-bound 窓でEVを+0.02過大に出す反保守だった。
//  - 100YEN_BIG=0.76（第1627/1633/1638回の cap 超過ロールオーバーで円単位一致）。
export const BIG_FIRST_PRIZE_ALLOCATION_SHARE: Record<
  BigCarryoverProductType,
  number | null
> = {
  BIG: 0.8,
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
 *
 * ★上限セマンティクス（2026-07-10 確定）: 公式が公表している算式は
 *   BIG      : (今開催回のBIG売上金額のうち40%      + キャリーオーバー) ÷ 当せん口数 ≦ 6億円
 *   MEGA BIG : (今開催回のMEGA BIG売上金額のうち35% + キャリーオーバー) ÷ 当せん口数 ≦ 12億円
 * 不等号が「÷当せん口数」の**後ろ**にある＝同時当選で按分した後の「1口あたり」に上限が掛かる
 * （原資プール側を先に切るのではない）。よって min(rawPayout, cap) の順序は規定と一致する。
 * この解釈の差は M=1 のような「上限が張り付く低売上域」で真EVの符号を反転させうるため重要。
 *
 * ⚠️ MEGA は 35% = 還元率0.5 × 1等配分0.70 と完全一致する一方、BIG は公表40% に対し
 *    0.5 × 0.76 = 38% で 2pt 乖離する（rules.ts の unresolvedRules 参照）。BIG の1等EVは
 *    この分だけ保守側（過小）に出る。
 */
export function calculateBigTrueEv(input: BigTrueEvInput): BigTrueEvResult {
  const warnings: string[] = [];
  const cancelledMatches = Math.max(0, Math.floor(asFiniteNumber(input.cancelledMatches) ?? 0));
  const voidThreshold = bigVoidCancelThreshold(input.productType) ?? BIG_VOID_CANCEL_THRESHOLD;
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

  if (cancelledMatches >= voidThreshold) {
    warnings.push(
      `中止 ${cancelledMatches} 試合は ${voidThreshold} 以上＝くじ不成立で全額払戻（実質EV 1.00倍）。`,
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

  // ★下位等の「300円床崩れ」（実データで確認・2026-07-10）:
  // 中止Mが多い回では有効試合数が減り、下位等的中が激増して1口配当が最低額(=口単価)の床に張り付く。
  // 第1476回(M=4)は下位還元が 0.15→0.32 に倍増（=P(有効8試合中3以上的中)=0.3215 と一致）、
  // その過払いが1等プールから引かれ、1等の per-unit 払戻は算式より小さくなった（27.8M→24.8M/口）。
  // 総額は不変式 EV≤r+C/S で保護されるが、(1) uncapped 時の1口払戻表示が楽観的に出る、
  // (2) 上限超過→翌回キャリーのロールオーバー額が床過払い分だけ減る、という歪みが残る。
  // 本関数は下位を定数floorで近似するため、Mが大きい回では per-unit 1等を過大に、下位floorを過小に見積もる。
  const highCancelFloorBreak = cancelledMatches >= 3;

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
      `1等配分 ${(firstPrizeShare * 100).toFixed(0)}% は実配当バックテスト（過去回の売上・当せん・繰越）で実証済みの等級配分。`,
    );
  } else {
    warnings.push(`1等配分 ${(firstPrizeShare * 100).toFixed(0)}% は暫定値。公式の等級配分確認で精度が上がります。`);
  }
  if (cancelledMatches === voidThreshold - 1) {
    warnings.push(
      `中止 ${cancelledMatches} 試合＝あと1試合中止で ${voidThreshold} 到達＝くじ不成立(全額払戻・実質EV1.0)に転落。大型台風ほど「当たり」でなく「払戻」で終わるリスク。`,
    );
  }
  if (highCancelFloorBreak) {
    warnings.push(
      `中止 ${cancelledMatches} 試合＝下位等が最低額(${ticketPriceYen}円)の床に張り付きやすい局面。` +
        `1口払戻見込は楽観的に、下位等floorは保守的に出る（総EVは不変式で保護）。翌回キャリー予測には過払い分の補正が要る。`,
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
  const voidThreshold = bigVoidCancelThreshold(input.productType) ?? BIG_VOID_CANCEL_THRESHOLD;

  for (let m = 1; m < voidThreshold; m += 1) {
    if (calculateBigTrueEv({ ...input, cancelledMatches: m }).status === "positive_ev") {
      return m;
    }
  }
  return null;
}

// ── 不変式: EV ≤ 還元率 + キャリー ÷ 最終売上 ─────────────────────────────
// パリミュチュエルでは原資(売上×還元率＋キャリー)が全額払い出される。殺到レジーム
// (同時当選者≫1)では 1等EV → 還元率×1等配分 + C/S、下位等 → 還元率×(1−1等配分) となり
// **1等配分が相殺されて** EV → 還元率 + C/S に収束する。上限が張り付く場合は超過分が
// 払い出されないため EV はさらに下がる。よって中止数・1等配分・上限によらず上界が立つ。
//
// 帰結: +EV の必要条件は  最終売上 < キャリー ÷ (1 − 還元率)。還元率0.5なら「最終売上 < 2×キャリー」。
// 中止が何試合起きても、この売上を超えた回は買ってはいけない。

/**
 * 1口真EVの理論上界（＝殺到しきった極限値）。中止数・1等配分・1等上限に依存しない。
 * @returns 上界(倍率)。売上が0以下・還元率不明なら null。
 */
export function bigTrueEvUpperBound(input: {
  carryoverYen: number | null;
  projectedFinalSalesYen: number | null;
  returnRate: number | null;
}): number | null {
  const carryoverYen = asFiniteNumber(input.carryoverYen);
  const projectedFinalSalesYen = asPositiveNumber(input.projectedFinalSalesYen);
  const returnRate = asFiniteNumber(input.returnRate);

  if (carryoverYen === null || projectedFinalSalesYen === null || returnRate === null) {
    return null;
  }

  return returnRate + carryoverYen / projectedFinalSalesYen;
}

/**
 * 中止数・1等配分・上限に依存しない「絶対天井」＝ この最終売上を超えたら、何試合中止しようが
 * +EV はありえない売上。EV上界 = 還元率 + C/S を 1 と置いて S について解いた値。
 *
 * salesCeilingForPositiveEv（中止数を固定した実効天井）は常にこの値以下になる。
 * @returns 絶対天井(円)。キャリー無し・還元率1以上なら null（窓は原理的に開かない）。
 */
export function absoluteSalesCeilingForPositiveEv(input: {
  carryoverYen: number | null;
  returnRate: number | null;
}): number | null {
  const carryoverYen = asPositiveNumber(input.carryoverYen);
  const returnRate = asFiniteNumber(input.returnRate);

  if (carryoverYen === null || returnRate === null || returnRate >= 1) {
    return null;
  }

  return carryoverYen / (1 - returnRate);
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

// ── 商品選択（BIG / MEGA BIG / 100円BIG のどれを買うか）─────────────────────
// 2026-08-07 第1644回の検討で確立。直感「1等上限が大きいMEGAのほうが夢がある」は
// **中止1試合までは誤り**。1等確率が 3.51倍(16,777,216/4,782,969) 悪いのに上限は
// 2倍(12億/6億)にしかならないため、1口あたり1等EVは cap 張り付き域で BIG が 1.75倍良い。
// 逆転するのは M>=2。中止1試合あたりの確率ブーストが BIG=3倍 / MEGA=4倍 で、
// M=2 では BIG の1口払戻が同時当選で崩れる一方 MEGA はまだ上限近くを1口で取れる。
// この交点は cap・odds・キャリー・想定売上で動くので、prose に書かず毎回ここで解く。

export type BigProductCandidate = {
  carryoverYen: number | null;
  productType: BigCarryoverProductType;
  /** シナリオごとの想定最終売上。締切前に中止が公表されうる回は殺到（第1476回は通常の約7倍）を織り込んで大きく、締切後中止パスは平常のまま。 */
  projectedFinalSalesYen: number | null;
};

export type BigProductRanking = {
  estimatedFirstPrizePayoutYen: number | null;
  firstPrizeEvMultiple: number | null;
  firstPrizeWinProbability: number | null;
  productType: BigCarryoverProductType;
  status: BigOpportunityStatus;
  trueEvMultiple: number | null;
};

function trueEvInputForCandidate(
  candidate: BigProductCandidate,
  returnRate: number | null,
): Omit<BigTrueEvInput, "cancelledMatches"> {
  const defaults = bigCarryoverProductDefaults[candidate.productType];
  return {
    carryoverYen: candidate.carryoverYen,
    firstPrizeCapYen: defaults.firstPrizeCapYen,
    firstPrizeShare: BIG_FIRST_PRIZE_ALLOCATION_SHARE[candidate.productType],
    productType: candidate.productType,
    projectedFinalSalesYen: candidate.projectedFinalSalesYen,
    returnRate,
    ticketPriceYen: defaults.ticketPriceYen,
  };
}

/**
 * 指定した中止数のもとで、候補商品を1口真EVの降順に並べる。先頭が「その中止数で買うべき商品」。
 * 口単価が違う商品(100円BIG)も EV は倍率なので直接比較できる。
 * 商品間の比較は同じ売上シナリオ同士（平常 vs 平常・殺到 vs 殺到）で行うこと。
 */
export function rankBigProductsByTrueEv(
  candidates: BigProductCandidate[],
  options: { cancelledMatches: number; returnRate: number | null },
): BigProductRanking[] {
  return candidates
    .map((candidate) => {
      const result = calculateBigTrueEv({
        ...trueEvInputForCandidate(candidate, options.returnRate),
        cancelledMatches: options.cancelledMatches,
      });
      return {
        estimatedFirstPrizePayoutYen: result.estimatedFirstPrizePayoutYen,
        firstPrizeEvMultiple: result.firstPrizeEvMultiple,
        firstPrizeWinProbability: result.firstPrizeWinProbability,
        productType: candidate.productType,
        status: result.status,
        trueEvMultiple: result.trueEvMultiple,
      };
    })
    .sort((a, b) => {
      const aEv = a.trueEvMultiple ?? Number.NEGATIVE_INFINITY;
      const bEv = b.trueEvMultiple ?? Number.NEGATIVE_INFINITY;
      return aEv === bEv ? 0 : bEv - aEv;
    });
}

/**
 * 2商品の優劣が入れ替わる最小の中止数を返す。`challenger` が `incumbent` を初めて上回る M。
 * @returns 交点の中止数。不成立閾値まで一度も逆転しなければ null（＝常に incumbent が優位）。
 */
export function bigProductCrossoverCancellations(input: {
  challenger: BigProductCandidate;
  incumbent: BigProductCandidate;
  returnRate: number | null;
}): number | null {
  const threshold = Math.min(
    bigVoidCancelThreshold(input.incumbent.productType) ?? BIG_VOID_CANCEL_THRESHOLD,
    bigVoidCancelThreshold(input.challenger.productType) ?? BIG_VOID_CANCEL_THRESHOLD,
  );

  for (let m = 0; m < threshold; m += 1) {
    const evOf = (candidate: BigProductCandidate) =>
      calculateBigTrueEv({
        ...trueEvInputForCandidate(candidate, input.returnRate),
        cancelledMatches: m,
      }).trueEvMultiple;
    const challenger = evOf(input.challenger);
    const incumbent = evOf(input.incumbent);
    if (challenger !== null && incumbent !== null && challenger > incumbent) {
      return m;
    }
  }
  return null;
}

// ── 中止未確定のまま買う場合の損益分岐 ─────────────────────────────────────
// 券の価値は購入時点の M ではなく**最終的な M**で決まる（買った後に中止が決まっても効く）。
// よって中止未確定のまま買う行為は P(中止) への賭けであり、EV は M の分布での混合になる。
//   EV = (1 − p)·EV(M=0, 平常売上) + p·EV(M≥1, 中止パスの売上)
// これを 1 と置いて p を解いた値が「この回を買ってよい最低の中止確率」。
// 中止パスの売上は**公表タイミング**で変わる（2026-08-07 第1644回で判明）:
//   締切前に公表されうる回 → 群衆も観測して殺到（第1476回は通常の約7倍）＝希薄化したEV
//   対象試合のKOが締切より後＝中止決定も締切後 → 誰も織り込めず売上は平常のまま＝希薄化なし
// 観測できる窓（ゲートA）は必ず殺到も連れてくる。ゲートBは情報で劣るぶん価格（希薄化なし）で勝る。

/**
 * 中止未確定のまま買うときに損益分岐する P(中止が起きる)。
 * `withCancellation` の想定最終売上は中止の公表タイミングに合わせる:
 * 締切前に公表されうる回は殺到売上、締切後に中止が決まる公算が大きい回は平常売上（希薄化なし）。
 * @returns 必要な中止確率(0〜1)。1超なら「どんな確率でも分岐しない」＝買ってはいけない商品。
 *   中止なしで既に+EVなら 0。分岐不能（中止しても改善しない）なら null。
 */
export function breakevenCancellationProbability(input: {
  cancelledMatches?: number;
  returnRate: number | null;
  withCancellation: BigProductCandidate;
  withoutCancellation: BigProductCandidate;
}): number | null {
  const evNoCancel = calculateBigTrueEv({
    ...trueEvInputForCandidate(input.withoutCancellation, input.returnRate),
    cancelledMatches: 0,
  }).trueEvMultiple;
  const evCancel = calculateBigTrueEv({
    ...trueEvInputForCandidate(input.withCancellation, input.returnRate),
    cancelledMatches: Math.max(1, Math.floor(input.cancelledMatches ?? 1)),
  }).trueEvMultiple;

  if (evNoCancel === null || evCancel === null) {
    return null;
  }
  if (evNoCancel >= 1) {
    return 0;
  }
  if (evCancel <= evNoCancel) {
    return null;
  }
  return (1 - evNoCancel) / (evCancel - evNoCancel);
}

// ── 中止ゼロの回は、キャリーがいくら積もっても原理的に +EV にならない ───────────
// 2026-08-07 に calculator.test.ts が反証して判明。1等払戻には「1口あたり」の上限が
// 掛かる（BIG 6億 / MEGA BIG 12億 / 100円BIG 2億）ため、M=0 の1等EVは
//   上限 ÷ 組み合わせ数 ÷ 口単価   （= 上限 × 理論確率 ÷ 口単価）
// で頭打ちになり、キャリー額に依存しない。BIG=0.418・MEGA=0.238・100円=0.418、
// 下位等の床 r(1−α) を足しても 0.518 / 0.388 / 0.538 で、**どれも1を超えない**。
// 帰結: このレーンのエッジは「キャリーの大きさ」ではなく **中止による確率ブースト**が
// 100%の源泉。キャリーは中止が起きた時の payout を上限まで満たす燃料にすぎない。
// 「キャリー◯◯億で過去最高」は買い判断の根拠にならない。

/**
 * 中止0試合のときに構造上到達しうる1口真EVの上限。キャリー額・売上に依存しない。
 * @returns 真EVの天井(倍率)。商品構造か配分が不明なら null。
 */
export function trueEvCeilingWithoutCancellations(
  productType: BigCarryoverProductType,
  returnRate: number | null,
): number | null {
  const defaults = bigCarryoverProductDefaults[productType];
  const share = BIG_FIRST_PRIZE_ALLOCATION_SHARE[productType];
  const cap = asPositiveNumber(defaults.firstPrizeCapYen);
  const odds = asPositiveNumber(defaults.firstPrizeOdds);
  const price = asPositiveNumber(defaults.ticketPriceYen);
  const rate = asFiniteNumber(returnRate);

  if (cap === null || odds === null || price === null || rate === null || share === null) {
    return null;
  }
  return cap / odds / price + rate * (1 - share);
}
