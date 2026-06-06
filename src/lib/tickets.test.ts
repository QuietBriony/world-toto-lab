import { describe, expect, it } from "vitest";

import {
  buildTicketTargetingPlan,
  type TicketPayload,
  type TicketSelection,
} from "@/lib/tickets";
import type { OutcomeValue } from "@/lib/domain";

function selection(matchNo: number, outcome: OutcomeValue, reasons: string[] = []): TicketSelection {
  return {
    attentionShare: 0.2,
    bucket: "core",
    compositeAdvantage: 0.08,
    compositeProbability: 0.52,
    confidence: 0.7,
    contrarian: false,
    crowdProbability: 0.44,
    crowdSource: "official",
    darkHorseScore: 0.02,
    edge: 0.08,
    fixture: `Home ${matchNo} 対 Away ${matchNo}`,
    humanAligned: reasons.includes("予想者優位"),
    matchId: `match-${matchNo}`,
    matchNo,
    modelProbability: 0.52,
    officialVoteShare: 0.44,
    outcome,
    predictorPickCount: reasons.includes("予想者優位") ? 1 : 0,
    predictorProbability: null,
    reasons,
    riskScore: 0.28,
    watcherProbability: null,
    watcherSupportCount: 0,
  };
}

function ticket(
  outcomes: OutcomeValue[],
  overrides: Partial<TicketPayload> = {},
): TicketPayload {
  return {
    attentionShare: 1,
    averageRiskScore: 0.28,
    comment: "test",
    contrarianScore: 0.1,
    estimatedHitProb: 0.44,
    mode: "balanced",
    selections: outcomes.map((outcome, index) =>
      selection(index + 1, outcome, index === 1 ? ["予想者優位"] : ["AI本線"]),
    ),
    ticketScore: 1,
    ...overrides,
  };
}

describe("ticket targeting plan", () => {
  it("classifies stable top-ticket outcomes as axes", () => {
    const plan = buildTicketTargetingPlan([
      ticket(["1", "0", "2"], { attentionShare: 0.6 }),
      ticket(["1", "0", "2"], { attentionShare: 0.4 }),
    ]);

    expect(plan?.label).toBe("少点数で狙える");
    expect(plan?.axisCount).toBe(3);
    expect(plan?.coverageCount).toBe(1);
    expect(plan?.rows.map((row) => row.selectedOutcomes)).toEqual([["1"], ["0"], ["2"]]);
  });

  it("adds cover outcomes when top tickets disagree on a match", () => {
    const plan = buildTicketTargetingPlan([
      ticket(["1", "1", "2"], { attentionShare: 0.55 }),
      ticket(["1", "0", "2"], { attentionShare: 0.45 }),
    ]);

    const secondMatch = plan?.rows.find((row) => row.matchNo === 2);

    expect(secondMatch?.call).toBe("cover");
    expect(secondMatch?.selectedOutcomes).toEqual(["1", "0"]);
    expect(plan?.coverageCount).toBe(2);
  });

  it("marks noisy matches as spread when all outcomes remain live", () => {
    const plan = buildTicketTargetingPlan([
      ticket(["1"], { attentionShare: 0.34 }),
      ticket(["0"], { attentionShare: 0.33 }),
      ticket(["2"], { attentionShare: 0.33 }),
    ]);

    expect(plan?.rows[0]?.call).toBe("spread");
    expect(plan?.rows[0]?.selectedOutcomes).toEqual(["1", "0", "2"]);
    expect(plan?.spreadCount).toBe(1);
  });
});
