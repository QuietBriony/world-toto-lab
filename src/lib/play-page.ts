import { sortCandidateTickets } from "@/lib/candidate-tickets";
import type { RoundWorkspaceRound } from "@/lib/types";

export type PlayDraftValue = "" | "0" | "1" | "2";

function enumToDraftValue(value: "ONE" | "DRAW" | "TWO"): PlayDraftValue {
  if (value === "ONE") {
    return "1";
  }

  if (value === "DRAW") {
    return "0";
  }

  return "2";
}

export function buildPlayDraftValues(round: RoundWorkspaceRound, userId: string) {
  return Object.fromEntries(
    round.matches.map((match) => {
      const existing = round.picks.find((pick) => pick.matchId === match.id && pick.userId === userId);
      return [match.id, existing ? enumToDraftValue(existing.pick) : ""] as const;
    }),
  ) as Record<string, PlayDraftValue>;
}

export function buildPlayPageSummary(round: RoundWorkspaceRound) {
  const participantCount = new Set(round.picks.map((pick) => pick.userId)).size;
  const inputtedUserCount = new Set(
    round.picks
      .filter((pick) => pick.pick === "ONE" || pick.pick === "DRAW" || pick.pick === "TWO")
      .map((pick) => pick.userId),
  ).size;

  return {
    candidateCount: sortCandidateTickets(round.candidateTickets).slice(0, 6).length,
    inputtedUserCount,
    matchCount: round.matches.length,
    participantCount,
  };
}
