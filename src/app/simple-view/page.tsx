"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";

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
  secondaryButtonClassName,
  StatCard,
} from "@/components/ui";
import {
  favoriteOutcomeForBucket,
  formatDateTime,
  formatPercent,
  humanConsensusOutcomes,
  productTypeBadgeTone,
  productTypeLabel,
  roundSourceLabel,
  roundStatusLabel,
  singlePickOverlayBadge,
} from "@/lib/domain";
import { sortCandidateTickets } from "@/lib/candidate-tickets";
import { appRoute, buildRoundHref, getSingleSearchParam } from "@/lib/round-links";
import { replacePicks } from "@/lib/repository";
import { roundEstimateStatusBanner } from "@/lib/round-mode";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useRoundWorkspace } from "@/lib/use-app-data";
import { isWinnerLikeRound } from "@/lib/winner-value";
import { resolveWorldTotoProductLabel } from "@/lib/world-toto";
import type { OutcomeValue } from "@/lib/domain";
import type { RoundSource } from "@/lib/types";

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

function enumToOutcomeValue(value: "ONE" | "DRAW" | "TWO") {
  if (value === "ONE") {
    return "1";
  }

  if (value === "DRAW") {
    return "0";
  }

  return "2";
}

function roundSourceHint(source: RoundSource) {
  if (source === "fixture_master") {
    return "全試合リスト由来のラウンドです。日程や会場は管理者フロー側の更新が優先されます。";
  }

  if (source === "toto_official_manual") {
    return "toto公式対象回ベースです。公式人気は管理者が貼り付けた公式ソースを使います。";
  }

  if (source === "demo_sample") {
    return "デモ混じりの参考ラウンドです。購入判断には使わないでください。";
  }

  return "手入力ベースのラウンドです。補助表示の出どころは取り込みメモや管理メモも確認してください。";
}

function QuickPickButton(props: {
  active: boolean;
  label: OutcomeValue;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cx(
        "inline-flex h-14 w-full items-center justify-center rounded-2xl border px-4 text-base font-semibold transition focus-visible:outline-none focus-visible:ring-4",
        props.active
          ? "border-emerald-600 bg-emerald-700 text-white shadow-[0_18px_40px_-28px_rgba(4,120,87,0.7)] focus-visible:ring-emerald-500/20"
          : "border-slate-200 bg-white/94 text-slate-700 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/70 focus-visible:ring-emerald-500/15",
      )}
    >
      {props.label}
    </button>
  );
}

function SimpleViewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const requestedUserId = getSingleSearchParam(searchParams.get("user"));
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);
  const [draftValues, setDraftValues] = useState<Record<string, OutcomeValue | "">>({});
  const [draftIdentity, setDraftIdentity] = useState<string>("empty");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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

    const nextValues = Object.fromEntries(
      data.round.matches.map((match) => {
        const existing = data.round.picks.find(
          (pick) => pick.matchId === match.id && pick.userId === activeUser.id,
        );
        return [
          match.id,
          existing ? enumToOutcomeValue(existing.pick) : "",
        ] as const;
      }),
    );

    queueMicrotask(() => {
      setDraftValues(nextValues);
      setDraftIdentity(baseIdentity);
    });
  }, [activeUser, baseIdentity, data, draftIdentity]);

  const summary = useMemo(() => {
    if (!data) {
      return null;
    }

    let aiAligned = 0;
    let humanAligned = 0;
    let publicAligned = 0;
    let contrarianCount = 0;
    let drawCount = 0;

    data.round.matches.forEach((match) => {
      const pick = draftValues[match.id];
      if (!pick) {
        return;
      }

      const aiFavorite = favoriteOutcomeForBucket(match, "model");
      const publicFavorite = favoriteOutcomeForBucket(match, "official");
      const humanOptions = humanConsensusOutcomes(match);

      if (pick === aiFavorite) {
        aiAligned += 1;
      }

      if (humanOptions.includes(pick)) {
        humanAligned += 1;
      }

      if (pick === publicFavorite) {
        publicAligned += 1;
      } else if (publicFavorite && pick !== publicFavorite) {
        contrarianCount += 1;
      }

      if (pick === "0") {
        drawCount += 1;
      }
    });

    const filledCount = Object.values(draftValues).filter(Boolean).length;
    const picksString = data.round.matches
      .map((match) => draftValues[match.id] || "・")
      .join(" ");

    return {
      aiAligned,
      contrarianCount,
      drawCount,
      filledCount,
      humanAligned,
      picksString,
      publicAligned,
    };
  }, [data, draftValues]);
  const candidatePreviewTickets = useMemo(
    () => (data ? sortCandidateTickets(data.round.candidateTickets).slice(0, 4) : []),
    [data],
  );
  const estimateStatus = data
    ? roundEstimateStatusBanner({
        competitionType: data.round.competitionType,
        probabilityReadiness: data.round.probabilityReadiness,
        roundSource: data.round.roundSource,
      })
    : null;

  if (!isSupabaseConfigured()) {
    return <ConfigurationNotice />;
  }

  if (!roundId) {
    return <RoundRequiredNotice />;
  }

  if (loading && !data) {
    return <LoadingNotice title="自分の予想を準備中" />;
  }

  if (error === "選択したラウンドが見つかりません。") {
    return <RoundMissingNotice onRetry={() => void refresh()} />;
  }

  if (error) {
    return <ErrorNotice error={error} onRetry={() => void refresh()} />;
  }

  if (!data || !activeUser || !summary) {
    return <RoundRequiredNotice />;
  }

  const winnerLike = isWinnerLikeRound({
    activeMatchCount: data.round.activeMatchCount,
    matchCount: data.round.matches.length,
    productType: data.round.productType,
    requiredMatchCount: data.round.requiredMatchCount,
  });
  const remainingCount = Math.max(data.round.matches.length - summary.filledCount, 0);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="自分の予想"
        title="自分の予想を入れる"
        description="試合を見ながら 1 / 0 / 2 を入れて、そのまま保存できます。"
      />

      <RoundNav
        roundId={data.round.id}
        roundStatus={roundStatusLabel[data.round.status]}
        roundTitle={data.round.title}
        userId={activeUser.id}
        items={[
          { href: buildRoundHref(appRoute.simpleView, data.round.id, { user: activeUser.id }), label: "自分の予想" },
          ...(winnerLike
            ? [
                {
                  href: buildRoundHref(appRoute.winnerValue, data.round.id, { user: activeUser.id }),
                  label: "WINNERボード",
                },
              ]
            : []),
          { href: buildRoundHref(appRoute.pickRoom, data.round.id, { user: activeUser.id }), label: "候補カード" },
          { href: buildRoundHref(appRoute.picks, data.round.id, { user: activeUser.id }), label: "詳細入力" },
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

      <SectionCard title="メンバー" description="誰の13予想を入れるかを選びます。スマホでは横にスワイプできます。">
        <div className="rounded-[22px] border border-slate-200 bg-slate-50/90 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={activeUser.role === "admin" ? "teal" : "info"}>
              {activeUser.role === "admin" ? "予想者" : "メンバー"}
            </Badge>
            <p className="text-sm leading-6 text-slate-600">
              今は <span className="font-semibold text-slate-950">{activeUser.name}</span> の 13 予想を編集中です。
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
                  router.push(buildRoundHref(appRoute.simpleView, data.round.id, { user: user.id }))
                }
                className={user.id === activeUser.id ? buttonClassName : secondaryButtonClassName}
              >
                {user.name}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="自分の13予想"
        description="各試合の補助表示を見ながら 1 / 0 / 2 をタップしてください。カード右上のバッジは、公式・AI・人力の出どころを示しています。"
      >
        <form className="space-y-4" onSubmit={handleSave}>
          {data.round.matches.map((match) => {
            const publicFavorite = favoriteOutcomeForBucket(match, "official");
            const aiFavorite = favoriteOutcomeForBucket(match, "model");
            const humanFavorites = humanConsensusOutcomes(match);
            const overlayBadge = singlePickOverlayBadge(
              match,
              draftValues[match.id] || null,
            );

            return (
              <div
                key={match.id}
                className="rounded-[24px] border border-slate-200 bg-white/90 px-4 py-4 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.28)]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        試合 {match.matchNo}
                      </p>
                      {match.stage ? <Badge tone="slate">{match.stage}</Badge> : null}
                      {match.kickoffTime ? (
                        <Badge tone="slate">{formatDateTime(match.kickoffTime)}</Badge>
                      ) : null}
                    </div>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                      {match.homeTeam} vs {match.awayTeam}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      公式は人気、モデルは試算、人力は手入力の見立てです。
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge tone="slate">公式 {publicFavorite ?? "—"}</Badge>
                    <Badge tone="teal">AI {aiFavorite ?? "—"}</Badge>
                    <Badge tone="info">人力 {humanFavorites.join("/") || "—"}</Badge>
                    <Badge tone={overlayBadge.tone}>{overlayBadge.label}</Badge>
                    {(match.consensusD ?? 0) >= 1.5 ? <Badge tone="draw">引分警報</Badge> : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {(["1", "0", "2"] as const).map((value) => (
                      <QuickPickButton
                        key={value}
                        label={value}
                        active={draftValues[match.id] === value}
                        onClick={() =>
                          setDraftValues((current) => ({
                            ...current,
                            [match.id]: current[match.id] === value ? "" : value,
                          }))
                        }
                      />
                    ))}
                  </div>

                  <div className="rounded-[20px] border border-slate-200 bg-slate-50/90 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      現在の選択
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {draftValues[match.id] || "未選択"}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {overlayBadge.label}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="sticky bottom-4 z-20 rounded-[26px] border border-emerald-200 bg-[linear-gradient(145deg,rgba(236,253,245,0.98),rgba(220,252,231,0.94))] p-4 shadow-[0_28px_60px_-36px_rgba(5,150,105,0.35)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={remainingCount === 0 ? "teal" : "warning"}>
                    未入力 {remainingCount}
                  </Badge>
                  <Badge tone="info">
                    公式一致 {formatPercent(summary.publicAligned / Math.max(data.round.matches.length, 1), 0)}
                  </Badge>
                  <Badge tone="slate">逆張り {summary.contrarianCount}</Badge>
                  <Badge tone="draw">引分 {summary.drawCount}</Badge>
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700/70">
                  現在の並び
                </p>
                <p className="font-mono text-sm font-semibold tracking-[0.18em] text-slate-950 sm:text-base sm:tracking-[0.28em]">
                  {summary.picksString}
                </p>
                <p className="text-sm text-slate-600">
                  保存ボタンを押すまで round には反映されません。
                </p>
              </div>
              <button type="submit" className={buttonClassName} disabled={saving}>
                {saving ? "保存中..." : "自分の予想を保存"}
              </button>
            </div>
          </div>
        </form>
      </SectionCard>

      <CollapsibleSectionCard
        title="いま出ている候補"
        description="王道や EV 狙いの並びをざっと見たいときだけ開きます。細かい比較は候補カード側で見られます。"
        actions={
          <Link
            href={buildRoundHref(appRoute.pickRoom, data.round.id, { user: activeUser.id })}
            className={secondaryButtonClassName}
          >
            候補を詳しく見る
          </Link>
        }
        defaultOpen={false}
        badge={<Badge tone="slate">候補の見本</Badge>}
      >
        {candidatePreviewTickets.length === 0 ? (
          <p className="text-sm leading-6 text-slate-600">
            まだ候補カードがありません。候補カードを開くと、自動更新された候補が並ぶことがあります。
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {candidatePreviewTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="rounded-[22px] border border-slate-200 bg-white/90 px-4 py-4 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.28)]"
              >
                <div className="flex flex-wrap gap-2">
                  <Badge tone="slate">{ticket.label}</Badge>
                  <Badge tone={ticket.evPercent !== null ? "teal" : "sky"}>
                    {ticket.evPercent !== null ? `推定EV ${ticket.evPercent.toFixed(0)}%` : `Proxy ${ticket.proxyScore?.toFixed(2) ?? "—"}`}
                  </Badge>
                </div>
                <p className="mt-3 font-mono text-sm tracking-[0.24em] text-slate-900">
                  {ticket.picks.map((pick) => pick.pick).join(" ")}
                </p>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSectionCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="ラウンド" value={data.round.title} compact />
        <StatCard label="対象試合数" value={data.round.matches.length} compact />
        <StatCard
          label="入力済み"
          value={`${summary.filledCount}/${data.round.matches.length}`}
          compact
        />
        <StatCard
          label="AI一致率"
          value={formatPercent(summary.aiAligned / Math.max(data.round.matches.length, 1), 0)}
          compact
        />
        <StatCard
          label="人力一致率"
          value={formatPercent(
            summary.humanAligned / Math.max(data.round.matches.length, 1),
            0,
          )}
          compact
        />
      </div>

      <CollapsibleSectionCard
        title="この画面の見方"
        description="補助表示の出どころと保存ルールを先に見ておくと、スマホでも迷いにくくなります。"
        defaultOpen={false}
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
          <Badge tone={activeUser.role === "admin" ? "teal" : "info"}>
            入力中 {activeUser.name}
          </Badge>
          {data.round.totoOfficialRound ? <Badge tone="teal">toto公式人気あり</Badge> : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 text-sm leading-6 text-slate-600">
            <p>{roundSourceHint(data.round.roundSource)}</p>
            <p>
              公式人気は crowd の見え方、AI候補はモデル確率、人力は管理者の手入力予想です。どれも補助表示なので、最終判断は自分で選んでください。
            </p>
            <p>
              {data.round.sourceNote
                ? `管理メモ: ${data.round.sourceNote}`
                : "管理メモは未設定です。気になるときはラウンド詳細の元データも確認してください。"}
            </p>
          </div>
          <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-950">
            <p className="font-semibold">保存は明示操作です。</p>
            <p className="mt-2">
              1 / 0 / 2 をタップしただけでは round に反映されません。下の固定バーの
              「自分の予想を保存」を押した時点で保存されます。
            </p>
          </div>
        </div>
      </CollapsibleSectionCard>

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
    </div>
  );
}

export default function SimpleViewPage() {
  return (
    <Suspense fallback={<LoadingNotice title="自分の予想を準備中" />}>
      <SimpleViewPageContent />
    </Suspense>
  );
}
