/**
 * localStorage 保存先の StorageAdapter 実装。
 *
 * 既存の `src/lib/local-repository.ts`（常にブラウザ localStorage を読み書きする層）へ
 * 委譲する薄いラッパ。Supabase / D1 が無くてもアプリが動く fallback を担う。
 */
import * as local from "@/lib/local-repository";

import {
  createRepositoryAdapter,
  type RepositoryBackend,
} from "@/lib/storage/repository-bridge";
import type { StorageAdapter, StorageHealth } from "@/lib/storage/types";

const localBackend: RepositoryBackend = {
  listRounds: async () => (await local.localListDashboardData()).rounds,
  getWorkspaceRound: async (roundId) =>
    (await local.localGetRoundWorkspace(roundId))?.round ?? null,
  createRound: (input) => local.localCreateRound(input),
  updateRound: (input) => local.localUpdateRound(input),
  deleteRound: (roundId) => local.localDeleteRound(roundId),
  bulkUpdateMatches: (input) => local.localBulkUpdateRoundMatches(input),
  replacePicks: (input) => local.localReplacePicks(input),
  replaceScoutReports: (input) => local.localReplaceScoutReports(input),
  replaceCandidateTickets: (input) => local.localReplaceCandidateTickets(input),
  upsertCandidateVote: (input) => local.localUpsertCandidateVote(input),
  addReviewNote: (input) => local.localAddReviewNote(input),
  exportBundle: async (roundId) => {
    const workspace = await local.localGetRoundWorkspace(roundId);
    if (!workspace) {
      throw new Error(`Round が見つかりません: ${roundId}`);
    }
    return local.buildLocalRoundBundle(workspace, "local");
  },
  importBundle: (bundle, strategy) =>
    local.localImportRoundBundle(bundle, strategy),
};

async function localHealth(): Promise<StorageHealth> {
  const available =
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined";

  return {
    status: available ? "ok" : "missing_config",
    message: available
      ? "ブラウザのローカル保存が利用できます。"
      : "ブラウザ環境ではないため localStorage は使用できません。",
    checkedAt: new Date().toISOString(),
  };
}

export function createLocalStorageAdapter(): StorageAdapter {
  return createRepositoryAdapter("local", localBackend, localHealth);
}

export const localStorageAdapter = createLocalStorageAdapter();
