import type { RoundEvAssumption } from "@/lib/types";

export const DEFAULT_PROXY_WEIGHTS = {
  alpha: 4.2,
  beta: 1.1,
  gamma: 1.4,
} as const;

export type TotoPrizeTierKey = "first" | "second" | "third";

export type TotoPrizeTierDefinition = {
  carryoverEligible: boolean;
  hitCondition: string;
  key: TotoPrizeTierKey;
  label: string;
  missCount: number;
  poolShare: number;
};

export type TotoPrizeTierEv = {
  estimatedPayoutYen: number | null;
  evMultiple: number | null;
  expectedReturnYen: number | null;
  hitCondition: string;
  key: TotoPrizeTierKey;
  label: string;
  missCount: number;
  pModelTier: number | null;
  pPublicTier: number | null;
  poolShare: number;
  strictAvailable: boolean;
};

export const DEFAULT_TOTO_PRIZE_TIERS: readonly TotoPrizeTierDefinition[] = [
  { carryoverEligible: true, hitCondition: "13/13", key: "first", label: "1等", missCount: 0, poolShare: 0.7 },
  { carryoverEligible: false, hitCondition: "12/13", key: "second", label: "2等", missCount: 1, poolShare: 0.15 },
  { carryoverEligible: false, hitCondition: "11/13", key: "third", label: "3等", missCount: 2, poolShare: 0.15 },
] as const;

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

export function calculateTierProbability(
  probabilities: readonly (number | null | undefined)[],
  missCount: number,
) {
  if (!probabilities.every(isKnownNumber) || missCount < 0) {
    return null;
  }

  if (missCount > probabilities.length) {
    return 0;
  }

  const clipped = probabilities.map((probability) => Math.min(1, Math.max(0, probability)));
  const hitProduct = multiplyProbabilities(clipped);

  if (missCount === 0) {
    return hitProduct;
  }

  if (missCount <= 2 && clipped.every((probability) => probability > 0)) {
    const missHitRatios = clipped.map((probability) => (1 - probability) / probability);

    if (missCount === 1) {
      return hitProduct * missHitRatios.reduce((sum, ratio) => sum + ratio, 0);
    }

    const ratioSum = missHitRatios.reduce((sum, ratio) => sum + ratio, 0);
    const ratioSquareSum = missHitRatios.reduce((sum, ratio) => sum + ratio * ratio, 0);
    return hitProduct * ((ratioSum * ratioSum - ratioSquareSum) / 2);
  }

  const dp = new Array<number>(missCount + 1).fill(0);
  dp[0] = 1;

  clipped.forEach((hitProbability) => {
    const missProbability = 1 - hitProbability;

    for (let misses = missCount; misses >= 0; misses -= 1) {
      dp[misses] =
        dp[misses] * hitProbability +
        (misses > 0 ? dp[misses - 1] * missProbability : 0);
    }
  });

  return dp[missCount];
}

export function calculateEstimatedTierPayout(input: {
  assumption: Pick<
    RoundEvAssumption,
    "carryoverYen" | "payoutCapYen" | "returnRate" | "stakeYen" | "totalSalesYen"
  >;
  carryoverEligible: boolean;
  pPublicTier: number | null;
  poolShare: number;
}) {
  if (
    !isKnownNumber(input.assumption.totalSalesYen) ||
    !isKnownNumber(input.pPublicTier) ||
    input.assumption.stakeYen <= 0
  ) {
    return null;
  }

  const expectedOtherWinners = calculateExpectedOtherWinners({
    pPublicCombo: input.pPublicTier,
    totalSalesYen: input.assumption.totalSalesYen,
    stakeYen: input.assumption.stakeYen,
  });
  const prizePool =
    input.assumption.totalSalesYen * input.assumption.returnRate * input.poolShare +
    (input.carryoverEligible ? input.assumption.carryoverYen : 0);
  const estimatedPayout = prizePool / (1 + expectedOtherWinners);

  return input.carryoverEligible && isKnownNumber(input.assumption.payoutCapYen)
    ? Math.min(estimatedPayout, input.assumption.payoutCapYen)
    : estimatedPayout;
}

export function calculateTotoPrizeTierEvs(input: {
  assumption: RoundEvAssumption | null;
  selectedModelProbabilities: readonly (number | null | undefined)[];
  selectedOfficialProbabilities: readonly (number | null | undefined)[];
  tiers?: readonly TotoPrizeTierDefinition[];
}) {
  const tiers = input.tiers ?? DEFAULT_TOTO_PRIZE_TIERS;

  return tiers.map((tier) => {
    const poolShare =
      tier.key === "first" && input.assumption ? input.assumption.firstPrizeShare : tier.poolShare;
    const pModelTier = calculateTierProbability(input.selectedModelProbabilities, tier.missCount);
    const pPublicTier = calculateTierProbability(input.selectedOfficialProbabilities, tier.missCount);
    const estimatedPayoutYen = input.assumption
      ? calculateEstimatedTierPayout({
          assumption: input.assumption,
          carryoverEligible: tier.carryoverEligible,
          pPublicTier,
          poolShare,
        })
      : null;
    const expectedReturnYen =
      isKnownNumber(pModelTier) && isKnownNumber(estimatedPayoutYen)
        ? pModelTier * estimatedPayoutYen
        : null;
    const evMultiple =
      expectedReturnYen !== null && input.assumption && input.assumption.stakeYen > 0
        ? expectedReturnYen / input.assumption.stakeYen
        : null;

    return {
      estimatedPayoutYen,
      evMultiple,
      expectedReturnYen,
      hitCondition: tier.hitCondition,
      key: tier.key,
      label: tier.label,
      missCount: tier.missCount,
      pModelTier,
      pPublicTier,
      poolShare,
      strictAvailable: isKnownNumber(pModelTier) && isKnownNumber(estimatedPayoutYen),
    } satisfies TotoPrizeTierEv;
  });
}

export function sumTotoPrizeTierExpectedReturn(tiers: readonly TotoPrizeTierEv[]) {
  if (!tiers.every((tier) => isKnownNumber(tier.expectedReturnYen))) {
    return null;
  }

  return tiers.reduce((sum, tier) => sum + (tier.expectedReturnYen ?? 0), 0);
}

export function sumTotoPrizeTierHitProbability(tiers: readonly TotoPrizeTierEv[]) {
  if (!tiers.every((tier) => isKnownNumber(tier.pModelTier))) {
    return null;
  }

  return tiers.reduce((sum, tier) => sum + (tier.pModelTier ?? 0), 0);
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
