import {
  OUTCOME_VALUES,
  enumToOutcome,
  favoriteOutcomeForBucket,
  formatDateTime,
  getProbability,
  type MatchLike,
  type OutcomeValue,
} from "@/lib/domain";
import {
  DEFAULT_TOTO_PRIZE_TIERS,
  calculateEstimatedPayout,
  calculateEstimatedTierPayout,
  calculateTicketEv,
  calculateTotoPrizeTierEvs,
  sumTotoPrizeTierExpectedReturn,
  sumTotoPrizeTierHitProbability,
  type TotoPrizeTierDefinition,
  type TotoPrizeTierEv,
} from "@/lib/ev";
import {
  featuredWorldTotoVoteUrl,
  featuredWorldTotoRounds,
  featuredWorldTotoRoundNumbers,
  featuredWorldTotoSnapshotLabel,
} from "@/lib/featured-world-toto";
import { calculateModelProbabilities } from "@/lib/probability/engine";
import type { DashboardRoundSummary, Match, RoundEvAssumption, TotoOfficialRoundLibraryMatch } from "@/lib/types";
import {
  worldCupTotoOfficialResult1635Url,
  worldCupTotoOfficialVote1635Url,
} from "@/lib/world-cup-toto-review-plan";
import { modelSeed } from "@/lib/world-toto-strength";

const featuredSnapshotCapturedAt = "2026-06-07T08:56:00+09:00";
const valueLineSpotCount = 4;
const defaultStakeYen = 100;
const coverageUniverseLimit = 20000;

type FeaturedRound = (typeof featuredWorldTotoRounds)[number];

type ProbabilityBucket = "model" | "official";

export type WorldCupRoundWindowStatus = "closed" | "selling" | "upcoming";

export type WorldCupStrategyPick = {
  matchNo: number;
  pick: OutcomeValue;
};

export type WorldCupStrategyLineKey = "ai" | "orthodox" | "value";

export type WorldCupOutcomePolicyKind = "actual_fixed" | "model_lock" | "spread" | "value_fade" | "open";

export type WorldCupOutcomePolicy = {
  allowedOutcomes: OutcomeValue[];
  fixture: string;
  kind: WorldCupOutcomePolicyKind;
  label: string;
  matchNo: number;
  modelFavorite: OutcomeValue | null;
  modelFavoriteProbability: number | null;
  officialFavorite: OutcomeValue | null;
  officialFavoriteProbability: number | null;
  reason: string;
};

export type WorldCupStrategyLine = {
  cashProbability: number | null;
  deviationCount: number;
  estimatedPayoutYen: number | null;
  evMultiple: number | null;
  expectedReturnYen: number | null;
  firstPrizeEvMultiple: number | null;
  firstPrizeExpectedReturnYen: number | null;
  hitProbability: number | null;
  key: WorldCupStrategyLineKey;
  label: string;
  picks: WorldCupStrategyPick[];
  prizeTiers: TotoPrizeTierEv[];
  publicProbability: number | null;
  strictEvReady: boolean;
  totalEvMultiple: number | null;
  totalExpectedReturnYen: number | null;
};

export type WorldCupPositiveEvCombo = {
  cashProbability: number;
  deviationCount: number;
  disclosureLabel: string;
  estimatedPayoutYen: number;
  evMultiple: number;
  expectedReturnYen: number;
  firstPrizeEvMultiple: number;
  firstPrizeExpectedReturnYen: number;
  hitProbability: number;
  picks: WorldCupStrategyPick[];
  prizeTiers: TotoPrizeTierEv[];
  publicProbability: number;
  signature: string;
  strategyBucket: string;
  strategyDetail: string;
};

export type WorldCupPositiveEvResult = {
  evaluatedCount: number | null;
  ready: boolean;
  rows: WorldCupPositiveEvCombo[];
  totalPositiveCount: number | null;
  truncated: boolean;
};

export type WorldCupSecondPrizeCoverage = {
  evaluatedUniverseCount: number;
  exactCoverageRate: number;
  exactCoveredCount: number;
  guaranteedSecondPrize: boolean;
  label: string;
  ready: boolean;
  secondPrizeCoverageRate: number;
  secondPrizeCoveredCount: number;
  skippedReason: string | null;
  thirdPrizeCoverageRate: number;
  thirdPrizeCoveredCount: number;
  uncoveredSecondPrizeCount: number;
  universeCount: number;
  worstDistanceToPortfolio: number | null;
};

export type WorldCupPortfolioPlan = {
  budgetYen: number;
  cashProbabilityUpperBound: number;
  costYen: number;
  description: string;
  evMultiple: number;
  expectedProfitYen: number;
  expectedReturnYen: number;
  firstPrizeExpectedReturnYen: number;
  hitProbabilityUpperBound: number;
  label: string;
  lineCount: number;
  maxPayoutIfHitYen: number;
  meetsBudget: boolean;
  minPayoutIfHitYen: number;
  requestedLineCount: number;
  rows: WorldCupPositiveEvCombo[];
  secondPrizeCoverage: WorldCupSecondPrizeCoverage;
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

export type WorldCupSourceStatus = "fixed" | "live" | "model" | "research" | "missing";

export type WorldCupEvSourceRow = {
  detail: string;
  label: string;
  sourceLabel: string;
  sourceUrl: string | null;
  status: WorldCupSourceStatus;
  value: string;
};

export type WorldCupEvGlossaryRow = {
  formula: string;
  plain: string;
  term: string;
};

export type WorldCupMarketEvComparisonKey =
  | "random_baseline"
  | "public_favorite"
  | "market_proxy_top"
  | "market_proxy_portfolio";

export type WorldCupMarketEvComparisonRow = {
  costYen: number | null;
  evLiftMultiple: number | null;
  evMultiple: number | null;
  expectedProfitYen: number | null;
  expectedReturnYen: number | null;
  key: WorldCupMarketEvComparisonKey;
  label: string;
  method: string;
  sourceLabel: string;
  sourceUrl: string | null;
  status: WorldCupSourceStatus;
  verdict: string;
};

export type WorldCupPredictionLogicRow = {
  currentUse: string;
  label: string;
  nextRefinement: string;
  sourceLabel: string;
  sourceUrl: string | null;
  status: WorldCupSourceStatus;
  whyItMatters: string;
};

export type WorldCupTimingChecklistItem = {
  actionLabel: string;
  enabled: boolean;
  label: string;
  timingLabel: string;
};

export type WorldCupRoundStrategy = {
  calculationSourceLabel: string;
  candidateTicketCount: number;
  commandStatusLabel: string;
  driftDetail: string;
  driftLabel: string;
  evAssumption: RoundEvAssumption | null;
  evSourceRows: WorldCupEvSourceRow[];
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
  marketEvComparisonRows: WorldCupMarketEvComparisonRow[];
  marketEvVerdict: string;
  matchCount: number;
  modelReadyCount: number;
  officialReadyCount: number;
  orthodoxLine: WorldCupStrategyLine | null;
  orthodoxDecisionDetail: string;
  orthodoxDecisionLabel: string;
  outcomePolicies: WorldCupOutcomePolicy[];
  portfolioPlans: WorldCupPortfolioPlan[];
  positiveEv: WorldCupPositiveEvResult;
  postMortemPrompts: string[];
  predictionLogicRows: WorldCupPredictionLogicRow[];
  primaryPortfolioPlan: WorldCupPortfolioPlan | null;
  recommendedActionDetail: string;
  recommendedActionLabel: string;
  roundId: string | null;
  roundTitle: string;
  snapshotGapToCloseLabel: string;
  snapshotLabel: string;
  stakeYen: number;
  strictEvMissingReasons: string[];
  strictEvReady: boolean;
  timingChecklist: WorldCupTimingChecklistItem[];
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

type KnownActualResultSnapshot = {
  sourceAsOfLabel: string;
  resultRows: Array<{
    actualResult: NonNullable<Match["actualResult"]>;
    matchNo: number;
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
  [
    1635,
    {
      sourceAsOfLabel: "2026-06-16 sales close",
      sourceUrl: worldCupTotoOfficialVote1635Url,
      totalSalesYen: 252729800,
      voteRows: [
        { matchNo: 1, officialVote1: 0.6976, officialVote0: 0.2124, officialVote2: 0.09 },
        { matchNo: 2, officialVote1: 0.7537, officialVote0: 0.1739, officialVote2: 0.0724 },
        { matchNo: 3, officialVote1: 0.4683, officialVote0: 0.3323, officialVote2: 0.1994 },
        { matchNo: 4, officialVote1: 0.5117, officialVote0: 0.3079, officialVote2: 0.1804 },
        { matchNo: 5, officialVote1: 0.1128, officialVote0: 0.2082, officialVote2: 0.679 },
        { matchNo: 6, officialVote1: 0.7437, officialVote0: 0.1862, officialVote2: 0.0701 },
        { matchNo: 7, officialVote1: 0.0653, officialVote0: 0.1818, officialVote2: 0.7529 },
        { matchNo: 8, officialVote1: 0.5331, officialVote0: 0.2887, officialVote2: 0.1782 },
        { matchNo: 9, officialVote1: 0.5909, officialVote0: 0.2792, officialVote2: 0.1299 },
        { matchNo: 10, officialVote1: 0.9322, officialVote0: 0.0473, officialVote2: 0.0205 },
        { matchNo: 11, officialVote1: 0.859, officialVote0: 0.1006, officialVote2: 0.0404 },
        { matchNo: 12, officialVote1: 0.4409, officialVote0: 0.2991, officialVote2: 0.26 },
        { matchNo: 13, officialVote1: 0.5941, officialVote0: 0.2729, officialVote2: 0.133 },
      ],
    },
  ],
]);

const knownActualResultsByRound = new Map<number, KnownActualResultSnapshot>([
  [
    1634,
    {
      sourceAsOfLabel: "2026-06-15 08:00 JST partial confirmed results",
      resultRows: [
        { matchNo: 1, actualResult: "DRAW" },
        { matchNo: 2, actualResult: "DRAW" },
        { matchNo: 3, actualResult: "ONE" },
        { matchNo: 4, actualResult: "DRAW" },
        { matchNo: 6, actualResult: "DRAW" },
        { matchNo: 11, actualResult: "TWO" },
        { matchNo: 12, actualResult: "ONE" },
        { matchNo: 13, actualResult: "ONE" },
      ],
    },
  ],
  [
    1635,
    {
      sourceAsOfLabel: `2026-06-20 preliminary result: ${worldCupTotoOfficialResult1635Url}`,
      resultRows: [
        { matchNo: 1, actualResult: "ONE" },
        { matchNo: 2, actualResult: "ONE" },
        { matchNo: 3, actualResult: "ONE" },
        { matchNo: 4, actualResult: "ONE" },
        { matchNo: 5, actualResult: "TWO" },
        { matchNo: 6, actualResult: "ONE" },
        { matchNo: 7, actualResult: "TWO" },
        { matchNo: 8, actualResult: "DRAW" },
        { matchNo: 9, actualResult: "ONE" },
        { matchNo: 10, actualResult: "ONE" },
        { matchNo: 11, actualResult: "DRAW" },
        { matchNo: 12, actualResult: "ONE" },
        { matchNo: 13, actualResult: "ONE" },
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

const officialTotoRuleUrl = "https://www.toto-dream.com/toto/about/index.html";
const totoSecondPrizeGuaranteeSourceUrl = "https://toto.cam/news/news_2019052001.php";
const totoBaraSourceUrl = "https://totobara.com/";
const dixonColesSourceUrl = "https://rss.onlinelibrary.wiley.com/doi/abs/10.1111/1467-9876.00065";
const sportsForecastingSourceUrl = "https://onlinelibrary.wiley.com/doi/10.1002/for.1091";
const eloWorldCupSourceUrl = "https://www.math.tugraz.at/~gilch/person/WC2018-Forecast.pdf";
const favoriteLongshotSourceUrl = "https://www.nber.org/papers/w15923";

export const worldCupEvGlossaryRows: WorldCupEvGlossaryRow[] = [
  {
    formula: "EV倍率 = 期待回収額 / 購入額",
    plain: "1口100円を同じ条件で何度も買った時に、平均いくら戻る見込みかを見る数字です。1.00倍が損益分岐です。",
    term: "EV",
  },
  {
    formula: "p_model = モデルが見た実際の当たりやすさ",
    plain: "予測市場、外部オッズ、Elo、得点モデル、Hazi補正などから作る勝率です。ここを当てに行きます。",
    term: "p_model",
  },
  {
    formula: "p_public = 公式投票率から見た混み具合",
    plain: "totoで他の人がどの出目を買っていそうかです。同じ当たり目に人が多いほど払戻は薄くなります。",
    term: "p_public",
  },
  {
    formula: "予測市場EV = p_model x 推定払戻",
    plain: "当たりそうなのに人が少ない出目を探す見方です。実オッズ未接続の間はmarket proxyとして表示します。",
    term: "予測市場EV",
  },
  {
    formula: "期待損益 = 期待回収額 - 購入額",
    plain: "プラスなら理論上は購入額を上回る見込み、マイナスなら平均では負ける見込みです。利益保証ではありません。",
    term: "期待損益",
  },
];

function isKnownNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function totoPrizeTiersForMatchCount(matchCount: number): readonly TotoPrizeTierDefinition[] {
  return matchCount === 13 ? DEFAULT_TOTO_PRIZE_TIERS : DEFAULT_TOTO_PRIZE_TIERS.slice(0, 1);
}

function totalEvMultiple(expectedReturnYen: number | null, assumption: RoundEvAssumption | null) {
  return expectedReturnYen !== null && assumption && assumption.stakeYen > 0
    ? expectedReturnYen / assumption.stakeYen
    : null;
}

function missProbabilityFromMoments(input: {
  exactHitProbability: number;
  missCount: number;
  missHitRatioSquareSum: number;
  missHitRatioSum: number;
}) {
  if (input.missCount === 0) {
    return input.exactHitProbability;
  }

  if (input.missCount === 1) {
    return input.exactHitProbability * input.missHitRatioSum;
  }

  if (input.missCount === 2) {
    const pairRatioSum =
      (input.missHitRatioSum * input.missHitRatioSum - input.missHitRatioSquareSum) / 2;
    return input.exactHitProbability * pairRatioSum;
  }

  return null;
}

function buildPrizeTiersFromMoments(input: {
  assumption: RoundEvAssumption;
  modelHitProbability: number;
  modelMissHitRatioSquareSum: number;
  modelMissHitRatioSum: number;
  publicHitProbability: number;
  publicMissHitRatioSquareSum: number;
  publicMissHitRatioSum: number;
  tiers: readonly TotoPrizeTierDefinition[];
}) {
  return input.tiers.map((tier) => {
    const poolShare = tier.key === "first" ? input.assumption.firstPrizeShare : tier.poolShare;
    const pModelTier = missProbabilityFromMoments({
      exactHitProbability: input.modelHitProbability,
      missCount: tier.missCount,
      missHitRatioSquareSum: input.modelMissHitRatioSquareSum,
      missHitRatioSum: input.modelMissHitRatioSum,
    });
    const pPublicTier = missProbabilityFromMoments({
      exactHitProbability: input.publicHitProbability,
      missCount: tier.missCount,
      missHitRatioSquareSum: input.publicMissHitRatioSquareSum,
      missHitRatioSum: input.publicMissHitRatioSum,
    });
    const estimatedPayoutYen = calculateEstimatedTierPayout({
      assumption: input.assumption,
      carryoverEligible: tier.carryoverEligible,
      pPublicTier,
      poolShare,
    });
    const expectedReturnYen =
      isKnownNumber(pModelTier) && isKnownNumber(estimatedPayoutYen)
        ? pModelTier * estimatedPayoutYen
        : null;
    const evMultiple =
      expectedReturnYen !== null && input.assumption.stakeYen > 0
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

function applyKnownActualResultsToMatches(
  matches: Match[],
  featured: FeaturedRound,
  status: WorldCupRoundWindowStatus,
) {
  const knownResults = knownActualResultsByRound.get(featured.roundNumber);

  if (status !== "closed" || !knownResults) {
    return matches;
  }

  const resultByMatchNo = new Map(knownResults.resultRows.map((row) => [row.matchNo, row.actualResult]));

  return matches.map((match) => {
    const actualResult = resultByMatchNo.get(match.matchNo);
    const actualOutcome = enumToOutcome(actualResult);

    if (!actualResult || !actualOutcome) {
      return match;
    }

    // Treat already-known results as conditional facts for post-close review.
    // Official vote shares stay unchanged because they still estimate crowd dilution.
    return {
      ...match,
      actualResult,
      modelProb0: actualOutcome === "0" ? 1 : 0,
      modelProb1: actualOutcome === "1" ? 1 : 0,
      modelProb2: actualOutcome === "2" ? 1 : 0,
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

function probabilityRows(match: MatchLike, bucket: ProbabilityBucket) {
  return OUTCOME_VALUES.map((outcome) => ({
    outcome,
    probability: getProbability(match, bucket, outcome),
  })).sort((left, right) => (right.probability ?? -1) - (left.probability ?? -1));
}

function outcomePolicyFor(match: Match): WorldCupOutcomePolicy {
  const actualOutcome = enumToOutcome(match.actualResult);
  const modelRows = probabilityRows(match, "model");
  const officialRows = probabilityRows(match, "official");
  const modelFavorite = modelRows[0]?.outcome ?? null;
  const modelFavoriteProbability = modelRows[0]?.probability ?? null;
  const modelSecondProbability = modelRows[1]?.probability ?? null;
  const officialFavorite = officialRows[0]?.outcome ?? null;
  const officialFavoriteProbability = officialRows[0]?.probability ?? null;
  const fixture = `${match.homeTeam} - ${match.awayTeam}`;

  if (actualOutcome) {
    return {
      allowedOutcomes: [actualOutcome],
      fixture,
      kind: "actual_fixed",
      label: "結果固定",
      matchNo: match.matchNo,
      modelFavorite,
      modelFavoriteProbability,
      officialFavorite,
      officialFavoriteProbability,
      reason: `確定結果 ${actualOutcome} を反映。ここに反する買い目は除外。`,
    };
  }

  if (isKnownNumber(modelFavoriteProbability) && modelFavoriteProbability >= 0.7 && modelFavorite) {
    return {
      allowedOutcomes: [modelFavorite],
      fixture,
      kind: "model_lock",
      label: "70%以上ロック",
      matchNo: match.matchNo,
      modelFavorite,
      modelFavoriteProbability,
      officialFavorite,
      officialFavoriteProbability,
      reason: `モデル本命が ${(modelFavoriteProbability * 100).toFixed(1)}%。分散せず ${modelFavorite} だけ残す。`,
    };
  }

  const topGap =
    isKnownNumber(modelFavoriteProbability) && isKnownNumber(modelSecondProbability)
      ? modelFavoriteProbability - modelSecondProbability
      : null;
    const officialSpread = officialRows.every(
      (row) =>
        isKnownNumber(row.probability) &&
        row.probability >= 0.25 &&
        row.probability <= 0.45,
    );

  if ((isKnownNumber(topGap) && topGap <= 0.08) || officialSpread) {
    const allowedOutcomes = modelRows
      .filter((row) => isKnownNumber(row.probability) && row.probability >= 0.22)
      .map((row) => row.outcome);

    return {
      allowedOutcomes: allowedOutcomes.length > 0 ? allowedOutcomes : OUTCOME_VALUES.map((outcome) => outcome),
      fixture,
      kind: "spread",
      label: "割れ試合分散",
      matchNo: match.matchNo,
      modelFavorite,
      modelFavoriteProbability,
      officialFavorite,
      officialFavoriteProbability,
      reason: isKnownNumber(topGap)
        ? `上位差 ${(topGap * 100).toFixed(1)}pt。30%台で割れる試合として複数出目を残す。`
        : "公式人気が割れているため複数出目を残す。",
    };
  }

  if (
    officialFavorite &&
    modelFavorite &&
    officialFavorite !== modelFavorite &&
    isKnownNumber(officialFavoriteProbability) &&
    officialFavoriteProbability >= 0.7
  ) {
    const allowed = Array.from(new Set([modelFavorite, modelRows[1]?.outcome].filter(Boolean))) as OutcomeValue[];

    return {
      allowedOutcomes: allowed.length > 0 ? allowed : [modelFavorite],
      fixture,
      kind: "value_fade",
      label: "人気過剰外し",
      matchNo: match.matchNo,
      modelFavorite,
      modelFavoriteProbability,
      officialFavorite,
      officialFavoriteProbability,
      reason: `公式人気は ${officialFavorite} に ${(officialFavoriteProbability * 100).toFixed(1)}% 集中、モデル本命は ${modelFavorite}。人気側を厚く買わない。`,
    };
  }

  return {
    allowedOutcomes: OUTCOME_VALUES.map((outcome) => outcome),
    fixture,
    kind: "open",
    label: "EV順で探索",
    matchNo: match.matchNo,
    modelFavorite,
    modelFavoriteProbability,
    officialFavorite,
    officialFavoriteProbability,
    reason: "明確なロック条件ではないため、EV順の探索に委ねる。",
  };
}

function buildOutcomePolicies(matches: Match[]) {
  return sortedMatches(matches).map(outcomePolicyFor);
}

function yenLabel(value: number | null | undefined) {
  return isKnownNumber(value) ? `${Math.round(value).toLocaleString("ja-JP")}円` : "未確定";
}

function isWorldCupFallbackLike(match: MatchLike) {
  const prob1 = getProbability(match, "model", "1");
  const prob0 = getProbability(match, "model", "0");
  const prob2 = getProbability(match, "model", "2");

  return (
    isKnownNumber(prob1) &&
    isKnownNumber(prob0) &&
    isKnownNumber(prob2) &&
    Math.abs(prob1 - 0.36) <= 0.005 &&
    Math.abs(prob0 - 0.28) <= 0.005 &&
    Math.abs(prob2 - 0.36) <= 0.005
  );
}

function modelSourceSummary(matches: Match[], usingFeaturedFallback: boolean) {
  if (matches.length === 0) {
    return "モデル未入力";
  }

  const fallbackLikeCount = matches.filter(isWorldCupFallbackLike).length;
  const readyCount = matches.filter((match) => hasCompleteBucket(match, "model")).length;

  if (fallbackLikeCount >= Math.ceil(matches.length * 0.6)) {
    return `W杯fallback prior中心 (${fallbackLikeCount}/${matches.length})`;
  }

  if (usingFeaturedFallback) {
    return "内蔵W杯プリセットの軽量モデル";
  }

  return `保存済みRoundモデル (${readyCount}/${matches.length})`;
}

function buildEvSourceRows(input: {
  evAssumption: RoundEvAssumption | null;
  featured: FeaturedRound;
  finalSnapshot: WorldCupFinalSnapshotSummary | null;
  matches: Match[];
  modelReadyCount: number;
  primaryPlan: WorldCupPortfolioPlan | null;
  usingFeaturedFallback: boolean;
}) {
  const knownResults = knownActualResultsByRound.get(input.featured.roundNumber);
  const actualFixedCount = input.matches.filter((match) => enumToOutcome(match.actualResult)).length;
  const modelSummary = modelSourceSummary(input.matches, input.usingFeaturedFallback);

  return [
    {
      detail: "公式ルールの購入単価と当せん等級。toto13は1等=全的中、2等=1試合外し、3等=2試合外しで計算します。",
      label: "くじルール",
      sourceLabel: "toto公式ルール",
      sourceUrl: officialTotoRuleUrl,
      status: "fixed",
      value: "1口100円 / 1等70%・2等15%・3等15%",
    },
    {
      detail: input.finalSnapshot
        ? "締切後の確定売上と確定投票率を、他の当せん口数を推定する crowd 側の分布として使います。"
        : "締切前は保存済みの売上・投票率で暫定計算します。買う直前ほどここを取り直す価値があります。",
      label: "売上・公式投票率",
      sourceLabel: input.finalSnapshot?.sourceAsOfLabel ?? featuredWorldTotoSnapshotLabel,
      sourceUrl: input.finalSnapshot?.sourceUrl ?? input.featured.sourceUrl,
      status: input.finalSnapshot ? "fixed" : "live",
      value: yenLabel(input.evAssumption?.totalSalesYen),
    },
    {
      detail: "勝率側の分布です。ここが一番ガチ予想で詰める余地があります。fallback中心なら、感想戦メモからチーム差・ドロー条件・欠場を足します。",
      label: "モデル確率",
      sourceLabel: modelSummary,
      sourceUrl: null,
      status: input.modelReadyCount >= input.matches.length && input.matches.length > 0 ? "model" : "missing",
      value: `${input.modelReadyCount}/${input.matches.length || input.featured.matches.length}`,
    },
    {
      detail: knownResults
        ? `${knownResults.sourceAsOfLabel} の既知結果は固定し、反する買い目を候補から除外します。`
        : "試合後の感想戦では結果を固定して、買える時点の予想とどれだけズレたかを見ます。",
      label: "確定結果",
      sourceLabel: knownResults?.sourceAsOfLabel ?? "未確定",
      sourceUrl: null,
      status: actualFixedCount > 0 ? "fixed" : "missing",
      value: `${actualFixedCount}/${input.matches.length || input.featured.matches.length}試合`,
    },
    {
      detail: "各等級ごとに p_model(当せん) × 推定払戻を計算します。推定払戻は売上原資と p_public(同じ等級に来る crowd 口数) で割ります。",
      label: "EV式",
      sourceLabel: "World Toto Lab",
      sourceUrl: null,
      status: "model",
      value: "1〜3等EV合算",
    },
    {
      detail:
        "バラ買いの口数削減発想を、候補宇宙内で距離1以内に入る割合として表示します。100%の時だけ2等保証と呼び、それ以外は2等カバー率として扱います。",
      label: "2等カバー",
      sourceLabel: "totomo 2等保証 / トトバラ",
      sourceUrl: totoSecondPrizeGuaranteeSourceUrl,
      status: input.primaryPlan?.secondPrizeCoverage.ready ? "model" : "research",
      value: input.primaryPlan?.secondPrizeCoverage.ready
        ? `${(input.primaryPlan.secondPrizeCoverage.secondPrizeCoverageRate * 100).toFixed(1)}%`
        : "未計算",
    },
    {
      detail: "購入額より期待回収が高い組み合わせだけを、1通り1口で積みます。プラス候補が足りない場合、余った予算は使いません。",
      label: "ポートフォリオ",
      sourceLabel: "positive EV only",
      sourceUrl: null,
      status: input.primaryPlan ? "model" : "missing",
      value: input.primaryPlan
        ? `${input.primaryPlan.lineCount}口 / ${yenLabel(input.primaryPlan.costYen)}`
        : "未確定",
    },
  ] satisfies WorldCupEvSourceRow[];
}

function buildPredictionLogicRows(input: {
  matches: Match[];
  usingFeaturedFallback: boolean;
}) {
  const modelSummary = modelSourceSummary(input.matches, input.usingFeaturedFallback);

  return [
    {
      currentUse:
        "公式投票率は、真の勝率ではなく払戻を薄める crowd 側として使用。外部ブックメーカー締切オッズは未入力。",
      label: "市場/締切オッズを基準線にする",
      nextRefinement:
        "買える直前にブックメーカー odds を取り込み、overround 除去後の確率を model/crowd の比較軸にする。",
      sourceLabel: "Spann & Skiera 2009",
      sourceUrl: sportsForecastingSourceUrl,
      status: "research",
      whyItMatters:
        "予測市場や賭けオッズは、単独の予想屋より強いベースラインになりやすい。まず市場に勝てるズレだけを探します。",
    },
    {
      currentUse: `${modelSummary}。現状の第1634回では、説明可能な強度差よりも軽量モデル線が中心です。`,
      label: "Elo/チーム強度で土台を作る",
      nextRefinement:
        "FIFA/Elo、直近試合、開催地、移動、ローテを入れて、fallback 36/28/36 から試合別の分布へ寄せる。",
      sourceLabel: "Gilch & Mueller WC2018 forecast",
      sourceUrl: eloWorldCupSourceUrl,
      status: "model",
      whyItMatters:
        "人間の会話を入れる前の土台。国別強度がないと、人気票に逆らう理由が説明しづらくなります。",
    },
    {
      currentUse:
        "今は得点期待モデルとしては未実装。割れ試合分散ルールでドローを落としすぎないようにしています。",
      label: "Poisson / Dixon-Colesでドローを詰める",
      nextRefinement:
        "攻撃力・守備力・低得点相関から 1/0/2 を出し、特に0-0/1-1寄りの試合をドロー候補として強める。",
      sourceLabel: "Dixon & Coles 1997",
      sourceUrl: dixonColesSourceUrl,
      status: "research",
      whyItMatters:
        "サッカーは引き分けの扱いがEVを大きく変えます。得点分布から見ると、感想戦の論点が具体化します。",
    },
    {
      currentUse:
        "公式人気が70%以上でモデル本命とズレる場合は、人気側を厚く買わない value_fade ルールを表示。",
      label: "人気過剰・大穴バイアスを見る",
      nextRefinement:
        "過去回で、公式人気70%超・30%台割れ・大穴側のどこに過剰投票が出るかをバックテストする。",
      sourceLabel: "Favorite-longshot bias literature",
      sourceUrl: favoriteLongshotSourceUrl,
      status: "model",
      whyItMatters:
        "totoは当てるだけでなく、同じ出目を買う人が多いほど払戻が薄くなります。人気の歪みはEVの源泉です。",
    },
    {
      currentUse:
        "候補宇宙に対する距離1以内カバー率を表示。買い目は議論できるように表示し、Hazi側の未共有ロジックは別メモとして扱います。",
      label: "バラ買い2等保証/口数削減",
      nextRefinement:
        "Haziの予想軸で候補宇宙を絞ったうえで、2等カバー100%に近づける最小口数探索を次回実装する。",
      sourceLabel: "totomo / トトバラ",
      sourceUrl: totoBaraSourceUrl,
      status: "research",
      whyItMatters:
        "totoはみんなとズラすゲームなので、出目そのものと、どの面をどれだけカバーしているかを並べると議論しやすい。",
    },
    {
      currentUse:
        "確定結果を固定し、買える時点のモデル/公式人気/最終投票との差分を同じ画面で確認。",
      label: "感想戦で校正する",
      nextRefinement:
        "Brier/log loss、外した理由タグ、Haziメモの反映有無を残し、次回の予想重みを調整する。",
      sourceLabel: "World Toto Lab review loop",
      sourceUrl: null,
      status: "model",
      whyItMatters:
        "単発の当たり外れではなく、モデルが何を過大評価したかを蓄積することで次回の買い方が良くなります。",
    },
  ] satisfies WorldCupPredictionLogicRow[];
}

function buildPostMortemPrompts(primaryPlan: WorldCupPortfolioPlan | null) {
  return [
    "この試合、勝ち/負け/ドローのどれを人間なら削れたか。理由は戦力、日程、モチベ、相性、怪我のどれか。",
    "公式人気が70%を超えた試合で、本当に一本ロックで良かったか。逆張りするなら何が根拠だったか。",
    "30%台で割れた試合は、分散で良かったか。それとも片側に寄せられる材料があったか。",
    "2等カバーを増やすために、1等狙いから外してもよい試合はどれだったか。",
    "締切前スナップショットから最終投票率が動いた試合は、情報だったか、ただの人気流入だったか。",
    primaryPlan
      ? `${primaryPlan.lineCount}口に絞った判断は妥当だったか。余った予算を使うべき根拠があったか。`
      : "プラス候補がない時に見送れるか。買いたい気持ちを抑える条件は何か。",
  ];
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

export function hammingDistance(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let distance = 0;

  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) {
      distance += 1;
    }
  }

  return distance;
}

function deviationCount(picks: WorldCupStrategyPick[], orthodoxPicks: WorldCupStrategyPick[]) {
  const orthodoxByMatchNo = new Map(orthodoxPicks.map((pick) => [pick.matchNo, pick.pick]));
  return picks.filter((pick) => orthodoxByMatchNo.get(pick.matchNo) !== pick.pick).length;
}

function buildTicketDisclosure(input: {
  cashProbability: number;
  deviationCount: number;
  evMultiple: number;
  publicProbability: number;
}) {
  if (input.deviationCount <= 1) {
    return {
      disclosureLabel: "議論用に表示",
      strategyBucket: "王道寄り",
      strategyDetail: "公式人気順に近い。払戻は薄くなりやすいので、EVが残る時だけ採用。",
    };
  }

  if (input.publicProbability <= 0.000001 && input.deviationCount >= 4) {
    return {
      disclosureLabel: "議論用に表示",
      strategyBucket: "ズラし強め",
      strategyDetail: "crowd が薄い側へ寄せる候補。モデル根拠が弱い場合は感想戦で落とす。",
    };
  }

  if (input.cashProbability >= 0.01) {
    return {
      disclosureLabel: "議論用に表示",
      strategyBucket: "2等カバー補助",
      strategyDetail: "1等一本よりも12/13圏内の面を増やすためのバラ買い補助枠。",
    };
  }

  if (input.evMultiple >= 2) {
    return {
      disclosureLabel: "議論用に表示",
      strategyBucket: "高EV薄め",
      strategyDetail: "期待回収は高いが当せん確率は薄い。上限口数を決めて積む候補。",
    };
  }

  return {
    disclosureLabel: "議論用に表示",
    strategyBucket: "分散補助",
    strategyDetail: "上位候補と重ねすぎず、購入額を超える範囲でだけ置く候補。",
  };
}

function outcomeUniverseCount(
  outcomePolicies: readonly { allowedOutcomes: readonly OutcomeValue[] }[],
) {
  return outcomePolicies.reduce((count, policy) => count * policy.allowedOutcomes.length, 1);
}

export function calculateWorldCupSecondPrizeCoverage(input: {
  outcomePolicies: readonly { allowedOutcomes: readonly OutcomeValue[] }[];
  rows: readonly Pick<WorldCupPositiveEvCombo, "signature">[];
  universeLimit?: number;
}): WorldCupSecondPrizeCoverage {
  const universeCount = outcomeUniverseCount(input.outcomePolicies);
  const universeLimit = input.universeLimit ?? coverageUniverseLimit;
  const portfolioSignatures = Array.from(new Set(input.rows.map((row) => row.signature)));

  if (portfolioSignatures.length === 0) {
    return {
      evaluatedUniverseCount: 0,
      exactCoverageRate: 0,
      exactCoveredCount: 0,
      guaranteedSecondPrize: false,
      label: "2等カバー未計算",
      ready: false,
      secondPrizeCoverageRate: 0,
      secondPrizeCoveredCount: 0,
      skippedReason: "購入候補がありません",
      thirdPrizeCoverageRate: 0,
      thirdPrizeCoveredCount: 0,
      uncoveredSecondPrizeCount: universeCount,
      universeCount,
      worstDistanceToPortfolio: null,
    };
  }

  if (universeCount > universeLimit) {
    return {
      evaluatedUniverseCount: 0,
      exactCoverageRate: 0,
      exactCoveredCount: 0,
      guaranteedSecondPrize: false,
      label: "2等カバー未計算",
      ready: false,
      secondPrizeCoverageRate: 0,
      secondPrizeCoveredCount: 0,
      skippedReason: `候補宇宙が大きすぎます (${universeCount.toLocaleString("ja-JP")}通り)`,
      thirdPrizeCoverageRate: 0,
      thirdPrizeCoveredCount: 0,
      uncoveredSecondPrizeCount: universeCount,
      universeCount,
      worstDistanceToPortfolio: null,
    };
  }

  let exactCoveredCount = 0;
  let secondPrizeCoveredCount = 0;
  let thirdPrizeCoveredCount = 0;
  let evaluatedUniverseCount = 0;
  let worstDistanceToPortfolio = 0;
  const current = new Array<OutcomeValue>(input.outcomePolicies.length);

  const visit = (index: number) => {
    if (index === input.outcomePolicies.length) {
      evaluatedUniverseCount += 1;
      const signature = current.join("");
      const distance = Math.min(
        ...portfolioSignatures.map((portfolioSignature) =>
          hammingDistance(signature, portfolioSignature),
        ),
      );

      worstDistanceToPortfolio = Math.max(worstDistanceToPortfolio, distance);

      if (distance === 0) {
        exactCoveredCount += 1;
      }

      if (distance <= 1) {
        secondPrizeCoveredCount += 1;
      }

      if (distance <= 2) {
        thirdPrizeCoveredCount += 1;
      }

      return;
    }

    input.outcomePolicies[index].allowedOutcomes.forEach((outcome) => {
      current[index] = outcome;
      visit(index + 1);
    });
  };

  visit(0);

  const guaranteedSecondPrize = secondPrizeCoveredCount === universeCount;
  const ratio = (count: number) => (universeCount > 0 ? count / universeCount : 0);

  return {
    evaluatedUniverseCount,
    exactCoverageRate: ratio(exactCoveredCount),
    exactCoveredCount,
    guaranteedSecondPrize,
    label: guaranteedSecondPrize ? "候補宇宙内2等保証" : "2等カバー率",
    ready: true,
    secondPrizeCoverageRate: ratio(secondPrizeCoveredCount),
    secondPrizeCoveredCount,
    skippedReason: null,
    thirdPrizeCoverageRate: ratio(thirdPrizeCoveredCount),
    thirdPrizeCoveredCount,
    uncoveredSecondPrizeCount: Math.max(0, universeCount - secondPrizeCoveredCount),
    universeCount,
    worstDistanceToPortfolio,
  };
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
  const prizeTiers = calculateTotoPrizeTierEvs({
    assumption: input.assumption,
    selectedModelProbabilities,
    selectedOfficialProbabilities,
    tiers: totoPrizeTiersForMatchCount(input.matches.length),
  });
  const totalExpectedReturn = sumTotoPrizeTierExpectedReturn(prizeTiers);
  const cashProbability = sumTotoPrizeTierHitProbability(prizeTiers);
  const totalMultiple = totalEvMultiple(totalExpectedReturn, input.assumption);

  return {
    cashProbability,
    deviationCount: deviationCount(input.picks, input.orthodoxPicks),
    estimatedPayoutYen: ev.estimatedPayoutYen,
    evMultiple: totalMultiple ?? ev.evMultiple,
    expectedReturnYen: totalExpectedReturn ?? ev.grossEvYen,
    firstPrizeEvMultiple: ev.evMultiple,
    firstPrizeExpectedReturnYen: ev.grossEvYen,
    hitProbability: ev.pModelCombo,
    key: input.key,
    label: input.label,
    picks: input.picks,
    prizeTiers,
    publicProbability: ev.pPublicCombo,
    strictEvReady: prizeTiers.every((tier) => tier.strictAvailable),
    totalEvMultiple: totalMultiple,
    totalExpectedReturnYen: totalExpectedReturn,
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
  outcomePolicies?: WorldCupOutcomePolicy[];
}): WorldCupPositiveEvResult {
  const limit = Math.max(1, input.limit ?? 120);
  const matches = sortedMatches(input.matches);
  const policyByMatchNo = new Map((input.outcomePolicies ?? []).map((policy) => [policy.matchNo, policy]));
  const orthodoxPicks =
    input.orthodoxPicks ??
    matches.map((match) => ({
      matchNo: match.matchNo,
      pick: orthodoxPick(match),
    }));
  const options = matches.map((match) => {
    const allowed = policyByMatchNo.get(match.matchNo)?.allowedOutcomes ?? OUTCOME_VALUES;

    return allowed.map((outcome) => ({
      matchNo: match.matchNo,
      modelProbability: getProbability(match, "model", outcome),
      officialProbability: getProbability(match, "official", outcome),
      outcome,
    }));
  });
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
  const currentModelProbabilities = new Array<number | null>(matches.length);
  const currentOfficialProbabilities = new Array<number | null>(matches.length);
  const topRows: WorldCupPositiveEvCombo[] = [];
  let evaluatedCount = 0;
  let totalPositiveCount = 0;
  const prizeTiers = totoPrizeTiersForMatchCount(matches.length);

  const visit = (
    index: number,
    hitProbability: number,
    publicProbability: number,
    modelMissHitRatioSum: number,
    modelMissHitRatioSquareSum: number,
    publicMissHitRatioSum: number,
    publicMissHitRatioSquareSum: number,
    momentsReady: boolean,
  ) => {
    if (index === matches.length) {
      evaluatedCount += 1;

      const estimatedPayoutYen = calculateEstimatedPayout({
        assumption,
        pPublicCombo: publicProbability,
      });

      if (!isKnownNumber(estimatedPayoutYen)) {
        return;
      }

      const firstPrizeExpectedReturnYen = hitProbability * estimatedPayoutYen;
      const firstPrizeEvMultiple = firstPrizeExpectedReturnYen / assumption.stakeYen;
      const tierEvs = momentsReady
        ? buildPrizeTiersFromMoments({
            assumption,
            modelHitProbability: hitProbability,
            modelMissHitRatioSquareSum,
            modelMissHitRatioSum,
            publicHitProbability: publicProbability,
            publicMissHitRatioSquareSum,
            publicMissHitRatioSum,
            tiers: prizeTiers,
          })
        : calculateTotoPrizeTierEvs({
            assumption,
            selectedModelProbabilities: currentModelProbabilities,
            selectedOfficialProbabilities: currentOfficialProbabilities,
            tiers: prizeTiers,
          });
      const totalExpectedReturnYen = sumTotoPrizeTierExpectedReturn(tierEvs);
      const cashProbability = sumTotoPrizeTierHitProbability(tierEvs);
      const expectedReturnYen = totalExpectedReturnYen ?? firstPrizeExpectedReturnYen;
      const evMultiple = expectedReturnYen / assumption.stakeYen;

      if (evMultiple <= 1) {
        return;
      }

      const picks = currentPicks.map((pick) => ({ ...pick }));
      const nextDeviationCount = deviationCount(picks, orthodoxPicks);
      const signature = lineSignature(picks);
      const disclosure = buildTicketDisclosure({
        cashProbability: cashProbability ?? hitProbability,
        deviationCount: nextDeviationCount,
        evMultiple,
        publicProbability,
      });

      totalPositiveCount += 1;
      insertTopCombo(
        topRows,
        {
          cashProbability: cashProbability ?? hitProbability,
          deviationCount: nextDeviationCount,
          disclosureLabel: disclosure.disclosureLabel,
          estimatedPayoutYen,
          evMultiple,
          expectedReturnYen,
          firstPrizeEvMultiple,
          firstPrizeExpectedReturnYen,
          hitProbability,
          picks,
          prizeTiers: tierEvs,
          publicProbability,
          signature,
          strategyBucket: disclosure.strategyBucket,
          strategyDetail: disclosure.strategyDetail,
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
      currentModelProbabilities[index] = option.modelProbability;
      currentOfficialProbabilities[index] = option.officialProbability;
      const modelProbability = option.modelProbability ?? 0;
      const officialProbability = option.officialProbability ?? 0;
      const modelRatio = modelProbability > 0 ? (1 - modelProbability) / modelProbability : 0;
      const publicRatio = officialProbability > 0 ? (1 - officialProbability) / officialProbability : 0;

      visit(
        index + 1,
        hitProbability * modelProbability,
        publicProbability * officialProbability,
        modelMissHitRatioSum + modelRatio,
        modelMissHitRatioSquareSum + modelRatio * modelRatio,
        publicMissHitRatioSum + publicRatio,
        publicMissHitRatioSquareSum + publicRatio * publicRatio,
        momentsReady && modelProbability > 0 && officialProbability > 0,
      );
    });
  };

  visit(0, 1, 1, 0, 0, 0, 0, true);

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
  outcomePolicies: WorldCupOutcomePolicy[],
  rows: WorldCupPositiveEvCombo[],
  stakeYen: number,
): WorldCupPortfolioPlan | null {
  const requestedLineCount = Math.max(1, Math.floor(budgetYen / stakeYen));
  const selectedRows = rows.slice(0, requestedLineCount);

  if (selectedRows.length === 0) {
    return null;
  }

  const expectedReturnYen = selectedRows.reduce((sum, row) => sum + row.expectedReturnYen, 0);
  const firstPrizeExpectedReturnYen = selectedRows.reduce(
    (sum, row) => sum + row.firstPrizeExpectedReturnYen,
    0,
  );
  const costYen = selectedRows.length * stakeYen;
  const hitProbabilityUpperBound = Math.min(
    1,
    selectedRows.reduce((sum, row) => sum + row.hitProbability, 0),
  );
  const cashProbabilityUpperBound = Math.min(
    1,
    selectedRows.reduce((sum, row) => sum + row.cashProbability, 0),
  );
  const payouts = selectedRows.map((row) => row.estimatedPayoutYen);
  const secondPrizeCoverage = calculateWorldCupSecondPrizeCoverage({
    outcomePolicies,
    rows: selectedRows,
  });

  return {
    budgetYen,
    cashProbabilityUpperBound,
    costYen,
    description,
    evMultiple: expectedReturnYen / costYen,
    expectedProfitYen: expectedReturnYen - costYen,
    expectedReturnYen,
    firstPrizeExpectedReturnYen,
    hitProbabilityUpperBound,
    label,
    lineCount: selectedRows.length,
    maxPayoutIfHitYen: Math.max(...payouts),
    meetsBudget: expectedReturnYen >= costYen,
    minPayoutIfHitYen: Math.min(...payouts),
    requestedLineCount,
    rows: selectedRows,
    secondPrizeCoverage,
    stakeYen,
    unallocatedBudgetYen: Math.max(0, budgetYen - costYen),
  };
}

function buildPortfolioPlans(
  positiveEv: WorldCupPositiveEvResult,
  outcomePolicies: WorldCupOutcomePolicy[],
  stakeYen: number,
) {
  if (!positiveEv.ready || positiveEv.rows.length === 0) {
    return [];
  }

  return worldCupPortfolioBudgets
    .map((plan) =>
      buildPortfolioPlan(
        plan.label,
        plan.description,
        plan.budgetYen,
        outcomePolicies,
        positiveEv.rows,
        stakeYen,
      ),
    )
    .filter((plan): plan is WorldCupPortfolioPlan => Boolean(plan));
}

function buildComparisonRow(input: {
  baselineEvMultiple: number | null;
  costYen: number | null;
  evMultiple: number | null;
  expectedReturnYen: number | null;
  key: WorldCupMarketEvComparisonKey;
  label: string;
  method: string;
  sourceLabel: string;
  sourceUrl: string | null;
  status: WorldCupSourceStatus;
  verdict: string;
}): WorldCupMarketEvComparisonRow {
  return {
    costYen: input.costYen,
    evLiftMultiple:
      input.evMultiple !== null && input.baselineEvMultiple !== null
        ? input.evMultiple - input.baselineEvMultiple
        : null,
    evMultiple: input.evMultiple,
    expectedProfitYen:
      input.expectedReturnYen !== null && input.costYen !== null
        ? input.expectedReturnYen - input.costYen
        : null,
    expectedReturnYen: input.expectedReturnYen,
    key: input.key,
    label: input.label,
    method: input.method,
    sourceLabel: input.sourceLabel,
    sourceUrl: input.sourceUrl,
    status: input.status,
    verdict: input.verdict,
  };
}

function buildMarketEvComparisonRows(input: {
  evAssumption: RoundEvAssumption | null;
  orthodoxLine: WorldCupStrategyLine | null;
  positiveEv: WorldCupPositiveEvResult;
  primaryPlan: WorldCupPortfolioPlan | null;
  stakeYen: number;
}): WorldCupMarketEvComparisonRow[] {
  const baselineEvMultiple = input.evAssumption?.returnRate ?? null;
  const randomExpectedReturnYen =
    baselineEvMultiple !== null ? input.stakeYen * baselineEvMultiple : null;
  const topProxy = input.positiveEv.rows[0] ?? null;
  const orthodoxEvMultiple = input.orthodoxLine?.evMultiple ?? null;

  return [
    buildComparisonRow({
      baselineEvMultiple,
      costYen: input.stakeYen,
      evMultiple: baselineEvMultiple,
      expectedReturnYen: randomExpectedReturnYen,
      key: "random_baseline",
      label: "総当たり/ランダム基準",
      method:
        "情報を使わず全出目を等しく見る基準線。totoの払戻原資は売上の50%なので、キャリーなしなら平均回収は約0.50倍です。",
      sourceLabel: "toto official rules",
      sourceUrl: officialTotoRuleUrl,
      status: baselineEvMultiple !== null ? "fixed" : "missing",
      verdict: "ここを上回らないなら、予測で買い目を絞る意味は薄いです。",
    }),
    buildComparisonRow({
      baselineEvMultiple,
      costYen: input.orthodoxLine ? input.stakeYen : null,
      evMultiple: orthodoxEvMultiple,
      expectedReturnYen: input.orthodoxLine?.expectedReturnYen ?? null,
      key: "public_favorite",
      label: "公式人気ど真ん中",
      method:
        "各試合で公式投票率が一番高い出目を選ぶ買い方。的中感はありますが、同じ出目の人が多く払戻が薄くなりやすいです。",
      sourceLabel: "official vote share",
      sourceUrl: null,
      status: input.orthodoxLine ? "model" : "missing",
      verdict:
        orthodoxEvMultiple !== null && orthodoxEvMultiple >= 1
          ? "王道でも購入額を上回る試算です。外さず比較対象に残します。"
          : "王道だけを厚く買うより、crowdとズレる出目を探す余地があります。",
    }),
    buildComparisonRow({
      baselineEvMultiple,
      costYen: topProxy ? input.stakeYen : null,
      evMultiple: topProxy?.evMultiple ?? null,
      expectedReturnYen: topProxy?.expectedReturnYen ?? null,
      key: "market_proxy_top",
      label: "予測市場proxy 上位1口",
      method:
        "p_modelをチーム強度/モデル側、p_publicを公式投票率として分離し、p_model > p_publicになりやすい出目をEV順で拾います。",
      sourceLabel: "market proxy",
      sourceUrl: sportsForecastingSourceUrl,
      status: topProxy ? "research" : "missing",
      verdict:
        topProxy && baselineEvMultiple !== null && topProxy.evMultiple > baselineEvMultiple
          ? "理論上はランダム基準より上がっています。ただし実オッズ未接続なのでproxy扱いです。"
          : "現時点のproxyでは、ランダム基準を明確に上回る上位口を確認できていません。",
    }),
    buildComparisonRow({
      baselineEvMultiple,
      costYen: input.primaryPlan?.costYen ?? null,
      evMultiple: input.primaryPlan?.evMultiple ?? null,
      expectedReturnYen: input.primaryPlan?.expectedReturnYen ?? null,
      key: "market_proxy_portfolio",
      label: "proxy EVポートフォリオ",
      method:
        "上位EV候補を1口ずつバラで並べ、2等/3等の期待回収も足します。厚張りは範囲を広げないので別管理です。",
      sourceLabel: "World Toto Lab",
      sourceUrl: null,
      status: input.primaryPlan ? "model" : "missing",
      verdict:
        input.primaryPlan && input.primaryPlan.evMultiple >= 1
          ? "購入額を上回る試算です。実オッズやHazi補正でp_modelを検証する価値があります。"
          : "ポートフォリオ全体ではまだ購入額超えを断言しません。議論用の候補として扱います。",
    }),
  ];
}

function buildMarketEvVerdict(rows: WorldCupMarketEvComparisonRow[]) {
  const baseline = rows.find((row) => row.key === "random_baseline")?.evMultiple ?? null;
  const best = rows
    .filter((row) => row.key !== "random_baseline" && row.evMultiple !== null)
    .sort((left, right) => (right.evMultiple ?? -Infinity) - (left.evMultiple ?? -Infinity))[0];

  if (!best || baseline === null || best.evMultiple === null) {
    return "予測市場EVはまだ比較材料が足りません。公式投票率、売上、モデル確率が揃った時だけ判断します。";
  }

  if (best.evMultiple > baseline) {
    return `${best.label} はランダム基準 ${baseline.toFixed(2)}倍を上回る ${best.evMultiple.toFixed(
      2,
    )}倍です。理論上は出目選定でEVが上がっていますが、実オッズ未接続のためmarket proxyとして読みます。`;
  }

  return `現時点のproxyでは、ランダム基準 ${baseline.toFixed(
    2,
  )}倍を明確に上回っていません。p_modelの質を上げるまで、買い目を広げすぎない判断です。`;
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

function buildTimingChecklist(input: {
  featured: FeaturedRound;
  now: Date;
  status: WorldCupRoundWindowStatus;
}): WorldCupTimingChecklistItem[] {
  const salesEndAt = new Date(input.featured.salesEndAt);
  const minutesToClose = minutesBetween(input.now, salesEndAt);
  const activeIndex =
    input.status === "closed"
      ? 4
      : input.status === "upcoming"
        ? -1
        : minutesToClose > 240
          ? 0
          : minutesToClose > 60
            ? 0
            : minutesToClose > 30
              ? 1
              : minutesToClose > 10
                ? 2
                : 3;

  return [
    {
      actionLabel: "公式売上・投票率を再取得",
      enabled: activeIndex === 0,
      label: "データを厚くする",
      timingLabel: "締切4時間前まで",
    },
    {
      actionLabel: "EVを再計算",
      enabled: activeIndex === 1,
      label: "ズレを確認",
      timingLabel: "締切1時間前",
    },
    {
      actionLabel: "1万円/10口プランを確認",
      enabled: activeIndex === 2,
      label: "買い方を固定",
      timingLabel: "締切30分前",
    },
    {
      actionLabel: "買うなら最終判断",
      enabled: activeIndex === 3,
      label: "購入直前",
      timingLabel: "締切10分前",
    },
    {
      actionLabel: "確定値で感想戦",
      enabled: activeIndex === 4,
      label: "ナレッジ化",
      timingLabel: "締切後",
    },
  ];
}

function buildOrthodoxDecision(line: WorldCupStrategyLine | null) {
  if (!line?.strictEvReady || line.evMultiple === null || line.expectedReturnYen === null) {
    return {
      detail: "売上・公式投票率・モデル確率が揃うまで、公式人気順を買う/外す判断は保留します。",
      label: "王道EV待ち",
    };
  }

  if (line.evMultiple < 1) {
    return {
      detail: `公式人気順は1口あたり期待回収 ${Math.round(line.expectedReturnYen).toLocaleString("ja-JP")}円、EV ${line.evMultiple.toFixed(2)}倍です。購入額を下回るため、今回は王道だけを厚く買うより、期待回収順の候補へずらす判断です。`,
      label: "王道は外す候補",
    };
  }

  return {
    detail: `公式人気順でも1口あたり期待回収 ${Math.round(line.expectedReturnYen).toLocaleString("ja-JP")}円、EV ${line.evMultiple.toFixed(2)}倍です。候補から外さず、他の期待回収候補と比較します。`,
    label: "王道も検討可",
  };
}

function buildCommandStatus(input: {
  finalSnapshot: WorldCupFinalSnapshotSummary | null;
  missingReasons: string[];
  primaryPlan: WorldCupPortfolioPlan | null;
  status: WorldCupRoundWindowStatus;
}) {
  if (input.status === "closed") {
    if (input.finalSnapshot) {
      return {
        commandStatusLabel: "締切後の感想戦",
        recommendedActionDetail:
          "もう買えない回です。確定売上・確定投票率で、王道EV、買い方候補、保存時点からのズレを振り返ります。",
        recommendedActionLabel: "確定値で感想戦",
      };
    }

    return {
      commandStatusLabel: "締切後・確定値待ち",
      recommendedActionDetail:
        "販売は終了しています。公式の投票結果ページから最終売上と最終投票率を保存すると、感想戦に使えます。",
      recommendedActionLabel: "最終公式データを保存",
    };
  }

  if (input.status === "upcoming") {
    return {
      commandStatusLabel: "発売前",
      recommendedActionDetail:
        "発売後に公式投票率と売上が出てから、王道EVと1万円ポートフォリオを計算します。",
      recommendedActionLabel: "発売後に公式データ取得",
    };
  }

  if (input.missingReasons.length > 0) {
    return {
      commandStatusLabel: "買える・データ待ち",
      recommendedActionDetail: `${input.missingReasons.join(" / ")}。締切に近いほど購入データが揃うため、公式データを再取得してからEVを見ます。`,
      recommendedActionLabel: "公式データを再取得",
    };
  }

  if (input.primaryPlan?.meetsBudget) {
    return {
      commandStatusLabel: "買える・候補あり",
      recommendedActionDetail: `1万円プランは期待回収 ${Math.round(input.primaryPlan.expectedReturnYen).toLocaleString("ja-JP")}円です。買うなら上位${input.primaryPlan.lineCount}通りを1口ずつ置きます。`,
      recommendedActionLabel: "買い方を最終確認",
    };
  }

  return {
    commandStatusLabel: "買える・見送り候補",
    recommendedActionDetail:
      "厳密EVは計算できますが、購入額を上回る候補が弱い状態です。無理に買わず、次の公式データ更新を待ちます。",
    recommendedActionLabel: "見送り/再取得",
  };
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
    applyKnownActualResultsToMatches(
      applyFinalSnapshotToMatches(sourceMatches, finalSnapshot, input.featured, status),
      input.featured,
      status,
    ),
  );
  const matchCount = matches.length || input.round?.matchCount || input.featured.matches.length;
  const outcomePolicies = buildOutcomePolicies(matches);
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
          outcomePolicies,
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
          outcomePolicies,
        });
  const portfolioPlans = buildPortfolioPlans(portfolioPositiveEv, outcomePolicies, stakeYen);
  const drift = buildDriftText({
    finalSnapshot,
    featured: input.featured,
    status,
  });
  const usingFeaturedFallback = !input.round && matches.length > 0;
  const orthodoxLine = lines.find((line) => line.key === "orthodox") ?? null;
  const primaryPortfolioPlan = primaryPlanFrom(portfolioPlans);
  const marketEvComparisonRows = buildMarketEvComparisonRows({
    evAssumption,
    orthodoxLine,
    positiveEv: portfolioPositiveEv,
    primaryPlan: primaryPortfolioPlan,
    stakeYen,
  });
  const orthodoxDecision = buildOrthodoxDecision(orthodoxLine);
  const commandStatus = buildCommandStatus({
    finalSnapshot,
    missingReasons,
    primaryPlan: primaryPortfolioPlan,
    status,
  });
  const evSourceRows = buildEvSourceRows({
    evAssumption,
    featured: input.featured,
    finalSnapshot,
    matches,
    modelReadyCount,
    primaryPlan: primaryPortfolioPlan,
    usingFeaturedFallback,
  });
  const predictionLogicRows = buildPredictionLogicRows({
    matches,
    usingFeaturedFallback,
  });

  return {
    calculationSourceLabel: input.round
      ? "保存済みRound + 公式投票率"
      : "内蔵W杯プリセット + 公式投票率",
    candidateTicketCount: input.round?.candidateTicketCount ?? 0,
    commandStatusLabel: commandStatus.commandStatusLabel,
    driftDetail: drift.detail,
    driftLabel: drift.label,
    evAssumption,
    evSourceRows,
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
    marketEvComparisonRows,
    marketEvVerdict: buildMarketEvVerdict(marketEvComparisonRows),
    matchCount,
    modelReadyCount,
    officialReadyCount,
    orthodoxDecisionDetail: orthodoxDecision.detail,
    orthodoxDecisionLabel: orthodoxDecision.label,
    orthodoxLine,
    outcomePolicies,
    portfolioPlans,
    positiveEv,
    postMortemPrompts: buildPostMortemPrompts(primaryPortfolioPlan),
    predictionLogicRows,
    primaryPortfolioPlan,
    recommendedActionDetail: commandStatus.recommendedActionDetail,
    recommendedActionLabel: commandStatus.recommendedActionLabel,
    roundId: input.round?.id ?? null,
    roundTitle: input.round?.title ?? input.featured.title,
    snapshotGapToCloseLabel: drift.snapshotGapToCloseLabel,
    snapshotLabel: featuredWorldTotoSnapshotLabel,
    stakeYen,
    strictEvMissingReasons: missingReasons,
    strictEvReady: missingReasons.length === 0,
    timingChecklist: buildTimingChecklist({
      featured: input.featured,
      now: input.now,
      status,
    }),
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
