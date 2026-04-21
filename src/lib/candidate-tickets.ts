import {
  OUTCOME_VALUES,
  favoriteOutcome,
  favoriteOutcomeForBucket,
  getProbability,
  humanConsensusOutcomes,
  type OutcomeValue,
} from "@/lib/domain";
import { isDemoRoundTitle } from "@/lib/demo-data";
import { calculateProxyScore, calculateTicketEv } from "@/lib/ev";
import { pickSleepingValueOutcomes } from "@/lib/outcome-edge";
import type {
  CandidateStrategyType,
  CandidateTicket,
  Match,
  Pick,
  RoundEvAssumption,
  User,
} from "@/lib/types";

const MODEL_FLOOR = 0.12;
const MAX_CONTRARIAN_MATCHES = 4;
const MAX_DRAW_MATCHES = 4;
const MIN_MODEL_COMBO = 1e-8;
const EV_HUNTER_BEAM_WIDTH = 96;
const EV_HUNTER_POOL_SIZE = 72;
const CANDIDATE_PRIORITY_ORDER = [
  "王道モデル",
  "公式人気",
  "人力コンセンサス",
  "EVハンターA",
  "EVハンターB",
  "EVハンターC",
  "EVハンターD",
  "EVハンターE",
  "眠ってる期待値",
  "引き分け警報",
  "荒れ狙い",
] as const;

type OutcomeMetrics = {
  modelProbability: number | null;
  officialProbability: number | null;
  scoringProbability: number;
};

type PredictorSummary = {
  counts: Record<OutcomeValue, number>;
  majorityOutcome: OutcomeValue | null;
};

type HumanAlignmentSummary = {
  drawAlertHitCount: number;
  majorityMismatchCount: number;
  normalizedScore: number;
  rawPoints: number;
  ruleConflictCount: number;
};

type RoundDataQualityMetric = {
  filled: number;
  label: string;
  total: number;
};

export type RoundDataQualitySummary = {
  allModelProbabilitiesReady: boolean;
  allOfficialVotesReady: boolean;
  assumptionReady: boolean;
  humanPickUserCount: number;
  humanScoutUserCount: number;
  isDemoData: boolean;
  message: string;
  metrics: RoundDataQualityMetric[];
  modelProbabilitySumsValid: boolean;
  officialVoteSumsValid: boolean;
  strictEvReady: boolean;
};

export type CandidateTicketDraft = Omit<
  CandidateTicket,
  "createdAt" | "id" | "roundId" | "updatedAt"
>;

function isKnownNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function sum(values: Array<number | null | undefined>) {
  return values.reduce<number>(
    (total, value) => total + (isKnownNumber(value) ? value : 0),
    0,
  );
}

function hasCompleteTriplet(
  match: Match,
  bucket: "model" | "official",
) {
  return OUTCOME_VALUES.every((outcome) => isKnownNumber(getProbability(match, bucket, outcome)));
}

function normalizedTripletSumIsValid(match: Match, bucket: "model" | "official") {
  if (!hasCompleteTriplet(match, bucket)) {
    return false;
  }

  const bucketValues = OUTCOME_VALUES.map((outcome) => getProbability(match, bucket, outcome));
  const total = sum(bucketValues);
  return total >= 0.98 && total <= 1.02;
}

function fallbackOutcome(
  match: Match,
  preferredBuckets: Array<"model" | "market" | "official">,
) {
  for (const bucket of preferredBuckets) {
    const outcome = favoriteOutcomeForBucket(match, bucket);
    if (outcome) {
      return {
        outcome,
        source: bucket,
      };
    }
  }

  return {
    outcome: "1" as const,
    source: "fallback" as const,
  };
}

function getPredictorIds(users: User[]) {
  return new Set(users.filter((user) => user.role === "admin").map((user) => user.id));
}

function buildPredictorSummaries(matches: Match[], picks: Pick[], users: User[]) {
  const predictorIds = getPredictorIds(users);
  const summaries = new Map<string, PredictorSummary>();

  matches.forEach((match) => {
    const counts: Record<OutcomeValue, number> = {
      "1": 0,
      "0": 0,
      "2": 0,
    };

    picks.forEach((pick) => {
      if (pick.matchId !== match.id || !predictorIds.has(pick.userId) || pick.support.kind !== "manual") {
        return;
      }

      const outcome =
        pick.pick === "ONE" ? "1" : pick.pick === "DRAW" ? "0" : "2";
      counts[outcome] += 1;
    });

    summaries.set(match.id, {
      counts,
      majorityOutcome: favoriteOutcome(counts),
    });
  });

  return summaries;
}

function getOutcomeMetrics(match: Match, outcome: OutcomeValue): OutcomeMetrics {
  const modelProbability = getProbability(match, "model", outcome);
  const marketProbability = getProbability(match, "market", outcome);
  const officialProbability = getProbability(match, "official", outcome);

  return {
    modelProbability,
    officialProbability,
    scoringProbability: modelProbability ?? marketProbability ?? officialProbability ?? 0.05,
  };
}

function buildRoundDataQualityMessage(input: {
  allModelProbabilitiesReady: boolean;
  allOfficialVotesReady: boolean;
  assumptionReady: boolean;
  humanPickUserCount: number;
  isDemoData: boolean;
  modelProbabilitySumsValid: boolean;
  officialVoteSumsValid: boolean;
}) {
  if (input.isDemoData) {
    return "デモデータが混じるため、表示値は参考用です。";
  }

  if (!input.allModelProbabilitiesReady) {
    return "モデル確率が未入力の試合があるため、候補の一部は市場確率や公式人気で補完しています。";
  }

  if (!input.allOfficialVotesReady) {
    return "公式人気が未入力の試合があるため、EVはProxy表示です。";
  }

  if (!input.assumptionReady) {
    return "EV計算前提の売上想定が未入力のため、EVはProxy表示です。";
  }

  if (!input.modelProbabilitySumsValid) {
    return "モデル確率の合計が1から外れている試合があるため、推定値は要確認です。";
  }

  if (!input.officialVoteSumsValid) {
    return "公式人気の合計が1から外れている試合があるため、推定値は要確認です。";
  }

  if (input.humanPickUserCount === 0) {
    return "人力予想がまだ少ないため、人力コンセンサスは弱めです。";
  }

  return "主要データは揃っています。推定EVは参考値であり、的中や利益を保証するものではありません。";
}

export function buildRoundDataQualitySummary(input: {
  evAssumption: RoundEvAssumption | null;
  matches: Match[];
  picks: Pick[];
  roundTitle: string;
  scoutReports: Array<{ userId: string }>;
  users: User[];
}) {
  const predictorIds = getPredictorIds(input.users);
  const scheduleCount = input.matches.filter((match) => Boolean(match.kickoffTime)).length;
  const modelReadyCount = input.matches.filter((match) => hasCompleteTriplet(match, "model")).length;
  const officialReadyCount = input.matches.filter((match) => hasCompleteTriplet(match, "official")).length;
  const modelProbabilitySumsValid = input.matches.every((match) =>
    !hasCompleteTriplet(match, "model") || normalizedTripletSumIsValid(match, "model"),
  );
  const officialVoteSumsValid = input.matches.every((match) =>
    !hasCompleteTriplet(match, "official") || normalizedTripletSumIsValid(match, "official"),
  );
  const humanPickUserCount = new Set(
    input.picks
      .filter((pick) => predictorIds.has(pick.userId) && pick.support.kind === "manual")
      .map((pick) => pick.userId),
  ).size;
  const humanScoutUserCount = new Set(
    input.scoutReports.filter((report) => predictorIds.has(report.userId)).map((report) => report.userId),
  ).size;
  const isDemoData = isDemoRoundTitle(input.roundTitle);
  const assumptionReady = isKnownNumber(input.evAssumption?.totalSalesYen);
  const allModelProbabilitiesReady = modelReadyCount === input.matches.length;
  const allOfficialVotesReady = officialReadyCount === input.matches.length;

  return {
    allModelProbabilitiesReady,
    allOfficialVotesReady,
    assumptionReady,
    humanPickUserCount,
    humanScoutUserCount,
    isDemoData,
    message: buildRoundDataQualityMessage({
      allModelProbabilitiesReady,
      allOfficialVotesReady,
      assumptionReady,
      humanPickUserCount,
      isDemoData,
      modelProbabilitySumsValid,
      officialVoteSumsValid,
    }),
    metrics: [
      {
        filled: scheduleCount,
        label: "日程",
        total: input.matches.length,
      },
      {
        filled: modelReadyCount,
        label: "モデル確率",
        total: input.matches.length,
      },
      {
        filled: officialReadyCount,
        label: "公式人気",
        total: input.matches.length,
      },
      {
        filled: humanPickUserCount,
        label: "人力予想",
        total: Math.max(predictorIds.size, humanPickUserCount, 1),
      },
      {
        filled: assumptionReady ? 1 : 0,
        label: "EV計算前提",
        total: 1,
      },
    ],
    modelProbabilitySumsValid,
    officialVoteSumsValid,
    strictEvReady:
      !isDemoData &&
      assumptionReady &&
      allModelProbabilitiesReady &&
      allOfficialVotesReady &&
      modelProbabilitySumsValid &&
      officialVoteSumsValid,
  } satisfies RoundDataQualitySummary;
}

function humanConsensusPick(match: Match, majorityOutcome: OutcomeValue | null) {
  if ((match.consensusD ?? 0) >= 1.5 && Math.abs(match.consensusF ?? 0) <= 2) {
    return "0" as const;
  }

  if ((match.consensusF ?? 0) >= 3) {
    return "1" as const;
  }

  if ((match.consensusF ?? 0) <= -3) {
    return "2" as const;
  }

  if (majorityOutcome) {
    return majorityOutcome;
  }

  return fallbackOutcome(match, ["model", "market", "official"]).outcome;
}

function drawAlertPick(match: Match, majorityOutcome: OutcomeValue | null) {
  if ((match.consensusD ?? 0) >= 1.5 || humanConsensusOutcomes(match).includes("0")) {
    return "0" as const;
  }

  return humanConsensusPick(match, majorityOutcome);
}

function upsetPick(match: Match, majorityOutcome: OutcomeValue | null) {
  const officialFavorite = favoriteOutcomeForBucket(match, "official");
  const ranked = OUTCOME_VALUES.map((outcome) => {
    const metrics = getOutcomeMetrics(match, outcome);
    const humanBoost =
      humanConsensusOutcomes(match).includes(outcome) ? 0.2 : majorityOutcome === outcome ? 0.16 : 0;
    const officialProbability = metrics.officialProbability ?? 0.33;
    const edge =
      isKnownNumber(metrics.modelProbability) && isKnownNumber(metrics.officialProbability)
        ? metrics.modelProbability - metrics.officialProbability
        : 0;

    return {
      outcome,
      score: edge * 3 + (1 - officialProbability) * 0.8 + humanBoost,
    };
  })
    .filter((entry) => entry.outcome !== officialFavorite)
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.outcome ?? humanConsensusPick(match, majorityOutcome);
}

function buildHumanAlignmentSummary(input: {
  picks: Array<{ matchNo: number; pick: OutcomeValue }>;
  matches: Match[];
  predictorSummaries: Map<string, PredictorSummary>;
}) {
  const matchByNo = new Map(input.matches.map((match) => [match.matchNo, match]));
  let rawPoints = 0;
  let majorityMismatchCount = 0;
  let ruleConflictCount = 0;
  let drawAlertHitCount = 0;

  input.picks.forEach(({ matchNo, pick }) => {
    const match = matchByNo.get(matchNo);
    if (!match) {
      return;
    }

    const predictorSummary = input.predictorSummaries.get(match.id);

    if (humanConsensusOutcomes(match).includes(pick)) {
      rawPoints += 1;
    }

    if (predictorSummary?.majorityOutcome === pick) {
      rawPoints += 0.5;
    } else if (predictorSummary?.majorityOutcome) {
      majorityMismatchCount += 1;
    }

    if ((match.consensusD ?? 0) >= 1.5) {
      if (pick === "0") {
        rawPoints += 1;
        drawAlertHitCount += 1;
      } else {
        ruleConflictCount += 1;
      }
    }

    if ((match.consensusF ?? 0) >= 3) {
      if (pick === "1") {
        rawPoints += 1;
      } else {
        ruleConflictCount += 1;
      }
    }

    if ((match.consensusF ?? 0) <= -3) {
      if (pick === "2") {
        rawPoints += 1;
      } else {
        ruleConflictCount += 1;
      }
    }
  });

  return {
    drawAlertHitCount,
    majorityMismatchCount,
    normalizedScore: clamp(rawPoints / Math.max(input.matches.length * 2.5, 1), 0, 1),
    rawPoints,
    ruleConflictCount,
  } satisfies HumanAlignmentSummary;
}

export function summarizeCandidateHumanAlignment(input: {
  candidate: { picks: CandidateTicket["picks"] };
  matches: Match[];
  picks: Pick[];
  users: User[];
}) {
  return buildHumanAlignmentSummary({
    picks: input.candidate.picks,
    matches: input.matches,
    predictorSummaries: buildPredictorSummaries(input.matches, input.picks, input.users),
  });
}

function dataQualityForCandidate(input: {
  evAssumption: RoundEvAssumption | null;
  isDemoData: boolean;
  modelProbabilities: Array<number | null>;
  officialProbabilities: Array<number | null>;
}) {
  if (input.isDemoData) {
    return "demo_data" as const;
  }

  if (input.modelProbabilities.some((value) => !isKnownNumber(value))) {
    return "missing_model_prob" as const;
  }

  if (input.officialProbabilities.some((value) => !isKnownNumber(value))) {
    return "missing_official_vote" as const;
  }

  if (!isKnownNumber(input.evAssumption?.totalSalesYen)) {
    return "proxy_only" as const;
  }

  return "complete" as const;
}

function uniqueMessages(...values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (value ? value.split(" / ").map((part) => part.trim()) : []))
        .filter(Boolean),
    ),
  );
}

function buildCandidateTicket(input: {
  dataQualitySummary: RoundDataQualitySummary;
  evAssumption: RoundEvAssumption | null;
  label: string;
  matches: Match[];
  picks: Array<{ matchNo: number; pick: OutcomeValue }>;
  predictorSummaries: Map<string, PredictorSummary>;
  rationale: string;
  strategyType: CandidateStrategyType;
  warning?: string | null;
}) {
  const orderedPicks = [...input.picks].sort((left, right) => left.matchNo - right.matchNo);
  const matchByNo = new Map(input.matches.map((match) => [match.matchNo, match]));
  const selectedModelProbabilities: Array<number | null> = [];
  const selectedOfficialProbabilities: Array<number | null> = [];
  const selectedScoringProbabilities: number[] = [];
  let contrarianCount = 0;
  let drawCount = 0;
  let lowModelCount = 0;

  orderedPicks.forEach((entry) => {
    const match = matchByNo.get(entry.matchNo);
    if (!match) {
      return;
    }

    const metrics = getOutcomeMetrics(match, entry.pick);
    selectedModelProbabilities.push(metrics.modelProbability);
    selectedOfficialProbabilities.push(metrics.officialProbability);
    selectedScoringProbabilities.push(metrics.scoringProbability);

    if (entry.pick === "0") {
      drawCount += 1;
    }

    const officialFavorite = favoriteOutcomeForBucket(match, "official");
    if (officialFavorite && officialFavorite !== entry.pick) {
      contrarianCount += 1;
    }

    if (isKnownNumber(metrics.modelProbability) && metrics.modelProbability < MODEL_FLOOR) {
      lowModelCount += 1;
    }
  });

  const publicOverlapScore =
    selectedOfficialProbabilities.filter(isKnownNumber).length > 0
      ? sum(selectedOfficialProbabilities) /
        selectedOfficialProbabilities.filter(isKnownNumber).length
      : null;
  const humanAlignment = buildHumanAlignmentSummary({
    picks: orderedPicks,
    matches: input.matches,
    predictorSummaries: input.predictorSummaries,
  });
  const evBreakdown = calculateTicketEv({
    assumption: input.evAssumption,
    selectedModelProbabilities,
    selectedOfficialProbabilities,
  });
  const upsetPenalty =
    Math.max(0, contrarianCount - 2) * 0.7 +
    Math.max(0, drawCount - 2) * 0.45 +
    lowModelCount * 0.55;
  const proxyScore = calculateProxyScore({
    humanAlignmentScore: humanAlignment.normalizedScore,
    selectedOfficialProbabilities,
    selectedScoringProbabilities,
    selectedModelProbabilities,
    upsetPenalty,
  });
  const dataQuality = dataQualityForCandidate({
    evAssumption: input.evAssumption,
    isDemoData: input.dataQualitySummary.isDemoData,
    modelProbabilities: selectedModelProbabilities,
    officialProbabilities: selectedOfficialProbabilities,
  });
  const warnings = uniqueMessages(
    input.warning,
    dataQuality === "missing_model_prob" ? "モデル確率が一部未入力です" : null,
    dataQuality === "missing_official_vote" ? "公式人気が一部未入力です" : null,
    dataQuality === "proxy_only" ? "売上想定が未入力のためProxy表示です" : null,
    dataQuality === "demo_data" ? "デモデータを含むため参考表示です" : null,
    drawCount > MAX_DRAW_MATCHES ? "引き分けが多めです" : null,
    contrarianCount > MAX_CONTRARIAN_MATCHES ? "逆張りが多めです" : null,
    lowModelCount >= 5 ? "モデル確率の低い目が多めです" : null,
  );

  return {
    label: input.label,
    strategyType: input.strategyType,
    picks: orderedPicks,
    pModelCombo: evBreakdown.pModelCombo,
    pPublicCombo: evBreakdown.pPublicCombo,
    estimatedPayoutYen: evBreakdown.estimatedPayoutYen,
    grossEvYen: evBreakdown.grossEvYen,
    evMultiple: evBreakdown.evMultiple,
    evPercent: evBreakdown.evPercent,
    proxyScore,
    hitProbability: evBreakdown.pModelCombo,
    publicOverlapScore,
    contrarianCount,
    drawCount,
    humanAlignmentScore: humanAlignment.normalizedScore,
    dataQuality,
    rationale: input.rationale,
    warning: warnings.length > 0 ? warnings.join(" / ") : null,
  } satisfies CandidateTicketDraft;
}

function beamHeuristic(input: {
  majorityOutcome: OutcomeValue | null;
  match: Match;
  outcome: OutcomeValue;
}) {
  const metrics = getOutcomeMetrics(input.match, input.outcome);
  const officialProbability = metrics.officialProbability ?? 0.33;
  const edge =
    isKnownNumber(metrics.modelProbability) && isKnownNumber(metrics.officialProbability)
      ? metrics.modelProbability - metrics.officialProbability
      : 0;
  const humanBoost =
    humanConsensusOutcomes(input.match).includes(input.outcome)
      ? 0.28
      : input.majorityOutcome === input.outcome
        ? 0.18
        : 0;
  const drawBoost =
    input.outcome === "0" && (input.match.consensusD ?? 0) >= 1.5 ? 0.2 : 0;
  const lowModelPenalty =
    isKnownNumber(metrics.modelProbability) && metrics.modelProbability < MODEL_FLOOR ? 0.55 : 0;

  return (
    Math.log(Math.max(metrics.scoringProbability, 0.01)) +
    edge * 3.4 +
    (1 - officialProbability) * 0.9 +
    humanBoost +
    drawBoost -
    lowModelPenalty
  );
}

function hammingDistance(left: Array<{ pick: OutcomeValue }>, right: Array<{ pick: OutcomeValue }>) {
  return left.reduce((distance, entry, index) => {
    return distance + (entry.pick === right[index]?.pick ? 0 : 1);
  }, 0);
}

function primaryCandidateValue(ticket: CandidateTicketDraft) {
  return ticket.evMultiple ?? ticket.proxyScore ?? Number.NEGATIVE_INFINITY;
}

function sortCandidatesByProfile(tickets: CandidateTicketDraft[], profile: "base" | "hit" | "fade" | "human") {
  const ranked = [...tickets];

  ranked.sort((left, right) => {
    const leftBase = primaryCandidateValue(left);
    const rightBase = primaryCandidateValue(right);

    if (profile === "hit") {
      const leftScore = leftBase + (left.hitProbability ?? 0) * 1500000;
      const rightScore = rightBase + (right.hitProbability ?? 0) * 1500000;
      return rightScore - leftScore;
    }

    if (profile === "fade") {
      const leftScore = leftBase - (left.publicOverlapScore ?? 0.5) * 15;
      const rightScore = rightBase - (right.publicOverlapScore ?? 0.5) * 15;
      return rightScore - leftScore;
    }

    if (profile === "human") {
      const leftScore = leftBase + (left.humanAlignmentScore ?? 0) * 12;
      const rightScore = rightBase + (right.humanAlignmentScore ?? 0) * 12;
      return rightScore - leftScore;
    }

    return rightBase - leftBase;
  });

  return ranked;
}

function selectDiverseTicket(
  candidates: CandidateTicketDraft[],
  selected: CandidateTicketDraft[],
) {
  return candidates.find((candidate) => {
    return !selected.some((current) => hammingDistance(candidate.picks, current.picks) < 2);
  });
}

function buildEvHunterCandidates(input: {
  dataQualitySummary: RoundDataQualitySummary;
  evAssumption: RoundEvAssumption | null;
  matches: Match[];
  predictorSummaries: Map<string, PredictorSummary>;
}) {
  type BeamState = {
    contrarianCount: number;
    heuristic: number;
    lowModelCount: number;
    picks: Array<{ matchNo: number; pick: OutcomeValue }>;
  };

  let beam: BeamState[] = [
    {
      contrarianCount: 0,
      heuristic: 0,
      lowModelCount: 0,
      picks: [],
    },
  ];

  for (const match of input.matches) {
    const majorityOutcome = input.predictorSummaries.get(match.id)?.majorityOutcome ?? null;
    const outcomeCandidates = OUTCOME_VALUES.map((outcome) => {
      const metrics = getOutcomeMetrics(match, outcome);
      const officialFavorite = favoriteOutcomeForBucket(match, "official");
      return {
        lowModel:
          isKnownNumber(metrics.modelProbability) && metrics.modelProbability < MODEL_FLOOR ? 1 : 0,
        outcome,
        officialFavorite,
        score: beamHeuristic({
          majorityOutcome,
          match,
          outcome,
        }),
      };
    }).sort((left, right) => right.score - left.score);

    const expanded: BeamState[] = [];

    for (const state of beam) {
      for (const candidate of outcomeCandidates.slice(0, 3)) {
        const nextContrarianCount =
          state.contrarianCount +
          (candidate.officialFavorite && candidate.officialFavorite !== candidate.outcome ? 1 : 0);
        const nextLowModelCount = state.lowModelCount + candidate.lowModel;

        if (nextContrarianCount > MAX_CONTRARIAN_MATCHES + 2 || nextLowModelCount > 6) {
          continue;
        }

        expanded.push({
          contrarianCount: nextContrarianCount,
          heuristic: state.heuristic + candidate.score,
          lowModelCount: nextLowModelCount,
          picks: [...state.picks, { matchNo: match.matchNo, pick: candidate.outcome }],
        });
      }
    }

    beam = expanded
      .sort((left, right) => right.heuristic - left.heuristic)
      .slice(0, EV_HUNTER_BEAM_WIDTH);
  }

  const pool = beam
    .map((state) =>
      buildCandidateTicket({
        dataQualitySummary: input.dataQualitySummary,
        evAssumption: input.evAssumption,
        label: "EVハンター候補",
        matches: input.matches,
        picks: state.picks,
        predictorSummaries: input.predictorSummaries,
        rationale:
          "公式人気と被りにくさ、モデル確率、人力一致を見ながら候補を絞ったEV狙いです。",
        strategyType: "ev_hunter",
      }),
    )
    .filter((ticket) => {
      if (ticket.drawCount > MAX_DRAW_MATCHES || ticket.contrarianCount > MAX_CONTRARIAN_MATCHES) {
        return false;
      }

      if ((ticket.pModelCombo ?? 0) > 0 && (ticket.pModelCombo ?? 0) < MIN_MODEL_COMBO) {
        return false;
      }

      const lowModelCount = ticket.picks.reduce((count, pick) => {
        const match = input.matches.find((candidate) => candidate.matchNo === pick.matchNo);
        const metrics = match ? getOutcomeMetrics(match, pick.pick) : null;
        return count + (metrics && isKnownNumber(metrics.modelProbability) && metrics.modelProbability < MODEL_FLOOR ? 1 : 0);
      }, 0);

      if (lowModelCount >= 5) {
        return false;
      }

      if (input.dataQualitySummary.strictEvReady) {
        return (ticket.evMultiple ?? 0) >= 2;
      }

      return true;
    })
    .sort((left, right) => primaryCandidateValue(right) - primaryCandidateValue(left))
    .slice(0, EV_HUNTER_POOL_SIZE);

  if (pool.length === 0) {
    return [];
  }

  const selected: CandidateTicketDraft[] = [];
  const pushSelected = (ticket: CandidateTicketDraft | undefined, label: string) => {
    if (!ticket) {
      return;
    }

    selected.push({
      ...ticket,
      label,
    });
  };

  pushSelected(selectDiverseTicket(sortCandidatesByProfile(pool, "base"), selected), "EVハンターA");
  pushSelected(selectDiverseTicket(sortCandidatesByProfile(pool, "base"), selected), "EVハンターB");
  pushSelected(selectDiverseTicket(sortCandidatesByProfile(pool, "hit"), selected), "EVハンターC");
  pushSelected(selectDiverseTicket(sortCandidatesByProfile(pool, "fade"), selected), "EVハンターD");
  pushSelected(selectDiverseTicket(sortCandidatesByProfile(pool, "human"), selected), "EVハンターE");

  return selected;
}

function priorityIndex(label: string) {
  const index = CANDIDATE_PRIORITY_ORDER.indexOf(label as (typeof CANDIDATE_PRIORITY_ORDER)[number]);
  return index >= 0 ? index : CANDIDATE_PRIORITY_ORDER.length + 1;
}

export function sortCandidateTickets(tickets: CandidateTicket[]) {
  return [...tickets].sort((left, right) => {
    const leftIndex = priorityIndex(left.label);
    const rightIndex = priorityIndex(right.label);

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return left.label.localeCompare(right.label, "ja");
  });
}

export function generateCandidateTickets(input: {
  evAssumption: RoundEvAssumption | null;
  matches: Match[];
  picks: Pick[];
  roundTitle: string;
  scoutReports: Array<{ userId: string }>;
  users: User[];
}) {
  const predictorSummaries = buildPredictorSummaries(input.matches, input.picks, input.users);
  const dataQualitySummary = buildRoundDataQualitySummary(input);
  const sleepingValueOverrides = pickSleepingValueOutcomes(input.matches, 3);
  const sleepingValueOverrideByMatchNo = new Map(
    sleepingValueOverrides.map((entry) => [entry.matchNo, entry]),
  );
  const staticCandidates: CandidateTicketDraft[] = input.matches.length === 0
    ? []
    : [
        buildCandidateTicket({
          dataQualitySummary,
          evAssumption: input.evAssumption,
          label: "王道モデル",
          matches: input.matches,
          picks: input.matches.map((match) => {
            const selected = fallbackOutcome(match, ["model", "market", "official"]);
            return {
              matchNo: match.matchNo,
              pick: selected.outcome,
            };
          }),
          predictorSummaries,
          rationale: "各試合でモデル確率が最も高い目を優先した、いちばん素直な王道候補です。",
          strategyType: "orthodox_model",
          warning: input.matches.some((match) => favoriteOutcomeForBucket(match, "model") === null)
            ? "モデル確率がない試合は市場確率や公式人気で補完しています"
            : null,
        }),
        buildCandidateTicket({
          dataQualitySummary,
          evAssumption: input.evAssumption,
          label: "公式人気",
          matches: input.matches,
          picks: input.matches.map((match) => ({
            matchNo: match.matchNo,
            pick: fallbackOutcome(match, ["official", "market", "model"]).outcome,
          })),
          predictorSummaries,
          rationale: "公式人気の並びをそのまま採用した比較用の候補です。",
          strategyType: "public_favorite",
          warning: input.matches.some((match) => favoriteOutcomeForBucket(match, "official") === null)
            ? "公式人気がない試合は市場確率やモデル確率で補完しています"
            : null,
        }),
        buildCandidateTicket({
          dataQualitySummary,
          evAssumption: input.evAssumption,
          label: "人力コンセンサス",
          matches: input.matches,
          picks: input.matches.map((match) => ({
            matchNo: match.matchNo,
            pick: humanConsensusPick(match, predictorSummaries.get(match.id)?.majorityOutcome ?? null),
          })),
          predictorSummaries,
          rationale: "Human Scout Card の F/D と、予想者の多数派を素直にまとめた人力推し候補です。",
          strategyType: "human_consensus",
        }),
        buildCandidateTicket({
          dataQualitySummary,
          evAssumption: input.evAssumption,
          label: "眠ってる期待値",
          matches: input.matches,
          picks: input.matches.map((match) => {
            const override = sleepingValueOverrideByMatchNo.get(match.matchNo);
            if (override) {
              return {
                matchNo: match.matchNo,
                pick: override.pick,
              };
            }

            return {
              matchNo: match.matchNo,
              pick: fallbackOutcome(match, ["model", "market", "official"]).outcome,
            };
          }),
          predictorSummaries,
          rationale:
            "王道ベースから、公式人気とのズレが大きい outcome を数試合だけ織り込んだ候補です。",
          strategyType: "sleeping_value",
          warning:
            sleepingValueOverrides.length === 0
              ? "今回は強いエッジ候補が少ないため、王道寄りの並びです"
              : null,
        }),
        buildCandidateTicket({
          dataQualitySummary,
          evAssumption: input.evAssumption,
          label: "引き分け警報",
          matches: input.matches,
          picks: input.matches.map((match) => ({
            matchNo: match.matchNo,
            pick: drawAlertPick(match, predictorSummaries.get(match.id)?.majorityOutcome ?? null),
          })),
          predictorSummaries,
          rationale: "引き分け警報が強い試合で 0 を厚めに拾った、要確認寄りの候補です。",
          strategyType: "draw_alert",
          warning: input.matches.filter((match) => (match.consensusD ?? 0) >= 1.5).length === 0
            ? "強い引き分け警報はまだ少なめです"
            : null,
        }),
        buildCandidateTicket({
          dataQualitySummary,
          evAssumption: input.evAssumption,
          label: "荒れ狙い",
          matches: input.matches,
          picks: input.matches.map((match) => ({
            matchNo: match.matchNo,
            pick: upsetPick(match, predictorSummaries.get(match.id)?.majorityOutcome ?? null),
          })),
          predictorSummaries,
          rationale: "公式人気と逆の目を少し多めに含めた、ネタ枠込みの荒れ狙い候補です。",
          strategyType: "upset",
          warning: "荒れ狙いとして表示しています。参考値として見てください。",
        }),
      ];
  const evHunters = buildEvHunterCandidates({
    dataQualitySummary,
    evAssumption: input.evAssumption,
    matches: input.matches,
    predictorSummaries,
  });

  return {
    dataQualitySummary,
    hasEv200Candidate: evHunters.some((ticket) => (ticket.evMultiple ?? 0) >= 2),
    tickets: [...staticCandidates.slice(0, 4), ...evHunters, ...staticCandidates.slice(4)].sort(
      (left, right) => priorityIndex(left.label) - priorityIndex(right.label),
    ),
  };
}

function latestIsoValue(values: Array<string | null | undefined>) {
  return values.filter(Boolean).sort().at(-1) ?? null;
}

export function isCandidateTicketSetStale(input: {
  candidateTickets: Array<{ updatedAt: CandidateTicket["updatedAt"] }>;
  evAssumption: RoundEvAssumption | null;
  matches: Match[];
  picks: Pick[];
  scoutReports: Array<{ updatedAt: string }>;
}) {
  if (input.candidateTickets.length === 0) {
    return true;
  }

  const latestSourceUpdate = latestIsoValue([
    ...input.matches.map((match) => match.updatedAt),
    ...input.picks.map((pick) => pick.updatedAt),
    ...input.scoutReports.map((report) => report.updatedAt),
    input.evAssumption?.updatedAt,
  ]);
  const latestCandidateUpdate = latestIsoValue(input.candidateTickets.map((ticket) => ticket.updatedAt));

  if (!latestSourceUpdate || !latestCandidateUpdate) {
    return input.candidateTickets.length === 0;
  }

  return latestCandidateUpdate < latestSourceUpdate;
}
