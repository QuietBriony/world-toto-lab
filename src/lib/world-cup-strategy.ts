import {
  OUTCOME_VALUES,
  favoriteOutcomeForBucket,
  formatDateTime,
  getProbability,
  type MatchLike,
  type OutcomeValue,
} from "@/lib/domain";
import { calculateEstimatedPayout, calculateTicketEv } from "@/lib/ev";
import {
  featuredWorldTotoVoteUrl,
  featuredWorldTotoRounds,
  featuredWorldTotoRoundNumbers,
  featuredWorldTotoSnapshotLabel,
} from "@/lib/featured-world-toto";
import { calculateModelProbabilities } from "@/lib/probability/engine";
import type { DashboardRoundSummary, Match, RoundEvAssumption, TotoOfficialRoundLibraryMatch } from "@/lib/types";
import { modelSeed } from "@/lib/world-toto-strength";

const featuredSnapshotCapturedAt = "2026-06-07T08:56:00+09:00";
const valueLineSpotCount = 4;
const defaultStakeYen = 100;

type FeaturedRound = (typeof featuredWorldTotoRounds)[number];

type ProbabilityBucket = "model" | "official";

export type WorldCupRoundWindowStatus = "closed" | "selling" | "upcoming";

export type WorldCupStrategyPick = {
  matchNo: number;
  pick: OutcomeValue;
};

export type WorldCupStrategyLineKey = "ai" | "orthodox" | "value";

export type WorldCupStrategyLine = {
  deviationCount: number;
  estimatedPayoutYen: number | null;
  evMultiple: number | null;
  expectedReturnYen: number | null;
  hitProbability: number | null;
  key: WorldCupStrategyLineKey;
  label: string;
  picks: WorldCupStrategyPick[];
  publicProbability: number | null;
  strictEvReady: boolean;
};

export type WorldCupPositiveEvCombo = {
  deviationCount: number;
  estimatedPayoutYen: number;
  evMultiple: number;
  expectedReturnYen: number;
  hitProbability: number;
  picks: WorldCupStrategyPick[];
  publicProbability: number;
  signature: string;
};

export type WorldCupPositiveEvResult = {
  evaluatedCount: number | null;
  ready: boolean;
  rows: WorldCupPositiveEvCombo[];
  totalPositiveCount: number | null;
  truncated: boolean;
};

export type WorldCupPortfolioPlan = {
  budgetYen: number;
  costYen: number;
  description: string;
  evMultiple: number;
  expectedProfitYen: number;
  expectedReturnYen: number;
  hitProbabilityUpperBound: number;
  label: string;
  lineCount: number;
  maxPayoutIfHitYen: number;
  meetsBudget: boolean;
  minPayoutIfHitYen: number;
  requestedLineCount: number;
  rows: WorldCupPositiveEvCombo[];
  stakeYen: number;
  unallocatedBudgetYen: number;
};

export type WorldCupVoteDriftRow = {
  favoriteChanged: boolean;
  finalFavorite: OutcomeValue;
  finalShare: number;
  fixture: string;
  initialFavorite: OutcomeValue;
  initialShare: number;
  matchNo: number;
  maxDeltaOutcome: OutcomeValue;
  maxDeltaPt: number;
};

export type WorldCupFinalSnapshotSummary = {
  favoriteChangeCount: number;
  maxAbsVoteShareDeltaPt: number;
  salesDeltaYen: number | null;
  salesMultiple: number | null;
  sourceAsOfLabel: string;
  sourceUrl: string;
  totalSalesYen: number;
  voteDriftRows: WorldCupVoteDriftRow[];
};

export type WorldCupRoundStrategy = {
  calculationSourceLabel: string;
  candidateTicketCount: number;
  driftDetail: string;
  driftLabel: string;
  evAssumption: RoundEvAssumption | null;
  featured: {
    roundNumber: number;
    salesEndAt: string;
    salesStartAt: string;
    sourceUrl: string;
    title: string;
    totalSalesYen: number | null;
  };
  finalSnapshot: WorldCupFinalSnapshotSummary | null;
  isCreated: boolean;
  lastBuyableAtLabel: string;
  lines: WorldCupStrategyLine[];
  matchCount: number;
  modelReadyCount: number;
  officialReadyCount: number;
  orthodoxLine: WorldCupStrategyLine | null;
  portfolioPlans: WorldCupPortfolioPlan[];
  positiveEv: WorldCupPositiveEvResult;
  primaryPortfolioPlan: WorldCupPortfolioPlan | null;
  roundId: string | null;
  roundTitle: string;
  snapshotGapToCloseLabel: string;
  snapshotLabel: string;
  stakeYen: number;
  strictEvMissingReasons: string[];
  strictEvReady: boolean;
  usingFeaturedFallback: boolean;
  windowStatus: WorldCupRoundWindowStatus;
  windowStatusLabel: string;
};

export type WorldCupStrategyDashboard = {
  buyableCount: number;
  closedCount: number;
  createdCount: number;
  positiveEvComboCount: number | null;
  rounds: WorldCupRoundStrategy[];
  snapshotLabel: string;
  strictReadyCount: number;
};

type KnownFinalSnapshot = {
  sourceAsOfLabel: string;
  sourceUrl: string;
  totalSalesYen: number;
  voteRows: Array<{
    matchNo: number;
    officialVote0: number;
    officialVote1: number;
    officialVote2: number;
  }>;
};

const knownFinalSnapshotsByRound = new Map<number, KnownFinalSnapshot>([
  [
    1634,
    {
      sourceAsOfLabel: "2026年06月12日販売終了時点",
      sourceUrl: featuredWorldTotoVoteUrl,
      totalSalesYen: 289166800,
      voteRows: [
        { matchNo: 1, officialVote1: 0.0512, officialVote0: 0.1062, officialVote2: 0.8426 },
        { matchNo: 2, officialVote1: 0.557, officialVote0: 0.2589, officialVote2: 0.1841 },
        { matchNo: 3, officialVote1: 0.9526, officialVote0: 0.0296, officialVote2: 0.0178 },
        { matchNo: 4, officialVote1: 0.3679, officialVote0: 0.3095, officialVote2: 0.3226 },
        { matchNo: 5, officialVote1: 0.7275, officialVote0: 0.1731, officialVote2: 0.0994 },
        { matchNo: 6, officialVote1: 0.505, officialVote0: 0.3012, officialVote2: 0.1938 },
        { matchNo: 7, officialVote1: 0.2711, officialVote0: 0.3158, officialVote2: 0.4131 },
        { matchNo: 8, officialVote1: 0.94, officialVote0: 0.0406, officialVote2: 0.0194 },
        { matchNo: 9, officialVote1: 0.0782, officialVote0: 0.1557, officialVote2: 0.7661 },
        { matchNo: 10, officialVote1: 0.5296, officialVote0: 0.2895, officialVote2: 0.1809 },
        { matchNo: 11, officialVote1: 0.0712, officialVote0: 0.113, officialVote2: 0.8158 },
        { matchNo: 12, officialVote1: 0.1962, officialVote0: 0.2893, officialVote2: 0.5145 },
        { matchNo: 13, officialVote1: 0.5591, officialVote0: 0.262, officialVote2: 0.1789 },
      ],
    },
  ],
]);

export const worldCupPortfolioBudgets = [
  {
    budgetYen: 100,
    description: "まず1口だけ。期待回収が最も高い出目を見る。",
    label: "1口",
  },
  {
    budgetYen: 1000,
    description: "10口分。買うなら上から10通りを1口ずつ。",
    label: "10口",
  },
  {
    budgetYen: 10000,
    description: "1万円分。100通りまで、期待回収の高い順に1口ずつ。",
    label: "1万円",
  },
] as const;

function isKnownNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function minutesBetween(left: Date, right: Date) {
  return Math.round((right.getTime() - left.getTime()) / 60000);
}

function formatDuration(minutes: number | null) {
  if (minutes === null) {
    return "未計算";
  }

  const absMinutes = Math.abs(minutes);
  const days = Math.floor(absMinutes / 1440);
  const hours = Math.floor((absMinutes % 1440) / 60);
  const mins = absMinutes % 60;
  const parts = [
    days > 0 ? `${days}日` : null,
    hours > 0 ? `${hours}時間` : null,
    days === 0 && mins > 0 ? `${mins}分` : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join("") : "0分";
}

function resolveWindowStatus(input: {
  now: Date;
  salesEndAt: string;
  salesStartAt: string;
}): WorldCupRoundWindowStatus {
  const startedAt = new Date(input.salesStartAt);
  const endedAt = new Date(input.salesEndAt);

  if (input.now.getTime() < startedAt.getTime()) {
    return "upcoming";
  }

  return input.now.getTime() <= endedAt.getTime() ? "selling" : "closed";
}

function windowStatusLabel(status: WorldCupRoundWindowStatus) {
  if (status === "selling") {
    return "販売中";
  }

  if (status === "upcoming") {
    return "発売前";
  }

  return "販売終了";
}

function hasCompleteBucket(match: MatchLike, bucket: ProbabilityBucket) {
  return OUTCOME_VALUES.every((outcome) => isKnownNumber(getProbability(match, bucket, outcome)));
}

function outcomeShare(
  row: Pick<KnownFinalSnapshot["voteRows"][number], "officialVote0" | "officialVote1" | "officialVote2">,
  outcome: OutcomeValue,
) {
  if (outcome === "1") {
    return row.officialVote1;
  }

  if (outcome === "0") {
    return row.officialVote0;
  }

  return row.officialVote2;
}

function finalFavorite(row: KnownFinalSnapshot["voteRows"][number]) {
  return OUTCOME_VALUES.map((outcome) => ({
    outcome,
    value: outcomeShare(row, outcome),
  })).sort((left, right) => right.value - left.value)[0].outcome;
}

function buildFinalSnapshotSummary(featured: FeaturedRound): WorldCupFinalSnapshotSummary | null {
  const finalSnapshot = knownFinalSnapshotsByRound.get(featured.roundNumber);

  if (!finalSnapshot) {
    return null;
  }

  const initialByMatchNo = new Map(featured.matches.map((match) => [match.officialMatchNo, match]));
  const voteDriftRows = finalSnapshot.voteRows.map((row) => {
    const initialMatch = initialByMatchNo.get(row.matchNo);
    const finalFav = finalFavorite(row);
    const initialFav =
      initialMatch && initialMatch.officialVote1 !== null
        ? favoriteOutcomeForBucket(
            {
              actualResult: null,
              awayTeam: initialMatch.awayTeam,
              category: null,
              confidence: null,
              consensusCall: null,
              consensusD: null,
              consensusF: null,
              disagreementScore: null,
              exceptionCount: null,
              homeTeam: initialMatch.homeTeam,
              marketProb0: null,
              marketProb1: null,
              marketProb2: null,
              matchNo: row.matchNo,
              modelProb0: null,
              modelProb1: null,
              modelProb2: null,
              officialVote0: initialMatch.officialVote0,
              officialVote1: initialMatch.officialVote1,
              officialVote2: initialMatch.officialVote2,
              recommendedOutcomes: null,
            },
            "official",
          ) ?? finalFav
        : finalFav;
    const drift = OUTCOME_VALUES.map((outcome) => {
      const initialShare =
        outcome === "1"
          ? initialMatch?.officialVote1 ?? null
          : outcome === "0"
            ? initialMatch?.officialVote0 ?? null
            : initialMatch?.officialVote2 ?? null;
      const nextFinalShare = outcomeShare(row, outcome);

      return {
        finalShare: nextFinalShare,
        initialShare: initialShare ?? 0,
        outcome,
        deltaPt: (nextFinalShare - (initialShare ?? 0)) * 100,
      };
    }).sort((left, right) => Math.abs(right.deltaPt) - Math.abs(left.deltaPt))[0];

    return {
      favoriteChanged: initialFav !== finalFav,
      finalFavorite: finalFav,
      finalShare: drift.finalShare,
      fixture: initialMatch ? `${initialMatch.homeTeam} - ${initialMatch.awayTeam}` : `No.${row.matchNo}`,
      initialFavorite: initialFav,
      initialShare: drift.initialShare,
      matchNo: row.matchNo,
      maxDeltaOutcome: drift.outcome,
      maxDeltaPt: drift.deltaPt,
    };
  });
  const maxAbsVoteShareDeltaPt = voteDriftRows.reduce(
    (max, row) => Math.max(max, Math.abs(row.maxDeltaPt)),
    0,
  );

  return {
    favoriteChangeCount: voteDriftRows.filter((row) => row.favoriteChanged).length,
    maxAbsVoteShareDeltaPt,
    salesDeltaYen: isKnownNumber(featured.totalSalesYen)
      ? finalSnapshot.totalSalesYen - featured.totalSalesYen
      : null,
    salesMultiple:
      isKnownNumber(featured.totalSalesYen) && featured.totalSalesYen > 0
        ? finalSnapshot.totalSalesYen / featured.totalSalesYen
        : null,
    sourceAsOfLabel: finalSnapshot.sourceAsOfLabel,
    sourceUrl: finalSnapshot.sourceUrl,
    totalSalesYen: finalSnapshot.totalSalesYen,
    voteDriftRows,
  };
}

function recommendedOutcomesFrom(modelProb1: number, modelProb0: number, modelProb2: number) {
  return [modelProb1, modelProb0, modelProb2]
    .map((value, index) => ({ index, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 2)
    .map((entry) => (entry.index === 0 ? "1" : entry.index === 1 ? "0" : "2"))
    .join(",");
}

function buildBaseMatch(roundId: string, row: TotoOfficialRoundLibraryMatch, index: number): Match {
  return {
    actualResult: row.actualResult,
    adminAdjust0: null,
    adminAdjust1: null,
    adminAdjust2: null,
    adminNote: null,
    altitudeHumidityAdjust: null,
    availabilityAdjust: null,
    availabilityInfo: null,
    awayStrengthAdjust: null,
    awayTeam: row.awayTeam,
    category: null,
    conditionsAdjust: null,
    conditionsInfo: null,
    confidence: null,
    consensusCall: null,
    consensusD: null,
    consensusF: null,
    createdAt: featuredSnapshotCapturedAt,
    disagreementScore: null,
    exceptionCount: null,
    fixtureMasterId: row.fixtureMasterId,
    groupStandingMotivationAdjust: null,
    homeAdvantageAdjust: null,
    homeStrengthAdjust: null,
    homeTeam: row.homeTeam,
    id: `${roundId}-match-${row.officialMatchNo ?? index + 1}`,
    injuryNote: null,
    injurySuspensionAdjust: null,
    kickoffTime: row.kickoffTime,
    leagueTableMotivationAdjust: null,
    marketProb0: null,
    marketProb1: null,
    marketProb2: null,
    matchNo: index + 1,
    modelProb0: null,
    modelProb1: null,
    modelProb2: null,
    motivationAdjust: null,
    motivationNote: null,
    officialMatchNo: row.officialMatchNo,
    officialVote0: row.officialVote0,
    officialVote1: row.officialVote1,
    officialVote2: row.officialVote2,
    recentFormNote: null,
    recommendedOutcomes: null,
    restDaysAdjust: null,
    rotationRiskAdjust: null,
    roundId,
    squadDepthAdjust: null,
    stage: row.stage,
    tacticalAdjust: null,
    tacticalNote: null,
    tournamentPressureAdjust: null,
    travelAdjust: null,
    travelClimateAdjust: null,
    updatedAt: featuredSnapshotCapturedAt,
    venue: row.venue,
  };
}

function buildModeledFeaturedMatches(featured: FeaturedRound): Match[] {
  const roundId = `featured-world-toto-${featured.roundNumber}`;

  return featured.matches.map((row, index) => {
    const base = buildBaseMatch(roundId, row, index);
    const seed = modelSeed({
      awayTeam: base.awayTeam,
      homeTeam: base.homeTeam,
      officialVote0: base.officialVote0,
      officialVote1: base.officialVote1,
      officialVote2: base.officialVote2,
    });
    const estimated = calculateModelProbabilities({
      ...base,
      marketProb0: seed.marketProb0,
      marketProb1: seed.marketProb1,
      marketProb2: seed.marketProb2,
      competitionType: "world_cup",
      dataProfile: "manual_light",
    });

    return {
      ...base,
      marketProb0: seed.marketProb0,
      marketProb1: seed.marketProb1,
      marketProb2: seed.marketProb2,
      modelProb0: estimated.modelProb0,
      modelProb1: estimated.modelProb1,
      modelProb2: estimated.modelProb2,
      recommendedOutcomes: recommendedOutcomesFrom(
        estimated.modelProb1,
        estimated.modelProb0,
        estimated.modelProb2,
      ),
    };
  });
}

function applyFinalSnapshotToMatches(
  matches: Match[],
  finalSnapshot: WorldCupFinalSnapshotSummary | null,
  featured: FeaturedRound,
  status: WorldCupRoundWindowStatus,
) {
  const knownSnapshot = knownFinalSnapshotsByRound.get(featured.roundNumber);

  if (status !== "closed" || !finalSnapshot || !knownSnapshot) {
    return matches;
  }

  const finalByMatchNo = new Map(knownSnapshot.voteRows.map((row) => [row.matchNo, row]));

  return matches.map((match) => {
    const finalRow = finalByMatchNo.get(match.matchNo);

    if (!finalRow) {
      return match;
    }

    return {
      ...match,
      officialVote0: finalRow.officialVote0,
      officialVote1: finalRow.officialVote1,
      officialVote2: finalRow.officialVote2,
    };
  });
}

function buildFeaturedEvAssumption(input: {
  featured: FeaturedRound;
  finalSnapshot: WorldCupFinalSnapshotSummary | null;
  roundId: string | null;
  status: WorldCupRoundWindowStatus;
}): RoundEvAssumption | null {
  const totalSalesYen =
    input.status === "closed" && input.finalSnapshot
      ? input.finalSnapshot.totalSalesYen
      : input.featured.totalSalesYen;

  if (!isKnownNumber(totalSalesYen)) {
    return null;
  }

  return {
    carryoverYen: 0,
    createdAt: featuredSnapshotCapturedAt,
    firstPrizeShare: 0.7,
    id: `world-cup-featured-${input.featured.roundNumber}`,
    note:
      input.status === "closed" && input.finalSnapshot
        ? `W杯toto 第${input.featured.roundNumber}回の販売終了時点の売上・投票率から作った1等EV試算。購入や精算は扱いません。`
        : `W杯toto 第${input.featured.roundNumber}回の保存スナップショットから作った1等EV試算。購入や精算は扱いません。`,
    payoutCapYen: null,
    returnRate: 0.5,
    roundId: input.roundId ?? `featured-world-toto-${input.featured.roundNumber}`,
    stakeYen: defaultStakeYen,
    totalSalesYen,
    updatedAt: featuredSnapshotCapturedAt,
  };
}

export function resolveFeaturedWorldTotoRoundNumber(input: {
  sourceNote: string | null;
  title: string;
}) {
  const haystack = `${input.title} ${input.sourceNote ?? ""}`;
  const matched = haystack.match(/(?:第|隨ｬ)(163[4-7])(?:回|蝗)/);
  const roundNumber = matched ? Number(matched[1]) : null;

  return featuredWorldTotoRoundNumbers.includes(roundNumber as (typeof featuredWorldTotoRoundNumbers)[number])
    ? roundNumber
    : null;
}

function sortedMatches(matches: Match[]) {
  return [...matches].sort((left, right) => left.matchNo - right.matchNo);
}

function fallbackOutcome(match: MatchLike) {
  return favoriteOutcomeForBucket(match, "model") ?? favoriteOutcomeForBucket(match, "official") ?? "1";
}

function orthodoxPick(match: MatchLike) {
  return favoriteOutcomeForBucket(match, "official") ?? fallbackOutcome(match);
}

function aiPick(match: MatchLike) {
  return favoriteOutcomeForBucket(match, "model") ?? orthodoxPick(match);
}

function selectedOutcomeProbabilities(
  matches: Match[],
  picks: WorldCupStrategyPick[],
  bucket: ProbabilityBucket,
) {
  const matchByNo = new Map(matches.map((match) => [match.matchNo, match]));

  return picks.map((entry) => {
    const match = matchByNo.get(entry.matchNo);
    return match ? getProbability(match, bucket, entry.pick) : null;
  });
}

function lineSignature(picks: WorldCupStrategyPick[]) {
  return [...picks]
    .sort((left, right) => left.matchNo - right.matchNo)
    .map((pick) => pick.pick)
    .join("");
}

function deviationCount(picks: WorldCupStrategyPick[], orthodoxPicks: WorldCupStrategyPick[]) {
  const orthodoxByMatchNo = new Map(orthodoxPicks.map((pick) => [pick.matchNo, pick.pick]));
  return picks.filter((pick) => orthodoxByMatchNo.get(pick.matchNo) !== pick.pick).length;
}

function buildLine(input: {
  assumption: RoundEvAssumption | null;
  key: WorldCupStrategyLineKey;
  label: string;
  matches: Match[];
  orthodoxPicks: WorldCupStrategyPick[];
  picks: WorldCupStrategyPick[];
}): WorldCupStrategyLine {
  const selectedModelProbabilities = selectedOutcomeProbabilities(input.matches, input.picks, "model");
  const selectedOfficialProbabilities = selectedOutcomeProbabilities(input.matches, input.picks, "official");
  const ev = calculateTicketEv({
    assumption: input.assumption,
    selectedModelProbabilities,
    selectedOfficialProbabilities,
  });

  return {
    deviationCount: deviationCount(input.picks, input.orthodoxPicks),
    estimatedPayoutYen: ev.estimatedPayoutYen,
    evMultiple: ev.evMultiple,
    expectedReturnYen: ev.grossEvYen,
    hitProbability: ev.pModelCombo,
    key: input.key,
    label: input.label,
    picks: input.picks,
    publicProbability: ev.pPublicCombo,
    strictEvReady: ev.strictAvailable,
  };
}

function valueOpportunity(match: Match, orthodox: OutcomeValue) {
  const candidates = OUTCOME_VALUES.flatMap((outcome) => {
    const modelProbability = getProbability(match, "model", outcome);
    const officialProbability = getProbability(match, "official", outcome);

    if (!isKnownNumber(modelProbability) || !isKnownNumber(officialProbability) || officialProbability <= 0) {
      return [];
    }

    const edge = modelProbability - officialProbability;
    const valueRatio = modelProbability / officialProbability;
    const score = Math.log(Math.max(valueRatio, 0.01)) + edge * 2 + modelProbability * 0.35;

    if (outcome === orthodox || modelProbability < 0.05 || (edge < 0.025 && valueRatio < 1.12)) {
      return [];
    }

    return [
      {
        edge,
        matchNo: match.matchNo,
        outcome,
        score,
        valueRatio,
      },
    ];
  }).sort((left, right) => right.score - left.score);

  return candidates[0] ?? null;
}

function buildValuePicks(matches: Match[], orthodoxPicks: WorldCupStrategyPick[]) {
  const orthodoxByMatchNo = new Map(orthodoxPicks.map((pick) => [pick.matchNo, pick.pick]));
  const chosenMatchNos = new Set(
    matches
      .flatMap((match) => {
        const orthodox = orthodoxByMatchNo.get(match.matchNo) ?? orthodoxPick(match);
        const opportunity = valueOpportunity(match, orthodox);

        return opportunity ? [opportunity] : [];
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, valueLineSpotCount)
      .map((entry) => entry.matchNo),
  );

  return matches.map((match) => {
    const orthodox = orthodoxByMatchNo.get(match.matchNo) ?? orthodoxPick(match);
    const opportunity = valueOpportunity(match, orthodox);

    return {
      matchNo: match.matchNo,
      pick: opportunity && chosenMatchNos.has(match.matchNo) ? opportunity.outcome : orthodox,
    };
  });
}

function strictEvMissingReasons(input: {
  assumption: RoundEvAssumption | null;
  matchCount: number;
  modelReadyCount: number;
  officialReadyCount: number;
}) {
  const reasons: string[] = [];

  if (input.matchCount < 13) {
    reasons.push("13試合が未作成");
  }

  if (!isKnownNumber(input.assumption?.totalSalesYen)) {
    reasons.push("売上総額が未確定");
  }

  if (input.officialReadyCount < input.matchCount || input.matchCount === 0) {
    reasons.push("公式投票率が不足");
  }

  if (input.modelReadyCount < input.matchCount || input.matchCount === 0) {
    reasons.push("モデル確率が不足");
  }

  return reasons;
}

function comparePositiveCombo(left: WorldCupPositiveEvCombo, right: WorldCupPositiveEvCombo) {
  return (
    right.evMultiple - left.evMultiple ||
    right.expectedReturnYen - left.expectedReturnYen ||
    right.hitProbability - left.hitProbability ||
    left.deviationCount - right.deviationCount ||
    left.signature.localeCompare(right.signature)
  );
}

function insertTopCombo(rows: WorldCupPositiveEvCombo[], row: WorldCupPositiveEvCombo, limit: number) {
  const insertAt = rows.findIndex((current) => comparePositiveCombo(row, current) < 0);

  if (insertAt === -1) {
    rows.push(row);
  } else {
    rows.splice(insertAt, 0, row);
  }

  if (rows.length > limit) {
    rows.pop();
  }
}

export function enumeratePositiveEvCombos(input: {
  assumption: RoundEvAssumption | null;
  limit?: number;
  matches: Match[];
  orthodoxPicks?: WorldCupStrategyPick[];
}): WorldCupPositiveEvResult {
  const limit = Math.max(1, input.limit ?? 120);
  const matches = sortedMatches(input.matches);
  const orthodoxPicks =
    input.orthodoxPicks ??
    matches.map((match) => ({
      matchNo: match.matchNo,
      pick: orthodoxPick(match),
    }));
  const options = matches.map((match) =>
    OUTCOME_VALUES.map((outcome) => ({
      matchNo: match.matchNo,
      modelProbability: getProbability(match, "model", outcome),
      officialProbability: getProbability(match, "official", outcome),
      outcome,
    })),
  );
  const ready =
    Boolean(input.assumption) &&
    isKnownNumber(input.assumption?.totalSalesYen) &&
    matches.length > 0 &&
    options.every((entries) =>
      entries.every(
        (entry) => isKnownNumber(entry.modelProbability) && isKnownNumber(entry.officialProbability),
      ),
    );

  if (!ready || !input.assumption) {
    return {
      evaluatedCount: null,
      ready: false,
      rows: [],
      totalPositiveCount: null,
      truncated: false,
    };
  }

  const assumption = input.assumption;
  const currentPicks = new Array<WorldCupStrategyPick>(matches.length);
  const topRows: WorldCupPositiveEvCombo[] = [];
  let evaluatedCount = 0;
  let totalPositiveCount = 0;

  const visit = (index: number, hitProbability: number, publicProbability: number) => {
    if (index === matches.length) {
      evaluatedCount += 1;

      const estimatedPayoutYen = calculateEstimatedPayout({
        assumption,
        pPublicCombo: publicProbability,
      });

      if (!isKnownNumber(estimatedPayoutYen)) {
        return;
      }

      const expectedReturnYen = hitProbability * estimatedPayoutYen;
      const evMultiple = expectedReturnYen / assumption.stakeYen;

      if (evMultiple <= 1) {
        return;
      }

      const picks = currentPicks.map((pick) => ({ ...pick }));
      totalPositiveCount += 1;
      insertTopCombo(
        topRows,
        {
          deviationCount: deviationCount(picks, orthodoxPicks),
          estimatedPayoutYen,
          evMultiple,
          expectedReturnYen,
          hitProbability,
          picks,
          publicProbability,
          signature: lineSignature(picks),
        },
        limit,
      );
      return;
    }

    options[index].forEach((option) => {
      currentPicks[index] = {
        matchNo: option.matchNo,
        pick: option.outcome,
      };
      visit(
        index + 1,
        hitProbability * (option.modelProbability ?? 0),
        publicProbability * (option.officialProbability ?? 0),
      );
    });
  };

  visit(0, 1, 1);

  return {
    evaluatedCount,
    ready: true,
    rows: topRows.sort(comparePositiveCombo),
    totalPositiveCount,
    truncated: totalPositiveCount > topRows.length,
  };
}

function buildPortfolioPlan(
  label: string,
  description: string,
  budgetYen: number,
  rows: WorldCupPositiveEvCombo[],
  stakeYen: number,
): WorldCupPortfolioPlan | null {
  const requestedLineCount = Math.max(1, Math.floor(budgetYen / stakeYen));
  const selectedRows = rows.slice(0, requestedLineCount);

  if (selectedRows.length === 0) {
    return null;
  }

  const expectedReturnYen = selectedRows.reduce((sum, row) => sum + row.expectedReturnYen, 0);
  const costYen = selectedRows.length * stakeYen;
  const hitProbabilityUpperBound = Math.min(
    1,
    selectedRows.reduce((sum, row) => sum + row.hitProbability, 0),
  );
  const payouts = selectedRows.map((row) => row.estimatedPayoutYen);

  return {
    budgetYen,
    costYen,
    description,
    evMultiple: expectedReturnYen / costYen,
    expectedProfitYen: expectedReturnYen - costYen,
    expectedReturnYen,
    hitProbabilityUpperBound,
    label,
    lineCount: selectedRows.length,
    maxPayoutIfHitYen: Math.max(...payouts),
    meetsBudget: expectedReturnYen >= costYen,
    minPayoutIfHitYen: Math.min(...payouts),
    requestedLineCount,
    rows: selectedRows,
    stakeYen,
    unallocatedBudgetYen: Math.max(0, budgetYen - costYen),
  };
}

function buildPortfolioPlans(positiveEv: WorldCupPositiveEvResult, stakeYen: number) {
  if (!positiveEv.ready || positiveEv.rows.length === 0) {
    return [];
  }

  return worldCupPortfolioBudgets
    .map((plan) =>
      buildPortfolioPlan(
        plan.label,
        plan.description,
        plan.budgetYen,
        positiveEv.rows,
        stakeYen,
      ),
    )
    .filter((plan): plan is WorldCupPortfolioPlan => Boolean(plan));
}

function portfolioComboLimitFor(stakeYen: number) {
  return Math.max(
    ...worldCupPortfolioBudgets.map((plan) => Math.max(1, Math.floor(plan.budgetYen / stakeYen))),
  );
}

function buildDriftText(input: {
  finalSnapshot: WorldCupFinalSnapshotSummary | null;
  featured: FeaturedRound;
  status: WorldCupRoundWindowStatus;
}) {
  const snapshotAt = new Date(featuredSnapshotCapturedAt);
  const closedAt = new Date(input.featured.salesEndAt);
  const gapMinutes = minutesBetween(snapshotAt, closedAt);
  const gapLabel = `保存スナップショットから締切まで${formatDuration(gapMinutes)}`;

  if (input.status === "closed") {
    if (input.finalSnapshot) {
      return {
        detail:
          "公式の販売終了時点データを保存済みです。買えた最後の時点は締切時刻までで、この画面の購入候補は確定売上・確定投票率で再計算しています。",
        label: "確定値で再計算",
        snapshotGapToCloseLabel: gapLabel,
      };
    }

    return {
      detail:
        "販売は終了していますが、最終投票率と最終売上の保存がまだありません。保存時点との差分は未確定として扱います。",
      label: "最終差分は未保存",
      snapshotGapToCloseLabel: gapLabel,
    };
  }

  if (input.status === "selling") {
    return {
      detail:
        "まだ買える時間帯です。締切直前に公式投票率と売上を再取得すると、買えるタイミングでの期待値精度が上がります。",
      label: "締切前の再取得待ち",
      snapshotGapToCloseLabel: gapLabel,
    };
  }

  return {
    detail:
      "発売前です。公式投票率と売上が出てから、買う候補と予算別の期待回収を計算できます。",
    label: "発売前",
    snapshotGapToCloseLabel: gapLabel,
  };
}

function primaryPlanFrom(plans: WorldCupPortfolioPlan[]) {
  return plans.find((plan) => plan.budgetYen === 10000) ?? plans[plans.length - 1] ?? null;
}

function buildRoundStrategy(input: {
  featured: FeaturedRound;
  includePositiveCombos: boolean;
  now: Date;
  positiveComboLimit: number;
  round: DashboardRoundSummary | null;
}): WorldCupRoundStrategy {
  const status = resolveWindowStatus({
    now: input.now,
    salesEndAt: input.featured.salesEndAt,
    salesStartAt: input.featured.salesStartAt,
  });
  const finalSnapshot = buildFinalSnapshotSummary(input.featured);
  const sourceMatches = input.round
    ? sortedMatches(input.round.matches)
    : buildModeledFeaturedMatches(input.featured);
  const matches = sortedMatches(
    applyFinalSnapshotToMatches(sourceMatches, finalSnapshot, input.featured, status),
  );
  const matchCount = matches.length || input.round?.matchCount || input.featured.matches.length;
  const officialReadyCount = matches.filter((match) => hasCompleteBucket(match, "official")).length;
  const modelReadyCount = matches.filter((match) => hasCompleteBucket(match, "model")).length;
  const evAssumption = buildFeaturedEvAssumption({
    featured: input.featured,
    finalSnapshot,
    roundId: input.round?.id ?? null,
    status,
  });
  const orthodoxPicks = matches.map((match) => ({
    matchNo: match.matchNo,
    pick: orthodoxPick(match),
  }));
  const lines =
    matches.length > 0
      ? [
          buildLine({
            assumption: evAssumption,
            key: "orthodox",
            label: "公式人気順",
            matches,
            orthodoxPicks,
            picks: orthodoxPicks,
          }),
          buildLine({
            assumption: evAssumption,
            key: "value",
            label: "期待回収重視",
            matches,
            orthodoxPicks,
            picks: buildValuePicks(matches, orthodoxPicks),
          }),
          buildLine({
            assumption: evAssumption,
            key: "ai",
            label: "モデル本命",
            matches,
            orthodoxPicks,
            picks: matches.map((match) => ({
              matchNo: match.matchNo,
              pick: aiPick(match),
            })),
          }),
        ]
      : [];
  const missingReasons = strictEvMissingReasons({
    assumption: evAssumption,
    matchCount,
    modelReadyCount,
    officialReadyCount,
  });
  const canEnumeratePositiveEv = missingReasons.length === 0;
  const stakeYen = evAssumption?.stakeYen ?? defaultStakeYen;
  const portfolioComboLimit = portfolioComboLimitFor(stakeYen);
  const positiveEv =
    input.includePositiveCombos && canEnumeratePositiveEv
      ? enumeratePositiveEvCombos({
          assumption: evAssumption,
          limit: Math.max(input.positiveComboLimit, portfolioComboLimit),
          matches,
          orthodoxPicks,
        })
      : {
          evaluatedCount: null,
          ready: canEnumeratePositiveEv,
          rows: [],
          totalPositiveCount: null,
          truncated: false,
        };
  const portfolioPositiveEv =
    positiveEv.rows.length > 0 || !canEnumeratePositiveEv
      ? positiveEv
      : enumeratePositiveEvCombos({
          assumption: evAssumption,
          limit: portfolioComboLimit,
          matches,
          orthodoxPicks,
        });
  const portfolioPlans = buildPortfolioPlans(portfolioPositiveEv, stakeYen);
  const drift = buildDriftText({
    finalSnapshot,
    featured: input.featured,
    status,
  });
  const usingFeaturedFallback = !input.round && matches.length > 0;

  return {
    calculationSourceLabel: input.round
      ? "保存済みRound + 公式投票率"
      : "内蔵W杯プリセット + 公式投票率",
    candidateTicketCount: input.round?.candidateTicketCount ?? 0,
    driftDetail: drift.detail,
    driftLabel: drift.label,
    evAssumption,
    featured: {
      roundNumber: input.featured.roundNumber,
      salesEndAt: input.featured.salesEndAt,
      salesStartAt: input.featured.salesStartAt,
      sourceUrl: input.featured.sourceUrl,
      title: input.featured.title,
      totalSalesYen: input.featured.totalSalesYen,
    },
    finalSnapshot,
    isCreated: Boolean(input.round),
    lastBuyableAtLabel: formatDateTime(input.featured.salesEndAt),
    lines,
    matchCount,
    modelReadyCount,
    officialReadyCount,
    orthodoxLine: lines.find((line) => line.key === "orthodox") ?? null,
    portfolioPlans,
    positiveEv,
    primaryPortfolioPlan: primaryPlanFrom(portfolioPlans),
    roundId: input.round?.id ?? null,
    roundTitle: input.round?.title ?? input.featured.title,
    snapshotGapToCloseLabel: drift.snapshotGapToCloseLabel,
    snapshotLabel: featuredWorldTotoSnapshotLabel,
    stakeYen,
    strictEvMissingReasons: missingReasons,
    strictEvReady: missingReasons.length === 0,
    usingFeaturedFallback,
    windowStatus: status,
    windowStatusLabel: windowStatusLabel(status),
  };
}

export function buildWorldCupStrategyDashboard(input: {
  includePositiveCombos?: boolean;
  now?: Date;
  positiveComboLimit?: number;
  rounds: DashboardRoundSummary[];
}): WorldCupStrategyDashboard {
  const now = input.now ?? new Date();
  const includePositiveCombos = input.includePositiveCombos ?? false;
  const positiveComboLimit = input.positiveComboLimit ?? 120;
  const roundByNumber = new Map<number, DashboardRoundSummary>();

  input.rounds.forEach((round) => {
    const roundNumber = resolveFeaturedWorldTotoRoundNumber(round);

    if (roundNumber !== null && !roundByNumber.has(roundNumber)) {
      roundByNumber.set(roundNumber, round);
    }
  });

  const rounds = featuredWorldTotoRounds.map((featured) =>
    buildRoundStrategy({
      featured,
      includePositiveCombos,
      now,
      positiveComboLimit,
      round: roundByNumber.get(featured.roundNumber) ?? null,
    }),
  );
  const positiveCounts = rounds
    .map((round) => round.positiveEv.totalPositiveCount)
    .filter(isKnownNumber);

  return {
    buyableCount: rounds.filter((round) => round.windowStatus === "selling").length,
    closedCount: rounds.filter((round) => round.windowStatus === "closed").length,
    createdCount: rounds.filter((round) => round.isCreated).length,
    positiveEvComboCount:
      positiveCounts.length > 0 ? positiveCounts.reduce((sum, count) => sum + count, 0) : null,
    rounds,
    snapshotLabel: featuredWorldTotoSnapshotLabel,
    strictReadyCount: rounds.filter((round) => round.strictEvReady).length,
  };
}
