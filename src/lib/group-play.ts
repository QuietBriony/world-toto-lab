import {
  OUTCOME_VALUES,
  favoriteOutcomeForBucket,
  type OutcomeValue,
} from "@/lib/domain";
import type { CandidateTicket, CandidateVote, Match } from "@/lib/types";

export type GroupPlayCall = "axis" | "human_decision" | "spread";

export type GroupPlayPlanRow = {
  agreement: number;
  aiOutcome: OutcomeValue | null;
  call: GroupPlayCall;
  candidateCount: number;
  fixture: string;
  humanOverride: boolean;
  matchId: string;
  matchNo: number;
  outcomes: OutcomeValue[];
  share: Record<OutcomeValue, number>;
  topOutcome: OutcomeValue | null;
};

export type GroupPlayPlan = {
  axisCount: number;
  boughtMyselfCount: number;
  candidateCount: number;
  commentCount: number;
  focusRows: GroupPlayPlanRow[];
  humanDecisionCount: number;
  matchCount: number;
  rows: GroupPlayPlanRow[];
  spreadCount: number;
  voteCount: number;
};

function pickAiOutcome(match: Match) {
  return (
    favoriteOutcomeForBucket(match, "model") ??
    favoriteOutcomeForBucket(match, "market") ??
    favoriteOutcomeForBucket(match, "official")
  );
}

function sortedOutcomesByShare(share: Record<OutcomeValue, number>) {
  return OUTCOME_VALUES.filter((outcome) => share[outcome] > 0).sort((left, right) => {
    const byShare = share[right] - share[left];
    return byShare !== 0 ? byShare : OUTCOME_VALUES.indexOf(left) - OUTCOME_VALUES.indexOf(right);
  });
}

function classifyRow(input: {
  aiOutcome: OutcomeValue | null;
  outcomes: OutcomeValue[];
  topOutcome: OutcomeValue | null;
  topShare: number;
}): GroupPlayCall {
  if (input.outcomes.length >= 3) {
    return "spread";
  }

  if (
    input.topOutcome !== null &&
    input.topOutcome === input.aiOutcome &&
    input.topShare >= 0.68
  ) {
    return "axis";
  }

  return "human_decision";
}

export function buildGroupPlayPlan(input: {
  candidateTickets: CandidateTicket[];
  candidateVotes: CandidateVote[];
  matches: Match[];
}): GroupPlayPlan | null {
  if (input.matches.length === 0 || input.candidateTickets.length === 0) {
    return null;
  }

  const candidateCount = input.candidateTickets.length;
  const ticketPickByMatchNo = input.candidateTickets.map(
    (ticket) => new Map(ticket.picks.map((pick) => [pick.matchNo, pick.pick])),
  );

  const rows = [...input.matches]
    .sort((left, right) => left.matchNo - right.matchNo)
    .map((match) => {
      const counts: Record<OutcomeValue, number> = {
        "1": 0,
        "0": 0,
        "2": 0,
      };

      ticketPickByMatchNo.forEach((picks) => {
        const pick = picks.get(match.matchNo);
        if (pick) {
          counts[pick] += 1;
        }
      });

      const share = {
        "1": counts["1"] / candidateCount,
        "0": counts["0"] / candidateCount,
        "2": counts["2"] / candidateCount,
      };
      const outcomes = sortedOutcomesByShare(share);
      const topOutcome = outcomes[0] ?? null;
      const aiOutcome = pickAiOutcome(match);
      const agreement = topOutcome ? share[topOutcome] : 0;
      const call = classifyRow({
        aiOutcome,
        outcomes,
        topOutcome,
        topShare: agreement,
      });

      return {
        agreement,
        aiOutcome,
        call,
        candidateCount,
        fixture: `${match.homeTeam} vs ${match.awayTeam}`,
        humanOverride: topOutcome !== null && aiOutcome !== null && topOutcome !== aiOutcome,
        matchId: match.id,
        matchNo: match.matchNo,
        outcomes,
        share,
        topOutcome,
      } satisfies GroupPlayPlanRow;
    });

  const focusRows = rows
    .filter((row) => row.call !== "axis" || row.humanOverride)
    .sort((left, right) => {
      const byCall =
        Number(right.call === "spread") -
        Number(left.call === "spread") ||
        Number(right.humanOverride) -
        Number(left.humanOverride);
      if (byCall !== 0) {
        return byCall;
      }

      return left.agreement - right.agreement;
    })
    .slice(0, 5);

  return {
    axisCount: rows.filter((row) => row.call === "axis").length,
    boughtMyselfCount: input.candidateVotes.filter((vote) => vote.vote === "bought_myself").length,
    candidateCount,
    commentCount: input.candidateVotes.filter((vote) => Boolean(vote.comment)).length,
    focusRows,
    humanDecisionCount: rows.filter((row) => row.call === "human_decision").length,
    matchCount: input.matches.length,
    rows,
    spreadCount: rows.filter((row) => row.call === "spread").length,
    voteCount: input.candidateVotes.length,
  };
}
