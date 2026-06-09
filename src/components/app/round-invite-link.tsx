"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import { useDataMode } from "@/components/app/data-mode-provider";
import { Badge, buttonClassName, SectionCard } from "@/components/ui";
import { buildInviteUrl } from "@/lib/invite-link";
import { getStoredRoundTokens } from "@/lib/storage/d1ApiAdapter";

type StatusTone = "danger" | "teal";

type RoundInviteLinkProps = {
  roundId: string;
};

// 招待リンクは localStorage のトークンと window.location に依存する client 専用の値。
// useSyncExternalStore でサーバスナップショット=null とし、SSR/静的書き出しでは
// 何も描かず、hydration 後に client で導出する（effect 内同期 setState を避ける）。
const subscribe = () => () => {};

async function copyText(text: string) {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // モバイル/WebView で clipboard はあるが拒否される場合のフォールバック。
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.left = "-9999px";
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("このブラウザではリンクのコピーを使えません。");
  }
}

/**
 * 共有D1（cloudflare_d1）モードで、現在のラウンドの「編集できる招待リンク」を
 * 生成・コピーする。リンクは現在URLを土台に query を差し替えるため basePath 安全。
 * editToken を持つ端末（＝作成者 or 既に招待された人）でのみ表示する。
 */
export function RoundInviteLink({ roundId }: RoundInviteLinkProps) {
  const dataMode = useDataMode();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; tone: StatusTone } | null>(
    null,
  );

  const getInviteUrl = useCallback(() => {
    if (dataMode.mode !== "cloudflare_d1") {
      return null;
    }
    const tokens = getStoredRoundTokens(roundId);
    if (!tokens?.editToken) {
      return null;
    }
    return buildInviteUrl(window.location.href, {
      roundId,
      editToken: tokens.editToken,
      shareCode: tokens.shareCode,
    });
  }, [dataMode.mode, roundId]);

  const inviteUrl = useSyncExternalStore(subscribe, getInviteUrl, () => null);

  if (!inviteUrl) {
    return null;
  }

  const handleCopy = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await copyText(inviteUrl);
      setStatus({
        text: "編集リンクをコピーしました。友達に送ると、開くだけで編集に参加できます。",
        tone: "teal",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "リンクをコピーできませんでした。";
      setStatus({ text: message, tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title="共有リンク（編集できる招待）"
      description="このリンクを送ると、相手は開くだけで同じラウンドを共有D1で編集できます。管理用トークンは含めず、編集権だけを渡します。"
      actions={
        <div className="flex flex-wrap gap-2">
          <Badge tone="teal">共有D1</Badge>
          <Badge tone="info">リンクで参加</Badge>
        </div>
      }
    >
      <div className="flex flex-col gap-3 rounded-[22px] border border-slate-200 bg-slate-50/90 px-4 py-4">
        <input
          type="text"
          readOnly
          value={inviteUrl}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="招待リンク"
          className="w-full rounded-[16px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleCopy()}
            disabled={busy}
            className={buttonClassName}
          >
            {busy ? "コピー中..." : "編集リンクをコピー"}
          </button>
          <Badge tone="amber">リンクを知る人は編集できます</Badge>
        </div>
      </div>

      {status ? (
        <div
          className={
            status.tone === "danger"
              ? "rounded-[22px] border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm leading-6 text-rose-950"
              : "rounded-[22px] border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm leading-6 text-emerald-950"
          }
        >
          {status.text}
        </div>
      ) : null}
    </SectionCard>
  );
}
