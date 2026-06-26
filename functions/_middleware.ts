/**
 * Cloudflare Pages サイト全体の簡易 Basic 認証（共有あいことば）ミドルウェア。
 *
 * 思想:
 * - 合言葉は **Cloudflare Pages の環境変数 `SITE_PASSWORD`（Secret 推奨）** に入れる。
 *   コード/Git には合言葉を置かない（実 token を repo に置かない placeholder 運用と同じ）。
 * - `SITE_PASSWORD` が未設定なら **ゲートしない**（fail-open）。設定ミスで全員ロックアウトを
 *   避けるため。＝この PR をデプロイしただけでは鍵は掛からない。ダッシュボードで
 *   `SITE_PASSWORD` を入れて再デプロイした時点で有効化される。
 * - ユーザー名は任意。`SITE_USERNAME` を設定した時だけ照合する。友達は「合言葉だけ」でよい。
 * - `/api/*` を含む全リクエストを gate する（認証済みブラウザは Authorization を同一オリジンへ
 *   自動送信するので、ログイン後はアプリの D1 読み書きもそのまま動く）。共有D1データも保護される。
 *
 * 有効化/解除（Cloudflare ダッシュボード・コード変更なし）:
 *   Pages → world-toto-lab → Settings → Environment variables → Production に
 *   `SITE_PASSWORD` を「Secret」で追加 → Deployments で再デプロイ。解除は変数を消して再デプロイ。
 *
 * 注意: これは「野次馬・無関係アクセス除け」レベルの共有パスワード。1つ漏れると全員入れる。
 *   他サービスと使い回さず、このサイト専用の合言葉にすること。GitHub Pages 版(github.io)は
 *   Functions が無いので非ゲート（ただし localStorage のみで共有D1データは持たない）。
 */

type MiddlewareEnv = {
  SITE_PASSWORD?: string;
  SITE_USERNAME?: string;
};

// 長さと内容を比較（早期 return での僅かなタイミング差を避ける軽い定数時間風比較）。
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

function unauthorized(): Response {
  return new Response("このサイトは合言葉が必要です。", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="World Toto Lab", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function onRequest(context: {
  request: Request;
  env: MiddlewareEnv;
  next: () => Promise<Response>;
}): Promise<Response> {
  const expectedPassword = context.env.SITE_PASSWORD;

  // 合言葉が未設定なら素通し（fail-open）。
  if (!expectedPassword) {
    return context.next();
  }

  const header = context.request.headers.get("Authorization") ?? "";
  if (header.startsWith("Basic ")) {
    let decoded = "";
    try {
      decoded = atob(header.slice("Basic ".length).trim());
    } catch {
      return unauthorized();
    }
    const separator = decoded.indexOf(":");
    const username = separator >= 0 ? decoded.slice(0, separator) : "";
    const password = separator >= 0 ? decoded.slice(separator + 1) : decoded;

    const passwordOk = safeEqual(password, expectedPassword);
    const usernameOk = !context.env.SITE_USERNAME || username === context.env.SITE_USERNAME;
    if (passwordOk && usernameOk) {
      return context.next();
    }
  }

  return unauthorized();
}
