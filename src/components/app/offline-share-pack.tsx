"use client";

import { useState } from "react";

import { useDataMode } from "@/components/app/data-mode-provider";
import {
  Badge,
  buttonClassName,
  SectionCard,
  secondaryButtonClassName,
} from "@/components/ui";
import { exportRoundJson } from "@/lib/repository";

type StatusTone = "danger" | "info" | "teal";

type OfflineSharePackProps = {
  roundId: string;
  roundTitle: string;
};

function modeLabel(mode: "demo" | "local" | "cloudflare_d1") {
  if (mode === "cloudflare_d1") {
    return "Cloudflare共有保存";
  }

  if (mode === "demo") {
    return "デモ";
  }

  return "ローカル保存";
}

function buildJsonFilename(title: string) {
  const safeTitle = title.replace(/[\\/:*?"<>|]+/g, "-").trim();
  return `${safeTitle || "world-toto-round"}.json`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function writeTextToClipboard(text: string) {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back for mobile/webview browsers that expose clipboard but deny it.
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
    throw new Error("このブラウザではURLコピーを使えません。");
  }
}

export function OfflineSharePack({ roundId, roundTitle }: OfflineSharePackProps) {
  const dataMode = useDataMode();
  const [busy, setBusy] = useState<"copy" | "export" | null>(null);
  const [status, setStatus] = useState<{ text: string; tone: StatusTone } | null>(null);

  const handleExportJson = async () => {
    setBusy("export");
    setStatus(null);

    try {
      const bundle = await exportRoundJson(roundId);
      const json = JSON.stringify(bundle, null, 2);
      const filename = buildJsonFilename(bundle.round.title || roundTitle);
      const blob = new Blob([json], { type: "application/json" });
      const file = new File([blob], filename, { type: "application/json" });
      const shareNavigator = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
        share?: (data: ShareData) => Promise<void>;
      };

      if (shareNavigator.canShare?.({ files: [file] }) && shareNavigator.share) {
        try {
          await shareNavigator.share({
            files: [file],
            text: "World Toto Lab のラウンドJSONです。",
            title: bundle.round.title,
          });
          setStatus({ text: "JSONを共有しました。受け手はJSON読込で同じラウンドを開けます。", tone: "teal" });
          return;
        } catch {
          // If native share is unavailable or canceled inside a webview, save instead.
        }
      }

      downloadBlob(blob, filename);
      setStatus({ text: "JSONを書き出しました。スマホへ送れば同じラウンドを配れます。", tone: "teal" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "JSONを書き出せませんでした。";
      setStatus({ text: message, tone: "danger" });
    } finally {
      setBusy(null);
    }
  };

  const handleCopyUrl = async () => {
    setBusy("copy");
    setStatus(null);

    try {
      await writeTextToClipboard(window.location.href);
      setStatus({ text: "画面URLをコピーしました。JSONと一緒に送ると開きやすくなります。", tone: "info" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "URLをコピーできませんでした。";
      setStatus({ text: message, tone: "danger" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <SectionCard
      title="スマホ共有パック"
      description="URLとJSONで同じラウンドを配れます。リアルタイム同期ではなく、JSONを回して集約します。"
      actions={
        <div className="flex flex-wrap gap-2">
          <Badge tone="teal">オフライン共有</Badge>
          <Badge tone="info">スマホOK</Badge>
          <Badge tone="slate">{modeLabel(dataMode.mode)}</Badge>
        </div>
      }
    >
      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["1", "代表者", "JSON共有/保存でラウンド本体を配る"],
          ["2", "参加者", "JSON読込で同じ状態から予想する"],
          ["3", "返送", "編集後にJSON共有/保存、またはスクショで戻す"],
          ["4", "集約", "代表者が上書き取込して票とコメントを見る"],
        ].map(([step, title, body]) => (
          <div key={step} className="rounded-[22px] border border-slate-200 bg-white/88 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700/70">
              Step {step}
            </p>
            <h3 className="mt-2 text-sm font-semibold text-slate-950">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-[22px] border border-slate-200 bg-slate-50/90 px-4 py-4">
        <button
          type="button"
          onClick={() => void handleExportJson()}
          disabled={busy === "export"}
          className={buttonClassName}
        >
          {busy === "export" ? "書き出し中..." : "JSON共有/保存"}
        </button>
        <button type="button" onClick={dataMode.requestJsonImport} className={secondaryButtonClassName}>
          JSON読込
        </button>
        <button
          type="button"
          onClick={() => void handleCopyUrl()}
          disabled={busy === "copy"}
          className={secondaryButtonClassName}
        >
          {busy === "copy" ? "コピー中..." : "URLコピー"}
        </button>
        <Badge tone="amber">手動同期</Badge>
      </div>

      {status ? (
        <div
          className={
            status.tone === "danger"
              ? "rounded-[22px] border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm leading-6 text-rose-950"
              : status.tone === "teal"
                ? "rounded-[22px] border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm leading-6 text-emerald-950"
                : "rounded-[22px] border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm leading-6 text-sky-950"
          }
        >
          {status.text}
        </div>
      ) : null}
    </SectionCard>
  );
}
