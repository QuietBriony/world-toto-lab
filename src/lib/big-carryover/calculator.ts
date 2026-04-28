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
