import { describe, expect, it } from "vitest";

import {
  buildGoal3EventWatch,
  buildGoal3VoteRows,
  deriveGoal3VoteRateUrl,
  isGoal3LibraryEntry,
  pickFeaturedGoal3Entry,
} from "@/lib/goal3";
import type { TotoOfficialRoundLibraryEntry } from "@/lib/types";

const baseEntry: TotoOfficialRoundLibraryEntry = {
  carryoverYen: 2_000_000_000,
  createdAt: "2026-04-21T00:00:00+09:00",
  firstPrizeShare: 0.6,
  id: "goal3-1",
  matchCount: 3,
  matches: [
    {
      actualResult: null,
      awayTeam: "名古屋",
      fixtureMasterId: null,
      homeTeam: "清水",
      kickoffTime: "2026-04-25T14:00:00+09:00",
      matchStatus: "scheduled",
      officialMatchNo: 1,
      officialVote0: null,
      officialVote1: null,
      officialVote2: null,
      sourceText: null,
      stage: null,
      venue: "アイスタ",
    },
    {
      actualResult: null,
      awayTeam: "福岡",
      fixtureMasterId: null,
      homeTeam: "岡山",
      kickoffTime: "2026-04-25T14:00:00+09:00",
      matchStatus: "scheduled",
      officialMatchNo: 2,
      officialVote0: null,
      officialVote1: null,
      officialVote2: null,
      sourceText: null,
      stage: null,
      venue: "JFE晴れの国",
    },
    {
      actualResult: null,
      awayTeam: "千葉",
      fixtureMasterId: null,
      homeTeam: "川崎F",
      kickoffTime: "2026-04-25T15:00:00+09:00",
      matchStatus: "scheduled",
      officialMatchNo: 3,
      officialVote0: null,
      officialVote1: null,
      officialVote2: null,
      sourceText: null,
      stage: null,
      venue: "Uvance",
    },
  ],
  notes: null,
  officialRoundName: "第1624回 totoGOAL3",
  officialRoundNumber: 1624,
  outcomeSetJson: ["0", "1", "2", "3+"],
  payoutCapYen: null,
  productType: "custom",
  requiredMatchCount: 6,
  resultStatus: "selling",
  returnRate: 0.5,
  salesEndAt: null,
  salesStartAt: null,
  sourceNote: "スポーツくじオフィシャルサイト くじ情報 / totoGOAL3 Value Board",
  sourceText: null,
  sourceUrl:
    "https://store.toto-dream.com/dcs/subos/screen/pi01/spin000/PGSPIN00001DisptotoLotInfo.form?holdCntId=1624",
  stakeYen: 100,
  title: "第1624回 totoGOAL3",
  totalSalesYen: 3_500_000_000,
  updatedAt: "2026-04-21T12:00:00+09:00",
  voidHandling: "manual",
};

describe("goal3 helpers", () => {
  it("detects GOAL3 library entries and derives vote-rate url", () => {
    expect(isGoal3LibraryEntry(baseEntry)).toBe(true);
    expect(deriveGoal3VoteRateUrl(baseEntry.sourceUrl)).toContain("commodityId=02");
  });

  it("builds watch snapshot using event-level EV", () => {
    const watch = buildGoal3EventWatch(baseEntry);
    expect(watch.summary.approxEvMultiple).toBeCloseTo(1.0714, 3);
    expect(watch.requiresAttention).toBe(true);
  });

  it("builds 6 team vote rows from live snapshot rows", () => {
    const rows = buildGoal3VoteRows({
      entry: baseEntry,
      liveEntry: {
        matches: [
          {
            actualResult: null,
            awayTeam: "",
            goal3FixtureNo: 1,
            goal3TeamRole: "home",
            homeTeam: "清水",
            kickoffTime: "2026-04-25T14:00:00+09:00",
            matchStatus: "scheduled",
            officialMatchNo: 1,
            officialVote0: 0.19,
            officialVote1: 0.35,
            officialVote2: 0.28,
            officialVote3: 0.18,
            sourceText: null,
            stage: "ホーム",
            venue: null,
          },
          {
            actualResult: null,
            awayTeam: "",
            goal3FixtureNo: 1,
            goal3TeamRole: "away",
            homeTeam: "名古屋",
            kickoffTime: "2026-04-25T14:00:00+09:00",
            matchStatus: "scheduled",
            officialMatchNo: 2,
            officialVote0: 0.18,
            officialVote1: 0.34,
            officialVote2: 0.30,
            officialVote3: 0.18,
            sourceText: null,
            stage: "アウェイ",
            venue: null,
          },
        ],
      },
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.opponentTeam).toBe("名古屋");
    expect(rows[0]?.venue).toBe("アイスタ");
    expect(rows[0]?.topPublicOutcome).toBe("1");
    expect(rows[0]?.payoutProxy["1"]).toBeGreaterThan(1);
  });

  it("prioritizes attention-worthy entries when picking the featured entry", () => {
    const laterNormal = {
      ...baseEntry,
      carryoverYen: 0,
      id: "goal3-2",
      officialRoundNumber: 1625,
      title: "第1625回 totoGOAL3",
      updatedAt: "2026-04-22T00:00:00+09:00",
    };

    expect(pickFeaturedGoal3Entry([laterNormal, baseEntry])?.id).toBe("goal3-1");
  });
});
