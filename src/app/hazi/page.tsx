"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  applyHaziLiteAiPicks,
  applyHaziLiteStrategyPicks,
  setupHaziLiteState,
  updateHaziLitePick,
  type HaziLiteRound,
  type HaziLiteStrategy,
  type HaziLiteStrategyKind,
  type HaziLiteSummary,
} from "@/lib/hazi-lite-local";
import { HaziSharedD1View } from "@/components/app/hazi-shared-d1-view";

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

function formatSmallPercent(value: number | null) {
  if (value === null) {
    return "--";
  }

  const percent = value * 100;
  if (percent === 0) {
    return "0%";
  }

  if (percent < 0.001) {
    return `${percent.toFixed(5)}%`;
  }

  if (percent < 0.1) {
    return `${percent.toFixed(3)}%`;
  }

  if (percent < 1) {
    return `${percent.toFixed(2)}%`;
  }

  return `${percent.toFixed(1)}%`;
}

function formatYen(value: number | null) {
  if (value === null) {
    return "--";
  }

  return new Intl.NumberFormat("ja-JP", {
    currency: "JPY",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatMultiple(value: number | null) {
  if (value === null) {
    return "Proxy";
  }

  return `${value.toFixed(2)}x`;
}

function portfolioPlanClass(tone: "balanced" | "conservative" | "upside") {
  const toneClass =
    tone === "balanced"
      ? "border-emerald-300 bg-emerald-50"
      : tone === "upside"
        ? "border-amber-300 bg-amber-50"
        : "border-slate-200 bg-slate-50";

  return ["rounded-xl border px-3 py-3", toneClass].join(" ");
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

function countStrategyPicks(round: HaziLiteRound, strategy: HaziLiteStrategyKind) {
  return round.matches.reduce(
    (counts, match) => ({
      ...counts,
      [match[strategy].pick]: counts[match[strategy].pick] + 1,
    }),
    { "0": 0, "1": 0, "2": 0 },
  );
}

function strategyCardClass(active: boolean, tone: "emerald" | "amber") {
  const activeClass =
    tone === "emerald"
      ? "border-emerald-500 bg-emerald-50 text-emerald-950"
      : "border-amber-500 bg-amber-50 text-amber-950";

  return [
    "min-w-0 rounded-xl border px-2 py-2 text-left shadow-sm active:scale-[0.99]",
    active ? activeClass : "border-slate-200 bg-white text-slate-800 active:bg-slate-50",
  ].join(" ");
}

function StrategyCard({
  active,
  onClick,
  strategy,
  title,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  strategy: HaziLiteStrategy;
  title: string;
  tone: "emerald" | "amber";
}) {
  return (
    <button type="button" onClick={onClick} className={strategyCardClass(active, tone)}>
      <div className="flex min-w-0 items-center justify-between gap-1">
        <span className="truncate text-[11px] font-bold">{title}</span>
        <span className="shrink-0 rounded-full bg-white/75 px-1.5 py-0.5 text-[10px] font-semibold">
          {strategy.badge}
        </span>
      </div>
      <div className="mt-1 text-2xl font-black leading-none">{strategy.pick}</div>
      <div className="mt-1 truncate text-[11px] font-semibold opacity-80">{strategy.score}</div>
    </button>
  );
}

export default function HaziPage() {
  // 共有D1デプロイ（NEXT_PUBLIC_STORAGE_MODE=cloudflare_d1）ではみんなで見る共有版を、
  // それ以外（localhost 等）は従来の個人ローカル軽量版を出す。env はビルド時定数なので
  // この分岐は描画間で変わらず、フック規則にも触れない（HaziLitePage 側のフックは常に揃う）。
  if (process.env.NEXT_PUBLIC_STORAGE_MODE === "cloudflare_d1") {
    return <HaziSharedD1View />;
  }
  return <HaziLitePage />;
}

function HaziLitePage() {
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

  const handleApplyAi = (roundId?: string | null) => {
    const nextSummary = applyHaziLiteAiPicks({ roundId });
    setSummary(nextSummary);
  };

  const handleApplyStrategy = (strategy: HaziLiteStrategyKind, roundId?: string | null) => {
    const nextSummary = applyHaziLiteStrategyPicks({ roundId, strategy });
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
          {summary ? (
            <>
              <button
                type="button"
                onClick={() => handleApplyStrategy("orthodox", null)}
                className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
              >
                王道を全反映
              </button>
              <button
                type="button"
                onClick={() => handleApplyStrategy("value", null)}
                className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950"
              >
                期待値を全反映
              </button>
            </>
          ) : null}
          {summary && summary.reviewChangeCount > 0 ? (
            <button
              type="button"
              onClick={() => handleApplyAi(null)}
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
            >
              AI修正を全反映
            </button>
          ) : null}
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
        {summary && summary.reviewChangeCount > 0 ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold leading-6 text-amber-800">
            AI修正案が {summary.reviewChangeCount} 件あります。下の一覧で確認してから反映できます。
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      </section>

      {summary ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold">予想ロジック一覧</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                王道は公式人気/強度本命。期待値は公式人気との差分、未公表回はProxyから各回最大4スポットだけ外します。
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {summary.aiVersion}
            </span>
          </div>
          <div className="mt-3 grid gap-2">
            {summary.rounds.map((round) => {
              const orthodoxCounts = countStrategyPicks(round, "orthodox");
              const valueCounts = countStrategyPicks(round, "value");
              return (
                <button
                  key={round.roundId}
                  type="button"
                  onClick={() => setSelectedRoundNumber(round.roundNumber)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left"
                >
                  <div>
                    <div className="text-sm font-bold">第{round.roundNumber}回</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">
                      王道 1:{orthodoxCounts["1"]} / 0:{orthodoxCounts["0"]} / 2:
                      {orthodoxCounts["2"]}
                      <br />
                      期待値 1:{valueCounts["1"]} / 0:{valueCounts["0"]} / 2:
                      {valueCounts["2"]}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900">
                      差分 {round.reviewChangeCount}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">開いて確認</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

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
        <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold">買い方メモ</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                公式購入は各自。ここでは1口{formatYen(activeRound.portfolio.stakeYen)}
                の比較メモとして、口数と期待値の見え方だけ整理します。
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                払戻率 {formatProb(activeRound.portfolio.returnRate)}
              </span>
              <span
                className={[
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  activeRound.portfolio.dataQuality === "strict"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800",
                ].join(" ")}
              >
                {activeRound.portfolio.dataQuality === "strict" ? "EV推定" : "EV Proxy"}
              </span>
            </div>
          </div>
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
            {activeRound.portfolio.summary}
          </p>
          <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <span className="font-bold text-slate-900">公式人気</span>
              <br />
              王道の本命と、各等級の他当せん者数・払戻推定の分母に使います。
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <span className="font-bold text-slate-900">モデル確率</span>
              <br />
              公式人気、国別強度、軽量補正をつないだ的中側の見立てです。
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <span className="font-bold text-slate-900">期待値</span>
              <br />
              EV = モデル的中率 x 推定払戻 ÷ 1口。1〜3等込みで見ます。
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <span className="font-bold text-slate-900">等級</span>
              <br />
              1等は13/13、2等は12/13、3等は11/13。前後賞はありません。
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {activeRound.portfolio.plans.map((plan) => (
              <div key={plan.label} className={portfolioPlanClass(plan.tone)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-bold">{plan.label}</div>
                  {plan.label === "標準" ? (
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      基本
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 text-2xl font-black leading-none">
                  {plan.lineCount}口
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-700">
                  {formatYen(plan.costYen)} / 1等カバー {formatSmallPercent(plan.hitProbability)}
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-700">
                  {plan.strictEvReady
                    ? `1〜3等EV ${formatYen(plan.expectedReturnYen)} / ${formatMultiple(plan.evMultiple)}`
                    : `期待値 ${formatMultiple(plan.evMultiple)}`}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">{plan.description}</p>
                <p className="mt-2 text-[11px] font-semibold leading-4 text-slate-500">
                  {plan.lineLabels.join(" + ")}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2">
            {activeRound.portfolio.lines.map((line) => (
              <div
                key={line.key}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-900">
                    {line.label}
                    {line.duplicateOf ? (
                      <span className="ml-2 font-semibold text-slate-500">
                        {line.duplicateOf}と同じ
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-slate-500">
                    王道外し {line.deviationCount} / 1等 {formatSmallPercent(line.hitProbability)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {line.prizeTiers
                      .map((tier) => `${tier.label} ${formatSmallPercent(tier.hitProbability)}`)
                      .join(" / ")}
                  </div>
                </div>
                <div className="shrink-0 text-right font-semibold text-slate-700">
                  <div>{line.totalEvMultiple !== null ? formatMultiple(line.totalEvMultiple) : "Proxy"}</div>
                  <div className="mt-0.5 text-slate-500">
                    1等払戻 {line.estimatedPayoutYen ? formatYen(line.estimatedPayoutYen) : "--"}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-slate-500">
            期待値は的中や利益を保証しません。購入代行、資金プール、配当分配、精算はこのアプリでは扱いません。
          </p>
        </section>
      ) : null}

      {activeRound ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-4">
            <h3 className="text-lg font-bold">{activeRound.title}</h3>
            <p className="mt-1 text-sm text-slate-600">
              {activeRound.pickCount}/{activeRound.matchCount} 予想済み / AI差分 {activeRound.reviewChangeCount}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleApplyStrategy("orthodox", activeRound.roundId)}
                className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
              >
                この回の王道を反映
              </button>
              <button
                type="button"
                onClick={() => handleApplyStrategy("value", activeRound.roundId)}
                className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950"
              >
                この回の期待値を反映
              </button>
              {activeRound.reviewChangeCount > 0 ? (
                <button
                  type="button"
                  onClick={() => handleApplyAi(activeRound.roundId)}
                  className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
                >
                  AI修正を反映
                </button>
              ) : null}
            </div>
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
                    Hazi {match.haziPick ?? "未"}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {match.modelSource === "official_vote" ? "公式人気" : "国別強度"}
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    王道 {match.orthodox.pick}
                  </span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    期待値 {match.value.pick}
                  </span>
                  {match.reviewChange ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      Hazi {match.haziPick ?? "未"} → AI {match.aiPick}
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      Hazi反映済み
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{match.modelRationale}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                  <div>1 {formatProb(match.modelProb1)}</div>
                  <div>0 {formatProb(match.modelProb0)}</div>
                  <div>2 {formatProb(match.modelProb2)}</div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <StrategyCard
                    active={match.haziPick === match.orthodox.pick}
                    onClick={() => handlePick(activeRound, match.matchId, match.orthodox.pick)}
                    strategy={match.orthodox}
                    title="王道"
                    tone="emerald"
                  />
                  <StrategyCard
                    active={match.haziPick === match.value.pick}
                    onClick={() => handlePick(activeRound, match.matchId, match.value.pick)}
                    strategy={match.value}
                    title="期待値"
                    tone="amber"
                  />
                  <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-left text-slate-800 shadow-sm">
                    <div className="flex min-w-0 items-center justify-between gap-1">
                      <span className="truncate text-[11px] font-bold">Hazi</span>
                      <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold">
                        保存中
                      </span>
                    </div>
                    <div className="mt-1 text-2xl font-black leading-none">
                      {match.haziPick ?? "-"}
                    </div>
                    <div className="mt-1 truncate text-[11px] font-semibold opacity-80">
                      {match.haziPick ? "レビュー対象" : "未入力"}
                    </div>
                  </div>
                </div>
                <div className="mt-2 grid gap-1 text-xs leading-5 text-slate-500">
                  <p>
                    <span className="font-semibold text-slate-700">王道:</span>{" "}
                    {match.orthodox.rationale}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">期待値:</span>{" "}
                    {match.value.rationale}
                  </p>
                </div>
                {match.reviewChange ? (
                  <button
                    type="button"
                    onClick={() => handlePick(activeRound, match.matchId, match.aiPick)}
                    className="mt-3 w-full rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-800"
                  >
                    このAI案をHazi予想へ反映
                  </button>
                ) : null}
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
