import {
  aiRecommendedOutcomes,
  enumToOutcome,
  favoriteOutcomeForBucket,
  humanConsensusOutcomes,
  inferredPrimaryOutcome,
  type MatchLike,
  type OutcomeValue,
} from "@/lib/domain";
import type { HumanScoutReport, Match, Outcome, Pick, User } from "@/lib/types";
import { filterPredictors } from "@/lib/users";

type PickWithUser = Pick & {
  user?: User;
};

type ReportWithUser = HumanScoutReport & {
  user?: User;
};

export type ReviewSummary = {
  completedMatches: number;
  aiHits: number;
  humanHits: number;
  officialHits: number;
  marketHits: number;
  rankings: Array<{
    userId: string;
    name: string;
    hits: number;
    total: number;
    directionHitRate: number;
  }>;
  drawAlertEffective: number;
  exceptionUseful: number;
  agreementRate: number;
  conflictCoverageRate: number;
};

function outcomeMatches(actual: Outcome | null, expected: OutcomeValue | null) {
  if (!actual || !expected) {
    return false;
  }

  return enumToOutcome(actual) === expected;
}

function inferDirectionOutcome(report: HumanScoutReport): OutcomeValue | null {
  if (report.drawAlert >= 1 && Math.abs(report.directionScoreF) <= 1) {
    return "0";
  }

  if (report.directionScoreF >= 2) {
    return "1";
  }

  if (report.directionScoreF <= -2) {
    return "2";
  }

  return null;
}

export function buildReviewSummary(input: {
  matches: Match[];
  picks: PickWithUser[];
  scoutReports: ReportWithUser[];
  users: User[];
}): ReviewSummary {
  const completedMatches = input.matches.filter((match) => match.actualResult !== null);
  const reportsByUserId = new Map<string, ReportWithUser[]>();

  for (const report of input.scoutReports) {
    const userReports = reportsByUserId.get(report.userId) ?? [];
    userReports.push(report);
    reportsByUserId.set(report.userId, userReports);
  }

  const aiHits = completedMatches.filter((match) =>
    aiRecommendedOutcomes(match as MatchLike).includes(
      enumToOutcome(match.actualResult) as OutcomeValue,
    ),
  ).length;

  const humanHits = completedMatches.filter((match) =>
    humanConsensusOutcomes(match as MatchLike).includes(
      enumToOutcome(match.actualResult) as OutcomeValue,
    ),
  ).length;

  const officialHits = completedMatches.filter((match) =>
    outcomeMatches(match.actualResult, favoriteOutcomeForBucket(match as MatchLike, "official")),
  ).length;

  const marketHits = completedMatches.filter((match) =>
    outcomeMatches(match.actualResult, favoriteOutcomeForBucket(match as MatchLike, "market")),
  ).length;

  const rankingUsers = filterPredictors(input.users);
  const rankings = (rankingUsers.length > 0 ? rankingUsers : input.users)
    .map((user) => {
      const userPicks = input.picks.filter((pick) => pick.userId === user.id);
      const hits = userPicks.filter((pick) => {
        const match = completedMatches.find((entry) => entry.id === pick.matchId);
        return match ? match.actualResult === pick.pick : false;
      }).length;

      const userReports = reportsByUserId.get(user.id) ?? [];
      const directionResults = userReports
        .map((report) => {
          const match = completedMatches.find((entry) => entry.id === report.matchId);
          if (!match?.actualResult) {
            return null;
          }

          const inferred = inferDirectionOutcome(report);
          return inferred ? inferred === enumToOutcome(match.actualResult) : null;
        })
        .filter((value): value is boolean => value !== null);

      const directionHitRate =
        directionResults.length > 0
          ? directionResults.filter(Boolean).length / directionResults.length
          : 0;

      return {
        userId: user.id,
        name: user.name,
        hits,
        total: completedMatches.length,
        directionHitRate,
      };
    })
    .sort((left, right) => {
      if (right.hits !== left.hits) {
        return right.hits - left.hits;
      }

      return right.directionHitRate - left.directionHitRate;
    });

  const drawAlertEffective = completedMatches.filter(
    (match) => (match.consensusD ?? 0) >= 1.5 && enumToOutcome(match.actualResult) === "0",
  ).length;

  const exceptionUseful = completedMatches.filter((match) => {
    const officialFavorite = favoriteOutcomeForBucket(match as MatchLike, "official");
    const actual = enumToOutcome(match.actualResult);
    return (match.exceptionCount ?? 0) > 0 && actual !== null && actual !== officialFavorite;
  }).length;

  const agreementMatches = completedMatches.filter((match) => {
    const ai = aiRecommendedOutcomes(match as MatchLike);
    const human = humanConsensusOutcomes(match as MatchLike);
    return ai.some((outcome) => human.includes(outcome));
  });

  const conflictMatches = completedMatches.filter((match) => {
    const ai = aiRecommendedOutcomes(match as MatchLike);
    const human = humanConsensusOutcomes(match as MatchLike);
    return ai.length > 0 && human.length > 0 && !ai.some((outcome) => human.includes(outcome));
  });

  const agreementRate =
    agreementMatches.length > 0
      ? agreementMatches.filter((match) =>
          aiRecommendedOutcomes(match as MatchLike).includes(
            enumToOutcome(match.actualResult) as OutcomeValue,
          ),
        ).length / agreementMatches.length
      : 0;

  const conflictCoverageRate =
    conflictMatches.length > 0
      ? conflictMatches.filter((match) => {
          const actual = enumToOutcome(match.actualResult);
          if (!actual) {
            return false;
          }

          const ai = aiRecommendedOutcomes(match as MatchLike);
          const human = humanConsensusOutcomes(match as MatchLike);
          return (
            ai.includes(actual) ||
            human.includes(actual) ||
            inferredPrimaryOutcome(match as MatchLike) === actual
          );
        }).length / conflictMatches.length
      : 0;

  return {
    completedMatches: completedMatches.length,
    aiHits,
    humanHits,
    officialHits,
    marketHits,
    rankings,
    drawAlertEffective,
    exceptionUseful,
    agreementRate,
    conflictCoverageRate,
  };
}
