import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null | undefined;

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
  return true;
}

export function getSupabaseClient() {
  if (!hasSupabaseEnv()) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    );
  }

  return supabaseClient;
}

export function requireSupabaseClient() {
  const client = getSupabaseClient();

  if (!client) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return client;
}

function healthResult(status: SupabaseHealthStatus, message: string): SupabaseHealthCheck {
  return {
    checkedAt: new Date().toISOString(),
    message,
    status,
  };
}

function stringFromUnknown(value: unknown) {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "Unknown Supabase error";
  }
}

function classifySupabaseError(error: unknown): SupabaseHealthCheck {
  const message = stringFromUnknown(error);
  const normalized = message.toLowerCase();
  const statusValue =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : null;
  const codeValue =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("load failed") ||
    normalized.includes("fetch failed")
  ) {
    return healthResult(
      "network_error",
      "Supabaseへのネットワーク接続に失敗しました。",
    );
  }

  if (
    statusValue === 401 ||
    statusValue === 403 ||
    normalized.includes("permission denied") ||
    normalized.includes("row-level security") ||
    normalized.includes("rls") ||
    normalized.includes("jwt") ||
    normalized.includes("invalid api key") ||
    normalized.includes("invalid key") ||
    normalized.includes("unauthorized")
  ) {
    return healthResult(
      "unknown",
      "Supabaseには到達しましたが、公開キーまたは権限設定を確認してください。",
    );
  }

  if (
    normalized.includes("schema cache") ||
    normalized.includes("could not find the table") ||
    normalized.includes("does not exist") ||
    normalized.includes("not in the schema cache") ||
    codeValue === "PGRST205" ||
    codeValue === "42P01"
  ) {
    return healthResult(
      "schema_mismatch",
      "Supabaseには接続できましたが、必要なテーブル構成が一致していません。",
    );
  }

  if (
    normalized.includes("paused") ||
    normalized.includes("unreachable") ||
    normalized.includes("project is inactive") ||
    statusValue === 502 ||
    statusValue === 503 ||
    statusValue === 504 ||
    statusValue === 520 ||
    statusValue === 522
  ) {
    return healthResult(
      "paused_or_unreachable",
      "Supabaseプロジェクトがpaused、または一時的に到達できない可能性があります。",
    );
  }

  return healthResult("unknown", message || "Supabaseの状態を判定できませんでした。");
}

export async function checkSupabaseHealth(): Promise<SupabaseHealthCheck> {
  if (!hasSupabaseEnv()) {
    return healthResult(
      "missing_env",
      "NEXT_PUBLIC_SUPABASE_URL または NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません。",
    );
  }

  try {
    const supabase = requireSupabaseClient();
    const result = await supabase
      .from("rounds")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (result.error) {
      return classifySupabaseError(result.error);
    }

    return healthResult("ok", "Supabaseに接続できます。");
  } catch (error) {
    return classifySupabaseError(error);
  }
}
