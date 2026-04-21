import { describe, expect, it } from "vitest";

import {
  looksLikeTotoOfficialHtml,
  parseOfficialTotoLotInfoHtml,
  parseTotoOfficialHtmlSource,
  parseYahooTotoScheduleHtml,
} from "@/lib/toto-official-sync";

const yahooScheduleHtml = `
  <ul class="scheduleResultList">
    <li class="scheduleResultItem">
      <div class="scheduleStatus"><p class="icoSale">販売中</p></div>
      <div class="scheduleNumber"><span class="txtB">第1624回</span><br>（2026/4/18-2026/4/25）</div>
      <div class="scheduleResult">
        <a href="https://store.toto-dream.com/detail/1624" class="scheduleResultLink">くじ情報を見る</a>
      </div>
    </li>
    <li class="scheduleResultItem">
      <div class="scheduleStatus"><p class="icoOpen">これから</p></div>
      <div class="scheduleNumber"><span class="txtB">第1625回</span><br>（2026/4/25-2026/4/29）</div>
      <div class="scheduleResult">
        <a href="https://store.toto-dream.com/detail/1625" class="scheduleResultLink">くじ情報を見る</a>
      </div>
    </li>
  </ul>
`;

const lotInfoHtml = `
  <table>
    <tr><td>第1624回 toto くじ情報</td></tr>
    <tr><td>販売開始日 2026年04月18日（土）08：00</td></tr>
    <tr><td>販売終了日 2026年04月25日（土）（当サイト(ネット決済) 13:50／当サイト(コンビニ決済) 12:00）</td></tr>
    <tr><td>1 04/25 14:00 ユアスタ ベガルタ仙台 VS モンテディオ山形 データ</td></tr>
    <tr><td>2 04/25 15:00 アイスタ 清水エスパルス VS 名古屋グランパス データ</td></tr>
    <tr><td>売上金額 12,033,400円 9,183,300円 2,850,100円</td></tr>
    <tr><td>第1624回 mini toto-A組 くじ情報</td></tr>
    <tr><td>販売開始日 2026年04月18日（土）08：00</td></tr>
    <tr><td>販売終了日 2026年04月25日（土）（当サイト(ネット決済) 13:50／当サイト(コンビニ決済) 12:00）</td></tr>
    <tr><td>1 04/25 14:00 ユアスタ ベガルタ仙台 VS モンテディオ山形 データ</td></tr>
    <tr><td>2 04/25 15:00 アイスタ 清水エスパルス VS 名古屋グランパス データ</td></tr>
    <tr><td>売上金額 2,117,800円 1,487,800円 630,000円</td></tr>
    <tr><td>第1624回 mini toto-B組 くじ情報</td></tr>
    <tr><td>販売開始日 2026年04月18日（土）08：00</td></tr>
    <tr><td>販売終了日 2026年04月25日（土）（当サイト(ネット決済) 13:50／当サイト(コンビニ決済) 12:00）</td></tr>
    <tr><td>1 04/25 18:30 ピースタ Ｖ・ファーレン長崎 VS ガンバ大阪 データ</td></tr>
    <tr><td>売上金額 1,557,600円 1,137,700円 419,900円</td></tr>
    <tr><td>第1624回 totoGOAL3 くじ情報</td></tr>
    <tr><td>販売開始日 2026年04月18日（土）08：00</td></tr>
  </table>
`;

describe("toto official sync parser", () => {
  it("parses yahoo schedule entries with detail links and status", () => {
    const result = parseYahooTotoScheduleHtml(yahooScheduleHtml);

    expect(result).toHaveLength(2);
    expect(result[0]?.officialRoundNumber).toBe(1624);
    expect(result[0]?.detailUrl).toBe("https://store.toto-dream.com/detail/1624");
    expect(result[0]?.resultStatus).toBe("selling");
    expect(result[1]?.resultStatus).toBe("draft");
  });

  it("parses official lot info html and keeps toto / mini toto A / B while skipping unsupported sections", () => {
    const result = parseOfficialTotoLotInfoHtml(
      lotInfoHtml,
      "https://store.toto-dream.com/detail/1624",
      "selling",
    );

    expect(result.rounds.map((entry) => entry.title)).toEqual([
      "第1624回 toto",
      "第1624回 mini toto-A組",
      "第1624回 mini toto-B組",
    ]);
    expect(result.rounds[0]?.matches).toHaveLength(2);
    expect(result.rounds[0]?.totalSalesYen).toBe(12033400);
    expect(result.rounds[1]?.productType).toBe("mini_toto");
    expect(result.rounds[2]?.matches[0]?.venue).toBe("ピースタ");
    expect(result.warnings.join(" ")).toContain("未対応");
  });

  it("hydrates schedule entries with detail pages when includeMatches is enabled", async () => {
    const result = await parseTotoOfficialHtmlSource({
      fetchText: async (url) => {
        if (url.endsWith("/1624")) {
          return lotInfoHtml;
        }

        throw new Error("detail not available");
      },
      includeMatches: true,
      rawText: yahooScheduleHtml,
      sourceUrl: "https://toto.yahoo.co.jp/schedule/toto",
    });

    expect(result.rounds.map((entry) => entry.title)).toContain("第1624回 toto");
    expect(result.rounds.map((entry) => entry.title)).toContain("第1624回 mini toto-A組");
    expect(result.rounds.map((entry) => entry.title)).toContain("第1625回 toto");
  });

  it("detects official html-like payloads", () => {
    expect(looksLikeTotoOfficialHtml(yahooScheduleHtml)).toBe(true);
    expect(looksLikeTotoOfficialHtml(lotInfoHtml)).toBe(true);
    expect(looksLikeTotoOfficialHtml('{"rounds":[]}')).toBe(false);
  });
});
