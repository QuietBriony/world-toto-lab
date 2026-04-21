import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  bigOfficialDefaultSourceUrl,
  parseBigOfficialWatchHtml,
} from "../../../src/lib/big-official.ts";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
};

type SyncRequestBody = {
  sourceUrl?: string;
};

const allowedOfficialHosts = new Set([
  "store.toto-dream.com",
  "sp.toto-dream.com",
]);

function trimText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function extractClientApiKey(req: Request) {
  const apikey = trimText(req.headers.get("apikey"));
  if (apikey) {
    return apikey;
  }

  const authorization = trimText(req.headers.get("authorization"));
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  return trimText(bearerMatch?.[1]);
}

function isAuthorizedClientKey(req: Request) {
  const configuredKeys = [
    Deno.env.get("SB_PUBLISHABLE_KEY"),
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),
    Deno.env.get("SUPABASE_ANON_KEY"),
  ]
    .map((value) => trimText(value))
    .filter(Boolean);

  if (configuredKeys.length === 0) {
    return true;
  }

  const provided = extractClientApiKey(req);
  return Boolean(provided) && configuredKeys.includes(provided);
}

function assertAllowedSourceUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("sourceUrl は https の公式URLだけ利用できます。");
  }

  if (!allowedOfficialHosts.has(url.hostname)) {
    throw new Error(
      `sourceUrl のホスト ${url.hostname} は未対応です。スポーツくじオフィシャルの BIG 情報URLを指定してください。`,
    );
  }

  return url.toString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!isAuthorizedClientKey(req)) {
    return new Response(
      JSON.stringify({
        code: "UNAUTHORIZED_INVALID_CLIENT_KEY",
        message: "Invalid client key",
      }),
      {
        headers: {
          ...corsHeaders,
          "content-type": "application/json",
        },
        status: 401,
      },
    );
  }

  try {
    const body =
      req.method === "POST"
        ? ((await req.json().catch(() => ({}))) as SyncRequestBody)
        : ({} as SyncRequestBody);
    const sourceUrl = assertAllowedSourceUrl(trimText(body.sourceUrl) || bigOfficialDefaultSourceUrl);
    const response = await fetch(sourceUrl, {
      headers: {
        "user-agent": "world-toto-lab big official sync",
      },
    });

    if (!response.ok) {
      throw new Error(`BIG公式ページの取得に失敗しました: ${response.status}`);
    }

    const html = await response.text();
    const payload = parseBigOfficialWatchHtml({
      fetchedAt: new Date().toISOString(),
      html,
      sourceUrl,
    });

    return new Response(JSON.stringify(payload), {
      headers: {
        ...corsHeaders,
        "content-type": "application/json",
      },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        message: error instanceof Error ? error.message : "BIG公式同期に失敗しました。",
      }),
      {
        headers: {
          ...corsHeaders,
          "content-type": "application/json",
        },
        status: 500,
      },
    );
  }
});
