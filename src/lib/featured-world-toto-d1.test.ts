import { describe, expect, it } from "vitest";

import { buildFeaturedWorldTotoImportPayload } from "@/lib/featured-world-toto";
import { buildFeaturedWorldTotoMatchRows } from "@/lib/featured-world-toto-d1";

describe("buildFeaturedWorldTotoMatchRows", () => {
  const payload1634 = buildFeaturedWorldTotoImportPayload(1634);
  const rows1634 = buildFeaturedWorldTotoMatchRows("round-1634", payload1634.rows);

  it("creates one complete match row per featured match", () => {
    expect(rows1634).toHaveLength(payload1634.rows.length);
    rows1634.forEach((match, index) => {
      const source = payload1634.rows[index];
      expect(match.matchNo).toBe(index + 1);
      expect(match.roundId).toBe("round-1634");
      expect(match.homeTeam).toBe(source.homeTeam);
      expect(match.awayTeam).toBe(source.awayTeam);
      expect(match.officialMatchNo).toBe(source.officialMatchNo);
      expect(match.officialVote1).toBe(source.officialVote1);
      // placeholderMatches 由来の全フィールドが埋まっている（欠落しない）。
      expect(match.adminNote).toBeNull();
      expect(match.category).toBeNull();
      expect(match.actualResult).toBeNull();
    });
  });

  it("fills model probabilities and a recommendation for every match", () => {
    rows1634.forEach((match) => {
      expect(typeof match.modelProb0).toBe("number");
      expect(typeof match.modelProb1).toBe("number");
      expect(typeof match.modelProb2).toBe("number");
      expect(match.recommendedOutcomes).toMatch(/^[012](,[012])?$/);
    });
  });

  it("reflects official votes: a heavy home favorite recommends home (1) first", () => {
    // 第1634回 第3試合: ドイツ vs キュラソー（officialVote1 = 0.9041）。
    const germany = rows1634[2];
    expect(germany.homeTeam).toBe("ドイツ");
    expect(germany.recommendedOutcomes?.startsWith("1")).toBe(true);
  });

  it("still models rounds without official votes via the competition fallback prior", () => {
    const payload1635 = buildFeaturedWorldTotoImportPayload(1635);
    const rows1635 = buildFeaturedWorldTotoMatchRows("round-1635", payload1635.rows);
    rows1635.forEach((match) => {
      expect(match.officialVote1).toBeNull();
      expect(typeof match.modelProb1).toBe("number");
    });
  });
});
