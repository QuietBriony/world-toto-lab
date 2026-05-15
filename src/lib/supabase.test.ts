import { afterEach, describe, expect, it } from "vitest";

import {
  buildSupabaseFunctionHeaders,
  checkSupabaseHealth,
  looksLikeSupabaseJwt,
} from "@/lib/supabase";

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

afterEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseAnonKey;
});

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

describe("supabase health", () => {
  it("reports missing env without requiring a Supabase client", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    await expect(checkSupabaseHealth()).resolves.toMatchObject({
      status: "missing_env",
    });
  });
});
