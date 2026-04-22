import { clamp, outcomeToEnum } from "@/lib/domain";
import { productTypeOptions, voidHandlingOptions } from "@/lib/product-rules";
import type {
  CompetitionType,
  DataProfile,
  MatchCategory,
  Outcome,
  PrimaryUse,
  ProductType,
  ProvisionalCall,
  ProbabilityReadiness,
  ResearchMemoConfidence,
  ResearchMemoType,
  RoundSource,
  RoundStatus,
  SportContext,
  TicketMode,
  VoidHandling,
} from "@/lib/types";

function stringFromUnknown(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export function stringValue(formData: FormData, key: string) {
  return stringFromUnknown(formData.get(key));
}

export function stringValues(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => stringFromUnknown(value))
    .filter(Boolean);
}

export function nullableString(formData: FormData, key: string) {
  const value = stringValue(formData, key);
  return value.length > 0 ? value : null;
}

export function parseFloatOrNull(raw: string) {
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function parseIntOrNull(raw: string) {
  if (!raw) {
    return null;
  }

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}

export function parseProbabilityPercent(raw: string) {
  const value = parseFloatOrNull(raw);
  return value === null ? null : clamp(value / 100, 0, 1);
}

export function parseBoundedInt(raw: string, min: number, max: number) {
  const value = parseIntOrNull(raw);
  return clamp(value ?? 0, min, max);
}

export function parseRoundStatus(raw: string): RoundStatus {
  const values: RoundStatus[] = [
    "draft",
    "analyzing",
    "locked",
    "resulted",
    "reviewed",
  ];
  return values.includes(raw as RoundStatus) ? (raw as RoundStatus) : "draft";
}

export function parseProductType(raw: string): ProductType {
  return productTypeOptions.includes(raw as ProductType)
    ? (raw as ProductType)
    : "toto13";
}

export function parseRoundSource(raw: string): RoundSource {
  const values: RoundSource[] = [
    "fixture_master",
    "toto_official_manual",
    "user_manual",
    "demo_sample",
  ];
  return values.includes(raw as RoundSource)
    ? (raw as RoundSource)
    : "user_manual";
}

export function parseCompetitionType(raw: string): CompetitionType {
  const values: CompetitionType[] = [
    "world_cup",
    "domestic_toto",
    "winner",
    "custom",
  ];

  return values.includes(raw as CompetitionType)
    ? (raw as CompetitionType)
    : "world_cup";
}

export function parseSportContext(raw: string): SportContext {
  const values: SportContext[] = ["national_team", "j_league", "club", "other"];

  return values.includes(raw as SportContext)
    ? (raw as SportContext)
    : "national_team";
}

export function parsePrimaryUse(raw: string): PrimaryUse {
  const values: PrimaryUse[] = ["real_round_research", "practice", "demo", "friend_game"];

  return values.includes(raw as PrimaryUse)
    ? (raw as PrimaryUse)
    : "friend_game";
}

export function parseDataProfile(raw: string): DataProfile {
  const values: DataProfile[] = ["worldcup_rich", "domestic_standard", "manual_light", "demo"];

  return values.includes(raw as DataProfile)
    ? (raw as DataProfile)
    : "worldcup_rich";
}

export function parseProbabilityReadiness(raw: string): ProbabilityReadiness {
  const values: ProbabilityReadiness[] = ["ready", "partial", "low_confidence", "not_ready"];

  return values.includes(raw as ProbabilityReadiness)
    ? (raw as ProbabilityReadiness)
    : "not_ready";
}

export function parseVoidHandling(raw: string): VoidHandling {
  return voidHandlingOptions.includes(raw as VoidHandling)
    ? (raw as VoidHandling)
    : "manual";
}

export function parseResearchMemoType(raw: string): ResearchMemoType {
  const values: ResearchMemoType[] = [
    "recent_form",
    "injury",
    "suspension",
    "motivation",
    "travel_rest",
    "tactical",
    "weather",
    "odds",
    "news",
    "other",
  ];

  return values.includes(raw as ResearchMemoType)
    ? (raw as ResearchMemoType)
    : "other";
}

export function parseResearchMemoConfidence(raw: string): ResearchMemoConfidence {
  const values: ResearchMemoConfidence[] = ["high", "medium", "low"];

  return values.includes(raw as ResearchMemoConfidence)
    ? (raw as ResearchMemoConfidence)
    : "medium";
}

export function parseCategory(raw: string): MatchCategory | null {
  const values: MatchCategory[] = [
    "fixed",
    "contrarian",
    "draw_candidate",
    "info_wait",
    "pass",
  ];
  return values.includes(raw as MatchCategory) ? (raw as MatchCategory) : null;
}

export function parseProvisionalCall(raw: string): ProvisionalCall {
  const values: ProvisionalCall[] = [
    "axis_1",
    "axis_2",
    "draw_axis",
    "double",
    "triple",
  ];
  return values.includes(raw as ProvisionalCall)
    ? (raw as ProvisionalCall)
    : "double";
}

export function parseTicketMode(raw: string): TicketMode {
  const values: TicketMode[] = ["conservative", "balanced", "upset"];
  return values.includes(raw as TicketMode) ? (raw as TicketMode) : "balanced";
}

export function parseOutcome(raw: string): Outcome | null {
  if (raw === "1" || raw === "0" || raw === "2") {
    return outcomeToEnum(raw);
  }

  return null;
}
