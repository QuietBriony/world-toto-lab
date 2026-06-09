/**
 * Storage adapter 層の入口。
 *
 * - `resolveStorageMode` : 環境変数 / preference / D1 API URL から保存モードを決める純関数
 * - `getStorageAdapter`  : モードに対応する StorageAdapter を返す
 * - `readStorageEnv`     : ブラウザに配信される NEXT_PUBLIC_* を読み出す
 *
 * 既存の `data-mode.ts`（demo/local/cloudflare_d1 の runtime 判定）は壊さず、こちらは
 * 3モード（local/cloudflare_d1/demo）の契約として並走する。
 */
import {
  createLocalStorageAdapter,
  localStorageAdapter,
} from "@/lib/storage/localStorageAdapter";
import {
  createD1ApiAdapter,
  d1ApiAdapter,
} from "@/lib/storage/d1ApiAdapter";
import { isStorageMode, type StorageAdapter, type StorageMode } from "@/lib/storage/types";

export * from "@/lib/storage/types";
export { createLocalStorageAdapter, localStorageAdapter };
export { createD1ApiAdapter, d1ApiAdapter };
export type { RepositoryBackend } from "@/lib/storage/repository-bridge";

export type StorageModePreference =
  | "auto"
  | "local"
  | "cloudflare_d1"
  | "demo";

export type ResolveStorageModeInput = {
  /** 明示指定（例: NEXT_PUBLIC_STORAGE_MODE）。最優先。 */
  explicitMode?: string | null;
  /** ユーザーの保存先 preference。 */
  preference?: StorageModePreference | null;
  /** Cloudflare D1 API のベース URL（設定があれば cloudflare_d1 を優先）。 */
  d1ApiBase?: string | null;
};

/**
 * 保存モードの判定（純関数）。判定順:
 * 1. 明示指定（env など）
 * 2. preference（demo / local は即確定、cloudflare_d1 は前提条件付き）
 * 3. auto: D1 API URL があれば cloudflare_d1
 * 4. それ以外は local
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

  if (input.d1ApiBase) {
    return "cloudflare_d1";
  }
  return "local";
}

/** 保存モードの日本語ラベル（Data Mode Badge / Settings 表示用）。 */
export function getStorageModeLabel(mode: StorageMode): string {
  switch (mode) {
    case "cloudflare_d1":
      return "Cloudflare共有保存";
    case "demo":
      return "デモ";
    case "local":
    default:
      return "ローカル保存";
  }
}

/** モードに対応する StorageAdapter を返す。demo は localStorage を使う。 */
export function getStorageAdapter(mode: StorageMode): StorageAdapter {
  switch (mode) {
    case "cloudflare_d1":
      return d1ApiAdapter;
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
  };
}
