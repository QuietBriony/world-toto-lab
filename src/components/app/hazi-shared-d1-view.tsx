"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  enumToOutcome,
  favoriteOutcomeForBucket,
  outcomeToEnum,
  type OutcomeValue,
} from "@/lib/domain";
import {
  buildFeaturedWorldTotoImportPayloads,
  featuredWorldTotoRoundNumbers,
} from "@/lib/featured-world-toto";
import { createFeaturedWorldTotoRoundInD1 } from "@/lib/featured-world-toto-d1";
import {
  createUser,
  listDashboardData,
  replacePicks,
} from "@/lib/repository-d1";
import { getStoredRoundTokens } from "@/lib/storage/d1ApiAdapter";
import type { DashboardData, DashboardRoundSummary, Match, User } from "@/lib/types";

type PicksByRound = Record<string, Record<string, OutcomeValue>>;
type LoadStatus = "loading" | "ready" | "error";

const OUTCOMES: OutcomeValue[] = ["1", "0", "2"];

function outcomeSubLabel(value: OutcomeValue) {
  if (value === "1") return "ホーム";
  return value === "0" ? "ドロー" : "アウェイ";
}

function featuredRoundNumberOf(round: DashboardRoundSummary): number | null {
  const text = `${round.title} ${round.sourceNote ?? ""}`;
  const matched = text.match(/第(\d+)回/);
  const value = matched ? Number(matched[1]) : Number.NaN;
  return Number.isFinite(value) &&
    (featuredWorldTotoRoundNumbers as readonly number[]).includes(value)
    ? value
    : null;
}

function aiPickOf(match: Match): OutcomeValue | null {
  return (
    favoriteOutcomeForBucket(match, "model") ??
    favoriteOutcomeForBucket(match, "market") ??
    null
  );
}

function pickButtonClass(active: boolean, value: OutcomeValue) {
  const activeColor =
    value === "0"
      ? "border-blue-500 bg-blue-600 text-white"
      : value === "1"
        ? "border-emerald-500 bg-emerald-600 text-white"
        : "border-amber-500 bg-amber-500 text-slate-950";
  return [
    "flex h-14 min-w-0 flex-1 flex-col items-center justify-center rounded-xl border px-2 text-center shadow-sm",
    active ? activeColor : "border-slate-200 bg-white text-slate-800 active:bg-slate-100",
  ].join(" ");
}

/**
 * 共有D1（cloudflare_d1 デプロイ）の /hazi 軽量ビュー。
 *
 * 「Haziの予想を入れる」で共有D1に作った W杯ラウンド（第1634〜1637回）を読み、各試合の
 * AI予想（保存済み model 本命＝最適ロジック）を見せつつ、Hazi が 1/0/2 タップで即・共有D1へ
 * 保存する（友達も同じ共有D1を見る）。読みは public、書きは作成者端末の editToken が必要。
 *
 * repository-d1 を直接呼ぶため runtime mode（/hazi は強制 local）に依存しない。
 * モデルは再計算せず、保存済み値を表示するだけ（model/engine には触れない）。
 */
export function HaziSharedD1View() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [picks, setPicks] = useState<PicksByRound>({});
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [savingRoundId, setSavingRoundId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapStep, setBootstrapStep] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      setStatus("loading");
      void (async () => {
        try {
          const next = await listDashboardData();
          if (cancelled) return;
          const haziUser = next.users.find(
            (user) => user.name.trim().toLowerCase() === "hazi",
          );
          const initial: PicksByRound = {};
          for (const round of next.rounds) {
            if (!featuredRoundNumberOf(round)) continue;
            const map: Record<string, OutcomeValue> = {};
            if (haziUser) {
              for (const pick of round.picks) {
                if (pick.userId !== haziUser.id) continue;
                const value = enumToOutcome(pick.pick);
                if (value) map[pick.matchId] = value;
              }
            }
            initial[round.id] = map;
          }
          setData(next);
          setPicks(initial);
          setStatus("ready");
          setError(null);
        } catch (nextError) {
          if (cancelled) return;
          setStatus("error");
          setError(
            nextError instanceof Error
              ? nextError.message
              : "共有D1の読み込みに失敗しました。",
          );
        }
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const haziUser = useMemo(
    () =>
      data?.users.find((user) => user.name.trim().toLowerCase() === "hazi") ?? null,
    [data],
  );

  const rounds = useMemo(() => {
    if (!data) return [];
    const byNumber = new Map<number, { number: number; round: DashboardRoundSummary }>();
    for (const round of data.rounds) {
      const number = featuredRoundNumberOf(round);
      if (!number) continue;
      const existing = byNumber.get(number);
      if (!existing || (!getStoredRoundTokens(existing.round.id)?.editToken && getStoredRoundTokens(round.id)?.editToken)) {
        byNumber.set(number, { number, round });
      }
    }
    return Array.from(byNumber.values()).sort((left, right) => left.number - right.number);
  }, [data]);

  const needsEditableCopy =
    rounds.length > 0 &&
    rounds.some(({ round }) => !getStoredRoundTokens(round.id)?.editToken);

  const ensureHaziUser = async (): Promise<User | null> => {
    const current = await listDashboardData();
    const existing = current.users.find((user) => user.name.trim().toLowerCase() === "hazi");
    if (existing) return existing;

    const users = await createUser({ name: "Hazi", role: "admin" });
    return users.find((user) => user.name.trim().toLowerCase() === "hazi") ?? null;
  };

  const saveInitialPicks = async (input: { matches: Match[]; roundId: string; userId: string }) => {
    await replacePicks({
      roundId: input.roundId,
      userId: input.userId,
      picks: input.matches.map((match) => ({
        matchId: match.id,
        note: "Hazi初期予想: AI初期線から自動入力。あとで手動調整してください。",
        pick: outcomeToEnum(aiPickOf(match) ?? "1"),
        support: { kind: "manual" as const },
      })),
    });
  };

  const handleBootstrapWorldToto = (input: { forceNew?: boolean } = {}) => {
    if (!data || bootstrapping) return;
    setBootstrapping(true);
    setBootstrapStep("Haziユーザーを確認中…");
    setBootstrapError(null);
    setSaveError(null);
    void (async () => {
      try {
        const hazi = await ensureHaziUser();
        if (!hazi) {
          throw new Error("Haziユーザーを作成できませんでした。");
        }

        setBootstrapStep("既存ラウンドを確認中…");
        const current = await listDashboardData();
        const existingRoundsByNumber = input.forceNew
          ? new Map<number, string>()
          : new Map(
              current.rounds.flatMap((round) => {
                const number = featuredRoundNumberOf(round);
                return number ? [[number, round.id] as const] : [];
              }),
            );
        const payloads = buildFeaturedWorldTotoImportPayloads();

        for (const [index, payload] of payloads.entries()) {
          const roundLabel =
            payload.officialRoundNumber !== null ? `第${payload.officialRoundNumber}回` : "W杯回";
          setBootstrapStep(`${roundLabel}を作成中… ${index + 1}/${payloads.length}`);
          const { matches, roundId } = await createFeaturedWorldTotoRoundInD1({
            existingRoundId:
              payload.officialRoundNumber !== null
                ? existingRoundsByNumber.get(payload.officialRoundNumber) ?? null
                : null,
            participantIds: [hazi.id],
            payload: {
              ...payload,
              notes: `${payload.notes}\nHaziレビュー待ちの軽量セットです。候補カード生成はスマホ負荷を避けるため後で必要な時だけ行います。`,
            },
          });
          setBootstrapStep(`${roundLabel}のHazi初期予想を保存中… ${index + 1}/${payloads.length}`);
          await saveInitialPicks({ matches, roundId, userId: hazi.id });
        }

        setBootstrapStep("一覧を更新中…");
        setReloadKey((key) => key + 1);
      } catch (nextError) {
        setBootstrapError(
          nextError instanceof Error
            ? nextError.message
            : "Hazi用W杯ラウンドの作成に失敗しました。",
        );
      } finally {
        setBootstrapping(false);
        setBootstrapStep(null);
      }
    })();
  };

  const handlePick = (round: DashboardRoundSummary, matchId: string, value: OutcomeValue) => {
    if (!haziUser) return;
    const nextRoundPicks = { ...(picks[round.id] ?? {}), [matchId]: value };
    setPicks((prev) => ({ ...prev, [round.id]: nextRoundPicks }));
    setSavingRoundId(round.id);
    setSaveError(null);
    void (async () => {
      try {
        await replacePicks({
          roundId: round.id,
          userId: haziUser.id,
          picks: Object.entries(nextRoundPicks).map(([mId, pick]) => ({
            matchId: mId,
            note: "Hazi予想（軽量・共有D1）",
            pick: outcomeToEnum(pick),
            support: { kind: "manual" as const },
          })),
        });
        setSavingRoundId(null);
      } catch (nextError) {
        setSavingRoundId(null);
        setSaveError(
          nextError instanceof Error
            ? nextError.message
            : "保存に失敗しました。編集には作成者端末の招待リンク（編集権限）が必要です。",
        );
      }
    })();
  };

  if (status === "loading") {
    return (
      <div className="mx-auto w-full max-w-3xl px-1 py-6 text-sm text-slate-600">
        共有D1のW杯ラウンドを読み込んでいます…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-1 py-6">
        <p className="text-sm font-semibold text-rose-700">{error}</p>
        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
          className="self-start rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-6 text-slate-950">
      <section className="rounded-2xl border border-emerald-200 bg-white px-4 py-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            Hazi予想
          </span>
          <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800">
            共有D1（みんなで同じ）
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            スマホ軽量
          </span>
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight">Hazi予想（共有版）</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          AI予想（最適ロジック）を見ながら、1 / 0 / 2 をタップすると共有D1にすぐ保存され、友達も同じ画面で見られます。
        </p>
        {!haziUser ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold leading-6 text-amber-800">
            まだ Hazi ユーザーがいません。下のボタンで第1634〜1637回と一緒に準備できます。
          </p>
        ) : null}
        {saveError ? (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold leading-6 text-rose-800">
            {saveError}
          </p>
        ) : null}
        {bootstrapError ? (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold leading-6 text-rose-800">
            {bootstrapError}
          </p>
        ) : null}
        {bootstrapStep ? (
          <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold leading-6 text-emerald-800">
            {bootstrapStep}
          </p>
        ) : null}
      </section>

      {needsEditableCopy ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
          この端末には第1634〜1637回の編集権限がないため、今は閲覧のみです。
          Haziのスマホで編集する場合は、この端末用の編集セットを作り直してください。
          <div className="mt-3">
            <button
              type="button"
              onClick={() => handleBootstrapWorldToto({ forceNew: true })}
              disabled={bootstrapping}
              className="inline-flex rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {bootstrapping ? (bootstrapStep ?? "作成中…") : "Hazi編集セットを作り直す"}
            </button>
          </div>
        </section>
      ) : null}

      {rounds.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm leading-6 text-slate-600">
          共有D1にW杯ラウンド（第1634〜1637回）がまだありません。
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleBootstrapWorldToto()}
              disabled={bootstrapping}
              className="inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {bootstrapping ? (bootstrapStep ?? "作成中…") : "4回分を作ってHaziレビューへ"}
            </button>
            <Link
              href="/"
              className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
            >
              ダッシュボードを開く
            </Link>
          </div>
        </section>
      ) : null}

      {rounds.map(({ number, round }) => {
        const canEdit = Boolean(haziUser) && Boolean(getStoredRoundTokens(round.id)?.editToken);
        const roundPicks = picks[round.id] ?? {};
        const matches = round.matches.slice().sort((left, right) => left.matchNo - right.matchNo);
        const pickedCount = matches.filter((match) => roundPicks[match.id]).length;
        return (
          <section key={round.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <h3 className="text-base font-bold">第{number}回 toto W杯</h3>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  予想 {pickedCount}/{matches.length}
                </span>
                {savingRoundId === round.id ? (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                    保存中…
                  </span>
                ) : null}
                {!canEdit ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    閲覧のみ
                  </span>
                ) : null}
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {matches.map((match) => {
                const aiPick = aiPickOf(match);
                const haziPick = roundPicks[match.id] ?? null;
                return (
                  <article key={match.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-500">
                          No.{match.officialMatchNo ?? match.matchNo}
                        </div>
                        <h4 className="mt-1 text-base font-bold leading-6 text-slate-950">
                          {match.homeTeam} vs {match.awayTeam}
                        </h4>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                          AI {aiPick ?? "—"}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          Hazi {haziPick ?? "未"}
                        </span>
                      </div>
                    </div>

                    {canEdit ? (
                      <div className="mt-3 flex gap-2">
                        {OUTCOMES.map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => handlePick(round, match.id, value)}
                            className={pickButtonClass(haziPick === value, value)}
                          >
                            <span className="text-lg font-black leading-5">{value}</span>
                            <span className="mt-0.5 text-[10px] font-semibold leading-3 opacity-80">
                              {outcomeSubLabel(value)}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
