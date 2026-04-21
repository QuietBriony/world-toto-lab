import type { RoundEvAssumption } from "@/lib/types";

export const DEFAULT_PROXY_WEIGHTS = {
  alpha: 4.2,
  beta: 1.1,
  gamma: 1.4,
} as const;

function isKnownNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function multiplyProbabilities(values: readonly number[]) {
  return values.reduce((product, value) => product * value, 1);
}

export function productOrNull(values: readonly (number | null | undefined)[]) {
  if (!values.every(isKnownNumber)) {
    return null;
  }

  return multiplyProbabilities(values);
}

export function calculateExpectedOtherWinners(input: {
  pPublicCombo: number;
  totalSalesYen: number;
  stakeYen: number;
}) {
  const totalTicketsEstimate = input.totalSalesYen / input.stakeYen;
  return Math.max(0, (totalTicketsEstimate - 1) * input.pPublicCombo);
}

export function calculateEstimatedPayout(input: {
  assumption: Pick<
    RoundEvAssumption,
    "carryoverYen" | "firstPrizeShare" | "payoutCapYen" | "returnRate" | "stakeYen" | "totalSalesYen"
  >;
  pPublicCombo: number;
}) {
  if (!isKnownNumber(input.assumption.totalSalesYen) || input.assumption.stakeYen <= 0) {
    return null;
  }

  const expectedOtherWinners = calculateExpectedOtherWinners({
    pPublicCombo: input.pPublicCombo,
    totalSalesYen: input.assumption.totalSalesYen,
    stakeYen: input.assumption.stakeYen,
  });
  const firstPrizePoolEstimate =
    input.assumption.totalSalesYen * input.assumption.returnRate * input.assumption.firstPrizeShare +
    input.assumption.carryoverYen;
  const estimatedPayoutIfHit = firstPrizePoolEstimate / (1 + expectedOtherWinners);

  return isKnownNumber(input.assumption.payoutCapYen)
    ? Math.min(estimatedPayoutIfHit, input.assumption.payoutCapYen)
    : estimatedPayoutIfHit;
}

export function calculateTicketEv(input: {
  assumption: RoundEvAssumption | null;
  selectedModelProbabilities: readonly (number | null | undefined)[];
  selectedOfficialProbabilities: readonly (number | null | undefined)[];
}) {
  const pModelCombo = productOrNull(input.selectedModelProbabilities);
  const pPublicCombo = productOrNull(input.selectedOfficialProbabilities);

  if (!input.assumption || !isKnownNumber(input.assumption.totalSalesYen) || pModelCombo === null || pPublicCombo === null) {
    return {
      estimatedPayoutYen: null,
      evMultiple: null,
      evPercent: null,
      grossEvYen: null,
      pModelCombo,
      pPublicCombo,
      strictAvailable: false,
    };
  }

  const estimatedPayoutYen = calculateEstimatedPayout({
    assumption: input.assumption,
    pPublicCombo,
  });

  if (estimatedPayoutYen === null) {
    return {
      estimatedPayoutYen: null,
      evMultiple: null,
      evPercent: null,
      grossEvYen: null,
      pModelCombo,
      pPublicCombo,
      strictAvailable: false,
    };
  }

  const grossEvYen = pModelCombo * estimatedPayoutYen;
  const evMultiple = grossEvYen / input.assumption.stakeYen;

  return {
    estimatedPayoutYen,
    evMultiple,
    evPercent: evMultiple * 100,
    grossEvYen,
    pModelCombo,
    pPublicCombo,
    strictAvailable: true,
  };
}

export function calculateProxyScore(input: {
  humanAlignmentScore: number;
  selectedOfficialProbabilities: readonly (number | null | undefined)[];
  selectedScoringProbabilities: readonly (number | null | undefined)[];
  selectedModelProbabilities?: readonly (number | null | undefined)[];
  upsetPenalty: number;
  weights?: Partial<typeof DEFAULT_PROXY_WEIGHTS>;
}) {
  const weights = {
    ...DEFAULT_PROXY_WEIGHTS,
    ...(input.weights ?? {}),
  };
  const selectedScoringProbabilities = input.selectedScoringProbabilities.map((value) =>
    isKnownNumber(value) ? Math.max(value, 0.01) : 0.01,
  );
  const selectedOfficialProbabilities = input.selectedOfficialProbabilities.map((value) =>
    isKnownNumber(value) ? Math.max(value, 0) : 0.33,
  );
  const selectedModelProbabilities = (input.selectedModelProbabilities ?? input.selectedScoringProbabilities).map(
    (value) => (isKnownNumber(value) ? Math.max(value, 0.01) : 0.01),
  );

  const logScore = selectedScoringProbabilities.reduce((sum, value) => sum + Math.log(value), 0);
  const edgeScore = selectedModelProbabilities.reduce((sum, value, index) => {
    return sum + (value - selectedOfficialProbabilities[index]);
  }, 0);
  const crowdFadeScore = selectedOfficialProbabilities.reduce((sum, value) => sum + (1 - value), 0);

  return (
    logScore +
    weights.alpha * edgeScore +
    weights.beta * crowdFadeScore +
    weights.gamma * input.humanAlignmentScore -
    input.upsetPenalty
  );
}
