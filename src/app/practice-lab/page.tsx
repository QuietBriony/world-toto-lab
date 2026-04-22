"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

import {
  CandidateComparisonTable,
  DataQualityCard,
  buildCandidateVoteSummaryMap,
} from "@/components/app/friend-pick-room";
import {
  ConfigurationNotice,
  ErrorNotice,
  LoadingNotice,
  RoundRequiredNotice,
} from "@/components/app/states";
import { RoundNav } from "@/components/round-nav";
import {
  PageHeader,
  SectionCard,
  StatCard,
  buttonClassName,
  secondaryButtonClassName,
} from "@/components/ui";
import { buildRoundDataQualitySummary, sortCandidateTickets } from "@/lib/candidate-tickets";
import { productTypeLabel } from "@/lib/domain";
import { buildPracticeLabMetrics, buildPracticeLabSavedPickCounts } from "@/lib/practice-lab";
import { appRoute, buildRoundHref, getSingleSearchParam } from "@/lib/round-links";
import {
  competitionTypeModeLabel,
  dataProfileLabel,
  modeMaterialsDescription,
  probabilityReadinessDescription,
  probabilityReadinessStatusLabel,
} from "@/lib/round-mode";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useRoundWorkspace } from "@/lib/use-app-data";
import { resolveWorldTotoProductLabel } from "@/lib/world-toto";

function PracticeLabPageContent() {
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);

  const dataQualitySummary = useMemo(
    () =>
      data
        ? buildRoundDataQualitySummary({
            evAssumption: data.round.evAssumption,
            matches: data.round.matches,
            picks: data.round.picks,
            roundTitle: data.round.title,
            scoutReports: data.round.scoutReports,
            users: data.users,
          })
        : null,
    [data],
  );
  const practiceMetrics = useMemo(
    () => (data ? buildPracticeLabMetrics(data.round) : null),
    [data],
  );
  const savedPickCounts = useMemo(
    () => (data ? buildPracticeLabSavedPickCounts(data.round) : new Map<string, number>()),
    [data],
  );
  const candidateTickets = useMemo(
    () => (data ? sortCandidateTickets(data.round.candidateTickets) : []),
    [data],
  );
  const voteSummary = useMemo(
    () => buildCandidateVoteSummaryMap(data?.round.candidateVotes ?? []),
    [data],
  );
  const roundProductLabel = data
    ? resolveWorldTotoProductLabel(
        {
          matchCount: data.round.matches.length,
          matches: data.round.matches,
          notes: data.round.notes,
          productType: data.round.productType,
          sourceNote: data.round.sourceNote,
          title: data.round.title,
        },
        productTypeLabel[data.round.productType],
      )
    : null;

  if (!isSupabaseConfigured()) {
    return <ConfigurationNotice />;
  }

  if (!roundId) {
    return <RoundRequiredNotice />;
  }

  if (loading && !data) {
    return <LoadingNotice title="練習ラボを準備中" />;
  }

  if (error) {
    return <ErrorNotice error={error} onRetry={() => void refresh()} />;
  }

  if (!data || !dataQualitySummary || !practiceMetrics) {
    return <RoundRequiredNotice />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="練習ラボ"
        title="通常toto練習回"
        description="W杯前のモデル検証、人力予想の練習、通常totoでどこまで試算できるかを軽く振り返るページです。"
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href={buildRoundHref(appRoute.play, data.round.id, { user: data.users[0]?.id })} className={buttonClassName}>
              遊ぼうページ
            </Link>
            <Link href={buildRoundHref(appRoute.workspace, data.round.id)} className={secondaryButtonClassName}>
              Round 詳細
            </Link>
          </div>
        }
      />

      <RoundNav
        roundId={data.round.id}
        roundTitle={data.round.title}
        roundStatus={competitionTypeModeLabel[data.round.competitionType]}
        currentPath={appRoute.practiceLab}
        items={[
          { href: buildRoundHref(appRoute.practiceLab, data.round.id), label: "練習ラボ" },
          { href: buildRoundHref(appRoute.play, data.round.id, { user: data.users[0]?.id }), label: "遊ぼう" },
          { href: buildRoundHref(appRoute.pickRoom, data.round.id, { user: data.users[0]?.id }), label: "Pick Room" },
          { href: buildRoundHref(appRoute.workspace, data.round.id), label: "Round 詳細" },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="モード" value={competitionTypeModeLabel[data.round.competitionType]} compact hint={modeMaterialsDescription(data.round.competitionType)} tone="positive" />
        <StatCard label="データの厚み" value={dataProfileLabel[data.round.dataProfile]} compact hint={roundProductLabel ?? productTypeLabel[data.round.productType]} />
        <StatCard label="試算状態" value={probabilityReadinessStatusLabel[data.round.probabilityReadiness]} compact hint={probabilityReadinessDescription(data.round.probabilityReadiness, data.round.competitionType)} tone={data.round.probabilityReadiness === "ready" ? "positive" : data.round.probabilityReadiness === "partial" ? "draw" : "warning"} />
        <StatCard label="参加 / 入力" value={`${data.users.length} / ${Array.from(savedPickCounts.values()).filter((count) => count > 0).length}`} compact hint="予想を保存した人数" />
      </div>

      <DataQualityCard
        summary={dataQualitySummary}
        extraLines={[
          modeMaterialsDescription(data.round.competitionType),
          "通常totoは、W杯本番前のモデル練習・人力予想の検証に向いています。",
        ]}
      />

      <SectionCard
        title="検証指標"
        description="結果が入った試合だけを対象に、どの材料が当たりやすかったかをざっくり見ます。"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="モデル最大"
            value={`${practiceMetrics.modelFavoriteHitCount}/${practiceMetrics.resolvedMatchCount}`}
            compact
            hint="モデル最大確率の的中数"
            tone="positive"
          />
          <StatCard
            label="公式人気最大"
            value={`${practiceMetrics.officialFavoriteHitCount}/${practiceMetrics.resolvedMatchCount}`}
            compact
            hint="公式人気最大の的中数"
          />
          <StatCard
            label="人力コンセンサス"
            value={`${practiceMetrics.humanConsensusHitCount}/${practiceMetrics.resolvedMatchCount}`}
            compact
            hint="人力推しが拾えた数"
            tone="draw"
          />
          <StatCard
            label="引き分け警報"
            value={`${practiceMetrics.drawAlertHitCount}/${practiceMetrics.resolvedMatchCount}`}
            compact
            hint="引き分け警報が当たった数"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="候補ふり返り"
        description="王道・人力・EV 候補を並べて、結果後にどこが効いたかを見ます。"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="候補カード"
            value={`${candidateTickets.length}`}
            compact
            hint="練習回で比較できる候補数"
          />
          <StatCard
            label="上位候補"
            value={practiceMetrics.topCandidate?.label ?? "なし"}
            compact
            hint={
              practiceMetrics.topCandidate && practiceMetrics.candidateHitCount !== null
                ? `${practiceMetrics.candidateHitCount} 的中`
                : "候補未生成"
            }
            tone="draw"
          />
          <StatCard
            label="実結果入力"
            value={`${practiceMetrics.resolvedMatchCount}/${data.round.matches.length}`}
            compact
            hint="結果入力後に精度比較が進みます"
          />
        </div>

        {candidateTickets.length > 0 ? (
          <div className="mt-4">
            <CandidateComparisonTable tickets={candidateTickets} summaries={voteSummary} />
          </div>
        ) : (
          <div className="mt-4 rounded-[22px] border border-dashed border-slate-300 bg-slate-50/90 px-4 py-4 text-sm leading-6 text-slate-600">
            候補カードはまだありません。公式人気・人力Scout・EV前提がそろうと、ここに王道候補や EV 候補が並びます。
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="どの情報が効いたか"
        description="W杯ほど材料が厚くない回でも、何が効いたかを残しておくと練習回として価値が出ます。"
      >
        <ul className="space-y-2 text-sm leading-7 text-slate-700">
          <li>市場確率がない回は、人力Scout Card と Research Memo の比重が上がります。</li>
          <li>公式人気だけある回は、Edge の検証より「人気差が大きい試合のメモ」から見直すのが向いています。</li>
          <li>結果入力が進むほど、モデル最大 / 公式人気最大 / 人力推しの差が見やすくなります。</li>
        </ul>
      </SectionCard>
    </div>
  );
}

export default function PracticeLabPage() {
  return (
    <Suspense fallback={<LoadingNotice title="練習ラボを準備中" />}>
      <PracticeLabPageContent />
    </Suspense>
  );
}
