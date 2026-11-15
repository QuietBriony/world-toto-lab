// Research only. No repository, browser storage, network, or purchase integration.
const outcomes = ["1", "0", "2"] as const;
type Outcome = (typeof outcomes)[number];
type Probabilities = Readonly<Record<Outcome, number>>;

export type TotoValidationProtocol = {
  experimentId: string;
  ruleVersion: string;
  frozenAt: string;
  trainingDataThrough: string;
};

export type TotoValidationPrediction = {
  // Canonical fixture ID, including competition/date; not a round-local M1 ID.
  matchId: string;
  roundId: string;
  decisionAt: string;
  kickoffAt: string;
  savedAt: string;
  latestInputAt: string;
  model: Probabilities;
  market: Probabilities | null;
  official: Probabilities | null;
  selectedOutcome: Outcome | null;
  actualOutcome: Outcome | null;
  resultConfirmedAt: string | null;
};

export type TotoValidationReturn = {
  roundId: string;
  costYen: number;
  payoutYen: number;
  settlement: "official" | "approximate";
};

const isOutcome = (value: unknown): value is Outcome =>
  outcomes.includes(value as Outcome);
const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
// Do not let padded IDs bypass duplicate checks; require an explicit correction.
const isIdentifier = (value: unknown): value is string =>
  hasText(value) && value === value.trim();

// Require an explicit timezone and reject dates Date.parse would normalize.
function instant(value: unknown): number {
  if (typeof value !== "string") return NaN;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts) return NaN;
  const [, year, month, day, hour, minute, second, zone] = parts;
  const days = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  if (
    Number(month) < 1 || Number(month) > 12 || Number(day) < 1 ||
    Number(day) > days || Number(hour) > 23 || Number(minute) > 59 ||
    Number(second) > 59 ||
    (zone !== "Z" && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59))
  ) return NaN;
  return Date.parse(value);
}

function validProbabilities(value: unknown): value is Probabilities {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (Object.keys(value).length !== outcomes.length ||
      !outcomes.every((outcome) => Object.hasOwn(value, outcome))) return false;
  const values = outcomes.map((outcome) => (value as Probabilities)[outcome]);
  return values.every((probability) =>
    typeof probability === "number" && Number.isFinite(probability) &&
    probability >= 0 && probability <= 1,
  ) && Math.abs(values.reduce((sum, probability) => sum + probability, 0) - 1) <= 1e-6;
}

function scores(rows: readonly TotoValidationPrediction[], key: "model" | "market" | "official") {
  if (!rows.length) return null;
  let logLoss = 0;
  let brier = 0;
  let hits = 0;
  for (const row of rows) {
    const probabilities = row[key]!;
    // Finite JSON output even for an impossible prediction; no probability renormalization.
    logLoss -= Math.log(Math.max(1e-15, probabilities[row.actualOutcome!]));
    for (const outcome of outcomes) {
      brier += (probabilities[outcome] - Number(outcome === row.actualOutcome)) ** 2;
    }
    const favorite = outcomes.reduce((best, outcome) =>
      probabilities[outcome] > probabilities[best] ? outcome : best,
    );
    hits += Number(favorite === row.actualOutcome);
  }
  return { count: rows.length, logLoss: logLoss / rows.length, brier: brier / rows.length, accuracy: hits / rows.length };
}

function comparison(rows: readonly TotoValidationPrediction[], key: "market" | "official") {
  // Both scores must use the same fixtures, including when a source is missing.
  const cohort = rows.filter((row) => row[key] !== null);
  const model = scores(cohort, "model");
  const baseline = scores(cohort, key);
  return {
    count: cohort.length,
    missingCount: rows.length - cohort.length,
    model,
    baseline,
    deltaLogLoss: model && baseline ? model.logLoss - baseline.logLoss : null,
    deltaBrier: model && baseline ? model.brier - baseline.brier : null,
  };
}

function calibration(rows: readonly TotoValidationPrediction[], selectedOnly: boolean) {
  const bins = Array.from({ length: 10 }, (_, index) => ({
    lower: index / 10, upper: (index + 1) / 10, count: 0, probabilitySum: 0, hits: 0,
  }));
  for (const row of rows) {
    for (const outcome of outcomes) {
      if (selectedOnly && outcome !== row.selectedOutcome) continue;
      const probability = row.model[outcome];
      const bin = bins[Math.min(9, Math.floor(probability * 10))];
      bin.count += 1;
      bin.probabilitySum += probability;
      bin.hits += Number(outcome === row.actualOutcome);
    }
  }
  return bins.map(({ probabilitySum, hits, ...bin }) => ({
    ...bin,
    predicted: bin.count ? probabilitySum / bin.count : null,
    observed: bin.count ? hits / bin.count : null,
  }));
}

export function validateTotoPredictions(
  protocol: TotoValidationProtocol,
  predictions: readonly TotoValidationPrediction[],
) {
  const frozenAt = instant(protocol?.frozenAt);
  const trainingThrough = instant(protocol?.trainingDataThrough);
  if (
    !hasText(protocol?.experimentId) || !hasText(protocol?.ruleVersion) ||
    !Number.isFinite(frozenAt) || !Number.isFinite(trainingThrough) ||
    trainingThrough >= frozenAt
  ) throw new Error("Protocol needs an ID, rule version, and trainingDataThrough < frozenAt with explicit timezones.");
  if (!Array.isArray(predictions)) throw new Error("predictions must be an array.");

  const frequencies = new Map<string, number>();
  for (const row of predictions) {
    if (hasText(row?.matchId)) frequencies.set(row.matchId, (frequencies.get(row.matchId) ?? 0) + 1);
  }
  const evaluated: TotoValidationPrediction[] = [];
  const pending: string[] = [];
  const excluded: Array<{ index: number; matchId: string | null; reasons: string[] }> = [];
  predictions.forEach((row, index) => {
    const reasons: string[] = [];
    if (!row || !isIdentifier(row.matchId) || !isIdentifier(row.roundId)) {
      excluded.push({ index, matchId: row?.matchId ?? null, reasons: ["invalid_identity"] });
      return;
    }
    if (frequencies.get(row.matchId)! > 1) reasons.push("duplicate_fixture");
    for (const key of ["model", "market", "official"] as const) {
      if (!(key !== "model" && row[key] === null) && !validProbabilities(row[key])) {
        reasons.push(`invalid_${key}_probabilities`);
      }
    }
    if (row.selectedOutcome !== null && !isOutcome(row.selectedOutcome)) reasons.push("invalid_selection");
    const decision = instant(row.decisionAt);
    const kickoff = instant(row.kickoffAt);
    const saved = instant(row.savedAt);
    const latestInput = instant(row.latestInputAt);
    if (![decision, kickoff, saved, latestInput].every(Number.isFinite)) {
      reasons.push("invalid_timestamp");
    } else {
      if (frozenAt > saved) reasons.push("rule_not_frozen_before_prediction");
      if (latestInput > saved) reasons.push("input_after_prediction");
      if (saved > decision) reasons.push("prediction_after_decision");
      if (decision >= kickoff) reasons.push("decision_not_before_kickoff");
    }
    if (row.actualOutcome === null && row.resultConfirmedAt === null) {
      // Pending is distinct from a malformed or excluded prediction.
    } else if (!isOutcome(row.actualOutcome) || !Number.isFinite(instant(row.resultConfirmedAt))) {
      reasons.push("invalid_result");
    } else if (instant(row.resultConfirmedAt) < kickoff) {
      reasons.push("result_before_kickoff");
    }
    if (reasons.length) excluded.push({ index, matchId: row.matchId, reasons });
    else if (row.actualOutcome === null) pending.push(row.matchId);
    else evaluated.push(row);
  });

  const selected = evaluated.filter((row) => row.selectedOutcome !== null);
  // Fixed diagnostic band, not a rule for selecting candidates.
  const publicLongshots = selected.filter((row) =>
    row.official !== null && row.official[row.selectedOutcome!] <= 0.2,
  );
  return {
    protocol,
    inputCount: predictions.length,
    evaluatedCount: evaluated.length,
    pendingCount: pending.length,
    pending,
    excludedCount: excluded.length,
    excluded,
    model: scores(evaluated, "model"),
    marketComparison: comparison(evaluated, "market"),
    officialComparison: comparison(evaluated, "official"),
    calibration: calibration(evaluated, false),
    selectedCalibration: { count: selected.length, bins: calibration(selected, true) },
    publicLongshotCalibration: { count: publicLongshots.length, bins: calibration(publicLongshots, true) },
  };
}

function returnSummary(rows: readonly TotoValidationReturn[]) {
  const costYen = rows.reduce((sum, row) => sum + row.costYen, 0);
  const payoutYen = rows.reduce((sum, row) => sum + row.payoutYen, 0);
  const staked = rows.filter((row) => row.costYen > 0);
  const sorted = [...staked].sort((left, right) =>
    right.payoutYen - left.payoutYen || left.roundId.localeCompare(right.roundId),
  );
  const stress = (requested: number) => {
    const top = sorted.slice(0, requested);
    const topPayout = top.reduce((sum, row) => sum + row.payoutYen, 0);
    const topCost = top.reduce((sum, row) => sum + row.costYen, 0);
    return {
      roundIds: top.map((row) => row.roundId),
      payoutShare: payoutYen ? topPayout / payoutYen : null,
      // Keep all costs: what if those payouts never occurred?
      zeroedPayoutReturnRate: costYen ? (payoutYen - topPayout) / costYen : null,
      // Remove both costs and payouts: sensitivity to excluding whole rounds.
      excludedRoundReturnRate: costYen > topCost ? (payoutYen - topPayout) / (costYen - topCost) : null,
    };
  };
  return {
    roundCount: rows.length,
    stakedRoundCount: staked.length,
    costYen,
    payoutYen,
    netYen: payoutYen - costYen,
    returnRate: costYen ? payoutYen / costYen : null,
    top1: stress(1),
    top3: stress(3),
    top1Percent: stress(Math.ceil(staked.length * 0.01)),
  };
}

export function summarizeTotoReturns(rows: readonly TotoValidationReturn[]) {
  if (!Array.isArray(rows)) throw new Error("returns must be an array.");
  const seen = new Set<string>();
  for (const row of rows) {
    if (
      !row || !isIdentifier(row.roundId) || seen.has(row.roundId) ||
      !Number.isSafeInteger(row.costYen) || !Number.isSafeInteger(row.payoutYen) ||
      row.costYen < 0 || row.payoutYen < 0 || (row.costYen === 0 && row.payoutYen !== 0) ||
      (row.settlement !== "official" && row.settlement !== "approximate")
    ) throw new Error("Returns need unique round IDs, nonnegative integer yen, and an explicit settlement type; no payout without cost.");
    seen.add(row.roundId);
  }
  if (!Number.isSafeInteger(rows.reduce((sum, row) => sum + row.costYen, 0)) ||
      !Number.isSafeInteger(rows.reduce((sum, row) => sum + row.payoutYen, 0))) {
    throw new Error("Return totals exceed safe integer precision.");
  }
  return {
    all: returnSummary(rows),
    official: returnSummary(rows.filter((row) => row.settlement === "official")),
    approximate: returnSummary(rows.filter((row) => row.settlement === "approximate")),
  };
}
