import { describe, expect, it } from "vitest";

import {
  BLUNTTEDGE_WATCH_CANDIDATE,
  buildPolymarketLeaderboardRequest,
  buildPolymarketTraderSnapshotRequests,
  createBlunttedgeSeedSignal,
  normalizePolymarketTraderSnapshot,
  POLYMARKET_DATA_API_BASE,
} from "@/lib/market-sources/polymarket";

const ADDRESS = BLUNTTEDGE_WATCH_CANDIDATE.address;

describe("polymarket trader signals", () => {
  it("builds read-only GET requests against the public Data API", () => {
    const leaderboard = buildPolymarketLeaderboardRequest({
      category: "SPORTS",
      limit: 20,
      timePeriod: "MONTH",
    });
    expect(leaderboard.method).toBe("GET");
    expect(leaderboard.readOnly).toBe(true);
    expect(leaderboard.url).toContain(POLYMARKET_DATA_API_BASE);
    expect(leaderboard.url).toContain("orderBy=PNL");

    const requests = buildPolymarketTraderSnapshotRequests(ADDRESS, { limit: 10 });
    expect(requests).toHaveLength(4);
    expect(requests.every((request) => request.method === "GET" && request.readOnly)).toBe(true);
    expect(requests.map((request) => request.label)).toEqual([
      "leaderboard",
      "markets",
      "activity",
      "value",
    ]);
  });

  it("normalizes the screenshot-like blunttedge evidence into a trader snapshot", () => {
    const snapshot = normalizePolymarketTraderSnapshot({
      address: ADDRESS,
      observedAt: "2026-06-26T00:00:00.000Z",
      leaderboardRows: [
        {
          proxyWallet: ADDRESS,
          rank: "7",
          userName: "blunttedge",
          vol: 19_001_698.92,
          pnl: 3_430_093.5,
        },
      ],
      marketRows: [
        {
          asset: "asset-japan-no",
          cashPnl: 4_081_972.85,
          conditionId: "condition-japan",
          currentValue: 10_954_471.44,
          eventSlug: "fifwc-jpn-swe-2026-06-25",
          initialValue: 6_872_498.59,
          outcome: "No",
          slug: "fifwc-jpn-swe-2026-06-25-jpn",
          title: "Will Japan win on 2026-06-25?",
        },
      ],
      activityRows: [
        {
          asset: "asset-japan-no",
          conditionId: "condition-japan",
          eventSlug: "fifwc-jpn-swe-2026-06-25",
          name: "blunttedge",
          outcome: "No",
          price: 0.615,
          side: "BUY",
          size: 542_337.91,
          slug: "fifwc-jpn-swe-2026-06-25-jpn",
          timestamp: 1_782_428_414,
          title: "Will Japan win on 2026-06-25?",
          usdcSize: 333_000,
        },
      ],
      valueRows: [{ user: ADDRESS, value: 10_910_067.63 }],
    });

    expect(snapshot.trader.id).toBe(`polymarket-trader-${ADDRESS}`);
    expect(snapshot.trader.displayName).toBe("blunttedge");
    expect(snapshot.trader.biggestWin).toBeCloseTo(4_081_972.85, 2);
    expect(snapshot.trader.biggestWinTitle).toBe("Will Japan win on 2026-06-25?");
    expect(snapshot.trader.currentValue).toBeCloseTo(10_910_067.63, 2);
    expect(snapshot.trader.predictionCount).toBe(1);
    expect(snapshot.marketSignals).toHaveLength(2);
    expect(snapshot.marketSignals[0]?.signalDirection).toBe("opposes_outcome");
  });

  it("creates a seed signal for the suspected strong account", () => {
    const seed = createBlunttedgeSeedSignal("2026-06-26T00:00:00.000Z");
    expect(seed.address).toBe(ADDRESS);
    expect(seed.displayName).toBe("blunttedge");
    expect(seed.predictionCount).toBe(3);
    expect(seed.biggestWin).toBe(4_100_000);
    expect(seed.notes).toContain("Japan vs Sweden");
  });
});
