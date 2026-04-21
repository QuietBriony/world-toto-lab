import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null | undefined;

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

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
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
