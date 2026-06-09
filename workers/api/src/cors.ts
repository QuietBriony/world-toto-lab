/**
 * CORS ヘルパー（Cloudflare 型に依存しない純粋ロジック。単体テスト対象）。
 *
 * GitHub Pages / Cloudflare Pages preview / localhost からのアクセスを許可する。
 * 本番ではワイルドカード（`*`）を返さない。許可 origin のみ反射する。
 */
const DEFAULT_ALLOWED_ORIGINS = [
  "https://quietbriony.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

/** 環境変数 ALLOWED_ORIGINS（カンマ区切り）→ 許可リスト。未設定なら既定値。 */
export function parseAllowedOrigins(raw?: string | null): string[] {
  const configured = (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configured.length > 0 ? configured : [...DEFAULT_ALLOWED_ORIGINS];
}

/** Cloudflare Pages の preview/production ドメイン（`*.pages.dev`）かどうか。 */
function isPagesDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname.endsWith(".pages.dev");
  } catch {
    return false;
  }
}

export function isOriginAllowed(
  origin: string | null,
  allowed: string[],
): boolean {
  if (!origin) {
    return false;
  }
  if (allowed.includes(origin)) {
    return true;
  }
  return isPagesDevOrigin(origin);
}

/**
 * リクエストの Origin に応じた CORS ヘッダを返す。
 * 許可 origin のときだけ `Access-Control-Allow-Origin` をセットする（ワイルドカード不使用）。
 */
export function corsHeaders(
  origin: string | null,
  allowed: string[],
): Record<string, string> {
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type,X-Share-Code,X-Edit-Token,X-Admin-Token",
    "Access-Control-Max-Age": "86400",
  };

  if (origin && isOriginAllowed(origin, allowed)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}
