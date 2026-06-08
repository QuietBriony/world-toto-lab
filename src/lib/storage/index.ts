/**
 * Storage adapter 層の入口。
 *
 * - `resolveStorageMode` : 環境変数 / preference / health から保存モードを決める純関数
 * - `getStorageAdapter`  : モードに対応する StorageAdapter を返す
 * - `readStorageEnv`     : ブラウザに配信される NEXT_PUBLIC_* を読み出す
 *
 * 既存の `data-mode.ts`（demo/local/shared の runtime 判定）は壊さず、こちらは
 * 4モード（local/supabase/cloudflare_d1/demo）の新しい契約として並走する。
 */
import { hasSupabaseEnv } from "@/lib/supabase";

import {
  createLocalStorageAdapter,
  localStorageAdapter,
} from "@/lib/storage/localStorageAdapter";
import {
  createSupabaseAdapter,
  supabaseAdapter,
} from "@/lib/storage/supabaseAdapter";
import {
  createD1ApiAdapter,
  d1ApiAdapter,
} from "@/lib/storage/d1ApiAdapter";
import { isStorageMode, type StorageAdapter, type StorageMode } from "@/lib/storage/types";

export * from "@/lib/storage/types";
export { createLocalStorageAdapter, localStorageAdapter };
export { createSupabaseAdapter, supabaseAdapter };
export { createD1ApiAdapter, d1ApiAdapter };
export type { RepositoryBackend } from "@/lib/storage/repository-bridge";

export type StorageModePreference =
  | "auto"
  | "local"
  | "shared"
  | "supabase"
  | "cloudflare_d1"
  | "demo";

export type ResolveStorageModeInput = {
  /** 明示指定（例: NEXT_PUBLIC_STORAGE_MODE）。最優先。 */
  explicitMode?: string | null;
  /** ユーザーの保存先 preference。 */
  preference?: StorageModePreference | null;
  /** Cloudflare D1 API のベース URL（設定があれば cloudflare_d1 を優先）。 */
  d1ApiBase?: string | null;
  /** Supabase env が揃っているか。 */
  hasSupabaseEnv?: boolean;
  /** Supabase health が ok か。 */
  supabaseHealthy?: boolean;
};

/**
 * 保存モードの判定（純関数）。判定順:
 * 1. 明示指定（env など）
 * 2. preference（demo / local は即確定、cloudflare_d1 / supabase は前提条件付き）
 * 3. auto: D1 API URL があれば cloudflare_d1
 * 4. auto: Supabase env + health OK なら supabase
 * 5. それ以外は local
 */
export function resolveStorageMode(input: ResolveStorageModeInput): StorageMode {
  if (isStorageMode(input.explicitMode)) {
    return input.explicitMode;
  }

  if (input.preference === "demo") {
    return "demo";
  }
  if (input.preference === "local") {
    return "local";
  }
  if (input.preference === "cloudflare_d1") {
    return input.d1ApiBase ? "cloudflare_d1" : "local";
  }
  if (input.preference === "supabase" || input.preference === "shared") {
    return input.hasSupabaseEnv && input.supabaseHealthy ? "supabase" : "local";
  }

  if (input.d1ApiBase) {
    return "cloudflare_d1";
  }
  if (input.hasSupabaseEnv && input.supabaseHealthy) {
    return "supabase";
  }
  return "local";
}

/** モードに対応する StorageAdapter を返す。demo は localStorage を使う。 */
export function getStorageAdapter(mode: StorageMode): StorageAdapter {
  switch (mode) {
    case "cloudflare_d1":
      return d1ApiAdapter;
    case "supabase":
      return supabaseAdapter;
    case "demo":
    case "local":
    default:
      return localStorageAdapter;
  }
}

/** ブラウザへ配信される NEXT_PUBLIC_* を読み出す。 */
export function readStorageEnv() {
  return {
    explicitMode: process.env.NEXT_PUBLIC_STORAGE_MODE ?? null,
    d1ApiBase: process.env.NEXT_PUBLIC_D1_API_BASE ?? null,
    hasSupabaseEnv: hasSupabaseEnv(),
  };
}
