import type { OutcomeValue } from "@/lib/domain";

export const worldCupTotoLatestReportFileName =
  "world-cup-toto-latest.pdf";
export const worldCupTotoNextPurchaseSheetFileName =
  "world-cup-toto-latest-purchase-sheet.csv";

export const worldCupTotoVersionedReportFileName =
  "world-cup-toto-1634-1637-evolved-plan-20260621-v6.pdf";
export const worldCupTotoVersionedPurchaseSheetFileName =
  "world-cup-toto-1637-preliminary-10000-plan-20260621-v6.csv";
export const worldCupTotoLegacyReportFileName =
  "world-cup-toto-1634-1636-evolved-plan.pdf";
export const worldCupTotoLegacyPurchaseSheetFileName =
  "world-cup-toto-1636-hot10-20000-plan.csv";

export const worldCupTotoReportVersion = {
  csvSha256: "28909a5339c77c53617dd0995e7159d84eda08ae2638f8a762809748bd12281f",
  label: "2026-06-21 v6",
  latestCsvFileName: worldCupTotoNextPurchaseSheetFileName,
  latestPdfFileName: worldCupTotoLatestReportFileName,
  legacyCsvFileName: worldCupTotoLegacyPurchaseSheetFileName,
  legacyPdfFileName: worldCupTotoLegacyReportFileName,
  pdfSha256: "5128eea53264ac6749f5c947a688430d1b688e3a01361e67538aa74974f7d83d",
  publishedAtLabel: "2026-06-21 01:45 JST",
  versionedCsvFileName: worldCupTotoVersionedPurchaseSheetFileName,
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
export const worldCupTotoOfficialVote1637Url =
  "https://sp.toto-dream.com/dcs/subos/screen/si01/ssin025/PGSSIN02501ForwardVotetotoSP.form?commodityId=01&fromId=SSIN026&gameAssortment=A&holdCntId=1637";
export const worldCupTotoOfficialSales1637Url =
  "https://sp.toto-dream.com/dcs/subos/screen/si01/ssin025/PGSSIN02501ForwardSalesTermtotoSP.form?holdCntId=1637";

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
  bucket: "core" | "hot";
  note: string;
  picks: OutcomeValue[];
  proxyScore: number;
  rank: number;
  signature: string;
  unitCount: number;
};

export type Toto1637PlanMatch = TotoNextPlanMatch & {
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
const WORLD_CUP_TOTO_1636_TOTAL_SALES_YEN = 222_065_900;
const TOTO_RETURN_RATE = 0.5;
const TOTO_PRIZE_TIERS = [
  { carryoverEligible: true, missCount: 0, poolShare: 0.7 },
  { carryoverEligible: false, missCount: 1, poolShare: 0.15 },
  { carryoverEligible: false, missCount: 2, poolShare: 0.15 },
] as const;

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
  { matchNo: 1, kickoffLabel: "06/21 05:00", home: "Germany", away: "Cote d'Ivoire", votes: { "1": 0.7125, "0": 0.2123, "2": 0.0752 }, recommendedOutcomes: ["1"], ruleLabel: "lock favorite over 70%", note: "Use budget elsewhere instead of hedging this favorite." },
  { matchNo: 2, kickoffLabel: "06/21 13:00", home: "Tunisia", away: "Japan", votes: { "1": 0.0798, "0": 0.2292, "2": 0.691 }, recommendedOutcomes: ["2", "0"], ruleLabel: "Japan win plus draw", note: "Japan is the main line, but the draw is cheap enough to keep." },
  { matchNo: 3, kickoffLabel: "06/23 02:00", home: "Argentina", away: "Austria", votes: { "1": 0.7591, "0": 0.184, "2": 0.0569 }, recommendedOutcomes: ["1"], ruleLabel: "lock favorite over 70%", note: "Keep as a lock in the core sheet." },
  { matchNo: 4, kickoffLabel: "06/24 08:00", home: "Panama", away: "Croatia", votes: { "1": 0.0428, "0": 0.1325, "2": 0.8247 }, recommendedOutcomes: ["2"], ruleLabel: "lock away favorite over 80%", note: "Croatia win is too expensive to fade in the core sheet." },
  { matchNo: 5, kickoffLabel: "06/24 11:00", home: "Colombia", away: "Congo DR", votes: { "1": 0.706, "0": 0.2264, "2": 0.0676 }, recommendedOutcomes: ["1"], ruleLabel: "lock favorite over 70%", note: "Colombia win is the core route." },
  { matchNo: 6, kickoffLabel: "06/21 02:00", home: "Netherlands", away: "Sweden", votes: { "1": 0.4985, "0": 0.3152, "2": 0.1863 }, recommendedOutcomes: ["1", "0", "2"], ruleLabel: "spread split match", note: "This is the main variance slot." },
  { matchNo: 7, kickoffLabel: "06/22 07:00", home: "Uruguay", away: "Cape Verde", votes: { "1": 0.7138, "0": 0.2236, "2": 0.0626 }, recommendedOutcomes: ["1"], ruleLabel: "lock favorite over 70%", note: "Use as a lock." },
  { matchNo: 8, kickoffLabel: "06/23 09:00", home: "Norway", away: "Senegal", votes: { "1": 0.4495, "0": 0.2928, "2": 0.2577 }, recommendedOutcomes: ["1", "0", "2"], ruleLabel: "spread 30% band", note: "Wide enough to keep all three outcomes in the core sheet." },
  { matchNo: 9, kickoffLabel: "06/24 02:00", home: "Portugal", away: "Uzbekistan", votes: { "1": 0.8075, "0": 0.1492, "2": 0.0433 }, recommendedOutcomes: ["1"], ruleLabel: "lock favorite over 80%", note: "Use as a lock." },
  { matchNo: 10, kickoffLabel: "06/23 12:00", home: "Jordan", away: "Algeria", votes: { "1": 0.1496, "0": 0.3319, "2": 0.5185 }, recommendedOutcomes: ["2", "0"], ruleLabel: "away win plus draw", note: "Algeria is the main line; draw has enough public share to cover." },
  { matchNo: 11, kickoffLabel: "06/22 01:00", home: "Spain", away: "Saudi Arabia", votes: { "1": 0.8381, "0": 0.1246, "2": 0.0373 }, recommendedOutcomes: ["1"], ruleLabel: "lock favorite over 80%", note: "Use as a lock." },
  { matchNo: 12, kickoffLabel: "06/24 05:00", home: "England", away: "Ghana", votes: { "1": 0.8433, "0": 0.1169, "2": 0.0398 }, recommendedOutcomes: ["1"], ruleLabel: "lock favorite over 80%", note: "Use as a lock." },
  { matchNo: 13, kickoffLabel: "06/21 09:00", home: "Ecuador", away: "Curacao", votes: { "1": 0.85, "0": 0.1122, "2": 0.0378 }, recommendedOutcomes: ["1"], ruleLabel: "lock favorite over 80%", note: "Use as a lock." },
];

export const worldCupToto1637Matches: Toto1637PlanMatch[] = [
  { matchNo: 1, kickoffLabel: "06/26 05:00", home: "Ecuador", away: "Germany", votes: { "1": 0.0348, "0": 0.1052, "2": 0.86 }, recommendedOutcomes: ["2"], ruleLabel: "lock favorite over 85%", note: "Germany is too popular to fade in the preliminary sheet; final group condition can reopen draw.", riskBucket: "lock" },
  { matchNo: 2, kickoffLabel: "06/26 08:00", home: "Japan", away: "Sweden", votes: { "1": 0.5506, "0": 0.2931, "2": 0.1563 }, recommendedOutcomes: ["1", "0"], ruleLabel: "Japan win plus draw", note: "Keep Japan as main line, but preserve draw because matchday3 incentives can compress risk.", riskBucket: "flex" },
  { matchNo: 3, kickoffLabel: "06/27 09:00", home: "Uruguay", away: "Spain", votes: { "1": 0.076, "0": 0.1906, "2": 0.7334 }, recommendedOutcomes: ["2", "0"], ruleLabel: "semi lock plus draw", note: "Spain is the main line; matchday3 draw condition stays in the sheet until final standings check.", riskBucket: "semi" },
  { matchNo: 4, kickoffLabel: "06/28 08:30", home: "Colombia", away: "Portugal", votes: { "1": 0.2717, "0": 0.3002, "2": 0.4281 }, recommendedOutcomes: ["2", "0", "1"], ruleLabel: "full spread", note: "Portugal leads public share, but the match is not a lock. Keep all three outcomes.", riskBucket: "spread" },
  { matchNo: 5, kickoffLabel: "06/28 11:00", home: "Algeria", away: "Austria", votes: { "1": 0.1733, "0": 0.2854, "2": 0.5413 }, recommendedOutcomes: ["2", "0"], ruleLabel: "away win plus draw", note: "Austria is the main line; draw is material enough to keep.", riskBucket: "flex" },
  { matchNo: 6, kickoffLabel: "06/26 08:00", home: "Tunisia", away: "Netherlands", votes: { "1": 0.0216, "0": 0.0562, "2": 0.9222 }, recommendedOutcomes: ["2"], ruleLabel: "lock favorite over 90%", note: "Netherlands is a hard lock unless lineup/news changes sharply.", riskBucket: "lock" },
  { matchNo: 7, kickoffLabel: "06/26 11:00", home: "Paraguay", away: "Australia", votes: { "1": 0.3611, "0": 0.3153, "2": 0.3236 }, recommendedOutcomes: ["1", "0", "2"], ruleLabel: "three-way split", note: "The public is almost flat. This is one of the main coverage slots.", riskBucket: "spread" },
  { matchNo: 8, kickoffLabel: "06/27 04:00", home: "Norway", away: "France", votes: { "1": 0.0862, "0": 0.1754, "2": 0.7384 }, recommendedOutcomes: ["2", "0"], ruleLabel: "semi lock plus draw", note: "France is the main line; keep draw as the cheap matchday3 hedge.", riskBucket: "semi" },
  { matchNo: 9, kickoffLabel: "06/28 06:00", home: "Panama", away: "England", votes: { "1": 0.0149, "0": 0.032, "2": 0.9531 }, recommendedOutcomes: ["2"], ruleLabel: "lock favorite over 95%", note: "England is a hard lock in the preliminary sheet.", riskBucket: "lock" },
  { matchNo: 10, kickoffLabel: "06/28 08:30", home: "Congo DR", away: "Uzbekistan", votes: { "1": 0.3831, "0": 0.3531, "2": 0.2638 }, recommendedOutcomes: ["1", "0", "2"], ruleLabel: "three-way split", note: "Top two outcomes are only 3.0pt apart. Keep all three.", riskBucket: "spread" },
  { matchNo: 11, kickoffLabel: "06/28 11:00", home: "Jordan", away: "Argentina", votes: { "1": 0.0129, "0": 0.0275, "2": 0.9596 }, recommendedOutcomes: ["2"], ruleLabel: "lock favorite over 95%", note: "Argentina is a hard lock unless group condition means heavy rotation.", riskBucket: "lock" },
  { matchNo: 12, kickoffLabel: "06/27 12:00", home: "New Zealand", away: "Belgium", votes: { "1": 0.0277, "0": 0.0614, "2": 0.9109 }, recommendedOutcomes: ["2"], ruleLabel: "lock favorite over 90%", note: "Belgium is a hard lock in the preliminary sheet.", riskBucket: "lock" },
  { matchNo: 13, kickoffLabel: "06/28 06:00", home: "Croatia", away: "Ghana", votes: { "1": 0.7905, "0": 0.1419, "2": 0.0676 }, recommendedOutcomes: ["1", "0"], ruleLabel: "semi lock plus draw", note: "Croatia is the main line; keep draw because matchday3 can turn into a condition game.", riskBucket: "semi" },
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
    action: "今回の1636はここを主軸に置く。強人気固定を崩しすぎず、割れ試合だけ分散する。",
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
    "Haziの読みを採用して、1636は大荒れ前提へ寄せすぎない。強人気は固定し、オランダ戦・ノルウェー戦のように割れる面だけ分散する。",
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

function proxyVotesForMatch(match: TotoNextPlanMatch) {
  const values = (["1", "0", "2"] as const).map((outcome) => {
    const boost = match.recommendedOutcomes.includes(outcome)
      ? match.recommendedOutcomes.length === 1
        ? 1.08
        : 1.04
      : 0.84;
    const base = match.votes[outcome] * boost;

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

export const worldCupToto1636PurchaseRows = buildWorldCupToto1636PurchaseRows();

export const worldCupToto1636NextPlan = {
  coreLineCount: buildCoreRows().length,
  baseCoreBudgetYen: buildCoreRows().length * TOTO13_STAKE_YEN,
  hotDoublePatternCount: 10,
  recommendedUnitCount: buildCoreRows().length + 10,
  discussionSheetLineCount: worldCupToto1636PurchaseRows.length,
  maxDiscussionBudgetYen: 20_000,
  purchaseDeadlineLabel: "2026-06-20 19:00 JST",
  recommendedBudgetYen: (buildCoreRows().length + 10) * TOTO13_STAKE_YEN,
  salesAsOfLabel: "2026-06-20 17:02 JST",
  totalSalesYen: 222_065_900,
  summary:
    "Recommended evolved core is 46 units / 4,600 yen: 36 unique core rows, with the top 10 hot rows bought twice. The 20,000 yen CSV is a discussion cap, not an all-in recommendation, because positive EV is not proven.",
};

function rowProxyScore(row: readonly OutcomeValue[], matches: readonly TotoNextPlanMatch[]) {
  const proxyRows = matches.map(proxyVotesForMatch);

  return row.reduce((score, outcome, index) => {
    const match = matches[index];
    const proxyProbability = proxyRows[index]?.[outcome] ?? 0.01;
    const publicProbability = match?.votes[outcome] ?? 0.01;
    const valueGap = Math.max(0, proxyProbability - publicProbability);
    const varianceBonus = match && match.recommendedOutcomes.length >= 3 ? 0.02 : 0;

    return score + Math.log(proxyProbability) + valueGap * 1.2 + (1 - publicProbability) * 0.04 + varianceBonus;
  }, 0);
}

export function buildWorldCupToto1637PurchaseRows(uniqueLineLimit = 90): Toto1637PurchaseRow[] {
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
      const unitCount = index < 10 ? 2 : 1;
      cumulativeUnits += unitCount;

      const bucket = index < 10 ? "hot" : "core";
      const proxyScore = rowProxyScore(picks, worldCupToto1637Matches);

      return {
        amountCumulativeYen: cumulativeUnits * TOTO13_STAKE_YEN,
        bucket,
        note:
          bucket === "hot"
            ? "Preliminary hot row. Buy two units at most after final deadline recalculation."
            : "Preliminary 1637 row. Buy one unit if it survives the final deadline recalculation.",
        picks,
        proxyScore,
        rank: index + 1,
        signature: signatureFromOutcomes(picks),
        unitCount,
      };
    });
}

export const worldCupToto1637PurchaseRows = buildWorldCupToto1637PurchaseRows();

export const worldCupToto1637NextPlan = {
  coreLineCount: buildAllowedRows(worldCupToto1637Matches).length,
  hardStopLabel: "2026-06-25 18:55 JST",
  hotDoublePatternCount: 10,
  preliminaryUniqueLineCount: worldCupToto1637PurchaseRows.length,
  purchaseDeadlineLabel: "2026-06-25 19:00 JST",
  purchaseFreezeLabel: "2026-06-25 18:25 JST",
  recommendedBudgetYen: worldCupToto1637PurchaseRows.reduce((sum, row) => sum + row.unitCount, 0) * TOTO13_STAKE_YEN,
  recommendedPurchaseWindowLabel: "2026-06-25 18:35-18:50 JST",
  recommendedUnitCount: worldCupToto1637PurchaseRows.reduce((sum, row) => sum + row.unitCount, 0),
  salesAsOfLabel: "2026-06-21 01:08 JST",
  salesSourceUrl: worldCupTotoOfficialSales1637Url,
  sourceUrl: worldCupTotoOfficialVote1637Url,
  summary:
    "1637 is treated as matchday3: do not buy early. Freeze the latest vote/sales snapshot around 18:25, regenerate the sheet, then buy 90 unique lines with the top 10 doubled only if the final sheet still looks sane.",
  totalSalesYen: 7_839_700,
  voteAsOfLabel: "2026-06-21 00:12 JST",
  voteUnits: 74_072,
  workflow: [
    {
      action: "公式投票率と売上を取り直し、締切直前版のCSV/PDFを再生成する。",
      owner: "system",
      timeLabel: "2026-06-25 18:25",
    },
    {
      action: "強人気ロック、条件戦ドロー、30%台分散を目視で確認する。",
      owner: "human",
      timeLabel: "2026-06-25 18:30",
    },
    {
      action: "CSV上位から90ユニークを1口ずつ、Hot10だけ2口まで公式画面へ転記する。",
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
