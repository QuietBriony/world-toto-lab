import type {
  CompetitionType,
  DataProfile,
  Match,
  PrimaryUse,
  ProbabilityReadiness,
  ProductType,
  Round,
  RoundSource,
  SportContext,
} from "@/lib/types";

const WORLD_TOTO_PATTERN = /(world\s*toto|ワールドtoto|world cup|w杯|fifa)/i;

export const competitionTypeModeLabel: Record<CompetitionType, string> = {
  world_cup: "W杯totoモード",
  domestic_toto: "通常totoモード",
  winner: "WINNERモード",
  custom: "カスタムモード",
};

export const probabilityReadinessStatusLabel: Record<ProbabilityReadiness, string> = {
  ready: "試算可能",
  partial: "部分試算",
  low_confidence: "低信頼",
  not_ready: "未設定",
};

export const dataProfileLabel: Record<DataProfile, string> = {
  worldcup_rich: "WorldCup Rich",
  domestic_standard: "Domestic Standard",
  manual_light: "Manual Light",
  demo: "Demo",
};

export const dataSourceMatrix = [
  {
    commonization: "Fixture / Round",
    domestic: "toto公式対象 / Jリーグ日程",
    item: "日程",
    worldCup: "FIFA公式日程",
  },
  {
    commonization: "Official Vote",
    domestic: "toto公式投票率",
    item: "公式人気",
    worldCup: "toto公式投票率",
  },
  {
    commonization: "Market Prob",
    domestic: "Bookmaker / 手入力",
    item: "市場確率",
    worldCup: "予測市場 / Bookmaker",
  },
  {
    commonization: "Strength",
    domestic: "順位 / 直近成績 / Elo風",
    item: "地力",
    worldCup: "Elo / FIFA / 代表実績",
  },
  {
    commonization: "Availability",
    domestic: "怪我 / 出場停止",
    item: "戦力",
    worldCup: "招集 / 怪我",
  },
  {
    commonization: "Conditions",
    domestic: "ホーム / 休養 / 移動",
    item: "条件",
    worldCup: "移動 / 気候 / 会場",
  },
  {
    commonization: "Tactical",
    domestic: "クラブ戦術",
    item: "戦術",
    worldCup: "代表戦術",
  },
  {
    commonization: "Human Signal",
    domestic: "Scout Card",
    item: "人力",
    worldCup: "Scout Card",
  },
  {
    commonization: "EV Engine",
    domestic: "公式人気との差",
    item: "EV",
    worldCup: "公式人気との差",
  },
] as const;

function looksLikeWorldCupText(...values: Array<string | null | undefined>) {
  return values.some((value) => WORLD_TOTO_PATTERN.test(value ?? ""));
}

function normalizeAdjustment(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) > 0.001;
}

export function resolveRoundModeDefaults(input: {
  competitionType?: CompetitionType | null;
  dataProfile?: DataProfile | null;
  notes?: string | null;
  primaryUse?: PrimaryUse | null;
  productType?: ProductType | null;
  roundSource?: RoundSource | null;
  sourceNote?: string | null;
  sportContext?: SportContext | null;
  title?: string | null;
}) {
  const productType = input.productType ?? "toto13";
  const inferredWorldCup = looksLikeWorldCupText(input.title, input.notes, input.sourceNote);
  const competitionType =
    input.competitionType ??
    (productType === "winner"
      ? "winner"
      : inferredWorldCup || input.roundSource === "fixture_master"
        ? "world_cup"
        : "domestic_toto");
  const sportContext =
    input.sportContext ??
    (competitionType === "world_cup"
      ? "national_team"
      : competitionType === "domestic_toto"
        ? "j_league"
        : productType === "winner"
          ? "club"
          : "other");
  const primaryUse =
    input.primaryUse ??
    (input.roundSource === "demo_sample"
      ? "demo"
      : competitionType === "domestic_toto"
        ? "practice"
        : "friend_game");
  const dataProfile =
    input.dataProfile ??
    (input.roundSource === "demo_sample"
      ? "demo"
      : competitionType === "world_cup"
        ? "worldcup_rich"
        : competitionType === "domestic_toto"
          ? "domestic_standard"
          : "manual_light");

  return {
    competitionType,
    dataProfile,
    primaryUse,
    sportContext,
  } satisfies {
    competitionType: CompetitionType;
    dataProfile: DataProfile;
    primaryUse: PrimaryUse;
    sportContext: SportContext;
  };
}

export function roundModeDescription(round: Pick<
  Round,
  "competitionType" | "dataProfile" | "primaryUse" | "sportContext"
>) {
  if (round.competitionType === "world_cup") {
    return "W杯モードです。代表戦の公式日程、グループ状況、移動/気候、予測市場、チームニュースを重視します。";
  }

  if (round.competitionType === "domestic_toto") {
    return "通常totoモードです。Jリーグの直近成績、ホーム/アウェイ、順位、休養、怪我、公式人気を重視します。外部市場確率が不足する場合は、検索メモ・人力Scout Card・手入力補正を使います。";
  }

  if (round.competitionType === "winner") {
    return "WINNERモードです。1試合ごとの差分と人気の偏りを軽く見る用途に寄せています。";
  }

  return "カスタムモードです。入力済みの材料に応じて、共通ロジックで差分を見ます。";
}

export function probabilityReadinessDescription(
  readiness: ProbabilityReadiness,
  competitionType: CompetitionType,
) {
  if (readiness === "ready") {
    return competitionType === "domestic_toto"
      ? "この通常toto回は、人力・公式人気・補正情報がそろっていて試算可能です。"
      : "このラウンドは市場確率や人力材料がそろっていて、共通確率エンジンで試算できます。";
  }

  if (readiness === "partial") {
    return "主要データの一部はそろっていますが、欠けている材料もあるため部分試算です。";
  }

  if (readiness === "low_confidence") {
    return competitionType === "domestic_toto"
      ? "この通常toto回は、公式人気はありますが、市場確率と人力スコアが不足しています。現在のモデルは低信頼です。"
      : "入力材料が薄いため、共通確率エンジンは低信頼モードで動いています。";
  }

  return competitionType === "domestic_toto"
    ? "W杯モードに比べ、通常totoでは外部市場や国際ニュースが少ない場合があります。現在はfallback中心で、練習・検証向けの状態です。"
    : "日程だけ、もしくは最小限の情報だけなので、モデル確率はまだfallbackです。";
}

export function modeMaterialsDescription(competitionType: CompetitionType) {
  if (competitionType === "world_cup") {
    return "W杯モードです。代表戦の公式日程、グループ状況、移動/気候、予測市場、チームニュースを重視します。";
  }

  if (competitionType === "domestic_toto") {
    return "通常totoモードです。Jリーグの直近成績、ホーム/アウェイ、順位、休養、怪我、公式人気を重視します。外部市場確率が不足する場合は、検索メモ・人力Scout Card・手入力補正を使います。";
  }

  if (competitionType === "winner") {
    return "WINNERモードです。1試合ごとの人気差と推定確率を軽く比べる用途に寄せています。";
  }

  return "カスタムモードです。入力済みの材料に応じて、共通ロジックで差分を見ます。";
}

export function inferRoundProbabilityReadiness(matches: Match[]): ProbabilityReadiness {
  if (matches.length === 0) {
    return "not_ready";
  }

  const readyCount = matches.filter((match) => {
    const hasMarket =
      match.marketProb1 !== null && match.marketProb0 !== null && match.marketProb2 !== null;
    const hasOfficial =
      match.officialVote1 !== null &&
      match.officialVote0 !== null &&
      match.officialVote2 !== null;
    const hasHumanSignal = match.consensusF !== null || match.consensusD !== null;
    const hasContextInfo = Boolean(
      match.recentFormNote ||
        match.availabilityInfo ||
        match.conditionsInfo ||
        match.motivationNote ||
        match.injuryNote ||
        match.tacticalNote,
    );
    const hasManualAdjust = [
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
    ].some(normalizeAdjustment);

    return (hasMarket && hasOfficial && hasHumanSignal && hasContextInfo) || (hasOfficial && hasHumanSignal && hasManualAdjust);
  }).length;

  if (readyCount === matches.length) {
    return "ready";
  }

  if (readyCount >= Math.ceil(matches.length / 2)) {
    return "partial";
  }

  const lowConfidenceCount = matches.filter((match) => {
    return Boolean(
      match.officialVote1 !== null ||
        match.officialVote0 !== null ||
        match.officialVote2 !== null ||
        match.consensusF !== null ||
        match.consensusD !== null,
    );
  }).length;

  if (lowConfidenceCount > 0) {
    return "low_confidence";
  }

  return "not_ready";
}
