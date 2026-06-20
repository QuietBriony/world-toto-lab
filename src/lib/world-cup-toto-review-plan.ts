import type { OutcomeValue } from "@/lib/domain";

export const worldCupTotoLatestReportFileName =
  "world-cup-toto-1634-1636-evolved-plan.pdf";
export const worldCupTotoNextPurchaseSheetFileName =
  "world-cup-toto-1636-hot10-20000-plan.csv";

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

type PrizeResult = {
  label: "1st" | "2nd" | "3rd" | "miss";
  payoutYen: number;
};

export const TOTO13_OUTCOME_COUNT = 3 ** 13;
export const TOTO13_STAKE_YEN = 100;

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
  { matchNo: 1, kickoffLabel: "06/21 05:00", home: "Germany", away: "Cote d'Ivoire", votes: { "1": 0.7224, "0": 0.2051, "2": 0.0725 }, recommendedOutcomes: ["1"], ruleLabel: "lock favorite over 70%", note: "Use budget elsewhere instead of hedging this favorite." },
  { matchNo: 2, kickoffLabel: "06/21 13:00", home: "Tunisia", away: "Japan", votes: { "1": 0.0783, "0": 0.226, "2": 0.6957 }, recommendedOutcomes: ["2", "0"], ruleLabel: "Japan win plus draw", note: "Japan is the main line, but the draw is cheap enough to keep." },
  { matchNo: 3, kickoffLabel: "06/23 02:00", home: "Argentina", away: "Austria", votes: { "1": 0.766, "0": 0.1774, "2": 0.0566 }, recommendedOutcomes: ["1"], ruleLabel: "lock favorite over 70%", note: "Keep as a lock in the core sheet." },
  { matchNo: 4, kickoffLabel: "06/24 08:00", home: "Panama", away: "Croatia", votes: { "1": 0.0441, "0": 0.1333, "2": 0.8226 }, recommendedOutcomes: ["2"], ruleLabel: "lock away favorite over 80%", note: "Croatia win is too expensive to fade in the core sheet." },
  { matchNo: 5, kickoffLabel: "06/24 11:00", home: "Colombia", away: "Congo DR", votes: { "1": 0.7159, "0": 0.2192, "2": 0.0649 }, recommendedOutcomes: ["1"], ruleLabel: "lock favorite over 70%", note: "Colombia win is the core route." },
  { matchNo: 6, kickoffLabel: "06/21 02:00", home: "Netherlands", away: "Sweden", votes: { "1": 0.4994, "0": 0.3155, "2": 0.1851 }, recommendedOutcomes: ["1", "0", "2"], ruleLabel: "spread split match", note: "This is the main variance slot." },
  { matchNo: 7, kickoffLabel: "06/22 07:00", home: "Uruguay", away: "Cape Verde", votes: { "1": 0.7186, "0": 0.2203, "2": 0.0611 }, recommendedOutcomes: ["1"], ruleLabel: "lock favorite over 70%", note: "Use as a lock." },
  { matchNo: 8, kickoffLabel: "06/23 09:00", home: "Norway", away: "Senegal", votes: { "1": 0.4508, "0": 0.2922, "2": 0.257 }, recommendedOutcomes: ["1", "0", "2"], ruleLabel: "spread 30% band", note: "Wide enough to keep all three outcomes in the core sheet." },
  { matchNo: 9, kickoffLabel: "06/24 02:00", home: "Portugal", away: "Uzbekistan", votes: { "1": 0.8086, "0": 0.1461, "2": 0.0453 }, recommendedOutcomes: ["1"], ruleLabel: "lock favorite over 80%", note: "Use as a lock." },
  { matchNo: 10, kickoffLabel: "06/23 12:00", home: "Jordan", away: "Algeria", votes: { "1": 0.1467, "0": 0.3327, "2": 0.5206 }, recommendedOutcomes: ["2", "0"], ruleLabel: "away win plus draw", note: "Algeria is the main line; draw has enough public share to cover." },
  { matchNo: 11, kickoffLabel: "06/22 01:00", home: "Spain", away: "Saudi Arabia", votes: { "1": 0.8364, "0": 0.1233, "2": 0.0403 }, recommendedOutcomes: ["1"], ruleLabel: "lock favorite over 80%", note: "Use as a lock." },
  { matchNo: 12, kickoffLabel: "06/24 05:00", home: "England", away: "Ghana", votes: { "1": 0.845, "0": 0.1147, "2": 0.0403 }, recommendedOutcomes: ["1"], ruleLabel: "lock favorite over 80%", note: "Use as a lock." },
  { matchNo: 13, kickoffLabel: "06/21 09:00", home: "Ecuador", away: "Curacao", votes: { "1": 0.8444, "0": 0.1148, "2": 0.0408 }, recommendedOutcomes: ["1"], ruleLabel: "lock favorite over 80%", note: "Use as a lock." },
];

function probabilityForSignature(signature: string) {
  return signature.split("").reduce((probability, outcome, index) => {
    const match = worldCupToto1636Matches[index];
    return probability * (match?.votes[outcome as OutcomeValue] ?? 0);
  }, 1);
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
        probabilityForSignature(rightSignature) - probabilityForSignature(leftSignature) ||
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
  salesAsOfLabel: "2026-06-20 14:51 JST",
  totalSalesYen: 193_558_900,
  summary:
    "Recommended evolved core is 46 units / 4,600 yen: 36 unique core rows, with the top 10 hot rows bought twice. The 20,000 yen CSV is a discussion cap, not an all-in recommendation, because positive EV is not proven.",
};
