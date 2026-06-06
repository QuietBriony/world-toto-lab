import { describe, expect, it } from "vitest";

import { buildGroupPlayPlan } from "@/lib/group-play";
import type { CandidateTicket, CandidateVote, Match } from "@/lib/types";

function match(matchNo: number, overrides: Partial<Match> = {}): Match {
  return {
    id: `match-${matchNo}`,
    matchNo,
    homeTeam: `Home ${matchNo}`,
    awayTeam: `Away ${matchNo}`,
    modelProb1: 0.6,
    modelProb0: 0.25,
    modelProb2: 0.15,
    marketProb1: null,
    marketProb0: null,
    marketProb2: null,
    officialVote1: null,
    officialVote0: null,
    officialVote2: null,
    ...overrides,
  } as Match;
}

function candidate(
  id: string,
  picks: Array<{ matchNo: number; pick: "1" | "0" | "2" }>,
): CandidateTicket {
  return {
    id,
    label: id,
    picks,
  } as CandidateTicket;
}

function vote(overrides: Partial<CandidateVote> = {}): CandidateVote {
  return {
    id: "vote-1",
    candidateTicketId: "a",
    comment: null,
    roundId: "round-1",
    userId: "user-1",
    vote: "like",
    ...overrides,
  } as CandidateVote;
}

describe("group play plan", () => {
  it("classifies stable model-aligned candidate picks as axes", () => {
    const plan = buildGroupPlayPlan({
      candidateTickets: [
        candidate("a", [{ matchNo: 1, pick: "1" }]),
        candidate("b", [{ matchNo: 1, pick: "1" }]),
        candidate("c", [{ matchNo: 1, pick: "1" }]),
      ],
      candidateVotes: [],
      matches: [match(1)],
    });

    expect(plan?.axisCount).toBe(1);
    expect(plan?.rows[0]?.call).toBe("axis");
    expect(plan?.rows[0]?.topOutcome).toBe("1");
  });

  it("marks candidate disagreement against the model as a human decision", () => {
    const plan = buildGroupPlayPlan({
      candidateTickets: [
        candidate("a", [{ matchNo: 1, pick: "1" }]),
        candidate("b", [{ matchNo: 1, pick: "0" }]),
        candidate("c", [{ matchNo: 1, pick: "0" }]),
      ],
      candidateVotes: [vote({ vote: "bought_myself", comment: "using this one" })],
      matches: [match(1)],
    });

    expect(plan?.humanDecisionCount).toBe(1);
    expect(plan?.rows[0]?.humanOverride).toBe(true);
    expect(plan?.boughtMyselfCount).toBe(1);
    expect(plan?.commentCount).toBe(1);
  });

  it("marks all-outcome candidate coverage as spread", () => {
    const plan = buildGroupPlayPlan({
      candidateTickets: [
        candidate("a", [{ matchNo: 1, pick: "1" }]),
        candidate("b", [{ matchNo: 1, pick: "0" }]),
        candidate("c", [{ matchNo: 1, pick: "2" }]),
      ],
      candidateVotes: [],
      matches: [match(1)],
    });

    expect(plan?.spreadCount).toBe(1);
    expect(plan?.focusRows.map((row) => row.matchNo)).toEqual([1]);
  });
});
