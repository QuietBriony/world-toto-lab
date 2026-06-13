"use client";

import { useCallback, useSyncExternalStore } from "react";

import { useDataMode } from "@/components/app/data-mode-provider";
import { getStoredRoundTokens } from "@/lib/storage/d1ApiAdapter";

// localStorage のラウンドトークンは client 専用の外部値。ページ滞在中に変わる
// 導線は無いので購読は no-op（useSyncExternalStore の server snapshot=false=不可扱い）。
const subscribe = () => () => {};

/** 閲覧専用端末が共有D1へ書き込もうとしたときの案内文（各ページ共通）。 */
export const READ_ONLY_ROUND_MESSAGE =
  "この端末は閲覧専用です。編集には作成者の招待リンク（編集権限）が必要です。";

/**
 * 現在のラウンドをこの端末が編集（共有D1 への書き込み）できるかを SSR 安全に返す。
 *
 * - local / demo モード: 常に true（localStorage は自端末のもので常に編集可）。
 * - cloudflare_d1 モード: 当該ラウンドの editToken または adminToken を保持していれば true。
 *   閲覧専用端末（招待リンク未受領）では false になり、Worker が 403 を返す書き込みを
 *   事前に抑止して案内できる。
 *
 * サーバ/初回 hydration では false（書き込み不可扱い）を返し、effect 内同期 setState を避ける。
 */
export function useCanEditRound(roundId: string | null): boolean {
  const dataMode = useDataMode();
  const getSnapshot = useCallback(() => {
    if (dataMode.mode !== "cloudflare_d1") {
      return true;
    }
    if (!roundId) {
      return false;
    }
    const tokens = getStoredRoundTokens(roundId);
    return Boolean(tokens?.editToken || tokens?.adminToken);
  }, [dataMode.mode, roundId]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
