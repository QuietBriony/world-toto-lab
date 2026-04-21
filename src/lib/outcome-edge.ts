import {
  favoriteOutcomeForBucket,
  getProbability,
  OUTCOME_VALUES,
  type OutcomeValue,
} from "@/lib/domain";
import type { Match, OutcomeEdge } from "@/lib/types";

function isKnownNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function buildOutcomeEdges(matches: Match[]): OutcomeEdge[] {
  return matches.flatMap((match) => {
    const modelFavorite = favoriteOutcomeForBucket(match, "model");
    const publicFavorite = favoriteOutcomeForBucket(match, "official");

    return OUTCOME_VALUES.map((outcome) => {
      const modelProb = getProbability(match, "model", outcome);
      const officialVote = getProbability(match, "official", outcome);
      const marketProb = getProbability(match, "market", outcome);
      const edge =
        isKnownNumber(modelProb) && isKnownNumber(officialVote)
          ? modelProb - officialVote
          : null;
      const valueRatio =
        isKnownNumber(modelProb) &&
        isKnownNumber(officialVote) &&
        officialVote > 0
          ? modelProb / officialVote
          : null;
      const publicOverweight =
        isKnownNumber(modelProb) && isKnownNumber(officialVote)
          ? officialVote - modelProb
          : null;
      const reasons: string[] = [];

      if (isKnownNumber(edge) && edge >= 0.08) {
        reasons.push("edge>=0.08");
      }

      if (
        isKnownNumber(valueRatio) &&
        valueRatio >= 1.35 &&
        isKnownNumber(modelProb) &&
        modelProb >= 0.18
      ) {
        reasons.push("valueRatio>=1.35");
      }

      if (
        isKnownNumber(officialVote) &&
        officialVote <= 0.25 &&
        isKnownNumber(modelProb) &&
        modelProb >= 0.32
      ) {
        reasons.push("public<=0.25");
      }

      if (
        outcome === "0" &&
        ((isKnownNumber(officialVote) &&
          officialVote <= 0.22 &&
          isKnownNumber(modelProb) &&
          modelProb >= 0.28) ||
          (match.consensusD ?? 0) >= 1.5)
      ) {
        reasons.push("draw_alert");
      }

      if (
        isKnownNumber(officialVote) &&
        officialVote >= 0.6 &&
        isKnownNumber(modelProb) &&
        modelProb <= officialVote - 0.1
      ) {
        reasons.push("popular_overweight");
      }

      return {
        edge,
        fixture: `${match.homeTeam} vs ${match.awayTeam}`,
        matchId: match.id,
        matchNo: match.matchNo,
        marketProb,
        modelFavorite: modelFavorite === outcome,
        modelProb,
        officialVote,
        outcome,
        publicFavorite: publicFavorite === outcome,
        publicOverweight,
        reasons,
        valueRatio,
      } satisfies OutcomeEdge;
    });
  });
}

export function isSleepingValueOutcome(edge: OutcomeEdge) {
  return edge.reasons.some((reason) => reason !== "popular_overweight");
}

export function pickSleepingValueOutcomes(matches: Match[], maxMatches = 3) {
  const bestByMatch = new Map<number, OutcomeEdge>();

  buildOutcomeEdges(matches)
    .filter((edge) => isSleepingValueOutcome(edge))
    .forEach((edge) => {
      const current = bestByMatch.get(edge.matchNo);
      const edgeScore =
        (edge.edge ?? 0) * 10 +
        (edge.valueRatio ?? 1) +
        (edge.outcome === "0" ? 0.1 : 0);

      if (!current) {
        bestByMatch.set(edge.matchNo, edge);
        return;
      }

      const currentScore =
        (current.edge ?? 0) * 10 +
        (current.valueRatio ?? 1) +
        (current.outcome === "0" ? 0.1 : 0);

      if (edgeScore > currentScore) {
        bestByMatch.set(edge.matchNo, edge);
      }
    });

  return Array.from(bestByMatch.values())
    .sort((left, right) => {
      const leftScore = (left.edge ?? 0) * 10 + (left.valueRatio ?? 1);
      const rightScore = (right.edge ?? 0) * 10 + (right.valueRatio ?? 1);
      return rightScore - leftScore;
    })
    .slice(0, maxMatches)
    .map((edge) => ({
      matchNo: edge.matchNo,
      pick: edge.outcome as OutcomeValue,
      reason: edge.reasons.join(", "),
    }));
}
