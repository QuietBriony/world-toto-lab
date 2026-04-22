import type { Match, ResearchMemo, Round } from "@/lib/types";

export type MatchReadinessLevel = "high" | "medium" | "low" | "fallback";

export type MatchReadinessSummary = {
  hasAvailabilityInfo: boolean;
  hasConditionsInfo: boolean;
  hasHumanScout: boolean;
  hasManualAdjust: boolean;
  hasMarketProb: boolean;
  hasMotivationInfo: boolean;
  hasOfficialVote: boolean;
  hasRecentForm: boolean;
  level: MatchReadinessLevel;
  message: string;
};

function hasKnownTriplet(values: Array<number | null | undefined>) {
  return values.every((value) => value !== null && value !== undefined);
}

function hasMeaningfulAdjustments(match: Match) {
  return [
    match.homeStrengthAdjust,
    match.awayStrengthAdjust,
    match.availabilityAdjust,
    match.conditionsAdjust,
    match.tacticalAdjust,
    match.motivationAdjust,
    match.adminAdjust1,
    match.adminAdjust0,
    match.adminAdjust2,
    match.homeAdvantageAdjust,
    match.restDaysAdjust,
    match.travelAdjust,
    match.leagueTableMotivationAdjust,
    match.injurySuspensionAdjust,
    match.rotationRiskAdjust,
    match.groupStandingMotivationAdjust,
    match.travelClimateAdjust,
    match.altitudeHumidityAdjust,
    match.squadDepthAdjust,
    match.tournamentPressureAdjust,
  ].some((value) => typeof value === "number" && Math.abs(value) > 0.001);
}

function hasMemoOfType(memos: ResearchMemo[], types: ResearchMemo["memoType"][]) {
  return memos.some((memo) => types.includes(memo.memoType));
}

export function evaluateMatchReadiness(input: {
  match: Match;
  researchMemos?: ResearchMemo[];
}): MatchReadinessSummary {
  const memos = input.researchMemos ?? [];
  const hasMarketProb = hasKnownTriplet([
    input.match.marketProb1,
    input.match.marketProb0,
    input.match.marketProb2,
  ]);
  const hasOfficialVote = hasKnownTriplet([
    input.match.officialVote1,
    input.match.officialVote0,
    input.match.officialVote2,
  ]);
  const hasHumanScout = input.match.consensusF !== null || input.match.consensusD !== null;
  const hasRecentForm = Boolean(input.match.recentFormNote) || hasMemoOfType(memos, ["recent_form"]);
  const hasAvailabilityInfo =
    Boolean(input.match.availabilityInfo || input.match.injuryNote) ||
    hasMemoOfType(memos, ["injury", "suspension"]);
  const hasConditionsInfo =
    Boolean(input.match.conditionsInfo) || hasMemoOfType(memos, ["travel_rest", "weather"]);
  const hasMotivationInfo =
    Boolean(input.match.motivationNote) || hasMemoOfType(memos, ["motivation", "news"]);
  const hasManualAdjust = hasMeaningfulAdjustments(input.match);

  const supportingInfoCount = [
    hasRecentForm,
    hasAvailabilityInfo,
    hasConditionsInfo,
    hasMotivationInfo,
  ].filter(Boolean).length;

  if (hasMarketProb && hasHumanScout && hasOfficialVote && supportingInfoCount >= 2) {
    return {
      hasAvailabilityInfo,
      hasConditionsInfo,
      hasHumanScout,
      hasManualAdjust,
      hasMarketProb,
      hasMotivationInfo,
      hasOfficialVote,
      hasRecentForm,
      level: "high",
      message: "この試合は通常totoでも試算可能です。",
    };
  }

  if (!hasMarketProb && hasOfficialVote && (hasHumanScout || hasManualAdjust)) {
    return {
      hasAvailabilityInfo,
      hasConditionsInfo,
      hasHumanScout,
      hasManualAdjust,
      hasMarketProb,
      hasMotivationInfo,
      hasOfficialVote,
      hasRecentForm,
      level: "medium",
      message: "市場確率がないため、人力スコアと手入力補正中心の低信頼試算です。",
    };
  }

  if (hasOfficialVote || hasHumanScout) {
    return {
      hasAvailabilityInfo,
      hasConditionsInfo,
      hasHumanScout,
      hasManualAdjust,
      hasMarketProb,
      hasMotivationInfo,
      hasOfficialVote,
      hasRecentForm,
      level: "low",
      message: "この通常toto回は、公式人気はありますが、市場確率と人力スコアが不足しています。現在のモデルは低信頼です。",
    };
  }

  return {
    hasAvailabilityInfo,
    hasConditionsInfo,
    hasHumanScout,
    hasManualAdjust,
    hasMarketProb,
    hasMotivationInfo,
    hasOfficialVote,
    hasRecentForm,
    level: "fallback",
    message: "日程だけのため、モデル確率はfallbackです。",
  };
}

export function summarizeRoundReadiness(input: {
  researchMemos?: ResearchMemo[];
  round: Pick<Round, "competitionType">;
  matches: Match[];
}) {
  const byMatch = new Map<string, ResearchMemo[]>();
  (input.researchMemos ?? []).forEach((memo) => {
    if (!memo.matchId) {
      return;
    }

    const current = byMatch.get(memo.matchId) ?? [];
    current.push(memo);
    byMatch.set(memo.matchId, current);
  });

  const counts = {
    fallback: 0,
    high: 0,
    low: 0,
    medium: 0,
  };

  input.matches.forEach((match) => {
    const summary = evaluateMatchReadiness({
      match,
      researchMemos: byMatch.get(match.id) ?? [],
    });
    counts[summary.level] += 1;
  });

  if (counts.high === input.matches.length && input.matches.length > 0) {
    return {
      level: "ready" as const,
      message:
        input.round.competitionType === "world_cup"
          ? "W杯モードです。代表戦の公式日程、グループ状況、移動/気候、予測市場、チームニュースを重視します。"
          : "通常totoモードです。Jリーグの直近成績、ホーム/アウェイ、順位、休養、怪我、公式人気を重視します。",
    };
  }

  if (counts.high + counts.medium >= Math.ceil(input.matches.length / 2) && input.matches.length > 0) {
    return {
      level: "partial" as const,
      message:
        input.round.competitionType === "domestic_toto"
          ? "通常totoは、W杯本番前のモデル練習・人力予想の検証に向いています。"
          : "主要試合は試算できますが、一部は補助メモや手入力補正が必要です。",
    };
  }

  if (counts.low > 0 || counts.medium > 0) {
    return {
      level: "low_confidence" as const,
      message:
        "W杯モードに比べ、外部市場・国際ニュース・グループ状況が少ないため、通常totoでは人力Scout Cardと公式人気の差分検証が中心になります。",
    };
  }

  return {
    level: "not_ready" as const,
    message: "まだ日程以外の材料が少ないため、確率試算は未設定です。",
  };
}
