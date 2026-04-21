import { describe, expect, it } from "vitest";

import {
  matchOfficialRowsToFixtures,
  parseTotoOfficialRoundCsv,
} from "@/lib/toto-official-import";
import type { FixtureMaster } from "@/lib/types";

function buildFixture(overrides: Partial<FixtureMaster> = {}): FixtureMaster {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    competition: "fifa_world_cup_2026",
    source: "fifa_official_manual",
    sourceUrl: null,
    sourceText: null,
    externalFixtureId: null,
    matchDate: "2026-06-11",
    kickoffTime: "2026-06-11T19:00:00.000Z",
    timezone: null,
    homeTeam: "Mexico",
    awayTeam: "South Africa",
    groupName: "Group A",
    stage: "Group Stage",
    venue: "Mexico City Stadium",
    city: null,
    country: null,
    dataConfidence: "official",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("toto official import parser", () => {
  it("parses csv rows and normalizes 0.52 / 52% / 52 into probabilities", () => {
    const result = parseTotoOfficialRoundCsv({
      sourceText: [
        "official_match_no,home_team,away_team,kickoff_time,venue,stage,official_vote_1,official_vote_0,official_vote_2",
        "1,Mexico,South Africa,2026-06-11 19:00,Mexico City Stadium,Group A,0.52,28%,20",
      ].join("\n"),
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.officialVote1).toBeCloseTo(0.52);
    expect(result.rows[0]?.officialVote0).toBeCloseTo(0.28);
    expect(result.rows[0]?.officialVote2).toBeCloseTo(0.2);
  });

  it("warns when official vote totals are far from 1", () => {
    const result = parseTotoOfficialRoundCsv({
      sourceText: [
        "official_match_no,home_team,away_team,kickoff_time,venue,stage,official_vote_1,official_vote_0,official_vote_2",
        "1,Mexico,South Africa,2026-06-11 19:00,Mexico City Stadium,Group A,0.52,0.28,0.5",
      ].join("\n"),
    });

    expect(result.rows[0]?.warnings.join(" ")).toContain("合計が1から大きくズレています");
  });

  it("fuzzy matches rows to fixture master and warns when multiple candidates exist", () => {
    const row = parseTotoOfficialRoundCsv({
      sourceText: [
        "official_match_no,home_team,away_team,kickoff_time,venue,stage,official_vote_1,official_vote_0,official_vote_2",
        "1,Mexico,South Africa,2026-06-11 19:00,Mexico City Stadium,Group A,0.52,0.28,0.2",
      ].join("\n"),
    }).rows[0];

    const matched = matchOfficialRowsToFixtures(
      [row],
      [
        buildFixture({ id: "fixture-a" }),
        buildFixture({ id: "fixture-b", venue: "Mexico City Stadium Annex" }),
      ],
    );

    expect(matched[0]?.fixtureCandidates).toHaveLength(2);
    expect(matched[0]?.warnings.join(" ")).toContain("管理者確認");
  });
});
