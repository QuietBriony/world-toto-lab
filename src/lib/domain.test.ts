import { describe, expect, it } from "vitest";

import {
  OUTCOME_VALUES,
  type MatchLike,
  type OutcomeValue,
  clamp,
  computeConsensus,
  computeDirectionScore,
  disagreementFromCounts,
  enumToOutcome,
  favoriteOutcome,
  formatNumber,
  formatOutcomeSet,
  formatPercent,
  formatSignedPercent,
  getEdge,
  getProbability,
  majorityHumanOutcome,
  outcomeToEnum,
  parseOutcomeList,
  pickCounts,
  pickDistribution,
  serializeOutcomeList,
} from "@/lib/domain";

function makeMatch(overrides: Partial<MatchLike> = {}): MatchLike {
  return {
    matchNo: 1,
    homeTeam: "Home",
    awayTeam: "Away",
    officialVote1: null,
    officialVote0: null,
    officialVote2: null,
    marketProb1: null,
    marketProb0: null,
    marketProb2: null,
    modelProb1: null,
    modelProb0: null,
    modelProb2: null,
    consensusF: null,
    consensusD: null,
    consensusCall: null,
    disagreementScore: null,
    exceptionCount: null,
    confidence: null,
    category: null,
    recommendedOutcomes: null,
    actualResult: null,
    ...overrides,
  };
}

describe("outcomeToEnum / enumToOutcome", () => {
  it("maps every outcome value to its enum and back", () => {
    for (const value of OUTCOME_VALUES) {
      const enumValue = outcomeToEnum(value);
      expect(enumToOutcome(enumValue)).toBe(value);
    }
  });

  it("maps specific values explicitly", () => {
    expect(outcomeToEnum("1")).toBe("ONE");
    expect(outcomeToEnum("0")).toBe("DRAW");
    expect(outcomeToEnum("2")).toBe("TWO");
    expect(enumToOutcome("ONE")).toBe("1");
    expect(enumToOutcome("DRAW")).toBe("0");
    expect(enumToOutcome("TWO")).toBe("2");
  });

  it("returns null for nullish enum input", () => {
    expect(enumToOutcome(null)).toBeNull();
    expect(enumToOutcome(undefined)).toBeNull();
  });
});

describe("parseOutcomeList / serializeOutcomeList", () => {
  it("returns an empty array for nullish or empty input", () => {
    expect(parseOutcomeList(null)).toEqual([]);
    expect(parseOutcomeList(undefined)).toEqual([]);
    expect(parseOutcomeList("")).toEqual([]);
  });

  it("parses across multiple delimiters and drops invalid tokens", () => {
    expect(parseOutcomeList("1,0 2")).toEqual(["1", "0", "2"]);
    expect(parseOutcomeList("1 / 0 | 2")).toEqual(["1", "0", "2"]);
    expect(parseOutcomeList("1,x,3,2")).toEqual(["1", "2"]);
  });

  it("serializes uniquely and returns null when empty", () => {
    expect(serializeOutcomeList([])).toBeNull();
    expect(serializeOutcomeList(["1", "1", "0"])).toBe("1,0");
  });

  it("round-trips a deduplicated outcome set", () => {
    const values: OutcomeValue[] = ["2", "0", "1"];
    const serialized = serializeOutcomeList(values);
    expect(serialized).not.toBeNull();
    expect(parseOutcomeList(serialized)).toEqual(values);
  });
});

describe("formatPercent / formatNumber / formatSignedPercent", () => {
  it("renders an em dash for nullish input", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
    expect(formatSignedPercent(null)).toBe("—");
  });

  it("formats percentages with the requested digits", () => {
    expect(formatPercent(0.5)).toBe("50%");
    expect(formatPercent(0.1234, 1)).toBe("12.3%");
  });

  it("formats fixed-digit numbers", () => {
    expect(formatNumber(1.2)).toBe("1.20");
    expect(formatNumber(3, 0)).toBe("3");
  });

  it("prefixes a sign and pt suffix", () => {
    expect(formatSignedPercent(0.123)).toBe("+12.3pt");
    expect(formatSignedPercent(-0.05)).toBe("-5.0pt");
    expect(formatSignedPercent(0)).toBe("+0.0pt");
  });
});

describe("clamp", () => {
  it("clamps to the lower and upper bounds", () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(2, 0, 1)).toBe(1);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});

describe("getProbability", () => {
  const match = makeMatch({
    officialVote1: 0.6,
    officialVote0: 0.3,
    officialVote2: 0.1,
    marketProb1: 0.55,
    marketProb0: 0.25,
    marketProb2: 0.2,
    modelProb1: 0.5,
    modelProb0: 0.3,
    modelProb2: 0.2,
  });

  it("reads the correct bucket and outcome", () => {
    expect(getProbability(match, "official", "1")).toBe(0.6);
    expect(getProbability(match, "official", "0")).toBe(0.3);
    expect(getProbability(match, "official", "2")).toBe(0.1);
    expect(getProbability(match, "market", "1")).toBe(0.55);
    expect(getProbability(match, "model", "2")).toBe(0.2);
  });
});

describe("getEdge", () => {
  it("returns model minus official when both are present", () => {
    const match = makeMatch({ modelProb1: 0.6, officialVote1: 0.5 });
    expect(getEdge(match, "1")).toBeCloseTo(0.1, 10);
  });

  it("returns null when either side is missing", () => {
    expect(getEdge(makeMatch({ modelProb1: 0.6 }), "1")).toBeNull();
    expect(getEdge(makeMatch({ officialVote1: 0.5 }), "1")).toBeNull();
  });
});

describe("favoriteOutcome", () => {
  it("returns the highest-valued outcome", () => {
    expect(favoriteOutcome({ "1": 0.2, "0": 0.5, "2": 0.3 })).toBe("0");
  });

  it("ignores non-finite values and returns null when none remain", () => {
    expect(favoriteOutcome({ "1": null, "0": null, "2": null })).toBeNull();
    expect(favoriteOutcome({})).toBeNull();
  });
});

describe("pickCounts / pickDistribution / majorityHumanOutcome", () => {
  const picks = [
    { pick: "ONE" as const },
    { pick: "ONE" as const },
    { pick: "DRAW" as const },
  ];

  it("counts picks by outcome", () => {
    expect(pickCounts(picks)).toEqual({ "1": 2, "0": 1, "2": 0 });
  });

  it("computes the distribution and total", () => {
    const distribution = pickDistribution({ "1": 2, "0": 1, "2": 1 });
    expect(distribution.total).toBe(4);
    expect(distribution["1"]).toBe(0.5);
    expect(distribution["0"]).toBe(0.25);
  });

  it("handles an empty distribution without dividing by zero", () => {
    const distribution = pickDistribution({ "1": 0, "0": 0, "2": 0 });
    expect(distribution.total).toBe(0);
    expect(distribution["1"]).toBe(0);
  });

  it("returns the majority human outcome", () => {
    expect(majorityHumanOutcome(picks)).toBe("1");
  });

  it("falls back to the first outcome when counts are all zero (empty picks)", () => {
    // All-zero counts are finite, so favoriteOutcome returns the first ("1"),
    // not null.
    expect(majorityHumanOutcome([])).toBe("1");
  });
});

describe("disagreementFromCounts", () => {
  it("is zero when all picks agree", () => {
    expect(disagreementFromCounts({ "1": 5, "0": 0, "2": 0 })).toBe(0);
  });

  it("is positive when picks split", () => {
    expect(disagreementFromCounts({ "1": 1, "0": 1, "2": 0 })).toBeGreaterThan(0);
  });
});

describe("computeDirectionScore", () => {
  it("sums the five component scores", () => {
    expect(
      computeDirectionScore({
        scoreStrengthForm: 1,
        scoreAvailability: 2,
        scoreConditions: 3,
        scoreTacticalMatchup: -1,
        scoreMicro: 0,
      }),
    ).toBe(5);
  });
});

describe("computeConsensus", () => {
  it("flags a strong 1軸 when direction is high and draw alert is low", () => {
    const summary = computeConsensus([
      {
        directionScoreF: 5,
        drawAlert: 0,
        exceptionFlag: false,
      },
      {
        directionScoreF: 5,
        drawAlert: 0,
        exceptionFlag: true,
      },
    ]);

    expect(summary.avgF).toBe(5);
    expect(summary.avgD).toBe(0);
    expect(summary.exceptionCount).toBe(1);
    expect(summary.consensusCall).toBe("1軸");
  });

  it("flags 0軸候補 when draw alert is high and direction is balanced", () => {
    const summary = computeConsensus([
      { directionScoreF: 0, drawAlert: 2, exceptionFlag: false },
    ]);
    expect(summary.consensusCall).toBe("0軸候補");
  });
});

describe("formatOutcomeSet", () => {
  it("joins outcomes with a slash and falls back to an em dash", () => {
    expect(formatOutcomeSet(["1", "0"])).toBe("1 / 0");
    expect(formatOutcomeSet([])).toBe("—");
  });
});
