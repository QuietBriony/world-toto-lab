"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import {
  CandidateCard,
  DataQualityCard,
  buildCandidateVoteSummaryMap,
} from "@/components/app/friend-pick-room";
import {
  ConfigurationNotice,
  ErrorNotice,
  LoadingNotice,
  RoundMissingNotice,
  RoundRequiredNotice,
} from "@/components/app/states";
import { RoundNav } from "@/components/round-nav";
import {
  Badge,
  buttonClassName,
  CollapsibleSectionCard,
  cx,
  InfoBanner,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/ui";
import {
  favoriteOutcomeForBucket,
  formatPercent,
  humanConsensusOutcomes,
  probabilityReadinessLabel,
  productTypeLabel,
} from "@/lib/domain";
import {
  buildRoundDataQualitySummary,
  sortCandidateTickets,
} from "@/lib/candidate-tickets";
import { buildPlayDraftValues, buildPlayPageSummary, type PlayDraftValue } from "@/lib/play-page";
import {
  appRoute,
  buildRoundHref,
  getSingleSearchParam,
} from "@/lib/round-links";
import {
  replacePicks,
  upsertCandidateVote,
} from "@/lib/repository";
import {
  competitionTypeModeLabel,
  modeMaterialsDescription,
  roundEstimateStatusBanner,
} from "@/lib/round-mode";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useRoundWorkspace } from "@/lib/use-app-data";
import { resolveWorldTotoProductLabel } from "@/lib/world-toto";
import type { CandidateVoteValue } from "@/lib/types";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "不明なエラーです。";
}

function QuickPickButton(props: {
  active: boolean;
  label: "0" | "1" | "2";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cx(
        "inline-flex h-12 w-full items-center justify-center rounded-2xl border px-4 text-base font-semibold transition",
        props.active
          ? "border-emerald-600 bg-emerald-700 text-white"
          : "border-slate-200 bg-white/94 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/70",
      )}
    >
      {props.label}
    </button>
  );
}

function PlayPageContent() {
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const requestedUserId = getSingleSearchParam(searchParams.get("user"));
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);
  const [draftValues, setDraftValues] = useState<Record<string, PlayDraftValue>>({});
  const [draftIdentity, setDraftIdentity] = useState("empty");
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const activeUser =
    data?.users.find((user) => user.id === requestedUserId) ??
    data?.users[0] ??
    null;
  const autoRefreshIdentityRef = useRef<string | null>(null);

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

  const baseIdentity =
    data && activeUser
      ? JSON.stringify({
          picks: data.round.picks
            .filter((pick) => pick.userId === activeUser.id)
            .map((pick) => `${pick.id}:${pick.pick}:${pick.updatedAt}`),
          roundId: data.round.id,
          userId: activeUser.id,
        })
      : "empty";

  useEffect(() => {
    if (!data || !activeUser || draftIdentity === baseIdentity) {
      return;
    }

    queueMicrotask(() => {
      setDraftValues(buildPlayDraftValues(data.round, activeUser.id));
      setDraftIdentity(baseIdentity);
    });
  }, [activeUser, baseIdentity, data, draftIdentity]);

  const candidateTickets = useMemo(
    () => (data ? sortCandidateTickets(data.round.candidateTickets).slice(0, 6) : []),
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
  const summary = useMemo(
    () => (data ? buildPlayPageSummary(data.round) : null),
    [data],
  );
  const estimateStatus = data
    ? roundEstimateStatusBanner({
        competitionType: data.round.competitionType,
        probabilityReadiness: data.round.probabilityReadiness,
        roundSource: data.round.roundSource,
      })
    : null;

  const autoRefreshIdentity =
    data && dataQualitySummary
      ? JSON.stringify({
          candidateUpdatedAt: data.round.candidateTickets.map((ticket) => ticket.updatedAt),
          evUpdatedAt: data.round.evAssumption?.updatedAt ?? null,
          matchUpdatedAt: data.round.matches.map((match) => match.updatedAt),
          scoutUpdatedAt: data.round.scoutReports.map((report) => report.updatedAt),
          strictEvReady: dataQualitySummary.strictEvReady,
        })
      : null;

  useEffect(() => {
    if (!autoRefreshIdentity || autoRefreshIdentityRef.current === autoRefreshIdentity) {
      return;
    }

    autoRefreshIdentityRef.current = autoRefreshIdentity;
  }, [autoRefreshIdentity]);

  const pickSummary = useMemo(() => {
    if (!data) {
      return null;
    }

    let aiAligned = 0;
    let humanAligned = 0;
    let drawCount = 0;
    let contrarianCount = 0;

    data.round.matches.forEach((match) => {
      const pick = draftValues[match.id];

      if (!pick) {
        return;
      }

      if (pick === favoriteOutcomeForBucket(match, "model")) {
        aiAligned += 1;
      }

      if (humanConsensusOutcomes(match).includes(pick)) {
        humanAligned += 1;
      }

      if (pick !== favoriteOutcomeForBucket(match, "official")) {
        contrarianCount += 1;
      }

      if (pick === "0") {
        drawCount += 1;
      }
    });

    return {
      aiAligned,
      contrarianCount,
      drawCount,
      filledCount: Object.values(draftValues).filter(Boolean).length,
      humanAligned,
    };
  }, [data, draftValues]);

  if (!isSupabaseConfigured()) {
    return <ConfigurationNotice />;
  }

  if (!roundId) {
    return <RoundRequiredNotice />;
  }

  if (loading && !data) {
    return <LoadingNotice title="遊ぼうページを準備中" />;
  }

  if (error === "選択したラウンドが見つかりません。") {
    return <RoundMissingNotice onRetry={() => void refresh()} />;
  }

  if (error) {
    return <ErrorNotice error={error} onRetry={() => void refresh()} />;
  }

  if (!data || !activeUser || !summary || !dataQualitySummary || !pickSummary) {
    return <RoundRequiredNotice />;
  }

  const handleSavePicks = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setActionError(null);
    setActionMessage(null);

    try {
      await replacePicks({
        roundId: data.round.id,
        userId: activeUser.id,
        picks: data.round.matches.map((match) => {
          const pick = draftValues[match.id];
          return {
            matchId: match.id,
            note: null,
            pick:
              pick === "1" ? "ONE" : pick === "0" ? "DRAW" : pick === "2" ? "TWO" : null,
            support: { kind: "manual" as const },
          };
        }),
      });
      await refresh();
      setActionMessage("自分の予想を保存しました。");
    } catch (nextError) {
      setActionError(errorMessage(nextError));
    } finally {
      setSaving(false);
    }
  };

  const handleVote = async (candidateId: string, vote: CandidateVoteValue) => {
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
        eyebrow="みんなで見る"
        title="どれにする？"
        description="候補を見て、そのまま自分の予想も入れる共有ページです。"
      />

      <RoundNav
        roundId={data.round.id}
        roundTitle={data.round.title}
        roundStatus={competitionTypeModeLabel[data.round.competitionType]}
        currentPath={appRoute.play}
        items={[
          { href: buildRoundHref(appRoute.play, data.round.id, { user: activeUser.id }), label: "みんなで見る" },
          { href: buildRoundHref(appRoute.simpleView, data.round.id, { user: activeUser.id }), label: "自分の予想" },
          { href: buildRoundHref(appRoute.pickRoom, data.round.id, { user: activeUser.id }), label: "候補カード" },
          { href: buildRoundHref(appRoute.workspace, data.round.id), label: "ラウンド詳細" },
        ]}
      />

      {estimateStatus ? (
        <InfoBanner
          title={estimateStatus.title}
          body={estimateStatus.body}
          tone={estimateStatus.tone}
        />
      ) : null}

      {actionError ? (
        <ErrorNotice error={actionError} onRetry={() => void refresh()} />
      ) : null}

      {actionMessage ? (
        <SectionCard title="保存しました" description={actionMessage}>
          <p className="text-sm text-slate-600">候補カードの投票と自分の予想に反映されました。</p>
        </SectionCard>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="ラウンド" value={data.round.title} compact hint={roundProductLabel ?? productTypeLabel[data.round.productType]} />
        <StatCard label="モード" value={competitionTypeModeLabel[data.round.competitionType]} compact hint={modeMaterialsDescription(data.round.competitionType)} tone="positive" />
        <StatCard label="参加人数" value={`${summary.participantCount}人`} compact hint={`予想入力済み ${summary.inputtedUserCount}人`} />
        <StatCard label="候補カード" value={`${summary.candidateCount}`} compact hint="王道 / 人力 / EV / 引分 / 荒れ狙い" tone="draw" />
        <StatCard
          label="商品"
          value={roundProductLabel ?? productTypeLabel[data.round.productType]}
          compact
          hint={data.round.sourceNote ?? "共通ロジックを使います"}
          tone={
            data.round.roundSource === "toto_official_manual"
              ? "positive"
              : data.round.roundSource === "demo_sample"
                ? "warning"
                : "default"
          }
        />
      </div>

      <CollapsibleSectionCard
        title="この回の前提"
        description="候補の出どころや試算の厚みは、必要なときだけここで確認します。"
        defaultOpen={dataQualitySummary.isDemoData || !data.round.totoOfficialRound}
        badge={<Badge tone="slate">補助説明</Badge>}
      >
        <DataQualityCard
          summary={dataQualitySummary}
          extraLines={[
            modeMaterialsDescription(data.round.competitionType),
            `${competitionTypeModeLabel[data.round.competitionType]} / いまは ${probabilityReadinessLabel[data.round.probabilityReadiness]} の状態です。`,
          ]}
        />
      </CollapsibleSectionCard>

      <SectionCard
        title="候補カード"
        description="王道、公式人気、人力推し、EV狙いをここだけ見れば十分です。"
      >
        {candidateTickets.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/90 px-5 py-5">
            <div className="flex flex-wrap gap-2">
              <Badge tone="amber">候補なし</Badge>
              <Badge tone="sky">Proxy準備中</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              まだ候補カードがありません。候補カード画面を開くと、入力済みの試合・人力予想・公式人気から候補を更新できます。
            </p>
            <div className="mt-4">
              <Link
                href={buildRoundHref(appRoute.pickRoom, data.round.id, { user: activeUser.id })}
                className={buttonClassName}
              >
                候補カードを開く
              </Link>
            </div>
          </div>
        ) : (
          <div className="-mx-2 flex snap-x gap-4 overflow-x-auto px-2 pb-2">
            {candidateTickets.map((candidate) => {
              const existingVote = data.round.candidateVotes.find(
                (entry) =>
                  entry.candidateTicketId === candidate.id && entry.userId === activeUser.id,
              );

              return (
                <CandidateCard
                  key={candidate.id}
                  activeVote={existingVote?.vote ?? null}
                  busyVote={busyKey?.startsWith(candidate.id) ? (busyKey.split(":")[1] as CandidateVoteValue | "comment") : null}
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

      <form onSubmit={handleSavePicks} className="space-y-6">
        <SectionCard
          title="自分の予想を入れる"
          description="各試合を 1 / 0 / 2 でポチポチ入れるだけです。"
          actions={
            <button type="submit" className={buttonClassName} disabled={saving}>
              {saving ? "保存中..." : "自分の予想を保存"}
            </button>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            {data.round.matches.map((match) => {
              const aiFavorite = favoriteOutcomeForBucket(match, "model");
              const publicFavorite = favoriteOutcomeForBucket(match, "official");
              const humanFavorite = humanConsensusOutcomes(match);

              return (
                <article
                  key={match.id}
                  className="rounded-[24px] border border-slate-200 bg-white/92 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="slate">#{match.matchNo}</Badge>
                    {publicFavorite ? <Badge tone="sky">公式 {publicFavorite}</Badge> : null}
                    {aiFavorite ? <Badge tone="teal">AI {aiFavorite}</Badge> : null}
                    {humanFavorite.length > 0 ? (
                      <Badge tone="info">人力 {humanFavorite.join("/")}</Badge>
                    ) : null}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-slate-950">
                    {match.homeTeam} vs {match.awayTeam}
                  </h3>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {(["1", "0", "2"] as const).map((value) => (
                      <QuickPickButton
                        key={value}
                        active={draftValues[match.id] === value}
                        label={value}
                        onClick={() =>
                          setDraftValues((current) => ({
                            ...current,
                            [match.id]: value,
                          }))
                        }
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    公式 {formatPercent(
                      match.officialVote1 !== null && draftValues[match.id] === "1"
                        ? match.officialVote1
                        : draftValues[match.id] === "0"
                          ? match.officialVote0
                          : match.officialVote2,
                    )}
                  </p>
                </article>
              );
            })}
          </div>
        </SectionCard>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="入力済み" value={`${pickSummary.filledCount}/${data.round.matches.length}`} compact />
          <StatCard label="AI一致" value={`${pickSummary.aiAligned}`} compact hint="AI候補と一致した試合数" tone="positive" />
          <StatCard label="人力一致" value={`${pickSummary.humanAligned}`} compact hint="人力推しと一致した試合数" tone="draw" />
          <StatCard label="逆張り / 引分" value={`${pickSummary.contrarianCount} / ${pickSummary.drawCount}`} compact hint="遊び筋の目安" />
        </div>
      </form>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<LoadingNotice title="遊ぼうページを準備中" />}>
      <PlayPageContent />
    </Suspense>
  );
}
