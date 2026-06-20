import {
  buildBigCarryoverQueryFromOfficialSnapshot,
  buildBigOfficialWatch,
  bigOfficialDefaultSourceUrl,
  type BigOfficialSnapshot,
} from "@/lib/big-official";
import {
  bigCarryoverProductDefaults,
  bigCarryoverProductTypeFromOfficialKey,
  calculateBigCarryover,
} from "@/lib/big-carryover/calculator";
import { buildGoal3EventWatch, pickFeaturedGoal3Entry } from "@/lib/goal3";
import { formatCurrency, formatPercent } from "@/lib/domain";
import { appRoute, buildHref, buildRoundHref } from "@/lib/round-links";
import type { TotoOfficialRoundLibraryEntry } from "@/lib/types";
import type { WorldCupStrategyDashboard } from "@/lib/world-cup-strategy";

export type EvOpportunityCategory =
  | "big"
  | "goal3"
  | "public_gambling_watch"
  | "toto"
  | "winner";

export type EvOpportunityStatus =
  | "closed"
  | "data_missing"
  | "hot"
  | "research_only"
  | "watch";

export type EvOpportunityCard = {
  category: EvOpportunityCategory;
  confidenceLabel: string;
  evLabel: string;
  href: string;
  id: string;
  nextActionLabel: string;
  productLabel: string;
  rankScore: number;
  returnRateLabel: string;
  sourceLabel: string;
  sourceUrl: string | null;
  stakeLabel: string;
  status: EvOpportunityStatus;
  title: string;
  warningLabel: string | null;
  whyItMatters: string;
};

export const evOpportunityCategoryLabel: Record<EvOpportunityCategory, string> = {
  big: "BIG",
  goal3: "GOAL3",
  public_gambling_watch: "公営ウォッチ",
  toto: "toto",
  winner: "WINNER",
};

export const evOpportunityStatusLabel: Record<EvOpportunityStatus, string> = {
  closed: "締切後",
  data_missing: "データ待ち",
  hot: "要確認",
  research_only: "研究ネタ",
  watch: "監視",
};

const jraRulesUrl = "https://www.jra.go.jp/kouza/baken/index.html";
const jraSuperPremiumUrl = "https://www.jra.go.jp/kouza/superpremium/";
const jraUltraPremiumUrl = "https://www.jra.go.jp/kouza/ultrapremium/";
const keirinDokantoUrl = "https://keirin.jp/pc/static/beginner/ways-to-bet/dokanto.html";
const autoRaceGradeRace7Url = "https://autorace.jp/news/2025/04/04/035092/";
const boatRacePayoutUrl = "https://www.boatrace.jp/owpc/pc/extra/enjoy/guide/jiten/26/y_213.html";
const totoHowUrl = "https://www.toto-dream.com/toto/how/";
const bigHowUrl = "https://www.toto-dream.com/big/how/";

const statusPriority: Record<EvOpportunityStatus, number> = {
  hot: 0,
  watch: 1,
  data_missing: 2,
  research_only: 3,
  closed: 4,
};

function formatMultiple(value: number | null | undefined) {
  return value === null || value === undefined ? "未計算" : `${value.toFixed(2)}倍`;
}

function formatYen(value: number | null | undefined) {
  return value === null || value === undefined ? "未入力" : formatCurrency(value);
}

function compactPercent(value: number | null | undefined) {
  return value === null || value === undefined ? "未入力" : formatPercent(value, 0);
}

function opportunityStatusForMultiple(value: number | null, fallback: EvOpportunityStatus) {
  if (value === null) {
    return fallback;
  }

  if (value >= 1) {
    return "hot";
  }

  if (value >= 0.75) {
    return "watch";
  }

  return fallback;
}

export const publicGamblingWatchItems: EvOpportunityCard[] = [
  {
    category: "public_gambling_watch",
    confidenceLabel: "公式ルール確認済み",
    evLabel: "全式別80%",
    href: appRoute.evOpportunities,
    id: "jra-super-premium",
    nextActionLabel: "開催日だけメモ",
    productLabel: "JRAスーパープレミアム",
    rankScore: 55,
    returnRateLabel: "通常70.0-80.0% -> 80%",
    sourceLabel: "JRA公式",
    sourceUrl: jraSuperPremiumUrl,
    stakeLabel: "馬券は通常100円単位",
    status: "research_only",
    title: "JRA 全式別80%の日",
    warningLabel: "買い目生成は対象外。まず開催日ウォッチ。",
    whyItMatters: "単勝・複勝以外の控除が薄くなる日だけ、通常日より研究価値が上がります。",
  },
  {
    category: "public_gambling_watch",
    confidenceLabel: "公式ルール確認済み",
    evLabel: "80% + 売上5%上乗せ",
    href: appRoute.evOpportunities,
    id: "jra-ultra-premium",
    nextActionLabel: "最優先でウォッチ",
    productLabel: "JRAウルトラプレミアム",
    rankScore: 75,
    returnRateLabel: "全式別80% + 5%上乗せ",
    sourceLabel: "JRA公式",
    sourceUrl: jraUltraPremiumUrl,
    stakeLabel: "馬券は通常100円単位",
    status: "research_only",
    title: "JRA ウルトラプレミアム",
    warningLabel: "開催頻度が低い。日程確認が先。",
    whyItMatters: "構造上の還元が厚いので、将来の公営ウォッチでは最初に拾う候補です。",
  },
  {
    category: "public_gambling_watch",
    confidenceLabel: "公式ルール確認済み",
    evLabel: "70% + キャリー",
    href: appRoute.evOpportunities,
    id: "jra-win5-carryover",
    nextActionLabel: "キャリー発生日を記録",
    productLabel: "WIN5",
    rankScore: 58,
    returnRateLabel: "通常70%",
    sourceLabel: "JRA公式",
    sourceUrl: jraRulesUrl,
    stakeLabel: "100円単位",
    status: "research_only",
    title: "WIN5 キャリー発生回",
    warningLabel: "的中難度が高く、初回はウォッチだけ。",
    whyItMatters: "的中者なしの払戻対象総額が次回へ繰り越されるため、キャリー日だけ構造が変わります。",
  },
  {
    category: "public_gambling_watch",
    confidenceLabel: "公式ルール確認済み",
    evLabel: "75% + キャリー",
    href: appRoute.evOpportunities,
    id: "keirin-dokanto",
    nextActionLabel: "キャリー額を監視",
    productLabel: "競輪 Dokanto!",
    rankScore: 62,
    returnRateLabel: "発売金額の75%",
    sourceLabel: "KEIRIN.jp",
    sourceUrl: keirinDokantoUrl,
    stakeLabel: "1口200円",
    status: "research_only",
    title: "競輪 Dokanto! キャリー",
    warningLabel: "クイックピック型。買い目の技術介入は前提にしない。",
    whyItMatters: "キャリーオーバー型なので、BIGと同じく売上とキャリーの比率で熱さを見られます。",
  },
  {
    category: "public_gambling_watch",
    confidenceLabel: "公式ニュース確認済み",
    evLabel: "2連単80%",
    href: appRoute.evOpportunities,
    id: "autorace-grade-race-7",
    nextActionLabel: "対象レース日だけ見る",
    productLabel: "オートレース",
    rankScore: 45,
    returnRateLabel: "グレードレース第7R 80%",
    sourceLabel: "AutoRace公式",
    sourceUrl: autoRaceGradeRace7Url,
    stakeLabel: "通常100円単位",
    status: "research_only",
    title: "オート グレードレース7",
    warningLabel: "対象条件が限定的。日程と券種の確認が必要。",
    whyItMatters: "通常より払戻率が高い特定レースだけ、研究メモとして拾う価値があります。",
  },
  {
    category: "public_gambling_watch",
    confidenceLabel: "公式用語確認済み",
    evLabel: "75%以上",
    href: appRoute.evOpportunities,
    id: "boatrace-odds-drift",
    nextActionLabel: "直前オッズ差を研究",
    productLabel: "ボートレース",
    rankScore: 32,
    returnRateLabel: "売上の75%以上を按分",
    sourceLabel: "BOAT RACE公式",
    sourceUrl: boatRacePayoutUrl,
    stakeLabel: "通常100円単位",
    status: "research_only",
    title: "ボート 直前オッズ研究",
    warningLabel: "高還元イベントではなく、歪み検出の研究枠。",
    whyItMatters: "還元率イベントより、締切直前のオッズ変化や人気の偏りを見るテーマとして扱います。",
  },
];

export function buildWorldCupEvOpportunityCard(
  dashboard: WorldCupStrategyDashboard,
): EvOpportunityCard {
  const primaryRound =
    dashboard.rounds.find((round) => round.windowStatus === "selling") ??
    dashboard.rounds.find((round) => round.featured.roundNumber === 1636) ??
    dashboard.rounds.find((round) => round.strictEvReady) ??
    dashboard.rounds[0] ??
    null;
  const portfolioComparison =
    primaryRound?.marketEvComparisonRows.find((row) => row.key === "market_proxy_portfolio") ??
    null;
  const plan =
    primaryRound?.portfolioPlans.find((row) => row.budgetYen === 10000) ??
    primaryRound?.primaryPortfolioPlan ??
    null;
  const evMultiple = portfolioComparison?.evMultiple ?? plan?.evMultiple ?? null;
  const status =
    primaryRound?.windowStatus === "closed"
      ? "closed"
      : opportunityStatusForMultiple(evMultiple, primaryRound ? "watch" : "data_missing");
  const expectedReturn = portfolioComparison?.expectedReturnYen ?? plan?.expectedReturnYen ?? null;
  const cost = portfolioComparison?.costYen ?? plan?.costYen ?? null;

  return {
    category: "toto",
    confidenceLabel: primaryRound?.strictEvReady ? "1-3等EV込み" : "公式データ待ち",
    evLabel: evMultiple === null ? "EV未計算" : `EV ${formatMultiple(evMultiple)}`,
    href: appRoute.worldCupStrategy,
    id: "world-cup-toto",
    nextActionLabel: primaryRound?.windowStatus === "selling" ? "締切前に見る" : "感想戦を見る",
    productLabel: "W杯toto",
    rankScore: evMultiple === null ? 35 : evMultiple * 100,
    returnRateLabel: "toto13 1-3等を合算",
    sourceLabel: "toto公式 / 保存スナップショット",
    sourceUrl: totoHowUrl,
    stakeLabel: `1口 ${formatYen(primaryRound?.stakeYen ?? 100)}`,
    status,
    title: primaryRound
      ? `W杯toto 第${primaryRound.featured.roundNumber}回`
      : "W杯toto EV司令塔",
    warningLabel:
      evMultiple !== null && evMultiple < 1
        ? "ランダムより改善しても、まだ損益分岐の1.00倍未満です。"
        : null,
    whyItMatters:
      cost !== null && expectedReturn !== null
        ? `購入額 ${formatYen(cost)} に対して期待回収 ${formatYen(expectedReturn)}。買い目とPDFへ1タップで移動できます。`
        : "公式投票率、売上、モデル確率が揃った回から優先してEVを見ます。",
  };
}

export function buildDomesticTotoOpportunityCard(input: {
  domesticRoundCount: number;
  latestRoundId: string | null;
  latestRoundTitle: string | null;
}): EvOpportunityCard {
  const hasRound = input.domesticRoundCount > 0 && input.latestRoundId !== null;

  return {
    category: "toto",
    confidenceLabel: hasRound ? "通常toto練習可" : "回作成待ち",
    evLabel: hasRound ? "EV/Proxy候補あり" : "未作成",
    href: hasRound ? buildRoundHref(appRoute.pickRoom, input.latestRoundId) : appRoute.totoOfficialRoundImport,
    id: "domestic-toto",
    nextActionLabel: hasRound ? "候補カードを見る" : "公式回から作る",
    productLabel: "通常toto / mini toto",
    rankScore: hasRound ? 42 : 25,
    returnRateLabel: "公式人気との差を利用",
    sourceLabel: "toto公式",
    sourceUrl: totoHowUrl,
    stakeLabel: "toto13 1口100円 / mini toto 1口100円",
    status: hasRound ? "watch" : "data_missing",
    title: hasRound ? input.latestRoundTitle ?? "通常toto練習回" : "通常toto 練習回を作る",
    warningLabel: "W杯ほど外部市場が厚くないため、Research Memoと人力補正を重視します。",
    whyItMatters: "W杯本番前に、王道・公式人気・人力・EV候補の使い分けを練習できます。",
  };
}

export function buildBigEvOpportunityCards(
  snapshots: BigOfficialSnapshot[],
): EvOpportunityCard[] {
  const snapshotCards = snapshots
    .map((snapshot) => {
      const watch = buildBigOfficialWatch(snapshot);
      const productType = bigCarryoverProductTypeFromOfficialKey(snapshot.productKey);
      const defaults = bigCarryoverProductDefaults[productType];
      const calculation = calculateBigCarryover({
        carryoverYen: snapshot.carryoverYen,
        currentSalesYen: snapshot.totalSalesYen,
        firstPrizeCapYen: defaults.firstPrizeCapYen,
        firstPrizeOdds: defaults.firstPrizeOdds,
        productType,
        projectedFinalSalesYen: snapshot.totalSalesYen,
        returnRate: snapshot.returnRate,
        ticketPriceYen: snapshot.stakeYen || defaults.ticketPriceYen,
      });
      const carryPressure = calculation.naiveCarryPressure;
      const status = opportunityStatusForMultiple(carryPressure, "watch");

      return {
        category: "big",
        confidenceLabel: "真EV未計算",
        evLabel: `キャリー圧 ${formatMultiple(carryPressure)}`,
        href: buildHref(appRoute.bigCarryover, buildBigCarryoverQueryFromOfficialSnapshot(snapshot)),
        id: `big-${snapshot.productKey}-${snapshot.officialRoundNumber ?? "current"}`,
        nextActionLabel: "BIGウォッチで確認",
        productLabel: snapshot.productLabel,
        rankScore: carryPressure === null ? 20 : carryPressure * 100,
        returnRateLabel: `${compactPercent(snapshot.returnRate)} + キャリー`,
        sourceLabel: "toto BIG公式同期",
        sourceUrl: snapshot.sourceUrl,
        stakeLabel: `1口 ${formatYen(snapshot.stakeYen || defaults.ticketPriceYen)}`,
        status,
        title: snapshot.officialRoundName ?? `${snapshot.productLabel} キャリー監視`,
        warningLabel: "ランダム発券です。買い目選択によるエッジはありません。",
        whyItMatters:
          watch.summary.approxEvMultiple !== null
            ? `${formatYen(snapshot.carryoverYen)} のキャリーを、現在売上 ${formatYen(snapshot.totalSalesYen)} と比較します。`
            : "売上とキャリーが揃うと、キャリー圧を比較できます。",
      } satisfies EvOpportunityCard;
    })
    .sort((left, right) => right.rankScore - left.rankScore)
    .slice(0, 2);

  if (snapshotCards.length > 0) {
    return snapshotCards;
  }

  return [
    {
      category: "big",
      confidenceLabel: "公式同期待ち",
      evLabel: "キャリー圧未計算",
      href: appRoute.bigCarryover,
      id: "big-watch-empty",
      nextActionLabel: "BIGウォッチを開く",
      productLabel: "BIG / MEGA BIG",
      rankScore: 28,
      returnRateLabel: "50% + キャリー",
      sourceLabel: "toto BIG公式",
      sourceUrl: bigOfficialDefaultSourceUrl,
      stakeLabel: "BIG/MEGA BIG 1口300円",
      status: "data_missing",
      title: "BIGキャリー監視",
      warningLabel: "真EVではなく、まず売上とキャリーの比率だけを見ます。",
      whyItMatters: "キャリーが売上に対して大きい回だけ、研究ネタとして優先します。",
    },
  ];
}

export function buildGoal3EvOpportunityCard(
  entries: TotoOfficialRoundLibraryEntry[],
): EvOpportunityCard {
  const featured = pickFeaturedGoal3Entry(entries);
  const watch = featured ? buildGoal3EventWatch(featured) : null;
  const carryPressure = watch?.summary.approxEvMultiple ?? null;

  return {
    category: "goal3",
    confidenceLabel: featured ? "公式回同期あり" : "公式回待ち",
    evLabel: carryPressure === null ? "上振れ未計算" : `上振れ ${formatMultiple(carryPressure)}`,
    href: appRoute.goal3Value,
    id: "goal3-watch",
    nextActionLabel: featured ? "GOAL3ボードを見る" : "GOAL3を同期",
    productLabel: "totoGOAL3",
    rankScore: carryPressure === null ? 22 : carryPressure * 80,
    returnRateLabel: "売上 + キャリーを見る",
    sourceLabel: "toto公式回",
    sourceUrl: totoHowUrl,
    stakeLabel: "通常1口100円",
    status: featured ? opportunityStatusForMultiple(carryPressure, "watch") : "data_missing",
    title: featured?.title ?? "GOAL3ウォッチ",
    warningLabel: "得点分布の読みは別途必要。初回は上振れ指標です。",
    whyItMatters: featured
      ? watch?.snapshot.headline ?? "GOAL3の売上とキャリーを別枠で見ます。"
      : "通常totoとは別の得点型商品なので、混ぜずに専用ボードで確認します。",
  };
}

export function buildWinnerEvOpportunityCard(input: {
  roundId: string | null;
  roundTitle: string | null;
}): EvOpportunityCard {
  const hasRound = input.roundId !== null;

  return {
    category: "winner",
    confidenceLabel: hasRound ? "1試合比較可" : "回作成待ち",
    evLabel: hasRound ? "1/0/2の歪み比較" : "未作成",
    href: hasRound ? buildRoundHref(appRoute.winnerValue, input.roundId) : appRoute.totoOfficialRoundImport,
    id: "winner-value",
    nextActionLabel: hasRound ? "WINNERボードを見る" : "WINNER回を作る",
    productLabel: "WINNER",
    rankScore: hasRound ? 40 : 20,
    returnRateLabel: "単試合の人気差を見る",
    sourceLabel: "toto公式回",
    sourceUrl: totoHowUrl,
    stakeLabel: "商品ごとの公式単価",
    status: hasRound ? "watch" : "data_missing",
    title: input.roundTitle ?? "WINNER 候補待ち",
    warningLabel: "単試合なので、過信せず市場・人力・公式人気を並べて見るだけにします。",
    whyItMatters: "13試合より説明しやすく、友人との感想戦でロジック確認に使いやすい枠です。",
  };
}

export function buildEvOpportunityCards(input: {
  bigOfficialSnapshots: BigOfficialSnapshot[];
  domesticRoundCount: number;
  domesticRoundId: string | null;
  domesticRoundTitle: string | null;
  goal3Entries: TotoOfficialRoundLibraryEntry[];
  winnerRoundId: string | null;
  winnerRoundTitle: string | null;
  worldCupStrategy: WorldCupStrategyDashboard;
}) {
  const cards: EvOpportunityCard[] = [
    buildWorldCupEvOpportunityCard(input.worldCupStrategy),
    buildDomesticTotoOpportunityCard({
      domesticRoundCount: input.domesticRoundCount,
      latestRoundId: input.domesticRoundId,
      latestRoundTitle: input.domesticRoundTitle,
    }),
    ...buildBigEvOpportunityCards(input.bigOfficialSnapshots),
    buildGoal3EvOpportunityCard(input.goal3Entries),
    buildWinnerEvOpportunityCard({
      roundId: input.winnerRoundId,
      roundTitle: input.winnerRoundTitle,
    }),
    ...publicGamblingWatchItems,
  ];

  return cards.sort((left, right) => {
    const statusDiff = statusPriority[left.status] - statusPriority[right.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }

    const scoreDiff = right.rankScore - left.rankScore;
    if (Math.abs(scoreDiff) > 0.001) {
      return scoreDiff;
    }

    return left.title.localeCompare(right.title, "ja-JP");
  });
}

export const evOpportunitySourceUrls = {
  autoRaceGradeRace7Url,
  bigHowUrl,
  boatRacePayoutUrl,
  jraRulesUrl,
  jraSuperPremiumUrl,
  jraUltraPremiumUrl,
  keirinDokantoUrl,
  totoHowUrl,
};
