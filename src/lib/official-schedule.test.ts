import { describe, expect, it } from "vitest";

import { parseOfficialScheduleText } from "@/lib/official-schedule";

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
});
