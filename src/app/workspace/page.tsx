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
  formatPercent,
  formatSignedPercent,
  humanConsensusOutcomes,
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
  return error instanceof Error ? error.message : "Unknown error";
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
        title: stringValue(formData, "title") || "Untitled Round",
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
        eyebrow="Round Detail"
        title={data?.round.title ?? "Round Detail"}
        description="13試合の分析入力状況と、AI候補・人力コンセンサス・エッジ候補を俯瞰できます。"
        actions={
          data ? <Badge tone="sky">{roundStatusLabel[data.round.status]}</Badge> : undefined
        }
      />

      {!isSupabaseConfigured() ? (
        <ConfigurationNotice />
      ) : !roundId ? (
        <RoundRequiredNotice />
      ) : loading && !data ? (
        <LoadingNotice title="Round を読み込み中" />
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
            title="Round設定"
            description="予算やステータス、当日の観戦メモをここで更新します。"
          >
            <form
              key={data.round.updatedAt}
              onSubmit={handleSaveRound}
              className="grid gap-5 md:grid-cols-2"
            >
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Title
                <input
                  name="title"
                  defaultValue={data.round.title}
                  className={fieldClassName}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Status
                <select
                  name="status"
                  className={fieldClassName}
                  defaultValue={data.round.status}
                >
                  {roundStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Budget
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
                Ticket Generator の候補数は 100円単位の予算から計算します。
                現在の設定: {formatCurrency(data.round.budgetYen)}
              </div>

              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                Notes
                <textarea
                  name="notes"
                  defaultValue={data.round.notes ?? ""}
                  className={textAreaClassName}
                />
              </label>

              <div className="md:col-span-2 flex justify-end">
                <button type="submit" className={buttonClassName} disabled={saving}>
                  {saving ? "Saving..." : "Save Round"}
                </button>
              </div>
            </form>
            {submitError ? <p className="text-sm text-rose-700">{submitError}</p> : null}
          </SectionCard>

          <SectionCard
            title="13試合一覧"
            description="横スクロール対応です。Edge は Model - Official で表示しています。"
          >
            <div className="overflow-x-auto">
              <table className="min-w-[1440px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-3 py-3">No.</th>
                    <th className="px-3 py-3">Home</th>
                    <th className="px-3 py-3">Away</th>
                    <th className="px-3 py-3">Kickoff</th>
                    <th className="px-3 py-3">Venue</th>
                    <th className="px-3 py-3">Official 1/0/2</th>
                    <th className="px-3 py-3">Market 1/0/2</th>
                    <th className="px-3 py-3">Model 1/0/2</th>
                    <th className="px-3 py-3">Edge 1/0/2</th>
                    <th className="px-3 py-3">Human F</th>
                    <th className="px-3 py-3">Human D</th>
                    <th className="px-3 py-3">Human Consensus</th>
                    <th className="px-3 py-3">AI Recommended</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3">Badges</th>
                    <th className="px-3 py-3">Actual</th>
                    <th className="px-3 py-3">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.round.matches.map((match) => {
                    const badges = buildMatchBadges(match);

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
                        <td className="px-3 py-4">{formatNumber(match.consensusF, 1)}</td>
                        <td className="px-3 py-4">{formatNumber(match.consensusD, 1)}</td>
                        <td className="px-3 py-4">
                          <div className="font-medium text-slate-800">
                            {match.consensusCall ?? "未集計"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {humanConsensusOutcomes(match).join(" / ") || "—"}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="font-medium text-slate-800">
                            {aiRecommendedOutcomes(match).join(" / ") || "—"}
                          </div>
                          <div className="text-xs text-slate-500">
                            conf {match.confidence !== null ? match.confidence.toFixed(2) : "—"}
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
                            Edit
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
    <Suspense fallback={<LoadingNotice title="Round を準備中" />}>
      <WorkspacePageContent />
    </Suspense>
  );
}
