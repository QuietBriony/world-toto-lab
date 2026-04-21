import { describe, expect, it } from "vitest";

import {
  buildBigCarryoverQueryFromOfficialSnapshot,
  buildBigOfficialWatch,
  formatBigCarryoverDisplay,
  parseBigOfficialWatchHtml,
  pickFeaturedBigOfficialSnapshot,
} from "@/lib/big-official";

describe("big official sync parser", () => {
  const sampleHtml = `
    <a name="BIG" value='09'></a>
    <table><tr><td>第1624回　BIG　くじ情報</td></tr></table>
    <table>
      <tr><th>販売開始日</th><td>2026年04月21日（火）</td></tr>
      <tr><th>販売終了日</th><td>2026年04月25日（土）</td></tr>
      <tr><th>結果発表日</th><td>2026年04月25日（土）</td></tr>
    </table>
    <p>(2026年04月21日（火）22時45分時点) ※5分毎に最新情報を表示しています。</p>
    <table>
      <tr><th>前開催回からの繰越金<br>（キャリーオーバー）</th><td>3,239,484,780円</td></tr>
      <tr><th>1等配当金総額</th><td>-</td></tr>
    </table>
    <table>
      <tr><th>売上金額</th><td>484,739,700円</td></tr>
    </table>
    <a name="miniBIG" value='10'></a>
    <table><tr><td>第1624回　mini BIG　くじ情報</td></tr></table>
    <table>
      <tr><th>販売開始日</th><td>2026年04月21日（火）</td></tr>
      <tr><th>販売終了日</th><td>2026年04月25日（土）</td></tr>
      <tr><th>結果発表日</th><td>2026年04月25日（土）</td></tr>
    </table>
    <p>(2026年04月21日（火）22時45分時点) ※5分毎に最新情報を表示しています。</p>
    <table>
      <tr><th>前開催回からの繰越金<br>（キャリーオーバー）</th><td>-</td></tr>
      <tr><th>1等配当金総額</th><td>-</td></tr>
    </table>
    <table>
      <tr><th>売上金額</th><td>8,602,400円</td></tr>
    </table>
  `;

  it("extracts BIG snapshots from official HTML", () => {
    const payload = parseBigOfficialWatchHtml({
      fetchedAt: "2026-04-21T13:45:00.000Z",
      html: sampleHtml,
      sourceUrl:
        "https://store.toto-dream.com/dcs/subos/screen/pi02/spin005/PGSPIN00501InitBIGLotInfo.form",
    });

    expect(payload.snapshots).toHaveLength(2);
    expect(payload.snapshots[0]?.productKey).toBe("big");
    expect(payload.snapshots[0]?.officialRoundNumber).toBe(1624);
    expect(payload.snapshots[0]?.carryoverYen).toBe(3_239_484_780);
    expect(payload.snapshots[0]?.totalSalesYen).toBe(484_739_700);
    expect(payload.snapshots[0]?.snapshotAt).toBe("2026-04-21T22:45:00+09:00");
    expect(payload.snapshots[1]?.productKey).toBe("mini_big");
    expect(payload.snapshots[1]?.carryoverYen).toBe(0);
  });

  it("builds watch summaries and query values from official snapshots", () => {
    const payload = parseBigOfficialWatchHtml({
      fetchedAt: "2026-04-21T13:45:00.000Z",
      html: sampleHtml,
    });
    const featured = pickFeaturedBigOfficialSnapshot(payload.snapshots);

    expect(featured?.productKey).toBe("big");

    const watch = buildBigOfficialWatch(featured!);
    expect(watch.summary.approxEvMultiple).toBeGreaterThan(1);
    expect(watch.heatBand.label).toBe("特大上振れ候補");
    expect(watch.eventSnapshot.statusLabel).toBe("特大上振れ");

    const query = buildBigCarryoverQueryFromOfficialSnapshot(featured!);
    expect(query.eventType).toBe("carryover_event");
    expect(query.sales).toBe(484_739_700);
    expect(query.carryover).toBe(3_239_484_780);
  });

  it("treats zero carryover as no carryover for display", () => {
    const payload = parseBigOfficialWatchHtml({
      fetchedAt: "2026-04-21T13:45:00.000Z",
      html: sampleHtml,
    });
    const miniBig = payload.snapshots.find((snapshot) => snapshot.productKey === "mini_big");

    expect(formatBigCarryoverDisplay(miniBig?.carryoverYen)).toBe("なし");
    expect(buildBigOfficialWatch(miniBig!).eventSnapshot.statusLabel).toBe("キャリーなし");
  });
});
