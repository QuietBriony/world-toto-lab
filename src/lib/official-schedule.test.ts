import { describe, expect, it } from "vitest";

import {
  buildOfficialScheduleBookmarklet,
  parseOfficialScheduleText,
  parseOfficialScheduleTransferPayload,
} from "@/lib/official-schedule";

describe("official schedule parser", () => {
  it("parses fifa-style schedule text and carries date headers", () => {
    const result = parseOfficialScheduleText({
      sourceText: [
        "Thursday, 11 June 2026",
        "Mexico v South Africa - Group A – Mexico City Stadium",
        "Korea Republic vs Czechia – Group A - Estadio Guadalajara",
      ].join("\n"),
    });

    expect(result.fixtures).toHaveLength(2);
    expect(result.fixtures[0]?.matchDate).toBe("2026-06-11");
    expect(result.fixtures[1]?.matchDate).toBe("2026-06-11");
    expect(result.fixtures[0]?.groupName).toBe("Group A");
    expect(result.fixtures[0]?.venue).toBe("Mexico City Stadium");
  });

  it("supports v, vs, and 対 separators", () => {
    const result = parseOfficialScheduleText({
      sourceText: [
        "Friday, 12 June 2026",
        "Canada v Bosnia and Herzegovina - Group B – Toronto Stadium",
        "USA vs Paraguay - Group D – Los Angeles Stadium",
        "Japan 対 Netherlands - Group F – Dallas Stadium",
      ].join("\n"),
    });

    expect(result.fixtures.map((fixture) => fixture.homeTeam)).toEqual([
      "Canada",
      "USA",
      "Japan",
    ]);
    expect(result.fixtures.map((fixture) => fixture.awayTeam)).toEqual([
      "Bosnia and Herzegovina",
      "Paraguay",
      "Netherlands",
    ]);
  });

  it("filters noisy FIFA article body text and keeps only schedule rows", () => {
    const result = parseOfficialScheduleText({
      sourceText: [
        "Skip to main content",
        "View the FIFA World Cup 2026 match schedule",
        "Published",
        "31 Mar 2026",
        "On this page you'll find the full FIFA World Cup 2026 schedule.",
        "FIFA World Cup 2026 Group Stage fixtures",
        "Thursday, 11 June 2026",
        "Mexico v South Africa - Group A – Mexico City Stadium",
        "Korea Republic v Czechia – Group A - Estadio Guadalajara",
        "View this post on Instagram",
        "Friday, 12 June 2026",
        "Canada v Bosnia and Herzegovina - Group B – Toronto Stadium",
        "USA v Paraguay - Group D – Los Angeles Stadium",
        "Shop now",
      ].join("\n"),
    });

    expect(result.fixtures).toHaveLength(4);
    expect(result.warnings).toEqual([]);
    expect(result.fixtures[2]?.homeTeam).toBe("Canada");
    expect(result.fixtures[3]?.awayTeam).toBe("Paraguay");
  });

  it("parses transferred schedule payload from window.name", () => {
    const payload = JSON.stringify({
      importedAt: "2026-04-21T00:00:00.000Z",
      kind: "world_toto_lab_official_schedule_import",
      sourceText: "Thursday, 11 June 2026\nMexico v South Africa - Group A – Mexico City Stadium",
      sourceUrl:
        "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums",
      version: 1,
    });

    expect(parseOfficialScheduleTransferPayload(payload)).toEqual({
      importedAt: "2026-04-21T00:00:00.000Z",
      kind: "world_toto_lab_official_schedule_import",
      sourceText: "Thursday, 11 June 2026\nMexico v South Africa - Group A – Mexico City Stadium",
      sourceUrl:
        "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums",
      version: 1,
    });
  });

  it("builds a bookmarklet that returns to the import page", () => {
    const bookmarklet = buildOfficialScheduleBookmarklet(
      "https://quietbriony.github.io/world-toto-lab/official-schedule-import/?round=test-round",
    );

    expect(bookmarklet.startsWith("javascript:(() => {")).toBe(true);
    expect(bookmarklet).toContain("window.name = JSON.stringify(payload)");
    expect(bookmarklet).toContain("quietbriony.github.io/world-toto-lab/official-schedule-import/?round=test-round");
  });
});
