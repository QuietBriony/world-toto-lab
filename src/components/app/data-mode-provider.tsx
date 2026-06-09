"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  DataMode,
  DataModePreference,
  getStoredDataModePreference,
  setRuntimeDataMode,
  setStoredDataModePreference,
} from "@/lib/data-mode";
import { importRoundJson } from "@/lib/repository";
import { d1ApiAdapter, storeRoundTokens } from "@/lib/storage/d1ApiAdapter";
import { LegacyHostBanner } from "@/components/app/legacy-host-banner";
import Link from "next/link";

import {
  Badge,
  buttonClassName,
  cx,
  secondaryButtonClassName,
  SectionCard,
} from "@/components/ui";
import { appRoute } from "@/lib/round-links";
import type { LocalRoundBundle } from "@/lib/local-repository";

type ImportPreview = {
  bundle: LocalRoundBundle;
  error: string | null;
};

type DataModeContextValue = {
  isChecking: boolean;
  mode: DataMode;
  preference: DataModePreference;
  reconnect: () => Promise<void>;
  requestJsonImport: () => void;
  setMode: (mode: DataMode) => void;
};

const DataModeContext = createContext<DataModeContextValue | null>(null);

function initialMode(): DataMode {
  // Keep the first client render identical to the static HTML. The stored
  // preference is applied by runHealthCheck immediately after hydration.
  // Supabase は廃止。共有保存は Cloudflare D1（runHealthCheck で env/preference により解決）。
  return "local";
}

function modeLabel(mode: DataMode) {
  if (mode === "cloudflare_d1") {
    return "Cloudflare共有保存";
  }

  if (mode === "demo") {
    return "デモ";
  }

  return "ローカル保存";
}

function modeTone(mode: DataMode) {
  if (mode === "demo") {
    return "warning" as const;
  }

  if (mode === "local") {
    return "sky" as const;
  }

  return "teal" as const;
}

function normalizeBundle(raw: unknown): LocalRoundBundle {
  if (!raw || typeof raw !== "object") {
    throw new Error("JSON形式が正しくありません。");
  }

  const candidate = raw as Partial<LocalRoundBundle>;
  if (!candidate.round || !Array.isArray(candidate.matches)) {
    throw new Error("Round export JSON ではありません。");
  }

  return {
    candidateTickets: Array.isArray(candidate.candidateTickets) ? candidate.candidateTickets : [],
    candidateVotes: Array.isArray(candidate.candidateVotes) ? candidate.candidateVotes : [],
    generatedTickets: Array.isArray(candidate.generatedTickets) ? candidate.generatedTickets : [],
    matches: candidate.matches,
    metadata: candidate.metadata ?? {
      appVersion: "unknown",
      dataMode: "local",
      exportedAt: new Date().toISOString(),
    },
    picks: Array.isArray(candidate.picks) ? candidate.picks : [],
    researchMemos: Array.isArray(candidate.researchMemos) ? candidate.researchMemos : [],
    reviewNotes: Array.isArray(candidate.reviewNotes) ? candidate.reviewNotes : [],
    round: candidate.round,
    roundEvAssumption: candidate.roundEvAssumption ?? null,
    scoutReports: Array.isArray(candidate.scoutReports) ? candidate.scoutReports : [],
    totoOfficialMatches: Array.isArray(candidate.totoOfficialMatches) ? candidate.totoOfficialMatches : [],
    totoOfficialRound: candidate.totoOfficialRound ?? null,
    users: Array.isArray(candidate.users) ? candidate.users : [],
  };
}

export function DataModeProvider({ children }: { children: ReactNode }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setModeState] = useState<DataMode>(initialMode);
  const [preference, setPreference] = useState<DataModePreference>("auto");
  const [isChecking, setIsChecking] = useState(true);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const setMode = useCallback((nextMode: DataMode) => {
    setRuntimeDataMode(nextMode);
    setStoredDataModePreference(nextMode);
    setPreference(nextMode);
    setModeState(nextMode);
  }, []);

  const runHealthCheck = useCallback(async () => {
    setIsChecking(true);
    if (typeof window !== "undefined" && /\/hazi\/?$/.test(window.location.pathname)) {
      setRuntimeDataMode("local");
      setStoredDataModePreference("local");
      setPreference("local");
      setModeState("local");
      setIsChecking(false);
      return;
    }

    const storedPreference = getStoredDataModePreference();
    setPreference(storedPreference);

    if (storedPreference === "demo" || storedPreference === "local") {
      setRuntimeDataMode(storedPreference);
      setModeState(storedPreference);
      setIsChecking(false);
      return;
    }

    // Cloudflare D1: NEXT_PUBLIC_D1_API_BASE が設定され、env または preference が
    // cloudflare_d1 を望むとき。接続できれば D1、落ちていれば local で継続。
    const d1Base = process.env.NEXT_PUBLIC_D1_API_BASE;
    const wantsD1 =
      storedPreference === "cloudflare_d1" ||
      (storedPreference === "auto" &&
        process.env.NEXT_PUBLIC_STORAGE_MODE === "cloudflare_d1");
    if (wantsD1 && d1Base) {
      const d1Health = await d1ApiAdapter.health();
      if (d1Health.status === "ok") {
        setRuntimeDataMode("cloudflare_d1");
        setModeState("cloudflare_d1");
      } else {
        setRuntimeDataMode("local");
        setModeState("local");
      }
      setIsChecking(false);
      return;
    }

    // Supabase は廃止。共有保存は Cloudflare D1（上の wantsD1 分岐で解決済み）。
    // ここに到達した時点で D1 ではない＝local に確定する。
    setRuntimeDataMode("local");
    setModeState("local");

    setIsChecking(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void runHealthCheck();
    });
  }, [runHealthCheck]);

  // 共有リンク（?round=<id>&edit=<token>[&admin=<token>][&share=<code>]）から
  // D1 の書き込みトークンを取り込む。これで作成者以外の友人もそのラウンドを編集できる。
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const roundId = params.get("round");
    const editToken = params.get("edit");
    if (roundId && editToken) {
      storeRoundTokens(roundId, {
        shareCode: params.get("share") ?? "",
        editToken,
        adminToken: params.get("admin") ?? undefined,
      });
    }
  }, []);

  const reconnect = useCallback(async () => {
    setStoredDataModePreference("auto");
    await runHealthCheck();
  }, [runHealthCheck]);

  const requestJsonImport = useCallback(() => {
    setImportMessage(null);
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = normalizeBundle(JSON.parse(text));
      setImportPreview({ bundle: parsed, error: null });
    } catch (error) {
      setImportPreview({
        bundle: null as unknown as LocalRoundBundle,
        error: error instanceof Error ? error.message : "JSONを読み込めませんでした。",
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleImport = async (strategy: "copy" | "overwrite") => {
    if (!importPreview?.bundle || importPreview.error) {
      return;
    }

    setImporting(true);
    setImportMessage(null);

    try {
      if (mode === "demo") {
        setMode("local");
      }
      const roundId = await importRoundJson(importPreview.bundle, strategy);
      setImportPreview(null);
      setImportMessage(
        mode === "demo"
          ? `ローカル保存モードに切り替えてJSONを取り込みました。Round ID: ${roundId}`
          : `JSONを取り込みました。Round ID: ${roundId}`,
      );
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "JSON import に失敗しました。");
    } finally {
      setImporting(false);
    }
  };

  const value = useMemo<DataModeContextValue>(
    () => ({
      isChecking,
      mode,
      preference,
      reconnect,
      requestJsonImport,
      setMode,
    }),
    [isChecking, mode, preference, reconnect, requestJsonImport, setMode],
  );

  return (
    <DataModeContext.Provider value={value}>
      <LegacyHostBanner />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => void handleFileChange(event.currentTarget.files?.[0] ?? null)}
      />

      {children}

      <div className="fixed bottom-4 right-4 z-[80] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
        <div className="flex flex-wrap justify-end gap-2 rounded-full border border-white/20 bg-slate-950/82 px-3 py-2 shadow-[0_18px_60px_-30px_rgba(0,0,0,0.7)] backdrop-blur-xl">
          <Badge tone={modeTone(mode)}>{modeLabel(mode)}</Badge>
        </div>
      </div>

      <div className="fixed left-1/2 top-28 z-[70] w-full max-w-5xl -translate-x-1/2 px-4 sm:px-6 lg:px-8">
        {importPreview ? (
          <SectionCard
            className="mb-4"
            title={importPreview.error ? "JSON import エラー" : "JSON import preview"}
            description={
              importPreview.error
                ? importPreview.error
                : `${importPreview.bundle.round.title} / ${importPreview.bundle.matches.length}試合 / ${importPreview.bundle.picks.length}予想`
            }
            actions={
              importPreview.error ? (
                <button type="button" className={secondaryButtonClassName} onClick={() => setImportPreview(null)}>
                  閉じる
                </button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={buttonClassName}
                    disabled={importing}
                    onClick={() => void handleImport("copy")}
                  >
                    別Roundとして取り込み
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    disabled={importing}
                    onClick={() => void handleImport("overwrite")}
                  >
                    上書きで取り込み
                  </button>
                  <button type="button" className={secondaryButtonClassName} onClick={() => setImportPreview(null)}>
                    キャンセル
                  </button>
                </div>
              )
            }
          >
            {importPreview.error ? null : (
              <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white/82 p-3">
                  exportedAt: {importPreview.bundle.metadata.exportedAt}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/82 p-3">
                  mode: {importPreview.bundle.metadata.dataMode}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/82 p-3">
                  Scout: {importPreview.bundle.scoutReports.length}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/82 p-3">
                  Candidate: {importPreview.bundle.candidateTickets.length}
                </div>
              </div>
            )}
          </SectionCard>
        ) : null}

        {importMessage ? (
          <div
            className={cx(
              "mb-4 rounded-[24px] border px-5 py-4 text-sm shadow-[0_18px_42px_-34px_rgba(15,23,42,0.28)]",
              importMessage.includes("失敗") || importMessage.includes("でき")
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-950",
            )}
          >
            {importMessage}
          </div>
        ) : null}
      </div>
    </DataModeContext.Provider>
  );
}

export function useDataMode() {
  const value = useContext(DataModeContext);
  if (!value) {
    throw new Error("useDataMode must be used within DataModeProvider.");
  }

  return value;
}

export function DataModeBadge() {
  const { isChecking, mode, reconnect, requestJsonImport, setMode } = useDataMode();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={modeTone(mode)}>
        {isChecking ? "接続確認中" : modeLabel(mode)}
      </Badge>
      <button type="button" className={secondaryButtonClassName} onClick={() => setMode("local")}>
        ローカル
      </button>
      <button type="button" className={secondaryButtonClassName} onClick={() => setMode("demo")}>
        デモ
      </button>
      <button type="button" className={secondaryButtonClassName} onClick={requestJsonImport}>
        JSON
      </button>
      <button type="button" className={secondaryButtonClassName} onClick={() => void reconnect()}>
        再接続
      </button>
      <Link href={appRoute.settings} className={secondaryButtonClassName}>
        設定
      </Link>
    </div>
  );
}
