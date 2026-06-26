import type { OutcomeValue } from "@/lib/domain";

export const worldCupTotoLatestReportFileName =
  "world-cup-toto-latest.pdf";
export const worldCupTotoNextPurchaseSheetFileName =
  "world-cup-toto-latest-purchase-sheet.csv";
export const worldCupTotoNextPurchaseSheet50FileName =
  "world-cup-toto-latest-50-purchase-sheet.csv";
export const worldCupTotoNextPurchaseSheet100FileName =
  "world-cup-toto-latest-100-purchase-sheet.csv";
export const worldCupTotoNextPurchaseSheet200FileName =
  "world-cup-toto-latest-200-purchase-sheet.csv";

export const worldCupTotoVersionedReportFileName =
  "world-cup-toto-1634-1637-evolved-plan-20260624-v18.pdf";
export const worldCupTotoVersionedPurchaseSheet50FileName =
  "world-cup-toto-1637-visual-5000-plan-20260624-v18.csv";
export const worldCupTotoVersionedPurchaseSheetFileName =
  "world-cup-toto-1637-visual-10000-plan-20260624-v18.csv";
export const worldCupTotoVersionedPurchaseSheet200FileName =
  "world-cup-toto-1637-visual-20000-plan-20260624-v18.csv";
export const worldCupTotoLegacyReportFileName =
  "world-cup-toto-1634-1636-evolved-plan.pdf";
export const worldCupTotoLegacyPurchaseSheetFileName =
  "world-cup-toto-1636-hot10-20000-plan.csv";

export const worldCupTotoReportVersion = {
  csv200Sha256: "46e4b414828fb0d5ed72b3d03b8d6275284a8c348051fb7dc29b2c7eac8cd4f3",
  csv50Sha256: "1e835432713777959b1bbd7fe7d2bb7ef4e40fd10064ad5fd312fa8cad929f59",
  csvSha256: "d9f00fed8df20661a9141b191e4923443b0026ff1a4a3863c514439990ba3366",
  label: "2026-06-24 v18",
  latest200CsvFileName: worldCupTotoNextPurchaseSheet200FileName,
  latestCsvFileName: worldCupTotoNextPurchaseSheetFileName,
  latest50CsvFileName: worldCupTotoNextPurchaseSheet50FileName,
  latest100CsvFileName: worldCupTotoNextPurchaseSheet100FileName,
  latestPdfFileName: worldCupTotoLatestReportFileName,
  legacyCsvFileName: worldCupTotoLegacyPurchaseSheetFileName,
  legacyPdfFileName: worldCupTotoLegacyReportFileName,
  pdfSha256: "90107d43cbb226fdb53b973f0da51ad3fd333153cf197a65751aeba9d081a9ba",
  publishedAtLabel: "2026-06-24 15:45 JST",
  versioned200CsvFileName: worldCupTotoVersionedPurchaseSheet200FileName,
  versionedCsvFileName: worldCupTotoVersionedPurchaseSheetFileName,
  versioned50CsvFileName: worldCupTotoVersionedPurchaseSheet50FileName,
  versionedPdfFileName: worldCupTotoVersionedReportFileName,
};

export const worldCupTotoOfficialResult1634Url =
  "https://sp.toto-dream.com/dcs/subos/screen/si04/ssin007/PGSSIN00701FwdLotDetailRslttoto.form?holdCntId=1634&commodityId=01&meetingFiscalYear=2026";
export const worldCupTotoOfficialVote1634Url =
  "https://sp.toto-dream.com/dcs/subos/screen/si01/ssin025/PGSSIN02501ForwardVotetotoSP.form?holdCntId=1634&commodityId=01&gameAssortment=A&fromId=SSIN026";
export const worldCupTotoOfficialResult1635Url =
  "https://sp.toto-dream.com/dcs/subos/screen/si04/ssin007/PGSSIN00701FwdLotDetailRslttoto.form?holdCntId=1635&commodityId=01&meetingFiscalYear=2026";
export const worldCupTotoOfficialVote1635Url =
  "https://sp.toto-dream.com/dcs/subos/screen/si01/ssin025/PGSSIN02501InitVoteTotoSP.form?meetingFiscalYear=2026&commodityId=01&holdCntId=1635&gameAssortment=A&fromId=SSIN008";
export const worldCupTotoOfficialVote1636Url =
  "https://sp.toto-dream.com/dcs/subos/screen/si01/ssin025/PGSSIN02501ForwardVotetotoSP.form?commodityId=01&fromId=SSIN026&gameAssortment=A&holdCntId=1636";
export const worldCupTotoOfficialSales1636Url =
  "https://sp.toto-dream.com/dcs/subos/screen/si01/ssin025/PGSSIN02501ForwardSalesTermtotoSP.form?holdCntId=1636";
export const worldCupTotoOfficialInfo1636Url =
  "https://store.toto-dream.com/dcs/subos/screen/pi01/spin000/PGSPIN00001DisptotoLotInfo.form?holdCntId=1636";
export const worldCupTotoOfficialVote1637Url =
  "https://sp.toto-dream.com/dcs/subos/screen/si01/ssin025/PGSSIN02501ForwardVotetotoSP.form?commodityId=01&fromId=SSIN026&gameAssortment=A&holdCntId=1637";
export const worldCupTotoOfficialSales1637Url =
  "https://sp.toto-dream.com/dcs/subos/screen/si01/ssin025/PGSSIN02501ForwardSalesTermtotoSP.form?holdCntId=1637";
export const worldCupTotoPolymarketSportsEventsUrl =
  "https://gateway.polymarket.us/v2/sports/soccer/events?limit=100&offset=0&type=sport&section=general";
export const worldCupTotoPolymarketSportsDocsUrl =
  "https://docs.polymarket.us/api-reference/sports/overview";
export const worldCupTotoPolymarketMarketsDocsUrl =
  "https://docs.polymarket.us/api-reference/markets/get-markets";
export const worldCupTotoPolymarketBboDocsUrl =
  "https://docs.polymarket.us/api-reference/markets/get-market-bbo";
export const worldCupTotoOddsApiDocsUrl =
  "https://the-odds-api.com/liveapi/guides/v4/";

export type TotoVoteShare = Record<OutcomeValue, number>;

export type TotoRoundReviewMatch = {
  actual: OutcomeValue;
  away: string;
  home: string;
  matchNo: number;
  score: string;
  votes: TotoVoteShare;
};

export type TotoNextPlanMatch = {
  away: string;
  home: string;
  kickoffLabel: string;
  matchNo: number;
  note: string;
  recommendedOutcomes: OutcomeValue[];
  ruleLabel: string;
  votes: TotoVoteShare;
};

export type TotoPurchaseRow = {
  amountCumulativeYen: number;
  bucket: "core" | "hedge" | "hot";
  note: string;
  picks: OutcomeValue[];
  rank: number;
  signature: string;
  unitCount: number;
};

export type Toto1637MatchRiskBucket = "flex" | "lock" | "semi" | "spread";

export type Toto1637PurchaseRow = {
  amountCumulativeYen: number;
  bucket: "direct";
  note: string;
  picks: OutcomeValue[];
  proxyScore: number;
  rank: number;
  signature: string;
  unitCount: number;
};

export type Toto1637MultiPlan = {
  budgetYen: number;
  choices: string[];
  formula: string;
  label: string;
  note: string;
  unitCount: number;
};

export type Toto1637ExternalMarketRow = {
  actionLabel: string;
  delta: Record<OutcomeValue, number>;
  marketFavoriteOutcome: OutcomeValue;
  marketProb: TotoVoteShare;
  matchLabel: string;
  matchNo: number;
  officialFavoriteOutcome: OutcomeValue;
  officialProb: TotoVoteShare;
  source: "Polymarket";
  sourceSlug: string;
  sourceUpdatedAt: string;
  strongestPositiveDeltaOutcome: OutcomeValue;
  volumeUsd: number;
};

export type Toto1637ExternalMarketOverlay = {
  comparisonRows: Toto1637ExternalMarketRow[];
  dataStatusLabel: string;
  decisionRules: string[];
  fetchedAtLabel: string;
  finalSelectionSummary: string;
  marketAdjustedPlans: Toto1637MultiPlan[];
  sourceDocs: { label: string; url: string }[];
  sourceUrl: string;
  summary: string;
};

export type Toto1636UserSlipReview = {
  costYen: number;
  hitCount: number;
  label: string;
  missedMatchNumbers: number[];
  possiblePrizeLabel: string;
  unitCount: number;
};

export type Toto1636ResultReview = {
  actualSignature: string;
  estimatedThirdPrizeYen: number;
  finalSalesYen: number;
  logicUpdates: string[];
  officialPayoutStatusLabel: string;
  payoutStartLabel: string;
  resultStatusLabel: string;
  slips: Toto1636UserSlipReview[];
  sourceUrl: string;
  summary: string;
  userEstimatedNetYen: number;
  userEstimatedPayoutYen: number;
  userStakeYen: number;
};

export type TotoOfficialVoteInterpretation = {
  label: string;
  note: string;
  signals: string[];
};

export type Toto1637FinalLockRule = {
  checkLabel: string;
  currentRead: string;
  decision: "keep108" | "expand144" | "expand162" | "downgrade54";
  downgradeCondition: string;
  keep108Condition: string;
  upgradeCondition: string;
};

export type Toto1637FinalLogic = {
  backtestSignals: string[];
  deadlineAction: string;
  label: string;
  lockRules: Toto1637FinalLockRule[];
  selectedPlanLabel: string;
  summary: string;
};

export type TotoPolymarketBacktestCoverageStatus =
  | "blocked_closed_events"
  | "forward_ready"
  | "partial_not_strict"
  | "strict_ready";

export type TotoPolymarketBacktestCoverageRow = {
  officialSnapshot: string;
  polyCoverage: string;
  resultState: string;
  roundNumber: number;
  status: TotoPolymarketBacktestCoverageStatus;
  verdict: string;
};

export type TotoPolymarketBacktestAudit = {
  auditAtLabel: string;
  clobPriceHistoryUrl: string;
  coverageRows: TotoPolymarketBacktestCoverageRow[];
  decisionFor1637: string;
  implementationRules: string[];
  sportsEventsUrl: string;
  strictConclusion: string;
  summary: string;
};

export type WorldCupContextFactorKey =
  | "country_name_bias"
  | "draw_ok"
  | "group_situation"
  | "neutral_venue"
  | "rotation_risk";

export type WorldCupContextFactor = {
  key: WorldCupContextFactorKey;
  label: string;
  note: string;
  outcomeAdjustments: Partial<Record<OutcomeValue, number>>;
};

export type Toto1637PlanMatch = TotoNextPlanMatch & {
  contextFactors: WorldCupContextFactor[];
  matchdayContextLabel: string;
  riskBucket: Toto1637MatchRiskBucket;
};

export type WorldCupTotoPhaseHeuristic = {
  action: string;
  appliesTo: string;
  phase: "matchday1" | "matchday2" | "matchday3";
  read: string;
  riskLabel: string;
};

type PrizeResult = {
  label: "1st" | "2nd" | "3rd" | "miss";
  payoutYen: number;
};

export const TOTO13_OUTCOME_COUNT = 3 ** 13;
export const TOTO13_STAKE_YEN = 100;
export const WORLD_CUP_TOTO_DRAW_HEDGE_THRESHOLD = 0.2;
const WORLD_CUP_TOTO_1636_TOTAL_SALES_YEN = 222_065_900;
const TOTO_RETURN_RATE = 0.5;
const TOTO_PRIZE_TIERS = [
  { carryoverEligible: true, missCount: 0, poolShare: 0.7 },
  { carryoverEligible: false, missCount: 1, poolShare: 0.15 },
  { carryoverEligible: false, missCount: 2, poolShare: 0.15 },
] as const;

export const worldCupTotoOfficialVoteInterpretation: TotoOfficialVoteInterpretation = {
  label: "公式投票率は日本のtoto購入者の人気",
  note:
    "公式投票率は勝率モデルではなく、日本のtoto購入者がどの出目を買っているかを示すデータ。払戻の薄さを読むp_publicとして使い、実勝率寄りのp_modelは外部市場とW杯文脈で補う。",
  signals: [
    "日本代表、ドイツ、スペイン、イングランドなどは知名度で勝ち側に寄りやすい。",
    "寄りすぎた本命は当たりやすくても払戻が薄い。外部市場との差が大きい時は分散候補にする。",
    "公式投票率は締切直前ほど重要。購入判断は最終30分の再取得を優先する。",
  ],
};

export const worldCupTotoPolymarketBacktestAudit: TotoPolymarketBacktestAudit = {
  auditAtLabel: "2026-06-24 12:40 JST",
  clobPriceHistoryUrl: "https://docs.polymarket.com/api-reference/markets/get-prices-history",
  coverageRows: [
    {
      officialSnapshot: "販売終了時点の公式投票率あり",
      polyCoverage: "Sports API通常一覧では対象13試合を再発見できず",
      resultState: "結果確定済み",
      roundNumber: 1634,
      status: "blocked_closed_events",
      verdict: "同時刻Poly優位とはまだ言えない。token IDが見つかれば再判定。",
    },
    {
      officialSnapshot: "販売終了時点の公式投票率あり",
      polyCoverage: "Sports API通常一覧では対象13試合を再発見できず",
      resultState: "結果確定済み",
      roundNumber: 1635,
      status: "blocked_closed_events",
      verdict: "公式人気順は3等圏だったが、Poly比較はtoken ID待ち。",
    },
    {
      officialSnapshot: "2026-06-20 17:02 JST公式投票率あり",
      polyCoverage: "Sports API通常一覧で7/13試合だけ確認。開始後/終了後が混ざる",
      resultState: "一部結果進行中",
      roundNumber: 1636,
      status: "partial_not_strict",
      verdict: "厳密比較には使わない。結果確定後、締切前token履歴が取れた分だけ検証。",
    },
    {
      officialSnapshot: "2026-06-24 12:17 JST公式投票率あり。締切直前に再取得予定",
      polyCoverage: "2026-06-24 12:34 JST時点のSports APIで対象13/13試合を照合済み",
      resultState: "未開催",
      roundNumber: 1637,
      status: "forward_ready",
      verdict: "前向き利用は可能。6/25 18:25に同時刻で再取得して固定する。",
    },
  ],
  decisionFor1637:
    "1634/1635でPolyが良かったとはまだ主張しない。一方、1637は全13試合の事前市場が揃っているため、公式人気の歪み検出として市場補強108口を暫定最適にし、1636反省を強く入れる場合は144口へ上げる。",
  implementationRules: [
    "過去回に現在価格や決済価格を混ぜない。販売締切前のtimestampだけを採用する。",
    "Sports APIでevent slugを解決し、CLOB token IDが取れた試合だけprices-historyへ進む。",
    "token IDが見つからない回は、Poly優位/劣位を断言せず、公式のみバックテストとして残す。",
    "1637は締切直前に公式投票率、売上、Polymarket価格を同時に保存して、次回以降の厳密バックテスト母集団にする。",
  ],
  sportsEventsUrl: worldCupTotoPolymarketSportsEventsUrl,
  strictConclusion:
    "現時点では1634/1635のPoly同時刻バックテストは未確定。1637は今から同時刻保存できるので、最適ロジックの検証対象として最優先。",
  summary:
    "Polymarketにはprices-historyがあるため厳密バックテストは設計可能。ただし1634/1635は終了済みスポーツイベントのtoken解決がまだできていないため、今は『Polyなら良かった』とは言わない。",
};

export const worldCupToto1637ContextModel = {
  factors: [
    {
      key: "neutral_venue",
      label: "中立地",
      note: "ホーム扱いでも実質中立地なので、国名だけでホーム勝ちを強く見すぎない。",
    },
    {
      key: "country_name_bias",
      label: "国名人気",
      note: "ドイツ、スペイン、フランス、イングランドなどの人気国は公開投票が勝ち側に寄りやすい。",
    },
    {
      key: "group_situation",
      label: "グループ状況",
      note: "突破条件、得失点差、勝点差で必要な結果が変わる。第3戦はここを締切直前に再確認する。",
    },
    {
      key: "draw_ok",
      label: "引き分けOK",
      note: "強豪側が引き分けでも足りる局面では、勝ち一本よりドローを少し厚くする。",
    },
    {
      key: "rotation_risk",
      label: "主力温存",
      note: "突破濃厚・日程余裕・累積警告リスクがある人気国は勝率を少し下げて分散を見る。",
    },
  ] satisfies { key: WorldCupContextFactorKey; label: string; note: string }[],
  label: "1637 W杯第3戦コンテキスト補正",
  summary:
    "公開投票だけでなく、中立地、国名人気、グループ状況、引き分けOK、主力温存を試合別に持たせ、proxy確率と買い目ランキングへ反映する。",
};

function contextFactor(
  key: WorldCupContextFactorKey,
  outcomeAdjustments: Partial<Record<OutcomeValue, number>>,
): WorldCupContextFactor {
  const factor = worldCupToto1637ContextModel.factors.find((item) => item.key === key);

  return {
    key,
    label: factor?.label ?? key,
    note: factor?.note ?? "",
    outcomeAdjustments,
  };
}

function favoriteFromVotes(votes: TotoVoteShare) {
  return (["1", "0", "2"] as const)
    .map((outcome) => ({ outcome, share: votes[outcome] }))
    .sort((left, right) => right.share - left.share)[0].outcome;
}

export function signatureFromOutcomes(outcomes: readonly OutcomeValue[]) {
  return outcomes.join("");
}

function signatureFromMatches<T extends { actual: OutcomeValue }>(matches: readonly T[]) {
  return signatureFromOutcomes(matches.map((match) => match.actual));
}

function publicFavoriteSignature(matches: readonly { votes: TotoVoteShare }[]) {
  return signatureFromOutcomes(matches.map((match) => favoriteFromVotes(match.votes)));
}

export function missCount(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let misses = 0;

  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) {
      misses += 1;
    }
  }

  return misses;
}

function prizeFromMisses(misses: number): PrizeResult {
  if (misses === 0) {
    return { label: "1st", payoutYen: 1_202_060 };
  }

  if (misses === 1) {
    return { label: "2nd", payoutYen: 1_740 };
  }

  if (misses === 2) {
    return { label: "3rd", payoutYen: 220 };
  }

  return { label: "miss", payoutYen: 0 };
}

function combination(n: number, k: number) {
  if (k < 0 || k > n) {
    return 0;
  }

  const normalizedK = Math.min(k, n - k);
  let result = 1;

  for (let index = 1; index <= normalizedK; index += 1) {
    result = (result * (n - normalizedK + index)) / index;
  }

  return result;
}

function waysWithAtMostMisses(matchCount: number, maxMisses: number) {
  let ways = 0;

  for (let misses = 0; misses <= maxMisses; misses += 1) {
    ways += combination(matchCount, misses) * 2 ** misses;
  }

  return ways;
}

export function randomTicketHitProbability(ticketCount: number, maxMisses: number) {
  const perTicket = waysWithAtMostMisses(13, maxMisses) / TOTO13_OUTCOME_COUNT;
  return 1 - (1 - perTicket) ** ticketCount;
}

export const worldCupToto1634Matches: TotoRoundReviewMatch[] = [
  { matchNo: 1, home: "Qatar", away: "Switzerland", score: "1-1", actual: "0", votes: { "1": 0.0512, "0": 0.1062, "2": 0.8426 } },
  { matchNo: 2, home: "Brazil", away: "Morocco", score: "1-1", actual: "0", votes: { "1": 0.557, "0": 0.2589, "2": 0.1841 } },
  { matchNo: 3, home: "Germany", away: "Curacao", score: "7-1", actual: "1", votes: { "1": 0.9526, "0": 0.0296, "2": 0.0178 } },
  { matchNo: 4, home: "Netherlands", away: "Japan", score: "2-2", actual: "0", votes: { "1": 0.3679, "0": 0.3095, "2": 0.3226 } },
  { matchNo: 5, home: "Belgium", away: "Egypt", score: "1-1", actual: "0", votes: { "1": 0.7275, "0": 0.1731, "2": 0.0994 } },
  { matchNo: 6, home: "Canada", away: "Bosnia and Herzegovina", score: "1-1", actual: "0", votes: { "1": 0.505, "0": 0.3012, "2": 0.1938 } },
  { matchNo: 7, home: "Cote d'Ivoire", away: "Ecuador", score: "1-0", actual: "1", votes: { "1": 0.2711, "0": 0.3158, "2": 0.4131 } },
  { matchNo: 8, home: "Spain", away: "Cape Verde", score: "0-0", actual: "0", votes: { "1": 0.94, "0": 0.0406, "2": 0.0194 } },
  { matchNo: 9, home: "Saudi Arabia", away: "Uruguay", score: "1-1", actual: "0", votes: { "1": 0.0782, "0": 0.1557, "2": 0.7661 } },
  { matchNo: 10, home: "Sweden", away: "Tunisia", score: "5-1", actual: "1", votes: { "1": 0.5296, "0": 0.2895, "2": 0.1809 } },
  { matchNo: 11, home: "Haiti", away: "Scotland", score: "0-1", actual: "2", votes: { "1": 0.0712, "0": 0.113, "2": 0.8158 } },
  { matchNo: 12, home: "Australia", away: "Turkey", score: "2-0", actual: "1", votes: { "1": 0.1962, "0": 0.2893, "2": 0.5145 } },
  { matchNo: 13, home: "United States", away: "Paraguay", score: "4-1", actual: "1", votes: { "1": 0.5591, "0": 0.262, "2": 0.1789 } },
];

const actual1634Signature = signatureFromMatches(worldCupToto1634Matches);
const publicFavorite1634Signature = publicFavoriteSignature(worldCupToto1634Matches);
const publicFavorite1634Misses = missCount(actual1634Signature, publicFavorite1634Signature);

export const worldCupToto1634Review = {
  actualSignature: actual1634Signature,
  publicFavoriteSignature: publicFavorite1634Signature,
  publicFavoriteMisses: publicFavorite1634Misses,
  publicFavoritePrize: { label: "miss" as const, payoutYen: 0 },
  previousReportPositiveLineCount: 9,
  previousReportBestDistance: 3,
  previousReportTopRows: [
    { rank: 1, signature: "0010102122211", misses: 5, evMultiple: 1932.66 },
    { rank: 2, signature: "0010102121211", misses: 4, evMultiple: 1849.37 },
    { rank: 3, signature: "0010102120211", misses: 5, evMultiple: 1836.32 },
    { rank: 4, signature: "0010101122211", misses: 4, evMultiple: 1821.56 },
    { rank: 5, signature: "0010101121211", misses: 3, evMultiple: 1764.55 },
    { rank: 6, signature: "0010101120211", misses: 4, evMultiple: 1742.71 },
    { rank: 7, signature: "0010100122211", misses: 5, evMultiple: 1676.63 },
    { rank: 8, signature: "0010100121211", misses: 4, evMultiple: 1615.67 },
    { rank: 9, signature: "0010100120211", misses: 5, evMultiple: 1599.45 },
  ],
  resultAnnouncedAt: "2026-06-16",
  salesClosedAt: "2026-06-12 19:00 JST",
  totalSalesYen: 289_166_800,
  payoutByTier: {
    first: 0,
    second: 7_229_170,
    third: 219_060,
  },
  carryoverYen: 127_916_600,
};

export const worldCupToto1635Matches: TotoRoundReviewMatch[] = [
  { matchNo: 1, home: "France", away: "Senegal", score: "3-1", actual: "1", votes: { "1": 0.6976, "0": 0.2124, "2": 0.09 } },
  { matchNo: 2, home: "Argentina", away: "Algeria", score: "3-0", actual: "1", votes: { "1": 0.7537, "0": 0.1739, "2": 0.0724 } },
  { matchNo: 3, home: "England", away: "Croatia", score: "4-2", actual: "1", votes: { "1": 0.4683, "0": 0.3323, "2": 0.1994 } },
  { matchNo: 4, home: "Mexico", away: "Korea", score: "1-0", actual: "1", votes: { "1": 0.5117, "0": 0.3079, "2": 0.1804 } },
  { matchNo: 5, home: "Scotland", away: "Morocco", score: "0-1", actual: "2", votes: { "1": 0.1128, "0": 0.2082, "2": 0.679 } },
  { matchNo: 6, home: "Austria", away: "Jordan", score: "3-1", actual: "1", votes: { "1": 0.7437, "0": 0.1862, "2": 0.0701 } },
  { matchNo: 7, home: "Uzbekistan", away: "Colombia", score: "1-3", actual: "2", votes: { "1": 0.0653, "0": 0.1818, "2": 0.7529 } },
  { matchNo: 8, home: "Czech Republic", away: "South Africa", score: "1-1", actual: "0", votes: { "1": 0.5331, "0": 0.2887, "2": 0.1782 } },
  { matchNo: 9, home: "Canada", away: "Qatar", score: "6-0", actual: "1", votes: { "1": 0.5909, "0": 0.2792, "2": 0.1299 } },
  { matchNo: 10, home: "Brazil", away: "Haiti", score: "3-0", actual: "1", votes: { "1": 0.9322, "0": 0.0473, "2": 0.0205 } },
  { matchNo: 11, home: "Portugal", away: "Congo DR", score: "1-1", actual: "0", votes: { "1": 0.859, "0": 0.1006, "2": 0.0404 } },
  { matchNo: 12, home: "Ghana", away: "Panama", score: "1-0", actual: "1", votes: { "1": 0.4409, "0": 0.2991, "2": 0.26 } },
  { matchNo: 13, home: "Switzerland", away: "Bosnia and Herzegovina", score: "4-1", actual: "1", votes: { "1": 0.5941, "0": 0.2729, "2": 0.133 } },
];

const actual1635Signature = signatureFromMatches(worldCupToto1635Matches);
const publicFavorite1635Signature = publicFavoriteSignature(worldCupToto1635Matches);
const publicFavorite1635Misses = missCount(actual1635Signature, publicFavorite1635Signature);
const publicFavorite1635Prize = prizeFromMisses(publicFavorite1635Misses);

export const worldCupToto1635Review = {
  actualSignature: actual1635Signature,
  payoutByTier: {
    first: 1_202_060,
    second: 1_740,
    third: 220,
  },
  publicFavoriteMisses: publicFavorite1635Misses,
  publicFavoritePrize: publicFavorite1635Prize,
  publicFavoriteSignature: publicFavorite1635Signature,
  randomSimulationRows: [1, 10, 100, 200].map((lineCount) => ({
    costYen: lineCount * TOTO13_STAKE_YEN,
    exactProbability: randomTicketHitProbability(lineCount, 0),
    lineCount,
    secondOrBetterProbability: randomTicketHitProbability(lineCount, 1),
    thirdOrBetterProbability: randomTicketHitProbability(lineCount, 2),
  })),
  resultAnnouncedAt: "2026-06-20",
  salesClosedAt: "2026-06-16 19:00 JST",
  sourceAsOf: "2026-06-16 sales close",
  totalSalesYen: 252_729_800,
  voteUnits: 2_527_298,
};

export const worldCupToto1636Matches: TotoNextPlanMatch[] = [
  { matchNo: 1, kickoffLabel: "06/21 05:00", home: "Germany", away: "Cote d'Ivoire", votes: { "1": 0.7125, "0": 0.2123, "2": 0.0752 }, recommendedOutcomes: ["1", "0"], ruleLabel: "favorite plus 20% draw hedge", note: "Draw probability is above 20%, so keep the draw even with a 70% favorite." },
  { matchNo: 2, kickoffLabel: "06/21 13:00", home: "Tunisia", away: "Japan", votes: { "1": 0.0798, "0": 0.2292, "2": 0.691 }, recommendedOutcomes: ["2", "0"], ruleLabel: "Japan win plus draw", note: "Japan is the main line, but the draw is cheap enough to keep." },
  { matchNo: 3, kickoffLabel: "06/23 02:00", home: "Argentina", away: "Austria", votes: { "1": 0.7591, "0": 0.184, "2": 0.0569 }, recommendedOutcomes: ["1"], ruleLabel: "lock favorite over 70%", note: "Keep as a lock in the core sheet." },
  { matchNo: 4, kickoffLabel: "06/24 08:00", home: "Panama", away: "Croatia", votes: { "1": 0.0428, "0": 0.1325, "2": 0.8247 }, recommendedOutcomes: ["2"], ruleLabel: "lock away favorite over 80%", note: "Croatia win is too expensive to fade in the core sheet." },
  { matchNo: 5, kickoffLabel: "06/24 11:00", home: "Colombia", away: "Congo DR", votes: { "1": 0.706, "0": 0.2264, "2": 0.0676 }, recommendedOutcomes: ["1", "0"], ruleLabel: "favorite plus 20% draw hedge", note: "Colombia is the main route, but draw probability is above 20%." },
  { matchNo: 6, kickoffLabel: "06/21 02:00", home: "Netherlands", away: "Sweden", votes: { "1": 0.4985, "0": 0.3152, "2": 0.1863 }, recommendedOutcomes: ["1", "0", "2"], ruleLabel: "spread split match", note: "This is the main variance slot." },
  { matchNo: 7, kickoffLabel: "06/22 07:00", home: "Uruguay", away: "Cape Verde", votes: { "1": 0.7138, "0": 0.2236, "2": 0.0626 }, recommendedOutcomes: ["1", "0"], ruleLabel: "favorite plus 20% draw hedge", note: "This is the Cape Verde miss: draw probability was above 20%, so it must remain in the recommended sheet." },
  { matchNo: 8, kickoffLabel: "06/23 09:00", home: "Norway", away: "Senegal", votes: { "1": 0.4495, "0": 0.2928, "2": 0.2577 }, recommendedOutcomes: ["1", "0", "2"], ruleLabel: "spread 30% band", note: "Wide enough to keep all three outcomes in the core sheet." },
  { matchNo: 9, kickoffLabel: "06/24 02:00", home: "Portugal", away: "Uzbekistan", votes: { "1": 0.8075, "0": 0.1492, "2": 0.0433 }, recommendedOutcomes: ["1"], ruleLabel: "lock favorite over 80%", note: "Use as a lock." },
  { matchNo: 10, kickoffLabel: "06/23 12:00", home: "Jordan", away: "Algeria", votes: { "1": 0.1496, "0": 0.3319, "2": 0.5185 }, recommendedOutcomes: ["2", "0"], ruleLabel: "away win plus draw", note: "Algeria is the main line; draw has enough public share to cover." },
  { matchNo: 11, kickoffLabel: "06/22 01:00", home: "Spain", away: "Saudi Arabia", votes: { "1": 0.8381, "0": 0.1246, "2": 0.0373 }, recommendedOutcomes: ["1"], ruleLabel: "lock favorite over 80%", note: "Use as a lock." },
  { matchNo: 12, kickoffLabel: "06/24 05:00", home: "England", away: "Ghana", votes: { "1": 0.8433, "0": 0.1169, "2": 0.0398 }, recommendedOutcomes: ["1"], ruleLabel: "lock favorite over 80%", note: "Use as a lock." },
  { matchNo: 13, kickoffLabel: "06/21 09:00", home: "Ecuador", away: "Curacao", votes: { "1": 0.85, "0": 0.1122, "2": 0.0378 }, recommendedOutcomes: ["1"], ruleLabel: "lock favorite over 80%", note: "Use as a lock." },
];

const worldCupToto1636ActualSignature = "1212010112100";

function reviewUserSlip1636(
  label: string,
  unitCount: number,
  choices: string[],
): Toto1636UserSlipReview {
  const missedMatchNumbers = choices
    .map((choice, index) => ({
      hit: choice.split("/").includes(worldCupToto1636ActualSignature[index] as OutcomeValue),
      matchNo: index + 1,
    }))
    .filter((row) => !row.hit)
    .map((row) => row.matchNo);
  const hitCount = 13 - missedMatchNumbers.length;

  return {
    costYen: unitCount * TOTO13_STAKE_YEN,
    hitCount,
    label,
    missedMatchNumbers,
    possiblePrizeLabel: missedMatchNumbers.length === 0 ? "1等圏" : missedMatchNumbers.length === 1 ? "2等圏" : missedMatchNumbers.length === 2 ? "3等圏" : "圏外",
    unitCount,
  };
}

export const worldCupToto1636ResultReview: Toto1636ResultReview = {
  actualSignature: worldCupToto1636ActualSignature,
  estimatedThirdPrizeYen: 1_560,
  finalSalesYen: 273_312_700,
  logicUpdates: [
    "70%以上の強人気でも、公式ドローが10-12%以上かつ外部市場ドローが20%前後なら単独固定を解除する。",
    "公式ドロー20%以上は引き続き買い目候補へ残す。1636ではM05/M07/M10のドロー保険が効いた。",
    "第3戦は勝点条件、引き分けOK、主力温存を強めに見る。1637ではM01/M03/M13の強人気ドローを最終確認する。",
    "口数を増やせない場合は、全分散を増やすより、強人気ドローを先に守る。",
  ],
  officialPayoutStatusLabel: "公式払戻は結果発表待ち。3等は概算で約1,560円として扱う。",
  payoutStartLabel: "2026-06-26",
  resultStatusLabel: "全13試合の実出目は 1212010112100 として反省に反映済み。",
  slips: [
    reviewUserSlip1636(
      "64口 / 6,400円",
      64,
      ["1", "0/2", "1", "2", "1/0", "1/0", "1/0", "1/0", "1", "0/2", "1", "1", "1"],
    ),
    reviewUserSlip1636(
      "16口 / 1,600円",
      16,
      ["1", "0/2", "1", "2", "1", "1/0", "1", "1/0", "1", "0/2", "1", "1", "1"],
    ),
  ],
  sourceUrl: worldCupTotoOfficialInfo1636Url,
  summary:
    "ユーザー購入80口は、64口側がM12 England-GhanaとM13 Ecuador-Curacaoの強人気ドローを外して11/13、3等圏。16口側は9/13で圏外。次回は強人気でもドローを外す条件を厳しくする。",
  userEstimatedNetYen: 1_560 - 8_000,
  userEstimatedPayoutYen: 1_560,
  userStakeYen: 8_000,
};

export const worldCupToto1637Matches: Toto1637PlanMatch[] = [
  {
    matchNo: 1,
    kickoffLabel: "06/26 05:00",
    home: "Ecuador",
    away: "Germany",
    votes: { "1": 0.0656, "0": 0.1282, "2": 0.8062 },
    recommendedOutcomes: ["2", "0"],
    ruleLabel: "favorite plus matchday3 draw",
    note: "Germany is still the main line, but country-name bias, draw-ok condition, and rotation risk keep draw in the sheet.",
    riskBucket: "semi",
    matchdayContextLabel: "第3戦: 強豪人気の勝ち一本を少し割り引く",
    contextFactors: [
      contextFactor("neutral_venue", { "0": 0.02, "1": 0.01 }),
      contextFactor("country_name_bias", { "2": -0.03, "0": 0.04, "1": 0.02 }),
      contextFactor("group_situation", { "0": 0.03, "1": 0.02 }),
      contextFactor("draw_ok", { "2": -0.02, "0": 0.06 }),
      contextFactor("rotation_risk", { "2": -0.04, "0": 0.05, "1": 0.02 }),
    ],
  },
  {
    matchNo: 2,
    kickoffLabel: "06/26 08:00",
    home: "Japan",
    away: "Sweden",
    votes: { "1": 0.6531, "0": 0.2394, "2": 0.1075 },
    recommendedOutcomes: ["1", "0"],
    ruleLabel: "Japan win plus draw",
    note: "Japan is the main line, but public share has moved above 60%, so draw remains a necessary hedge.",
    riskBucket: "flex",
    matchdayContextLabel: "第3戦: 日本人気の過熱をドローで受ける",
    contextFactors: [
      contextFactor("neutral_venue", { "0": 0.02, "2": 0.01 }),
      contextFactor("country_name_bias", { "1": -0.02, "0": 0.04, "2": 0.02 }),
      contextFactor("group_situation", { "0": 0.04 }),
      contextFactor("draw_ok", { "1": -0.01, "0": 0.05 }),
    ],
  },
  {
    matchNo: 3,
    kickoffLabel: "06/27 09:00",
    home: "Uruguay",
    away: "Spain",
    votes: { "1": 0.082, "0": 0.1858, "2": 0.7322 },
    recommendedOutcomes: ["2", "0"],
    ruleLabel: "semi lock plus draw",
    note: "Spain is the main line; group condition and rotation risk keep draw alive until the final standings check.",
    riskBucket: "semi",
    matchdayContextLabel: "第3戦: スペイン人気にドロー補正",
    contextFactors: [
      contextFactor("neutral_venue", { "0": 0.02, "1": 0.01 }),
      contextFactor("country_name_bias", { "2": -0.03, "0": 0.04, "1": 0.02 }),
      contextFactor("group_situation", { "0": 0.04, "1": 0.01 }),
      contextFactor("draw_ok", { "2": -0.02, "0": 0.05 }),
      contextFactor("rotation_risk", { "2": -0.03, "0": 0.04, "1": 0.02 }),
    ],
  },
  {
    matchNo: 4,
    kickoffLabel: "06/28 08:30",
    home: "Colombia",
    away: "Portugal",
    votes: { "1": 0.2589, "0": 0.3069, "2": 0.4342 },
    recommendedOutcomes: ["2", "0", "1"],
    ruleLabel: "full spread",
    note: "Portugal leads public share, but the match is not a lock. Keep all three outcomes.",
    riskBucket: "spread",
    matchdayContextLabel: "第3戦: 人気国だが公開票が割れている",
    contextFactors: [
      contextFactor("neutral_venue", { "0": 0.02 }),
      contextFactor("country_name_bias", { "2": -0.02, "0": 0.03, "1": 0.02 }),
      contextFactor("group_situation", { "1": 0.02, "0": 0.03, "2": 0.01 }),
      contextFactor("draw_ok", { "0": 0.04 }),
      contextFactor("rotation_risk", { "2": -0.02, "0": 0.03, "1": 0.02 }),
    ],
  },
  {
    matchNo: 5,
    kickoffLabel: "06/28 11:00",
    home: "Algeria",
    away: "Austria",
    votes: { "1": 0.2031, "0": 0.2959, "2": 0.501 },
    recommendedOutcomes: ["2", "0"],
    ruleLabel: "away win plus draw",
    note: "Austria is the main line; draw is material enough to keep and is helped by group-condition risk.",
    riskBucket: "flex",
    matchdayContextLabel: "第3戦: 半人気側の勝ちとドロー",
    contextFactors: [
      contextFactor("neutral_venue", { "0": 0.02, "1": 0.01 }),
      contextFactor("group_situation", { "0": 0.04, "1": 0.02 }),
      contextFactor("draw_ok", { "2": -0.01, "0": 0.05 }),
      contextFactor("rotation_risk", { "2": -0.02, "0": 0.03, "1": 0.02 }),
    ],
  },
  {
    matchNo: 6,
    kickoffLabel: "06/26 08:00",
    home: "Tunisia",
    away: "Netherlands",
    votes: { "1": 0.0412, "0": 0.053, "2": 0.9058 },
    recommendedOutcomes: ["2", "0"],
    ruleLabel: "favorite plus thin draw hedge",
    note: "Netherlands remains the main line, but 90%+ public share is exactly where rotation and draw-ok risk should be visible.",
    riskBucket: "semi",
    matchdayContextLabel: "第3戦: 90%超の強豪人気をドローで薄く保険",
    contextFactors: [
      contextFactor("neutral_venue", { "0": 0.02, "1": 0.01 }),
      contextFactor("country_name_bias", { "2": -0.04, "0": 0.04, "1": 0.02 }),
      contextFactor("group_situation", { "0": 0.03 }),
      contextFactor("draw_ok", { "2": -0.03, "0": 0.06 }),
      contextFactor("rotation_risk", { "2": -0.05, "0": 0.05, "1": 0.02 }),
    ],
  },
  {
    matchNo: 7,
    kickoffLabel: "06/26 11:00",
    home: "Paraguay",
    away: "Australia",
    votes: { "1": 0.3556, "0": 0.3176, "2": 0.3268 },
    recommendedOutcomes: ["1", "0", "2"],
    ruleLabel: "three-way split",
    note: "The public is almost flat. This is one of the main coverage slots.",
    riskBucket: "spread",
    matchdayContextLabel: "第3戦: 公開票が均衡、全分散",
    contextFactors: [
      contextFactor("neutral_venue", { "0": 0.02 }),
      contextFactor("group_situation", { "1": 0.02, "0": 0.03, "2": 0.02 }),
      contextFactor("draw_ok", { "0": 0.04 }),
    ],
  },
  {
    matchNo: 8,
    kickoffLabel: "06/27 04:00",
    home: "Norway",
    away: "France",
    votes: { "1": 0.1135, "0": 0.1884, "2": 0.6981 },
    recommendedOutcomes: ["2", "0"],
    ruleLabel: "semi lock plus draw",
    note: "France is the main line; keep draw as the cheap matchday3 hedge.",
    riskBucket: "semi",
    matchdayContextLabel: "第3戦: フランス人気と主力温存リスク",
    contextFactors: [
      contextFactor("neutral_venue", { "0": 0.02, "1": 0.01 }),
      contextFactor("country_name_bias", { "2": -0.03, "0": 0.04, "1": 0.02 }),
      contextFactor("group_situation", { "0": 0.03, "1": 0.01 }),
      contextFactor("draw_ok", { "2": -0.02, "0": 0.05 }),
      contextFactor("rotation_risk", { "2": -0.04, "0": 0.04, "1": 0.02 }),
    ],
  },
  {
    matchNo: 9,
    kickoffLabel: "06/28 06:00",
    home: "Panama",
    away: "England",
    votes: { "1": 0.0408, "0": 0.058, "2": 0.9012 },
    recommendedOutcomes: ["2"],
    ruleLabel: "lock favorite over 92%",
    note: "England is still a hard lock unless final lineup news is extreme.",
    riskBucket: "lock",
    matchdayContextLabel: "第3戦: 補正ありでも勝ち優先",
    contextFactors: [
      contextFactor("neutral_venue", { "0": 0.01, "1": 0.01 }),
      contextFactor("country_name_bias", { "2": -0.03, "0": 0.03 }),
      contextFactor("rotation_risk", { "2": -0.03, "0": 0.03, "1": 0.01 }),
    ],
  },
  {
    matchNo: 10,
    kickoffLabel: "06/28 08:30",
    home: "Congo DR",
    away: "Uzbekistan",
    votes: { "1": 0.433, "0": 0.329, "2": 0.238 },
    recommendedOutcomes: ["1", "0", "2"],
    ruleLabel: "three-way split",
    note: "Top two outcomes are only 4.8pt apart and draw is above 30%. Keep all three.",
    riskBucket: "spread",
    matchdayContextLabel: "第3戦: 30%台に散る主分散枠",
    contextFactors: [
      contextFactor("neutral_venue", { "0": 0.02 }),
      contextFactor("group_situation", { "1": 0.02, "0": 0.03, "2": 0.02 }),
      contextFactor("draw_ok", { "0": 0.04 }),
    ],
  },
  {
    matchNo: 11,
    kickoffLabel: "06/28 11:00",
    home: "Jordan",
    away: "Argentina",
    votes: { "1": 0.0387, "0": 0.0496, "2": 0.9117 },
    recommendedOutcomes: ["2"],
    ruleLabel: "lock favorite over 93%",
    note: "Argentina is a hard lock unless group condition means heavy rotation.",
    riskBucket: "lock",
    matchdayContextLabel: "第3戦: 補正ありでも勝ち優先",
    contextFactors: [
      contextFactor("neutral_venue", { "0": 0.01, "1": 0.01 }),
      contextFactor("country_name_bias", { "2": -0.03, "0": 0.03 }),
      contextFactor("rotation_risk", { "2": -0.03, "0": 0.03, "1": 0.01 }),
    ],
  },
  {
    matchNo: 12,
    kickoffLabel: "06/27 12:00",
    home: "New Zealand",
    away: "Belgium",
    votes: { "1": 0.0589, "0": 0.1245, "2": 0.8166 },
    recommendedOutcomes: ["2", "0"],
    ruleLabel: "favorite plus thin draw hedge",
    note: "Belgium remains the main line, but 88%+ public share plus rotation risk is enough to keep draw in the preliminary sheet.",
    riskBucket: "semi",
    matchdayContextLabel: "第3戦: ベルギー人気をドローで薄く保険",
    contextFactors: [
      contextFactor("neutral_venue", { "0": 0.02, "1": 0.01 }),
      contextFactor("country_name_bias", { "2": -0.04, "0": 0.04, "1": 0.02 }),
      contextFactor("group_situation", { "0": 0.03 }),
      contextFactor("draw_ok", { "2": -0.02, "0": 0.06 }),
      contextFactor("rotation_risk", { "2": -0.04, "0": 0.05, "1": 0.02 }),
    ],
  },
  {
    matchNo: 13,
    kickoffLabel: "06/28 06:00",
    home: "Croatia",
    away: "Ghana",
    votes: { "1": 0.7283, "0": 0.1825, "2": 0.0892 },
    recommendedOutcomes: ["1", "0"],
    ruleLabel: "semi lock plus draw",
    note: "Croatia is the main line; keep draw because matchday3 can turn into a condition game.",
    riskBucket: "semi",
    matchdayContextLabel: "第3戦: クロアチア人気と引き分け条件",
    contextFactors: [
      contextFactor("neutral_venue", { "0": 0.02, "2": 0.01 }),
      contextFactor("country_name_bias", { "1": -0.02, "0": 0.03, "2": 0.01 }),
      contextFactor("group_situation", { "0": 0.04, "2": 0.01 }),
      contextFactor("draw_ok", { "1": -0.02, "0": 0.06 }),
      contextFactor("rotation_risk", { "1": -0.03, "0": 0.04, "2": 0.02 }),
    ],
  },
];

export const worldCupTotoPhaseHeuristics: WorldCupTotoPhaseHeuristic[] = [
  {
    action: "強人気でもドロー事故を疑う。初見の守備ブロック、GK上振れ、慎重な入りをメモする。",
    appliesTo: "1634寄り",
    phase: "matchday1",
    read: "初戦は情報不足。見た目は順当でも、強豪が慎重に入り、弱者が守り切る事故が起きやすい。",
    riskLabel: "荒れ警戒",
  },
  {
    action: "今回の1636はここを主軸に置く。強人気固定を基本にしつつ、事前ドロー20%以上は候補に残す。",
    appliesTo: "1636寄り",
    phase: "matchday2",
    read: "第2戦は初戦の情報が入り、まだ突破条件が歪みすぎていない。順当寄りに評価しやすい。",
    riskLabel: "順当寄り",
  },
  {
    action: "次回1637以降で強く見る。勝点条件、主力温存、引き分けOK、大量得点狙いを別ロジックで足す。",
    appliesTo: "1637寄り",
    phase: "matchday3",
    read: "第3戦は条件戦。実力差より、突破条件・得失点差・ローテーションで出目がズレる。",
    riskLabel: "条件戦警戒",
  },
];

export const worldCupToto1636PhaseDecision = {
  label: "1636は第2戦寄りとして扱う",
  summary:
    "Haziの読みを採用して、1636は大荒れ前提へ寄せすぎない。ただしCape Verde型の反省として、事前ドロー確率20%以上は強人気でも買い目候補に残す。",
};

function normalizeVoteShares(values: number[]) {
  const clipped = values.map((value) => Math.max(value, 0.01));
  const total = clipped.reduce((sum, value) => sum + value, 0);

  return {
    "1": clipped[0] / total,
    "0": clipped[1] / total,
    "2": clipped[2] / total,
  } satisfies TotoVoteShare;
}

function contextFactorsForMatch(match: TotoNextPlanMatch) {
  return "contextFactors" in match ? (match as Toto1637PlanMatch).contextFactors : [];
}

function contextAdjustmentForOutcome(match: TotoNextPlanMatch, outcome: OutcomeValue) {
  return contextFactorsForMatch(match).reduce((sum, factor) => {
    return sum + (factor.outcomeAdjustments[outcome] ?? 0);
  }, 0);
}

function proxyVotesForMatch(match: TotoNextPlanMatch) {
  const values = (["1", "0", "2"] as const).map((outcome) => {
    const boost = match.recommendedOutcomes.includes(outcome)
      ? match.recommendedOutcomes.length === 1
        ? 1.08
        : 1.04
      : 0.84;
    const contextBoost = Math.min(1.22, Math.max(0.78, 1 + contextAdjustmentForOutcome(match, outcome)));
    const base = match.votes[outcome] * boost * contextBoost;

    return match.recommendedOutcomes.length === 3 ? base * 0.96 + (1 / 3) * 0.04 : base;
  });

  return normalizeVoteShares(values);
}

function probabilityForSignatureFrom(signature: string, voteRows: TotoVoteShare[]) {
  return signature.split("").reduce((probability, outcome, index) => {
    return probability * (voteRows[index]?.[outcome as OutcomeValue] ?? 0);
  }, 1);
}

function tierProbability(probabilities: number[], missCount: number) {
  const dp = Array.from({ length: missCount + 1 }, () => 0);
  dp[0] = 1;

  probabilities.forEach((hitProbability) => {
    const missProbability = 1 - hitProbability;

    for (let misses = missCount; misses >= 0; misses -= 1) {
      dp[misses] =
        dp[misses] * hitProbability + (misses > 0 ? dp[misses - 1] * missProbability : 0);
    }
  });

  return dp[missCount];
}

function ticketProxyExpectedReturn(signature: string) {
  const proxyRows = worldCupToto1636Matches.map(proxyVotesForMatch);
  const publicRows = worldCupToto1636Matches.map((match) => match.votes);
  const outcomes = signature.split("") as OutcomeValue[];
  const selectedModel = outcomes.map((outcome, index) => proxyRows[index]?.[outcome] ?? 0);
  const selectedPublic = outcomes.map((outcome, index) => publicRows[index]?.[outcome] ?? 0);

  return TOTO_PRIZE_TIERS.reduce((expectedReturn, tier) => {
    const pModel = tierProbability(selectedModel, tier.missCount);
    const pPublic = tierProbability(selectedPublic, tier.missCount);
    const expectedOtherWinners = Math.max(
      0,
      (WORLD_CUP_TOTO_1636_TOTAL_SALES_YEN / TOTO13_STAKE_YEN - 1) * pPublic,
    );
    const prizePool =
      WORLD_CUP_TOTO_1636_TOTAL_SALES_YEN * TOTO_RETURN_RATE * tier.poolShare +
      (tier.carryoverEligible ? 0 : 0);

    return expectedReturn + pModel * (prizePool / (1 + expectedOtherWinners));
  }, 0);
}

function ticketProxyEvMultiple(signature: string) {
  return ticketProxyExpectedReturn(signature) / TOTO13_STAKE_YEN;
}

function buildCoreRows() {
  const rows: OutcomeValue[][] = [[]];

  worldCupToto1636Matches.forEach((match) => {
    const nextRows: OutcomeValue[][] = [];

    rows.forEach((row) => {
      match.recommendedOutcomes.forEach((outcome) => {
        nextRows.push([...row, outcome]);
      });
    });

    rows.splice(0, rows.length, ...nextRows);
  });

  return rows;
}

function buildAllowedRows(matches: readonly TotoNextPlanMatch[]) {
  const rows: OutcomeValue[][] = [[]];

  matches.forEach((match) => {
    const nextRows: OutcomeValue[][] = [];

    rows.forEach((row) => {
      match.recommendedOutcomes.forEach((outcome) => {
        nextRows.push([...row, outcome]);
      });
    });

    rows.splice(0, rows.length, ...nextRows);
  });

  return rows;
}

function buildHedgeRows(coreRows: OutcomeValue[][]) {
  const bySignature = new Map<string, OutcomeValue[]>();

  coreRows.forEach((row) => {
    bySignature.set(signatureFromOutcomes(row), row);
  });

  coreRows.forEach((row) => {
    worldCupToto1636Matches.forEach((match, matchIndex) => {
      (["1", "0", "2"] as const)
        .filter((outcome) => !match.recommendedOutcomes.includes(outcome))
        .forEach((outcome) => {
          const next = [...row];
          next[matchIndex] = outcome;
          bySignature.set(signatureFromOutcomes(next), next);
        });
    });
  });

  return Array.from(bySignature.values());
}

export function buildWorldCupToto1636PurchaseRows(limit = 200): TotoPurchaseRow[] {
  const coreRows = buildCoreRows();
  const coreSignatures = new Set(coreRows.map(signatureFromOutcomes));
  let cumulativeUnits = 0;

  return buildHedgeRows(coreRows)
    .sort((left, right) => {
      const leftSignature = signatureFromOutcomes(left);
      const rightSignature = signatureFromOutcomes(right);
      const leftCore = coreSignatures.has(leftSignature) ? 1 : 0;
      const rightCore = coreSignatures.has(rightSignature) ? 1 : 0;

      return (
        rightCore - leftCore ||
        ticketProxyEvMultiple(rightSignature) - ticketProxyEvMultiple(leftSignature) ||
        probabilityForSignatureFrom(
          rightSignature,
          worldCupToto1636Matches.map(proxyVotesForMatch),
        ) -
          probabilityForSignatureFrom(
            leftSignature,
            worldCupToto1636Matches.map(proxyVotesForMatch),
          ) ||
        leftSignature.localeCompare(rightSignature)
      );
    })
    .reduce<TotoPurchaseRow[]>((rows, picks, index) => {
      if (cumulativeUnits >= limit) {
        return rows;
      }

      const signature = signatureFromOutcomes(picks);
      const isHot = index < 10;
      const unitCount = isHot ? 2 : 1;

      if (cumulativeUnits + unitCount > limit) {
        return rows;
      }

      cumulativeUnits += unitCount;

      const bucket = isHot ? "hot" : coreSignatures.has(signature) ? "core" : "hedge";

      rows.push({
        amountCumulativeYen: cumulativeUnits * TOTO13_STAKE_YEN,
        bucket,
        note:
          bucket === "hot"
            ? "Hot double cap. Buy two units at most; this raises variance and does not widen coverage."
            : bucket === "core"
              ? "Core recommendation. Buy one unit each after the hot double rows."
            : "Extra hedge row for discussion. Do not buy full 20,000 yen unless budget is approved.",
        picks,
        rank: index + 1,
        signature,
        unitCount,
      });

      return rows;
    }, []);
}

const worldCupToto1636RecommendedUnitCap = 200;
const worldCupToto1636CoreRows = buildCoreRows();

export const worldCupToto1636PurchaseRows = buildWorldCupToto1636PurchaseRows(worldCupToto1636RecommendedUnitCap);

export const worldCupToto1636NextPlan = {
  coreLineCount: worldCupToto1636CoreRows.length,
  baseCoreBudgetYen: worldCupToto1636CoreRows.length * TOTO13_STAKE_YEN,
  drawHedgeThreshold: WORLD_CUP_TOTO_DRAW_HEDGE_THRESHOLD,
  hotDoublePatternCount: 10,
  recommendedUnitCount: worldCupToto1636PurchaseRows.reduce((sum, row) => sum + row.unitCount, 0),
  discussionSheetLineCount: worldCupToto1636PurchaseRows.length,
  maxDiscussionBudgetYen: 20_000,
  purchaseDeadlineLabel: "2026-06-20 19:00 JST",
  recommendedBudgetYen: worldCupToto1636PurchaseRows.reduce((sum, row) => sum + row.unitCount, 0) * TOTO13_STAKE_YEN,
  salesAsOfLabel: "2026-06-20 17:02 JST",
  totalSalesYen: 222_065_900,
  summary:
    "Replayed recommendation now keeps every pre-match draw at 20% or higher, including Uruguay vs Cape Verde. The candidate core is 288 unique rows / 28,800 yen, so the visible sheet is capped at 200 units / 20,000 yen and ranked by proxy EV instead of buying every core row.",
};

function rowProxyScore(row: readonly OutcomeValue[], matches: readonly TotoNextPlanMatch[]) {
  const proxyRows = matches.map(proxyVotesForMatch);

  return row.reduce((score, outcome, index) => {
    const match = matches[index];
    const proxyProbability = proxyRows[index]?.[outcome] ?? 0.01;
    const publicProbability = match?.votes[outcome] ?? 0.01;
    const valueGap = Math.max(0, proxyProbability - publicProbability);
    const contextScore = match ? contextAdjustmentForOutcome(match, outcome) : 0;
    const varianceBonus = match && match.recommendedOutcomes.length >= 3 ? 0.02 : 0;

    return (
      score +
      Math.log(proxyProbability) +
      valueGap * 1.2 +
      (1 - publicProbability) * 0.04 +
      contextScore * 0.55 +
      varianceBonus
    );
  }, 0);
}

export function buildWorldCupToto1637PurchaseRows(uniqueLineLimit = 100): Toto1637PurchaseRow[] {
  const allowedRows = buildAllowedRows(worldCupToto1637Matches);
  let cumulativeUnits = 0;

  return allowedRows
    .sort((left, right) => {
      const rightScore = rowProxyScore(right, worldCupToto1637Matches);
      const leftScore = rowProxyScore(left, worldCupToto1637Matches);

      return rightScore - leftScore || signatureFromOutcomes(left).localeCompare(signatureFromOutcomes(right));
    })
    .slice(0, uniqueLineLimit)
    .map((picks, index) => {
      const unitCount = 1;
      cumulativeUnits += unitCount;

      const bucket = "direct";
      const proxyScore = rowProxyScore(picks, worldCupToto1637Matches);

      return {
        amountCumulativeYen: cumulativeUnits * TOTO13_STAKE_YEN,
        bucket,
        note: "Preliminary 1637 direct-purchase row. Buy one unit if it survives the final deadline recalculation.",
        picks,
        proxyScore,
        rank: index + 1,
        signature: signatureFromOutcomes(picks),
        unitCount,
      };
    });
}

export const worldCupToto1637PurchaseRows50 = buildWorldCupToto1637PurchaseRows(50);
export const worldCupToto1637PurchaseRows = buildWorldCupToto1637PurchaseRows(100);
export const worldCupToto1637PurchaseRows200 = buildWorldCupToto1637PurchaseRows(200);

function multiChoiceCount(choice: string) {
  return choice.split("/").length;
}

function buildToto1637MultiPlan(
  label: string,
  choices: string[],
  note: string,
): Toto1637MultiPlan {
  const counts = choices.map(multiChoiceCount);
  const unitCount = counts.reduce((product, count) => product * count, 1);
  const formula = Array.from(new Set(counts))
    .filter((count) => count > 1)
    .sort((left, right) => right - left)
    .map((count) => {
      const quantity = counts.filter((item) => item === count).length;

      return quantity > 1 ? `${count}^${quantity}` : `${count}`;
    })
    .join(" x ");

  return {
    budgetYen: unitCount * TOTO13_STAKE_YEN,
    choices,
    formula: formula || "1",
    label,
    note,
    unitCount,
  };
}

export const worldCupToto1637MultiPlans: Toto1637MultiPlan[] = [
  buildToto1637MultiPlan(
    "分散核",
    ["2", "1", "2", "2/0/1", "2", "2", "1/0/2", "2", "2", "1/0/2", "2", "2", "1"],
    "30%台に散る3試合だけ全分散する最小形。",
  ),
  buildToto1637MultiPlan(
    "5千円級",
    ["2", "1/0", "2", "2/0/1", "2", "2", "1/0/2", "2", "2", "1/0/2", "2", "2", "1"],
    "分散核に日本戦ドローを足す。",
  ),
  buildToto1637MultiPlan(
    "1万円級",
    ["2", "1/0", "2", "2/0/1", "2/0", "2", "1/0/2", "2", "2", "1/0/2", "2", "2", "1"],
    "5千円級にアルジェリア vs オーストリアのドローを足す標準案。",
  ),
  buildToto1637MultiPlan(
    "200口以内広め",
    ["2", "1/0", "2", "2/0/1", "2/0/1", "2", "1/0/2", "2", "2", "1/0/2", "2", "2", "1"],
    "M05も全分散にして、200口以内で広げる上限案。",
  ),
];

function planMatchLabel(match: Toto1637PlanMatch) {
  return `${match.home} vs ${match.away}`;
}

function strongestPositiveDelta(delta: Record<OutcomeValue, number>) {
  return (["1", "0", "2"] as const)
    .map((outcome) => ({ outcome, value: delta[outcome] }))
    .sort((left, right) => right.value - left.value)[0].outcome;
}

const worldCupToto1637ExternalMarketRawRows = [
  {
    actionLabel: "市場はドイツ一択ではない。最終市場でも同じなら1/0を足す最優先枠。",
    delta: { "1": 0.1881, "0": 0.0957, "2": -0.2838 },
    marketProb: { "1": 0.2537, "0": 0.2239, "2": 0.5224 },
    matchNo: 1,
    sourceSlug: "fwc-ecu-ger-2026-06-25",
    sourceUpdatedAt: "2026-06-24T03:31:48Z",
    volumeUsd: 650_115,
  },
  {
    actionLabel: "日本人気が重い。108口では1/0を残し、162口以上なら2追加の優先候補。",
    delta: { "1": -0.1355, "0": 0.0269, "2": 0.1086 },
    marketProb: { "1": 0.5176, "0": 0.2663, "2": 0.2161 },
    matchNo: 2,
    sourceSlug: "fwc-jpn-swe-2026-06-25",
    sourceUpdatedAt: "2026-06-24T03:31:48Z",
    volumeUsd: 215_116,
  },
  {
    actionLabel: "スペイン本線。ただし市場ドロー22%超なので、1636反省版では0を入れる。",
    delta: { "1": 0.0436, "0": 0.0403, "2": -0.084 },
    marketProb: { "1": 0.1256, "0": 0.2261, "2": 0.6482 },
    matchNo: 3,
    sourceSlug: "fwc-uru-esp-2026-06-26",
    sourceUpdatedAt: "2026-06-24T03:31:50Z",
    volumeUsd: 121_978,
  },
  {
    actionLabel: "市場はPortugal寄り。公式より0/1は薄いので市場補強版では2へ寄せる。",
    delta: { "1": -0.0151, "0": -0.0631, "2": 0.0782 },
    marketProb: { "1": 0.2438, "0": 0.2438, "2": 0.5124 },
    matchNo: 4,
    sourceSlug: "fwc-col-por-2026-06-27",
    sourceUpdatedAt: "2026-06-24T03:31:39Z",
    volumeUsd: 110_639,
  },
  {
    actionLabel: "市場はドロー本命。Austria固定ではなく1/0/2へ広げる。",
    delta: { "1": 0.0307, "0": 0.1369, "2": -0.1677 },
    marketProb: { "1": 0.2338, "0": 0.4328, "2": 0.3333 },
    matchNo: 5,
    sourceSlug: "fwc-alg-aut-2026-06-27",
    sourceUpdatedAt: "2026-06-24T03:31:39Z",
    volumeUsd: 124_066,
  },
  {
    actionLabel: "Netherlands本線。ドロー差分はあるが、200口以内ではまだロック寄り。",
    delta: { "1": -0.0064, "0": 0.0415, "2": -0.0352 },
    marketProb: { "1": 0.0348, "0": 0.0945, "2": 0.8706 },
    matchNo: 6,
    sourceSlug: "fwc-tun-ned-2026-06-25",
    sourceUpdatedAt: "2026-06-24T03:31:50Z",
    volumeUsd: 271_721,
  },
  {
    actionLabel: "市場はドロー本命。ここは現行どおり全分散を維持。",
    delta: { "1": -0.029, "0": 0.1196, "2": -0.0906 },
    marketProb: { "1": 0.3266, "0": 0.4372, "2": 0.2362 },
    matchNo: 7,
    sourceSlug: "fwc-par-aus-2026-06-25",
    sourceUpdatedAt: "2026-06-24T03:31:49Z",
    volumeUsd: 203_274,
  },
  {
    actionLabel: "France人気は公式ほど強くない。予算が増えたら0/1を足す候補。",
    delta: { "1": 0.0983, "0": 0.0234, "2": -0.1217 },
    marketProb: { "1": 0.2118, "0": 0.2118, "2": 0.5764 },
    matchNo: 8,
    sourceSlug: "fwc-nor-fra-2026-06-26",
    sourceUpdatedAt: "2026-06-24T03:31:49Z",
    volumeUsd: 163_458,
  },
  {
    actionLabel: "Englandはまだ本線。ただし公式90.1%ほど硬くはないので締切ニュースで0を検討。",
    delta: { "1": 0.0139, "0": 0.0564, "2": -0.0704 },
    marketProb: { "1": 0.0547, "0": 0.1144, "2": 0.8308 },
    matchNo: 9,
    sourceSlug: "fwc-pan-eng-2026-06-27",
    sourceUpdatedAt: "2026-06-24T03:31:40Z",
    volumeUsd: 154_307,
  },
  {
    actionLabel: "市場はCongo DR寄りを補強。公式ドローは高いが、市場補強108では1単独にする。",
    delta: { "1": 0.0946, "0": -0.0928, "2": -0.0018 },
    marketProb: { "1": 0.5276, "0": 0.2362, "2": 0.2362 },
    matchNo: 10,
    sourceSlug: "fwc-cod-uzb-2026-06-27",
    sourceUpdatedAt: "2026-06-24T03:31:39Z",
    volumeUsd: 93_029,
  },
  {
    actionLabel: "Argentinaは本線継続。公式ほど硬くはないが200口以内では2優先。",
    delta: { "1": 0.0155, "0": 0.0736, "2": -0.089 },
    marketProb: { "1": 0.0542, "0": 0.1232, "2": 0.8227 },
    matchNo: 11,
    sourceSlug: "fwc-jor-arg-2026-06-27",
    sourceUpdatedAt: "2026-06-24T03:31:40Z",
    volumeUsd: 123_418,
  },
  {
    actionLabel: "Belgiumは本線継続。ドローは上振れ候補だが優先度はM01/M05/M13未満。",
    delta: { "1": 0.0064, "0": 0.0011, "2": -0.0076 },
    marketProb: { "1": 0.0653, "0": 0.1256, "2": 0.809 },
    matchNo: 12,
    sourceSlug: "fwc-nzl-bel-2026-06-26",
    sourceUpdatedAt: "2026-06-24T03:34:22Z",
    volumeUsd: 66_404,
  },
  {
    actionLabel: "Croatia人気が重い。市場反映版では最低でも0を足す。",
    delta: { "1": -0.1761, "0": 0.1011, "2": 0.075 },
    marketProb: { "1": 0.5522, "0": 0.2836, "2": 0.1642 },
    matchNo: 13,
    sourceSlug: "fwc-cro-gha-2026-06-27",
    sourceUpdatedAt: "2026-06-24T03:31:39Z",
    volumeUsd: 54_078,
  },
] satisfies Array<
  Omit<
    Toto1637ExternalMarketRow,
    | "marketFavoriteOutcome"
    | "matchLabel"
    | "officialFavoriteOutcome"
    | "officialProb"
    | "source"
    | "strongestPositiveDeltaOutcome"
  >
>;

export type WorldCupMarketSignal = {
  marketProb0: number;
  marketProb1: number;
  marketProb2: number;
  officialVote0: number;
  officialVote1: number;
  officialVote2: number;
};

/**
 * featured ラウンドの matchNo → 公衆(公式票) + 市場(Polymarket)確率。
 * これを featured ラウンド構築（featured-world-toto-d1）に流すと、モデルの土台が
 * 市場ベースになり Edge=市場−公衆になる（ドイツ戦の教訓: 公衆はドイツ80.6%だが
 * Polymarket は52.2%。市場をモデルに通電すれば本命過信が自動で解ける）。
 * 現状データがあるのは第1637回のみ。他の回は空 Map ＝従来の国別強度シードのまま。
 */
export function worldCupMarketSignalByMatchNo(
  roundNumber: number,
): Map<number, WorldCupMarketSignal> {
  const map = new Map<number, WorldCupMarketSignal>();
  if (roundNumber !== 1637) {
    return map;
  }
  for (const row of worldCupToto1637ExternalMarketRawRows) {
    const plan = worldCupToto1637Matches.find((match) => match.matchNo === row.matchNo);
    if (!plan) {
      continue;
    }
    map.set(row.matchNo, {
      marketProb1: row.marketProb["1"],
      marketProb0: row.marketProb["0"],
      marketProb2: row.marketProb["2"],
      officialVote1: plan.votes["1"],
      officialVote0: plan.votes["0"],
      officialVote2: plan.votes["2"],
    });
  }
  return map;
}

export const worldCupToto1637ExternalMarketOverlay: Toto1637ExternalMarketOverlay = {
  comparisonRows: worldCupToto1637ExternalMarketRawRows.map((row) => {
    const match = worldCupToto1637Matches.find((item) => item.matchNo === row.matchNo);
    const officialProb = match?.votes ?? { "1": 0, "0": 0, "2": 0 };

    return {
      ...row,
      marketFavoriteOutcome: favoriteFromVotes(row.marketProb),
      matchLabel: match ? planMatchLabel(match) : `M${String(row.matchNo).padStart(2, "0")}`,
      officialFavoriteOutcome: favoriteFromVotes(officialProb),
      officialProb,
      source: "Polymarket",
      strongestPositiveDeltaOutcome: strongestPositiveDelta(row.delta),
    };
  }),
  dataStatusLabel: "Polymarket public Sports API 13/13 refreshed on 2026-06-24; Hazi comment not included",
  decisionRules: [
    "p_market - p_public が +8pt 以上なら、公式で薄い出目でも昇格候補にする。",
    "公式人気の本命が p_market で -12pt 以上なら、単独ロックを解除する。",
    "p_market のドローが20%以上なら、締切版で0を残す候補に戻す。",
    "1636反省として、公式70%超の本命でも p_market ドローが20%前後なら144口以上の反省版で0を足す。",
    "200口以内では M01/M05/M07/M13 と日本戦M02の過熱を優先し、M03/M08/M09/M11は締切ニュースが強い時だけ足す。",
  ],
  fetchedAtLabel: "2026-06-24 12:34 JST",
  finalSelectionSummary:
    "このまま締切直前も同じ市場差なら、現行の公式+W杯文脈プランからM01/M02/M05/M07/M13へ分散を移す。暫定確定は市場補強108口、1636反省を強めるなら144口。",
  marketAdjustedPlans: [
    buildToto1637MultiPlan(
      "市場補強27口",
      ["2/0/1", "1", "2", "2", "2/0/1", "2", "1/0/2", "2", "2", "1", "2", "2", "1"],
      "M01/M05/M07だけ市場差分を強く反映した最小形。",
    ),
    buildToto1637MultiPlan(
      "市場補強54口",
      ["2/0/1", "1", "2", "2", "2/0/1", "2", "1/0/2", "2", "2", "1", "2", "2", "1/0"],
      "54口級ではM13のドローを追加。Croatia人気の重さを直接ケアする。",
    ),
    buildToto1637MultiPlan(
      "市場補強108口",
      ["2/0/1", "1/0", "2", "2", "2/0/1", "2", "1/0/2", "2", "2", "1", "2", "2", "1/0"],
      "暫定確定案。M01/M05/M07/M13に加えて、日本人気が重いM02を1/0で受ける。",
    ),
    buildToto1637MultiPlan(
      "1636反省144口",
      ["2/0/1", "1/0", "2/0", "2", "2/0/1", "2", "1/0", "2", "2", "1", "2", "2", "1/0"],
      "強人気ドローの取り逃し対策。108口からM03の0を足し、M07は市場で薄い2を外して144口に収める。",
    ),
    buildToto1637MultiPlan(
      "市場補強162口",
      ["2/0/1", "1/0/2", "2", "2", "2/0/1", "2", "1/0/2", "2", "2", "1", "2", "2", "1/0"],
      "広め案。108口案からM02を全分散へ広げ、Sweden上振れを200口以内で拾う。",
    ),
  ],
  sourceDocs: [
    { label: "Polymarket Sports API", url: worldCupTotoPolymarketSportsDocsUrl },
    { label: "Polymarket Markets API", url: worldCupTotoPolymarketMarketsDocsUrl },
    { label: "Polymarket BBO API", url: worldCupTotoPolymarketBboDocsUrl },
    { label: "Odds API bookmaker docs", url: worldCupTotoOddsApiDocsUrl },
  ],
  sourceUrl: worldCupTotoPolymarketSportsEventsUrl,
  summary:
    "6/24 12:17公式投票率と12:34 Polymarket価格の差を見ると、M01/M05/M07/M13は公式人気より荒れ側を厚くする根拠が続いている。M02も日本人気が重いため、108口案では1/0で受ける。一方、M04/M10は外部市場の優先度を下げて予算を移す。",
};

export const worldCupToto1637FinalLogic: Toto1637FinalLogic = {
  backtestSignals: [
    "1634は公式人気順が9試合ズレ。公式だけで1点に寄せると荒れを拾えなかった。",
    "1635は公式人気順が2試合ズレで3等相当。第2戦寄りは順当が増えるが、強人気ドローは残す価値があった。",
    "1636は64口側が3等圏。外した2試合はいずれも80%台強人気のドローだったため、外部市場ドロー20%前後は軽視しない。",
    "1637は第3戦寄りなので、公式人気順よりも外部市場差分とグループ条件を優先してロックを解除する。",
  ],
  deadlineAction:
    "2026-06-25 18:25に公式投票率、売上、Polymarket 1X2を再取得する。差分が同じなら基本は市場補強108口、M03ドローが20%超で残るなら1636反省144口、残高が薄ければ54口へ落とす。18:55以降は操作しない。",
  label: "1637暫定確定ロジック",
  lockRules: [
    {
      checkLabel: "M01 Ecuador vs Germany",
      currentRead: "公式はGermany 80.6%、市場はGermany 52.2%。強人気を単独固定しない。",
      decision: "keep108",
      downgradeCondition: "市場Germanyが65%以上へ戻り、公式Germanyも80%台のままなら54口へ縮小。",
      keep108Condition: "市場Germanyが55%以下、またはEcuador/Draw合算が45%以上なら108口維持。",
      upgradeCondition: "市場Germanyが50%未満、またはDrawが25%以上なら108/144/162の全案で1/0/2を維持。",
    },
    {
      checkLabel: "M02 Japan vs Sweden",
      currentRead: "公式はJapan 65.3%、市場はJapan 51.8%。日本人気を買いすぎない。",
      decision: "keep108",
      downgradeCondition: "市場Japanが60%以上、Swedenが18%未満なら1単独または54口へ縮小。",
      keep108Condition: "市場Japanが55%以下、Drawが25%以上なら1/0を維持。",
      upgradeCondition: "市場Swedenが24%以上、またはSweden差分が+14pt超なら162口で2追加を検討。",
    },
    {
      checkLabel: "M03 Uruguay vs Spain",
      currentRead: "公式はSpain 73.2%、市場はSpain 64.8%、Draw 22.6%。1636反省では0を足す候補。",
      decision: "expand144",
      downgradeCondition: "市場Drawが18%未満へ落ち、Spainが70%以上なら108口へ戻す。",
      keep108Condition: "残高優先なら108口でSpain単独のまま。M03は購入前に最終確認。",
      upgradeCondition: "市場Drawが20%以上のままなら、M07のAustraliaを外した1636反省144口で0を入れる。",
    },
    {
      checkLabel: "M05 Algeria vs Austria",
      currentRead: "公式はAustria 50.1%、市場はDraw 43.3%、Austria 33.3%。公式ほど片寄っていない。",
      decision: "keep108",
      downgradeCondition: "市場Austriaが50%以上へ戻り、Drawの上振れが消えたら54口へ縮小。",
      keep108Condition: "市場Drawが35%以上、またはAustriaが45%以下なら1/0/2を維持。",
      upgradeCondition: "市場Drawが40%以上なら144/162口でも厚め維持。",
    },
    {
      checkLabel: "M07 Paraguay vs Australia",
      currentRead: "公式は三分割、PolymarketはDraw 43.7%。108口では全分散、144口ではAustraliaを外してM03ドローへ回す。",
      decision: "keep108",
      downgradeCondition: "市場Drawが32%未満へ落ち、どちらか片側が45%以上なら54口へ縮小候補。",
      keep108Condition: "市場Drawが35%以上、または3出目が30%前後で割れ続けるなら全分散維持。",
      upgradeCondition: "144口へ上げる場合は、M07の市場下振れ側Australiaを削ってM03ドローに予算を移す。",
    },
    {
      checkLabel: "M13 Croatia vs Ghana",
      currentRead: "公式はCroatia 72.8%、市場はCroatia 55.2%、Draw 28.4%。0を外さない。",
      decision: "keep108",
      downgradeCondition: "市場Croatiaが68%以上へ戻り、Drawが18%未満なら54口へ縮小。",
      keep108Condition: "市場Croatiaが65%以下、またはDrawが20%以上なら1/0維持。",
      upgradeCondition: "Draw+Ghanaが40%以上なら162口で1/0/2へ拡張。",
    },
  ],
  selectedPlanLabel: "市場補強108口",
  summary:
    "公式投票率は日本の購入人気、Polymarketは実勝率寄りの市場価格、W杯文脈は第3戦の条件補正として分ける。6/24昼の公式投票率と外部市場では基本候補は市場補強108口=10,800円。1636反省を強める場合だけ144口=14,400円へ上げる。",
};

export const worldCupToto1637NextPlan = {
  coreLineCount: buildAllowedRows(worldCupToto1637Matches).length,
  hardStopLabel: "2026-06-25 18:55 JST",
  directPurchasePlanUnitCounts: [50, 100, 200],
  hotDoublePatternCount: 0,
  multiPurchasePlanUnitCounts: worldCupToto1637MultiPlans.map((plan) => plan.unitCount),
  maxRecommendedBudgetYen:
    worldCupToto1637PurchaseRows200.reduce((sum, row) => sum + row.unitCount, 0) * TOTO13_STAKE_YEN,
  maxRecommendedUnitCount: worldCupToto1637PurchaseRows200.reduce((sum, row) => sum + row.unitCount, 0),
  maxRecommendedUniqueLineCount: worldCupToto1637PurchaseRows200.length,
  preliminaryUniqueLineCount: worldCupToto1637PurchaseRows.length,
  purchaseDeadlineLabel: "2026-06-25 19:00 JST",
  purchaseFreezeLabel: "2026-06-25 18:25 JST",
  recommendedBudgetYen: worldCupToto1637PurchaseRows.reduce((sum, row) => sum + row.unitCount, 0) * TOTO13_STAKE_YEN,
  recommendedPurchaseWindowLabel: "2026-06-25 18:35-18:50 JST",
  recommendedUnitCount: worldCupToto1637PurchaseRows.reduce((sum, row) => sum + row.unitCount, 0),
  salesAsOfLabel: "2026-06-24 12:17 JST",
  salesSourceUrl: worldCupTotoOfficialSales1637Url,
  sourceUrl: worldCupTotoOfficialVote1637Url,
  summary:
    "1637 is treated as matchday3: do not buy early. The main handoff is a multi-pick table. At the final window, refresh official votes and Polymarket prices, then choose the market-adjusted 108-unit plan unless the final gap collapses.",
  totalSalesYen: 92_607_700,
  voteAsOfLabel: "2026-06-24 12:17 JST",
  voteUnits: 926_077,
  workflow: [
    {
      action: "公式投票率と売上を取り直し、締切直前版のPDF/マルチ表を再生成する。",
      owner: "system",
      timeLabel: "2026-06-25 18:25",
    },
    {
      action: "Polymarket公開価格をread-onlyで取り、公式投票率との差分をM01-M13で確認する。",
      owner: "system",
      timeLabel: "2026-06-25 18:27",
    },
    {
      action: "強人気ロック、条件戦ドロー、30%台分散、市場差分+8pt以上の出目を目視で確認する。",
      owner: "human",
      timeLabel: "2026-06-25 18:30",
    },
    {
      action: "予算に合わせて通常プランか市場補強108/162口を選び、M01-M13のマルチ指定を公式画面へ入力する。",
      owner: "human",
      timeLabel: "2026-06-25 18:35-18:50",
    },
    {
      action: "19:00締切に食い込まないよう購入確定を止める。ログイン、購入、決済の完全自動化は対象外。",
      owner: "human",
      timeLabel: "2026-06-25 18:55",
    },
  ],
};
