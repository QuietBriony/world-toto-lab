import { describe, expect, it } from "vitest";

import { buildResearchMemoPayload, filterResearchMemosForMatch } from "@/lib/research-memos";
import type { Match, ResearchMemo } from "@/lib/types";

describe("research memos", () => {
  it("builds a memo payload and preserves confidence", () => {
    const payload = buildResearchMemoPayload({
      confidence: "high",
      createdBy: "user-1",
      matchId: "match-1",
      memoType: "injury",
      roundId: "round-1",
      sourceDate: "2026-04-22",
      sourceName: "Jリーグ公式",
      sourceUrl: "https://example.com",
      summary: "  主力FWが欠場見込み  ",
      team: "  FC Example  ",
      title: "  欠場情報  ",
    });

    expect(payload.title).toBe("欠場情報");
    expect(payload.summary).toBe("主力FWが欠場見込み");
    expect(payload.team).toBe("FC Example");
    expect(payload.confidence).toBe("high");
  });

  it("filters memos by match or team", () => {
    const memos = [
      {
        confidence: "medium",
        createdAt: "",
        createdBy: "user-1",
        id: "memo-1",
        matchId: "match-1",
        memoType: "recent_form",
        roundId: "round-1",
        sourceDate: null,
        sourceName: null,
        sourceUrl: null,
        summary: "match memo",
        team: null,
        title: "memo 1",
        updatedAt: "",
      },
      {
        confidence: "low",
        createdAt: "",
        createdBy: "user-1",
        id: "memo-2",
        matchId: null,
        memoType: "news",
        roundId: "round-1",
        sourceDate: null,
        sourceName: null,
        sourceUrl: null,
        summary: "team memo",
        team: "Home FC",
        title: "memo 2",
        updatedAt: "",
      },
    ] as ResearchMemo[];

    const match = {
      awayTeam: "Away FC",
      homeTeam: "Home FC",
      id: "match-1",
    } as Match;

    expect(filterResearchMemosForMatch(memos, match).map((memo) => memo.id)).toEqual([
      "memo-1",
      "memo-2",
    ]);
  });
});
