"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import {
  CandidateCard,
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
  Badge,
  buttonClassName,
  CollapsibleSectionCard,
  PageHeader,
  SectionCard,
  StatCard,
  secondaryButtonClassName,
} from "@/components/ui";
import {
  productTypeBadgeTone,
  productTypeLabel,
  roundSourceLabel,
  roundStatusLabel,
} from "@/lib/domain";
import {
  buildRoundDataQualitySummary,
  isCandidateTicketSetStale,
  sortCandidateTickets,
} from "@/lib/candidate-tickets";
import { appRoute, buildRoundHref, getSingleSearchParam } from "@/lib/round-links";
import {
  refreshCandidateTicketsForRound,
  upsertCandidateVote,
} from "@/lib/repository";
import {
  modeMaterialsDescription,
  probabilityReadinessDescription,
} from "@/lib/round-mode";
import { isSupabaseConfigured } from "@/lib/supabase";
import { isWinnerLikeRound } from "@/lib/winner-value";
import { resolveWorldTotoProductLabel } from "@/lib/world-toto";
import { useRoundWorkspace } from "@/lib/use-app-data";
import type { CandidateVoteValue, RoundSource } from "@/lib/types";

const roundSourceTone: Record<
  RoundSource,
  "info" | "slate" | "teal" | "warning"
> = {
  fixture_master: "info",
  toto_official_manual: "teal",
  user_manual: "slate",
  demo_sample: "warning",
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "不明なエラーです。";
}

function roundSourceHint(source: RoundSource) {
  if (source === "fixture_master") {
    return "Fixture Master から組んだラウンドです。日程や会場を直したいときは管理者フロー側を更新してください。";
  }

  if (source === "toto_official_manual") {
    return "toto公式対象回の取り込みベースです。公式人気や売上前提は管理者が貼り付けたソースを使います。";
  }

  if (source === "demo_sample") {
    return "デモ混じりの参考ラウンドです。実運用の判断材料としては使わないでください。";
  }

  return "手入力ベースのラウンドです。元データの出どころは取り込みメモや管理メモも確認してください。";
}

function PickRoomPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const requestedUserId = getSingleSearchParam(searchParams.get("user"));
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const autoRefreshIdentityRef = useRef<string | null>(null);

  const activeUser =
    data?.users.find((user) => user.id === requestedUserId) ??
    data?.users[0] ??
    null;
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
  const candidateTickets = useMemo(
    () => (data ? sortCandidateTickets(data.round.candidateTickets) : []),
    [data],
  );
  const candidateVoteSummary = useMemo(
    () => buildCandidateVoteSummaryMap(data?.round.candidateVotes ?? []),
    [data],
  );
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

  const candidateIdentity =
    data && dataQualitySummary
      ? JSON.stringify({
          candidateUpdatedAt: data.round.candidateTickets.map((ticket) => ticket.updatedAt),
          evUpdatedAt: data.round.evAssumption?.updatedAt ?? null,
          matchUpdatedAt: data.round.matches.map((match) => match.updatedAt),
          pickUpdatedAt: data.round.picks.map((pick) => pick.updatedAt),
          scoutUpdatedAt: data.round.scoutReports.map((report) => report.updatedAt),
          strictEvReady: dataQualitySummary.strictEvReady,
        })
      : null;

  useEffect(() => {
    if (!data || !roundId || !dataQualitySummary || !candidateIdentity) {
      return;
    }

    const stale = isCandidateTicketSetStale({
      candidateTickets: data.round.candidateTickets,
      evAssumption: data.round.evAssumption,
      matches: data.round.matches,
      picks: data.round.picks,
      scoutReports: data.round.scoutReports,
    });

    if (!stale || autoRefreshIdentityRef.current === candidateIdentity) {
      return;
    }

    autoRefreshIdentityRef.current = candidateIdentity;

    void (async () => {
      setBusyKey("refresh");
      setActionError(null);
      setActionMessage(null);

      try {
        await refreshCandidateTicketsForRound({ roundId });
        await refresh();
        setActionMessage("候補カードを最新データから更新しました。");
      } catch (nextError) {
        setActionError(errorMessage(nextError));
      } finally {
        setBusyKey(null);
      }
    })();
  }, [candidateIdentity, data, dataQualitySummary, refresh, roundId]);

  if (!isSupabaseConfigured()) {
    return <ConfigurationNotice />;
  }

  if (!roundId) {
    return <RoundRequiredNotice />;
  }

  if (loading && !data) {
    return <LoadingNotice title="候補カードを準備中" />;
  }

  if (error) {
    return <ErrorNotice error={error} onRetry={() => void refresh()} />;
  }

  if (!data || !dataQualitySummary) {
    return <RoundRequiredNotice />;
  }

  const winnerLike = isWinnerLikeRound({
    activeMatchCount: data.round.activeMatchCount,
    matchCount: data.round.matches.length,
    productType: data.round.productType,
    requiredMatchCount: data.round.requiredMatchCount,
  });
  const officialReadyLabel = dataQualitySummary.allOfficialVotesReady
    ? `${data.round.matches.length}/${data.round.matches.length}`
    : `${dataQualitySummary.metrics.find((metric) => metric.label === "公式人気")?.filled ?? 0}/${data.round.matches.length}`;
  const aiReadyLabel = dataQualitySummary.allModelProbabilitiesReady
    ? `${data.round.matches.length}/${data.round.matches.length}`
    : `${dataQualitySummary.metrics.find((metric) => metric.label === "モデル確率")?.filled ?? 0}/${data.round.matches.length}`;
  const evModeLabel = dataQualitySummary.strictEvReady
    ? "実EV"
    : data.round.evAssumption?.totalSalesYen
      ? "Proxy"
      : "未計算";
  const warningCount = candidateTickets.filter((candidate) => Boolean(candidate.warning)).length;
  const activeUserComments =
    activeUser === null
      ? 0
      : data.round.candidateVotes.filter(
          (vote) => vote.userId === activeUser.id && Boolean(vote.comment),
        ).length;

  const handleVote = async (candidateId: string, vote: CandidateVoteValue) => {
    if (!activeUser) {
      setActionError("投票するメンバーを選んでください。");
      return;
    }

    setBusyKey(`${candidateId}:${vote}`);
    setActionError(null);
    setActionMessage(null);

    try {
      const existingVote = data.round.candidateVotes.find(
        (entry) => entry.candidateTicketId === candidateId && entry.userId === activeUser.id,
      );
      await upsertCandidateVote({
        roundId: data.round.id,
        candidateTicketId: candidateId,
        userId: activeUser.id,
        vote,
        comment: existingVote?.comment ?? null,
      });
      await refresh();
      setActionMessage(`${activeUser.name} の投票を保存しました。`);
    } catch (nextError) {
      setActionError(errorMessage(nextError));
    } finally {
      setBusyKey(null);
    }
  };

  const handleComment = async (candidateId: string) => {
    if (!activeUser) {
      setActionError("コメントするメンバーを選んでください。");
      return;
    }

    const existingVote = data.round.candidateVotes.find(
      (entry) => entry.candidateTicketId === candidateId && entry.userId === activeUser.id,
    );
    const nextComment = window.prompt(
      "コメントを入れてください。空欄で保存するとコメントだけ消します。",
      existingVote?.comment ?? "",
    );

    if (nextComment === null) {
      return;
    }

    setBusyKey(`${candidateId}:comment`);
    setActionError(null);
    setActionMessage(null);

    try {
      await upsertCandidateVote({
        roundId: data.round.id,
        candidateTicketId: candidateId,
        userId: activeUser.id,
        vote: existingVote?.vote ?? "maybe",
        comment: nextComment.trim() || null,
      });
      await refresh();
      setActionMessage("コメントを保存しました。");
    } catch (nextError) {
      setActionError(errorMessage(nextError));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="候補カード"
        title="どれで行く？"
        description="王道・人力推し・EV狙いを数本に絞って、みんなで比較しながら最終候補を決めるための共有画面です。"
        actions={
          <div className="flex flex-wrap gap-3">
            {winnerLike ? (
              <Link
                href={buildRoundHref(appRoute.winnerValue, data.round.id, { user: activeUser?.id })}
                className={secondaryButtonClassName}
              >
                WINNERボード
              </Link>
            ) : null}
            <Link
              href={buildRoundHref(appRoute.simpleView, data.round.id, { user: activeUser?.id })}
              className={buttonClassName}
            >
              自分の予想
            </Link>
            <Link
              href={buildRoundHref(appRoute.play, data.round.id, { user: activeUser?.id })}
              className={secondaryButtonClassName}
            >
              みんなで見る
            </Link>
            <button
              type="button"
              onClick={() => {
                autoRefreshIdentityRef.current = null;
                void refresh();
              }}
              className={secondaryButtonClassName}
              disabled={busyKey === "refresh"}
            >
              候補を再読み込み
            </button>
          </div>
        }
      />

      <RoundNav
        roundId={data.round.id}
        roundStatus={roundStatusLabel[data.round.status]}
        roundTitle={data.round.title}
        userId={activeUser?.id}
        items={[
          { href: buildRoundHref(appRoute.simpleView, data.round.id, { user: activeUser?.id }), label: "自分の予想" },
          ...(winnerLike
            ? [
                {
                  href: buildRoundHref(appRoute.winnerValue, data.round.id, { user: activeUser?.id }),
                  label: "WINNERボード",
                },
              ]
            : []),
          { href: buildRoundHref(appRoute.pickRoom, data.round.id, { user: activeUser?.id }), label: "候補カード" },
          { href: buildRoundHref(appRoute.picks, data.round.id, { user: activeUser?.id }), label: "自分の予想" },
          { href: buildRoundHref(appRoute.workspace, data.round.id), label: "ラウンド詳細" },
        ]}
      />

      <SectionCard
        title="メンバー"
        description="誰の視点で投票・コメントするかを選びます。スマホでは横にスワイプできます。"
      >
        <div className="rounded-[22px] border border-slate-200 bg-slate-50/90 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={activeUser?.role === "admin" ? "teal" : "info"}>
              {activeUser?.role === "admin" ? "予想者" : "メンバー"}
            </Badge>
            <p className="text-sm leading-6 text-slate-600">
              今は <span className="font-semibold text-slate-950">{activeUser?.name}</span> の投票を編集しています。
            </p>
          </div>
        </div>

        <div className="-mx-1 overflow-x-auto pb-1">
          <div className="flex w-max gap-2 px-1 sm:w-auto sm:flex-wrap">
            {data.users.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() =>
                  router.push(buildRoundHref(appRoute.pickRoom, data.round.id, { user: user.id }))
                }
                className={user.id === activeUser?.id ? buttonClassName : secondaryButtonClassName}
              >
                {user.name}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="候補カード"
        description="まずはここだけ見れば大丈夫です。横スワイプで候補を比べて、そのままリアクションを残せます。"
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone="slate">候補 {candidateTickets.length}</Badge>
            <Badge tone={activeUser?.role === "admin" ? "teal" : "info"}>
              視点 {activeUser?.name ?? "未選択"}
            </Badge>
          </div>
        }
      >
        {candidateTickets.length === 0 ? (
          <p className="text-sm leading-6 text-slate-600">
            まだ候補カードがありません。試合データやモデル確率をそろえてから再読み込みしてください。
          </p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
            {candidateTickets.map((candidate) => {
              const activeVote =
                data.round.candidateVotes.find(
                  (vote) => vote.candidateTicketId === candidate.id && vote.userId === activeUser?.id,
                )?.vote ?? null;

              return (
                <CandidateCard
                  key={candidate.id}
                  activeVote={activeVote}
                  busyVote={
                    busyKey?.startsWith(candidate.id) && busyKey.includes(":")
                      ? (busyKey.split(":")[1] as CandidateVoteValue | "comment")
                      : null
                  }
                  candidate={candidate}
                  onComment={() => void handleComment(candidate.id)}
                  onVote={(vote) => void handleVote(candidate.id, vote)}
                  voteSummary={
                    candidateVoteSummary.get(candidate.id) ?? {
                      boughtMyself: 0,
                      comments: 0,
                      like: 0,
                      maybe: 0,
                      pass: 0,
                    }
                  }
                />
              );
            })}
          </div>
        )}
      </SectionCard>

      {actionError ? (
        <SectionCard title="操作エラー">
          <p className="text-sm text-rose-700">{actionError}</p>
        </SectionCard>
      ) : null}
      {actionMessage ? (
        <SectionCard title="保存しました">
          <p className="text-sm text-emerald-700">{actionMessage}</p>
        </SectionCard>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="対象試合数" value={data.round.matches.length} compact />
        <StatCard label="公式人気" value={officialReadyLabel} compact />
        <StatCard label="モデル試算" value={aiReadyLabel} compact />
        <StatCard label="人力予想人数" value={dataQualitySummary.humanPickUserCount} compact />
        <StatCard
          label="EV計算"
          value={evModeLabel}
          compact
          badge={
            <Badge tone={productTypeBadgeTone[data.round.productType]}>
              {roundProductLabel ?? productTypeLabel[data.round.productType]}
            </Badge>
          }
        />
      </div>

      <DataQualityCard
        summary={dataQualitySummary}
        extraLines={[
          modeMaterialsDescription(data.round.competitionType),
          probabilityReadinessDescription(
            data.round.probabilityReadiness,
            data.round.competitionType,
          ),
          "推定EVは、入力されたモデル確率・公式人気・売上想定・配当原資想定から計算した参考値です。的中や利益を保証するものではありません。",
          data.round.totoOfficialRound
            ? "公式人気や売上前提は、管理者が取り込んだ toto公式対象回の情報を優先して使います。"
            : "toto公式対象回の取り込み前でも候補は見られますが、EVは Proxy 表示になりやすいです。",
          dataQualitySummary.isDemoData
            ? "このRoundにはデモデータが含まれています。本番分析には使わないでください。"
            : "実際の購入判断は各自で行い、この画面は候補比較と合意形成の補助として使ってください。",
        ]}
      />

      <CollapsibleSectionCard
        title="この回の前提"
        description="候補の出どころと注意点を先にそろえておくと、投票の意味がぶれません。"
        defaultOpen={dataQualitySummary.isDemoData || !data.round.totoOfficialRound}
        badge={<Badge tone="slate">補助説明</Badge>}
        actions={
          data.round.totoOfficialRound?.sourceUrl ? (
            <a
              href={data.round.totoOfficialRound.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className={secondaryButtonClassName}
            >
              元の公式ソース
            </a>
          ) : null
        }
      >
        <div className="flex flex-wrap gap-2">
          <Badge tone={roundSourceTone[data.round.roundSource]}>
            出どころ {roundSourceLabel[data.round.roundSource]}
          </Badge>
          <Badge tone={productTypeBadgeTone[data.round.productType]}>
            {roundProductLabel ?? productTypeLabel[data.round.productType]}
          </Badge>
          <Badge tone={activeUser?.role === "admin" ? "teal" : "info"}>
            視点 {activeUser?.name ?? "未選択"}
          </Badge>
          {data.round.totoOfficialRound ? <Badge tone="teal">toto公式情報あり</Badge> : null}
          {warningCount > 0 ? <Badge tone="warning">注意付き候補 {warningCount}</Badge> : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 text-sm leading-6 text-slate-600">
            <p>{roundSourceHint(data.round.roundSource)}</p>
            <p>
              {data.round.sourceNote
                ? `管理メモ: ${data.round.sourceNote}`
                : "管理メモが未設定です。ラウンドの由来は管理フロー側の取り込み元も合わせて確認してください。"}
            </p>
            <p>
              この画面は候補比較と投票用です。公式totoの購入は各自が公式サービスで行い、このアプリは分析・相談・記録に使ってください。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50/90 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                現在の視点
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {activeUser?.name ?? "未選択"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {activeUser?.role === "admin"
                  ? "管理者の視点で投票とコメントを残します。"
                  : "メンバーの視点でリアクションを残します。"}
              </p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50/90 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                コメント状況
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {activeUserComments} 件
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                候補カード右下のボタンから、理由や注意点を短く残せます。
              </p>
            </div>
          </div>
        </div>
      </CollapsibleSectionCard>

      <CandidateComparisonTable
        tickets={candidateTickets}
        summaries={candidateVoteSummary}
      />
    </div>
  );
}

export default function PickRoomPage() {
  return (
    <Suspense fallback={<LoadingNotice title="候補カードを準備中" />}>
      <PickRoomPageContent />
    </Suspense>
  );
}
