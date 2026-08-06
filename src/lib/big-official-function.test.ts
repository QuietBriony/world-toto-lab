import { afterEach, describe, expect, it, vi } from "vitest";

import { onRequestGet } from "../../functions/api/big-official-watch";
import { bigOfficialDefaultSourceUrl } from "@/lib/big-official";

const officialHtml = `
  <a name="BIG" value='09'></a>
  <table><tr><td>第1644回　BIG　くじ情報</td></tr></table>
  <table>
    <tr><th>前開催回からの繰越金<br>（キャリーオーバー）</th><td>4,602,871,860円</td></tr>
  </table>
  <table><tr><th>売上金額</th><td>556,139,100円</td></tr></table>
  <a name="miniBIG" value='10'></a>
  <table><tr><td>第1644回　mini BIG　くじ情報</td></tr></table>
  <table>
    <tr><th>前開催回からの繰越金<br>（キャリーオーバー）</th><td>-</td></tr>
  </table>
  <table><tr><th>売上金額</th><td>83,340,200円</td></tr></table>
`;

function stubFetch(impl: () => Promise<Response>) {
  const mock = vi.fn(impl);
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("big official watch Pages Function", () => {
  it("always fetches the fixed official URL, never a caller-supplied one", async () => {
    const mock = stubFetch(async () => new Response(officialHtml, { status: 200 }));

    await onRequestGet();

    expect(mock).toHaveBeenCalledTimes(1);
    // 取得先を固定していることが SSRF ガード。可変にしない。
    expect(mock.mock.calls[0]?.[0]).toBe(bigOfficialDefaultSourceUrl);
  });

  it("returns parsed snapshots with a 5 minute cache", async () => {
    stubFetch(async () => new Response(officialHtml, { status: 200 }));

    const response = await onRequestGet();
    const payload = (await response.json()) as {
      snapshots: Array<{ productKey: string; carryoverYen: number | null }>;
    };

    expect(response.status).toBe(200);
    // 公式ページが5分毎更新なので、それ以上は持たない。
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(payload.snapshots).toHaveLength(2);
    expect(payload.snapshots[0]?.carryoverYen).toBe(4_602_871_860);
    // "-" は 0 ではなく未確定のまま返す。
    expect(payload.snapshots[1]?.carryoverYen).toBeNull();
  });

  it("does not cache a payload with no products", async () => {
    stubFetch(async () => new Response("<html><body>構造が変わった</body></html>", { status: 200 }));

    const response = await onRequestGet();
    const payload = (await response.json()) as { snapshots: unknown[] };

    expect(response.status).toBe(200);
    expect(payload.snapshots).toEqual([]);
    // 抽出0件を5分固定すると、ページ構造変化に気づくのが遅れる。
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("reports upstream failure as 502 without caching", async () => {
    stubFetch(async () => new Response("Service Unavailable", { status: 503 }));

    const response = await onRequestGet();
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload.error).toContain("503");
  });

  it("reports a thrown fetch as 502 without caching", async () => {
    stubFetch(async () => {
      throw new Error("connect ETIMEDOUT");
    });

    const response = await onRequestGet();
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload.error).toContain("ETIMEDOUT");
  });
});
