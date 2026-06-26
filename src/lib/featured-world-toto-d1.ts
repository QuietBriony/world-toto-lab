/**
 * featured W杯（第1634〜1637回）を「共有D1」に作るためのヘルパー。
 *
 * ローカル専用の `saveTotoOfficialRoundImport` は D1 未配線なので、
 * cloudflare_d1 では配線済みの facade（`createRound` / `bulkUpdateRoundMatches`）と
 * 純粋関数 `calculateModelProbabilities` を使って、ローカルと同じ内容を共有D1へ作成する。
 * （`estimateRoundAiModel` 自体は D1 配線済みだが、ここは作成と同時に全フィールドを
 *   埋めるため、placeholder ベースで一括構築する。）
 *
 * - 試合は `placeholderMatches` で全フィールドを埋め、公式票/チーム/kickoff を上書き。
 * - モデル確率は local の AI 推定（localEstimateRoundAiModel）と同じ呼び方で算出。
 * - cloudflare_d1 モードでのみ呼ぶ前提（facade が D1 へルーティングする）。
 */
import {
  buildFeaturedWorldTotoImportPayload,
} from "@/lib/featured-world-toto";
import { placeholderMatches } from "@/lib/local-repository";
import { calculateModelProbabilities } from "@/lib/probability/engine";
import { bulkUpdateRoundMatches, createRound } from "@/lib/repository-d1";
import { worldCupMarketSignalByMatchNo } from "@/lib/world-cup-toto-review-plan";
import { modelSeed } from "@/lib/world-toto-strength";
import type { Match, TotoOfficialRoundLibraryMatch } from "@/lib/types";

type FeaturedWorldTotoPayload = ReturnType<typeof buildFeaturedWorldTotoImportPayload>;

function recommendedOutcomesFrom(
  modelProb1: number,
  modelProb0: number,
  modelProb2: number,
) {
  return [modelProb1, modelProb0, modelProb2]
    .map((value, index) => ({ index, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 2)
    .map((entry) => (entry.index === 0 ? "1" : entry.index === 1 ? "0" : "2"))
    .join(",");
}

/**
 * featured 公式試合行 → 共有D1へ保存できる完全な Match[]。
 * placeholderMatches で全フィールドを埋め、公式情報を上書きし、モデル確率を付与する。
 */
export function buildFeaturedWorldTotoMatchRows(
  roundId: string,
  rows: TotoOfficialRoundLibraryMatch[],
  officialRoundNumber?: number,
): Match[] {
  // 市場(Polymarket)シグナルがある回（現状 1637）は matchNo→{公衆票, 市場確率} を取得。
  // 無い回は空 Map ＝従来どおり国別強度シードのみ。
  const marketSignals = worldCupMarketSignalByMatchNo(officialRoundNumber ?? -1);
  const bases = placeholderMatches(roundId, rows.length);
  return rows.map((row, index) => {
    const signal = marketSignals.get(row.officialMatchNo);
    const merged: Match = {
      ...bases[index],
      actualResult: row.actualResult,
      awayTeam: row.awayTeam,
      fixtureMasterId: row.fixtureMasterId,
      homeTeam: row.homeTeam,
      kickoffTime: row.kickoffTime,
      officialMatchNo: row.officialMatchNo,
      // 市場シグナルがあれば公衆票を上書き（featured 1637 は scheduledMatch で票 null のため）。
      officialVote0: signal?.officialVote0 ?? row.officialVote0,
      officialVote1: signal?.officialVote1 ?? row.officialVote1,
      officialVote2: signal?.officialVote2 ?? row.officialVote2,
      stage: row.stage,
      venue: row.venue,
    };

    // モデル土台: 実市場(Polymarket)があればそれを採用。無ければ国別強度シード
    // （/hazi 軽量版と同じ最適ロジック）。engine は marketProb を base にするので、
    // 市場を渡すだけで「公衆過信の本命」を自動で割り引いたモデルになる。
    const seed = modelSeed({
      awayTeam: merged.awayTeam,
      homeTeam: merged.homeTeam,
      officialVote0: merged.officialVote0,
      officialVote1: merged.officialVote1,
      officialVote2: merged.officialVote2,
    });
    const estimated = calculateModelProbabilities({
      ...merged,
      marketProb0: signal?.marketProb0 ?? seed.marketProb0,
      marketProb1: signal?.marketProb1 ?? seed.marketProb1,
      marketProb2: signal?.marketProb2 ?? seed.marketProb2,
      competitionType: "world_cup",
      dataProfile: "manual_light",
    });

    return {
      ...merged,
      // 実市場(Polymarket)のみ marketProb 列に保存（強度シードは synthetic なので保存しない）。
      marketProb0: signal?.marketProb0 ?? merged.marketProb0,
      marketProb1: signal?.marketProb1 ?? merged.marketProb1,
      marketProb2: signal?.marketProb2 ?? merged.marketProb2,
      modelProb0: estimated.modelProb0,
      modelProb1: estimated.modelProb1,
      modelProb2: estimated.modelProb2,
      recommendedOutcomes: recommendedOutcomesFrom(
        estimated.modelProb1,
        estimated.modelProb0,
        estimated.modelProb2,
      ),
    };
  });
}

function buildRoundInput(
  payload: FeaturedWorldTotoPayload,
  participantIds?: string[],
): Parameters<typeof createRound>[0] {
  return {
    budgetYen: null,
    competitionType: "world_cup",
    dataProfile: "worldcup_rich",
    matchCount: payload.rows.length,
    notes: payload.notes,
    outcomeSetJson: ["1", "0", "2"],
    participantIds: participantIds ?? [],
    productType: payload.productType,
    requiredMatchCount: payload.requiredMatchCount ?? payload.rows.length,
    roundSource: "toto_official_manual",
    sourceNote: payload.sourceNote ?? payload.officialRoundName,
    status: payload.status,
    title: payload.title,
    voidHandling: "manual",
  };
}

/**
 * featured W杯ラウンドを共有D1に作成（既存があれば再利用）し roundId を返す。
 * cloudflare_d1 モードでのみ呼ぶこと（facade が D1 へ短絡する）。
 */
export async function createFeaturedWorldTotoRoundInD1(input: {
  payload: FeaturedWorldTotoPayload;
  participantIds?: string[];
  existingRoundId?: string | null;
}): Promise<{ matches: Match[]; roundId: string }> {
  const roundId =
    input.existingRoundId ??
    (await createRound(buildRoundInput(input.payload, input.participantIds)));

  const matches = await bulkUpdateRoundMatches({
    roundId,
    rows: buildFeaturedWorldTotoMatchRows(
      roundId,
      input.payload.rows,
      input.payload.officialRoundNumber,
    ),
  });

  return { matches, roundId };
}
