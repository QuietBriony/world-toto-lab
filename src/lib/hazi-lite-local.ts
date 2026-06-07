import {
  buildFeaturedWorldTotoImportPayloads,
  featuredWorldTotoRoundNumbers,
} from "@/lib/featured-world-toto";
import { calculateTicketEv } from "@/lib/ev";
import { calculateModelProbabilities } from "@/lib/probability/engine";
import type {
  Match,
  Outcome,
  Pick as TotoPick,
  ProductType,
  Round,
  RoundEvAssumption,
  TotoOfficialMatch,
  TotoOfficialRound,
  TotoOfficialResultStatus,
  User,
} from "@/lib/types";

const namespace = "world-toto-lab:v1";

const localKeys = {
  candidateTickets: `${namespace}:candidateTickets`,
  candidateVotes: `${namespace}:candidateVotes`,
  currentRound: `${namespace}:currentRound`,
  dataMode: `${namespace}:dataMode`,
  generatedTickets: `${namespace}:generatedTickets`,
  haziAiVersion: `${namespace}:haziLiteAiVersion`,
  matches: `${namespace}:matches`,
  picks: `${namespace}:picks`,
  roundEvAssumptions: `${namespace}:bigCarryoverAssumptions`,
  rounds: `${namespace}:rounds`,
  scoutReports: `${namespace}:scoutReports`,
  totoOfficialMatches: `${namespace}:totoOfficialMatches`,
  totoOfficialRounds: `${namespace}:totoOfficialRounds`,
  users: `${namespace}:users`,
} as const;

const haziLiteAiVersion = "team-strength-v5";
const valueLineSpotCount = 4;

const totoPrizeTiers = [
  { key: "first", label: "1等", missCount: 0, share: 0.7 },
  { key: "second", label: "2等", missCount: 1, share: 0.15 },
  { key: "third", label: "3等", missCount: 2, share: 0.15 },
] as const;

type OutcomeValue = "1" | "0" | "2";
const outcomeValues = ["1", "0", "2"] as const;

export type HaziLiteStrategyKind = "orthodox" | "value";

export type HaziLiteStrategy = {
  badge: string;
  pick: OutcomeValue;
  rationale: string;
  score: string;
};

type HaziLiteLocalState = {
  candidateTickets: unknown[];
  candidateVotes: unknown[];
  generatedTickets: unknown[];
  matches: Match[];
  picks: TotoPick[];
  roundEvAssumptions: RoundEvAssumption[];
  rounds: Round[];
  scoutReports: unknown[];
  totoOfficialMatches: TotoOfficialMatch[];
  totoOfficialRounds: TotoOfficialRound[];
  users: User[];
};

export type HaziLiteMatch = {
  aiPick: OutcomeValue;
  awayTeam: string;
  haziPick: OutcomeValue | null;
  homeTeam: string;
  kickoffTime: string | null;
  matchId: string;
  matchNo: number;
  modelProb0: number | null;
  modelProb1: number | null;
  modelProb2: number | null;
  modelRationale: string;
  modelSource: "official_vote" | "team_strength";
  officialMatchNo: number | null;
  orthodox: HaziLiteStrategy;
  reviewChange: boolean;
  value: HaziLiteStrategy;
};

export type HaziLitePortfolioLine = {
  deviationCount: number;
  duplicateOf: string | null;
  estimatedPayoutYen: number | null;
  evMultiple: number | null;
  grossEvYen: number | null;
  hitProbability: number | null;
  key: "orthodox" | "value" | "hazi" | "ai";
  label: string;
  pPublicCombo: number | null;
  picks: Array<{ matchNo: number; pick: OutcomeValue }>;
  prizeTiers: HaziLitePrizeTier[];
  strictEvReady: boolean;
  totalEvMultiple: number | null;
  totalExpectedReturnYen: number | null;
};

export type HaziLitePrizeTier = {
  estimatedPayoutYen: number | null;
  expectedReturnYen: number | null;
  hitCondition: string;
  hitProbability: number | null;
  label: string;
  poolShare: number;
  strictEvReady: boolean;
};

export type HaziLitePortfolioPlan = {
  costYen: number;
  description: string;
  evMultiple: number | null;
  expectedReturnYen: number | null;
  hitProbability: number | null;
  label: string;
  lineCount: number;
  lineLabels: string[];
  strictEvReady: boolean;
  tone: "balanced" | "conservative" | "upside";
};

export type HaziLitePortfolio = {
  dataQuality: "strict" | "proxy";
  lines: HaziLitePortfolioLine[];
  plans: HaziLitePortfolioPlan[];
  returnRate: number | null;
  stakeYen: number;
  summary: string;
};

export type HaziLiteRound = {
  matchCount: number;
  matches: HaziLiteMatch[];
  pickCount: number;
  portfolio: HaziLitePortfolio;
  reviewChangeCount: number;
  roundId: string;
  roundNumber: number;
  title: string;
};

export type HaziLiteSummary = {
  haziUserId: string | null;
  aiVersion: string;
  isLiteReady: boolean;
  reviewChangeCount: number;
  rounds: HaziLiteRound[];
  totalMatches: number;
  totalPicks: number;
};

function nowIso() {
  return new Date().toISOString();
}

function localId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readArray<T>(key: string): T[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, rows: T[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(rows));
}

function readState(): HaziLiteLocalState {
  return {
    candidateTickets: readArray(localKeys.candidateTickets),
    candidateVotes: readArray(localKeys.candidateVotes),
    generatedTickets: readArray(localKeys.generatedTickets),
    matches: readArray<Match>(localKeys.matches),
    picks: readArray<TotoPick>(localKeys.picks),
    roundEvAssumptions: readArray<RoundEvAssumption>(localKeys.roundEvAssumptions),
    rounds: readArray<Round>(localKeys.rounds),
    scoutReports: readArray(localKeys.scoutReports),
    totoOfficialMatches: readArray<TotoOfficialMatch>(localKeys.totoOfficialMatches),
    totoOfficialRounds: readArray<TotoOfficialRound>(localKeys.totoOfficialRounds),
    users: readArray<User>(localKeys.users),
  };
}

function writeState(state: HaziLiteLocalState) {
  writeArray(localKeys.candidateTickets, state.candidateTickets);
  writeArray(localKeys.candidateVotes, state.candidateVotes);
  writeArray(localKeys.generatedTickets, state.generatedTickets);
  writeArray(localKeys.matches, state.matches);
  writeArray(localKeys.picks, state.picks);
  writeArray(localKeys.roundEvAssumptions, state.roundEvAssumptions);
  writeArray(localKeys.rounds, state.rounds);
  writeArray(localKeys.scoutReports, state.scoutReports);
  writeArray(localKeys.totoOfficialMatches, state.totoOfficialMatches);
  writeArray(localKeys.totoOfficialRounds, state.totoOfficialRounds);
  writeArray(localKeys.users, state.users);
  window.localStorage.setItem(localKeys.dataMode, "local");
  window.localStorage.setItem(localKeys.haziAiVersion, haziLiteAiVersion);
}

function outcomeToEnum(value: OutcomeValue): Outcome {
  if (value === "0") {
    return "DRAW";
  }

  return value === "1" ? "ONE" : "TWO";
}

function enumToOutcome(value: Outcome | null | undefined): OutcomeValue | null {
  if (value === "ONE") {
    return "1";
  }

  if (value === "DRAW") {
    return "0";
  }

  if (value === "TWO") {
    return "2";
  }

  return null;
}

function topOutcome(input: { modelProb0: number; modelProb1: number; modelProb2: number }): OutcomeValue {
  return [
    { outcome: "1" as const, value: input.modelProb1 },
    { outcome: "0" as const, value: input.modelProb0 },
    { outcome: "2" as const, value: input.modelProb2 },
  ].sort((left, right) => right.value - left.value)[0].outcome;
}

function isKnownNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function litePercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function signedLitePercent(value: number) {
  const rounded = Math.round(value * 100);
  return `${rounded >= 0 ? "+" : ""}${rounded}%`;
}

function outcomeProbability(
  match: Pick<
    Match,
    | "marketProb0"
    | "marketProb1"
    | "marketProb2"
    | "modelProb0"
    | "modelProb1"
    | "modelProb2"
    | "officialVote0"
    | "officialVote1"
    | "officialVote2"
  >,
  bucket: "market" | "model" | "official",
  outcome: OutcomeValue,
) {
  if (bucket === "model") {
    return outcome === "1" ? match.modelProb1 : outcome === "0" ? match.modelProb0 : match.modelProb2;
  }

  if (bucket === "official") {
    return outcome === "1" ? match.officialVote1 : outcome === "0" ? match.officialVote0 : match.officialVote2;
  }

  return outcome === "1" ? match.marketProb1 : outcome === "0" ? match.marketProb0 : match.marketProb2;
}

function hasCompleteOfficialVote(match: Match) {
  return outcomeValues.every((outcome) => isKnownNumber(outcomeProbability(match, "official", outcome)));
}

function rankedOutcomeProbabilities(match: Match, bucket: "market" | "model" | "official") {
  return outcomeValues
    .map((outcome) => ({
      outcome,
      value: outcomeProbability(match, bucket, outcome) ?? 0,
    }))
    .sort((left, right) => right.value - left.value);
}

function buildOrthodoxStrategy(match: Match): HaziLiteStrategy {
  const officialReady = hasCompleteOfficialVote(match);
  const ranked = rankedOutcomeProbabilities(match, officialReady ? "official" : "model");
  const favorite = ranked[0];

  if (officialReady) {
    return {
      badge: "公式本命",
      pick: favorite.outcome,
      rationale: "公式人気が最も高い、いちばん市場に沿った王道ライン。",
      score: `人気 ${litePercent(favorite.value)}`,
    };
  }

  return {
    badge: "強度本命",
    pick: favorite.outcome,
    rationale: "公式人気未公表のため、国別強度モデルの最上位を王道扱い。",
    score: `AI ${litePercent(favorite.value)}`,
  };
}

function buildValueStrategy(match: Match): HaziLiteStrategy {
  if (hasCompleteOfficialVote(match)) {
    const ranked = outcomeValues
      .map((outcome) => {
        const modelProb = outcomeProbability(match, "model", outcome) ?? 0;
        const officialVote = outcomeProbability(match, "official", outcome) ?? 0;
        const edge = modelProb - officialVote;
        const valueRatio = officialVote > 0 ? modelProb / officialVote : 0;
        return {
          edge,
          modelProb,
          officialVote,
          outcome,
          score: edge * 10 + valueRatio + (outcome === "0" ? 0.1 : 0),
          valueRatio,
        };
      })
      .filter((entry) => entry.modelProb >= 0.1 && entry.officialVote > 0)
      .sort((left, right) => right.score - left.score);
    const selected = ranked[0] ?? {
      edge: 0,
      modelProb: rankedOutcomeProbabilities(match, "model")[0].value,
      officialVote: 0,
      outcome: rankedOutcomeProbabilities(match, "model")[0].outcome,
      score: 0,
      valueRatio: 1,
    };

    return {
      badge: selected.valueRatio >= 1.35 ? "期待値" : selected.edge > 0 ? "ズレ狙い" : "妙味薄め",
      pick: selected.outcome,
      rationale: `AI ${litePercent(selected.modelProb)} / 人気 ${litePercent(selected.officialVote)} / 差 ${signedLitePercent(selected.edge)}。`,
      score: `${selected.valueRatio.toFixed(2)}x`,
    };
  }

  const ranked = rankedOutcomeProbabilities(match, "model");
  const favorite = ranked[0];
  const second = ranked[1] ?? favorite;
  const draw = ranked.find((entry) => entry.outcome === "0");

  if (draw && favorite.outcome !== "0" && draw.value >= 0.27 && favorite.value - draw.value <= 0.18) {
    return {
      badge: "Proxy",
      pick: "0",
      rationale: "公式人気未公表。国別強度が接近しているため、引き分けを妙味候補として監視。",
      score: `AI ${litePercent(draw.value)}`,
    };
  }

  if (second.value >= 0.24 || favorite.value - second.value <= 0.14) {
    return {
      badge: "Proxy",
      pick: second.outcome,
      rationale: "公式人気未公表。大差ではないカードなので、2番手を妙味候補として監視。",
      score: `AI ${litePercent(second.value)}`,
    };
  }

  return {
    badge: "Proxy",
    pick: favorite.outcome,
    rationale: "公式人気未公表。強弱差が大きく、期待値Proxyも本命寄り。",
    score: `AI ${litePercent(favorite.value)}`,
  };
}

function valueLineSpotScore(match: Match, orthodox: HaziLiteStrategy, value: HaziLiteStrategy) {
  if (value.pick === orthodox.pick) {
    return 0;
  }

  const candidateProb = outcomeProbability(match, "model", value.pick) ?? 0;
  const favoriteProb = outcomeProbability(match, "model", orthodox.pick) ?? 0;

  if (hasCompleteOfficialVote(match)) {
    const officialVote = outcomeProbability(match, "official", value.pick) ?? 0;
    if (officialVote <= 0) {
      return 0;
    }

    const edge = candidateProb - officialVote;
    const valueRatio = candidateProb / officialVote;
    return edge * 10 + (valueRatio - 1) + (value.pick === "0" ? 0.1 : 0);
  }

  return candidateProb - Math.max(0, favoriteProb - candidateProb) + (value.pick === "0" ? 0.04 : 0);
}

function holdOrthodoxForValueLine(orthodox: HaziLiteStrategy, value: HaziLiteStrategy): HaziLiteStrategy {
  if (value.pick === orthodox.pick) {
    return {
      ...orthodox,
      badge: value.badge === "Proxy" ? "王道寄せ" : value.badge,
      rationale: `${value.rationale} ライン全体では王道のまま保持。`,
    };
  }

  return {
    ...orthodox,
    badge: "王道保持",
    rationale: `${value.rationale} ライン全体ではここは王道で保持。`,
  };
}

function buildValueLineStrategies(matches: Match[]) {
  const rows = matches.map((match) => {
    const orthodox = buildOrthodoxStrategy(match);
    const value = buildValueStrategy(match);
    return {
      match,
      orthodox,
      score: valueLineSpotScore(match, orthodox, value),
      value,
    };
  });
  const spotMatchIds = new Set(
    rows
      .filter((row) => row.value.pick !== row.orthodox.pick && row.score > 0.12)
      .sort((left, right) => right.score - left.score)
      .slice(0, valueLineSpotCount)
      .map((row) => row.match.id),
  );

  return new Map(
    rows.map((row) => [
      row.match.id,
      spotMatchIds.has(row.match.id)
        ? row.value
        : holdOrthodoxForValueLine(row.orthodox, row.value),
    ]),
  );
}

function selectedOutcomeProbabilities(
  matches: Match[],
  picks: Array<{ matchNo: number; pick: OutcomeValue }>,
  bucket: "model" | "official",
) {
  const pickByMatchNo = new Map(picks.map((pick) => [pick.matchNo, pick.pick]));
  return matches.map((match) => {
    const pick = pickByMatchNo.get(match.matchNo);
    return pick ? outcomeProbability(match, bucket, pick) : null;
  });
}

function lineSignature(picks: Array<{ matchNo: number; pick: OutcomeValue }>) {
  return picks
    .slice()
    .sort((left, right) => left.matchNo - right.matchNo)
    .map((pick) => `${pick.matchNo}:${pick.pick}`)
    .join("|");
}

function sumKnown(values: Array<number | null>) {
  if (!values.every((value): value is number => isKnownNumber(value))) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0);
}

function tierProbability(probabilities: Array<number | null | undefined>, missCount: number) {
  if (!probabilities.every((value): value is number => isKnownNumber(value))) {
    return null;
  }

  const hitProbabilityAt = (index: number) => probabilities[index];
  const missProbabilityAt = (index: number) => 1 - probabilities[index];

  if (missCount === 0) {
    return probabilities.reduce((product, value) => product * value, 1);
  }

  if (missCount === 1) {
    return probabilities.reduce((sum, _value, missIndex) => {
      const probability = probabilities.reduce((product, _candidate, index) => {
        return product * (index === missIndex ? missProbabilityAt(index) : hitProbabilityAt(index));
      }, 1);
      return sum + probability;
    }, 0);
  }

  if (missCount === 2) {
    let probability = 0;
    for (let first = 0; first < probabilities.length - 1; first += 1) {
      for (let second = first + 1; second < probabilities.length; second += 1) {
        probability += probabilities.reduce((product, _candidate, index) => {
          return product * (index === first || index === second ? missProbabilityAt(index) : hitProbabilityAt(index));
        }, 1);
      }
    }
    return probability;
  }

  return null;
}

function calculateTierPayout(input: {
  assumption: RoundEvAssumption | null;
  pPublicTier: number | null;
  share: number;
  useCarryover: boolean;
}) {
  if (
    !input.assumption ||
    !isKnownNumber(input.assumption.totalSalesYen) ||
    !isKnownNumber(input.pPublicTier) ||
    input.assumption.stakeYen <= 0
  ) {
    return null;
  }

  const totalTicketsEstimate = input.assumption.totalSalesYen / input.assumption.stakeYen;
  const expectedOtherWinners = Math.max(0, (totalTicketsEstimate - 1) * input.pPublicTier);
  const prizePool =
    input.assumption.totalSalesYen * input.assumption.returnRate * input.share +
    (input.useCarryover ? input.assumption.carryoverYen : 0);
  const estimatedPayout = prizePool / (1 + expectedOtherWinners);

  return isKnownNumber(input.assumption.payoutCapYen)
    ? Math.min(estimatedPayout, input.assumption.payoutCapYen)
    : estimatedPayout;
}

function buildPrizeTiers(input: {
  assumption: RoundEvAssumption | null;
  modelProbabilities: Array<number | null>;
  officialProbabilities: Array<number | null>;
}) {
  return totoPrizeTiers.map((tier) => {
    const hitProbability = tierProbability(input.modelProbabilities, tier.missCount);
    const pPublicTier = tierProbability(input.officialProbabilities, tier.missCount);
    const estimatedPayoutYen = calculateTierPayout({
      assumption: input.assumption,
      pPublicTier,
      share: tier.share,
      useCarryover: tier.key === "first",
    });

    return {
      estimatedPayoutYen,
      expectedReturnYen:
        isKnownNumber(hitProbability) && isKnownNumber(estimatedPayoutYen)
          ? hitProbability * estimatedPayoutYen
          : null,
      hitCondition:
        tier.missCount === 0
          ? "13/13"
          : tier.missCount === 1
            ? "12/13"
            : "11/13",
      hitProbability,
      label: tier.label,
      poolShare: tier.share,
      strictEvReady: isKnownNumber(hitProbability) && isKnownNumber(estimatedPayoutYen),
    } satisfies HaziLitePrizeTier;
  });
}

function buildPortfolioLine(input: {
  evAssumption: RoundEvAssumption | null;
  key: HaziLitePortfolioLine["key"];
  label: string;
  matches: Match[];
  orthodoxPicks: Array<{ matchNo: number; pick: OutcomeValue }>;
  picks: Array<{ matchNo: number; pick: OutcomeValue }>;
}) {
  const modelProbabilities = selectedOutcomeProbabilities(input.matches, input.picks, "model");
  const officialProbabilities = selectedOutcomeProbabilities(input.matches, input.picks, "official");
  const ev = calculateTicketEv({
    assumption: input.evAssumption,
    selectedModelProbabilities: modelProbabilities,
    selectedOfficialProbabilities: officialProbabilities,
  });
  const prizeTiers = buildPrizeTiers({
    assumption: input.evAssumption,
    modelProbabilities,
    officialProbabilities,
  });
  const totalExpectedReturnYen = sumKnown(prizeTiers.map((tier) => tier.expectedReturnYen));
  const totalEvMultiple =
    totalExpectedReturnYen !== null && input.evAssumption && input.evAssumption.stakeYen > 0
      ? totalExpectedReturnYen / input.evAssumption.stakeYen
      : null;
  const orthodoxByMatchNo = new Map(input.orthodoxPicks.map((pick) => [pick.matchNo, pick.pick]));

  return {
    deviationCount: input.picks.filter((pick) => orthodoxByMatchNo.get(pick.matchNo) !== pick.pick).length,
    duplicateOf: null,
    estimatedPayoutYen: ev.estimatedPayoutYen,
    evMultiple: ev.evMultiple,
    grossEvYen: ev.grossEvYen,
    hitProbability: ev.pModelCombo,
    key: input.key,
    label: input.label,
    pPublicCombo: ev.pPublicCombo,
    picks: input.picks,
    prizeTiers,
    strictEvReady: ev.strictAvailable,
    totalEvMultiple,
    totalExpectedReturnYen,
  } satisfies HaziLitePortfolioLine;
}

function uniqueLines(lines: HaziLitePortfolioLine[]) {
  const seen = new Map<string, HaziLitePortfolioLine>();

  return lines.map((line) => {
    const signature = lineSignature(line.picks);
    const duplicateOf = seen.get(signature)?.label ?? null;
    const nextLine = {
      ...line,
      duplicateOf,
    };

    if (!duplicateOf) {
      seen.set(signature, nextLine);
    }

    return nextLine;
  });
}

function buildPortfolioPlan(input: {
  description: string;
  label: string;
  lineKeys: HaziLitePortfolioLine["key"][];
  lines: HaziLitePortfolioLine[];
  stakeYen: number;
  tone: HaziLitePortfolioPlan["tone"];
}) {
  const selected = input.lineKeys
    .map((key) => input.lines.find((line) => line.key === key))
    .filter((line): line is HaziLitePortfolioLine => Boolean(line));
  const uniqueSelected = selected.filter((line) => !line.duplicateOf);
  const hitProbability = sumKnown(uniqueSelected.map((line) => line.hitProbability));
  const expectedReturnYen = sumKnown(
    uniqueSelected.map((line) => line.totalExpectedReturnYen ?? line.grossEvYen),
  );
  const costYen = uniqueSelected.length * input.stakeYen;

  return {
    costYen,
    description: input.description,
    evMultiple: expectedReturnYen !== null && costYen > 0 ? expectedReturnYen / costYen : null,
    expectedReturnYen,
    hitProbability: hitProbability !== null ? Math.min(hitProbability, 1) : null,
    label: input.label,
    lineCount: uniqueSelected.length,
    lineLabels: uniqueSelected.map((line) => line.label),
    strictEvReady:
      uniqueSelected.length > 0 &&
      uniqueSelected.every((line) => line.prizeTiers.every((tier) => tier.strictEvReady)),
    tone: input.tone,
  } satisfies HaziLitePortfolioPlan;
}

function buildRoundPortfolio(input: {
  evAssumption: RoundEvAssumption | null;
  haziPicksByMatch: Map<string, TotoPick>;
  matches: Match[];
  valueLineByMatch: Map<string, HaziLiteStrategy>;
}) {
  const orthodoxPicks = input.matches.map((match) => ({
    matchNo: match.matchNo,
    pick: buildOrthodoxStrategy(match).pick,
  }));
  const valuePicks = input.matches.map((match) => ({
    matchNo: match.matchNo,
    pick: (input.valueLineByMatch.get(match.id) ?? buildValueStrategy(match)).pick,
  }));
  const haziPicks = input.matches.map((match) => ({
    matchNo: match.matchNo,
    pick:
      enumToOutcome(input.haziPicksByMatch.get(match.id)?.pick) ??
      topOutcome({
        modelProb0: match.modelProb0 ?? 0,
        modelProb1: match.modelProb1 ?? 0,
        modelProb2: match.modelProb2 ?? 0,
      }),
  }));
  const aiPicks = input.matches.map((match) => ({
    matchNo: match.matchNo,
    pick: topOutcome({
      modelProb0: match.modelProb0 ?? 0,
      modelProb1: match.modelProb1 ?? 0,
      modelProb2: match.modelProb2 ?? 0,
    }),
  }));
  const stakeYen = input.evAssumption?.stakeYen ?? 100;
  const lines = uniqueLines([
    buildPortfolioLine({
      evAssumption: input.evAssumption,
      key: "orthodox",
      label: "王道",
      matches: input.matches,
      orthodoxPicks,
      picks: orthodoxPicks,
    }),
    buildPortfolioLine({
      evAssumption: input.evAssumption,
      key: "value",
      label: "期待値",
      matches: input.matches,
      orthodoxPicks,
      picks: valuePicks,
    }),
    buildPortfolioLine({
      evAssumption: input.evAssumption,
      key: "hazi",
      label: "Hazi",
      matches: input.matches,
      orthodoxPicks,
      picks: haziPicks,
    }),
    buildPortfolioLine({
      evAssumption: input.evAssumption,
      key: "ai",
      label: "AI",
      matches: input.matches,
      orthodoxPicks,
      picks: aiPicks,
    }),
  ]);
  const plans = [
    buildPortfolioPlan({
      description: "まず外さない比較軸。公式人気がある回は市場に沿う。",
      label: "保守",
      lineKeys: ["orthodox"],
      lines,
      stakeYen,
      tone: "conservative",
    }),
    buildPortfolioPlan({
      description: "基本形。王道を残しつつ、妙味とHaziの見立てを足す。",
      label: "標準",
      lineKeys: ["orthodox", "value", "hazi"],
      lines,
      stakeYen,
      tone: "balanced",
    }),
    buildPortfolioPlan({
      description: "AI初期線が別なら追加。重複時は自動で口数を増やさない。",
      label: "攻め",
      lineKeys: ["orthodox", "value", "hazi", "ai"],
      lines,
      stakeYen,
      tone: "upside",
    }),
  ];
  const strict = plans.some((plan) => plan.strictEvReady);

  return {
    dataQuality: strict ? "strict" : "proxy",
    lines,
    plans,
    returnRate: input.evAssumption?.returnRate ?? null,
    stakeYen,
    summary: strict
      ? "公式人気と売上想定があるため、払戻推定込みのEVを表示しています。"
      : "公式人気または売上想定が未公表のため、EVはProxyです。口数とモデル的中率を主に見てください。",
  } satisfies HaziLitePortfolio;
}

function recommendedOutcomes(input: { modelProb0: number; modelProb1: number; modelProb2: number }) {
  return [
    { outcome: "1" as const, value: input.modelProb1 },
    { outcome: "0" as const, value: input.modelProb0 },
    { outcome: "2" as const, value: input.modelProb2 },
  ]
    .sort((left, right) => right.value - left.value)
    .slice(0, 2)
    .map((entry) => entry.outcome)
    .join(",");
}

const teamStrengthByName: Record<string, number> = {
  "アイスランド": 74,
  "アルジェリア": 78,
  "アルゼンチン": 96,
  "イングランド": 93,
  "ウズベキスタン": 73,
  "ウルグアイ": 87,
  "エクアドル": 82,
  "エジプト": 80,
  "オーストラリア": 77,
  "オーストリア": 83,
  "オランダ": 91,
  "カーボベルデ": 70,
  "カタール": 72,
  "カナダ": 77,
  "ガーナ": 79,
  "キュラソー": 67,
  "クロアチア": 86,
  "コロンビア": 86,
  "コンゴ民主共和国": 72,
  "コートジボワール": 80,
  "サウジアラビア": 72,
  "スイス": 84,
  "スウェーデン": 82,
  "スコットランド": 78,
  "スペイン": 94,
  "セネガル": 83,
  "チュニジア": 76,
  "チェコ": 79,
  "チリ": 76,
  "ドイツ": 90,
  "ニュージーランド": 67,
  "日本": 83,
  "ノルウェー": 80,
  "ハイチ": 66,
  "パナマ": 70,
  "パラグアイ": 77,
  "ブラジル": 94,
  "フランス": 95,
  "ベルギー": 88,
  "ボスニア": 75,
  "ボスニア・ヘルツェゴビナ": 75,
  "ポルトガル": 92,
  "南アフリカ": 72,
  "メキシコ": 81,
  "モロッコ": 84,
  "ヨルダン": 69,
  "韓国": 80,
};

function teamStrength(teamName: string) {
  return teamStrengthByName[teamName] ?? 75;
}

function teamStrengthPrior(input: { awayTeam: string; homeTeam: string }) {
  const homeStrength = teamStrength(input.homeTeam);
  const awayStrength = teamStrength(input.awayTeam);
  const diff = homeStrength - awayStrength;
  const draw = Math.max(0.19, Math.min(0.31, 0.29 - Math.abs(diff) * 0.003));
  const homeShare = 1 / (1 + Math.exp(-diff / 10));
  const winMass = 1 - draw;

  return {
    modelRationale: `${input.homeTeam} ${homeStrength} / ${input.awayTeam} ${awayStrength} の国別強度差から軽量推定。`,
    modelSource: "team_strength" as const,
    marketProb0: draw,
    marketProb1: winMass * homeShare,
    marketProb2: winMass * (1 - homeShare),
  };
}

function modelSeed(input: {
  awayTeam: string;
  homeTeam: string;
  officialVote0: number | null;
  officialVote1: number | null;
  officialVote2: number | null;
}) {
  const hasOfficialVote =
    input.officialVote1 !== null &&
    input.officialVote0 !== null &&
    input.officialVote2 !== null;

  if (hasOfficialVote) {
    return {
      modelRationale: "公式人気を市場確率として軽量推定。",
      modelSource: "official_vote" as const,
      marketProb0: input.officialVote0,
      marketProb1: input.officialVote1,
      marketProb2: input.officialVote2,
    };
  }

  return teamStrengthPrior(input);
}

function worldRoundNumber(round: Round, officialRound?: TotoOfficialRound | null) {
  const numberFromOfficial = officialRound?.officialRoundNumber ?? null;
  if (
    numberFromOfficial &&
    featuredWorldTotoRoundNumbers.includes(numberFromOfficial as (typeof featuredWorldTotoRoundNumbers)[number])
  ) {
    return numberFromOfficial;
  }

  const matched = `${round.title} ${round.sourceNote ?? ""}`.match(/第(163[4-7])回/);
  return matched ? Number(matched[1]) : null;
}

function findRoundByNumber(state: HaziLiteLocalState, roundNumber: number) {
  const official = state.totoOfficialRounds.find((round) => round.officialRoundNumber === roundNumber);
  if (official) {
    return state.rounds.find((round) => round.id === official.roundId) ?? null;
  }

  return (
    state.rounds.find((round) => {
      const inferred = worldRoundNumber(round, null);
      return inferred === roundNumber;
    }) ?? null
  );
}

function ensureHaziUser(state: HaziLiteLocalState) {
  const existing = state.users.find((user) => user.name.trim().toLowerCase() === "hazi");
  if (existing) {
    return existing;
  }

  const createdAt = nowIso();
  const user: User = {
    createdAt,
    id: localId("user"),
    name: "Hazi",
    role: "admin",
    updatedAt: createdAt,
  };
  state.users.push(user);
  return user;
}

function emptyMatch(roundId: string, matchNo: number, existing?: Match | null): Match {
  const createdAt = existing?.createdAt ?? nowIso();
  return {
    actualResult: null,
    adminAdjust0: null,
    adminAdjust1: null,
    adminAdjust2: null,
    adminNote: null,
    altitudeHumidityAdjust: null,
    availabilityAdjust: null,
    availabilityInfo: null,
    awayStrengthAdjust: null,
    awayTeam: "",
    category: null,
    confidence: null,
    consensusCall: null,
    consensusD: null,
    consensusF: null,
    conditionsAdjust: null,
    conditionsInfo: null,
    createdAt,
    disagreementScore: null,
    exceptionCount: null,
    fixtureMasterId: null,
    groupStandingMotivationAdjust: null,
    homeAdvantageAdjust: null,
    homeStrengthAdjust: null,
    homeTeam: "",
    id: existing?.id ?? localId("match"),
    injuryNote: null,
    injurySuspensionAdjust: null,
    kickoffTime: null,
    leagueTableMotivationAdjust: null,
    marketProb0: null,
    marketProb1: null,
    marketProb2: null,
    matchNo,
    modelProb0: null,
    modelProb1: null,
    modelProb2: null,
    motivationAdjust: null,
    motivationNote: null,
    officialMatchNo: null,
    officialVote0: null,
    officialVote1: null,
    officialVote2: null,
    recentFormNote: null,
    recommendedOutcomes: null,
    restDaysAdjust: null,
    rotationRiskAdjust: null,
    roundId,
    squadDepthAdjust: null,
    stage: null,
    tacticalAdjust: null,
    tacticalNote: null,
    tournamentPressureAdjust: null,
    travelAdjust: null,
    travelClimateAdjust: null,
    updatedAt: nowIso(),
    venue: null,
  };
}

function buildRoundMatch(input: {
  existing?: Match | null;
  matchNo: number;
  roundId: string;
  row: ReturnType<typeof buildFeaturedWorldTotoImportPayloads>[number]["rows"][number];
}) {
  const seed = modelSeed({
    awayTeam: input.row.awayTeam,
    homeTeam: input.row.homeTeam,
    officialVote0: input.row.officialVote0,
    officialVote1: input.row.officialVote1,
    officialVote2: input.row.officialVote2,
  });
  const base = {
    ...emptyMatch(input.roundId, input.matchNo, input.existing),
    actualResult: input.row.actualResult,
    awayTeam: input.row.awayTeam,
    fixtureMasterId: input.row.fixtureMasterId,
    homeTeam: input.row.homeTeam,
    kickoffTime: input.row.kickoffTime,
    marketProb0: seed.marketProb0,
    marketProb1: seed.marketProb1,
    marketProb2: seed.marketProb2,
    officialMatchNo: input.row.officialMatchNo,
    officialVote0: input.row.officialVote0,
    officialVote1: input.row.officialVote1,
    officialVote2: input.row.officialVote2,
    stage: input.row.stage,
    venue: input.row.venue,
  } satisfies Match;
  const estimated = calculateModelProbabilities({
    ...base,
    competitionType: "world_cup",
    dataProfile: "manual_light",
  });

  return {
    ...base,
    adminNote: seed.modelRationale,
    modelProb0: estimated.modelProb0,
    modelProb1: estimated.modelProb1,
    modelProb2: estimated.modelProb2,
    tacticalNote: seed.modelSource === "official_vote" ? "AI source: official_vote" : "AI source: team_strength",
    recommendedOutcomes: recommendedOutcomes(estimated),
    updatedAt: nowIso(),
  } satisfies Match;
}

function liteReady(state: HaziLiteLocalState, haziUserId: string) {
  const rounds = featuredWorldTotoRoundNumbers
    .map((roundNumber) => findRoundByNumber(state, roundNumber))
    .filter((round): round is Round => Boolean(round));
  const roundIds = new Set(rounds.map((round) => round.id));
  const matchCount = state.matches.filter((match) => roundIds.has(match.roundId)).length;
  const haziPickCount = state.picks.filter(
    (pick) => roundIds.has(pick.roundId) && pick.userId === haziUserId,
  ).length;
  const candidateCount = state.candidateTickets.filter((ticket) => {
    const candidate = ticket as { roundId?: string };
    return candidate.roundId ? roundIds.has(candidate.roundId) : false;
  }).length;

  return (
    rounds.length === featuredWorldTotoRoundNumbers.length &&
    matchCount === 52 &&
    haziPickCount === 52 &&
    candidateCount === 0 &&
    rounds.every((round) => round.participantIds.length === 1 && round.participantIds[0] === haziUserId)
  );
}

export function readHaziLiteSummary(): HaziLiteSummary {
  const state = readState();
  const haziUser = state.users.find((user) => user.name.trim().toLowerCase() === "hazi") ?? null;
  const rounds = featuredWorldTotoRoundNumbers
    .map((roundNumber): HaziLiteRound | null => {
      const round = findRoundByNumber(state, roundNumber);
      if (!round) {
        return null;
      }

      const roundMatches = state.matches
        .filter((match) => match.roundId === round.id)
        .sort((left, right) => left.matchNo - right.matchNo);
      const roundPicks = state.picks.filter(
        (pick) => pick.roundId === round.id && pick.userId === haziUser?.id,
      );
      const picksByMatch = new Map(roundPicks.map((pick) => [pick.matchId, pick]));
      const valueLineByMatch = buildValueLineStrategies(roundMatches);
      const evAssumption =
        state.roundEvAssumptions.find((assumption) => assumption.roundId === round.id) ?? null;
      const portfolio = buildRoundPortfolio({
        evAssumption,
        haziPicksByMatch: picksByMatch,
        matches: roundMatches,
        valueLineByMatch,
      });
      const matches = roundMatches.map((match) => {
        const aiPick = topOutcome({
          modelProb0: match.modelProb0 ?? 0,
          modelProb1: match.modelProb1 ?? 0,
          modelProb2: match.modelProb2 ?? 0,
        });
        const haziPick = enumToOutcome(picksByMatch.get(match.id)?.pick);
        const orthodox = buildOrthodoxStrategy(match);
        const value = valueLineByMatch.get(match.id) ?? buildValueStrategy(match);

        return {
          aiPick,
          awayTeam: match.awayTeam,
          haziPick,
          homeTeam: match.homeTeam,
          kickoffTime: match.kickoffTime,
          matchId: match.id,
          matchNo: match.matchNo,
          modelProb0: match.modelProb0,
          modelProb1: match.modelProb1,
          modelProb2: match.modelProb2,
          modelRationale: match.adminNote ?? "軽量AI推定。",
          modelSource: match.tacticalNote?.includes("team_strength") ? "team_strength" : "official_vote",
          officialMatchNo: match.officialMatchNo,
          orthodox,
          reviewChange: haziPick !== aiPick,
          value,
        } satisfies HaziLiteMatch;
      });

      return {
        matchCount: roundMatches.length,
        matches,
        pickCount: roundPicks.length,
        portfolio,
        reviewChangeCount: matches.filter((match) => match.reviewChange).length,
        roundId: round.id,
        roundNumber,
        title: round.title,
      } satisfies HaziLiteRound;
    })
    .filter((round): round is HaziLiteRound => Boolean(round));

  return {
    aiVersion: typeof window === "undefined" ? haziLiteAiVersion : window.localStorage.getItem(localKeys.haziAiVersion) ?? "none",
    haziUserId: haziUser?.id ?? null,
    isLiteReady: haziUser ? liteReady(state, haziUser.id) : false,
    reviewChangeCount: rounds.reduce((sum, round) => sum + round.reviewChangeCount, 0),
    rounds,
    totalMatches: rounds.reduce((sum, round) => sum + round.matchCount, 0),
    totalPicks: rounds.reduce((sum, round) => sum + round.pickCount, 0),
  };
}

export function setupHaziLiteState(input: { force?: boolean } = {}) {
  if (typeof window === "undefined") {
    return readHaziLiteSummary();
  }

  const state = readState();
  const haziUser = ensureHaziUser(state);
  const currentVersion = window.localStorage.getItem(localKeys.haziAiVersion);
  if (!input.force && currentVersion === haziLiteAiVersion && liteReady(state, haziUser.id)) {
    return readHaziLiteSummary();
  }

  const payloads = buildFeaturedWorldTotoImportPayloads();
  const preparedRoundIds = new Set<string>();
  const now = nowIso();

  payloads.forEach((payload) => {
    const existingRound =
      payload.officialRoundNumber !== null
        ? findRoundByNumber(state, payload.officialRoundNumber)
        : null;
    const roundId = existingRound?.id ?? localId("round");
    preparedRoundIds.add(roundId);
    const round: Round = {
      activeMatchCount: payload.rows.length,
      budgetYen: null,
      competitionType: "world_cup",
      createdAt: existingRound?.createdAt ?? now,
      dataProfile: "manual_light",
      id: roundId,
      notes: `${payload.notes}\nHazi専用軽量ページで作成。`,
      outcomeSetJson: null,
      participantIds: [haziUser.id],
      primaryUse: "real_round_research",
      probabilityReadiness: "partial",
      productType: payload.productType as ProductType,
      requiredMatchCount: payload.requiredMatchCount,
      roundSource: "toto_official_manual",
      sourceNote: payload.sourceNote,
      sportContext: "national_team",
      status: "analyzing",
      title: payload.title,
      updatedAt: now,
      voidHandling: "manual",
    };
    const existingMatches = new Map(
      state.matches
        .filter((match) => match.roundId === roundId)
        .map((match) => [match.matchNo, match]),
    );
    const nextMatches = payload.rows.map((row, index) =>
      buildRoundMatch({
        existing: existingMatches.get(index + 1) ?? null,
        matchNo: index + 1,
        roundId,
        row,
      }),
    );
    const existingPicksByMatch = new Map(
      state.picks
        .filter((pick) => pick.roundId === roundId && pick.userId === haziUser.id)
        .map((pick) => [pick.matchId, pick]),
    );
    const nextPicks = nextMatches.map((match) => {
      const existingPick = existingPicksByMatch.get(match.id);
      if (existingPick && !input.force) {
        return existingPick;
      }

      return {
        createdAt: existingPick?.createdAt ?? now,
        id: existingPick?.id ?? localId("pick"),
        matchId: match.id,
        note: "Hazi軽量ページ: AI初期線から自動入力。必要なら1/0/2で上書き。",
        pick: outcomeToEnum(
          topOutcome({
            modelProb0: match.modelProb0 ?? 0,
            modelProb1: match.modelProb1 ?? 0,
            modelProb2: match.modelProb2 ?? 0,
          }),
        ),
        roundId,
        support: { kind: "manual" as const },
        updatedAt: now,
        userId: haziUser.id,
      };
    }) satisfies TotoPick[];
    const officialRound: TotoOfficialRound = {
      carryoverYen: payload.carryoverYen,
      createdAt:
        state.totoOfficialRounds.find((entry) => entry.roundId === roundId)?.createdAt ?? now,
      firstPrizeShare: payload.firstPrizeShare,
      id:
        state.totoOfficialRounds.find((entry) => entry.roundId === roundId)?.id ??
        localId("official-round"),
      officialRoundName: payload.officialRoundName,
      officialRoundNumber: payload.officialRoundNumber,
      payoutCapYen: payload.payoutCapYen,
      productType: payload.productType,
      resultStatus: payload.resultStatus as TotoOfficialResultStatus,
      returnRate: payload.returnRate,
      roundId,
      salesEndAt: payload.salesEndAt,
      salesStartAt: payload.salesStartAt,
      sourceText: payload.sourceText,
      sourceUrl: payload.sourceUrl,
      stakeYen: payload.stakeYen,
      totalSalesYen: payload.totalSalesYen,
      updatedAt: now,
    };
    const officialMatches = payload.rows.map((row) => ({
      actualResult: row.actualResult,
      awayTeam: row.awayTeam,
      createdAt: now,
      fixtureMasterId: row.fixtureMasterId,
      homeTeam: row.homeTeam,
      id: localId("official-match"),
      kickoffTime: row.kickoffTime,
      matchId: null,
      matchStatus: row.matchStatus,
      officialMatchNo: row.officialMatchNo,
      officialVote0: row.officialVote0,
      officialVote1: row.officialVote1,
      officialVote2: row.officialVote2,
      roundId,
      sourceText: row.sourceText,
      stage: row.stage,
      updatedAt: now,
      venue: row.venue,
    })) satisfies TotoOfficialMatch[];
    const evAssumption: RoundEvAssumption = {
      carryoverYen: payload.carryoverYen,
      createdAt:
        state.roundEvAssumptions.find((entry) => entry.roundId === roundId)?.createdAt ?? now,
      firstPrizeShare: payload.firstPrizeShare ?? 0.7,
      id: state.roundEvAssumptions.find((entry) => entry.roundId === roundId)?.id ?? localId("ev"),
      note: payload.officialRoundName,
      payoutCapYen: payload.payoutCapYen,
      returnRate: payload.returnRate,
      roundId,
      stakeYen: payload.stakeYen,
      totalSalesYen: payload.totalSalesYen,
      updatedAt: now,
    };

    state.rounds = state.rounds.filter((entry) => entry.id !== roundId).concat(round);
    state.matches = state.matches.filter((match) => match.roundId !== roundId).concat(nextMatches);
    state.picks = state.picks
      .filter((pick) => !(pick.roundId === roundId && pick.userId === haziUser.id))
      .concat(nextPicks);
    state.totoOfficialRounds = state.totoOfficialRounds
      .filter((entry) => entry.roundId !== roundId)
      .concat(officialRound);
    state.totoOfficialMatches = state.totoOfficialMatches
      .filter((match) => match.roundId !== roundId)
      .concat(officialMatches);
    state.roundEvAssumptions = state.roundEvAssumptions
      .filter((entry) => entry.roundId !== roundId)
      .concat(evAssumption);
  });

  state.candidateTickets = state.candidateTickets.filter((ticket) => {
    const candidate = ticket as { roundId?: string };
    return !candidate.roundId || !preparedRoundIds.has(candidate.roundId);
  });
  state.candidateVotes = state.candidateVotes.filter((vote) => {
    const candidate = vote as { roundId?: string };
    return !candidate.roundId || !preparedRoundIds.has(candidate.roundId);
  });
  state.generatedTickets = state.generatedTickets.filter((ticket) => {
    const candidate = ticket as { roundId?: string };
    return !candidate.roundId || !preparedRoundIds.has(candidate.roundId);
  });

  writeState(state);
  const firstRoundId = featuredWorldTotoRoundNumbers
    .map((roundNumber) => findRoundByNumber(state, roundNumber)?.id)
    .find((roundId): roundId is string => Boolean(roundId));
  if (firstRoundId) {
    window.localStorage.setItem(localKeys.currentRound, firstRoundId);
  }

  return readHaziLiteSummary();
}

export function updateHaziLitePick(input: {
  matchId: string;
  pick: OutcomeValue;
  roundId: string;
}) {
  const state = readState();
  const haziUser = ensureHaziUser(state);
  const now = nowIso();
  const existing = state.picks.find(
    (pick) => pick.roundId === input.roundId && pick.matchId === input.matchId && pick.userId === haziUser.id,
  );
  const nextPick: TotoPick = {
    createdAt: existing?.createdAt ?? now,
    id: existing?.id ?? localId("pick"),
    matchId: input.matchId,
    note: "Hazi軽量ページで手動調整。",
    pick: outcomeToEnum(input.pick),
    roundId: input.roundId,
    support: { kind: "manual" },
    updatedAt: now,
    userId: haziUser.id,
  };

  state.picks = state.picks
    .filter(
      (pick) =>
        !(pick.roundId === input.roundId && pick.matchId === input.matchId && pick.userId === haziUser.id),
    )
    .concat(nextPick);
  writeState(state);
  return readHaziLiteSummary();
}

export function applyHaziLiteAiPicks(input: { roundId?: string | null } = {}) {
  const state = readState();
  const haziUser = ensureHaziUser(state);
  const now = nowIso();
  const targetRounds = featuredWorldTotoRoundNumbers
    .map((roundNumber) => findRoundByNumber(state, roundNumber))
    .filter((round): round is Round => Boolean(round))
    .filter((round) => !input.roundId || round.id === input.roundId);
  const targetRoundIds = new Set(targetRounds.map((round) => round.id));
  const existingPickByMatch = new Map(
    state.picks
      .filter((pick) => targetRoundIds.has(pick.roundId) && pick.userId === haziUser.id)
      .map((pick) => [pick.matchId, pick]),
  );
  const nextPicks = state.matches
    .filter((match) => targetRoundIds.has(match.roundId))
    .map((match) => {
      const existing = existingPickByMatch.get(match.id);
      return {
        createdAt: existing?.createdAt ?? now,
        id: existing?.id ?? localId("pick"),
        matchId: match.id,
        note: "Hazi軽量ページ: AI修正案をレビュー後に反映。",
        pick: outcomeToEnum(
          topOutcome({
            modelProb0: match.modelProb0 ?? 0,
            modelProb1: match.modelProb1 ?? 0,
            modelProb2: match.modelProb2 ?? 0,
          }),
        ),
        roundId: match.roundId,
        support: { kind: "manual" as const },
        updatedAt: now,
        userId: haziUser.id,
      } satisfies TotoPick;
    });

  state.picks = state.picks
    .filter((pick) => !(targetRoundIds.has(pick.roundId) && pick.userId === haziUser.id))
    .concat(nextPicks);
  writeState(state);
  return readHaziLiteSummary();
}

export function applyHaziLiteStrategyPicks(input: {
  roundId?: string | null;
  strategy: HaziLiteStrategyKind;
}) {
  const state = readState();
  const haziUser = ensureHaziUser(state);
  const now = nowIso();
  const targetRounds = featuredWorldTotoRoundNumbers
    .map((roundNumber) => findRoundByNumber(state, roundNumber))
    .filter((round): round is Round => Boolean(round))
    .filter((round) => !input.roundId || round.id === input.roundId);
  const targetRoundIds = new Set(targetRounds.map((round) => round.id));
  const existingPickByMatch = new Map(
    state.picks
      .filter((pick) => targetRoundIds.has(pick.roundId) && pick.userId === haziUser.id)
      .map((pick) => [pick.matchId, pick]),
  );
  const strategyLabel = input.strategy === "orthodox" ? "王道" : "期待値";
  const nextPicks = targetRounds.flatMap((round) => {
    const roundMatches = state.matches
      .filter((match) => match.roundId === round.id)
      .sort((left, right) => left.matchNo - right.matchNo);
    const valueLineByMatch = input.strategy === "value" ? buildValueLineStrategies(roundMatches) : null;

    return roundMatches.map((match) => {
      const existing = existingPickByMatch.get(match.id);
      const strategyPick =
        input.strategy === "value"
          ? (valueLineByMatch?.get(match.id) ?? buildValueStrategy(match)).pick
          : buildOrthodoxStrategy(match).pick;

      return {
        createdAt: existing?.createdAt ?? now,
        id: existing?.id ?? localId("pick"),
        matchId: match.id,
        note: `Hazi軽量ページ: ${strategyLabel}ラインをレビュー後に反映。`,
        pick: outcomeToEnum(strategyPick),
        roundId: match.roundId,
        support: { kind: "manual" as const },
        updatedAt: now,
        userId: haziUser.id,
      } satisfies TotoPick;
    });
  });

  state.picks = state.picks
    .filter((pick) => !(targetRoundIds.has(pick.roundId) && pick.userId === haziUser.id))
    .concat(nextPicks);
  writeState(state);
  return readHaziLiteSummary();
}
