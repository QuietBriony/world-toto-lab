"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

import {
  ConfigurationNotice,
  ErrorNotice,
  LoadingNotice,
  RoundRequiredNotice,
} from "@/components/app/states";
import { RoundNav } from "@/components/round-nav";
import {
  Badge,
  buttonClassName,
  fieldClassName,
  PageHeader,
  secondaryButtonClassName,
  SectionCard,
  textAreaClassName,
} from "@/components/ui";
import {
  aiRecommendedOutcomes,
  buildMatchBadges,
  categoryLabel,
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatOutcomeSet,
  formatPercent,
  formatSignedPercent,
  humanConsensusOutcomes,
  humanOverlayBadge,
  roundStatusLabel,
  roundStatusOptions,
} from "@/lib/domain";
import {
  nullableString,
  parseIntOrNull,
  parseRoundStatus,
  stringValue,
} from "@/lib/forms";
import { appRoute, buildRoundHref, getSingleSearchParam } from "@/lib/round-links";
import { updateRound } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useRoundWorkspace } from "@/lib/use-app-data";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "不明なエラーです。";
}

function WorkspacePageContent() {
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSaveRound = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!data) {
      return;
    }

    setSaving(true);
    setSubmitError(null);

    try {
      const formData = new FormData(event.currentTarget);
      await updateRound({
        roundId: data.round.id,
        title: stringValue(formData, "title") || "無題のラウンド",
        status: parseRoundStatus(stringValue(formData, "status")),
        budgetYen: parseIntOrNull(stringValue(formData, "budgetYen")),
        notes: nullableString(formData, "notes"),
      });
      await refresh();
    } catch (nextError) {
      setSubmitError(errorMessage(nextError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="ラウンド詳細"
        title={data?.round.title ?? "ラウンド詳細"}
        description="13試合の分析入力状況を、AI基準線を土台にして人力上書きと差分候補まで一気に俯瞰できます。"
        actions={
          data ? <Badge tone="sky">{roundStatusLabel[data.round.status]}</Badge> : undefined
        }
      />

      {!isSupabaseConfigured() ? (
        <ConfigurationNotice />
      ) : !roundId ? (
        <RoundRequiredNotice />
      ) : loading && !data ? (
        <LoadingNotice title="ラウンドを読み込み中" />
      ) : error && !data ? (
        <ErrorNotice error={error} onRetry={() => void refresh()} />
      ) : data ? (
        <>
          <RoundNav
            roundId={data.round.id}
            roundTitle={data.round.title}
            roundStatus={roundStatusLabel[data.round.status]}
            currentPath={appRoute.workspace}
          />

          <SectionCard
            title="このラウンドの進め方"
            description="ラウンドを作った後は、だいたいこの順で使うとまとまります。"
          >
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  {
                    title: "1. 試合編集",
                    body: "試合名、確率、カテゴリ、推奨候補を整える",
                  },
                  {
                    title: "2. 人力予想",
                    body: "AI基準線を見てから各メンバーの 1 / 0 / 2 を上書きする",
                  },
                  {
                    title: "3. 根拠カード",
                    body: "根拠スコアと drawAlert を入れる",
                  },
                  {
                    title: "4. コンセンサス",
                    body: "AI基準線に対して人力がどう重なったかを見る",
                  },
                  {
                    title: "5. 差分 / 候補チケット",
                    body: "差分と候補比較を並べる",
                  },
                  {
                    title: "6. 振り返り",
                    body: "結果と反省ログを残す",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[22px] border border-white/80 bg-white/74 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.45)]"
                  >
                    <h3 className="font-display text-base font-semibold tracking-[-0.04em] text-slate-950">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={buildRoundHref(appRoute.picks, data.round.id, {
                      user: data.users[0]?.id,
                    })}
                    className={buttonClassName}
                  >
                    人力予想へ
                  </Link>
                  <Link
                    href={buildRoundHref(appRoute.scoutCards, data.round.id, {
                      user: data.users[0]?.id,
                    })}
                    className={secondaryButtonClassName}
                  >
                    根拠カードへ
                  </Link>
                  <Link
                    href={buildRoundHref(appRoute.consensus, data.round.id)}
                    className={secondaryButtonClassName}
                  >
                    コンセンサスへ
                  </Link>
                  <Link
                    href={buildRoundHref(appRoute.edgeBoard, data.round.id)}
                    className={secondaryButtonClassName}
                  >
                    差分ボードへ
                  </Link>
                  <Link
                    href={buildRoundHref(appRoute.ticketGenerator, data.round.id)}
                    className={secondaryButtonClassName}
                  >
                    候補チケットへ
                  </Link>
                  <Link
                    href={buildRoundHref(appRoute.review, data.round.id)}
                    className={secondaryButtonClassName}
                  >
                    振り返りへ
                  </Link>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  先にメンバーを作っておくと、人力予想と根拠カードの切り替えがスムーズです。
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="ラウンド設定"
            description="予算やステータス、当日の観戦メモをここで更新します。"
          >
            <form
              key={data.round.updatedAt}
              onSubmit={handleSaveRound}
              className="grid gap-5 md:grid-cols-2"
            >
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                ラウンド名
                <input
                  name="title"
                  defaultValue={data.round.title}
                  className={fieldClassName}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                ステータス
                <select
                  name="status"
                  className={fieldClassName}
                  defaultValue={data.round.status}
                >
                  {roundStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {roundStatusLabel[status]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                予算
                <input
                  name="budgetYen"
                  type="number"
                  min={0}
                  step={100}
                  defaultValue={data.round.budgetYen ?? ""}
                  className={fieldClassName}
                />
              </label>

              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-950/5 p-4 text-sm text-slate-600">
                候補チケットの枚数は 100円単位の予算から計算します。
                現在の設定: {formatCurrency(data.round.budgetYen)}
              </div>

              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                メモ
                <textarea
                  name="notes"
                  defaultValue={data.round.notes ?? ""}
                  className={textAreaClassName}
                />
              </label>

              <div className="md:col-span-2 flex justify-end">
                <button type="submit" className={buttonClassName} disabled={saving}>
                  {saving ? "保存中..." : "ラウンドを保存"}
                </button>
              </div>
            </form>
            {submitError ? <p className="text-sm text-rose-700">{submitError}</p> : null}
          </SectionCard>

          <SectionCard
            title="13試合一覧"
            description="横スクロール対応です。まず AI基準線 を見て、その横に人力上書きを重ねて読めます。差分は AI - 公式人気 です。"
          >
            <div className="overflow-x-auto">
              <table className="min-w-[1540px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-3 py-3">番号</th>
                    <th className="px-3 py-3">ホーム</th>
                    <th className="px-3 py-3">アウェイ</th>
                    <th className="px-3 py-3">開始</th>
                    <th className="px-3 py-3">会場</th>
                    <th className="px-3 py-3">公式人気 1/0/2</th>
                    <th className="px-3 py-3">市場 1/0/2</th>
                    <th className="px-3 py-3">AI 1/0/2</th>
                    <th className="px-3 py-3">AI基準線</th>
                    <th className="px-3 py-3">人力F</th>
                    <th className="px-3 py-3">人力D</th>
                    <th className="px-3 py-3">人力上書き</th>
                    <th className="px-3 py-3">差分 1/0/2</th>
                    <th className="px-3 py-3">カテゴリ</th>
                    <th className="px-3 py-3">注記</th>
                    <th className="px-3 py-3">結果</th>
                    <th className="px-3 py-3">編集</th>
                  </tr>
                </thead>
                <tbody>
                  {data.round.matches.map((match) => {
                    const aiBase = aiRecommendedOutcomes(match);
                    const badges = buildMatchBadges(match);
                    const overlayBadge = humanOverlayBadge(match);

                    return (
                      <tr key={match.id} className="border-b border-slate-100 align-top">
                        <td className="px-3 py-4 font-semibold text-slate-900">
                          {match.matchNo}
                        </td>
                        <td className="px-3 py-4">{match.homeTeam}</td>
                        <td className="px-3 py-4">{match.awayTeam}</td>
                        <td className="px-3 py-4 text-slate-600">
                          {formatDateTime(match.kickoffTime)}
                        </td>
                        <td className="px-3 py-4 text-slate-600">{match.venue ?? "—"}</td>
                        <td className="px-3 py-4 text-slate-600">
                          {formatPercent(match.officialVote1)} / {formatPercent(match.officialVote0)} /{" "}
                          {formatPercent(match.officialVote2)}
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {formatPercent(match.marketProb1)} / {formatPercent(match.marketProb0)} /{" "}
                          {formatPercent(match.marketProb2)}
                        </td>
                        <td className="px-3 py-4 font-medium text-slate-700">
                          {formatPercent(match.modelProb1)} / {formatPercent(match.modelProb0)} /{" "}
                          {formatPercent(match.modelProb2)}
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex flex-wrap gap-2">
                            {aiBase.length === 0 ? (
                              <Badge tone="slate">AI未設定</Badge>
                            ) : (
                              aiBase.map((outcome) => (
                                <Badge key={`${match.id}-ai-${outcome}`} tone="amber">
                                  {outcome}
                                </Badge>
                              ))
                            )}
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            信頼度 {match.confidence !== null ? match.confidence.toFixed(2) : "—"}
                          </div>
                        </td>
                        <td className="px-3 py-4">{formatNumber(match.consensusF, 1)}</td>
                        <td className="px-3 py-4">{formatNumber(match.consensusD, 1)}</td>
                        <td className="px-3 py-4">
                          <div className="font-medium text-slate-800">
                            {formatOutcomeSet(humanConsensusOutcomes(match))}
                          </div>
                          <div className="mt-1">
                            <Badge tone={overlayBadge.tone}>{overlayBadge.label}</Badge>
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            {match.consensusCall ?? "未集計"}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="space-y-1">
                            {(["1", "0", "2"] as const).map((outcome) => {
                              const edge =
                                outcome === "1"
                                  ? match.modelProb1 !== null && match.officialVote1 !== null
                                    ? match.modelProb1 - match.officialVote1
                                    : null
                                  : outcome === "0"
                                    ? match.modelProb0 !== null && match.officialVote0 !== null
                                      ? match.modelProb0 - match.officialVote0
                                      : null
                                    : match.modelProb2 !== null &&
                                        match.officialVote2 !== null
                                      ? match.modelProb2 - match.officialVote2
                                      : null;

                              return (
                                <div
                                  key={outcome}
                                  className={
                                    edge !== null && edge > 0
                                      ? "font-semibold text-emerald-700"
                                      : "text-slate-500"
                                  }
                                >
                                  {outcome}: {formatSignedPercent(edge)}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {match.category ? categoryLabel[match.category] : "—"}
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex max-w-[240px] flex-wrap gap-2">
                            {badges.length === 0 ? (
                              <span className="text-xs text-slate-400">—</span>
                            ) : (
                              badges.map((badge) => (
                                <Badge key={`${match.id}-${badge.label}`} tone={badge.tone}>
                                  {badge.label}
                                </Badge>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <Badge tone="slate">
                            {match.actualResult
                              ? match.actualResult
                                  .replace("ONE", "1")
                                  .replace("DRAW", "0")
                                  .replace("TWO", "2")
                              : "—"}
                          </Badge>
                        </td>
                        <td className="px-3 py-4">
                          <Link
                            href={buildRoundHref(appRoute.matchEditor, data.round.id, {
                              match: match.id,
                            })}
                            className={secondaryButtonClassName}
                          >
                            編集
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<LoadingNotice title="ラウンドを準備中" />}>
      <WorkspacePageContent />
    </Suspense>
  );
}
