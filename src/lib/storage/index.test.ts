import { describe, expect, it } from "vitest";

import { getStorageAdapter, resolveStorageMode } from "@/lib/storage";

describe("resolveStorageMode", () => {
  it("honors an explicit mode above everything else", () => {
    expect(resolveStorageMode({ explicitMode: "cloudflare_d1" })).toBe(
      "cloudflare_d1",
    );
    expect(
      resolveStorageMode({ explicitMode: "supabase", d1ApiBase: "https://x" }),
    ).toBe("supabase");
    expect(resolveStorageMode({ explicitMode: "nonsense" })).toBe("local");
  });

  it("prefers cloudflare_d1 when a D1 API base is configured (auto)", () => {
    expect(
      resolveStorageMode({ d1ApiBase: "https://world-toto-lab-api.workers.dev" }),
    ).toBe("cloudflare_d1");
  });

  it("uses supabase when env is present and healthy (auto)", () => {
    expect(
      resolveStorageMode({ hasSupabaseEnv: true, supabaseHealthy: true }),
    ).toBe("supabase");
  });

  it("falls back to local when nothing is configured or supabase is unhealthy", () => {
    expect(resolveStorageMode({})).toBe("local");
    expect(
      resolveStorageMode({ hasSupabaseEnv: true, supabaseHealthy: false }),
    ).toBe("local");
  });

  it("respects demo and local preferences", () => {
    expect(
      resolveStorageMode({ preference: "demo", d1ApiBase: "https://x" }),
    ).toBe("demo");
    expect(
      resolveStorageMode({
        preference: "local",
        hasSupabaseEnv: true,
        supabaseHealthy: true,
      }),
    ).toBe("local");
  });

  it("downgrades a cloudflare_d1 preference to local without a D1 base", () => {
    expect(resolveStorageMode({ preference: "cloudflare_d1" })).toBe("local");
    expect(
      resolveStorageMode({ preference: "cloudflare_d1", d1ApiBase: "https://x" }),
    ).toBe("cloudflare_d1");
  });

  it("maps the legacy 'shared' preference to supabase when healthy", () => {
    expect(
      resolveStorageMode({
        preference: "shared",
        hasSupabaseEnv: true,
        supabaseHealthy: true,
      }),
    ).toBe("supabase");
  });
});

describe("getStorageAdapter", () => {
  it("returns an adapter whose mode matches the request", () => {
    expect(getStorageAdapter("local").mode).toBe("local");
    expect(getStorageAdapter("supabase").mode).toBe("supabase");
    expect(getStorageAdapter("cloudflare_d1").mode).toBe("cloudflare_d1");
  });

  it("serves the demo mode from the local adapter", () => {
    expect(getStorageAdapter("demo").mode).toBe("local");
  });
});
