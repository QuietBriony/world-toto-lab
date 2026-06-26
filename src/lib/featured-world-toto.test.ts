import { describe, expect, it } from "vitest";

import {
  buildFeaturedWorldTotoImportPayload,
  buildFeaturedWorldTotoImportPayloads,
  featuredWorldTotoMatches,
  featuredWorldTotoRounds,
  featuredWorldTotoRoundNumbers,
} from "@/lib/featured-world-toto";

describe("featured world toto preset", () => {
  it("contains the full 13-match toto round", () => {
    expect(featuredWorldTotoMatches).toHaveLength(13);
    expect(featuredWorldTotoMatches.map((match) => match.officialMatchNo)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ]);
  });

  it("keeps official vote shares normalized per match", () => {
    featuredWorldTotoMatches.forEach((match) => {
      const total =
        (match.officialVote1 ?? 0) +
        (match.officialVote0 ?? 0) +
        (match.officialVote2 ?? 0);

      expect(total).toBeCloseTo(1, 4);
    });
  });

  it("contains four published World Toto rounds", () => {
    const payloads = buildFeaturedWorldTotoImportPayloads();

    expect(featuredWorldTotoRoundNumbers).toEqual([1634, 1635, 1636, 1637]);
    expect(payloads).toHaveLength(4);
    expect(payloads.flatMap((payload) => payload.rows)).toHaveLength(52);
    payloads.forEach((payload) => {
      expect(payload.rows).toHaveLength(13);
      expect(payload.officialRoundNumber).toBeGreaterThanOrEqual(1634);
      expect(payload.officialRoundNumber).toBeLessThanOrEqual(1637);
    });
  });

  it("keeps the round 1636 preset aligned to the latest official snapshot", () => {
    const round1636 = featuredWorldTotoRounds.find((round) => round.roundNumber === 1636);

    expect(round1636?.totalSalesYen).toBe(273_312_700);
    expect(round1636?.matches[0]?.officialVote1).toBeCloseTo(0.7125, 4);
    expect(round1636?.matches[1]?.officialVote2).toBeCloseTo(0.691, 4);
  });

  it("builds an import payload for the current featured round", () => {
    const payload = buildFeaturedWorldTotoImportPayload();

    expect(payload.officialRoundNumber).toBe(1634);
    expect(payload.productType).toBe("toto13");
    expect(payload.rows).toHaveLength(13);
    expect(payload.title).toContain("第1634回");
  });
});
