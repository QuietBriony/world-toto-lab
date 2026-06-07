import { describe, expect, it } from "vitest";

import {
  buildFeaturedWorldTotoImportPayload,
  featuredWorldTotoMatches,
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

  it("builds an import payload for the current featured round", () => {
    const payload = buildFeaturedWorldTotoImportPayload();

    expect(payload.officialRoundNumber).toBe(1634);
    expect(payload.productType).toBe("toto13");
    expect(payload.rows).toHaveLength(13);
    expect(payload.title).toContain("第1634回");
  });
});
