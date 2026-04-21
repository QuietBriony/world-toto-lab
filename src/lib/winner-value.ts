import type {
  Match,
  OutcomeEdge,
  ProductType,
  RoundEvAssumption,
  TotoOfficialRound,
} from "@/lib/types";

type WinnerLikeRoundInput = {
  activeMatchCount?: number | null;
  matchCount: number;
  productType: ProductType;
  requiredMatchCount?: number | null;
};

export function isWinnerLikeRound(input: WinnerLikeRoundInput) {
  return (
    input.productType === "winner" ||
    input.activeMatchCount === 1 ||
    input.requiredMatchCount === 1 ||
    input.matchCount === 1
  );
}

export function winnerReasonLabel(reason: string) {
  if (reason === "edge>=0.08") {
    return "エッジ候補";
  }

  if (reason === "valueRatio>=1.35") {
    return "倍率差";
  }

  if (reason === "public<=0.25") {
    return "人気薄";
  }

  if (reason === "draw_alert") {
    return "引分警報";
  }

  if (reason === "popular_overweight") {
    return "人気過多";
  }

  return reason;
}

export function winnerOutcomeLabel(
  outcome: OutcomeEdge["outcome"],
  input: Pick<Match, "awayTeam" | "homeTeam">,
) {
  if (outcome === "1") {
    return `1 ${input.homeTeam}`;
  }

  if (outcome === "0") {
    return "0 引分";
  }

  return `2 ${input.awayTeam}`;
}

export function scoreWinnerOutcomeEdge(edge: OutcomeEdge) {
  const popularPenalty = edge.reasons.includes("popular_overweight") ? 0.8 : 0;
  const drawLift = edge.outcome === "0" && edge.reasons.includes("draw_alert") ? 0.15 : 0;

  return (edge.edge ?? 0) * 10 + (edge.valueRatio ?? 1) + drawLift - popularPenalty;
}

export function sortWinnerOutcomeEdges(edges: OutcomeEdge[]) {
  return [...edges].sort((left, right) => {
    const leftScore = scoreWinnerOutcomeEdge(left);
    const rightScore = scoreWinnerOutcomeEdge(right);

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    if ((right.modelProb ?? 0) !== (left.modelProb ?? 0)) {
      return (right.modelProb ?? 0) - (left.modelProb ?? 0);
    }

    return left.outcome.localeCompare(right.outcome);
  });
}

export function summarizeWinnerOutcomeEdges(edges: OutcomeEdge[]) {
  const edgeCandidateCount = edges.filter((edge) =>
    edge.reasons.some((reason) => reason !== "popular_overweight"),
  ).length;
  const popularOverweightCount = edges.filter((edge) =>
    edge.reasons.includes("popular_overweight"),
  ).length;
  const bestValueRatio = edges.reduce<number | null>((best, edge) => {
    if (edge.valueRatio === null) {
      return best;
    }

    if (best === null || edge.valueRatio > best) {
      return edge.valueRatio;
    }

    return best;
  }, null);

  return {
    bestValueRatio,
    edgeCandidateCount,
    popularOverweightCount,
    topEdge: sortWinnerOutcomeEdges(edges)[0] ?? null,
  };
}

type WinnerSnapshotSourceKind = "analysis" | "official" | "none";

export type WinnerOfficialSnapshot = {
  carryoverYen: number | null;
  estimatedPoolYen: number | null;
  firstPrizeShare: number | null;
  hasAnalysisOverride: boolean;
  officialFavorite: OutcomeEdge | null;
  officialRoundName: string | null;
  officialRoundNumber: number | null;
  salesEndAt: string | null;
  sourceKind: WinnerSnapshotSourceKind;
  stakeYen: number | null;
  topValueEdge: OutcomeEdge | null;
  totalSalesYen: number | null;
};

function isKnownNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasMeaningfulEvAssumption(assumption: RoundEvAssumption | null) {
  if (!assumption) {
    return false;
  }

  return (
    assumption.totalSalesYen !== null ||
    Boolean(assumption.note?.trim()) ||
    assumption.carryoverYen !== 0 ||
    assumption.returnRate !== 0.5 ||
    assumption.firstPrizeShare !== 0.7 ||
    assumption.stakeYen !== 100 ||
    assumption.payoutCapYen !== null
  );
}

export function buildWinnerOfficialSnapshot(input: {
  activeEdges: OutcomeEdge[];
  evAssumption: RoundEvAssumption | null;
  officialRound: TotoOfficialRound | null;
}): WinnerOfficialSnapshot {
  const sortedEdges = sortWinnerOutcomeEdges(input.activeEdges);
  const officialFavorite = input.activeEdges.reduce<OutcomeEdge | null>((best, edge) => {
    if (!isKnownNumber(edge.officialVote)) {
      return best;
    }

    if (!best || !isKnownNumber(best.officialVote) || edge.officialVote > best.officialVote) {
      return edge;
    }

    return best;
  }, null);
  const topValueEdge =
    sortedEdges.find((edge) => edge.reasons.some((reason) => reason !== "popular_overweight")) ??
    sortedEdges[0] ??
    null;
  const hasAnalysisOverride = hasMeaningfulEvAssumption(input.evAssumption);
  const sourceKind: WinnerSnapshotSourceKind = hasAnalysisOverride
    ? "analysis"
    : input.officialRound
      ? "official"
      : "none";
  const totalSalesYen = hasAnalysisOverride
    ? input.evAssumption?.totalSalesYen ?? null
    : input.officialRound?.totalSalesYen ?? null;
  const carryoverYen = hasAnalysisOverride
    ? input.evAssumption?.carryoverYen ?? null
    : input.officialRound?.carryoverYen ?? null;
  const firstPrizeShare = hasAnalysisOverride
    ? input.evAssumption?.firstPrizeShare ?? null
    : input.officialRound?.firstPrizeShare ?? null;
  const returnRate = hasAnalysisOverride
    ? input.evAssumption?.returnRate ?? null
    : input.officialRound?.returnRate ?? null;
  const estimatedPoolYen =
    isKnownNumber(totalSalesYen) &&
    isKnownNumber(carryoverYen) &&
    isKnownNumber(firstPrizeShare) &&
    isKnownNumber(returnRate)
      ? totalSalesYen * returnRate * firstPrizeShare + carryoverYen
      : null;

  return {
    carryoverYen,
    estimatedPoolYen,
    firstPrizeShare,
    hasAnalysisOverride,
    officialFavorite,
    officialRoundName: input.officialRound?.officialRoundName ?? null,
    officialRoundNumber: input.officialRound?.officialRoundNumber ?? null,
    salesEndAt: input.officialRound?.salesEndAt ?? null,
    sourceKind,
    stakeYen: hasAnalysisOverride
      ? input.evAssumption?.stakeYen ?? null
      : input.officialRound?.stakeYen ?? null,
    topValueEdge,
    totalSalesYen,
  };
}
