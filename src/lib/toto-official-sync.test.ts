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

const goal3VoteRateTableHtml = `
  <table>
    <tr>
      <th>開催日</th>
      <th>試合開始予定時間</th>
      <th colspan="3">予想チーム</th>
      <th colspan="4">投票口数 (投票率)</th>
    </tr>
    <tr>
      <th>0点</th>
      <th>1点</th>
      <th>2点</th>
      <th>3点以上</th>
    </tr>
    <tr>
      <td>04/25</td>
      <td>14:00</td>
      <td>1</td>
      <td>清水</td>
      <td>ホーム</td>
      <td>6,933（19.04%）</td>
      <td>12,995（35.70%）</td>
      <td>10,346（28.42%）</td>
      <td>6,132（16.84%）</td>
      <td>データ</td>
    </tr>
    <tr>
      <td>2</td>
      <td>名古屋</td>
      <td>アウェイ</td>
      <td>6,785（18.64%）</td>
      <td>12,669（34.80%）</td>
      <td>11,182（30.71%）</td>
      <td>5,770（15.85%）</td>
    </tr>
    <tr>
      <td>04/25</td>
      <td>15:00</td>
      <td>3</td>
      <td>岡山</td>
      <td>ホーム</td>
      <td>8,701（23.90%）</td>
      <td>14,663（40.27%）</td>
      <td>8,707（23.92%）</td>
      <td>4,335（11.91%）</td>
      <td>データ</td>
    </tr>
    <tr>
      <td>4</td>
      <td>福岡</td>
      <td>アウェイ</td>
      <td>8,248（22.66%）</td>
      <td>14,354（39.43%）</td>
      <td>9,351（25.68%）</td>
      <td>4,453（12.23%）</td>
    </tr>
    <tr>
      <td>04/25</td>
      <td>15:00</td>
      <td>5</td>
      <td>川崎Ｆ</td>
      <td>ホーム</td>
      <td>4,291（11.79%）</td>
      <td>8,502（23.35%）</td>
      <td>12,956（35.59%）</td>
      <td>10,657（29.27%）</td>
      <td>データ</td>
    </tr>
    <tr>
      <td>6</td>
      <td>千葉</td>
      <td>アウェイ</td>
      <td>11,792（32.39%）</td>
      <td>13,869（38.09%）</td>
      <td>7,106（19.52%）</td>
      <td>3,639（10.00%）</td>
    </tr>
  </table>
  <div>第1624回 totoGOAL3 投票状況</div>
  <div>売上金額 3,527,500円 2,318,000円 1,209,500円</div>
  <div>販売期間 2026年04月18日(土) ～ 2026年04月25日(土)まで</div>
`;

const goal3VoteRateUnavailableHtml = `
  <p>ご指定の投票状況は表示できません。</p>
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

const spTotoSalesUrl =
  "https://sp.toto-dream.com/dcs/subos/screen/si01/ssin025/PGSSIN02501ForwardSalesTermtotoSP.form?holdCntId=1634";

const spTotoVoteUrl =
  "https://sp.toto-dream.com/dcs/subos/screen/si01/ssin025/PGSSIN02501ForwardVotetotoSP.form?holdCntId=1634&commodityId=01&gameAssortment=A&fromId=SSIN026";

const spTotoSalesHtml = `
  <div id="bodyAttribute">id="toto_detail" class="toto"</div>
  <h2 id="lotName">第1634回 totoくじ情報</h2>
  <nav id="toto_navi">
    <a href="#tabCont01">toto</a>
    <a href="#tabCont06">mini toto<br>A組</a>
  </nav>
  <div id="tabCont01" class="tab">
    <table summary="toto詳細01">
      <tr><th>販売開始日</th><td>2026年06月06日(土) 08:00</td></tr>
      <tr><th>販売終了日</th><td>2026年06月12日(金)<br>当サイト(ネット決済) 19:00<br>当サイト(コンビニ決済) 17:10</td></tr>
      <tr><th>結果発表日</th><td>2026年06月16日(火)</td></tr>
    </table>
    <p><a href="${spTotoVoteUrl}">投票状況</a></p>
    <table summary="toto詳細02">
      <tr><th>No.</th><th>日程</th><th>競技場</th><th>ホーム VS アウェイ</th></tr>
      <tr><td>1</td><td>06/14<br>04:00</td><td>-</td><td>ｶﾀｰﾙ VS ｽｲｽ</td></tr>
      <tr><td>2</td><td>06/14<br>07:00</td><td>-</td><td>ﾌﾞﾗｼﾞﾙ VS ﾓﾛｯｺ</td></tr>
      <tr><td>3</td><td>06/15<br>02:00</td><td>-</td><td>ﾄﾞｲﾂ VS ｷｭﾗｿｰ</td></tr>
      <tr><td>4</td><td>06/15<br>05:00</td><td>-</td><td>ｵﾗﾝﾀﾞ VS 日本</td></tr>
      <tr><td>5</td><td>06/16<br>04:00</td><td>-</td><td>ﾍﾞﾙｷﾞｰ VS ｴｼﾞﾌﾟﾄ</td></tr>
      <tr><td>6</td><td>06/13<br>04:00</td><td>-</td><td>ｶﾅﾀﾞ VS ﾎﾞｽﾆｱ</td></tr>
      <tr><td>7</td><td>06/15<br>08:00</td><td>-</td><td>ｺｰﾄｼﾞﾎﾞ VS ｴｸｱﾄﾞﾙ</td></tr>
      <tr><td>8</td><td>06/16<br>01:00</td><td>-</td><td>ｽﾍﾟｲﾝ VS ｶｰﾎﾞﾍﾞ</td></tr>
      <tr><td>9</td><td>06/16<br>07:00</td><td>-</td><td>ｻｳｼﾞ VS ｳﾙｸﾞｱｲ</td></tr>
      <tr><td>10</td><td>06/15<br>11:00</td><td>-</td><td>ｽｳｪﾃﾞﾝ VS ﾁｭﾆｼﾞｱ</td></tr>
      <tr><td>11</td><td>06/14<br>10:00</td><td>-</td><td>ﾊｲﾁ VS ｽｺｯﾄﾗﾝ</td></tr>
      <tr><td>12</td><td>06/14<br>13:00</td><td>-</td><td>ｵｰｽﾄﾗﾘ VS ﾄﾙｺ</td></tr>
      <tr><td>13</td><td>06/13<br>10:00</td><td>-</td><td>ｱﾒﾘｶ VS ﾊﾟﾗｸﾞｱ</td></tr>
    </table>
    <table>
      <tr><th>売上金額</th><td>8,770,600円</td></tr>
      <tr><th>投票口数</th><td>87,706口</td></tr>
    </table>
    <a href="https://sp.toto-dream.com/dcs/subos/screen/si01/ssin025/PGSSIN02501ForwardBuytotoSP.form?holdCntId=1634&commodityId=01&fromId=SSIN026">今すぐ購入する</a>
  </div>
  <div id="tabCont06" class="tab">
    <table><tr><td>1</td><td>06/14<br>04:00</td><td>-</td><td>mini toto should not be parsed VS ignored</td></tr></table>
  </div>
`;

const spTotoVoteHtml = `
  <div id="bodyAttribute">id="index" class="tohyo_</div>
  <h2>第1634回 toto</h2>
  <h3>投票状況</h3>
  <p>ホーム90分勝ち <1> その他 <0> ホーム90分負け <2></p>
  <table>
    <tr><th>No.</th><th>日程</th><th>競技場</th><th>ホーム</th><th></th><th>アウェイ</th></tr>
    <tr><td>1</td><td>06/14</td><td>-</td><td>ｶﾀｰﾙ</td><td>VS</td><td>ｽｲｽ</td></tr>
    <tr><td>5,578<br>（6.36%）</td><td>8,347<br>（9.52%）</td><td>73,781<br>（84.12%）</td></tr>
    <tr><td>2</td><td>06/14</td><td>-</td><td>ﾌﾞﾗｼﾞﾙ</td><td>VS</td><td>ﾓﾛｯｺ</td></tr>
    <tr><td>60,661<br>（69.16%）</td><td>15,994<br>（18.24%）</td><td>11,051<br>（12.60%）</td></tr>
    <tr><td>3</td><td>06/15</td><td>-</td><td>ﾄﾞｲﾂ</td><td>VS</td><td>ｷｭﾗｿｰ</td></tr>
    <tr><td>83,097<br>（94.75%）</td><td>2,931<br>（3.34%）</td><td>1,678<br>（1.91%）</td></tr>
    <tr><td>4</td><td>06/15</td><td>-</td><td>ｵﾗﾝﾀﾞ</td><td>VS</td><td>日本</td></tr>
    <tr><td>33,446<br>（38.14%）</td><td>26,138<br>（29.80%）</td><td>28,122<br>（32.06%）</td></tr>
    <tr><td>5</td><td>06/16</td><td>-</td><td>ﾍﾞﾙｷﾞｰ</td><td>VS</td><td>ｴｼﾞﾌﾟﾄ</td></tr>
    <tr><td>74,676<br>（85.14%）</td><td>8,504<br>（9.70%）</td><td>4,526<br>（5.16%）</td></tr>
    <tr><td>6</td><td>06/13</td><td>-</td><td>ｶﾅﾀﾞ</td><td>VS</td><td>ﾎﾞｽﾆｱ</td></tr>
    <tr><td>46,321<br>（52.81%）</td><td>22,654<br>（25.83%）</td><td>18,731<br>（21.36%）</td></tr>
    <tr><td>7</td><td>06/15</td><td>-</td><td>ｺｰﾄｼﾞﾎﾞ</td><td>VS</td><td>ｴｸｱﾄﾞﾙ</td></tr>
    <tr><td>22,486<br>（25.64%）</td><td>25,678<br>（29.28%）</td><td>39,542<br>（45.08%）</td></tr>
    <tr><td>8</td><td>06/16</td><td>-</td><td>ｽﾍﾟｲﾝ</td><td>VS</td><td>ｶｰﾎﾞﾍﾞ</td></tr>
    <tr><td>83,477<br>（95.18%）</td><td>2,424<br>（2.76%）</td><td>1,805<br>（2.06%）</td></tr>
    <tr><td>9</td><td>06/16</td><td>-</td><td>ｻｳｼﾞ</td><td>VS</td><td>ｳﾙｸﾞｱｲ</td></tr>
    <tr><td>5,923<br>（6.75%）</td><td>9,744<br>（11.11%）</td><td>72,039<br>（82.14%）</td></tr>
    <tr><td>10</td><td>06/15</td><td>-</td><td>ｽｳｪﾃﾞﾝ</td><td>VS</td><td>ﾁｭﾆｼﾞｱ</td></tr>
    <tr><td>46,818<br>（53.38%）</td><td>24,925<br>（28.42%）</td><td>15,963<br>（18.20%）</td></tr>
    <tr><td>11</td><td>06/14</td><td>-</td><td>ﾊｲﾁ</td><td>VS</td><td>ｽｺｯﾄﾗﾝ</td></tr>
    <tr><td>4,247<br>（4.84%）</td><td>7,502<br>（8.55%）</td><td>75,957<br>（86.61%）</td></tr>
    <tr><td>12</td><td>06/14</td><td>-</td><td>ｵｰｽﾄﾗﾘ</td><td>VS</td><td>ﾄﾙｺ</td></tr>
    <tr><td>19,258<br>（21.96%）</td><td>24,156<br>（27.54%）</td><td>44,292<br>（50.50%）</td></tr>
    <tr><td>13</td><td>06/13</td><td>-</td><td>ｱﾒﾘｶ</td><td>VS</td><td>ﾊﾟﾗｸﾞｱ</td></tr>
    <tr><td>53,085<br>（60.53%）</td><td>18,478<br>（21.07%）</td><td>16,143<br>（18.40%）</td></tr>
    <tr><th>合計</th></tr>
    <tr><th>売上金額</th><td>8,770,600円</td></tr>
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

  it("parses sp.toto-dream.com toto sales pages without mini toto leakage", async () => {
    const result = await parseTotoOfficialHtmlSource({
      includeMatches: false,
      rawText: spTotoSalesHtml,
      sourceUrl: spTotoSalesUrl,
    });

    expect(result.rounds).toHaveLength(1);
    expect(result.rounds[0]?.title).toBe("第1634回 toto");
    expect(result.rounds[0]?.productType).toBe("toto13");
    expect(result.rounds[0]?.matches).toHaveLength(13);
    expect(result.rounds[0]?.salesStartAt).toBe("2026-06-06T08:00:00+09:00");
    expect(result.rounds[0]?.salesEndAt).toBe("2026-06-12T19:00:00+09:00");
    expect(result.rounds[0]?.totalSalesYen).toBe(8770600);
    expect(result.rounds[0]?.matches[0]?.homeTeam).toBe("ｶﾀｰﾙ");
    expect(result.rounds[0]?.matches[3]?.awayTeam).toBe("日本");
    expect(result.rounds[0]?.matches.some((match) => match.homeTeam.includes("mini"))).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  it("hydrates sp.toto-dream.com toto sales pages with official vote rates", async () => {
    const fetchedUrls: string[] = [];
    const result = await parseTotoOfficialHtmlSource({
      fetchText: async (url) => {
        fetchedUrls.push(url);
        return spTotoVoteHtml;
      },
      includeMatches: true,
      rawText: spTotoSalesHtml,
      sourceUrl: spTotoSalesUrl,
    });

    expect(fetchedUrls).toEqual([spTotoVoteUrl]);
    expect(result.rounds).toHaveLength(1);
    expect(result.rounds[0]?.matches).toHaveLength(13);
    expect(result.rounds[0]?.sourceNote).toContain("投票状況");
    expect(result.rounds[0]?.matches[0]?.officialVote1).toBeCloseTo(0.0636, 4);
    expect(result.rounds[0]?.matches[0]?.officialVote0).toBeCloseTo(0.0952, 4);
    expect(result.rounds[0]?.matches[0]?.officialVote2).toBeCloseTo(0.8412, 4);
    expect(result.rounds[0]?.matches[6]?.officialVote2).toBeCloseTo(0.4508, 4);
    expect(result.warnings).toHaveLength(0);
  });

  it("parses sp.toto-dream.com toto vote pages directly", async () => {
    const result = await parseTotoOfficialHtmlSource({
      rawText: spTotoVoteHtml,
      sourceUrl: spTotoVoteUrl,
    });

    expect(result.rounds).toHaveLength(1);
    expect(result.rounds[0]?.matches).toHaveLength(13);
    expect(result.rounds[0]?.matches[0]?.kickoffTime).toBeNull();
    expect(result.rounds[0]?.matches[12]?.officialVote1).toBeCloseTo(0.6053, 4);
    expect(result.rounds[0]?.totalSalesYen).toBe(8770600);
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

  it("parses GOAL3 vote-rate tables from the current official layout", async () => {
    const result = await parseTotoOfficialHtmlSource({
      rawText: goal3VoteRateTableHtml,
      sourceUrl:
        "https://store.toto-dream.com/dcs/subos/screen/pi09/spin003/PGSPIN00301InitVoteRate.form?holdCntId=1624&commodityId=02",
    });

    expect(result.rounds).toHaveLength(1);
    expect(result.rounds[0]?.matches).toHaveLength(6);
    expect(result.rounds[0]?.matches[0]?.homeTeam).toBe("清水");
    expect(result.rounds[0]?.matches[0]?.officialVote0).toBeCloseTo(0.1904, 4);
    expect(result.rounds[0]?.matches[1]?.awayTeam).toBe("清水");
  });

  it("keeps GOAL3 lot info without warning when vote-rate page is still unavailable", async () => {
    const result = await parseTotoOfficialHtmlSource({
      fetchText: async (url) => {
        if (url.includes("holdCntId=1624&commodityId=02")) {
          return goal3VoteRateUnavailableHtml;
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

    expect(
      result.warnings.some((warning) => warning.includes("totoGOAL3") && warning.includes("投票状況")),
    ).toBe(false);
    expect(result.rounds.map((entry) => entry.title)).toContain("第1624回 totoGOAL3");
  });

  it("detects official html-like payloads", () => {
    expect(looksLikeTotoOfficialHtml(yahooScheduleHtml)).toBe(true);
    expect(looksLikeTotoOfficialHtml(lotInfoHtml)).toBe(true);
    expect(looksLikeTotoOfficialHtml(spTotoSalesHtml)).toBe(true);
    expect(looksLikeTotoOfficialHtml(spTotoVoteHtml)).toBe(true);
    expect(looksLikeTotoOfficialHtml('{"rounds":[]}')).toBe(false);
  });
});
