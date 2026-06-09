/**
 * 上流シグナル（優勝市場など）の「モデルへの軽い反映」ロジック（純粋）。
 *
 * 思想:
 * - 優勝市場（outright_champion）は個別試合の 1/0/2 を直接決めない。
 * - France Champion YES のような市場は、France の地力に対する上流シグナルとして
 *   `homeStrengthAdjust` / `awayStrengthAdjust` を「最大 ±0.03」だけ動かす。
 * - 既存の probability/engine は一切変更せず、engine 入力に対する additive な補正として適用する
 *   （既存の手入力補正を上書きしない）。
 *
 * teamPriorAdjustment = normalizeMarketSignal(marketProb, baseline) * weight  （その後 ±0.03 で clip）
 */
import { clamp } from "@/lib/domain";
import { calculateModelProbabilities, type ProbabilityEngineInput } from "@/lib/probability/engine";
import { teamNameMatches } from "@/lib/market-sources/team-names";
import type { MarketNode, MarketSource } from "@/lib/market-sources/types";

/** 個別試合への team-prior 補正の上限（片側）。 */
export const MAX_TEAM_PRIOR_ADJUST = 0.03;

/** 既定の優勝確率ベースライン（W杯2026 = 48チームの一様確率）。 */
export const DEFAULT_CHAMPION_BASELINE = 1 / 48;

/**
 * 市場確率を「ベースラインからの符号付き強度（おおむね -1..1）」へ正規化する。
 * - probability > baseline で正（地力が市場評価で高い）。
 * - scale で飽和の速さを調整（既定はベースライン依存）。
 */
export function normalizeMarketSignal(
  probability: number,
  baseline: number,
  scale?: number,
): number {
  const safeBaseline = baseline > 0 ? baseline : DEFAULT_CHAMPION_BASELINE;
  const span = scale && scale > 0 ? scale : Math.max(safeBaseline * 4, 0.08);
  return clamp((probability - safeBaseline) / span, -1, 1);
}

/**
 * 1つの上流シグナルから team-prior 補正値を計算する。
 * 返り値は必ず ±maxAdjust 以内（既定 ±0.03）。
 */
export function teamPriorAdjustment(input: {
  probability: number | null;
  baselineChampionProbability?: number;
  weight: number;
  maxAdjust?: number;
}): number {
  const maxAdjust = input.maxAdjust ?? MAX_TEAM_PRIOR_ADJUST;
  if (input.probability === null || !Number.isFinite(input.probability)) {
    return 0;
  }
  const baseline = input.baselineChampionProbability ?? DEFAULT_CHAMPION_BASELINE;
  const signal = normalizeMarketSignal(input.probability, baseline);
  const raw = signal * input.weight;
  return clamp(raw, -maxAdjust, maxAdjust);
}

export type UpstreamTeamPriorContribution = {
  nodeId: string;
  source: MarketSource;
  team: string;
  side: "home" | "away";
  probability: number;
  weight: number;
  /** clip 前の素の補正値（signal * weight）。 */
  rawAdjustment: number;
  /** clip 後の補正値（±maxAdjust 以内）。 */
  adjustment: number;
};

export type UpstreamTeamPriorAdjustments = {
  /** ホーム側 strength 補正（±maxAdjust 以内）。 */
  homeStrengthDelta: number;
  /** アウェイ側 strength 補正（±maxAdjust 以内）。 */
  awayStrengthDelta: number;
  contributions: UpstreamTeamPriorContribution[];
  notes: string[];
};

/**
 * 試合に対して、上流シグナル（upstream_team_prior の YES 系ノード）から
 * home/away それぞれの strength 補正を計算する。各側は必ず ±maxAdjust 以内。
 */
export function computeUpstreamTeamPriorAdjustments(
  teams: { homeTeam: string; awayTeam: string },
  nodes: readonly MarketNode[],
  options: { baselineChampionProbability?: number; maxAdjust?: number } = {},
): UpstreamTeamPriorAdjustments {
  const baseline = options.baselineChampionProbability ?? DEFAULT_CHAMPION_BASELINE;
  const maxAdjust = options.maxAdjust ?? MAX_TEAM_PRIOR_ADJUST;
  const contributions: UpstreamTeamPriorContribution[] = [];
  const notes: string[] = [];
  let homeSum = 0;
  let awaySum = 0;

  for (const node of nodes) {
    if (node.signalLayer !== "upstream_team_prior") {
      continue;
    }
    // NO サイドの確率はチーム地力の上流シグナルとして使わない。
    if (node.outcomeLabel.trim().toUpperCase() === "NO") {
      continue;
    }
    if (node.probability === null || !Number.isFinite(node.probability) || !node.team) {
      continue;
    }
    const isHome = teamNameMatches(node.team, teams.homeTeam);
    const isAway = teamNameMatches(node.team, teams.awayTeam);
    if (!isHome && !isAway) {
      continue;
    }

    const adjustment = teamPriorAdjustment({
      probability: node.probability,
      baselineChampionProbability: baseline,
      weight: node.weight,
      maxAdjust,
    });
    const rawAdjustment = normalizeMarketSignal(node.probability, baseline) * node.weight;
    const side: "home" | "away" = isHome ? "home" : "away";
    if (isHome) {
      homeSum += adjustment;
    } else {
      awaySum += adjustment;
    }
    contributions.push({
      nodeId: node.id,
      source: node.source,
      team: node.team,
      side,
      probability: node.probability,
      weight: node.weight,
      rawAdjustment,
      adjustment,
    });
  }

  // 複数ソースが重なっても、片側の合計は ±maxAdjust を超えない（過大評価しない）。
  const homeStrengthDelta = clamp(homeSum, -maxAdjust, maxAdjust);
  const awayStrengthDelta = clamp(awaySum, -maxAdjust, maxAdjust);

  if (contributions.length > 0) {
    notes.push(
      `優勝市場を上流シグナルとして反映（home ${homeStrengthDelta >= 0 ? "+" : ""}${homeStrengthDelta.toFixed(3)} / away ${awayStrengthDelta >= 0 ? "+" : ""}${awayStrengthDelta.toFixed(3)}、各側 ±${maxAdjust} 以内）。`,
    );
  }

  return { homeStrengthDelta, awayStrengthDelta, contributions, notes };
}

/**
 * engine 入力へ上流補正を additive に適用する（既存の手入力 strength 補正を上書きしない）。
 */
export function applyUpstreamTeamPriors(
  input: ProbabilityEngineInput,
  adjustments: Pick<UpstreamTeamPriorAdjustments, "homeStrengthDelta" | "awayStrengthDelta">,
): ProbabilityEngineInput {
  return {
    ...input,
    homeStrengthAdjust: (input.homeStrengthAdjust ?? 0) + adjustments.homeStrengthDelta,
    awayStrengthAdjust: (input.awayStrengthAdjust ?? 0) + adjustments.awayStrengthDelta,
  };
}

export type UpstreamAdjustedModel = {
  base: ReturnType<typeof calculateModelProbabilities>;
  adjusted: ReturnType<typeof calculateModelProbabilities>;
  adjustments: UpstreamTeamPriorAdjustments;
};

/**
 * 上流シグナルを反映した「補正前/補正後」のモデル確率を返す（UI 比較表示用）。
 * 既存 engine をそのまま使い、入力に additive 補正をかけた版を併走計算する。
 */
export function calculateModelProbabilitiesWithUpstream(
  input: ProbabilityEngineInput,
  teams: { homeTeam: string; awayTeam: string },
  nodes: readonly MarketNode[],
  options: { baselineChampionProbability?: number; maxAdjust?: number } = {},
): UpstreamAdjustedModel {
  const adjustments = computeUpstreamTeamPriorAdjustments(teams, nodes, options);
  const base = calculateModelProbabilities(input);
  const adjusted = calculateModelProbabilities(applyUpstreamTeamPriors(input, adjustments));
  return { base, adjusted, adjustments };
}
