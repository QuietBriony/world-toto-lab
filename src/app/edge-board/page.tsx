"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import {
  ConfigurationNotice,
  ErrorNotice,
  LoadingNotice,
  RoundRequiredNotice,
} from "@/components/app/states";
import { RoundNav } from "@/components/round-nav";
import { Badge, PageHeader, SectionCard } from "@/components/ui";
import {
  buildEdgeRows,
  formatNumber,
  formatPercent,
  formatSignedPercent,
  roundStatusLabel,
} from "@/lib/domain";
import { appRoute, getSingleSearchParam } from "@/lib/round-links";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useRoundWorkspace } from "@/lib/use-app-data";

function EdgeBoardPageContent() {
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="差分ボード"
        title="39 outcome を一覧化"
        description="valueScore は MVP 用の簡易指標です。高エッジ、引き分け警戒、人力支援を重ねて採用 / 見送りを判断します。"
      />

      {!isSupabaseConfigured() ? (
        <ConfigurationNotice />
      ) : !roundId ? (
        <RoundRequiredNotice />
      ) : loading && !data ? (
        <LoadingNotice title="差分ボードを読み込み中" />
      ) : error && !data ? (
        <ErrorNotice error={error} onRetry={() => void refresh()} />
      ) : data ? (
        <>
          <RoundNav
            roundId={data.round.id}
            roundTitle={data.round.title}
            roundStatus={roundStatusLabel[data.round.status]}
            currentPath={appRoute.edgeBoard}
          />

          <SectionCard
            title="差分ボード"
            description="差分が +0.08 以上なら高エッジ、0 の平均Dが高い場合は引き分け補正を強めに反映します。"
          >
            <div className="overflow-x-auto">
              <table className="min-w-[1280px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-3 py-3">試合</th>
                    <th className="px-3 py-3">候補</th>
                    <th className="px-3 py-3">AI</th>
                    <th className="px-3 py-3">公式人気</th>
                    <th className="px-3 py-3">市場</th>
                    <th className="px-3 py-3">差分</th>
                    <th className="px-3 py-3">人力コンセンサス</th>
                    <th className="px-3 py-3">信頼度</th>
                    <th className="px-3 py-3">評価値</th>
                    <th className="px-3 py-3">判定</th>
                  </tr>
                </thead>
                <tbody>
                  {buildEdgeRows(data.round.matches).map((row) => (
                    <tr key={`${row.matchNo}-${row.outcome}`} className="border-b border-slate-100">
                      <td className="px-3 py-4">
                        <div className="font-semibold text-slate-900">#{row.matchNo}</div>
                        <div className="text-slate-600">{row.fixture}</div>
                      </td>
                      <td className="px-3 py-4 font-semibold text-slate-900">{row.outcome}</td>
                      <td className="px-3 py-4">{formatPercent(row.modelProbability)}</td>
                      <td className="px-3 py-4">{formatPercent(row.officialVoteShare)}</td>
                      <td className="px-3 py-4">{formatPercent(row.marketProbability)}</td>
                      <td className="px-3 py-4">
                        <span
                          className={
                            row.edge !== null && row.edge > 0
                              ? "font-semibold text-emerald-700"
                              : "text-slate-500"
                          }
                        >
                          {formatSignedPercent(row.edge)}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-slate-600">{row.humanConsensus}</td>
                      <td className="px-3 py-4">{formatNumber(row.confidence, 2)}</td>
                      <td className="px-3 py-4">{formatNumber(row.valueScore, 3)}</td>
                      <td className="px-3 py-4">
                        <Badge tone={row.include ? "teal" : "slate"}>
                          {row.include ? "採用" : "見送り"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}

export default function EdgeBoardPage() {
  return (
    <Suspense fallback={<LoadingNotice title="差分ボードを準備中" />}>
      <EdgeBoardPageContent />
    </Suspense>
  );
}
