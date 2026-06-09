"use client";

import { useEffect, useSyncExternalStore } from "react";

const PAGES_DEV_ORIGIN = "https://world-toto-lab.pages.dev";
const LEGACY_HOST = "quietbriony.github.io";

const subscribe = () => () => {};

/**
 * 旧 GitHub Pages（quietbriony.github.io）に来た人を、最新の共有D1版（pages.dev）の
 * 同じパスへ自動リダイレクトする。GitHub Pages の basePath（/world-toto-lab）は外す。
 * pages.dev など他ホストでは null（＝何もしない）。
 */
function getLegacyTarget(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const { hostname, pathname, search, hash } = window.location;
  if (hostname !== LEGACY_HOST) {
    return null;
  }
  const path = pathname.replace(/^\/world-toto-lab/, "") || "/";
  return `${PAGES_DEV_ORIGIN}${path}${search}${hash}`;
}

/**
 * 旧ホスト（github.io）でのみ動く自動リダイレクト。共有された github.io の URL（/hazi 等を
 * 含む全パス）を pages.dev の同じパスへ飛ばす。読み込み中は全画面オーバーレイ＋手動リンクを
 * 出し、JS リダイレクトが効かない場合のフォールバックにする。
 * server snapshot=null なので静的書き出し/hydration では何もしない（pages.dev では非表示）。
 */
export function LegacyHostBanner() {
  const target = useSyncExternalStore(subscribe, getLegacyTarget, () => null);

  useEffect(() => {
    if (target) {
      window.location.replace(target);
    }
  }, [target]);

  if (!target) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-[#081810] px-6 text-center text-emerald-50">
      <p className="text-base font-semibold">
        最新の共有版（pages.dev）へ移動しています…
      </p>
      <a
        href={target}
        className="text-sm font-bold text-amber-300 underline decoration-2 underline-offset-2 hover:text-amber-200"
      >
        自動で移動しない場合はこちら → world-toto-lab.pages.dev
      </a>
    </div>
  );
}
