export type DataMode = "demo" | "local" | "cloudflare_d1";
export type DataModePreference = "auto" | DataMode;

export const dataModePreferenceKey = "world-toto-lab:v1:dataMode";

let runtimeDataMode: DataMode = "local";

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getStoredDataModePreference(): DataModePreference {
  if (!canUseBrowserStorage()) {
    return "auto";
  }

  const stored = window.localStorage.getItem(dataModePreferenceKey);
  return stored === "local" ||
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

export function shouldUseLocalRepository() {
  // Supabase は廃止。共有保存は Cloudflare D1（D1 配線済み関数は repository 内で
  // isCloudflareD1Mode() により先に短絡）。残りの全モード（demo / local / cloudflare_d1 の
  // D1 未配線関数）は local へ落とす。
  return (
    runtimeDataMode === "demo" ||
    runtimeDataMode === "local" ||
    runtimeDataMode === "cloudflare_d1"
  );
}

export function isDemoDataMode() {
  return runtimeDataMode === "demo";
}

export function isCloudflareD1Mode() {
  return runtimeDataMode === "cloudflare_d1";
}
