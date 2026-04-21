import { describe, expect, it } from "vitest";

import { buildSupabaseFunctionHeaders, looksLikeSupabaseJwt } from "@/lib/supabase";

describe("supabase function headers", () => {
  it("detects jwt-like keys", () => {
    expect(looksLikeSupabaseJwt("aaa.bbb.ccc")).toBe(true);
    expect(looksLikeSupabaseJwt("sb_publishable_123")).toBe(false);
  });

  it("adds Authorization for jwt-like keys", () => {
    expect(
      buildSupabaseFunctionHeaders("aaa.bbb.ccc", {
        "content-type": "application/json",
      }),
    ).toEqual({
      Authorization: "Bearer aaa.bbb.ccc",
      apikey: "aaa.bbb.ccc",
      "content-type": "application/json",
    });
  });

  it("omits Authorization for publishable keys", () => {
    expect(
      buildSupabaseFunctionHeaders("sb_publishable_123", {
        "content-type": "application/json",
      }),
    ).toEqual({
      apikey: "sb_publishable_123",
      "content-type": "application/json",
    });
  });
});
