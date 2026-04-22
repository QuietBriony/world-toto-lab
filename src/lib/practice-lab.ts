import { favoriteOutcomeForBucket, humanConsensusOutcomes } from "@/lib/domain";
import { sortCandidateTickets } from "@/lib/candidate-tickets";
import type { CandidateTicket, Match, Outcome, Pick, RoundWorkspaceRound } from "@/lib/types";

function actualOutcomeToValue(value: Outcome | null) {
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

function countResolvedMatches(matches: Match[]) {
  return matches.filter((match) => actualOutcomeToValue(match.actualResult) !== null).length;
}

function countFavoriteHits(matches: Match[], bucket: "model" | "official") {
  return matches.reduce((count, match) => {
    const actual = actualOutcomeToValue(match.actualResult);
    if (!actual) {
      return count;
    }

    return favoriteOutcomeForBucket(match, bucket) === actual ? count + 1 : count;
  }, 0);
}

function countHumanConsensusHits(matches: Match[]) {
  return matches.reduce((count, match) => {
    const actual = actualOutcomeToValue(match.actualResult);
    if (!actual) {
      return count;
    }

    return humanConsensusOutcomes(match).includes(actual) ? count + 1 : count;
  }, 0);
}

function countDrawAlertHits(matches: Match[]) {
  return matches.reduce((count, match) => {
    const actual = actualOutcomeToValue(match.actualResult);
    if (!actual) {
      return count;
    }

    const drawAlert = match.category === "draw_candidate" || humanConsensusOutcomes(match).includes("0");
    return drawAlert && actual === "0" ? count + 1 : count;
  }, 0);
}

function candidateHitCount(ticket: CandidateTicket, matches: Match[]) {
  return matches.reduce((count, match) => {
    const actual = actualOutcomeToValue(match.actualResult);
    const pick = ticket.picks.find((entry) => entry.matchNo === match.matchNo)?.pick ?? null;

    if (!actual || !pick) {
      return count;
    }

    return pick === actual ? count + 1 : count;
  }, 0);
}

export function buildPracticeLabMetrics(round: RoundWorkspaceRound) {
  const resolvedMatchCount = countResolvedMatches(round.matches);
  const topCandidate = sortCandidateTickets(round.candidateTickets)[0] ?? null;

  return {
    candidateHitCount: topCandidate ? candidateHitCount(topCandidate, round.matches) : null,
    drawAlertHitCount: countDrawAlertHits(round.matches),
    humanConsensusHitCount: countHumanConsensusHits(round.matches),
    officialFavoriteHitCount: countFavoriteHits(round.matches, "official"),
    resolvedMatchCount,
    topCandidate,
    modelFavoriteHitCount: countFavoriteHits(round.matches, "model"),
  };
}

export function buildPracticeLabSavedPickCounts(round: RoundWorkspaceRound) {
  const perUser = new Map<string, number>();

  round.picks.forEach((pick: Pick) => {
    perUser.set(pick.userId, (perUser.get(pick.userId) ?? 0) + 1);
  });

  return perUser;
}
