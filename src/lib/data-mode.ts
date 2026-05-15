import type { SupabaseHealthCheck } from "@/lib/supabase";

export type DataMode = "demo" | "local" | "shared";
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
  return stored === "shared" || stored === "local" || stored === "demo" || stored === "auto"
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
  if (runtimeDataMode === "demo" || runtimeDataMode === "local") {
    return true;
  }

  return runtimeHealth !== null && runtimeHealth.status !== "ok";
}

export function isDemoDataMode() {
  return runtimeDataMode === "demo";
}
