/**
 * Supabase 保存先の StorageAdapter 実装。
 *
 * 既存の `src/lib/repository.ts`（Supabase 対応の facade）へ委譲する薄いラッパ。
 *
 * 注意: `repository.ts` は health 不良時に localStorage へ自動フォールバックする
 * 既存挙動を持つ。そのため通常運用（mode=supabase, health=ok）では Supabase を叩くが、
 * Supabase 停止時は localStorage で継続する。これは意図したレジリエンス挙動。
 * 完全な per-adapter 分離（自動フォールバックの除去）は後続フェーズで行う。
 */
import * as repo from "@/lib/repository";
import { checkSupabaseHealth, hasSupabaseEnv } from "@/lib/supabase";

import {
  createRepositoryAdapter,
  type RepositoryBackend,
} from "@/lib/storage/repository-bridge";
import type { StorageAdapter, StorageHealth } from "@/lib/storage/types";

const supabaseBackend: RepositoryBackend = {
  listRounds: async () => (await repo.listDashboardData()).rounds,
  getWorkspaceRound: async (roundId) =>
    (await repo.getRoundWorkspace(roundId))?.round ?? null,
  createRound: (input) => repo.createRound(input),
  updateRound: (input) => repo.updateRound(input),
  deleteRound: (roundId) => repo.deleteRound(roundId),
  bulkUpdateMatches: (input) => repo.bulkUpdateRoundMatches(input),
  replacePicks: (input) => repo.replacePicks(input),
  replaceScoutReports: (input) => repo.replaceScoutReports(input),
  replaceCandidateTickets: (input) => repo.replaceCandidateTickets(input),
  upsertCandidateVote: (input) => repo.upsertCandidateVote(input),
  addReviewNote: (input) => repo.addReviewNote(input),
  exportBundle: (roundId) => repo.exportRoundJson(roundId),
  importBundle: (bundle, strategy) => repo.importRoundJson(bundle, strategy),
};

async function supabaseHealth(): Promise<StorageHealth> {
  if (!hasSupabaseEnv()) {
    return {
      status: "missing_config",
      message: "Supabase の環境変数が設定されていません。",
      checkedAt: new Date().toISOString(),
    };
  }

  const health = await checkSupabaseHealth();
  const status: StorageHealth["status"] =
    health.status === "ok"
      ? "ok"
      : health.status === "missing_env"
        ? "missing_config"
        : health.status === "network_error" ||
            health.status === "paused_or_unreachable"
          ? "unreachable"
          : "error";

  return {
    status,
    message: health.message,
    checkedAt: health.checkedAt,
  };
}

export function createSupabaseAdapter(): StorageAdapter {
  return createRepositoryAdapter("supabase", supabaseBackend, supabaseHealth);
}

export const supabaseAdapter = createSupabaseAdapter();
