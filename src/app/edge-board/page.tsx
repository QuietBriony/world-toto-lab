"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

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
  advantageBucketLabel,
  buildAdvantageRows,
  crowdSourceLabel,
  formatNumber,
  formatPercent,
  formatSignedPercent,
  roundStatusLabel,
} from "@/lib/domain";
import { appRoute, buildRoundHref, getSingleSearchParam } from "@/lib/round-links";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useRoundWorkspace } from "@/lib/use-app-data";

function bucketTone(bucket: keyof typeof advantageBucketLabel) {
  if (bucket === "core") {
    return "teal" as const;
  }

  if (bucket === "darkhorse") {
    return "amber" as const;
  }

  if (bucket === "focus") {
    return "sky" as const;
  }

  return "slate" as const;
}

function riskTone(riskScore: number) {
  if (riskScore >= 0.65) {
    return "rose" as const;
  }

  if (riskScore >= 0.45) {
    return "amber" as const;
  }

  return "teal" as const;
}

function probabilityWithCount(
  probability: number | null,
  count: number,
  suffix: string,
) {
  return probability !== null ? `${formatPercent(probability)} / ${count}${suffix}` : `— / ${count}${suffix}`;
}

function EdgeBoardPageContent() {
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);
  const advantageRows = data
    ? buildAdvantageRows({
        matches: data.round.matches,
        picks: data.round.picks,
        users: data.users,
      })
    : [];
  const includedRows = advantageRows.filter((row) => row.include);
  const coreRows = includedRows.filter((row) => row.bucket === "core").slice(0, 4);
  const predictorRows = includedRows
    .filter((row) => row.predictorPickCount > 0)
    .sort(
      (left, right) =>
        (right.predictorAdvantage ?? 0) - (left.predictorAdvantage ?? 0) ||
        right.attentionShare - left.attentionShare,
    )
    .slice(0, 4);
  const darkHorseRows = includedRows.filter((row) => row.bucket === "darkhorse").slice(0, 4);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="優位ボード"
        title="AI・予想者・ウォッチ支持を重ねて見る"
        description="一般人気を基準に、AI、予想者ライン、ウォッチ支持を合成して注目候補を並べます。ここでの注目配分は、どこから見るかの目安です。"
      />

      {!isSupabaseConfigured() ? (
        <ConfigurationNotice />
      ) : !roundId ? (
        <RoundRequiredNotice />
      ) : loading && !data ? (
        <LoadingNotice title="優位ボードを読み込み中" />
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
              label="注目候補"
              value={`${includedRows.length}`}
              hint="39候補のうち、いま優位差があると見た候補数"
            />
            <StatCard
              label="コア候補"
              value={`${includedRows.filter((row) => row.bucket === "core").length}`}
              hint="AI・予想者・ウォッチ支持が重なりやすい軸候補"
              tone="positive"
            />
            <StatCard
              label="ダークホース"
              value={`${includedRows.filter((row) => row.bucket === "darkhorse").length}`}
              hint="一般人気より薄いのに、合成優位がある候補"
              tone="warning"
            />
            <StatCard
              label="慎重確認"
              value={`${includedRows.filter((row) => row.riskScore >= 0.6).length}`}
              hint="優位はあるが、情報待ちや割れも大きい候補"
              tone="draw"
            />
          </section>

          <SectionCard
            title="まず見るところ"
            description="コア候補、予想者が押す候補、ダークホース候補を先に見てから、詳細表へ進みます。"
            actions={
              <div className="flex flex-wrap gap-2">
                <Link
                  href={buildRoundHref(appRoute.ticketGenerator, data.round.id)}
                  className={secondaryButtonClassName}
                >
                  候補配分へ
                </Link>
                <Link
                  href={buildRoundHref(appRoute.consensus, data.round.id)}
                  className={secondaryButtonClassName}
                >
                  コンセンサスへ
                </Link>
              </div>
            }
          >
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone="teal">コア</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    先に押さえる候補
                  </h3>
                </div>
                <div className="mt-4 space-y-3">
                  {coreRows.length === 0 ? (
                    <p className="text-sm leading-6 text-slate-600">
                      まだコア候補はありません。AI と予想者ラインが揃うとここに出ます。
                    </p>
                  ) : (
                    coreRows.map((row) => (
                      <div
                        key={`core-${row.matchNo}-${row.outcome}`}
                        className="rounded-[18px] border border-emerald-200 bg-white/82 p-3"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          #{row.matchNo} {row.fixture} / {row.outcome}
                        </div>
                        <div className="mt-1 text-sm text-slate-700">
                          合成優位 {formatSignedPercent(row.compositeAdvantage)} / 注目配分{" "}
                          {formatPercent(row.attentionShare)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge tone="teal">{advantageBucketLabel[row.bucket]}</Badge>
                          <Badge tone={riskTone(row.riskScore)}>リスク {formatNumber(row.riskScore, 2)}</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-sky-200 bg-sky-50/80 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone="sky">予想者</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    予想者が押している候補
                  </h3>
                </div>
                <div className="mt-4 space-y-3">
                  {predictorRows.length === 0 ? (
                    <p className="text-sm leading-6 text-slate-600">
                      まだ予想者の押し込みが見えていません。予想者ラインを入れるとここが育ちます。
                    </p>
                  ) : (
                    predictorRows.map((row) => (
                      <div
                        key={`predictor-${row.matchNo}-${row.outcome}`}
                        className="rounded-[18px] border border-sky-200 bg-white/82 p-3"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          #{row.matchNo} {row.fixture} / {row.outcome}
                        </div>
                        <div className="mt-1 text-sm text-slate-700">
                          予想者優位 {formatSignedPercent(row.predictorAdvantage)} /{" "}
                          {row.predictorPickCount}人
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge tone="sky">ウォッチ {row.watcherSupportCount}人</Badge>
                          <Badge tone={riskTone(row.riskScore)}>リスク {formatNumber(row.riskScore, 2)}</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-amber-200 bg-amber-50/85 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone="amber">穴候補</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    ダークホース候補
                  </h3>
                </div>
                <div className="mt-4 space-y-3">
                  {darkHorseRows.length === 0 ? (
                    <p className="text-sm leading-6 text-slate-600">
                      まだ強い穴候補はありません。一般人気が薄いのに合成優位があるとここに出ます。
                    </p>
                  ) : (
                    darkHorseRows.map((row) => (
                      <div
                        key={`darkhorse-${row.matchNo}-${row.outcome}`}
                        className="rounded-[18px] border border-amber-200 bg-white/82 p-3"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          #{row.matchNo} {row.fixture} / {row.outcome}
                        </div>
                        <div className="mt-1 text-sm text-slate-700">
                          一般人気 {formatPercent(row.crowdProbability)} / 穴候補度{" "}
                          {formatNumber(row.darkHorseScore, 2)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge tone="amber">注目配分 {formatPercent(row.attentionShare)}</Badge>
                          <Badge tone={riskTone(row.riskScore)}>リスク {formatNumber(row.riskScore, 2)}</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          <CollapsibleSectionCard
            title="優位ボード一覧"
            description="上から 注目候補 → 監視候補 の順です。一般人気との差、AI差、予想者差、注目配分を一緒に見て判断します。"
            badge={<Badge tone="slate">詳細</Badge>}
          >
            <div className="overflow-x-auto">
              <table className="min-w-[1480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-3 py-3">試合</th>
                    <th className="px-3 py-3">候補</th>
                    <th className="px-3 py-3">一般人気</th>
                    <th className="px-3 py-3">AI</th>
                    <th className="px-3 py-3">予想者</th>
                    <th className="px-3 py-3">ウォッチ</th>
                    <th className="px-3 py-3">合成</th>
                    <th className="px-3 py-3">AI差</th>
                    <th className="px-3 py-3">予想者差</th>
                    <th className="px-3 py-3">注目配分</th>
                    <th className="px-3 py-3">リスク</th>
                    <th className="px-3 py-3">判定</th>
                  </tr>
                </thead>
                <tbody>
                  {advantageRows.map((row) => (
                    <tr key={`${row.matchNo}-${row.outcome}`} className="border-b border-slate-100">
                      <td className="px-3 py-4">
                        <div className="font-semibold text-slate-900">#{row.matchNo}</div>
                        <div className="text-slate-600">{row.fixture}</div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="font-semibold text-slate-900">{row.outcome}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge tone={bucketTone(row.bucket)}>{advantageBucketLabel[row.bucket]}</Badge>
                          <Badge tone={row.include ? "teal" : "slate"}>
                            {row.include ? "注目" : "監視"}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <div>{formatPercent(row.crowdProbability)}</div>
                        <div className="mt-2 text-xs text-slate-500">
                          {row.crowdSource ? crowdSourceLabel[row.crowdSource] : "未設定"}
                        </div>
                      </td>
                      <td className="px-3 py-4">{formatPercent(row.aiProbability)}</td>
                      <td className="px-3 py-4">
                        {probabilityWithCount(row.predictorProbability, row.predictorPickCount, "人")}
                      </td>
                      <td className="px-3 py-4">
                        {probabilityWithCount(row.watcherProbability, row.watcherSupportCount, "人")}
                      </td>
                      <td className="px-3 py-4">
                        <div className="font-semibold text-slate-900">
                          {formatPercent(row.compositeProbability)}
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          合成優位 {formatSignedPercent(row.compositeAdvantage)}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={
                            (row.aiAdvantage ?? 0) > 0 ? "font-semibold text-emerald-700" : "text-slate-500"
                          }
                        >
                          {formatSignedPercent(row.aiAdvantage)}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={
                            (row.predictorAdvantage ?? 0) > 0
                              ? "font-semibold text-sky-700"
                              : "text-slate-500"
                          }
                        >
                          {formatSignedPercent(row.predictorAdvantage)}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <div>{formatPercent(row.attentionShare)}</div>
                        <div className="mt-2 text-xs text-slate-500">
                          穴候補度 {formatNumber(row.darkHorseScore, 2)}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <Badge tone={riskTone(row.riskScore)}>
                          {row.riskScore >= 0.65 ? "慎重" : row.riskScore >= 0.45 ? "中位" : "低め"}
                        </Badge>
                        <div className="mt-2 text-xs text-slate-500">{formatNumber(row.riskScore, 2)}</div>
                      </td>
                      <td className="px-3 py-4 text-slate-600">{row.humanConsensus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSectionCard>
        </>
      ) : null}
    </div>
  );
}

export default function EdgeBoardPage() {
  return (
    <Suspense fallback={<LoadingNotice title="優位ボードを準備中" />}>
      <EdgeBoardPageContent />
    </Suspense>
  );
}
