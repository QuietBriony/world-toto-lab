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
import type { DashboardRoundSummary, Match, RoundEvAssumption } from "@/lib/types";

const featuredSnapshotCapturedAt = "2026-06-07T08:56:00+09:00";
const valueLineSpotCount = 4;

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
  costYen: number;
  description: string;
  expectedReturnYen: number;
  evMultiple: number;
  hitProbabilityUpperBound: number;
  label: string;
  lineCount: number;
  rows: WorldCupPositiveEvCombo[];
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
  roundId: string | null;
  roundTitle: string;
  snapshotGapToCloseLabel: string;
  snapshotLabel: string;
  strictEvMissingReasons: string[];
  strictEvReady: boolean;
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

function isKnownNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

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

function buildFeaturedEvAssumption(featured: FeaturedRound, roundId: string | null): RoundEvAssumption | null {
  if (!isKnownNumber(featured.totalSalesYen)) {
    return null;
  }

  return {
    carryoverYen: 0,
    createdAt: featuredSnapshotCapturedAt,
    firstPrizeShare: 0.7,
    id: `world-cup-featured-${featured.roundNumber}`,
    note: `W杯toto 第${featured.roundNumber}回プリセットの売上・還元率から作った締切EV試算用前提。購入や精算は扱いません。`,
    payoutCapYen: null,
    returnRate: 0.5,
    roundId: roundId ?? `featured-world-toto-${featured.roundNumber}`,
    stakeYen: 100,
    totalSalesYen: featured.totalSalesYen,
    updatedAt: featuredSnapshotCapturedAt,
  };
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
        ? favoriteOutcomeForBucket({
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
          }, "official") ?? finalFav
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

export function resolveFeaturedWorldTotoRoundNumber(input: {
  sourceNote: string | null;
  title: string;
}) {
  const matched = `${input.title} ${input.sourceNote ?? ""}`.match(/第(163[4-7])回/);
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
  round: DashboardRoundSummary | null;
}) {
  const reasons: string[] = [];

  if (!input.round) {
    reasons.push("W杯toto回が未作成");
  }

  if (input.matchCount < 13) {
    reasons.push("13試合が未作成");
  }

  if (!isKnownNumber(input.assumption?.totalSalesYen)) {
    reasons.push("売上総額が未公表");
  }

  if (input.officialReadyCount < input.matchCount || input.matchCount === 0) {
    reasons.push("公式人気が未公表");
  }

  if (input.modelReadyCount < input.matchCount || input.matchCount === 0) {
    reasons.push("モデル確率が未作成");
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
  const limit = Math.max(1, input.limit ?? 80);
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
  rows: WorldCupPositiveEvCombo[],
  stakeYen: number,
): WorldCupPortfolioPlan | null {
  if (rows.length === 0) {
    return null;
  }

  const expectedReturnYen = rows.reduce((sum, row) => sum + row.expectedReturnYen, 0);
  const costYen = rows.length * stakeYen;
  const hitProbabilityUpperBound = Math.min(
    1,
    rows.reduce((sum, row) => sum + row.hitProbability, 0),
  );

  return {
    costYen,
    description,
    evMultiple: expectedReturnYen / costYen,
    expectedReturnYen,
    hitProbabilityUpperBound,
    label,
    lineCount: rows.length,
    rows,
  };
}

function buildPortfolioPlans(positiveEv: WorldCupPositiveEvResult, stakeYen: number) {
  if (!positiveEv.ready || positiveEv.rows.length === 0) {
    return [];
  }

  return [
    buildPortfolioPlan(
      "最小EV",
      "100円だけ買うなら、厳密EV上位の1口に寄せる。",
      positiveEv.rows.slice(0, 1),
      stakeYen,
    ),
    buildPortfolioPlan(
      "標準EV",
      "買える直前の情報で、上位5口までを等金額で持つ。",
      positiveEv.rows.slice(0, 5),
      stakeYen,
    ),
    buildPortfolioPlan(
      "分散EV",
      "上位10口まで広げ、王道からのズレを許容して期待値を取りに行く。",
      positiveEv.rows.slice(0, 10),
      stakeYen,
    ),
  ].filter((plan): plan is WorldCupPortfolioPlan => Boolean(plan));
}

function buildDriftText(input: {
  finalSnapshot: WorldCupFinalSnapshotSummary | null;
  featured: FeaturedRound;
  status: WorldCupRoundWindowStatus;
}) {
  const snapshotAt = new Date(featuredSnapshotCapturedAt);
  const closedAt = new Date(input.featured.salesEndAt);
  const gapMinutes = minutesBetween(snapshotAt, closedAt);
  const gapLabel = `保存済みスナップショットから締切まで${formatDuration(gapMinutes)}`;

  if (input.status === "closed") {
    if (input.finalSnapshot) {
      return {
        detail:
          "公式投票結果ページで販売終了時点の投票率・売上を取得できます。今はアプリ内の履歴保存までは未接続ですが、初期スナップショットとの二点差分はこの画面で確認できます。",
        label: "確定値取得可",
        snapshotGapToCloseLabel: gapLabel,
      };
    }

    return {
      detail:
        "締切後の最終公式人気・売上スナップショットはまだ保存されていないため、保存時点との差分は未確定です。最終値を取り込むと、人気率と売上のズレを試合別に出せます。",
      label: "最終差分は未保存",
      snapshotGapToCloseLabel: gapLabel,
    };
  }

  if (input.status === "selling") {
    return {
      detail:
        "まだ買える時間帯なので、締切直前に公式人気と売上を再取り込みすると、この画面のEV候補を買える時点の最終近似として更新できます。",
      label: "締切直前の再取得待ち",
      snapshotGapToCloseLabel: gapLabel,
    };
  }

  return {
    detail:
      "発売前のため、公式人気と売上が揃ってからEVの精度が上がります。販売開始後、締切直前の再取り込みを基準に比較します。",
    label: "発売前",
    snapshotGapToCloseLabel: gapLabel,
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
  const matches = input.round ? sortedMatches(input.round.matches) : [];
  const matchCount = input.round?.matchCount ?? input.featured.matches.length;
  const officialReadyCount = matches.filter((match) => hasCompleteBucket(match, "official")).length;
  const modelReadyCount = matches.filter((match) => hasCompleteBucket(match, "model")).length;
  const evAssumption = buildFeaturedEvAssumption(input.featured, input.round?.id ?? null);
  const finalSnapshot = buildFinalSnapshotSummary(input.featured);
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
            label: "王道",
            matches,
            orthodoxPicks,
            picks: orthodoxPicks,
          }),
          buildLine({
            assumption: evAssumption,
            key: "value",
            label: "期待値",
            matches,
            orthodoxPicks,
            picks: buildValuePicks(matches, orthodoxPicks),
          }),
          buildLine({
            assumption: evAssumption,
            key: "ai",
            label: "AI",
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
    round: input.round,
  });
  const positiveEv =
    input.includePositiveCombos && missingReasons.length === 0
      ? enumeratePositiveEvCombos({
          assumption: evAssumption,
          limit: input.positiveComboLimit,
          matches,
          orthodoxPicks,
        })
      : {
          evaluatedCount: null,
          ready: missingReasons.length === 0,
          rows: [],
          totalPositiveCount: null,
          truncated: false,
        };
  const drift = buildDriftText({
    finalSnapshot,
    featured: input.featured,
    status,
  });

  return {
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
    portfolioPlans: buildPortfolioPlans(positiveEv, evAssumption?.stakeYen ?? 100),
    positiveEv,
    roundId: input.round?.id ?? null,
    roundTitle: input.round?.title ?? input.featured.title,
    snapshotGapToCloseLabel: drift.snapshotGapToCloseLabel,
    snapshotLabel: featuredWorldTotoSnapshotLabel,
    strictEvMissingReasons: missingReasons,
    strictEvReady: missingReasons.length === 0,
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
  const positiveComboLimit = input.positiveComboLimit ?? 80;
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
  const positiveCounts = rounds.map((round) => round.positiveEv.totalPositiveCount);
  const knownPositiveCounts = positiveCounts.filter(isKnownNumber);

  return {
    buyableCount: rounds.filter((round) => round.windowStatus === "selling").length,
    closedCount: rounds.filter((round) => round.windowStatus === "closed").length,
    createdCount: rounds.filter((round) => round.isCreated).length,
    positiveEvComboCount:
      knownPositiveCounts.length === positiveCounts.length
        ? knownPositiveCounts.reduce((sum, count) => sum + count, 0)
        : null,
    rounds,
    snapshotLabel: featuredWorldTotoSnapshotLabel,
    strictReadyCount: rounds.filter((round) => round.strictEvReady).length,
  };
}
