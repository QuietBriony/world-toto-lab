import { appRoute, buildRoundHref } from "@/lib/round-links";
import { filterPredictors } from "@/lib/users";
import type { HumanScoutReport, Match, Pick, User } from "@/lib/types";

type ProgressTone = "amber" | "sky" | "teal";

export type RoundNextStep = {
  description: string;
  href: string;
  label: string;
  tone: ProgressTone;
};

export type RoundProgressSummary = {
  configuredMatches: number;
  expectedPickEntries: number;
  expectedScoutEntries: number;
  missingPickEntries: number;
  missingResultCount: number;
  missingScoutEntries: number;
  nextStep: RoundNextStep;
  pickCompletion: number;
  predictorCount: number;
  resultCompletion: number;
  scoutCompletion: number;
  setupCompletion: number;
  watcherCount: number;
};

export function matchHasSetupInput(match: Match) {
  return Boolean(
    match.kickoffTime ||
      match.venue ||
      match.stage ||
      match.recommendedOutcomes ||
      match.tacticalNote ||
      match.injuryNote ||
      match.motivationNote ||
      match.adminNote ||
      match.category ||
      match.modelProb1 !== null ||
      match.modelProb0 !== null ||
      match.modelProb2 !== null ||
      match.officialVote1 !== null ||
      match.officialVote0 !== null ||
      match.officialVote2 !== null ||
      match.marketProb1 !== null ||
      match.marketProb0 !== null ||
      match.marketProb2 !== null,
  );
}

function ratio(done: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return done / total;
}

export function deriveRoundProgressSummary(input: {
  matches: Match[];
  picks: Pick[];
  resultedCount?: number;
  roundId: string;
  scoutReports: HumanScoutReport[];
  users: User[];
}): RoundProgressSummary {
  const matchCount = input.matches.length;
  const configuredMatches = input.matches.filter(matchHasSetupInput).length;
  const predictorCount = filterPredictors(input.users).length;
  const watcherCount = Math.max(input.users.length - predictorCount, 0);
  const expectedPickEntries = input.users.length > 0 ? input.users.length * matchCount : 0;
  const expectedScoutEntries = predictorCount > 0 ? predictorCount * matchCount : 0;
  const missingPickEntries = Math.max(expectedPickEntries - input.picks.length, 0);
  const missingScoutEntries = Math.max(expectedScoutEntries - input.scoutReports.length, 0);
  const resultedCount =
    input.resultedCount ?? input.matches.filter((match) => match.actualResult !== null).length;
  const missingResultCount = Math.max(matchCount - resultedCount, 0);

  let nextStep: RoundNextStep;

  if (input.users.length === 0) {
    nextStep = {
      description: "まずは共有メンバーを作ってから入力を始めます。",
      href: `${appRoute.dashboard}#shared-members`,
      label: "共有メンバーを作成",
      tone: "amber",
    };
  } else if (predictorCount === 0) {
    nextStep = {
      description: "少なくとも1人は予想者にして、AIと比較できる人力ラインを作ります。",
      href: `${appRoute.dashboard}#shared-members`,
      label: "予想者を選ぶ",
      tone: "amber",
    };
  } else if (configuredMatches < matchCount) {
    nextStep = {
      description: `試合設定が ${matchCount - configuredMatches} 試合ぶん足りません。`,
      href: buildRoundHref(appRoute.workspace, input.roundId),
      label: "試合設定を整える",
      tone: "amber",
    };
  } else if (missingPickEntries > 0) {
    nextStep = {
      description: `予想者の入力とウォッチの支持先が、あと ${missingPickEntries} 件で揃います。`,
      href: buildRoundHref(appRoute.picks, input.roundId),
      label: "支持 / 予想を入力",
      tone: "sky",
    };
  } else if (missingScoutEntries > 0) {
    nextStep = {
      description: `予想者カードがあと ${missingScoutEntries} 件で揃います。`,
      href: buildRoundHref(appRoute.scoutCards, input.roundId),
      label: "予想者カードを追加",
      tone: "sky",
    };
  } else if (missingResultCount > 0) {
    nextStep = {
      description: `結果未入力が ${missingResultCount} 試合あります。`,
      href: buildRoundHref(appRoute.review, input.roundId),
      label: "結果を入れて振り返る",
      tone: "teal",
    };
  } else {
    nextStep = {
      description: "ひと通り入力済みです。最後に振り返りを確認します。",
      href: buildRoundHref(appRoute.review, input.roundId),
      label: "振り返りを開く",
      tone: "teal",
    };
  }

  return {
    configuredMatches,
    expectedPickEntries,
    expectedScoutEntries,
    missingPickEntries,
    missingResultCount,
    missingScoutEntries,
    nextStep,
    pickCompletion: ratio(input.picks.length, expectedPickEntries),
    predictorCount,
    resultCompletion: ratio(resultedCount, matchCount),
    scoutCompletion: ratio(input.scoutReports.length, expectedScoutEntries),
    setupCompletion: ratio(configuredMatches, matchCount),
    watcherCount,
  };
}
