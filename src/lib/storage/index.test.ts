import { describe, expect, it } from "vitest";

import {
  getStorageAdapter,
  getStorageModeLabel,
  resolveStorageMode,
} from "@/lib/storage";

describe("resolveStorageMode", () => {
  it("honors an explicit mode above everything else", () => {
    expect(resolveStorageMode({ explicitMode: "cloudflare_d1" })).toBe(
      "cloudflare_d1",
    );
    expect(
      resolveStorageMode({ explicitMode: "demo", d1ApiBase: "https://x" }),
    ).toBe("demo");
    expect(resolveStorageMode({ explicitMode: "nonsense" })).toBe("local");
  });

  it("prefers cloudflare_d1 when a D1 API base is configured (auto)", () => {
    expect(
      resolveStorageMode({ d1ApiBase: "https://world-toto-lab-api.workers.dev" }),
    ).toBe("cloudflare_d1");
  });

  it("falls back to local when nothing is configured", () => {
    expect(resolveStorageMode({})).toBe("local");
  });

  it("respects demo and local preferences", () => {
    expect(
      resolveStorageMode({ preference: "demo", d1ApiBase: "https://x" }),
    ).toBe("demo");
    expect(
      resolveStorageMode({ preference: "local", d1ApiBase: "https://x" }),
    ).toBe("local");
  });

  it("downgrades a cloudflare_d1 preference to local without a D1 base", () => {
    expect(resolveStorageMode({ preference: "cloudflare_d1" })).toBe("local");
    expect(
      resolveStorageMode({ preference: "cloudflare_d1", d1ApiBase: "https://x" }),
    ).toBe("cloudflare_d1");
  });
});

describe("getStorageAdapter", () => {
  it("returns an adapter whose mode matches the request", () => {
    expect(getStorageAdapter("local").mode).toBe("local");
    expect(getStorageAdapter("cloudflare_d1").mode).toBe("cloudflare_d1");
  });

  it("serves the demo mode from the local adapter", () => {
    expect(getStorageAdapter("demo").mode).toBe("local");
  });
});

describe("getStorageModeLabel", () => {
  it("maps every mode to its Japanese badge label", () => {
    expect(getStorageModeLabel("cloudflare_d1")).toBe("Cloudflare共有保存");
    expect(getStorageModeLabel("local")).toBe("ローカル保存");
    expect(getStorageModeLabel("demo")).toBe("デモ");
  });
});
