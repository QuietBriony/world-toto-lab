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
import { Badge, PageHeader, SectionCard, StatCard } from "@/components/ui";
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
  const edgeRows =
    data
      ? buildEdgeRows(data.round.matches).sort((left, right) => {
          if (left.include !== right.include) {
            return left.include ? -1 : 1;
          }

          if (right.valueScore !== left.valueScore) {
            return right.valueScore - left.valueScore;
          }

          return (right.edge ?? -1) - (left.edge ?? -1);
        })
      : [];
  const includedRows = edgeRows.filter((row) => row.include);
  const highEdgeRows = edgeRows.filter((row) => row.edge !== null && row.edge >= 0.08);
  const drawRows = edgeRows
    .filter(
      (row) =>
        row.outcome === "0" &&
        (row.include || (row.edge ?? 0) > 0.02 || row.humanConsensus.includes("0")),
    )
    .slice(0, 4);
  const sleeperRows = edgeRows
    .filter((row) => row.officialVoteShare !== null && row.officialVoteShare <= 0.25 && (row.edge ?? 0) > 0)
    .slice(0, 4);
  const humanSupportRows = edgeRows
    .filter((row) => row.humanConsensus.includes(row.outcome))
    .slice(0, 4);
  const supportRows = sleeperRows.length > 0 ? sleeperRows : humanSupportRows;
  const supportTitle = sleeperRows.length > 0 ? "人気薄でも拾える候補" : "人力支援が強い候補";
  const supportTone = sleeperRows.length > 0 ? "amber" : "sky";
  const supportDescription =
    sleeperRows.length > 0
      ? "公式人気が薄いのに差分がある候補です。"
      : "人気薄はまだ弱いので、人力支援が強い候補を出しています。";

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

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="採用候補"
              value={`${includedRows.length}`}
              hint="39候補中、いま拾う価値があると判定した outcome 数"
            />
            <StatCard
              label="高エッジ"
              value={`${highEdgeRows.length}`}
              hint="39候補中、差分が +0.08 以上の outcome 数"
            />
            <StatCard
              label="0候補"
              value={`${edgeRows.filter((row) => row.outcome === "0" && row.include).length}`}
              hint="39候補中、引き分けとして拾う候補数"
            />
            <StatCard
              label="人力支援あり"
              value={`${edgeRows.filter((row) => row.humanConsensus.includes(row.outcome)).length}`}
              hint="39候補中、人力コンセンサスが同じ outcome を支えている数"
            />
          </section>

          <SectionCard
            title="まず見るところ"
            description="採用候補、引き分け候補、人気薄の芽を先に見られます。細かい39 outcome はその下に残しています。"
          >
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone="teal">採用</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    まず見る候補
                  </h3>
                </div>
                <div className="mt-4 space-y-3">
                  {includedRows.length === 0 ? (
                    <p className="text-sm leading-6 text-slate-600">
                      まだ採用候補はありません。AI確率と人力コンセンサスが入るとここに並びます。
                    </p>
                  ) : (
                    includedRows.slice(0, 4).map((row) => (
                      <div
                        key={`focus-${row.matchNo}-${row.outcome}`}
                        className="rounded-[18px] border border-emerald-200 bg-white/80 p-3"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          #{row.matchNo} {row.fixture} / {row.outcome}
                        </div>
                        <div className="mt-1 text-sm text-slate-700">
                          評価値 {formatNumber(row.valueScore, 3)} / 差分 {formatSignedPercent(row.edge)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge tone="teal">採用</Badge>
                          {(row.edge ?? 0) >= 0.08 ? <Badge tone="teal">高エッジ</Badge> : null}
                          {row.humanConsensus.includes(row.outcome) ? (
                            <Badge tone="sky">人力支援あり</Badge>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-sky-200 bg-sky-50/80 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone="sky">0候補</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    引き分けを見たい候補
                  </h3>
                </div>
                <div className="mt-4 space-y-3">
                  {drawRows.length === 0 ? (
                    <p className="text-sm leading-6 text-slate-600">
                      まだ強い引き分け候補はありません。D や edge が乗るとここに出ます。
                    </p>
                  ) : (
                    drawRows.map((row) => (
                      <div
                        key={`draw-${row.matchNo}-${row.outcome}`}
                        className="rounded-[18px] border border-sky-200 bg-white/80 p-3"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          #{row.matchNo} {row.fixture}
                        </div>
                        <div className="mt-1 text-sm text-slate-700">
                          edge {formatSignedPercent(row.edge)} / 評価値 {formatNumber(row.valueScore, 3)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge tone={row.include ? "teal" : "slate"}>
                            {row.include ? "採用" : "見送り"}
                          </Badge>
                          {(row.edge ?? 0) >= 0.08 ? <Badge tone="teal">高エッジ</Badge> : null}
                          {row.humanConsensus.includes("0") ? (
                            <Badge tone="sky">人力も0候補</Badge>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-amber-200 bg-amber-50/85 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone={supportTone}>{sleeperRows.length > 0 ? "人気薄" : "人力支援"}</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    {supportTitle}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{supportDescription}</p>
                <div className="mt-4 space-y-3">
                  {supportRows.length === 0 ? (
                    <p className="text-sm leading-6 text-slate-600">
                      まだ候補はありません。edge や人力支援が乗るとここに出ます。
                    </p>
                  ) : (
                    supportRows.slice(0, 4).map((row) => (
                      <div
                        key={`sleeper-${row.matchNo}-${row.outcome}`}
                        className="rounded-[18px] border border-amber-200 bg-white/80 p-3"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          #{row.matchNo} {row.fixture} / {row.outcome}
                        </div>
                        <div className="mt-1 text-sm text-slate-700">
                          公式人気 {formatPercent(row.officialVoteShare)} / edge {formatSignedPercent(row.edge)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge tone={row.include ? "teal" : "slate"}>
                            {row.include ? "採用" : "見送り"}
                          </Badge>
                          {sleeperRows.length > 0 ? (
                            <Badge tone="amber">人気薄 + 差分あり</Badge>
                          ) : null}
                          {row.humanConsensus.includes(row.outcome) ? (
                            <Badge tone="sky">人力支援あり</Badge>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="差分ボード"
            description="上から 採用 → 見送り の順です。差分が +0.08 以上なら高エッジ、0 の平均Dが高い場合は引き分け補正を強めに反映します。"
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
                  {edgeRows.map((row) => (
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
