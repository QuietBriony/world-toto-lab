import { describe, expect, it } from "vitest";

import { buildOfficialRoundImportHref, buildRoundHref } from "@/lib/round-links";

describe("round links", () => {
  it("builds a round-aware href with query params", () => {
    expect(
      buildRoundHref("/pick-room", "round-123", {
        user: "user-456",
      }),
    ).toBe("/pick-room?round=round-123&user=user-456");
  });

  it("keeps round id when building the play page route", () => {
    expect(
      buildRoundHref("/play", "round-123", {
        user: "user-456",
      }),
    ).toBe("/play?round=round-123&user=user-456");
  });

  it("builds an official import href with product and auto-sync options", () => {
    expect(
      buildOfficialRoundImportHref("round-123", {
        autoApply: true,
        autoSync: true,
        productType: "mini_toto",
        sourcePreset: "yahoo_toto_schedule",
      }),
    ).toBe(
      "/toto-official-round-import?round=round-123&autoApply=1&autoSync=1&productType=mini_toto&sourcePreset=yahoo_toto_schedule",
    );
  });

  it("builds a WINNER import href without forcing auto-sync", () => {
    expect(
      buildOfficialRoundImportHref("round-123", {
        productType: "winner",
        sourcePreset: "toto_official_detail",
      }),
    ).toBe(
      "/toto-official-round-import?round=round-123&productType=winner&sourcePreset=toto_official_detail",
    );
  });
});
