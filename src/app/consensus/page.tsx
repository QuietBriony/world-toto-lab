"use client";

import Link from "next/link";
import {
  ConfigurationNotice,
  ErrorNotice,
  LoadingNotice,
  RoundRequiredNotice,
} from "@/components/app/states";
import { RoundNav } from "@/components/round-nav";
import {
  Badge,
  CollapsibleSectionCard,
  PageHeader,
  SectionCard,
  secondaryButtonClassName,
  StatCard,
} from "@/components/ui";
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
import { appRoute, buildRoundHref, getSingleSearchParam } from "@/lib/round-links";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useRoundWorkspace } from "@/lib/use-app-data";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ConsensusPageContent() {
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);
  const consensusRows =
    data?.round.matches
      .map((match) => {
        const reports = data.round.scoutReports.filter((report) => report.matchId === match.id);
        const aiBase = aiRecommendedOutcomes(match);
        const humanSet = humanConsensusOutcomes(match);
        const overlayBadge = humanOverlayBadge(match);
        const notes = representativeNotes(reports);
        const badges = buildMatchBadges(match).filter((badge) =>
          ["AIと人間対立", "引き分け警報", "例外多発"].includes(badge.label),
        );
        const highlightScore =
          (overlayBadge.label === "AIと別筋"
            ? 4
            : overlayBadge.label === "AIに0を追加"
              ? 3
              : overlayBadge.label === "AIに人力を追加"
                ? 2
                : 1) +
          (match.disagreementScore ?? 0) +
          (match.consensusD ?? 0) * 0.45 +
          (match.exceptionCount ?? 0) * 0.3;

        return {
          aiBase,
          badges,
          highlightScore,
          humanSet,
          match,
          notes,
          overlayBadge,
          reports,
        };
      })
      .sort((left, right) => {
        if (right.highlightScore !== left.highlightScore) {
          return right.highlightScore - left.highlightScore;
        }

        return left.match.matchNo - right.match.matchNo;
      }) ?? [];
  const conflictRows = consensusRows
    .filter((row) => row.overlayBadge.label === "AIと別筋")
    .slice(0, 4);
  const drawRows = consensusRows
    .filter(
      (row) =>
        (row.match.consensusD ?? 0) >= 1 ||
        row.aiBase.includes("0") ||
        row.humanSet.includes("0"),
    )
    .slice(0, 4);
  const exceptionRows = consensusRows
    .filter((row) => (row.match.exceptionCount ?? 0) > 0 || row.badges.length > 0)
    .slice(0, 4);
  const conflictCount = consensusRows.filter((row) => row.overlayBadge.label === "AIと別筋").length;
  const drawCandidateCount = consensusRows.filter(
    (row) =>
      (row.match.consensusD ?? 0) >= 1 || row.aiBase.includes("0") || row.humanSet.includes("0"),
  ).length;
  const exceptionHeavyCount = consensusRows.filter(
    (row) => (row.match.exceptionCount ?? 0) > 0,
  ).length;
  const alignedCount = consensusRows.filter(
    (row) => row.overlayBadge.label === "AIをそのまま採用",
  ).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="予想者コンセンサス"
        title="予想者コンセンサス集計"
        description="AI基準線に対して、予想者ラインがどこをそのまま採用し、どこに別筋を重ねたかを一覧できます。"
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

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="AIをそのまま採用"
              value={`${alignedCount}`}
              hint="AI基準線と人力上書きが同じ試合数"
            />
            <StatCard
              label="AIと別筋"
              value={`${conflictCount}`}
              hint="人力がAIと違う筋を作った試合数"
            />
            <StatCard
              label="0候補あり"
              value={`${drawCandidateCount}`}
              hint="AIか人力で引き分けを見ている試合数"
            />
            <StatCard
              label="例外あり"
              value={`${exceptionHeavyCount}`}
              hint="例外フラグが立っている試合数"
            />
          </section>

          <SectionCard
            title="まず見るところ"
            description="人力が大きく動かした試合から先に見られます。細かい一覧はその下に残しています。"
            actions={
              <div className="flex flex-wrap gap-2">
                <Link
                  href={buildRoundHref(appRoute.edgeBoard, data.round.id)}
                  className={secondaryButtonClassName}
                >
                  差分ボードへ
                </Link>
                <Link
                  href={buildRoundHref(appRoute.review, data.round.id)}
                  className={secondaryButtonClassName}
                >
                  振り返りへ
                </Link>
              </div>
            }
          >
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-[24px] border border-rose-200 bg-rose-50/75 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone="rose">対立</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    AIと別筋の試合
                  </h3>
                </div>
                <div className="mt-4 space-y-3">
                  {conflictRows.length === 0 ? (
                    <p className="text-sm leading-6 text-slate-600">
                      まだ強い対立はありません。人力が AI と違う筋を作るとここに出ます。
                    </p>
                  ) : (
                    conflictRows.map((row) => (
                      <div
                        key={row.match.id}
                        className="rounded-[18px] border border-rose-200 bg-white/75 p-3"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          #{row.match.matchNo} {row.match.homeTeam} 対 {row.match.awayTeam}
                        </div>
                        <div className="mt-1 text-sm text-slate-700">
                          AI {formatOutcomeSet(row.aiBase)} / 人力 {formatOutcomeSet(row.humanSet)}
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          ばらつき {formatNumber(row.match.disagreementScore, 2)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-sky-200 bg-sky-50/75 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone="sky">0候補</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    引き分けを見たい試合
                  </h3>
                </div>
                <div className="mt-4 space-y-3">
                  {drawRows.length === 0 ? (
                    <p className="text-sm leading-6 text-slate-600">
                      引き分け寄りの試合が出ると、ここにまとまります。
                    </p>
                  ) : (
                    drawRows.map((row) => (
                      <div
                        key={row.match.id}
                        className="rounded-[18px] border border-sky-200 bg-white/75 p-3"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          #{row.match.matchNo} {row.match.homeTeam} 対 {row.match.awayTeam}
                        </div>
                        <div className="mt-1 text-sm text-slate-700">
                          人力 {formatOutcomeSet(row.humanSet)} / 平均D {formatNumber(row.match.consensusD, 1)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {row.aiBase.includes("0") ? <Badge tone="amber">AIが0候補</Badge> : null}
                          {row.humanSet.includes("0") ? <Badge tone="sky">人力が0候補</Badge> : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone="amber">例外</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    例外や注記が多い試合
                  </h3>
                </div>
                <div className="mt-4 space-y-3">
                  {exceptionRows.length === 0 ? (
                    <p className="text-sm leading-6 text-slate-600">
                      例外フラグや強い注記が増えるとここに出ます。
                    </p>
                  ) : (
                    exceptionRows.map((row) => (
                      <div
                        key={row.match.id}
                        className="rounded-[18px] border border-amber-200 bg-white/80 p-3"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          #{row.match.matchNo} {row.match.homeTeam} 対 {row.match.awayTeam}
                        </div>
                        <div className="mt-1 text-sm text-slate-700">
                          例外 {row.match.exceptionCount ?? 0} / メモ {row.notes.length}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {row.badges.length === 0 ? (
                            <Badge tone="slate">通常域</Badge>
                          ) : (
                            row.badges.map((badge) => (
                              <Badge key={`${row.match.id}-${badge.label}`} tone={badge.tone}>
                                {badge.label}
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          <CollapsibleSectionCard
            title="コンセンサス一覧"
            description="注目順に並べています。代表メモは予想者カードの内容から重複を除いて抜粋しています。"
            badge={<Badge tone="slate">詳細</Badge>}
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
                  {consensusRows.map(({ aiBase, badges, humanSet, match, notes, overlayBadge, reports }) => {
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
          </CollapsibleSectionCard>
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
