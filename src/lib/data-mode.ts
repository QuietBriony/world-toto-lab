import type { SupabaseHealthCheck } from "@/lib/supabase";

export type DataMode = "demo" | "local" | "shared" | "cloudflare_d1";
export type DataModePreference = "auto" | DataMode;

export const dataModePreferenceKey = "world-toto-lab:v1:dataMode";

let runtimeDataMode: DataMode = "local";
let runtimeHealth: SupabaseHealthCheck | null = null;

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getStoredDataModePreference(): DataModePreference {
  if (!canUseBrowserStorage()) {
    return "auto";
  }

  const stored = window.localStorage.getItem(dataModePreferenceKey);
  return stored === "shared" ||
    stored === "local" ||
    stored === "demo" ||
    stored === "cloudflare_d1" ||
    stored === "auto"
    ? stored
    : "auto";
}

export function setStoredDataModePreference(preference: DataModePreference) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(dataModePreferenceKey, preference);
}

export function setRuntimeDataMode(mode: DataMode) {
  runtimeDataMode = mode;
}

export function getRuntimeDataMode() {
  return runtimeDataMode;
}

export function setRuntimeSupabaseHealth(health: SupabaseHealthCheck | null) {
  runtimeHealth = health;
}

export function getRuntimeSupabaseHealth() {
  return runtimeHealth;
}

export function shouldUseLocalRepository() {
  // Supabase は廃止。共有保存は Cloudflare D1（isCloudflareD1Mode で先に短絡）。
  // 残りの全モード（demo / local / shared / cloudflare_d1 の D1 未配線関数）は local へ落とす。
  // これにより repository.ts の旧 Supabase 分岐には到達しない（dead code）。
  if (
    runtimeDataMode === "demo" ||
    runtimeDataMode === "local" ||
    runtimeDataMode === "shared" ||
    runtimeDataMode === "cloudflare_d1"
  ) {
    return true;
  }

  return runtimeHealth !== null && runtimeHealth.status !== "ok";
}

export function isDemoDataMode() {
  return runtimeDataMode === "demo";
}

export function isCloudflareD1Mode() {
  return runtimeDataMode === "cloudflare_d1";
}
