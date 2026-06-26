import { describe, expect, it } from "vitest";

import * as marketSources from "@/lib/market-sources";
import * as hyperliquid from "@/lib/market-sources/hyperliquid";
import * as polymarket from "@/lib/market-sources/polymarket";

/**
 * この連携は read-only な市場データソースである。
 * 売買・wallet 接続・注文・署名などの取引サーフェスを「足さない」ことを担保する。
 */
// 注意: "signal"（normalizeMarketSignal / buildSignalBoard など）に誤反応しないよう、
// 署名系は signTransaction / signMessage 等の具体名のみを禁止対象にする。
const FORBIDDEN_SURFACE =
  /(wallet|order|buy|sell|execute|submit|cancel|withdraw|deposit|leverage|position|approve|transfer|allowance|signtransaction|signmessage|signtypeddata|privatekey|mnemonic|exchangeendpoint)/i;

describe("[no-trading] market sources expose only read-only surface", () => {
  it("has no export resembling a trading / wallet / order action", () => {
    const names = [
      ...Object.keys(marketSources),
      ...Object.keys(hyperliquid),
      ...Object.keys(polymarket),
    ];
    const offenders = names.filter((name) => FORBIDDEN_SURFACE.test(name));
    expect(offenders).toEqual([]);
  });

  it("only talks to the public Hyperliquid info endpoint", () => {
    expect(hyperliquid.HYPERLIQUID_INFO_ENDPOINT).toBe("https://api.hyperliquid.xyz/info");
    expect(hyperliquid.HYPERLIQUID_INFO_ENDPOINT).toContain("/info");
    // info endpoint は read-only。exchange（発注）endpoint を持たない。
    expect(hyperliquid.HYPERLIQUID_INFO_ENDPOINT).not.toContain("exchange");

    for (const builder of [
      hyperliquid.buildAllMidsRequest(),
      hyperliquid.buildL2BookRequest("X"),
      hyperliquid.buildCandleSnapshotRequest({
        coin: "X",
        interval: "1h",
        startTime: 0,
        endTime: 1,
      }),
    ]) {
      expect(builder.url).toBe("https://api.hyperliquid.xyz/info");
      expect(builder.url).not.toContain("exchange");
    }
  });

  it("info request bodies only contain read query types (no order actions)", () => {
    const bodies = [
      hyperliquid.buildAllMidsRequest().body,
      hyperliquid.buildL2BookRequest("X").body,
      hyperliquid.buildCandleSnapshotRequest({
        coin: "X",
        interval: "1h",
        startTime: 0,
        endTime: 1,
      }).body,
    ];
    const readTypes = new Set(["allMids", "l2Book", "candleSnapshot"]);
    for (const body of bodies) {
      const parsed = JSON.parse(body) as { type: string };
      expect(readTypes.has(parsed.type)).toBe(true);
    }
  });

  it("Polymarket requests are GET-only public Data API reads", () => {
    const requests = polymarket.buildPolymarketTraderSnapshotRequests(
      polymarket.BLUNTTEDGE_WATCH_CANDIDATE.address,
    );
    for (const request of requests) {
      expect(request.method).toBe("GET");
      expect(request.readOnly).toBe(true);
      expect(request.url).toContain(polymarket.POLYMARKET_DATA_API_BASE);
      expect(request.url).not.toContain("clob");
      expect(request.url).not.toContain("exchange");
    }
  });
});
