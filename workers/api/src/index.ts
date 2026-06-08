/**
 * Cloudflare Worker エントリ。
 *
 * 実体は共有の handleApiRequest（[handler.ts](./handler.ts)）。
 * Cloudflare Pages Functions 版は [functions/api/[[path]].ts](../../../functions/api/) を参照。
 */
import { handleApiRequest, type Env } from "./handler";

export type { Env };

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleApiRequest(request, env);
  },
};
