import { afterEach, describe, expect, it, vi } from "vitest";

import { syncBigOfficialWatchFromOfficial } from "@/lib/repository";

const samplePayload = {
  fetchedAt: "2026-08-01T11:53:00.000Z",
  snapshots: [
    {
      carryoverYen: null,
      fetchedAt: "2026-08-01T11:53:00.000Z",
      officialRoundName: "第1644回 BIG くじ情報",
      officialRoundNumber: 1644,
      productKey: "big",
      productLabel: "BIG",
      resultDate: "2026-08-08",
      returnRate: 0.5,
      salesEndAt: "2026-08-08",
      salesStartAt: "2026-08-01",
      snapshotAt: "2026-08-01T20:53:00+09:00",
      sourceText: "前開催回からの繰越金（キャリーオーバー） -",
      sourceUrl: "https://store.toto-dream.com/",
      stakeYen: 300,
      totalSalesYen: 42_817_200,
    },
  ],
  sourceUrl: "https://store.toto-dream.com/",
  warnings: ["BIG の繰越金が未確定です（前回未抽せん）。キャリーなしとして扱いません。"],
};

// vitest は node 環境なので、ブラウザ実行を表す window を立ててから検証する
// （サーバ側では相対 URL を fetch できないため、実装は window 無しだと即 fallback する）。
function stubBrowser(fetchImpl: typeof fetch) {
  vi.stubGlobal("window", {} as unknown as Window & typeof globalThis);
  vi.stubGlobal("fetch", fetchImpl);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BIG official watch sync", () => {
  it("returns the empty fallback when running outside the browser", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const payload = await syncBigOfficialWatchFromOfficial();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(payload.snapshots).toEqual([]);
  });

  it("reads snapshots from the same-origin Pages Function", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(samplePayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    stubBrowser(fetchMock as unknown as typeof fetch);

    const payload = await syncBigOfficialWatchFromOfficial();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/big-official-watch",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
    expect(payload.snapshots).toHaveLength(1);
    expect(payload.snapshots[0]?.officialRoundNumber).toBe(1644);
    // 未確定は null のまま届く（0 に潰さない）。
    expect(payload.snapshots[0]?.carryoverYen).toBeNull();
  });

  it("falls back to an empty payload when the function is unavailable", async () => {
    const fetchMock = vi.fn(async () => new Response("Not found", { status: 404 }));
    stubBrowser(fetchMock as unknown as typeof fetch);

    const payload = await syncBigOfficialWatchFromOfficial();

    expect(fetchMock).toHaveBeenCalled();

    expect(payload.snapshots).toEqual([]);
    expect(payload.warnings.join(" ")).toContain("HTML貼り付け");
  });

  it("falls back when the fetch itself throws", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    stubBrowser(fetchMock as unknown as typeof fetch);

    const payload = await syncBigOfficialWatchFromOfficial();

    expect(fetchMock).toHaveBeenCalled();

    expect(payload.snapshots).toEqual([]);
    expect(payload.warnings.join(" ")).toContain("HTML貼り付け");
  });
});
