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
  // cloudflare_d1 では、D1 配線済みの関数は repository 内で isCloudflareD1Mode() により
  // 先に短絡される。ここで true を返すのは「D1 未配線の関数（fixture master / official
  // library / sync 等）を Supabase ではなく安全に local へ落とす」ため。
  if (
    runtimeDataMode === "demo" ||
    runtimeDataMode === "local" ||
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
