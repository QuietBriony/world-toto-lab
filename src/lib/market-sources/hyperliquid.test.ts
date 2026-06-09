import { describe, expect, it } from "vitest";

import {
  buildAllMidsRequest,
  buildCandleSnapshotRequest,
  buildL2BookRequest,
  createMarketNodeFromHyperliquidUrl,
  extractHyperliquidSlug,
  findHyperliquidMapping,
  HYPERLIQUID_INFO_ENDPOINT,
  parseHyperliquidSlug,
  previewHyperliquidUrl,
} from "@/lib/market-sources/hyperliquid";
import type { HyperliquidSymbolMapping } from "@/lib/market-sources/types";

const FRANCE_URL =
  "https://app.hyperliquid.xyz/trade/2026-world-cup-champion-france-yes";
const FRANCE_SLUG = "2026-world-cup-champion-france-yes";

describe("extractHyperliquidSlug", () => {
  it("extracts the slug from a full trade URL", () => {
    expect(extractHyperliquidSlug(FRANCE_URL)).toBe(FRANCE_SLUG);
  });

  it("accepts a bare slug", () => {
    expect(extractHyperliquidSlug(FRANCE_SLUG)).toBe(FRANCE_SLUG);
  });

  it("accepts a schemeless host/path", () => {
    expect(
      extractHyperliquidSlug("app.hyperliquid.xyz/trade/2026-world-cup-champion-france-yes"),
    ).toBe(FRANCE_SLUG);
  });

  it("ignores query and hash", () => {
    expect(extractHyperliquidSlug(`${FRANCE_URL}?ref=abc#tab`)).toBe(FRANCE_SLUG);
  });

  it("returns null for unusable input", () => {
    expect(extractHyperliquidSlug("")).toBeNull();
    expect(extractHyperliquidSlug("not a url and not a slug !!")).toBeNull();
  });
});

describe("parseHyperliquidSlug", () => {
  it("infers competition, marketType, team, outcome and signal layer", () => {
    const parsed = parseHyperliquidSlug(FRANCE_SLUG);
    expect(parsed.competition).toBe("fifa_world_cup_2026");
    expect(parsed.marketType).toBe("outright_champion");
    expect(parsed.team).toBe("France");
    expect(parsed.outcomeLabel).toBe("YES");
    expect(parsed.signalLayer).toBe("upstream_team_prior");
    expect(parsed.recognized).toBe(true);
  });

  it("handles multi-word team slugs", () => {
    expect(parseHyperliquidSlug("2026-world-cup-champion-south-korea-yes").team).toBe(
      "South Korea",
    );
    expect(parseHyperliquidSlug("2026-world-cup-champion-saudi-arabia-yes").team).toBe(
      "Saudi Arabia",
    );
  });

  it("detects the NO outcome", () => {
    expect(parseHyperliquidSlug("2026-world-cup-champion-france-no").outcomeLabel).toBe("NO");
  });

  it("classifies group markets", () => {
    expect(parseHyperliquidSlug("2026-world-cup-group-a-winner-france").marketType).toBe(
      "group_winner",
    );
    expect(
      parseHyperliquidSlug("2026-world-cup-group-a-qualify-france").marketType,
    ).toBe("group_qualification");
  });

  it("falls back to manual_signal for unrecognized slugs", () => {
    const parsed = parseHyperliquidSlug("some-random-market-token");
    expect(parsed.marketType).toBe("manual_signal");
    expect(parsed.recognized).toBe(false);
    expect(parsed.competition).toBe("unknown");
  });
});

describe("createMarketNodeFromHyperliquidUrl", () => {
  it("creates a France champion MarketNode classified as upstream team prior", () => {
    const node = createMarketNodeFromHyperliquidUrl(FRANCE_URL, {
      now: "2026-06-09T00:00:00.000Z",
      id: "fixed-id",
    });
    expect(node).not.toBeNull();
    expect(node?.source).toBe("hyperliquid");
    expect(node?.slug).toBe(FRANCE_SLUG);
    expect(node?.competition).toBe("fifa_world_cup_2026");
    expect(node?.marketType).toBe("outright_champion");
    expect(node?.team).toBe("France");
    expect(node?.outcomeLabel).toBe("YES");
    expect(node?.signalLayer).toBe("upstream_team_prior");
    expect(node?.weight).toBe(0.2);
    expect(node?.externalUrl).toBe(FRANCE_URL);
  });

  it("returns null for an unparseable URL", () => {
    expect(createMarketNodeFromHyperliquidUrl("???")).toBeNull();
  });

  it("stores a manual price when provided", () => {
    const node = createMarketNodeFromHyperliquidUrl(FRANCE_URL, {
      manualPrice: { probability: 0.18, mid: 0.18 },
      now: "2026-06-09T00:00:00.000Z",
    });
    expect(node?.probability).toBe(0.18);
    expect(node?.priceSource).toBe("manual");
    expect(node?.lastFetchedAt).toBe("2026-06-09T00:00:00.000Z");
  });
});

describe("symbol mapping (missing → manual)", () => {
  it("leaves externalSymbol null and price source none when no mapping exists", () => {
    const preview = previewHyperliquidUrl(FRANCE_URL);
    expect(preview?.mappingStatus).toBe("missing");
    expect(preview?.mapping).toBeNull();

    const node = createMarketNodeFromHyperliquidUrl(FRANCE_URL);
    expect(node?.externalSymbol).toBeNull();
    expect(node?.priceSource).toBe("none");
    expect(node?.probability).toBeNull();
  });

  it("uses the coin from a provided mapping when present", () => {
    const mappings: HyperliquidSymbolMapping[] = [
      {
        slug: FRANCE_SLUG,
        coin: "WC26-FRA",
        dex: null,
        sourceUrl: FRANCE_URL,
        notes: null,
      },
    ];
    expect(findHyperliquidMapping(FRANCE_SLUG, mappings)?.coin).toBe("WC26-FRA");

    const node = createMarketNodeFromHyperliquidUrl(FRANCE_URL, { mappings });
    expect(node?.externalSymbol).toBe("WC26-FRA");

    const preview = previewHyperliquidUrl(FRANCE_URL, mappings);
    expect(preview?.mappingStatus).toBe("mapped");
  });
});

describe("read-only info request builders", () => {
  it("builds allMids / l2Book / candleSnapshot against the public info endpoint", () => {
    const allMids = buildAllMidsRequest();
    expect(allMids.url).toBe(HYPERLIQUID_INFO_ENDPOINT);
    expect(allMids.method).toBe("POST");
    expect(JSON.parse(allMids.body)).toEqual({ type: "allMids" });

    const book = buildL2BookRequest("WC26-FRA");
    expect(book.url).toBe(HYPERLIQUID_INFO_ENDPOINT);
    expect(JSON.parse(book.body)).toEqual({ type: "l2Book", coin: "WC26-FRA" });

    const candle = buildCandleSnapshotRequest({
      coin: "WC26-FRA",
      interval: "1h",
      startTime: 1,
      endTime: 2,
    });
    expect(candle.url).toBe(HYPERLIQUID_INFO_ENDPOINT);
    expect(JSON.parse(candle.body)).toEqual({
      type: "candleSnapshot",
      req: { coin: "WC26-FRA", interval: "1h", startTime: 1, endTime: 2 },
    });
  });
});
