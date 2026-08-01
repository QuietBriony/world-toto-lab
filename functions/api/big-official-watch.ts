/**
 * BIG 公式くじ情報ページのサーバサイド取得（Cloudflare Pages Functions）。
 *
 * ブラウザから `store.toto-dream.com` を直接 fetch すると CORS で落ちるため、
 * 同一オリジンのこの関数がサーバ側で取得し、解析済み snapshot を JSON で返す。
 * D1 には触らない（公式ページの公開情報を読むだけの read-only エンドポイント）。
 *
 * 取得先は `bigOfficialDefaultSourceUrl` 固定。リクエストで URL を差し替えさせない
 * （任意 URL を踏ませる踏み台にしないため）。
 *
 * 公式ページは「5分毎に最新情報を表示」と明記しているので、上流 fetch も
 * レスポンスも 300 秒キャッシュする。
 *
 * `/api/*` の catch-all は [[path]].ts だが、Pages Functions は具体的な
 * ファイル名のルートを優先するため、このパスだけここで処理される。
 */
import {
  bigOfficialDefaultSourceUrl,
  parseBigOfficialWatchHtml,
} from "../../src/lib/big-official";

const cacheSeconds = 300;

function jsonResponse(body: unknown, status: number, cacheControl: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
    },
  });
}

export async function onRequestGet(): Promise<Response> {
  let upstream: Response;

  try {
    upstream = await fetch(bigOfficialDefaultSourceUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ja",
        "User-Agent": "world-toto-lab/1.0 (BIG official watch; +https://world-toto-lab.pages.dev)",
      },
      cf: {
        cacheEverything: true,
        cacheTtl: cacheSeconds,
      },
    } as RequestInit);
  } catch (error) {
    return jsonResponse(
      {
        error: `BIG公式ページへ接続できませんでした: ${
          error instanceof Error ? error.message : String(error)
        }`,
        sourceUrl: bigOfficialDefaultSourceUrl,
      },
      502,
      "no-store",
    );
  }

  if (!upstream.ok) {
    return jsonResponse(
      {
        error: `BIG公式ページが ${upstream.status} を返しました。`,
        sourceUrl: bigOfficialDefaultSourceUrl,
      },
      502,
      "no-store",
    );
  }

  const html = await upstream.text();
  const payload = parseBigOfficialWatchHtml({
    fetchedAt: new Date().toISOString(),
    html,
    sourceUrl: bigOfficialDefaultSourceUrl,
  });

  if (payload.snapshots.length === 0) {
    // ページ構造が変わった可能性。0件を成功として長くキャッシュしない。
    return jsonResponse(payload, 200, "no-store");
  }

  return jsonResponse(payload, 200, `public, max-age=${cacheSeconds}`);
}
