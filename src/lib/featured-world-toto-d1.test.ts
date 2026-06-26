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

  it("models no-vote rounds from the country-strength model (home favorite → 1)", () => {
    const rows1635 = buildFeaturedWorldTotoMatchRows(
      "round-1635",
      buildFeaturedWorldTotoImportPayload(1635).rows,
    );
    // 第1635回: ブラジル(94) vs ハイチ(66) は票なしでも強度差で home(1) 本命。
    const brazil = rows1635.find(
      (match) => match.homeTeam === "ブラジル" && match.awayTeam === "ハイチ",
    );
    expect(brazil).toBeDefined();
    expect(brazil?.officialVote1).toBeNull();
    expect(brazil?.recommendedOutcomes?.startsWith("1")).toBe(true);
  });

  it("varies no-vote recommendations by matchup (away favorite → 2, not a flat prior)", () => {
    const rows1637 = buildFeaturedWorldTotoMatchRows(
      "round-1637",
      buildFeaturedWorldTotoImportPayload(1637).rows,
    );
    // 第1637回: エクアドル(82) vs ドイツ(90) は away(ドイツ)が上 → 2 を先頭推奨。
    const m = rows1637.find(
      (match) => match.homeTeam === "エクアドル" && match.awayTeam === "ドイツ",
    );
    expect(m).toBeDefined();
    expect(m?.officialVote1).toBeNull();
    expect(m?.recommendedOutcomes?.startsWith("2")).toBe(true);
  });

  it("feeds Polymarket market signal into the 1637 model (ドイツ戦の教訓: 公衆が捨てた穴を surface)", () => {
    // round 番号を渡すと市場(Polymarket)シグナルが通電する。
    const rows1637 = buildFeaturedWorldTotoMatchRows(
      "round-1637",
      buildFeaturedWorldTotoImportPayload(1637).rows,
      1637,
    );
    // 第1637回 第1試合 エクアドル(home) vs ドイツ(away)。
    // 公衆: ドイツ(2)=80.6% / Polymarket: ドイツ(2)=52.2%・エクアドル(1)=25.4%・分(0)=22.4%。
    const m = rows1637.find(
      (match) => match.homeTeam === "エクアドル" && match.awayTeam === "ドイツ",
    );
    expect(m).toBeDefined();
    // 公衆票が市場シグナルから載る（null から 80.6% へ）。
    expect(m?.officialVote2).toBeCloseTo(0.8062, 3);
    // 実市場(Polymarket)が marketProb 列に保存される。
    expect(m?.marketProb2).toBeCloseTo(0.5224, 3);
    // モデルは市場ベース＝ドイツ過信が解け 60% 未満に。
    expect(m?.modelProb2).toBeLessThan(0.6);
    // エクアドル(1)＝公衆が捨てた側が推奨上位2に surface する（本命2は維持）。
    expect(m?.recommendedOutcomes?.startsWith("2")).toBe(true);
    expect(m?.recommendedOutcomes).toContain("1");
  });
});
