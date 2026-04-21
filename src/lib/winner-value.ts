import type { Match, OutcomeEdge, ProductType } from "@/lib/types";

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
