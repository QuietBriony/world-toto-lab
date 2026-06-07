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
  setRuntimeSupabaseHealth,
  setStoredDataModePreference,
} from "@/lib/data-mode";
import {
  checkSupabaseHealth,
  hasSupabaseEnv,
  type SupabaseHealthCheck,
} from "@/lib/supabase";
import { importRoundJson } from "@/lib/repository";
import {
  Badge,
  buttonClassName,
  cx,
  secondaryButtonClassName,
  SectionCard,
} from "@/components/ui";
import type { LocalRoundBundle } from "@/lib/local-repository";

type ImportPreview = {
  bundle: LocalRoundBundle;
  error: string | null;
};

type DataModeContextValue = {
  health: SupabaseHealthCheck | null;
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
  return hasSupabaseEnv() ? "shared" : "local";
}

function modeLabel(mode: DataMode) {
  if (mode === "shared") {
    return "共有保存";
  }

  if (mode === "demo") {
    return "デモ";
  }

  return "ローカル保存";
}

function modeTone(mode: DataMode, health: SupabaseHealthCheck | null) {
  if (mode === "demo") {
    return "warning" as const;
  }

  if (mode === "local") {
    return health?.status === "paused_or_unreachable" ? "amber" as const : "sky" as const;
  }

  return "teal" as const;
}

function healthBadgeLabel(health: SupabaseHealthCheck | null) {
  if (!health) {
    return null;
  }

  if (health.status === "missing_env") {
    return "Supabase未接続";
  }

  if (health.status === "paused_or_unreachable") {
    return "Supabase停止の可能性";
  }

  if (health.status === "schema_mismatch") {
    return "Supabase構成差分";
  }

  if (health.status === "network_error") {
    return "ネットワークエラー";
  }

  if (health.status === "ok") {
    return "Supabase OK";
  }

  return "Supabase状態不明";
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
  const [health, setHealth] = useState<SupabaseHealthCheck | null>(null);
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
      setRuntimeSupabaseHealth(null);
      setHealth(null);
      setIsChecking(false);
      return;
    }

    const storedPreference = getStoredDataModePreference();
    setPreference(storedPreference);

    if (storedPreference === "demo" || storedPreference === "local") {
      setRuntimeDataMode(storedPreference);
      setModeState(storedPreference);
      setRuntimeSupabaseHealth(null);
      setHealth(null);
      setIsChecking(false);
      return;
    }

    const nextHealth = await checkSupabaseHealth();
    setRuntimeSupabaseHealth(nextHealth);
    setHealth(nextHealth);

    if (storedPreference === "shared" && nextHealth.status === "ok") {
      setRuntimeDataMode("shared");
      setModeState("shared");
    } else if (storedPreference === "shared") {
      setRuntimeDataMode("local");
      setModeState("local");
    } else if (nextHealth.status === "ok") {
      setRuntimeDataMode("shared");
      setModeState("shared");
    } else {
      setRuntimeDataMode("local");
      setModeState("local");
    }

    setIsChecking(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void runHealthCheck();
    });
  }, [runHealthCheck]);

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
      health,
      isChecking,
      mode,
      preference,
      reconnect,
      requestJsonImport,
      setMode,
    }),
    [health, isChecking, mode, preference, reconnect, requestJsonImport, setMode],
  );
  const healthLabel = healthBadgeLabel(health);
  const shouldShowConnectionPanel =
    !isChecking &&
    mode !== "shared" &&
    (health?.status === "missing_env" ||
      health?.status === "network_error" ||
      health?.status === "paused_or_unreachable" ||
      health?.status === "schema_mismatch" ||
      health?.status === "unknown");

  return (
    <DataModeContext.Provider value={value}>
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
          <Badge tone={modeTone(mode, health)}>{modeLabel(mode)}</Badge>
          {healthLabel ? <Badge tone={health?.status === "ok" ? "teal" : "amber"}>{healthLabel}</Badge> : null}
        </div>
      </div>

      <div className="fixed left-1/2 top-28 z-[70] w-full max-w-5xl -translate-x-1/2 px-4 sm:px-6 lg:px-8">
        {shouldShowConnectionPanel ? (
          <SectionCard
            className="mb-4"
            title="Supabaseに接続できません。"
            description="プロジェクトがpaused、ネットワークエラー、接続設定不足、または必要テーブル不足の可能性があります。"
            actions={
              <div className="flex flex-wrap gap-2">
                <button type="button" className={buttonClassName} onClick={() => setMode("local")}>
                  ローカル保存で続ける
                </button>
                <button type="button" className={secondaryButtonClassName} onClick={requestJsonImport}>
                  JSONを読み込む
                </button>
                <a
                  href="https://github.com/QuietBriony/world-toto-lab/blob/main/docs/SUPABASE_STATUS.md"
                  target="_blank"
                  rel="noreferrer"
                  className={secondaryButtonClassName}
                >
                  Supabase設定を確認
                </a>
                <button type="button" className={secondaryButtonClassName} onClick={() => void reconnect()}>
                  再接続する
                </button>
              </div>
            }
          >
            <p className="text-sm leading-6 text-slate-700">
              {health?.message ?? "接続状態を確認できませんでした。"}
            </p>
          </SectionCard>
        ) : null}

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
  const { health, isChecking, mode, reconnect, requestJsonImport, setMode } = useDataMode();
  const healthLabel = healthBadgeLabel(health);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={modeTone(mode, health)}>
        {isChecking ? "接続確認中" : modeLabel(mode)}
      </Badge>
      {healthLabel ? <Badge tone={health?.status === "ok" ? "teal" : "amber"}>{healthLabel}</Badge> : null}
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
    </div>
  );
}
