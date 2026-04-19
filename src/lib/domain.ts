import type {
  MatchCategory,
  Outcome,
  ProvisionalCall,
  RoundStatus,
  TicketMode,
} from "@/lib/types";

export const OUTCOME_VALUES = ["1", "0", "2"] as const;
export type OutcomeValue = (typeof OUTCOME_VALUES)[number];

export type DrawPolicy = "low" | "medium" | "high";
export type BadgeTone = "amber" | "teal" | "rose" | "sky" | "lime" | "slate";

export type MatchLike = {
  matchNo: number;
  homeTeam: string;
  awayTeam: string;
  officialVote1: number | null;
  officialVote0: number | null;
  officialVote2: number | null;
  marketProb1: number | null;
  marketProb0: number | null;
  marketProb2: number | null;
  modelProb1: number | null;
  modelProb0: number | null;
  modelProb2: number | null;
  consensusF: number | null;
  consensusD: number | null;
  consensusCall: string | null;
  disagreementScore: number | null;
  exceptionCount: number | null;
  confidence: number | null;
  category: MatchCategory | null;
  recommendedOutcomes: string | null;
  actualResult: Outcome | null;
};

export type ScoutReportLike = {
  directionScoreF: number;
  drawAlert: number;
  exceptionFlag: boolean;
  noteStrengthForm?: string | null;
  noteAvailability?: string | null;
  noteConditions?: string | null;
  noteTacticalMatchup?: string | null;
  noteMicro?: string | null;
  noteDrawAlert?: string | null;
};

export type ConsensusSummary = {
  avgF: number;
  medianF: number;
  avgD: number;
  disagreementScore: number;
  exceptionCount: number;
  consensusCall: string;
};

export type Badge = {
  label: string;
  tone: BadgeTone;
};

export type EdgeRow = {
  matchNo: number;
  fixture: string;
  outcome: OutcomeValue;
  modelProbability: number | null;
  officialVoteShare: number | null;
  marketProbability: number | null;
  edge: number | null;
  humanConsensus: string;
  confidence: number | null;
  valueScore: number;
  include: boolean;
};

const outcomeEnumMap: Record<OutcomeValue, Outcome> = {
  "1": "ONE",
  "0": "DRAW",
  "2": "TWO",
};

const enumOutcomeMap: Record<Outcome, OutcomeValue> = {
  ONE: "1",
  DRAW: "0",
  TWO: "2",
};

export const roundStatusLabel: Record<RoundStatus, string> = {
  draft: "Draft",
  analyzing: "Analyzing",
  locked: "Locked",
  resulted: "Resulted",
  reviewed: "Reviewed",
};

export const roundStatusOptions: RoundStatus[] = [
  "draft",
  "analyzing",
  "locked",
  "resulted",
  "reviewed",
];

export const categoryLabel: Record<MatchCategory, string> = {
  fixed: "固定寄り",
  contrarian: "逆張り候補",
  draw_candidate: "引き分け候補",
  info_wait: "情報待ち",
  pass: "見送り",
};

export const categoryOptions: MatchCategory[] = [
  "fixed",
  "contrarian",
  "draw_candidate",
  "info_wait",
  "pass",
];

export const ticketModeLabel: Record<TicketMode, string> = {
  conservative: "本線",
  balanced: "バランス",
  upset: "荒れ狙い",
};

export const ticketModeOptions: TicketMode[] = ["conservative", "balanced", "upset"];

export const provisionalCallLabel: Record<ProvisionalCall, string> = {
  axis_1: "1軸",
  axis_2: "2軸",
  draw_axis: "0軸候補",
  double: "ダブル",
  triple: "トリプル",
};

export const provisionalCallOptions: ProvisionalCall[] = [
  "axis_1",
  "axis_2",
  "draw_axis",
  "double",
  "triple",
];

export function outcomeToEnum(value: OutcomeValue): Outcome {
  return outcomeEnumMap[value];
}

export function enumToOutcome(value: Outcome | null | undefined): OutcomeValue | null {
  if (!value) {
    return null;
  }

  return enumOutcomeMap[value];
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return `${(value * 100).toFixed(digits)}%`;
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return value.toFixed(digits);
}

export function formatSignedPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) {
    return "—";
  }

  const percent = value * 100;
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(digits)}pt`;
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) {
    return "TBD";
  }

  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function parseOutcomeList(raw: string | null | undefined): OutcomeValue[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(/[\s,\/|]+/)
    .map((value) => value.trim())
    .filter((value): value is OutcomeValue =>
      OUTCOME_VALUES.includes(value as OutcomeValue),
    );
}

export function serializeOutcomeList(values: OutcomeValue[]): string | null {
  const uniqueValues = Array.from(new Set(values));
  return uniqueValues.length > 0 ? uniqueValues.join(",") : null;
}

export function getProbability(
  match: MatchLike,
  bucket: "official" | "market" | "model",
  outcome: OutcomeValue,
) {
  if (bucket === "official") {
    if (outcome === "1") return match.officialVote1;
    if (outcome === "0") return match.officialVote0;
    return match.officialVote2;
  }

  if (bucket === "market") {
    if (outcome === "1") return match.marketProb1;
    if (outcome === "0") return match.marketProb0;
    return match.marketProb2;
  }

  if (outcome === "1") return match.modelProb1;
  if (outcome === "0") return match.modelProb0;
  return match.modelProb2;
}

export function favoriteOutcome(values: Partial<Record<OutcomeValue, number | null>>) {
  const ranked = OUTCOME_VALUES.map((outcome) => ({
    outcome,
    value: values[outcome] ?? Number.NEGATIVE_INFINITY,
  }))
    .filter((entry) => Number.isFinite(entry.value))
    .sort((left, right) => right.value - left.value);

  return ranked[0]?.outcome ?? null;
}

export function favoriteOutcomeForBucket(
  match: MatchLike,
  bucket: "official" | "market" | "model",
) {
  return favoriteOutcome({
    "1": getProbability(match, bucket, "1"),
    "0": getProbability(match, bucket, "0"),
    "2": getProbability(match, bucket, "2"),
  });
}

export function getEdge(match: MatchLike, outcome: OutcomeValue): number | null {
  const model = getProbability(match, "model", outcome);
  const official = getProbability(match, "official", outcome);

  if (model === null || official === null) {
    return null;
  }

  return model - official;
}

export function computeDirectionScore(input: {
  scoreStrengthForm: number;
  scoreAvailability: number;
  scoreConditions: number;
  scoreTacticalMatchup: number;
  scoreMicro: number;
}) {
  return (
    input.scoreStrengthForm +
    input.scoreAvailability +
    input.scoreConditions +
    input.scoreTacticalMatchup +
    input.scoreMicro
  );
}

function standardDeviation(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    values.length;

  return Math.sqrt(variance);
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

export function computeConsensus(reports: ScoutReportLike[]): ConsensusSummary {
  const directionScores = reports.map((report) => report.directionScoreF);
  const drawAlerts = reports.map((report) => report.drawAlert);
  const avgF = directionScores.reduce((sum, value) => sum + value, 0) / reports.length;
  const avgD = drawAlerts.reduce((sum, value) => sum + value, 0) / reports.length;
  const medianF = median(directionScores);
  const disagreementScore =
    standardDeviation(directionScores) + standardDeviation(drawAlerts);
  const exceptionCount = reports.filter((report) => report.exceptionFlag).length;

  let consensusCall = "ダブル候補";

  if (avgD >= 1.5 && Math.abs(avgF) <= 2) {
    consensusCall = "0軸候補";
  } else if (avgF >= 4 && avgD <= 1) {
    consensusCall = "1軸";
  } else if (avgF <= -4 && avgD <= 1) {
    consensusCall = "2軸";
  } else if (avgD >= 1.2) {
    consensusCall = "ダブル候補";
  } else if (Math.abs(avgF) <= 1) {
    consensusCall = "トリプル候補";
  }

  return {
    avgF,
    medianF,
    avgD,
    disagreementScore,
    exceptionCount,
    consensusCall,
  };
}

export function representativeNotes(reports: ScoutReportLike[]) {
  const notes = reports.flatMap((report) => [
    report.noteStrengthForm,
    report.noteAvailability,
    report.noteConditions,
    report.noteTacticalMatchup,
    report.noteMicro,
    report.noteDrawAlert,
  ]);

  return Array.from(
    new Set(
      notes
        .map((note) => note?.trim())
        .filter((note): note is string => Boolean(note && note.length >= 8)),
    ),
  ).slice(0, 3);
}

export function humanConsensusOutcomes(match: MatchLike): OutcomeValue[] {
  if (!match.consensusCall) {
    return [];
  }

  if (match.consensusCall === "1軸") {
    return ["1"];
  }

  if (match.consensusCall === "2軸") {
    return ["2"];
  }

  if (match.consensusCall === "0軸候補") {
    return ["0"];
  }

  if (match.consensusCall === "トリプル候補") {
    return ["1", "0", "2"];
  }

  return (match.consensusF ?? 0) >= 0 ? ["1", "0"] : ["0", "2"];
}

export function aiRecommendedOutcomes(match: MatchLike): OutcomeValue[] {
  const saved = parseOutcomeList(match.recommendedOutcomes);
  if (saved.length > 0) {
    return saved;
  }

  const favorite = favoriteOutcomeForBucket(match, "model");
  return favorite ? [favorite] : [];
}

export function formatOutcomeSet(values: OutcomeValue[]) {
  return values.length > 0 ? values.join(" / ") : "—";
}

function sameOutcomeSet(left: OutcomeValue[], right: OutcomeValue[]) {
  return (
    left.length === right.length &&
    left.every((outcome) => right.includes(outcome))
  );
}

export function singlePickOverlayBadge(
  match: MatchLike,
  pick: OutcomeValue | null | undefined,
): Badge {
  const aiSet = aiRecommendedOutcomes(match);

  if (!pick) {
    return { label: "未入力", tone: "slate" };
  }

  if (aiSet.length === 0) {
    return { label: "AI未設定", tone: "slate" };
  }

  if (aiSet.includes(pick)) {
    return {
      label: aiSet.length === 1 ? "AI本線に乗る" : "AI候補に乗る",
      tone: "teal",
    };
  }

  if (pick === "0" && !aiSet.includes("0")) {
    return { label: "0で上書き", tone: "lime" };
  }

  return { label: "AIと別筋", tone: "rose" };
}

export function humanOverlayBadge(match: MatchLike): Badge {
  const aiSet = aiRecommendedOutcomes(match);
  const humanSet = humanConsensusOutcomes(match);

  if (aiSet.length === 0 && humanSet.length === 0) {
    return { label: "未集計", tone: "slate" };
  }

  if (aiSet.length === 0) {
    return { label: "AI未設定", tone: "slate" };
  }

  if (humanSet.length === 0) {
    return { label: "人力未集計", tone: "slate" };
  }

  if (sameOutcomeSet(aiSet, humanSet)) {
    return { label: "AIをそのまま採用", tone: "teal" };
  }

  const overlap = aiSet.some((outcome) => humanSet.includes(outcome));

  if (overlap) {
    if (humanSet.includes("0") && !aiSet.includes("0")) {
      return { label: "AIに0を追加", tone: "lime" };
    }

    return { label: "AIに人力を追加", tone: "sky" };
  }

  return { label: "AIと別筋", tone: "rose" };
}

export function outcomeSupportLabel(match: MatchLike, outcome: OutcomeValue) {
  return humanConsensusOutcomes(match).includes(outcome)
    ? "人力支援あり"
    : match.consensusCall ?? "未集計";
}

export function buildMatchBadges(match: MatchLike): Badge[] {
  const badges: Badge[] = [];
  const aiPrimary = aiRecommendedOutcomes(match)[0];
  const humanPrimary = humanConsensusOutcomes(match)[0];
  const officialFavorite = favoriteOutcomeForBucket(match, "official");

  if (
    aiPrimary &&
    officialFavorite &&
    aiPrimary !== officialFavorite &&
    (getEdge(match, aiPrimary) ?? 0) > 0
  ) {
    badges.push({ label: "AI逆張り", tone: "amber" });
  }

  if (
    humanPrimary &&
    officialFavorite &&
    humanPrimary !== officialFavorite &&
    !humanConsensusOutcomes(match).includes(officialFavorite)
  ) {
    badges.push({ label: "人間逆張り", tone: "rose" });
  }

  const aiSet = aiRecommendedOutcomes(match);
  const humanSet = humanConsensusOutcomes(match);
  const overlap = aiSet.some((outcome) => humanSet.includes(outcome));

  if (aiSet.length > 0 && humanSet.length > 0 && overlap) {
    badges.push({ label: "AIと人間一致", tone: "teal" });
  }

  if (aiSet.length > 0 && humanSet.length > 0 && !overlap) {
    badges.push({ label: "AIと人間対立", tone: "sky" });
  }

  if ((match.consensusD ?? 0) >= 1.5 || match.consensusCall === "0軸候補") {
    badges.push({ label: "引き分け警報", tone: "lime" });
  }

  if ((match.exceptionCount ?? 0) >= 2) {
    badges.push({ label: "例外多発", tone: "rose" });
  }

  const officialFavoriteEdge =
    officialFavorite === null ? null : getProbability(match, "model", officialFavorite);
  const officialFavoriteShare =
    officialFavorite === null ? null : getProbability(match, "official", officialFavorite);

  if (
    officialFavoriteShare !== null &&
    officialFavoriteShare >= 0.6 &&
    officialFavoriteEdge !== null &&
    officialFavoriteEdge <= 0.5
  ) {
    badges.push({ label: "人気過多", tone: "amber" });
  }

  if (match.category === "info_wait") {
    badges.push({ label: "情報待ち", tone: "slate" });
  }

  return badges;
}

export function pickCounts(picks: Array<{ pick: Outcome }>) {
  const counts: Record<OutcomeValue, number> = { "1": 0, "0": 0, "2": 0 };

  for (const pick of picks) {
    const outcome = enumToOutcome(pick.pick);
    if (outcome) {
      counts[outcome] += 1;
    }
  }

  return counts;
}

export function pickDistribution(counts: Record<OutcomeValue, number>) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return {
    total,
    "1": total === 0 ? 0 : counts["1"] / total,
    "0": total === 0 ? 0 : counts["0"] / total,
    "2": total === 0 ? 0 : counts["2"] / total,
  };
}

export function disagreementFromCounts(counts: Record<OutcomeValue, number>) {
  const distribution = pickDistribution(counts);
  const probabilities = OUTCOME_VALUES.map((outcome) => distribution[outcome]).filter(
    (value) => value > 0,
  );
  const entropy = probabilities.reduce((sum, value) => sum - value * Math.log2(value), 0);
  return entropy;
}

export function majorityHumanOutcome(picks: Array<{ pick: Outcome }>): OutcomeValue | null {
  const counts = pickCounts(picks);
  return favoriteOutcome(counts);
}

export function buildEdgeRows(matches: MatchLike[]): EdgeRow[] {
  const rows = matches.flatMap((match) =>
    OUTCOME_VALUES.map((outcome) => {
      const edge = getEdge(match, outcome);
      const officialVoteShare = getProbability(match, "official", outcome);
      const modelProbability = getProbability(match, "model", outcome);
      const marketProbability = getProbability(match, "market", outcome);
      const confidenceWeight = 0.7 + (match.confidence ?? 0.5);
      const humanBonus = humanConsensusOutcomes(match).includes(outcome) ? 0.06 : 0;
      const contrarianBonus =
        officialVoteShare !== null &&
        officialVoteShare < 0.25 &&
        ((modelProbability ?? 0) >= 0.28 || humanBonus > 0)
          ? 0.08
          : 0;
      const drawBonus =
        outcome === "0" && (match.consensusD ?? 0) >= 1.5 ? 0.08 : 0;
      const valueScore =
        (edge ?? 0) * confidenceWeight + contrarianBonus + drawBonus + humanBonus;

      return {
        matchNo: match.matchNo,
        fixture: `${match.homeTeam} vs ${match.awayTeam}`,
        outcome,
        modelProbability,
        officialVoteShare,
        marketProbability,
        edge,
        humanConsensus: outcomeSupportLabel(match, outcome),
        confidence: match.confidence,
        valueScore,
        include:
          valueScore >= 0.08 ||
          (edge ?? Number.NEGATIVE_INFINITY) >= 0.08 ||
          (outcome === "0" && (match.consensusD ?? 0) >= 1.5),
      };
    }),
  );

  return rows.sort((left, right) => right.valueScore - left.valueScore);
}

export function actualIncludesOutcome(match: MatchLike, outcomes: OutcomeValue[]) {
  const actual = enumToOutcome(match.actualResult);
  return actual ? outcomes.includes(actual) : false;
}

export function inferredPrimaryOutcome(match: MatchLike) {
  const aiPrimary = aiRecommendedOutcomes(match)[0];
  if (aiPrimary) {
    return aiPrimary;
  }

  const humanPrimary = humanConsensusOutcomes(match)[0];
  if (humanPrimary) {
    return humanPrimary;
  }

  return favoriteOutcomeForBucket(match, "official");
}
