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
    <tr><td><a href="./PGSPIN00301InitVoteRate.form?holdCntId=1624&commodityId=02">投票状況</a></td></tr>
  </table>
`;

const goal3VoteRateHtml = `
  <div>第1624回 totoGOAL3 投票状況</div>
  <div>(2026年04月21日（火）20時40分時点)</div>
  <div>04/25 14:00 1 清水 ホーム 6,737（19.10%） 12,550（35.58%） 9,983（28.30%） 6,005（17.02%）</div>
  <div>2 名古屋 アウェイ 6,640（18.83%） 12,276（34.80%） 10,735（30.43%） 5,624（15.94%）</div>
  <div>04/25 14:00 3 岡山 ホーム 8,486（24.06%） 14,150（40.11%） 8,399（23.81%） 4,240（12.02%）</div>
  <div>4 福岡 アウェイ 7,971（22.60%） 13,839（39.23%） 9,087（25.76%） 4,378（12.41%）</div>
  <div>04/25 15:00 5 川崎Ｆ ホーム 4,206（11.92%） 8,175（23.18%） 12,497（35.43%） 10,397（29.47%）</div>
  <div>6 千葉 アウェイ 11,375（32.25%） 13,398（37.98%） 6,924（19.63%） 3,578（10.14%）</div>
  <div>売上金額 3,527,500円 2,318,000円 1,209,500円</div>
  <div>販売期間 2026年04月18日(土) ～ 2026年04月25日(土)まで</div>
`;

const worldTotoLotInfoHtml = `
  <table>
    <tr><td>第1700回 ワールドtoto くじ情報</td></tr>
    <tr><td>販売開始日 2026年06月10日（水）08：00</td></tr>
    <tr><td>販売終了日 2026年06月13日（土）（当サイト(ネット決済) 18:50／当サイト(コンビニ決済) 17:00）</td></tr>
    <tr><td>1 06/14 10:00 メキシコ メキシコ VS 南アフリカ データ</td></tr>
    <tr><td>2 06/14 13:00 グアダラハラ 韓国 VS チェコ データ</td></tr>
    <tr><td>売上金額 18,500,000円 12,200,000円 6,300,000円</td></tr>
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

  it("parses official lot info html and keeps toto / mini toto / GOAL3 sections", () => {
    const result = parseOfficialTotoLotInfoHtml(
      lotInfoHtml,
      "https://store.toto-dream.com/dcs/subos/screen/pi01/spin000/PGSPIN00001DisptotoLotInfo.form?holdCntId=1624",
      "selling",
    );

    expect(result.rounds.map((entry) => entry.title)).toEqual([
      "第1624回 toto",
      "第1624回 mini toto-A組",
      "第1624回 mini toto-B組",
      "第1624回 totoGOAL3",
    ]);
    expect(result.rounds[0]?.matches).toHaveLength(2);
    expect(result.rounds[0]?.totalSalesYen).toBe(12033400);
    expect(result.rounds[1]?.productType).toBe("mini_toto");
    expect(result.rounds[2]?.matches[0]?.venue).toBe("ピースタ");
    expect(result.rounds[3]?.productType).toBe("custom");
    expect(result.rounds[3]?.requiredMatchCount).toBe(6);
    expect(result.rounds[3]?.outcomeSetJson).toEqual(["0", "1", "2", "3+"]);
    expect(result.warnings).toHaveLength(0);
  });

  it("treats ワールドtoto as a toto13 round while preserving the official label", () => {
    const result = parseOfficialTotoLotInfoHtml(
      worldTotoLotInfoHtml,
      "https://store.toto-dream.com/dcs/subos/screen/pi01/spin000/PGSPIN00001DisptotoLotInfo.form?holdCntId=1700",
      "selling",
    );

    expect(result.rounds).toHaveLength(1);
    expect(result.rounds[0]?.productType).toBe("toto13");
    expect(result.rounds[0]?.requiredMatchCount).toBe(2);
    expect(result.rounds[0]?.title).toBe("第1700回 ワールドtoto");
    expect(result.rounds[0]?.officialRoundName).toBe("第1700回 ワールドtoto");
    expect(result.rounds[0]?.matches).toHaveLength(2);
    expect(result.warnings).toHaveLength(0);
  });

  it("hydrates schedule entries with detail pages when includeMatches is enabled", async () => {
    const result = await parseTotoOfficialHtmlSource({
      fetchText: async (url) => {
        if (url.includes("holdCntId=1624&commodityId=02")) {
          return goal3VoteRateHtml;
        }

        if (url.includes("holdCntId=1624") || url.endsWith("/1624")) {
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
    expect(result.rounds.map((entry) => entry.title)).toContain("第1624回 totoGOAL3");
    expect(result.rounds.map((entry) => entry.title)).toContain("第1625回 toto");
    const goal3Round = result.rounds.find((entry) => entry.title === "第1624回 totoGOAL3");
    expect(goal3Round?.matches).toHaveLength(6);
    expect(goal3Round?.matches[0]?.officialVote3).toBeCloseTo(0.1702, 4);
  });

  it("detects official html-like payloads", () => {
    expect(looksLikeTotoOfficialHtml(yahooScheduleHtml)).toBe(true);
    expect(looksLikeTotoOfficialHtml(lotInfoHtml)).toBe(true);
    expect(looksLikeTotoOfficialHtml('{"rounds":[]}')).toBe(false);
  });
});
