import { describe, expect, it } from "vitest";

import { createMarketNodeFromHyperliquidUrl } from "@/lib/market-sources/hyperliquid";
import { marketNodeWarnings } from "@/lib/market-sources/quality";

const FRANCE_URL =
  "https://app.hyperliquid.xyz/trade/2026-world-cup-champion-france-yes";
const NOW = "2026-06-09T00:00:00.000Z";

function codes(node: Parameters<typeof marketNodeWarnings>[0], now = NOW) {
  return marketNodeWarnings(node, { now }).map((warning) => warning.code);
}

describe("marketNodeWarnings", () => {
  it("flags an upstream hyperliquid node with no mapping and no price", () => {
    const node = createMarketNodeFromHyperliquidUrl(FRANCE_URL, { now: NOW })!;
    const result = codes(node);
    expect(result).toContain("upstream_only");
    expect(result).toContain("mapping_missing");
    expect(result).toContain("no_price");
    expect(result).toContain("liquidity_unknown");
  });

  it("flags a manual price (and not no_price) once a price is entered", () => {
    const node = createMarketNodeFromHyperliquidUrl(FRANCE_URL, {
      manualPrice: { probability: 0.18, bid: 0.17, ask: 0.19, liquidityScore: 100 },
      now: NOW,
    })!;
    const result = codes(node);
    expect(result).toContain("manual_price");
    expect(result).not.toContain("no_price");
    expect(result).not.toContain("liquidity_unknown");
  });

  it("flags a wide spread", () => {
    const base = createMarketNodeFromHyperliquidUrl(FRANCE_URL, { now: NOW })!;
    const node = { ...base, spread: 0.2 };
    expect(codes(node)).toContain("spread_wide");
  });

  it("flags an API error", () => {
    const base = createMarketNodeFromHyperliquidUrl(FRANCE_URL, { now: NOW })!;
    const node = { ...base, lastApiError: "HTTP 500" };
    expect(codes(node)).toContain("api_error");
  });

  it("flags an old price", () => {
    const base = createMarketNodeFromHyperliquidUrl(FRANCE_URL, {
      manualPrice: { probability: 0.18 },
      now: "2026-01-01T00:00:00.000Z",
    })!;
    expect(codes(base, NOW)).toContain("old_price");
  });

  it("does not flag upstream_only for a downstream match node", () => {
    const base = createMarketNodeFromHyperliquidUrl(FRANCE_URL, { now: NOW })!;
    const node = {
      ...base,
      marketType: "individual_match_1x2" as const,
      signalLayer: "downstream_match_signal" as const,
    };
    expect(codes(node)).not.toContain("upstream_only");
  });
});
