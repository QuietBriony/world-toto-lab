import {
  OUTCOME_VALUES,
  clamp,
  favoriteOutcome,
  serializeOutcomeList,
  type OutcomeValue,
} from "@/lib/domain";
import type { MatchCategory } from "@/lib/types";

type ProbabilityTriplet = Record<OutcomeValue, number>;

type EstimatorInput = {
  category: MatchCategory | null;
  marketProb0: number | null;
  marketProb1: number | null;
  marketProb2: number | null;
  officialVote0: number | null;
  officialVote1: number | null;
  officialVote2: number | null;
};

const priorTriplet: ProbabilityTriplet = {
  "1": 0.36,
  "0": 0.28,
  "2": 0.36,
};

function normalizeTriplet(input: Partial<Record<OutcomeValue, number | null>>) {
  const values = {
    "1": Math.max(input["1"] ?? 0, 0),
    "0": Math.max(input["0"] ?? 0, 0),
    "2": Math.max(input["2"] ?? 0, 0),
  } satisfies ProbabilityTriplet;
  const total = values["1"] + values["0"] + values["2"];

  if (total <= 0) {
    return null;
  }

  return {
    "1": values["1"] / total,
    "0": values["0"] / total,
    "2": values["2"] / total,
  } satisfies ProbabilityTriplet;
}

function mixTriplets(inputs: Array<{ triplet: ProbabilityTriplet; weight: number }>) {
  const totalWeight = inputs.reduce((sum, entry) => sum + entry.weight, 0);

  if (totalWeight <= 0) {
    return null;
  }

  const mixed = {
    "1": 0,
    "0": 0,
    "2": 0,
  } satisfies ProbabilityTriplet;

  inputs.forEach(({ triplet, weight }) => {
    OUTCOME_VALUES.forEach((outcome) => {
      mixed[outcome] += triplet[outcome] * weight;
    });
  });

  return normalizeTriplet(mixed);
}

function pickRecommendedOutcomes(probabilities: ProbabilityTriplet) {
  const ranked = OUTCOME_VALUES.map((outcome) => ({
    outcome,
    value: probabilities[outcome],
  })).sort((left, right) => right.value - left.value);

  const primary = ranked[0]?.outcome;
  const secondary = ranked[1];

  if (!primary) {
    return null;
  }

  const picks: OutcomeValue[] = [primary];

  if (
    secondary &&
    (secondary.value >= 0.29 || ranked[0].value - secondary.value <= 0.07)
  ) {
    picks.push(secondary.outcome);
  }

  if (probabilities["0"] >= 0.32 && !picks.includes("0")) {
    picks.push("0");
  }

  return serializeOutcomeList(picks.slice(0, 3));
}

export function canEstimateAiModel(input: EstimatorInput) {
  return Boolean(
    normalizeTriplet({
      "1": input.officialVote1,
      "0": input.officialVote0,
      "2": input.officialVote2,
    }) ||
      normalizeTriplet({
        "1": input.marketProb1,
        "0": input.marketProb0,
        "2": input.marketProb2,
      }),
  );
}

export function estimateAiModel(input: EstimatorInput) {
  const official = normalizeTriplet({
    "1": input.officialVote1,
    "0": input.officialVote0,
    "2": input.officialVote2,
  });
  const market = normalizeTriplet({
    "1": input.marketProb1,
    "0": input.marketProb0,
    "2": input.marketProb2,
  });

  if (!official && !market) {
    return null;
  }

  let probabilities =
    mixTriplets(
      [
        { triplet: priorTriplet, weight: 0.18 },
        official ? { triplet: official, weight: market ? 0.32 : 0.82 } : null,
        market ? { triplet: market, weight: official ? 0.5 : 0.82 } : null,
      ].filter((entry): entry is { triplet: ProbabilityTriplet; weight: number } => entry !== null),
    ) ?? priorTriplet;

  const officialFavorite = official ? favoriteOutcome(official) : null;
  const marketFavorite = market ? favoriteOutcome(market) : null;
  const sideGap = Math.abs(probabilities["1"] - probabilities["2"]);

  if (officialFavorite && marketFavorite && officialFavorite !== marketFavorite) {
    probabilities = normalizeTriplet({
      "1": probabilities["1"] - 0.012,
      "0": probabilities["0"] + 0.024,
      "2": probabilities["2"] - 0.012,
    }) ?? probabilities;
  }

  const drawBoost = clamp(0.11 - sideGap, 0, 0.045);
  if (drawBoost > 0) {
    probabilities = normalizeTriplet({
      "1": probabilities["1"] - drawBoost / 2,
      "0": probabilities["0"] + drawBoost,
      "2": probabilities["2"] - drawBoost / 2,
    }) ?? probabilities;
  }

  if (input.category === "draw_candidate") {
    probabilities = normalizeTriplet({
      "1": probabilities["1"] - 0.02,
      "0": probabilities["0"] + 0.04,
      "2": probabilities["2"] - 0.02,
    }) ?? probabilities;
  }

  if (input.category === "fixed") {
    const fixedFavorite = favoriteOutcome(probabilities);
    if (fixedFavorite) {
      probabilities = normalizeTriplet({
        "1": probabilities["1"] + (fixedFavorite === "1" ? 0.035 : -0.0175),
        "0": probabilities["0"] + (fixedFavorite === "0" ? 0.035 : -0.0175),
        "2": probabilities["2"] + (fixedFavorite === "2" ? 0.035 : -0.0175),
      }) ?? probabilities;
    }
  }

  if (input.category === "contrarian" && officialFavorite) {
    const contrarianTarget = OUTCOME_VALUES.find((outcome) => outcome !== officialFavorite) ?? "0";
    probabilities = normalizeTriplet({
      "1":
        probabilities["1"] +
        (contrarianTarget === "1" ? 0.03 : officialFavorite === "1" ? -0.03 : 0),
      "0":
        probabilities["0"] +
        (contrarianTarget === "0" ? 0.03 : officialFavorite === "0" ? -0.03 : 0),
      "2":
        probabilities["2"] +
        (contrarianTarget === "2" ? 0.03 : officialFavorite === "2" ? -0.03 : 0),
    }) ?? probabilities;
  }

  if (input.category === "info_wait") {
    probabilities =
      mixTriplets([
        { triplet: probabilities, weight: 0.75 },
        { triplet: priorTriplet, weight: 0.25 },
      ]) ?? probabilities;
  }

  return {
    modelProb1: probabilities["1"],
    modelProb0: probabilities["0"],
    modelProb2: probabilities["2"],
    recommendedOutcomes: pickRecommendedOutcomes(probabilities),
  };
}
