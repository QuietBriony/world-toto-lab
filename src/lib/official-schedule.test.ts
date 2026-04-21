import { describe, expect, it } from "vitest";

import {
  buildFifaOfficialPageApiUrl,
  buildOfficialScheduleBookmarklet,
  extractOfficialScheduleSourceTextFromFifaRichText,
  parseOfficialScheduleText,
  parseOfficialScheduleTransferPayload,
  supplementOfficialScheduleSourceTextWithCalendarMatches,
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
    expect(result.warnings).toEqual([
      "このソースには kickoff time が含まれていないため、時刻は未入力のままです。",
    ]);
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

  it("builds a FIFA official page API url from an article url", () => {
    expect(
      buildFifaOfficialPageApiUrl(
        "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums",
      ),
    ).toBe(
      "https://cxm-api.fifa.com/fifaplusweb/api/pages/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums",
    );
  });

  it("extracts schedule-looking text from FIFA richtext blocks", () => {
    const richtext = {
      nodeType: "document",
      content: [
        {
          nodeType: "heading-3",
          content: [{ nodeType: "text", value: "FIFA World Cup 2026 Group Stage fixtures" }],
        },
        {
          nodeType: "heading-4",
          content: [{ nodeType: "text", value: "Thursday, 11 June 2026" }],
        },
        {
          nodeType: "paragraph",
          content: [
            {
              nodeType: "hyperlink",
              content: [{ nodeType: "text", value: "Mexico v South Africa" }],
            },
            { nodeType: "text", value: " - " },
            { nodeType: "text", value: "Group A" },
            { nodeType: "text", value: " – " },
            { nodeType: "text", value: "Mexico City Stadium" },
            { nodeType: "text", value: "\n" },
            {
              nodeType: "hyperlink",
              content: [{ nodeType: "text", value: "Korea Republic v Czechia" }],
            },
            { nodeType: "text", value: " - " },
            { nodeType: "text", value: "Group A" },
            { nodeType: "text", value: " – " },
            { nodeType: "text", value: "Estadio Guadalajara" },
          ],
        },
      ],
    };

    expect(extractOfficialScheduleSourceTextFromFifaRichText(richtext)).toBe(
      [
        "Thursday, 11 June 2026",
        "Mexico v South Africa - Group A – Mexico City Stadium",
        "Korea Republic v Czechia - Group A – Estadio Guadalajara",
      ].join("\n"),
    );
  });

  it("splits compound FIFA paragraphs into one fixture per line", () => {
    const result = parseOfficialScheduleText({
      sourceText: [
        "Sunday, 28 June 2026",
        "Match 73 – Group A runners-up v Group B runners-up - Los Angeles Stadium Match 74 – Group E winners v Group A/B/C/D/F third place - Boston Stadium Match 75 – Group F winners v Group C runners-up - Estadio Monterrey",
      ].join("\n"),
    });

    expect(result.fixtures).toHaveLength(3);
    expect(result.fixtures[0]?.homeTeam).toBe("Group A runners-up");
    expect(result.fixtures[0]?.awayTeam).toBe("Group B runners-up");
    expect(result.fixtures[1]?.venue).toBe("Boston Stadium");
    expect(result.fixtures[2]?.venue).toBe("Estadio Monterrey");
    expect(result.warnings).toEqual([
      "このソースには kickoff time が含まれていないため、時刻は未入力のままです。",
    ]);
  });

  it("supplements kickoff times from the official FIFA calendar API rows", () => {
    const sourceText = [
      "Thursday, 11 June 2026",
      "Mexico v South Africa - Group A – Mexico City Stadium",
      "Korea Republic v Czechia - Group A – Estadio Guadalajara",
      "Sunday, 28 June 2026",
      "Group A runners-up v Group B runners-up - Los Angeles Stadium",
      "Saturday, 18 July 2026",
      "Runner-up match 101 v Runner-up match 102 - Miami Stadium",
    ].join("\n");

    const supplemented = supplementOfficialScheduleSourceTextWithCalendarMatches(sourceText, [
      {
        Away: { TeamName: [{ Description: "South Africa" }] },
        Date: "2026-06-11T19:00:00Z",
        Home: { TeamName: [{ Description: "Mexico" }] },
        LocalDate: "2026-06-11T13:00:00Z",
        MatchNumber: 1,
        Stadium: { Name: [{ Description: "Mexico City Stadium" }] },
      },
      {
        Away: { TeamName: [{ Description: "Czechia" }] },
        Date: "2026-06-12T02:00:00Z",
        Home: { TeamName: [{ Description: "Korea Republic" }] },
        LocalDate: "2026-06-11T20:00:00Z",
        MatchNumber: 2,
        Stadium: { Name: [{ Description: "Guadalajara Stadium" }] },
      },
      {
        Date: "2026-06-28T19:00:00Z",
        LocalDate: "2026-06-28T12:00:00Z",
        MatchNumber: 73,
        PlaceHolderA: "2A",
        PlaceHolderB: "2B",
        Stadium: { Name: [{ Description: "Los Angeles Stadium" }] },
      },
      {
        Date: "2026-07-18T21:00:00Z",
        LocalDate: "2026-07-18T17:00:00Z",
        MatchNumber: 103,
        PlaceHolderA: "RU101",
        PlaceHolderB: "RU102",
        Stadium: { Name: [{ Description: "Miami Stadium" }] },
      },
    ]);

    expect(supplemented.sourceText).toContain(
      "Mexico v South Africa - Group A – Mexico City Stadium - 13:00",
    );
    expect(supplemented.sourceText).toContain(
      "Korea Republic v Czechia - Group A – Estadio Guadalajara - 20:00",
    );
    expect(supplemented.sourceText).toContain(
      "Group A runners-up v Group B runners-up - Los Angeles Stadium - 12:00",
    );
    expect(supplemented.sourceText).toContain(
      "Runner-up match 101 v Runner-up match 102 - Miami Stadium - 17:00",
    );
    expect(supplemented.supplementedCount).toBe(4);
    expect(supplemented.unsupplementedCount).toBe(0);
  });
});
