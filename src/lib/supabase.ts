/**
 * Supabase は廃止しました（共有保存は Cloudflare D1、単独は localStorage を使用）。
 *
 * `@supabase/supabase-js` への依存とクライアント生成は削除済み。既存コードのコンパイル維持の
 * ため API サーフェスだけ残す:
 *  - `isSupabaseConfigured()` は false（＝共有保存は D1 に統一）
 *  - `requireSupabaseClient()` は throw（repository.ts の旧 Supabase 分岐は data-mode で
 *    到達しないため実行されない）
 *  - `checkSupabaseHealth()` は missing_env を返す（Supabase は無い）
 *  - `looksLikeSupabaseJwt` / `buildSupabaseFunctionHeaders` は純粋ヘルパーとして残置
 *
 * 旧 Supabase 経路の dead code（`"shared"` モード・各ページの条件・repository.ts 分岐・
 * storage の supabaseAdapter）の完全撤去は後続 PR で行う。
 */

export type SupabaseHealthStatus =
  | "missing_env"
  | "network_error"
  | "ok"
  | "paused_or_unreachable"
  | "schema_mismatch"
  | "unknown";

export type SupabaseHealthCheck = {
  checkedAt: string;
  message: string;
  status: SupabaseHealthStatus;
};

export function looksLikeSupabaseJwt(value: string) {
  const trimmed = value.trim();
  return trimmed.split(".").length === 3;
}

export function buildSupabaseFunctionHeaders(
  publishableKey: string,
  extraHeaders: Record<string, string> = {},
) {
  const headers: Record<string, string> = {
    apikey: publishableKey,
    ...extraHeaders,
  };

  if (looksLikeSupabaseJwt(publishableKey)) {
    headers.Authorization = `Bearer ${publishableKey}`;
  }

  return headers;
}

export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isSupabaseConfigured() {
  // Supabase は廃止。共有保存は Cloudflare D1 に統一。
  return false;
}

export function getSupabaseClient(): null {
  return null;
}

// repository.ts の旧 Supabase 分岐（data-mode により到達しない dead code）が `client.from(...)`
// 等を呼ぶ。その型を満たすため any を返すが、実行時は必ず throw する（呼ばれない想定）。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function requireSupabaseClient(): any {
  throw new Error(
    "Supabase は廃止されました。共有保存は Cloudflare D1、単独作業は localStorage を使用します。",
  );
}

export async function checkSupabaseHealth(): Promise<SupabaseHealthCheck> {
  return {
    checkedAt: new Date().toISOString(),
    message: "Supabase は廃止されました（Cloudflare D1 / localStorage を使用）。",
    status: "missing_env",
  };
}
