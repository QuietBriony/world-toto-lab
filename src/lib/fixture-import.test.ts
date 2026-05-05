import { describe, expect, it } from "vitest";

import { parseFixtureImportText } from "@/lib/fixture-import";

describe("fixture import parser", () => {
  it("parses quoted comma cells without shifting fixture columns", () => {
    const result = parseFixtureImportText(
      [
        "番号,開始日時,ホーム,アウェイ,会場,ステージ,メモ",
        '1,2026-06-11 19:00,チームA,チームB,"Mexico City, Stadium",グループA,"公式日程, 補完"',
      ].join("\n"),
    );

    expect(result.warnings).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      adminNote: "公式日程, 補完",
      awayTeam: "チームB",
      homeTeam: "チームA",
      matchNo: 1,
      stage: "グループA",
      venue: "Mexico City, Stadium",
    });
  });
});
