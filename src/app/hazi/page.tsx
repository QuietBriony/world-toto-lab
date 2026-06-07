"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  setupHaziLiteState,
  updateHaziLitePick,
  type HaziLiteRound,
  type HaziLiteSummary,
} from "@/lib/hazi-lite-local";

type SetupStatus = "idle" | "ready" | "working" | "error";

function formatKickoff(value: string | null) {
  if (!value) {
    return "日時未設定";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    weekday: "short",
  }).format(new Date(value));
}

function formatProb(value: number | null) {
  if (value === null) {
    return "--";
  }

  return `${Math.round(value * 100)}%`;
}

function outcomeLabel(value: "1" | "0" | "2") {
  if (value === "1") {
    return "1";
  }

  return value === "0" ? "0" : "2";
}

function outcomeSubLabel(value: "1" | "0" | "2") {
  if (value === "1") {
    return "ホーム";
  }

  return value === "0" ? "ドロー" : "アウェイ";
}

function pickButtonClass(active: boolean, value: "1" | "0" | "2") {
  const activeColor =
    value === "0"
      ? "border-blue-500 bg-blue-600 text-white"
      : value === "1"
        ? "border-emerald-500 bg-emerald-600 text-white"
        : "border-amber-500 bg-amber-500 text-slate-950";

  return [
    "flex h-14 min-w-0 flex-1 flex-col items-center justify-center rounded-xl border px-2 text-center shadow-sm",
    active
      ? activeColor
      : "border-slate-200 bg-white text-slate-800 active:bg-slate-100",
  ].join(" ");
}

function findActiveRound(summary: HaziLiteSummary | null, selectedRoundNumber: number) {
  return (
    summary?.rounds.find((round) => round.roundNumber === selectedRoundNumber) ??
    summary?.rounds[0] ??
    null
  );
}

export default function HaziLitePage() {
  const [summary, setSummary] = useState<HaziLiteSummary | null>(null);
  const [selectedRoundNumber, setSelectedRoundNumber] = useState(1634);
  const [status, setStatus] = useState<SetupStatus>("working");
  const [error, setError] = useState<string | null>(null);

  const activeRound = useMemo(
    () => findActiveRound(summary, selectedRoundNumber),
    [selectedRoundNumber, summary],
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      try {
        const nextSummary = setupHaziLiteState();
        if (cancelled) {
          return;
        }
        setSummary(nextSummary);
        setSelectedRoundNumber(nextSummary.rounds[0]?.roundNumber ?? 1634);
        setStatus("ready");
        setError(null);
      } catch (nextError) {
        if (cancelled) {
          return;
        }
        setStatus("error");
        setError(nextError instanceof Error ? nextError.message : "準備に失敗しました。");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleReset = () => {
    try {
      setStatus("working");
      const nextSummary = setupHaziLiteState({ force: true });
      setSummary(nextSummary);
      setSelectedRoundNumber(nextSummary.rounds[0]?.roundNumber ?? 1634);
      setStatus("ready");
      setError(null);
    } catch (nextError) {
      setStatus("error");
      setError(nextError instanceof Error ? nextError.message : "準備に失敗しました。");
    }
  };

  const handlePick = (round: HaziLiteRound, matchId: string, pick: "1" | "0" | "2") => {
    const nextSummary = updateHaziLitePick({
      matchId,
      pick,
      roundId: round.roundId,
    });
    setSummary(nextSummary);
  };

  const fullReviewHref =
    activeRound && summary?.haziUserId
      ? `/review/?round=${activeRound.roundId}&user=${summary.haziUserId}`
      : "/review/";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-6 text-slate-950">
      <section className="rounded-2xl border border-emerald-200 bg-white px-4 py-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            Hazi専用
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            スマホ軽量
          </span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            ブラウザ保存
          </span>
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight">Hazi予想</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          開いた時点で第1634〜1637回を軽量セットに整えます。Haziの予想はこのスマホのブラウザに保存されます。
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-xs font-semibold text-slate-500">回</div>
            <div className="mt-1 text-xl font-bold">{summary?.rounds.length ?? 0}/4</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-xs font-semibold text-slate-500">試合</div>
            <div className="mt-1 text-xl font-bold">{summary?.totalMatches ?? 0}/52</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-xs font-semibold text-slate-500">予想</div>
            <div className="mt-1 text-xl font-bold">{summary?.totalPicks ?? 0}/52</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={status === "working"}
            className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-55"
          >
            {status === "working" ? "整え中..." : "軽量状態に整え直す"}
          </button>
          <Link
            href={fullReviewHref}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800"
          >
            フルレビューへ
          </Link>
        </div>
        {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      </section>

      <nav className="grid grid-cols-4 gap-2">
        {(summary?.rounds ?? []).map((round) => (
          <button
            key={round.roundId}
            type="button"
            onClick={() => setSelectedRoundNumber(round.roundNumber)}
            className={[
              "rounded-xl border px-2 py-3 text-center text-sm font-bold",
              activeRound?.roundNumber === round.roundNumber
                ? "border-emerald-500 bg-emerald-600 text-white"
                : "border-slate-200 bg-white text-slate-800",
            ].join(" ")}
          >
            第{round.roundNumber}
          </button>
        ))}
      </nav>

      {activeRound ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-4">
            <h3 className="text-lg font-bold">{activeRound.title}</h3>
            <p className="mt-1 text-sm text-slate-600">
              {activeRound.pickCount}/{activeRound.matchCount} 予想済み
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {activeRound.matches.map((match) => (
              <article key={match.matchId} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-500">
                      No.{match.officialMatchNo ?? match.matchNo} / {formatKickoff(match.kickoffTime)}
                    </div>
                    <h4 className="mt-1 text-base font-bold leading-6 text-slate-950">
                      {match.homeTeam} vs {match.awayTeam}
                    </h4>
                  </div>
                  <div className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    AI {match.aiPick}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                  <div>1 {formatProb(match.modelProb1)}</div>
                  <div>0 {formatProb(match.modelProb0)}</div>
                  <div>2 {formatProb(match.modelProb2)}</div>
                </div>
                <div className="mt-3 flex gap-2">
                  {(["1", "0", "2"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handlePick(activeRound, match.matchId, value)}
                      className={pickButtonClass(match.haziPick === value, value)}
                    >
                      <span className="text-lg font-black leading-5">{outcomeLabel(value)}</span>
                      <span className="mt-0.5 text-[10px] font-semibold leading-3 opacity-80">
                        {outcomeSubLabel(value)}
                      </span>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600">
          Haziセットを準備しています。
        </section>
      )}
    </div>
  );
}
