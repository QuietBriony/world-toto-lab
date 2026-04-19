"use client";

import {
  ConfigurationNotice,
  ErrorNotice,
  LoadingNotice,
  RoundRequiredNotice,
} from "@/components/app/states";
import { RoundNav } from "@/components/round-nav";
import { Badge, PageHeader, SectionCard } from "@/components/ui";
import {
  aiRecommendedOutcomes,
  buildMatchBadges,
  formatOutcomeSet,
  formatNumber,
  formatPercent,
  humanConsensusOutcomes,
  humanOverlayBadge,
  representativeNotes,
  roundStatusLabel,
} from "@/lib/domain";
import { appRoute, getSingleSearchParam } from "@/lib/round-links";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useRoundWorkspace } from "@/lib/use-app-data";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ConsensusPageContent() {
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="人力コンセンサス"
        title="人力コンセンサス集計"
        description="AI基準線に対して、人力がどこをそのまま採用し、どこに別筋を重ねたかを一覧できます。"
      />

      {!isSupabaseConfigured() ? (
        <ConfigurationNotice />
      ) : !roundId ? (
        <RoundRequiredNotice />
      ) : loading && !data ? (
        <LoadingNotice title="コンセンサスを読み込み中" />
      ) : error && !data ? (
        <ErrorNotice error={error} onRetry={() => void refresh()} />
      ) : data ? (
        <>
          <RoundNav
            roundId={data.round.id}
            roundTitle={data.round.title}
            roundStatus={roundStatusLabel[data.round.status]}
            currentPath={appRoute.consensus}
          />

          <SectionCard
            title="コンセンサス一覧"
            description="代表メモは根拠カードの内容から重複を除いて抜粋しています。AI基準線と人力上書きを並べて差分を見ます。"
          >
            <div className="overflow-x-auto">
              <table className="min-w-[1540px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-3 py-3">試合</th>
                    <th className="px-3 py-3">AI基準線</th>
                    <th className="px-3 py-3">人力上書き</th>
                    <th className="px-3 py-3">重なり方</th>
                    <th className="px-3 py-3">平均F</th>
                    <th className="px-3 py-3">中央値F</th>
                    <th className="px-3 py-3">平均D</th>
                    <th className="px-3 py-3">ばらつき</th>
                    <th className="px-3 py-3">例外数</th>
                    <th className="px-3 py-3">代表的な根拠メモ</th>
                    <th className="px-3 py-3">バッジ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.round.matches.map((match) => {
                    const reports = data.round.scoutReports.filter(
                      (report) => report.matchId === match.id,
                    );
                    const aiBase = aiRecommendedOutcomes(match);
                    const humanSet = humanConsensusOutcomes(match);
                    const overlayBadge = humanOverlayBadge(match);
                    const notes = representativeNotes(reports);
                    const badges = buildMatchBadges(match).filter((badge) =>
                      ["AIと人間対立", "引き分け警報", "例外多発"].includes(badge.label),
                    );

                    return (
                      <tr key={match.id} className="border-b border-slate-100 align-top">
                        <td className="px-3 py-4">
                          <div className="font-semibold text-slate-900">
                            #{match.matchNo} {match.homeTeam} 対 {match.awayTeam}
                          </div>
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
                            AI {formatPercent(match.modelProb1)} /{" "}
                            {formatPercent(match.modelProb0)} /{" "}
                            {formatPercent(match.modelProb2)}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="font-medium text-slate-800">
                            {formatOutcomeSet(humanSet)}
                          </div>
                          <div className="text-xs text-slate-500">
                            {match.consensusCall ?? "未集計"}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <Badge tone={overlayBadge.tone}>{overlayBadge.label}</Badge>
                        </td>
                        <td className="px-3 py-4">{formatNumber(match.consensusF, 1)}</td>
                        <td className="px-3 py-4">
                          {formatNumber(
                            reports
                              .map((report) => report.directionScoreF)
                              .sort((left, right) => left - right)[
                              Math.floor(reports.length / 2)
                            ] ?? null,
                            1,
                          )}
                        </td>
                        <td className="px-3 py-4">{formatNumber(match.consensusD, 1)}</td>
                        <td className="px-3 py-4">
                          {formatNumber(match.disagreementScore, 2)}
                        </td>
                        <td className="px-3 py-4">{match.exceptionCount ?? 0}</td>
                        <td className="px-3 py-4">
                          <div className="space-y-2 text-slate-600">
                            {notes.length === 0 ? (
                              <span>—</span>
                            ) : (
                              notes.map((note) => (
                                <div
                                  key={note}
                                  className="rounded-2xl bg-slate-950/5 px-3 py-2"
                                >
                                  {note}
                                </div>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex flex-wrap gap-2">
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

export default function ConsensusPage() {
  return (
    <Suspense fallback={<LoadingNotice title="コンセンサスを準備中" />}>
      <ConsensusPageContent />
    </Suspense>
  );
}
