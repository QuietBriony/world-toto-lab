"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";

import {
  RouteGlossaryCard,
  RoundProgressCallout,
} from "@/components/app/round-guides";
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
  cx,
  fieldClassName,
  PageHeader,
  SectionCard,
  secondaryButtonClassName,
  StatCard,
} from "@/components/ui";
import {
  aiRecommendedOutcomes,
  enumToOutcome,
  favoriteOutcomeForBucket,
  formatOutcomeSet,
  formatPercent,
  humanConsensusOutcomes,
  humanOverlayBadge,
  majorityHumanOutcome,
  pickCounts,
  pickDistribution,
  roundStatusLabel,
  singlePickOverlayBadge,
  type OutcomeValue,
} from "@/lib/domain";
import { nullableString, parseOutcome } from "@/lib/forms";
import {
  pickSupportFromValue,
  pickSupportValue,
  resolveSupportedOutcome,
  supportLabel,
} from "@/lib/pick-support";
import { appRoute, buildRoundHref, getSingleSearchParam } from "@/lib/round-links";
import { replacePicks } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { Pick, User } from "@/lib/types";
import { useRoundWorkspace } from "@/lib/use-app-data";
import {
  buildMemberUsageMap,
  describeRoundMemberStatus,
} from "@/lib/member-usage";
import {
  filterPredictors,
  isPredictorRole,
  userRoleLabel,
} from "@/lib/users";

type DraftPickState = {
  identity: string;
  supportValues: Record<string, string>;
  values: Record<string, OutcomeValue | "">;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "不明なエラーです。";
}

function buildDraftPickIdentity(input: {
  activeUserId: string;
  picks: Array<{
    id: string;
    note: string | null;
    pick: "ONE" | "DRAW" | "TWO";
    updatedAt: Date | string;
    userId: string;
  }>;
  roundId: string;
}) {
  return [
    input.roundId,
    input.activeUserId,
    ...input.picks.map(
      (pick) =>
        `${pick.id}:${pick.userId}:${pick.pick}:${String(pick.updatedAt)}:${pick.note ?? ""}`,
    ),
  ].join("|");
}

function buildDraftSupportValues(input: {
  activeUserId: string;
  matches: Array<{ id: string }>;
  picks: Array<{
    matchId: string;
    support: { kind: "ai" } | { kind: "manual" } | { kind: "predictor"; userId: string };
    userId: string;
  }>;
  userRole: "admin" | "member";
}) {
  const nextValues: Record<string, string> = {};

  for (const match of input.matches) {
    const existing = input.picks.find(
      (pick) => pick.matchId === match.id && pick.userId === input.activeUserId,
    );
    nextValues[match.id] =
      input.userRole === "admin" ? "manual" : pickSupportValue(existing?.support);
  }

  return nextValues;
}

function buildDraftPickValues(input: {
  activeUserId: string;
  matches: Array<{
    id: string;
    modelProb0: number | null;
    modelProb1: number | null;
    modelProb2: number | null;
    recommendedOutcomes: string | null;
  }>;
  picks: Array<{
    matchId: string;
    pick: "ONE" | "DRAW" | "TWO";
    support: { kind: "ai" } | { kind: "manual" } | { kind: "predictor"; userId: string };
    userId: string;
  }>;
  userRole: "admin" | "member";
}): Record<string, OutcomeValue | ""> {
  const nextValues: Record<string, OutcomeValue | ""> = {};

  for (const match of input.matches) {
    const existing = input.picks.find(
      (pick) => pick.matchId === match.id && pick.userId === input.activeUserId,
    );

    if (!existing) {
      nextValues[match.id] = "";
      continue;
    }

    if (input.userRole === "admin" || existing.support.kind === "manual") {
      nextValues[match.id] = enumToOutcome(existing.pick) ?? "";
      continue;
    }

    nextValues[match.id] =
      resolveSupportedOutcome({
        match,
        picks: input.picks,
        support: existing.support,
      }) ||
      enumToOutcome(existing.pick) ||
      "";
  }

  return nextValues;
}

function quickPickButtonClassName(input: {
  active: boolean;
  suggested?: boolean;
  tone: "draw" | "neutral" | "side";
}) {
  return cx(
    "inline-flex h-11 min-w-11 items-center justify-center rounded-2xl border px-3 text-sm font-semibold transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4",
    input.active
      ? "border-emerald-600 bg-emerald-700 text-white shadow-[0_20px_40px_-28px_rgba(4,120,87,0.68)] focus-visible:ring-emerald-500/20"
      : "bg-white/92 text-slate-700 focus-visible:ring-emerald-500/15",
    input.tone === "draw"
      ? input.active
        ? ""
        : "border-sky-200 hover:border-sky-300 hover:bg-sky-50"
      : input.tone === "side"
        ? input.active
          ? ""
          : "border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50/60"
        : input.active
          ? ""
          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
    input.suggested && !input.active && "ring-1 ring-amber-300/70",
  );
}

function sourceButtonClassName(input: { active: boolean; disabled?: boolean }) {
  return cx(
    "inline-flex items-center justify-center rounded-2xl border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4",
    input.active
      ? "border-emerald-600 bg-emerald-700 text-white focus-visible:ring-emerald-500/20"
      : "border-slate-200 bg-white/92 text-slate-700 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-300/35",
    input.disabled && "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 hover:translate-y-0",
  );
}

function PicksPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const requestedUserId = getSingleSearchParam(searchParams.get("user"));
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [draftPickState, setDraftPickState] = useState<DraftPickState>({
    identity: "empty",
    supportValues: {},
    values: {},
  });

  const predictorUsers = useMemo(
    () => (data ? filterPredictors(data.users) : []),
    [data],
  );
  const activeUser =
    data?.users.find((user) => user.id === requestedUserId) ??
    predictorUsers[0] ??
    data?.users[0] ??
    null;
  const activeUserIsPredictor = isPredictorRole(activeUser?.role ?? "member");
  const draftPickIdentity =
    data && activeUser
      ? buildDraftPickIdentity({
          activeUserId: activeUser.id,
          picks: data.round.picks,
          roundId: data.round.id,
        })
      : "empty";
  const baseDraftSupportValues =
    data && activeUser
      ? buildDraftSupportValues({
          activeUserId: activeUser.id,
          matches: data.round.matches,
          picks: data.round.picks,
          userRole: activeUser.role,
        })
      : {};
  const baseDraftPickValues =
    data && activeUser
      ? buildDraftPickValues({
          activeUserId: activeUser.id,
          matches: data.round.matches,
          picks: data.round.picks,
          userRole: activeUser.role,
        })
      : {};
  const resolvedDraftPickValues =
    draftPickState.identity === draftPickIdentity
      ? draftPickState.values
      : baseDraftPickValues;
  const resolvedDraftSupportValues =
    draftPickState.identity === draftPickIdentity
      ? draftPickState.supportValues
      : baseDraftSupportValues;
  const hasVisibleUnsavedChanges =
    hasUnsavedChanges && draftPickState.identity === draftPickIdentity;

  const picksByMatch = useMemo(() => {
    const map = new Map<string, Pick[]>();
    if (!data) {
      return map;
    }

    for (const pick of data.round.picks) {
      const current = map.get(pick.matchId) ?? [];
      current.push(pick);
      map.set(pick.matchId, current);
    }

    return map;
  }, [data]);

  const pickByMatchUser = useMemo(() => {
    const map = new Map<string, Pick>();
    if (!data) {
      return map;
    }

    for (const pick of data.round.picks) {
      map.set(`${pick.matchId}:${pick.userId}`, pick);
    }

    return map;
  }, [data]);

  const userById = useMemo(() => {
    const map = new Map<string, User>();
    if (!data) {
      return map;
    }

    data.users.forEach((user) => {
      map.set(user.id, user);
    });
    return map;
  }, [data]);
  const roundMemberUsageMap = useMemo(() => {
    if (!data) {
      return new Map();
    }

    return buildMemberUsageMap({
      users: data.users,
      picks: data.round.picks,
      scoutReports: data.round.scoutReports,
      reviewNotes: data.round.reviewNotes,
    });
  }, [data]);

  const filledPickCount =
    data && activeUser
      ? data.round.matches.filter((match) => Boolean(resolvedDraftPickValues[match.id])).length
      : 0;
  const pendingPickCount = data ? Math.max(data.round.matches.length - filledPickCount, 0) : 0;
  const formId = activeUser ? `picks-form-${activeUser.id}` : "picks-form";
  const orderedMatches =
    data?.round.matches
      .slice()
      .sort((left, right) => {
        const leftFilled = resolvedDraftPickValues[left.id] ? 1 : 0;
        const rightFilled = resolvedDraftPickValues[right.id] ? 1 : 0;

        if (leftFilled !== rightFilled) {
          return leftFilled - rightFilled;
        }

        return left.matchNo - right.matchNo;
      }) ?? [];

  const predictorSummaries = useMemo(() => {
    if (!data) {
      return [];
    }

    return predictorUsers.map((user) => {
      const entries = data.round.matches.map((match) => {
        const pick = pickByMatchUser.get(`${match.id}:${user.id}`);
        const pickValue = enumToOutcome(pick?.pick) ?? "";
        const aiBase = aiRecommendedOutcomes(match);
        const aiPrimary = favoriteOutcomeForBucket(match, "model");

        return {
          aiBase,
          aiPrimary,
          match,
          pickValue,
        };
      });

      const filledCount = entries.filter((entry) => Boolean(entry.pickValue)).length;
      const aiAlignedCount = entries.filter(
        (entry) => entry.pickValue && entry.pickValue === entry.aiPrimary,
      ).length;
      const drawOverlayCount = entries.filter(
        (entry) => entry.pickValue === "0" && !entry.aiBase.includes("0"),
      ).length;
      const alternateLineCount = entries.filter((entry) => {
        const pickValue = entry.pickValue;
        return pickValue === "1" || pickValue === "0" || pickValue === "2"
          ? !entry.aiBase.includes(pickValue)
          : false;
      }).length;

      return {
        aiAlignedCount,
        alternateLineCount,
        drawOverlayCount,
        filledCount,
        user,
      };
    });
  }, [data, pickByMatchUser, predictorUsers]);

  useEffect(() => {
    if (!hasVisibleUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasVisibleUnsavedChanges]);

  const applyDraftState = (input: {
    supportValues?: Record<string, string>;
    values: Record<string, OutcomeValue | "">;
  }) => {
    setDraftPickState({
      identity: draftPickIdentity,
      supportValues: input.supportValues ?? resolvedDraftSupportValues,
      values: input.values,
    });
    setHasUnsavedChanges(true);
  };

  const applyAiPrimaryToPending = () => {
    if (!data || !activeUserIsPredictor) {
      return;
    }

    const nextValues = { ...resolvedDraftPickValues };

    data.round.matches.forEach((match) => {
      if (nextValues[match.id]) {
        return;
      }

      const aiPrimary = favoriteOutcomeForBucket(match, "model");
      if (aiPrimary) {
        nextValues[match.id] = aiPrimary;
      }
    });

    applyDraftState({ values: nextValues });
  };

  const applySupportSelection = (supportValue: string, pendingOnly: boolean) => {
    if (!data || activeUserIsPredictor) {
      return;
    }

    const nextValues = { ...resolvedDraftPickValues };
    const nextSupportValues = { ...resolvedDraftSupportValues };
    const support = pickSupportFromValue(supportValue);

    data.round.matches.forEach((match) => {
      if (pendingOnly && nextValues[match.id]) {
        return;
      }

      const nextPick = resolveSupportedOutcome({
        match,
        picks: data.round.picks,
        support,
      });

      if (!nextPick) {
        return;
      }

      nextValues[match.id] = nextPick;
      nextSupportValues[match.id] = supportValue;
    });

    applyDraftState({
      supportValues: nextSupportValues,
      values: nextValues,
    });
  };

  const handleSwitchUser = (userId: string) => {
    if (
      hasVisibleUnsavedChanges &&
      !window.confirm("未保存の変更があります。保存せずにユーザーを切り替えますか？")
    ) {
      return;
    }

    router.push(
      buildRoundHref(appRoute.picks, data?.round.id ?? roundId, {
        user: userId,
      }),
    );
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!data || !activeUser) {
      return;
    }

    setSaving(true);
    setSubmitError(null);

    try {
      const formData = new FormData(event.currentTarget);
      await replacePicks({
        roundId: data.round.id,
        userId: activeUser.id,
        picks: data.round.matches.map((match) => {
          const support = activeUserIsPredictor
            ? { kind: "manual" as const }
            : pickSupportFromValue(resolvedDraftSupportValues[match.id]);
          const pickValue = activeUserIsPredictor
            ? resolvedDraftPickValues[match.id] ?? ""
            : resolvedDraftPickValues[match.id] ??
              resolveSupportedOutcome({
                match,
                picks: data.round.picks,
                support,
              });

          return {
            matchId: match.id,
            note: nullableString(formData, `note_${match.id}`),
            pick: parseOutcome(pickValue),
            support,
          };
        }),
      });
      setHasUnsavedChanges(false);
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
        eyebrow="支持 / 予想"
        title="AI と予想者を比べて決める"
        description="予想者は 1 / 0 / 2 を直接入れ、ウォッチ担当は AI か予想者のどちらに乗るかを選ぶ入力画面です。"
      />

      {!isSupabaseConfigured() ? (
        <ConfigurationNotice />
      ) : !roundId ? (
        <RoundRequiredNotice />
      ) : loading && !data ? (
        <LoadingNotice title="支持 / 予想を読み込み中" />
      ) : error && !data ? (
        <ErrorNotice error={error} onRetry={() => void refresh()} />
      ) : data ? (
        <>
          <RoundNav
            roundId={data.round.id}
            roundTitle={data.round.title}
            roundStatus={roundStatusLabel[data.round.status]}
            currentPath={appRoute.picks}
            userId={activeUser?.id}
          />

          <RoundProgressCallout
            currentPath={appRoute.picks}
            matches={data.round.matches}
            picks={data.round.picks}
            roundId={data.round.id}
            scoutReports={data.round.scoutReports}
            users={data.users}
          />

          <RouteGlossaryCard
            currentPath={appRoute.picks}
            defaultOpen={data.round.picks.length === 0}
          />

          {data.users.length === 0 || !activeUser ? (
            <SectionCard
              title="共有メンバーがまだありません"
              description="ダッシュボードでサンプルメンバーを作成してから利用してください。"
              actions={
                <Link href={`${appRoute.dashboard}#shared-members`} className={secondaryButtonClassName}>
                  メンバー設定へ
                </Link>
              }
            >
              <p className="text-sm text-slate-600">
                支持 / 予想は共有メンバー前提の入力画面です。
              </p>
            </SectionCard>
          ) : (
            <>
              <SectionCard
                title="入力ユーザー切り替え"
                description="予想者は直接予想し、ウォッチ担当は AI か予想者のどちらに乗るかを選びます。"
                actions={
                  <Link href={`${appRoute.dashboard}#shared-members`} className={secondaryButtonClassName}>
                    メンバー設定へ
                  </Link>
                }
              >
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {data.users.map((user) => (
                      (() => {
                        const isActive = user.id === activeUser.id;
                        const status = describeRoundMemberStatus(
                          roundMemberUsageMap.get(user.id) ?? {
                            canQuickDelete: true,
                            hasDirectInput: false,
                            isEmpty: true,
                            isPlaceholderName: false,
                            pickCount: 0,
                            reviewNoteCount: 0,
                            scoutReportCount: 0,
                            supportRefCount: 0,
                            userId: user.id,
                          },
                          data.round.matches.length,
                        );

                        return (
                          <button
                            type="button"
                            key={user.id}
                            onClick={() => handleSwitchUser(user.id)}
                            className={cx(
                              "grid gap-3 rounded-[22px] border p-4 text-left transition focus-visible:outline-none focus-visible:ring-4",
                              isActive
                                ? "border-emerald-500 bg-[linear-gradient(135deg,rgba(10,65,37,0.96),rgba(17,122,73,0.9))] text-white shadow-[0_22px_40px_-28px_rgba(4,120,87,0.68)] focus-visible:ring-emerald-500/20"
                                : "border-slate-200 bg-white/92 text-slate-800 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-300/35",
                            )}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className={cx("font-semibold", isActive ? "text-white" : "text-slate-900")}>
                                {user.name}
                              </span>
                              <Badge tone={isActive ? "default" : user.role === "admin" ? "teal" : "slate"}>
                                {userRoleLabel[user.role]}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone={isActive && status.tone === "slate" ? "default" : status.tone}>
                                {status.label}
                              </Badge>
                              <span className={cx("text-xs leading-5", isActive ? "text-white/80" : "text-slate-500")}>
                                {status.detail}
                              </span>
                            </div>
                          </button>
                        );
                      })()
                    ))}
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/85 p-4 text-sm text-slate-600">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={activeUserIsPredictor ? "teal" : "sky"}>いま入力中</Badge>
                      <span className="font-semibold text-slate-900">{activeUser.name}</span>
                      <Badge tone={activeUserIsPredictor ? "teal" : "slate"}>
                        {userRoleLabel[activeUser.role]}
                      </Badge>
                      {(() => {
                        const status = describeRoundMemberStatus(
                          roundMemberUsageMap.get(activeUser.id) ?? {
                            canQuickDelete: true,
                            hasDirectInput: false,
                            isEmpty: true,
                            isPlaceholderName: false,
                            pickCount: 0,
                            reviewNoteCount: 0,
                            scoutReportCount: 0,
                            supportRefCount: 0,
                            userId: activeUser.id,
                          },
                          data.round.matches.length,
                        );

                        return <Badge tone={status.tone}>{status.label}</Badge>;
                      })()}
                    </div>
                    <p className="mt-2 leading-6">
                      {activeUserIsPredictor
                        ? "この人は AI に対する人力ラインを作る役です。"
                        : "この人は AI か予想者のどちらを支持するかを選ぶ役です。"}
                    </p>
                    <p className="mt-2 leading-6">
                      あだ名の追加や `予想者 / ウォッチ` の切り替えは `メンバー設定へ` から戻れます。
                    </p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="AI と予想者を見比べる"
                description="ウォッチ担当は、ここで AI と予想者のズレを見てから支持先を決められます。"
              >
                {predictorSummaries.length === 0 ? (
                  <div className="rounded-[22px] border border-amber-200 bg-amber-50/90 p-4 text-sm leading-6 text-amber-950">
                    まだ予想者がいません。ダッシュボードで少なくとも 1 人を `予想者` にすると、
                    AI と人力の比較が見えるようになります。
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-3">
                    {predictorSummaries.map((summary) => (
                      <div
                        key={summary.user.id}
                        className="rounded-[22px] border border-white/80 bg-white/76 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)]"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="teal">予想者</Badge>
                          <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                            {summary.user.name}
                          </h3>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <StatCard
                            label="入力済み"
                            value={`${summary.filledCount}/${data.round.matches.length}`}
                            compact
                          />
                          <StatCard
                            label="AI本線と同じ"
                            value={`${summary.aiAlignedCount}`}
                            compact
                          />
                          <StatCard
                            label="0を追加"
                            value={`${summary.drawOverlayCount}`}
                            compact
                          />
                          <StatCard
                            label="AIと別筋"
                            value={`${summary.alternateLineCount}`}
                            compact
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {activeUserIsPredictor ? (
                <>
                  <section className="grid gap-4 lg:grid-cols-4">
                    {(() => {
                      const agreementBase = data.round.matches.filter(
                        (match) => (picksByMatch.get(match.id) ?? []).length > 0,
                      );
                      const agreementMatches = agreementBase.filter((match) => {
                        const humanMajority = majorityHumanOutcome(picksByMatch.get(match.id) ?? []);
                        const aiPrimary = favoriteOutcomeForBucket(match, "model");
                        return humanMajority !== null && aiPrimary !== null && humanMajority === aiPrimary;
                      });

                      const activeEntries = data.round.matches.map((match) => {
                        const pickValue = resolvedDraftPickValues[match.id] ?? "";
                        return {
                          aiBase: aiRecommendedOutcomes(match),
                          aiPrimary: favoriteOutcomeForBucket(match, "model"),
                          match,
                          pickValue,
                        };
                      });

                      const aiPrimaryAlignedCount = activeEntries.filter(
                        (entry) => entry.pickValue && entry.pickValue === entry.aiPrimary,
                      ).length;

                      const drawOverlayCount = activeEntries.filter(
                        (entry) => entry.pickValue === "0" && !entry.aiBase.includes("0"),
                      ).length;

                      const alternateLineCount = activeEntries.filter((entry) => {
                        const pickValue = entry.pickValue;
                        return pickValue === "1" || pickValue === "0" || pickValue === "2"
                          ? !entry.aiBase.includes(pickValue)
                          : false;
                      }).length;

                      return (
                        <>
                          <StatCard
                            label="AI本線に重ねた数"
                            value={`${aiPrimaryAlignedCount}/${data.round.matches.length}`}
                            hint={`${activeUser.name} が AI 本命と同じ 1 / 0 / 2 を選んだ数`}
                          />
                          <StatCard
                            label="AIに0を追加した数"
                            value={`${drawOverlayCount}`}
                            hint="AI が 0 を含まない試合に、人力で 0 を足した件数"
                          />
                          <StatCard
                            label="AIと別筋で入れた数"
                            value={`${alternateLineCount}`}
                            hint={
                              alternateLineCount > 0
                                ? `${activeUser.name} が AI 推奨外を選んだ試合数`
                                : "今のところ AI 推奨の範囲内で入力しています"
                            }
                          />
                          <StatCard
                            label="全体のAI一致率"
                            value={
                              agreementBase.length > 0
                                ? formatPercent(agreementMatches.length / agreementBase.length)
                                : "—"
                            }
                            hint="多数派の人力予想と AI 本命の一致率"
                          />
                        </>
                      );
                    })()}
                  </section>

                  <SectionCard
                    title="予想者として入れる"
                    description="未入力の試合が先頭に出ます。まず AI 本命を流し込んで、必要な試合だけ人力でずらす使い方がいちばん速いです。"
                    actions={
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={pendingPickCount === 0 ? "teal" : "amber"}>
                          未入力 {pendingPickCount}
                        </Badge>
                        <button
                          type="button"
                          className={secondaryButtonClassName}
                          onClick={applyAiPrimaryToPending}
                        >
                          未入力にAI本命を入れる
                        </button>
                      </div>
                    }
                  >
                    <div className="grid gap-3 lg:grid-cols-3">
                      <div className="rounded-[22px] border border-white/80 bg-white/76 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)]">
                        <div className="font-display text-[11px] uppercase tracking-[0.34em] text-amber-800/75">
                          1
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          まず `未入力にAI本命を入れる` で叩き台を作ります。
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-white/80 bg-white/76 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)]">
                        <div className="font-display text-[11px] uppercase tracking-[0.34em] text-sky-800/75">
                          2
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          0 を足したい試合や逆張りしたい試合だけ、ボタンで 1 / 0 / 2 を直します。
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-white/80 bg-white/76 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)]">
                        <div className="font-display text-[11px] uppercase tracking-[0.34em] text-teal-800/75">
                          3
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          保存してから全体の分布を見ると、どこで別筋を作ったかがはっきり見えます。
                        </p>
                      </div>
                    </div>
                  </SectionCard>
                </>
              ) : (
                <>
                  <section className="grid gap-4 lg:grid-cols-4">
                    <StatCard
                      label="AIを支持"
                      value={`${
                        data.round.matches.filter(
                          (match) => resolvedDraftSupportValues[match.id] === "ai",
                        ).length
                      }`}
                      hint={`${activeUser.name} が AI に乗っている試合数`}
                    />
                    <StatCard
                      label="予想者を支持"
                      value={`${
                        data.round.matches.filter((match) => {
                          const value = resolvedDraftSupportValues[match.id];
                          return Boolean(value) && value !== "manual" && value !== "ai";
                        }).length
                      }`}
                      hint="AI ではなく予想者側に乗っている試合数"
                    />
                    <StatCard
                      label="未選択"
                      value={`${pendingPickCount}`}
                      hint="まだどちらに乗るか決めていない試合数"
                    />
                    <StatCard
                      label="採用済み"
                      value={`${filledPickCount}/${data.round.matches.length}`}
                      hint="支持先にあわせて 1 / 0 / 2 が決まっている試合数"
                    />
                  </section>

                  <SectionCard
                    title="ウォッチ担当として決める"
                    description="AI と予想者を比べて、どちらに乗るかだけ選びます。1 / 0 / 2 はその場で自動反映されます。"
                    actions={
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={pendingPickCount === 0 ? "teal" : "amber"}>
                          未選択 {pendingPickCount}
                        </Badge>
                        <button
                          type="button"
                          className={secondaryButtonClassName}
                          onClick={() => applySupportSelection("ai", true)}
                        >
                          未選択を AI にする
                        </button>
                        {predictorUsers.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            className={secondaryButtonClassName}
                            onClick={() => applySupportSelection(user.id, true)}
                          >
                            未選択を {user.name} にする
                          </button>
                        ))}
                      </div>
                    }
                  >
                    <div className="grid gap-3 lg:grid-cols-3">
                      <div className="rounded-[22px] border border-white/80 bg-white/76 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)]">
                        <div className="font-display text-[11px] uppercase tracking-[0.34em] text-amber-800/75">
                          1
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          上の比較カードで、AI と予想者のズレを先にざっと見ます。
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-white/80 bg-white/76 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)]">
                        <div className="font-display text-[11px] uppercase tracking-[0.34em] text-sky-800/75">
                          2
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          各試合で `AI` か `予想者` を押すだけで、その場で 1 / 0 / 2 が入ります。
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-white/80 bg-white/76 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)]">
                        <div className="font-display text-[11px] uppercase tracking-[0.34em] text-teal-800/75">
                          3
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          保存すると、全体の支持分布と採用ラインが一覧で見えます。
                        </p>
                      </div>
                    </div>
                  </SectionCard>
                </>
              )}

              <SectionCard
                title={
                  activeUserIsPredictor
                    ? `${activeUser.name} の予想入力表`
                    : `${activeUser.name} の支持先入力表`
                }
                description={
                  activeUserIsPredictor
                    ? "AI 基準線を見ながら、ボタンで 1 / 0 / 2 をすばやく入れられます。"
                    : "各試合で AI か予想者を選ぶと、採用される 1 / 0 / 2 が自動で反映されます。"
                }
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={pendingPickCount === 0 ? "teal" : "amber"}>
                      入力 {filledPickCount}/{data.round.matches.length}
                    </Badge>
                    <Badge tone="slate">未入力優先表示</Badge>
                    {hasVisibleUnsavedChanges ? (
                      <Badge tone="rose">未保存あり</Badge>
                    ) : (
                      <Badge tone="slate">保存済み</Badge>
                    )}
                    <button
                      type="submit"
                      form={formId}
                      className={buttonClassName}
                      disabled={saving}
                    >
                      {saving ? "保存中..." : activeUserIsPredictor ? "予想を保存" : "支持先を保存"}
                    </button>
                  </div>
                }
              >
                <form
                  id={formId}
                  key={activeUser.id}
                  onSubmit={handleSave}
                  onChange={() => setHasUnsavedChanges(true)}
                  className="space-y-5"
                >
                  <div className="overflow-x-auto">
                    <table
                      className={cx(
                        "text-left text-sm",
                        activeUserIsPredictor ? "min-w-[1120px]" : "min-w-[1320px]",
                      )}
                    >
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="px-3 py-3">番号</th>
                          <th className="px-3 py-3">試合</th>
                          <th className="px-3 py-3">AI基準線</th>
                          <th className="px-3 py-3">
                            {activeUserIsPredictor ? "自分の予想" : "予想者比較"}
                          </th>
                          <th className="px-3 py-3">
                            {activeUserIsPredictor ? "AIとのズレ" : "支持先"}
                          </th>
                          <th className="px-3 py-3">
                            {activeUserIsPredictor ? "全体の重なり" : "採用された予想"}
                          </th>
                          <th className="px-3 py-3">メモ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderedMatches.map((match) => {
                          const existing = pickByMatchUser.get(`${match.id}:${activeUser.id}`);
                          const counts = pickCounts(picksByMatch.get(match.id) ?? []);
                          const distribution = pickDistribution(counts);
                          const aiBase = aiRecommendedOutcomes(match);
                          const currentPick =
                            resolvedDraftPickValues[match.id] ??
                            enumToOutcome(existing?.pick) ??
                            "";
                          const pickBadge = singlePickOverlayBadge(match, currentPick || null);
                          const overlayBadge = humanOverlayBadge(match);
                          const activeSupportValue =
                            resolvedDraftSupportValues[match.id] ??
                            pickSupportValue(existing?.support);

                          return (
                            <tr key={match.id} className="border-b border-slate-100 align-top">
                              <td className="px-3 py-4 font-semibold text-slate-900">
                                {match.matchNo}
                              </td>
                              <td className="px-3 py-4">
                                <div className="font-medium text-slate-900">
                                  {match.homeTeam} 対 {match.awayTeam}
                                </div>
                                <div className="text-xs text-slate-500">
                                  第{match.matchNo}試合 / {match.consensusCall ?? "人力コンセンサス集計前"}
                                </div>
                              </td>
                              <td className="px-3 py-4">
                                <div className="flex flex-wrap gap-2">
                                  {aiBase.length === 0 ? (
                                    <Badge tone="slate">AI未設定</Badge>
                                  ) : (
                                    aiBase.map((outcome) => (
                                      <Badge key={`${match.id}-ai-${outcome}`} tone="amber">
                                        AI {outcome}
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
                                {activeUserIsPredictor ? (
                                  <>
                                    <div className="flex flex-wrap gap-2">
                                      {(["1", "0", "2"] as const).map((outcome) => {
                                        const aiPrimary = favoriteOutcomeForBucket(match, "model");

                                        return (
                                          <button
                                            key={`${match.id}-${outcome}`}
                                            type="button"
                                            className={quickPickButtonClassName({
                                              active: currentPick === outcome,
                                              suggested: aiPrimary === outcome,
                                              tone:
                                                outcome === "0"
                                                  ? "draw"
                                                  : outcome === "1"
                                                    ? "side"
                                                    : "neutral",
                                            })}
                                            onClick={() =>
                                              applyDraftState({
                                                values: {
                                                  ...resolvedDraftPickValues,
                                                  [match.id]: outcome,
                                                },
                                              })
                                            }
                                          >
                                            {outcome}
                                          </button>
                                        );
                                      })}
                                      <button
                                        type="button"
                                        className={cx(
                                          "inline-flex h-11 items-center justify-center rounded-2xl border px-3 text-xs font-semibold text-slate-500 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300/35",
                                          !currentPick && "border-slate-400 bg-slate-100 text-slate-700",
                                          currentPick && "border-slate-200 bg-white/92",
                                        )}
                                        onClick={() =>
                                          applyDraftState({
                                            values: {
                                              ...resolvedDraftPickValues,
                                              [match.id]: "",
                                            },
                                          })
                                        }
                                      >
                                        消す
                                      </button>
                                    </div>
                                    <div className="mt-2 text-xs text-slate-500">
                                      {favoriteOutcomeForBucket(match, "model")
                                        ? `AI本命 ${favoriteOutcomeForBucket(match, "model")}`
                                        : "AI本命なし"}
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    {predictorUsers.length === 0 ? (
                                      <span className="text-sm text-slate-500">予想者待ち</span>
                                    ) : (
                                      predictorUsers.map((user) => {
                                        const pick = pickByMatchUser.get(`${match.id}:${user.id}`);
                                        const value = enumToOutcome(pick?.pick);
                                        const disabled = !value;

                                        return (
                                          <div
                                            key={`${match.id}-${user.id}`}
                                            className="rounded-2xl border border-slate-200 bg-white/85 px-3 py-2"
                                          >
                                            <div className="text-xs text-slate-500">{user.name}</div>
                                            <div className="mt-1 flex items-center gap-2">
                                              <Badge tone={value ? singlePickOverlayBadge(match, value).tone : "slate"}>
                                                {value ?? "未入力"}
                                              </Badge>
                                              {disabled ? (
                                                <span className="text-xs text-slate-400">まだ予想待ち</span>
                                              ) : null}
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-4">
                                {activeUserIsPredictor ? (
                                  <Badge tone={pickBadge.tone}>{pickBadge.label}</Badge>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      className={sourceButtonClassName({
                                        active: activeSupportValue === "ai",
                                        disabled: !favoriteOutcomeForBucket(match, "model"),
                                      })}
                                      disabled={!favoriteOutcomeForBucket(match, "model")}
                                      onClick={() => {
                                        const supportValue = "ai";
                                        const nextPick = resolveSupportedOutcome({
                                          match,
                                          picks: data.round.picks,
                                          support: pickSupportFromValue(supportValue),
                                        });
                                        if (!nextPick) {
                                          return;
                                        }

                                        applyDraftState({
                                          supportValues: {
                                            ...resolvedDraftSupportValues,
                                            [match.id]: supportValue,
                                          },
                                          values: {
                                            ...resolvedDraftPickValues,
                                            [match.id]: nextPick,
                                          },
                                        });
                                      }}
                                    >
                                      AI
                                    </button>
                                    {predictorUsers.map((user) => {
                                      const supportValue = user.id;
                                      const nextPick = resolveSupportedOutcome({
                                        match,
                                        picks: data.round.picks,
                                        support: pickSupportFromValue(supportValue),
                                      });

                                      return (
                                        <button
                                          key={`${match.id}-support-${user.id}`}
                                          type="button"
                                          className={sourceButtonClassName({
                                            active: activeSupportValue === supportValue,
                                            disabled: !nextPick,
                                          })}
                                          disabled={!nextPick}
                                          onClick={() => {
                                            if (!nextPick) {
                                              return;
                                            }

                                            applyDraftState({
                                              supportValues: {
                                                ...resolvedDraftSupportValues,
                                                [match.id]: supportValue,
                                              },
                                              values: {
                                                ...resolvedDraftPickValues,
                                                [match.id]: nextPick,
                                              },
                                            });
                                          }}
                                        >
                                          {user.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-4 text-slate-600">
                                {activeUserIsPredictor ? (
                                  <>
                                    <div className="flex flex-wrap gap-2">
                                      <Badge tone={overlayBadge.tone}>{overlayBadge.label}</Badge>
                                      <Badge tone="slate">
                                        人力 {formatOutcomeSet(humanConsensusOutcomes(match))}
                                      </Badge>
                                    </div>
                                    <div className="mt-2">
                                      {counts["1"]} / {counts["0"]} / {counts["2"]}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {formatPercent(distribution["1"])} /{" "}
                                      {formatPercent(distribution["0"])} /{" "}
                                      {formatPercent(distribution["2"])}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex flex-wrap gap-2">
                                      <Badge tone={pickBadge.tone}>{currentPick || "未入力"}</Badge>
                                      <Badge tone="slate">
                                        {supportLabel(
                                          pickSupportFromValue(activeSupportValue),
                                          userById,
                                        )}
                                      </Badge>
                                    </div>
                                    <div className="mt-2 text-xs text-slate-500">
                                      AI {formatOutcomeSet(aiBase)} / 人力{" "}
                                      {majorityHumanOutcome(picksByMatch.get(match.id) ?? []) ?? "—"}
                                    </div>
                                  </>
                                )}
                              </td>
                              <td className="px-3 py-4">
                                <input
                                  name={`note_${match.id}`}
                                  defaultValue={existing?.note ?? ""}
                                  className={fieldClassName}
                                  placeholder={
                                    activeUserIsPredictor ? "判断メモ" : "支持理由メモ"
                                  }
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end">
                    <button type="submit" className={buttonClassName} disabled={saving}>
                      {saving ? "保存中..." : activeUserIsPredictor ? "予想を保存" : "支持先を保存"}
                    </button>
                  </div>
                </form>
                {submitError ? <p className="text-sm text-rose-700">{submitError}</p> : null}
              </SectionCard>

              <SectionCard
                title="全員の一覧"
                description="必要なときだけ開いて、予想者のラインとウォッチの支持分布を確認します。"
              >
                <details className="group rounded-[24px] border border-slate-200 bg-slate-50/85">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-sm font-medium text-slate-700 [&::-webkit-details-marker]:hidden">
                    <span>全員の支持 / 予想分布を開く</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
                      クリックで表示
                    </span>
                  </summary>
                  <div className="overflow-x-auto border-t border-slate-200 px-4 py-4">
                    <table className="min-w-[1360px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="px-3 py-3">番号</th>
                          <th className="px-3 py-3">試合</th>
                          <th className="px-3 py-3">AI基準線</th>
                          {data.users.map((user) => (
                            <th key={user.id} className="px-3 py-3">
                              <div>{user.name}</div>
                              <div className="mt-1 text-xs">{userRoleLabel[user.role]}</div>
                            </th>
                          ))}
                          <th className="px-3 py-3">全体像</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.round.matches.map((match) => {
                          const counts = pickCounts(picksByMatch.get(match.id) ?? []);
                          const aiBase = aiRecommendedOutcomes(match);
                          const overlayBadge = humanOverlayBadge(match);

                          return (
                            <tr key={match.id} className="border-b border-slate-100">
                              <td className="px-3 py-4 font-semibold text-slate-900">
                                {match.matchNo}
                              </td>
                              <td className="px-3 py-4">
                                <div className="font-medium text-slate-900">
                                  {match.homeTeam} 対 {match.awayTeam}
                                </div>
                                <div className="text-xs text-slate-500">
                                  人力 {majorityHumanOutcome(picksByMatch.get(match.id) ?? []) ?? "—"}
                                </div>
                              </td>
                              <td className="px-3 py-4">
                                <div className="flex flex-wrap gap-2">
                                  {aiBase.length === 0 ? (
                                    <Badge tone="slate">AI未設定</Badge>
                                  ) : (
                                    aiBase.map((outcome) => (
                                      <Badge key={`${match.id}-all-ai-${outcome}`} tone="amber">
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
                              {data.users.map((user) => {
                                const pick = pickByMatchUser.get(`${match.id}:${user.id}`);
                                const value = enumToOutcome(pick?.pick) ?? "—";
                                const tone =
                                  value === "—"
                                    ? "slate"
                                    : singlePickOverlayBadge(match, value).tone;

                                return (
                                  <td key={user.id} className="px-3 py-4">
                                    <div className="space-y-2">
                                      <Badge tone={tone}>{value}</Badge>
                                      <div className="text-xs text-slate-500">
                                        {supportLabel(pick?.support, userById)}
                                      </div>
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="px-3 py-4 text-slate-600">
                                <div className="flex flex-wrap gap-2">
                                  <Badge tone={overlayBadge.tone}>{overlayBadge.label}</Badge>
                                  <Badge tone="slate">{match.consensusCall ?? "未集計"}</Badge>
                                </div>
                                <div className="mt-2">
                                  {counts["1"]} / {counts["0"]} / {counts["2"]}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              </SectionCard>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

export default function PicksPage() {
  return (
    <Suspense fallback={<LoadingNotice title="支持 / 予想を準備中" />}>
      <PicksPageContent />
    </Suspense>
  );
}
