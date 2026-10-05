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

  it("wires the 1637 Polymarket signal into the model base when the round number is given", () => {
    const payload = buildFeaturedWorldTotoImportPayload(1637);
    const withSignal = buildFeaturedWorldTotoMatchRows("round-1637", payload.rows, 1637);
    const withoutSignal = buildFeaturedWorldTotoMatchRows("round-1637", payload.rows);

    const m01 = withSignal.find((match) => match.officialMatchNo === 1);
    const m01NoSignal = withoutSignal.find((match) => match.officialMatchNo === 1);
    expect(m01).toBeDefined();
    expect(m01?.homeTeam).toBe("エクアドル");
    expect(m01?.awayTeam).toBe("ドイツ");

    // 実市場(Polymarket)が marketProb 列に通電される。無シグナル版は強度シードを保存しない。
    expect(m01?.marketProb2).not.toBeNull();
    expect(m01NoSignal?.marketProb2).toBeNull();
    // 公衆票もシグナルから充填（無シグナル版は scheduledMatch で null）。
    expect(m01?.officialVote2).not.toBeNull();
    expect(m01NoSignal?.officialVote2).toBeNull();

    if (
      m01?.modelProb1 == null ||
      m01.modelProb2 == null ||
      m01.officialVote1 == null ||
      m01.officialVote2 == null
    ) {
      throw new Error("1637 第1試合のモデル確率と公衆票が揃っていません");
    }

    // 市場はドイツ(2)を公衆より低く見るので、モデル本命(2)は公衆票(2)を下回る
    //（公衆過信を割り引いたモデル）。値はハードコードしない。
    expect(m01.modelProb2).toBeLessThan(m01.officialVote2);
    // Edge = モデル − 公衆 が underdog(エクアドル=1)で正＝公衆が過小評価していたことを surface。
    expect(m01.modelProb1 - m01.officialVote1).toBeGreaterThan(0);
  });

  it("leaves rounds without a market overlay on the country-strength model (unchanged)", () => {
    // 第1636回は overlay 無し。round number を渡しても marketProb は保存されない（挙動不変）。
    const payload = buildFeaturedWorldTotoImportPayload(1636);
    const rows = buildFeaturedWorldTotoMatchRows("round-1636", payload.rows, 1636);
    rows.forEach((match) => {
      expect(match.marketProb1).toBeNull();
      expect(match.marketProb0).toBeNull();
      expect(match.marketProb2).toBeNull();
    });
  });
});
