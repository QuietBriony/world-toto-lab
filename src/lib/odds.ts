export type DecimalOddsTriplet = {
  odds0: number | null;
  odds1: number | null;
  odds2: number | null;
};

export type NoVigProbabilityTriplet = {
  bookSum: number | null;
  marketProb0: number | null;
  marketProb1: number | null;
  marketProb2: number | null;
  overround: number | null;
  warnings: string[];
};

function asValidDecimalOdds(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 1 ? value : null;
}

export function decimalOddsToImpliedProbability(value: number | null | undefined) {
  const odds = asValidDecimalOdds(value);

  return odds !== null ? 1 / odds : null;
}

export function calculateNoVigProbabilities(
  input: DecimalOddsTriplet,
): NoVigProbabilityTriplet {
  const implied1 = decimalOddsToImpliedProbability(input.odds1);
  const implied0 = decimalOddsToImpliedProbability(input.odds0);
  const implied2 = decimalOddsToImpliedProbability(input.odds2);
  const warnings: string[] = [];

  if (implied1 === null || implied0 === null || implied2 === null) {
    return {
      bookSum: null,
      marketProb0: null,
      marketProb1: null,
      marketProb2: null,
      overround: null,
      warnings: ["decimal odds must be finite numbers greater than 1."],
    };
  }

  const bookSum = implied1 + implied0 + implied2;

  if (bookSum <= 0) {
    return {
      bookSum: null,
      marketProb0: null,
      marketProb1: null,
      marketProb2: null,
      overround: null,
      warnings: ["implied probabilities could not be normalized."],
    };
  }

  const overround = bookSum - 1;

  if (overround < -0.02) {
    warnings.push("book sum is below 1; check whether these are exchange odds or incomplete prices.");
  }

  if (overround > 0.2) {
    warnings.push("book sum is high; no-vig probabilities may be noisy for this market.");
  }

  return {
    bookSum,
    marketProb0: implied0 / bookSum,
    marketProb1: implied1 / bookSum,
    marketProb2: implied2 / bookSum,
    overround,
    warnings,
  };
}
