"use client";

import { useSyncExternalStore } from "react";

const PAGES_DEV_ORIGIN = "https://world-toto-lab.pages.dev";
const LEGACY_HOST = "quietbriony.github.io";

const subscribe = () => () => {};

/**
 * 旧 GitHub Pages（quietbriony.github.io）に来た人を、最新の共有D1版（pages.dev）の
 * 同じパスへ誘導する。GitHub Pages の basePath（/world-toto-lab）は外す。
 * pages.dev など他ホストでは null（＝何も出さない）。
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
 * 旧ホスト（github.io）でのみ表示する誘導バナー。
 * server snapshot=null なので静的書き出し/hydration では何も描かない（pages.dev では非表示）。
 */
export function LegacyHostBanner() {
  const target = useSyncExternalStore(subscribe, getLegacyTarget, () => null);

  if (!target) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[90] border-b border-amber-300/50 bg-amber-400/95 px-4 py-2 text-center text-sm font-semibold text-amber-950 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.6)] backdrop-blur">
      <span>これは旧版（この端末だけの保存）です。みんなで同じデータを見る最新の共有版は </span>
      <a
        href={target}
        className="font-bold underline decoration-2 underline-offset-2 hover:text-amber-900"
      >
        world-toto-lab.pages.dev で開く →
      </a>
    </div>
  );
}
