import { appRoute, buildRoundHref } from "@/lib/round-links";
import type { HumanScoutReport, Match, Pick } from "@/lib/types";

type ProgressTone = "amber" | "sky" | "teal";

export type RoundNextStep = {
  description: string;
  href: string;
  label: string;
  tone: ProgressTone;
};

export type RoundProgressSummary = {
  configuredMatches: number;
  expectedMemberEntries: number;
  missingPickEntries: number;
  missingResultCount: number;
  missingScoutEntries: number;
  nextStep: RoundNextStep;
  pickCompletion: number;
  resultCompletion: number;
  scoutCompletion: number;
  setupCompletion: number;
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
  userCount: number;
}): RoundProgressSummary {
  const matchCount = input.matches.length;
  const configuredMatches = input.matches.filter(matchHasSetupInput).length;
  const expectedMemberEntries = input.userCount > 0 ? input.userCount * matchCount : 0;
  const missingPickEntries = Math.max(expectedMemberEntries - input.picks.length, 0);
  const missingScoutEntries = Math.max(expectedMemberEntries - input.scoutReports.length, 0);
  const resultedCount =
    input.resultedCount ?? input.matches.filter((match) => match.actualResult !== null).length;
  const missingResultCount = Math.max(matchCount - resultedCount, 0);

  let nextStep: RoundNextStep;

  if (input.userCount === 0) {
    nextStep = {
      description: "まずは共有メンバーを作ってから入力を始めます。",
      href: `${appRoute.dashboard}#shared-members`,
      label: "共有メンバーを作成",
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
      description: `人力予想があと ${missingPickEntries} 件で揃います。`,
      href: buildRoundHref(appRoute.picks, input.roundId),
      label: "人力予想を入力",
      tone: "sky",
    };
  } else if (missingScoutEntries > 0) {
    nextStep = {
      description: `根拠カードがあと ${missingScoutEntries} 件で揃います。`,
      href: buildRoundHref(appRoute.scoutCards, input.roundId),
      label: "根拠カードを追加",
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
    expectedMemberEntries,
    missingPickEntries,
    missingResultCount,
    missingScoutEntries,
    nextStep,
    pickCompletion: ratio(input.picks.length, expectedMemberEntries),
    resultCompletion: ratio(resultedCount, matchCount),
    scoutCompletion: ratio(input.scoutReports.length, expectedMemberEntries),
    setupCompletion: ratio(configuredMatches, matchCount),
  };
}
