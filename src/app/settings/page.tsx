"use client";

import { useCallback, useEffect, useState } from "react";

import { useDataMode } from "@/components/app/data-mode-provider";
import {
  Badge,
  PageHeader,
  SectionCard,
  buttonClassName,
  cx,
  fieldClassName,
  secondaryButtonClassName,
} from "@/components/ui";
import {
  d1ApiAdapter,
  getStorageAdapter,
  getStorageModeLabel,
  localStorageAdapter,
  readStorageEnv,
  resolveStorageMode,
  type StorageHealth,
} from "@/lib/storage";
import type { Round } from "@/lib/types";

type StatusTone = "teal" | "amber" | "slate";

function toneForStorageHealth(status: StorageHealth["status"] | undefined): StatusTone {
  if (status === "ok") {
    return "teal";
  }
  if (status === "unreachable" || status === "error") {
    return "amber";
  }
  return "slate";
}

function StatusRow({
  label,
  badge,
  tone,
  detail,
  checkedAt,
}: {
  label: string;
  badge: string;
  tone: StatusTone;
  detail: string;
  checkedAt?: string | null;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/82 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p>
        {checkedAt ? (
          <p className="mt-1 text-xs text-slate-400">最終確認: {checkedAt}</p>
        ) : null}
      </div>
      <Badge tone={tone}>{badge}</Badge>
    </div>
  );
}

export default function SettingsPage() {
  const {
    isChecking,
    mode,
    reconnect,
    requestJsonImport,
  } = useDataMode();
  const env = readStorageEnv();
  // 共有D1本番では runtime mode==='cloudflare_d1' を尊重して D1 アダプタを使う。
  // explicitMode は渡さない（provider が health で local に落とした判断を上書きしないため）。
  const storageMode = resolveStorageMode({ preference: mode, d1ApiBase: env.d1ApiBase });

  const [d1Health, setD1Health] = useState<StorageHealth | null>(null);
  const [localHealth, setLocalHealth] = useState<StorageHealth | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void localStorageAdapter.health().then(setLocalHealth);
    if (env.d1ApiBase) {
      void d1ApiAdapter.health().then(setD1Health);
    }
  }, [env.d1ApiBase]);

  const loadRounds = useCallback(async () => {
    try {
      const adapter = getStorageAdapter(storageMode);
      const list = await adapter.getRounds();
      setRounds(list);
      setSelectedRoundId((previous) => previous || list[0]?.id || "");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "ラウンド一覧を取得できませんでした。",
      );
    }
  }, [storageMode]);

  useEffect(() => {
    if (isChecking) {
      return;
    }
    queueMicrotask(() => {
      void loadRounds();
    });
  }, [isChecking, loadRounds]);

  const handleExport = async () => {
    if (!selectedRoundId) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const adapter = getStorageAdapter(storageMode);
      const bundle = await adapter.exportRoundBundle(selectedRoundId);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${bundle.round.title || "world-toto-round"}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage("Round の JSON を書き出しました。");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "JSON export に失敗しました。",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Settings"
        title="保存ステータス"
        description="現在の保存先・各バックエンドの接続状態・JSON 移行をまとめて確認できます。"
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClassName}
              onClick={() => void reconnect()}
            >
              再接続する
            </button>
          </div>
        }
      />

      <SectionCard
        title="現在の保存先"
        description="アプリが実際に読み書きしている保存先です。"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={mode === "demo" ? "warning" : "sky"}>
            {isChecking ? "接続確認中" : getStorageModeLabel(storageMode)}
          </Badge>
          <p className="text-sm leading-6 text-slate-600">
            {mode === "demo"
              ? "デモデータを表示中です（変更は保存されません）。"
              : "この端末のローカル保存に保存しています。"}
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="バックエンド接続状態"
        description="各保存先の health チェック結果。"
      >
        <div className="grid gap-3">
          <StatusRow
            label="ローカル保存 (localStorage)"
            badge={localHealth?.status === "ok" ? "利用可" : "確認中"}
            tone={toneForStorageHealth(localHealth?.status)}
            detail={
              localHealth?.message ?? "ブラウザのローカル保存を確認しています。"
            }
            checkedAt={localHealth?.checkedAt}
          />
          <StatusRow
            label="Cloudflare共有保存 (D1 API)"
            badge={
              !env.d1ApiBase
                ? "未設定"
                : d1Health?.status === "ok"
                  ? "接続OK"
                  : d1Health
                    ? "未接続"
                    : "確認中"
            }
            tone={!env.d1ApiBase ? "slate" : toneForStorageHealth(d1Health?.status)}
            detail={
              env.d1ApiBase
                ? (d1Health?.message ?? "Cloudflare D1 API を確認しています。")
                : "NEXT_PUBLIC_D1_API_BASE が未設定です。Cloudflare D1 を使うには Worker をデプロイして設定してください。"
            }
            checkedAt={d1Health?.checkedAt}
          />
        </div>
        {!env.d1ApiBase ? (
          <p className="text-xs leading-6 text-slate-500">
            手順は docs/CLOUDFLARE_D1_MIGRATION.md を参照してください。Cloudflare D1
            API が落ちている場合も、アプリはローカル保存で継続します。
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        title="JSON エクスポート / インポート"
        description="Round 単位の JSON で、保存先間（ローカル ↔ Cloudflare D1）を移行できます。"
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={requestJsonImport}
            >
              JSON を読み込む
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              書き出す Round
            </span>
            <select
              className={cx(fieldClassName, "appearance-none")}
              value={selectedRoundId}
              onChange={(event) => setSelectedRoundId(event.target.value)}
              disabled={rounds.length === 0}
            >
              {rounds.length === 0 ? (
                <option value="">（保存済みの Round がありません）</option>
              ) : (
                rounds.map((round) => (
                  <option key={round.id} value={round.id}>
                    {round.title}
                  </option>
                ))
              )}
            </select>
          </label>
          <button
            type="button"
            className={buttonClassName}
            onClick={() => void handleExport()}
            disabled={busy || !selectedRoundId}
          >
            JSON を書き出す
          </button>
        </div>
        {message ? (
          <p
            className={cx(
              "rounded-2xl border px-4 py-3 text-sm",
              message.includes("失敗") || message.includes("できません")
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-950",
            )}
          >
            {message}
          </p>
        ) : null}
      </SectionCard>
    </div>
  );
}
