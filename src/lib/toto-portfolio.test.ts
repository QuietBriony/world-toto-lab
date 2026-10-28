import { describe, expect, it } from "vitest";
import {
  defaultTotoPrizeParams, distanceProbabilities, evaluateTotoPortfolio,
  optimizeTotoPortfolio, payoutForTruth, topModelCombinations,
  type Outcome, type TotoMatchProbabilities,
} from "@/lib/toto-portfolio";

// Invented probabilities only; no historical calibration or return claim.
const pick = (...prefix: Outcome[]): Outcome[] => [...prefix, ...Array<Outcome>(13 - prefix.length).fill(0)];
const deterministic = (): TotoMatchProbabilities[] => Array.from({ length: 13 }, () => ({ model: [1, 0, 0], crowd: [1, 0, 0] }));
const fixture = (): TotoMatchProbabilities[] => {
  const matches = deterministic();
  matches[0] = { model: [0.5, 0.3, 0.2], crowd: [0.4, 0.4, 0.2] };
  matches[1] = { model: [0.2, 0.5, 0.3], crowd: [0.3, 0.2, 0.5] };
  matches[2] = { model: [0.7, 0.1, 0.2], crowd: [0.6, 0.3, 0.1] };
  return matches;
};
const distance = (a: readonly Outcome[], b: readonly Outcome[]) => a.reduce<number>((sum, value, i) => sum + Number(value !== b[i]), 0);
const params = { ...defaultTotoPrizeParams, salesYen: 100_000, carryoverYen: 12_000, firstPrizeCapYen: null };

// Independent exhaustive oracle: enumerate all nonzero truths/crowd tickets
// for this 3-variable + 10-deterministic-match fixture, not neighbourhood/DP.
function oracle(tickets: Outcome[][]) {
  const matches = fixture();
  const outcomes: Outcome[][] = [];
  for (const a of [0, 1, 2] as const) for (const b of [0, 1, 2] as const) for (const c of [0, 1, 2] as const) outcomes.push(pick(a, b, c));
  const tierHits = [0, 0, 0];
  let union = 0;
  let expected = 0;
  for (const truth of outcomes) {
    const probability = matches.reduce((p, m, i) => p * m.model[truth[i]], 1);
    const mine = [0, 0, 0];
    for (const ticket of tickets) {
      const d = distance(ticket, truth);
      if (d <= 2) mine[d]++;
    }
    if (mine.some(Boolean)) union += probability;
    for (let d = 0; d <= 2; d++) {
      if (!mine[d]) continue;
      tierHits[d] += probability;
      const crowdProbability = outcomes.filter((ticket) => distance(ticket, truth) === d)
        .reduce((sum, ticket) => sum + matches.reduce((p, m, i) => p * m.crowd[ticket[i]], 1), 0);
      const pool = params.salesYen * params.returnRate * params.tierShares[d] + (d === 0 ? params.carryoverYen : 0);
      const winners = (params.salesYen / params.stakeYen - tickets.length) * crowdProbability + mine[d];
      expected += probability * pool * mine[d] / winners;
    }
  }
  return { expected, tierHits, union };
}

describe("toto research regressions", () => {
  it.each([1, 2, 3])("handles %i deterministic misses without dividing by zero", (misses) => {
    const ticket = pick(...Array<Outcome>(misses).fill(1));
    const expected = [0, 0, 0];
    if (misses <= 2) expected[misses] = 1;
    expect(distanceProbabilities(ticket, deterministic(), "model")).toEqual(expected);
    expect(distanceProbabilities(ticket, deterministic(), "crowd")).toEqual(expected);
  });

  it("keeps uniform 13-match combinatorial counts", () => {
    const matches: TotoMatchProbabilities[] = Array.from({ length: 13 }, () => ({ model: [1 / 3, 1 / 3, 1 / 3], crowd: [1 / 3, 1 / 3, 1 / 3] }));
    const dist = distanceProbabilities(pick(), matches, "model");
    [1, 26, 312].forEach((count, i) => expect(dist[i]).toBeCloseTo(count / 3 ** 13, 12));
  });

  it("allocates carryover to first prize only", () => {
    const tickets = [pick(), pick(1), pick(1, 1)];
    const plain = payoutForTruth(pick(), tickets, deterministic(), { ...params, carryoverYen: 0 });
    const carry = payoutForTruth(pick(), tickets, deterministic(), params);
    expect(carry.tiers[1].payoutPerUnitYen).toBe(plain.tiers[1].payoutPerUnitYen);
    expect(carry.tiers[2].payoutPerUnitYen).toBe(plain.tiers[2].payoutPerUnitYen);
    expect(carry.tiers[0].payoutPerUnitYen - plain.tiers[0].payoutPerUnitYen)
      .toBeCloseTo(params.carryoverYen / (params.salesYen / params.stakeYen - tickets.length + 1), 10);
  });

  it("counts each tier even when a better tier is hit in the same truth", () => {
    const matches = deterministic();
    matches[0] = { model: [1 / 3, 1 / 3, 1 / 3], crowd: [1 / 3, 1 / 3, 1 / 3] };
    const result = evaluateTotoPortfolio([pick(0), pick(1)], matches);
    expect(result.tierHitProbability[0]).toBeCloseTo(2 / 3, 12);
    expect(result.tierHitProbability[1]).toBeCloseTo(1, 12);
    expect(result.tierHitProbability[2]).toBe(0);
    expect(result.anyTierHitProbability).toBeCloseTo(1, 12);
  });

  it.each([[pick()], [pick(0), pick(1, 1)], [pick(), pick(), pick(2, 1, 2)]])("matches the exhaustive synthetic oracle", (...tickets) => {
    const expected = oracle(tickets);
    const result = evaluateTotoPortfolio(tickets, fixture(), params);
    expect(result.expectedReturnYen).toBeCloseTo(expected.expected, 8);
    result.tierHitProbability.forEach((p, d) => expect(p).toBeCloseTo(expected.tierHits[d], 12));
    expect(result.anyTierHitProbability).toBeCloseTo(expected.union, 12);
  });

  it("duplicate tickets do not increase hit probability, but do dilute payout", () => {
    const matches = fixture();
    const one = evaluateTotoPortfolio([pick()], matches, params);
    const two = evaluateTotoPortfolio([pick(), pick()], matches, params);
    expect(two.tierHitProbability).toEqual(one.tierHitProbability);
    expect(two.anyTierHitProbability).toBe(one.anyTierHitProbability);
    expect(two.expectedReturnYen).toBeLessThan(2 * one.expectedReturnYen);
    expect(two.expectedReturnYen).toBeGreaterThan(one.expectedReturnYen);
  });

  it("caps only first-prize payout", () => {
    const result = payoutForTruth(pick(), [pick(), pick(1)], deterministic(), { ...params, firstPrizeCapYen: 1 });
    expect(result.tiers[0].payoutPerUnitYen).toBe(1);
    expect(result.tiers[1].payoutPerUnitYen).toBeGreaterThan(1);
  });

  it("returns zero expected return for an empty portfolio", () => {
    const result = evaluateTotoPortfolio([], fixture(), params);
    expect(result.expectedReturnYen).toBe(0);
    expect(result.costYen).toBe(0);
    expect(result.evMultiple).toBeNull();
    expect(result.tierHitProbability).toEqual([0, 0, 0]);
    expect(result.anyTierHitProbability).toBe(0);
  });

  it("keeps candidate ordering and bounded greedy search reproducible", () => {
    const matches = fixture();
    const candidates = topModelCombinations(matches, 6);
    expect(candidates).toHaveLength(6);
    expect(candidates[0].picks).toEqual(pick(0, 1, 0));
    expect(candidates.map((c) => c.probability)).toEqual(candidates.map((c) => c.probability).sort((a, b) => b - a));
    const plan = optimizeTotoPortfolio(matches, 3, params, { candidatePoolSize: 6 });
    expect(plan.tickets.length).toBeLessThanOrEqual(3);
    expect(plan.tickets.length).toBeGreaterThan(0);
    expect(plan.evaluation).toEqual(evaluateTotoPortfolio(plan.tickets, matches, params));
  });

  it("rejects malformed probabilities, picks, and prize assumptions", () => {
    const invalid = fixture();
    invalid[0] = { model: [0.5, Number.NaN, 0.2], crowd: [1, 0, 0] };
    expect(() => distanceProbabilities(pick(), invalid, "model")).toThrow(RangeError);
    invalid[0] = { model: [0.5, 0.3, 0.3], crowd: [1, 0, 0] };
    expect(() => evaluateTotoPortfolio([], invalid)).toThrow(RangeError);
    expect(() => distanceProbabilities([0], fixture(), "model")).toThrow(RangeError);
    expect(() => evaluateTotoPortfolio([pick()], fixture().slice(1))).toThrow(RangeError);
    const badPick = pick();
    badPick[0] = 3 as Outcome;
    expect(() => evaluateTotoPortfolio([badPick], fixture())).toThrow(RangeError);
    for (const invalidParams of [
      { ...params, stakeYen: 0 }, { ...params, carryoverYen: -1 },
      { ...params, salesYen: Number.POSITIVE_INFINITY }, { ...params, salesYen: 0 },
      { ...params, returnRate: 2 }, { ...params, firstPrizeCapYen: -1 },
      { ...params, tierShares: [0.7, 0.3, 0.3] as const },
    ]) expect(() => evaluateTotoPortfolio([pick()], fixture(), invalidParams)).toThrow(RangeError);
  });

  it("rejects unbounded search inputs and handles zero budget", () => {
    for (const limit of [0, -1, 1.5, Number.NaN, 1001]) {
      expect(() => topModelCombinations(fixture(), limit)).toThrow(RangeError);
    }
    for (const budget of [-1, 1.5, Number.POSITIVE_INFINITY, 101]) {
      expect(() => optimizeTotoPortfolio(fixture(), budget)).toThrow(RangeError);
    }
    expect(optimizeTotoPortfolio(fixture(), 0).tickets).toEqual([]);
  });
});
