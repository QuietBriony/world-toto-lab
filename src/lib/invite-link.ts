/**
 * 共有D1モードの「招待リンク」生成（純粋関数・basePath 非依存）。
 *
 * 現在表示中の絶対URL（origin + basePath + pathname を内包）を土台に、クエリだけを
 * `?round=&edit=[&share=]` へ差し替える。これにより GitHub Pages の basePath
 * （`/world-toto-lab`）も Cloudflare（basePath 無し）も手書きせず継承でき、
 * AGENTS.md の「basePath を無視した手書き URL 禁止 / query param 方式維持」に沿う。
 *
 * adminToken は意図的に含めない（招待された人には編集権のみを渡す）。
 */
export type InviteLinkParams = {
  roundId: string;
  editToken: string;
  shareCode?: string | null;
};

export function buildInviteUrl(
  currentHref: string,
  params: InviteLinkParams,
): string {
  const url = new URL(currentHref);
  url.search = "";
  url.hash = "";
  url.searchParams.set("round", params.roundId);
  url.searchParams.set("edit", params.editToken);
  if (params.shareCode) {
    url.searchParams.set("share", params.shareCode);
  }
  return url.toString();
}
