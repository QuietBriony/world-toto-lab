import { describe, expect, it } from "vitest";

import { placeholderMatches } from "@/lib/local-repository";
import {
  buildOutcomeEdges,
  isSleepingValueOutcome,
  pickSleepingValueOutcomes,
} from "@/lib/outcome-edge";
import type { Match, OutcomeEdge } from "@/lib/types";

function edgeMatch(matchNo: number, overrides: Partial<Match>): Match {
  return {
    ...placeholderMatches("round-edge", 1)[0],
    homeTeam: `Home ${matchNo}`,
    awayTeam: `Away ${matchNo}`,
    matchNo,
    officialMatchNo: matchNo,
    ...overrides,
  };
}

function edgeFor(edges: OutcomeEdge[], matchNo: number, outcome: "1" | "0" | "2") {
  return edges.find((edge) => edge.matchNo === matchNo && edge.outcome === outcome);
}

describe("buildOutcomeEdges", () => {
  it("emits one edge row per outcome (3 per match) with edge / valueRatio / publicOverweight", () => {
    const edges = buildOutcomeEdges([
      edgeMatch(1, {
        modelProb1: 0.5,
        modelProb0: 0.2,
        modelProb2: 0.3,
        officialVote1: 0.4,
        officialVote0: 0.3,
        officialVote2: 0.3,
      }),
    ]);

    expect(edges).toHaveLength(3);
    const e1 = edgeFor(edges, 1, "1");
    // edge = model - public, publicOverweight = public - model, valueRatio = model / public。
    expect(e1?.edge).toBeCloseTo(0.1, 6);
    expect(e1?.publicOverweight).toBeCloseTo(-0.1, 6);
    expect(e1?.valueRatio).toBeCloseTo(1.25, 6);
  });

  it("leaves edge / valueRatio null when model or official is missing", () => {
    const edges = buildOutcomeEdges([edgeMatch(1, { modelProb1: 0.5 })]);
    const e1 = edgeFor(edges, 1, "1");
    // 公式票なし → edge も valueRatio も算出しない（誤検知防止）。
    expect(e1?.edge).toBeNull();
    expect(e1?.valueRatio).toBeNull();
    expect(e1?.publicOverweight).toBeNull();
  });

  it("flags an underpriced underdog (edge>=0.08 + public<=0.25)", () => {
    // 公衆が薄く(0.20)モデルが厚い(0.35) → 寝ているバリュー。
    const edges = buildOutcomeEdges([
      edgeMatch(1, {
        modelProb1: 0.35,
        modelProb0: 0.3,
        modelProb2: 0.35,
        officialVote1: 0.2,
        officialVote0: 0.4,
        officialVote2: 0.4,
      }),
    ]);
    const e1 = edgeFor(edges, 1, "1");
    expect(e1?.reasons).toContain("edge>=0.08");
    expect(e1?.reasons).toContain("public<=0.25");
    expect(isSleepingValueOutcome(e1!)).toBe(true);
  });

  it("flags popular_overweight when the public favorite outruns the model (the Germany pattern)", () => {
    // 公衆 0.74 だがモデルは 0.60 ＝公衆過信。popular_overweight 単独はバリューではない。
    const edges = buildOutcomeEdges([
      edgeMatch(1, {
        modelProb1: 0.2,
        modelProb0: 0.2,
        modelProb2: 0.6,
        officialVote1: 0.13,
        officialVote0: 0.13,
        officialVote2: 0.74,
      }),
    ]);
    const e2 = edgeFor(edges, 1, "2");
    expect(e2?.reasons).toContain("popular_overweight");
    // popular_overweight だけなら「寝ているバリュー」ではない（買い増し対象でない）。
    expect(isSleepingValueOutcome(e2!)).toBe(false);
  });

  it("raises draw_alert from a strong draw consensus even without a probability gap", () => {
    const edges = buildOutcomeEdges([
      edgeMatch(1, {
        modelProb1: 0.4,
        modelProb0: 0.3,
        modelProb2: 0.3,
        officialVote1: 0.4,
        officialVote0: 0.3,
        officialVote2: 0.3,
        consensusD: 2,
      }),
    ]);
    const draw = edgeFor(edges, 1, "0");
    expect(draw?.reasons).toContain("draw_alert");
  });

  it("marks the model and public favorites per match", () => {
    const edges = buildOutcomeEdges([
      edgeMatch(1, {
        modelProb1: 0.2,
        modelProb0: 0.2,
        modelProb2: 0.6,
        officialVote1: 0.7,
        officialVote0: 0.15,
        officialVote2: 0.15,
      }),
    ]);
    // モデル本命は 2、公衆本命は 1（食い違い）。
    expect(edgeFor(edges, 1, "2")?.modelFavorite).toBe(true);
    expect(edgeFor(edges, 1, "1")?.modelFavorite).toBe(false);
    expect(edgeFor(edges, 1, "1")?.publicFavorite).toBe(true);
    expect(edgeFor(edges, 1, "2")?.publicFavorite).toBe(false);
  });
});

describe("pickSleepingValueOutcomes", () => {
  it("returns the best sleeping-value pick per match, sorted by score, never the overweight favorite", () => {
    const matches = [
      // M1: 公衆過信本命(2=0.74)。本命自体は popular_overweight で除外されるが、
      // その分アンダードッグ(1/0)が割安になる＝拾うべきはアンダードッグ側。
      edgeMatch(1, {
        modelProb1: 0.2,
        modelProb0: 0.2,
        modelProb2: 0.6,
        officialVote1: 0.13,
        officialVote0: 0.13,
        officialVote2: 0.74,
      }),
      // M2: アンダードッグ 1 が明確な寝ているバリュー（edge 大）。
      edgeMatch(2, {
        modelProb1: 0.4,
        modelProb0: 0.3,
        modelProb2: 0.3,
        officialVote1: 0.18,
        officialVote0: 0.41,
        officialVote2: 0.41,
      }),
    ];

    const picks = pickSleepingValueOutcomes(matches, 5);
    const matchNos = picks.map((pick) => pick.matchNo);

    expect(matchNos).toContain(1);
    expect(matchNos).toContain(2);
    // edge が大きい M2 がスコア上位（先頭）。
    expect(picks[0]?.matchNo).toBe(2);
    expect(picks.find((pick) => pick.matchNo === 2)?.pick).toBe("1");
    // M1 で拾うのは公衆過信の本命(2)ではなくアンダードッグ側。
    expect(picks.find((pick) => pick.matchNo === 1)?.pick).not.toBe("2");
    // 各 pick は { matchNo, pick, reason } を持つ。
    const m2 = picks.find((pick) => pick.matchNo === 2);
    expect(typeof m2?.reason).toBe("string");
    expect(m2?.reason.length).toBeGreaterThan(0);
  });

  it("caps the number of returned matches with maxMatches", () => {
    const matches = Array.from({ length: 4 }, (_value, index) =>
      edgeMatch(index + 1, {
        modelProb1: 0.4,
        modelProb0: 0.3,
        modelProb2: 0.3,
        officialVote1: 0.18,
        officialVote0: 0.41,
        officialVote2: 0.41,
      }),
    );
    expect(pickSleepingValueOutcomes(matches, 2)).toHaveLength(2);
  });
});
