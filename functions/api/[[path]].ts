/**
 * Cloudflare Pages Functions エントリ。
 *
 * `/api/*` をすべて捕捉し、共有の handleApiRequest
 * （[workers/api/src/handler.ts](../../workers/api/src/handler.ts)）へ委譲する。
 *
 * D1 は Cloudflare Pages のプロジェクト設定で `DB` という名前でバインドする
 * （wrangler.toml の database_id は使わない＝実 id を repo に置かない）。
 * 詳細手順: docs/CLOUDFLARE_D1_MIGRATION.md
 */
import { handleApiRequest, type Env } from "../../workers/api/src/handler";

export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  return handleApiRequest(context.request, context.env);
}
