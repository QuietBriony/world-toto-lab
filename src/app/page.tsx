"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import {
  ConfigurationNotice,
  ErrorNotice,
  LoadingNotice,
} from "@/components/app/states";
import { RouteGlossaryCard } from "@/components/app/round-guides";
import { FeedbackBoard } from "@/components/feedback-board";
import {
  Badge,
  buttonClassName,
  CollapsibleSectionCard,
  cx,
  fieldClassName,
  PageHeader,
  secondaryButtonClassName,
  SectionCard,
  StatCard,
  textAreaClassName,
} from "@/components/ui";
import {
  demoFocusMatches,
  demoRoundTitle,
  demoWalkthroughSteps,
  isDemoRoundTitle,
} from "@/lib/demo-data";
import {
  parseIntOrNull,
  parseProductType,
  parseRoundStatus,
  stringValue,
  stringValues,
  nullableString,
} from "@/lib/forms";
import {
  advantageBucketLabel,
  formatDateTime,
  formatPercent,
  formatSignedPercent,
  productTypeLabel,
  roundSourceLabel,
  roundStatusLabel,
  roundStatusOptions,
} from "@/lib/domain";
import { defaultRequiredMatchCount, productTypeOptions } from "@/lib/product-rules";
import { resolveRoundParticipantUsers } from "@/lib/round-participants";
import { deriveRoundProgressSummary, matchHasSetupInput } from "@/lib/round-progress";
import { appRoute, buildRoundHref } from "@/lib/round-links";
import {
  createDemoRound,
  createInitialUsers,
  createRound,
  createUser,
  deleteUserIfInactive,
  updateUserProfile,
} from "@/lib/repository";
import { budgetFromCandidateLimit, candidateLimitFromBudget } from "@/lib/tickets";
import type { ProductType } from "@/lib/types";
import {
  filterPredictors,
  nextPredictorLineName,
  parseUserRole,
  userRoleDescription,
  userRoleLabel,
} from "@/lib/users";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  buildMemberUsageMap,
  describeMemberInventoryStatus,
} from "@/lib/member-usage";
import { useDashboardData } from "@/lib/use-app-data";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "不明なエラーです。";
}

function progressValue(done: number, total: number) {
  return total > 0 ? `${done}/${total}` : "未設定";
}

function hasAiInputs(model: { modelProb0: number | null; modelProb1: number | null; modelProb2: number | null }) {
  return model.modelProb1 !== null || model.modelProb0 !== null || model.modelProb2 !== null;
}

type MemberRoundActivity = {
  pickCount: number;
  reviewNoteCount: number;
  roundId: string;
  roundTitle: string;
  scoutReportCount: number;
  supportRefCount: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const { data, error, loading, refresh } = useDashboardData();
  const [busy, setBusy] = useState<"demo" | "members" | "round" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState(false);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [duplicatingPredictorId, setDuplicatingPredictorId] = useState<string | null>(null);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  const [createProductType, setCreateProductType] = useState<ProductType>("toto13");
  const [createMatchCount, setCreateMatchCount] = useState(13);
  const requiredMatchCountHint =
    defaultRequiredMatchCount(createProductType) ?? createMatchCount;

  const handleCreateInitialUsers = async () => {
    setBusy("members");
    setActionError(null);

    try {
      await createInitialUsers();
      await refresh();
    } catch (nextError) {
      setActionError(errorMessage(nextError));
    } finally {
      setBusy(null);
    }
  };

  const handleCreateRound = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy("round");
    setActionError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const candidateLimit = parseIntOrNull(stringValue(formData, "candidateLimit"));
      const matchCount = parseIntOrNull(stringValue(formData, "matchCount")) ?? 13;
      const productType = parseProductType(stringValue(formData, "productType"));
      const shouldBootstrapMembers =
        (data?.users.length ?? 0) === 0 && formData.get("bootstrapMembers") === "on";
      const participantIds = stringValues(formData, "participantUserId");

      if ((data?.users.length ?? 0) > 0 && participantIds.length === 0) {
        throw new Error("この回で使うメンバーを1人以上選んでください。");
      }

      if (shouldBootstrapMembers) {
        await createInitialUsers();
      }

      const roundId = await createRound({
        title: stringValue(formData, "title") || "新規ラウンド",
        status: parseRoundStatus(stringValue(formData, "status")),
        budgetYen:
          candidateLimit !== null ? budgetFromCandidateLimit(candidateLimit) : null,
        matchCount,
        notes: nullableString(formData, "notes"),
        participantIds,
        productType,
        requiredMatchCount: productType === "custom" ? matchCount : null,
        roundSource: "user_manual",
        sourceNote: nullableString(formData, "sourceNote"),
      });

      await refresh();
      router.push(buildRoundHref(appRoute.workspace, roundId));
    } catch (nextError) {
      setActionError(errorMessage(nextError));
    } finally {
      setBusy(null);
    }
  };

  const handleAddMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAddingMember(true);
    setMemberActionError(null);

    try {
      const formData = new FormData(event.currentTarget);
      await createUser({
        name: stringValue(formData, "memberName"),
        role: parseUserRole(stringValue(formData, "memberRole")),
      });
      event.currentTarget.reset();
      await refresh();
    } catch (nextError) {
      setMemberActionError(errorMessage(nextError));
    } finally {
      setAddingMember(false);
    }
  };

  const handleSaveMember = async (
    event: FormEvent<HTMLFormElement>,
    userId: string,
  ) => {
    event.preventDefault();
    setSavingMemberId(userId);
    setMemberActionError(null);

    try {
      const formData = new FormData(event.currentTarget);
      await updateUserProfile({
        userId,
        name: stringValue(formData, "memberName"),
        role: parseUserRole(stringValue(formData, "memberRole")),
      });
      await refresh();
    } catch (nextError) {
      setMemberActionError(errorMessage(nextError));
    } finally {
      setSavingMemberId(null);
    }
  };

  const handleDeleteMember = async (userId: string, name: string) => {
    if (!window.confirm(`「${name}」を整理します。未入力アカウントだけ削除されます。続けますか？`)) {
      return;
    }

    setRemovingMemberId(userId);
    setMemberActionError(null);

    try {
      await deleteUserIfInactive(userId);
      await refresh();
    } catch (nextError) {
      setMemberActionError(errorMessage(nextError));
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleAddPredictorLine = async (userId: string) => {
    if (!data) {
      return;
    }

    const sourceUser = data.users.find((user) => user.id === userId);
    if (!sourceUser) {
      return;
    }

    setDuplicatingPredictorId(userId);
    setMemberActionError(null);

    try {
      await createUser({
        name: nextPredictorLineName(data.users, sourceUser.name),
        role: "admin",
      });
      await refresh();
    } catch (nextError) {
      setMemberActionError(errorMessage(nextError));
    } finally {
      setDuplicatingPredictorId(null);
    }
  };

  const handleOpenDemo = async () => {
    setBusy("demo");
    setActionError(null);

    try {
      const roundId = await createDemoRound();
      await refresh();
      router.push(buildRoundHref(appRoute.workspace, roundId));
    } catch (nextError) {
      setActionError(errorMessage(nextError));
    } finally {
      setBusy(null);
    }
  };

  const demoRound =
    data?.rounds.find((round) => round.title === demoRoundTitle) ?? null;
  const demoUsers = data?.demoUsers ?? [];
  const demoPredictorUsers = filterPredictors(demoUsers);
  const inventoryRounds = useMemo(
    () => data?.rounds.filter((round) => !isDemoRoundTitle(round.title)) ?? [],
    [data],
  );
  const liveRoundCount = inventoryRounds.length;
  const latestRound = inventoryRounds[0] ?? null;
  const latestRoundProgress =
    data && latestRound
      ? deriveRoundProgressSummary({
          matches: latestRound.matches,
          picks: latestRound.picks,
          resultedCount: latestRound.resultedCount,
          roundId: latestRound.id,
          scoutReports: latestRound.scoutReports,
          users: resolveRoundParticipantUsers(data.users, latestRound.participantIds),
        })
      : null;
  const upcomingMatches = data
    ? inventoryRounds
        .flatMap((round) =>
          round.matches
            .filter((match) => {
              if (!match.kickoffTime) {
                return false;
              }

              return new Date(match.kickoffTime).getTime() >= Date.now();
            })
            .map((match) => ({
              round,
              match,
            })),
        )
        .sort((left, right) => {
          const leftTime = left.match.kickoffTime
            ? new Date(left.match.kickoffTime).getTime()
            : Number.POSITIVE_INFINITY;
          const rightTime = right.match.kickoffTime
            ? new Date(right.match.kickoffTime).getTime()
            : Number.POSITIVE_INFINITY;
          return leftTime - rightTime;
        })
        .slice(0, 8)
    : [];
  const memberUsageMap = useMemo(() => {
    if (!data) {
      return new Map();
    }

    return buildMemberUsageMap({
      users: data.users,
      picks: inventoryRounds.flatMap((round) => round.picks),
      scoutReports: inventoryRounds.flatMap((round) => round.scoutReports),
      reviewNotes: inventoryRounds.flatMap((round) => round.reviewNotes),
    });
  }, [data, inventoryRounds]);
  const memberActivityMap = useMemo(() => {
    if (!data) {
      return new Map<string, MemberRoundActivity[]>();
    }

    return new Map<string, MemberRoundActivity[]>(
      data.users.map((user) => [
        user.id,
        inventoryRounds.flatMap((round) => {
          const pickCount = round.picks.filter((pick) => pick.userId === user.id).length;
          const scoutReportCount = round.scoutReports.filter((report) => report.userId === user.id).length;
          const reviewNoteCount = round.reviewNotes.filter((note) => note.userId === user.id).length;
          const supportRefCount = round.picks.filter(
            (pick) => pick.support.kind === "predictor" && pick.support.userId === user.id,
          ).length;

          if (pickCount + scoutReportCount + reviewNoteCount + supportRefCount === 0) {
            return [];
          }

          return [
            {
              pickCount,
              reviewNoteCount,
              roundId: round.id,
              roundTitle: round.title,
              scoutReportCount,
              supportRefCount,
            },
          ];
        }),
      ]),
    );
  }, [data, inventoryRounds]);
  const emptyMemberCount =
    data?.users.filter((user) => {
      const usageSummary = memberUsageMap.get(user.id);
      return Boolean(usageSummary?.isEmpty && usageSummary.isPlaceholderName);
    }).length ?? 0;
  const predictorCount =
    data?.users.filter((user) => user.role === "admin").length ?? 0;
  const watcherCount =
    data?.users.filter((user) => user.role === "member").length ?? 0;
  const livePickCount = inventoryRounds.reduce((sum, round) => sum + round.pickCount, 0);
  const liveResultCount = inventoryRounds.reduce((sum, round) => sum + round.resultedCount, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="ワールドtotoラボ"
        title="W杯totoの予想・分析・記録ダッシュボード"
        description="AI基準線と少数の予想者を見比べながら、他メンバーは支持先を選べる共有 MVP です。"
        actions={
          <div className="flex flex-wrap gap-3">
            {!data || data.users.length === 0 ? (
              <a href="#create-round" className={buttonClassName}>
                本番セットを始める
              </a>
            ) : latestRoundProgress ? (
              <Link href={latestRoundProgress.nextStep.href} className={buttonClassName}>
                {latestRoundProgress.nextStep.label}
              </Link>
            ) : (
              <a href="#create-round" className={buttonClassName}>
                ラウンドを作成
              </a>
            )}
            <a href="#demo-lab" className={secondaryButtonClassName}>
              デモを見る
            </a>
          </div>
        }
      />

      <RouteGlossaryCard
        currentPath={appRoute.dashboard}
        defaultOpen={!data || (data.users.length === 0 && data.rounds.length === 0)}
      />

      {!isSupabaseConfigured() ? (
        <ConfigurationNotice />
      ) : loading && !data ? (
        <LoadingNotice title="ダッシュボードを読み込み中" />
      ) : error && !data ? (
        <ErrorNotice error={error} onRetry={() => void refresh()} />
      ) : data ? (
        <>
          <CollapsibleSectionCard
            title="初めてならここから"
            description="totoを知らなくても、まずは `デモで流れを見る` か `本番セットを始める` のどちらかを選べば大丈夫です。"
            defaultOpen={liveRoundCount === 0}
            badge={<Badge tone="teal">スタートガイド</Badge>}
          >
            <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-[28px] border border-emerald-200 bg-[linear-gradient(145deg,rgba(236,253,245,0.96),rgba(239,246,255,0.92))] p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="teal">初見OK</Badge>
                  <Badge tone="slate">30秒説明</Badge>
                </div>
                <h3 className="mt-3 font-display text-[1.4rem] font-semibold tracking-[-0.05em] text-slate-950">
                  まず知るのは `1 / 0 / 2` と役割だけで十分です
                </h3>
                <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                  <li>`1` はホーム勝ち、`0` は引き分け、`2` はアウェイ勝ちです。</li>
                  <li>`toto` は複数試合の `1 / 0 / 2` を見るサッカーくじで、このサイトでは購入ではなく見立ての共有と整理をします。</li>
                  <li>`予想者` は自分で `1 / 0 / 2` を入れる人、`ウォッチ` は AI か予想者のどちらに乗るかを選ぶ人です。</li>
                  <li>`候補配分` はお金の配分ではなく、どの候補から先に見るかの順番表です。</li>
                </ul>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      title: "予想者",
                      body: "自分で `1 / 0 / 2` を直接入れる役です。",
                      tone: "teal" as const,
                    },
                    {
                      title: "ウォッチ",
                      body: "AI か予想者のどちらに乗るかを選ぶ役です。",
                      tone: "slate" as const,
                    },
                    {
                      title: "AI基準線",
                      body: "AI が出した叩き台です。まずここから比較します。",
                      tone: "sky" as const,
                    },
                    {
                      title: "候補配分",
                      body: "最初にどの候補を見るかを整理した一覧です。",
                      tone: "amber" as const,
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-[20px] border border-white/75 bg-white/82 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={item.tone}>{item.title}</Badge>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-[24px] border border-amber-200 bg-amber-50/88 p-5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.24)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="amber">まず試す</Badge>
                    <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                      デモで流れを見る
                    </h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    役割、入力、コンセンサス、候補配分まで最初から入った教材用ラウンドです。
                    用語の雰囲気を掴むなら、ここからがいちばん速いです。
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={buttonClassName}
                      onClick={handleOpenDemo}
                      disabled={busy === "demo"}
                    >
                      {busy === "demo"
                        ? "準備中..."
                        : demoRound
                          ? "デモラウンドを開く"
                          : "デモラウンドを作成"}
                    </button>
                    <a href="#demo-lab" className={secondaryButtonClassName}>
                      デモ説明を見る
                    </a>
                  </div>
                </div>

                <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/85 p-5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.24)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="teal">すぐ本番</Badge>
                    <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                      本番セットを始める
                    </h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    `ラウンド作成 → 試合編集 → 支持 / 予想 → 候補配分` の順で進めれば十分です。
                    初回は `hazi` と空き枠も一緒に準備できます。
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {liveRoundCount === 0 ? (
                      <a href="#create-round" className={buttonClassName}>
                        本番セットを始める
                      </a>
                    ) : latestRoundProgress ? (
                      <Link href={latestRoundProgress.nextStep.href} className={buttonClassName}>
                        {latestRoundProgress.nextStep.label}
                      </Link>
                    ) : (
                      <a href="#create-round" className={buttonClassName}>
                        ラウンドを作成
                      </a>
                    )}
                    <a href="#shared-members" className={secondaryButtonClassName}>
                      メンバーの意味を見る
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleSectionCard>

          <SectionCard
            title="本番セットアップ"
            description="まずは本番ラウンドを1つ作り、必要なら `hazi` と空き枠も一緒に準備してから進めます。"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[24px] border border-white/80 bg-white/76 p-5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.4)]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={liveRoundCount > 0 ? "teal" : "amber"}>
                    {liveRoundCount > 0 ? "進行中" : "最初の一歩"}
                  </Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    本番ラウンドを作る
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  初回はここから始めれば十分です。必要なら `hazi` と空き枠も同時に作って、そのまま試合設定へ進めます。
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {liveRoundCount === 0 ? (
                    <a href="#create-round" className={buttonClassName}>
                      本番セットを始める
                    </a>
                  ) : (
                    <Link href={buildRoundHref(appRoute.workspace, latestRound?.id ?? data.rounds[0].id)} className={buttonClassName}>
                      直近ラウンドを開く
                    </Link>
                  )}
                  <a href="#shared-members" className={secondaryButtonClassName}>
                    メンバーを確認
                  </a>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/80 bg-white/76 p-5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.4)]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={latestRoundProgress?.nextStep.tone ?? "sky"}>
                    {latestRound ? "続きから" : "次にやる"}
                  </Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    今やること
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {latestRound && latestRoundProgress
                    ? `${latestRound.title} の次アクションは「${latestRoundProgress.nextStep.label}」です。`
                    : "本番ラウンドを作ったら、試合設定から順に進めます。"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {latestRound && latestRoundProgress ? (
                    <>
                      <Link href={latestRoundProgress.nextStep.href} className={buttonClassName}>
                        {latestRoundProgress.nextStep.label}
                      </Link>
                      <Link
                        href={buildRoundHref(appRoute.workspace, latestRound.id)}
                        className={secondaryButtonClassName}
                      >
                        ラウンド詳細
                      </Link>
                    </>
                  ) : (
                    <a href="#create-round" className={secondaryButtonClassName}>
                      ラウンド作成へ
                    </a>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          <CollapsibleSectionCard
            id="demo-lab"
            title="体験用デモ"
            description="本番セットとは切り離して、操作の流れだけを確認したいときに使います。"
            defaultOpen={false}
            badge={<Badge tone="amber">デモ専用</Badge>}
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonClassName}
                onClick={handleOpenDemo}
                disabled={busy === "demo"}
              >
                {busy === "demo"
                  ? "準備中..."
                  : demoRound
                    ? "デモラウンドを開く"
                    : "デモラウンドを作成"}
              </button>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="grid gap-3 sm:grid-cols-2">
                {demoWalkthroughSteps.map((item, index) => (
                  <div
                    key={item.key}
                    className="rounded-[22px] border border-white/80 bg-white/74 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)]"
                  >
                    <div className="font-display text-[11px] uppercase tracking-[0.34em] text-teal-800/72">
                      手順 {String(index + 1).padStart(2, "0")}
                    </div>
                    <h3 className="mt-3 font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/85 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="amber">デモ専用</Badge>
                  <Badge tone={demoRound ? "teal" : "amber"}>{demoRound ? "保存済み" : "未作成"}</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    {demoRoundTitle}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  このラウンドには試合データ、AI予測、予想者ライン、支持入力、予想者カード、コンセンサス、候補配分、
                  振り返りが最初から入ります。本番メンバーの状態判定には含めません。
                </p>
                {demoRound ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge tone="slate">{demoRound.matchCount}試合</Badge>
                    <Badge tone="slate">{demoUsers.length}人</Badge>
                    <Badge tone="slate">予想者 {demoPredictorUsers.length}</Badge>
                    <Badge tone="slate">ウォッチ {Math.max(demoUsers.length - demoPredictorUsers.length, 0)}</Badge>
                    <Badge tone="slate">{demoRound.pickCount}予想</Badge>
                    <Badge tone="slate">{demoRound.scoutReports.length}根拠</Badge>
                    <Badge tone="slate">{demoRound.resultedCount}結果</Badge>
                  </div>
                ) : null}
                {demoUsers.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {demoUsers.map((user) => (
                      <Badge key={user.id} tone={user.role === "admin" ? "teal" : "slate"}>
                        {user.name} / {userRoleLabel[user.role]}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {demoFocusMatches.map((item) => (
                    <Badge key={`demo-focus-${item.matchNo}`} tone="sky">
                      #{item.matchNo} {item.label}
                    </Badge>
                  ))}
                </div>
                {demoRound ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={buildRoundHref(appRoute.workspace, demoRound.id)}
                      className={secondaryButtonClassName}
                    >
                      ラウンド詳細
                    </Link>
                    <Link
                      href={buildRoundHref(appRoute.picks, demoRound.id, {
                        user: demoPredictorUsers[0]?.id ?? demoUsers[0]?.id,
                      })}
                      className={secondaryButtonClassName}
                    >
                      支持 / 予想
                    </Link>
                    <Link
                      href={buildRoundHref(appRoute.consensus, demoRound.id)}
                      className={secondaryButtonClassName}
                    >
                      コンセンサス
                    </Link>
                    <Link
                      href={buildRoundHref(appRoute.review, demoRound.id)}
                      className={secondaryButtonClassName}
                    >
                      振り返り
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
            {actionError ? <p className="text-sm text-rose-700">{actionError}</p> : null}
          </CollapsibleSectionCard>

          <CollapsibleSectionCard
            title="このサイトは何をするもの？"
            description="友人グループで W杯toto / WINNER の見立てを共有し、AI基準線と少数の予想者ラインを比べながら、他メンバーは支持先を選べる分析ラボです。"
            defaultOpen={false}
            badge={<Badge tone="teal">全体像</Badge>}
          >
            <div className="grid gap-4 lg:grid-cols-3">
              {[
                {
                  eyebrow: "入力",
                  title: "AIと予想者を並べる",
                  body: "まず AI基準線 と予想者ラインを見ます。予想者は 1/0/2 とカードを入れ、他メンバーは支持先を選びます。",
                },
                {
                  eyebrow: "比較",
                  title: "優位差を比べる",
                  body: "一般人気 / AI / 予想者 / ウォッチ支持のズレを、ラウンド詳細・コンセンサス・優位ボードで並べて見ます。",
                },
                {
                  eyebrow: "振り返り",
                  title: "結果を振り返る",
                  body: "振り返りで的中数、対立パターン、反省メモを残して次回に活かします。",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[24px] border border-white/80 bg-white/76 p-5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.4)]"
                >
                  <div className="font-display text-[11px] uppercase tracking-[0.34em] text-teal-800/72">
                    {item.eyebrow}
                  </div>
                  <h3 className="mt-3 font-display text-xl font-semibold tracking-[-0.05em] text-slate-950">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
                </div>
              ))}
            </div>
          </CollapsibleSectionCard>

          <CollapsibleSectionCard
            title="最初の使い方"
            description="初回はこの順で進めると迷いにくいです。"
            defaultOpen={false}
            badge={<Badge tone="sky">チュートリアル</Badge>}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {[
                {
                  step: "01",
                  title: "本番ラウンドを作成",
                  body: "まず対象回を1つ作ります。初回なら `hazi` と空き枠もここで一緒に準備できます。",
                  tone: liveRoundCount > 0 ? "teal" : "amber",
                  status: liveRoundCount > 0 ? "済み" : "次にやる",
                },
                {
                  step: "02",
                  title: "共有メンバーを確認",
                  body: "`hazi` を起点に、必要な人だけ名前や役割を変えます。ほかは空き枠のままで始めて大丈夫です。",
                  tone: data.users.length > 0 ? "teal" : "amber",
                  status: data.users.length > 0 ? "確認可" : "作成待ち",
                },
                {
                  step: "03",
                  title: "試合編集で試合情報を入れる",
                  body: "ラウンド詳細から各試合の編集に入り、チーム名、確率、カテゴリ、メモを埋めます。",
                  tone: "sky",
                  status: "入力導線あり",
                },
                {
                  step: "04",
                  title: "支持 / 予想と予想者カードを入力",
                  body: "予想者は 1/0/2 とカードを入れ、ウォッチ担当は AI か予想者のどちらに乗るかを選びます。",
                  tone: "sky",
                  status: "保存対応",
                },
                {
                  step: "05",
                  title: "コンセンサス / 優位 / 候補配分を見る",
                  body: "入力が集まると、人力コンセンサス、優位差、候補配分の比較が使えるようになります。",
                  tone: "sky",
                  status: "集計対応",
                },
                {
                  step: "06",
                  title: "結果入力と振り返り",
                  body: "試合後に結果を入れて、AI・人力・市場との差や反省ログを残します。",
                  tone: "sky",
                  status: "振り返り対応",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="grid gap-3 rounded-[24px] border border-white/80 bg-white/76 p-5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.4)] sm:grid-cols-[auto_1fr]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-slate-200 bg-slate-950 text-sm font-semibold text-white">
                    {item.step}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                        {item.title}
                      </h3>
                      <Badge tone={item.tone as "amber" | "sky" | "teal"}>{item.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSectionCard>

          <FeedbackBoard />

          <CollapsibleSectionCard
            title="今どこまで使える？"
            description="共有 MVP としてのコア機能は入っていますが、まだフルプロダクトではありません。"
            defaultOpen={false}
            badge={<Badge tone="amber">到達点</Badge>}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/85 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone="teal">今使える</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    コア MVP は使用可能
                  </h3>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    "ラウンド一覧",
                    "ラウンド詳細",
                    "試合編集",
                    "人力予想",
                    "根拠カード",
                    "コンセンサス",
                    "優位ボード",
                    "候補配分",
                    "振り返り",
                    "GitHub Pages公開",
                    "Supabase保存",
                  ].map((item) => (
                    <Badge key={item} tone="teal">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-amber-200 bg-amber-50/88 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone="amber">まだない</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    フル機能ではない部分
                  </h3>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    "認証",
                    "権限制御",
                    "CSV取込",
                    "リアルタイム同期",
                    "外部API自動取得",
                    "精密な最適化",
                  ].map((item) => (
                    <Badge key={item} tone="amber">
                      {item}
                    </Badge>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  なので答えとしては、「普通に使える共有 MVP にはなっているが、運用向けの完成版ではない」です。
                </p>
              </div>
            </div>
          </CollapsibleSectionCard>

          <CollapsibleSectionCard
            title="運用メモと公開時の注意"
            description="公開サイトとして使う前提の注意を、必要なときだけ開けるようにまとめています。"
            defaultOpen={false}
            badge={<Badge tone="slate">注意</Badge>}
          >
            <div className="grid gap-3">
              {[
                {
                  defaultOpen: false,
                  eyebrow: "保存先",
                  title: "データはどこに保存される？",
                  summary:
                    "GitHub の repo にメンバー情報や予想が直接書き戻るわけではありません。保存先は Supabase です。",
                  body: "このサイトで作成したメンバー名、ラウンド、人力予想、根拠カード、振り返りメモは Supabase の DB に保存されます。GitHub Pages は画面を配信しているだけで、保存データそのものを GitHub のコード一覧に並べるものではありません。",
                  note: "ただし今の MVP は公開サイト + 匿名アクセス前提なので、公開 URL 経由で読める前提で扱ってください。",
                  tone: "teal" as const,
                },
                {
                  defaultOpen: false,
                  eyebrow: "公開範囲",
                  title: "名前はどう入れる？",
                  summary:
                    "本名や連絡先ではなく、ハンドル名やニックネーム前提で使うのが安全です。",
                  body: "今の構成は 10 人前後の内輪共有 MVP です。メンバー1、観戦会A、Briony みたいな表示名で十分で、メールアドレス、電話番号、精算メモのような個人情報は入れない運用が向いています。",
                  note: "ちゃんと守りたい場合は、将来的に認証と権限制御を入れる前提です。",
                  tone: "amber" as const,
                },
                {
                  defaultOpen: false,
                  eyebrow: "対象外",
                  title: "この MVP でやらないこと",
                  summary:
                    "購入代行、賭け金管理、配当分配、精算は扱いません。分析と記録に限定しています。",
                  body: "この UI は AI基準線と人力上書きを比べて、予想の根拠や振り返りを残すためのものです。金銭の受け渡しや代理購入のフローは入れていませんし、今後も別物として扱う想定です。",
                  note: "公式サービスの利用は各自の判断で行う前提です。",
                  tone: "sky" as const,
                },
              ].map((item) => (
                <details
                  key={item.title}
                  open={item.defaultOpen}
                  className="group overflow-hidden rounded-[24px] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(244,250,246,0.88))] shadow-[0_20px_50px_-36px_rgba(0,0,0,0.32)]"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={item.tone}>{item.eyebrow}</Badge>
                        <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                          {item.title}
                        </h3>
                      </div>
                      <p className="max-w-3xl text-sm leading-6 text-slate-600">
                        {item.summary}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/84 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        aria-hidden="true"
                        className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180"
                      >
                        <path
                          d="M5 7.5L10 12.5L15 7.5"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>開閉</span>
                    </span>
                  </summary>
                  <div className="border-t border-slate-200/80 px-5 py-4">
                    <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
                      <p className="text-sm leading-7 text-slate-700">{item.body}</p>
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50/88 p-4 text-sm leading-7 text-slate-600">
                        <div className="font-display text-[11px] uppercase tracking-[0.32em] text-slate-500">
                          補足
                        </div>
                        <p className="mt-2">{item.note}</p>
                      </div>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </CollapsibleSectionCard>

          <section className="grid gap-4 md:grid-cols-4">
            <StatCard
              label="本番ラウンド"
              value={`${liveRoundCount}`}
              hint="本番回の下書きからレビュー済みまでを一覧表示"
            />
            <StatCard
              label="本番メンバー"
              value={`${data.users.length}`}
              hint="デモを除いた共有メンバーだけを数えています"
            />
            <StatCard
              label="本番入力済み"
              value={`${livePickCount}`}
              hint="本番ラウンドの 1 / 0 / 2 入力件数"
            />
            <StatCard
              label="本番結果確定"
              value={`${liveResultCount}`}
              hint="本番ラウンドで結果が入力されている試合数"
            />
          </section>

          <SectionCard
            title="今後の試合予定"
            description="キックオフ時刻が入っている試合を近い順に並べています。AIや試合情報の入力状況もここで確認できます。"
          >
            {upcomingMatches.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/88 p-5 text-sm leading-7 text-slate-600">
                まだ今後の試合予定はありません。ラウンド詳細の「試合編集」でキックオフ日時を入れると、ここに次の試合が出ます。
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {upcomingMatches.map(({ round, match }) => {
                  const aiReady = hasAiInputs(match);

                  return (
                    <div
                      key={match.id}
                      className="rounded-[24px] border border-white/80 bg-white/76 p-5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.4)]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="sky">{formatDateTime(match.kickoffTime)}</Badge>
                        <Badge tone="slate">{round.title}</Badge>
                        <Badge tone={aiReady ? "teal" : "amber"}>
                          {aiReady ? "AIあり" : "AI未入力"}
                        </Badge>
                      </div>
                      <h3 className="mt-3 font-display text-xl font-semibold tracking-[-0.05em] text-slate-950">
                        #{match.matchNo} {match.homeTeam} 対 {match.awayTeam}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {[match.stage, match.venue].filter(Boolean).join(" / ") || "会場・ステージは未入力"}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge tone={aiReady ? "teal" : "amber"}>
                          {aiReady
                            ? `AI ${formatPercent(match.modelProb1)} / ${formatPercent(match.modelProb0)} / ${formatPercent(match.modelProb2)}`
                            : "AI確率はまだ入っていません"}
                        </Badge>
                        <Badge tone={matchHasSetupInput(match) ? "teal" : "amber"}>
                          {matchHasSetupInput(match) ? "試合情報あり" : "試合情報はまだ薄い"}
                        </Badge>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={buildRoundHref(appRoute.workspace, round.id)}
                          className={secondaryButtonClassName}
                        >
                          ラウンドを見る
                        </Link>
                        <Link
                          href={buildRoundHref(appRoute.matchEditor, round.id, {
                            match: match.id,
                          })}
                          className={secondaryButtonClassName}
                        >
                          試合編集
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <CollapsibleSectionCard
            title="試合データとAI分析の入り方"
            description="今どこまで自動で出ていて、どこから先が手入力かを先に分かるようにしています。"
            defaultOpen={false}
            badge={<Badge tone="sky">データ状況</Badge>}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/85 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone="teal">今できる</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    保存済みデータはちゃんと表示できる
                  </h3>
                </div>
                <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                  <li>デモラウンドには試合情報、AI確率、予想者ライン、支持入力、予想者カード、レビューが最初から入っています。</li>
                  <li>新規ラウンドでも、試合編集に入れた日時、会場、ステージ、公式人気、市場、AI確率は各画面に反映されます。</li>
                  <li>AI分析として見えているのは、いまは `1 / 0 / 2` の確率と、そこから作る AI基準線・優位差計算です。</li>
                </ul>
              </div>

              <div className="rounded-[24px] border border-amber-200 bg-amber-50/88 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone="amber">まだない</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    外部API直取得と本格モデル自動分析は未実装
                  </h3>
                </div>
                <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                  <li>公式一覧の半自動同期や CSV / 貼り付け取り込みはありますが、外部 API から全面自動で埋まる構成ではありません。</li>
                  <li>AI確率は補助的な試算までで、本格モデルをこのサイト内で自動運用する段階ではありません。</li>
                  <li>なので現状は、公式取り込みを使うか、試合編集で実データを入れて使う MVP です。</li>
                </ul>
              </div>
            </div>
          </CollapsibleSectionCard>

          <CollapsibleSectionCard
            id="shared-members"
            title="共有メンバー"
            description="認証なし MVP なので、ここで本番用のあだ名と役割を決めます。デモ用アカウントはここに混ぜません。"
            defaultOpen={data.users.length === 0}
            badge={
              <Badge tone={data.users.length > 0 ? "slate" : "amber"}>
                {data.users.length > 0 ? `${data.users.length}人` : "準備待ち"}
              </Badge>
            }
          >
            {data.users.length === 0 ? (
              <div className="grid gap-4">
                <p className="text-sm text-slate-600">
                  まず `ラウンドを作成` から始めると、必要なら `hazi` と空き枠を一緒に準備できます。
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={buttonClassName}
                    onClick={handleCreateInitialUsers}
                    disabled={busy === "members"}
                  >
                    {busy === "members" ? "準備中..." : "hazi と空き枠を先に準備"}
                  </button>
                  <a href="#create-round" className={secondaryButtonClassName}>
                    ラウンド作成へ
                  </a>
                </div>
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <StatCard label="予想者" value={`${predictorCount}`} compact />
                    <StatCard label="ウォッチ" value={`${watcherCount}`} compact />
                    <StatCard label="空きアカウント" value={`${emptyMemberCount}`} compact />
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/90 p-4 text-sm leading-6 text-slate-600">
                    左側は登録済みメンバーの編集です。
                    名前や役割を変えたいときは各行を更新します。
                    `空き n` は `空き`、名前を付けたけれどまだ触っていない人は `入力なし` と表示します。
                    状態の判定にはデモ入力を含めません。
                  </div>
                  {data.users.map((user) => (
                    (() => {
                      const usageSummary = memberUsageMap.get(user.id);
                      const roundActivities: MemberRoundActivity[] =
                        memberActivityMap.get(user.id) ?? [];
                      const latestPickActivity = roundActivities.find(
                        (activity) => activity.pickCount > 0,
                      );
                      const latestSupportActivity = roundActivities.find(
                        (activity) => activity.pickCount === 0 && activity.supportRefCount > 0,
                      );
                      const latestScoutActivity = roundActivities.find(
                        (activity) => activity.scoutReportCount > 0,
                      );
                      const latestReviewActivity = roundActivities.find(
                        (activity) => activity.reviewNoteCount > 0,
                      );
                      const inventoryStatus = usageSummary
                        ? describeMemberInventoryStatus(usageSummary)
                        : null;

                      return (
                        <form
                          key={user.id}
                          onSubmit={(event) => void handleSaveMember(event, user.id)}
                          className="grid gap-3 rounded-[22px] border border-white/80 bg-white/76 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)] xl:grid-cols-[auto_1.05fr_190px_250px_auto]"
                        >
                          <div className="flex items-center">
                            <Badge tone={user.role === "admin" ? "teal" : "slate"}>
                              {userRoleLabel[user.role]}
                            </Badge>
                          </div>
                          <label className="grid gap-2 text-sm font-medium text-slate-700">
                            あだ名
                            <div className="text-xs font-normal leading-5 text-slate-500">
                              いま登録されている名前です。変更したいときだけ直します。
                            </div>
                            <input
                              name="memberName"
                              defaultValue={user.name}
                              className={fieldClassName}
                              placeholder="ブリオニー / 観戦会A / 友人B"
                            />
                          </label>
                          <label className="grid gap-2 text-sm font-medium text-slate-700">
                            役割
                            <select
                              name="memberRole"
                              defaultValue={user.role}
                              className={fieldClassName}
                              title={userRoleDescription[user.role]}
                            >
                              <option value="admin">予想者</option>
                              <option value="member">ウォッチ</option>
                            </select>
                          </label>
                          <div className="grid gap-2 text-sm text-slate-700">
                            <span className="font-medium">状態</span>
                            <div className="flex flex-wrap gap-2">
                              {inventoryStatus ? (
                                <Badge tone={inventoryStatus.tone}>{inventoryStatus.label}</Badge>
                              ) : null}
                              {usageSummary && usageSummary.supportRefCount > 0 ? (
                                <Badge tone="sky">支持参照 {usageSummary.supportRefCount}</Badge>
                              ) : null}
                            </div>
                            <div className="text-xs leading-5 text-slate-500">
                              {inventoryStatus?.detail ?? "状態を確認中です。"}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {latestPickActivity ? (
                                <Link
                                  href={buildRoundHref(appRoute.picks, latestPickActivity.roundId, {
                                    user: user.id,
                                  })}
                                  className={secondaryButtonClassName}
                                >
                                  支持 / 予想を確認
                                </Link>
                              ) : null}
                              {!latestPickActivity && latestSupportActivity ? (
                                <Link
                                  href={buildRoundHref(appRoute.picks, latestSupportActivity.roundId)}
                                  className={secondaryButtonClassName}
                                >
                                  支持参照を確認
                                </Link>
                              ) : null}
                              {latestScoutActivity ? (
                                <Link
                                  href={buildRoundHref(appRoute.scoutCards, latestScoutActivity.roundId, {
                                    user: user.id,
                                  })}
                                  className={secondaryButtonClassName}
                                >
                                  予想者カードを確認
                                </Link>
                              ) : null}
                              {latestReviewActivity ? (
                                <Link
                                  href={buildRoundHref(appRoute.review, latestReviewActivity.roundId)}
                                  className={secondaryButtonClassName}
                                >
                                  振り返りメモを確認
                                </Link>
                              ) : null}
                              {!latestPickActivity &&
                              !latestSupportActivity &&
                              !latestScoutActivity &&
                              !latestReviewActivity &&
                              inventoryRounds[0] ? (
                                <Link
                                  href={buildRoundHref(appRoute.picks, inventoryRounds[0].id, {
                                    user: user.id,
                                  })}
                                  className={secondaryButtonClassName}
                                >
                                  直近ラウンドを確認
                                </Link>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-start justify-start gap-2 xl:justify-end">
                            <button
                              type="submit"
                              className={secondaryButtonClassName}
                              disabled={savingMemberId === user.id}
                            >
                              {savingMemberId === user.id ? "更新中..." : "名前と役割を更新"}
                            </button>
                            {user.role === "admin" ? (
                              <button
                                type="button"
                                className={secondaryButtonClassName}
                                disabled={duplicatingPredictorId === user.id}
                                onClick={() => void handleAddPredictorLine(user.id)}
                              >
                                {duplicatingPredictorId === user.id ? "追加中..." : "別ライン追加"}
                              </button>
                            ) : null}
                            {usageSummary?.canQuickDelete ? (
                              <button
                                type="button"
                                className={cx(
                                  secondaryButtonClassName,
                                  "border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50",
                                )}
                                disabled={removingMemberId === user.id}
                                onClick={() => void handleDeleteMember(user.id, user.name)}
                              >
                                {removingMemberId === user.id
                                  ? "整理中..."
                                  : usageSummary?.isPlaceholderName
                                    ? "空きを削除"
                                    : "未入力を削除"}
                              </button>
                            ) : (
                              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500">
                                入力ありはここでは消しません
                              </div>
                            )}
                          </div>
                        </form>
                      );
                    })()
                  ))}
                </div>

                <div className="rounded-[24px] border border-amber-200 bg-amber-50/90 p-5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.24)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="amber">ここが新規追加</Badge>
                    <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                      新しいあだ名を追加
                    </h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    新しくメンバーを増やす場所です。右下の入力欄が空いていたら、そこに新しいあだ名を入れてください。
                    すでに左側で文字が入っているものは登録済みです。
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    同じ予想者で複数ラインを出したいときは、左側の `別ライン追加` を使うと
                    `hazi 2` のように増やせます。
                  </p>
                  <form onSubmit={handleAddMember} className="mt-4 grid gap-3">
                    <label className="grid gap-2 text-sm font-medium text-slate-700">
                      あだ名
                      <div className="text-xs font-normal leading-5 text-slate-500">
                        ここに新しい人の呼び名を入れます
                      </div>
                      <input
                        name="memberName"
                        className={fieldClassName}
                        placeholder="ここに新しいあだ名を入力"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-slate-700">
                      役割
                      <div className="text-xs font-normal leading-5 text-slate-500">
                        予想を直接入れる人なら `予想者`、見るだけなら `ウォッチ`
                      </div>
                      <select name="memberRole" className={fieldClassName} defaultValue="member">
                        <option value="member">ウォッチとして追加</option>
                        <option value="admin">予想者として追加</option>
                      </select>
                    </label>
                    <button
                      type="submit"
                      className={buttonClassName}
                      disabled={addingMember}
                    >
                      {addingMember ? "追加中..." : "このあだ名で追加"}
                    </button>
                  </form>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {data.users.map((user) => (
                      <Badge key={user.id} tone={user.role === "admin" ? "teal" : "slate"}>
                        {user.name} / {userRoleLabel[user.role]}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-4 rounded-[20px] border border-white/70 bg-white/70 p-4 text-sm leading-6 text-slate-600">
                    `空きアカウント` は左側で `空きを削除`、名前を付けただけの人は `未入力を削除` できます。
                    支持/予想ページにも状態表示を出しているので、誰が `入力済 / 入力なし / 空き` か見ながら整理できます。
                  </div>
                </div>
              </div>
            )}
            {memberActionError ? <p className="text-sm text-rose-700">{memberActionError}</p> : null}
          </CollapsibleSectionCard>

          <SectionCard
            id="create-round"
            title="ラウンドを作成"
            description="本番用のラウンドを作ります。指定した試合数ぶんのプレースホルダーを作り、初回なら本番メンバー初期化も一緒に進められます。"
            actions={
              <div className="flex flex-wrap gap-2">
                <Link href={appRoute.officialScheduleImport} className={secondaryButtonClassName}>
                  公式日程を取り込む
                </Link>
                <Link href={appRoute.fixtureSelector} className={secondaryButtonClassName}>
                  Fixture Selector
                </Link>
                <Link href={appRoute.totoOfficialRoundImport} className={secondaryButtonClassName}>
                  公式対象回を同期して選ぶ
                </Link>
              </div>
            }
          >
            <form onSubmit={handleCreateRound} className="grid gap-5 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                ラウンド名
                <input
                  name="title"
                  className={fieldClassName}
                  placeholder="World Toto 本番回"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                ステータス
                <select name="status" className={fieldClassName} defaultValue="draft">
                  {roundStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {roundStatusLabel[status]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                productType
                <select
                  name="productType"
                  className={fieldClassName}
                  value={createProductType}
                  onChange={(event) => {
                    const nextProductType = event.currentTarget.value as ProductType;
                    setCreateProductType(nextProductType);
                    const fixedCount = defaultRequiredMatchCount(nextProductType);
                    if (fixedCount !== null) {
                      setCreateMatchCount(fixedCount);
                    }
                  }}
                >
                  {productTypeOptions.map((productType) => (
                    <option key={productType} value={productType}>
                      {productTypeLabel[productType]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                試合数
                <input
                  name="matchCount"
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  value={createMatchCount}
                  onChange={(event) =>
                    setCreateMatchCount(
                      Math.min(
                        Math.max(Number(event.currentTarget.value || 1), 1),
                        20,
                      ),
                    )
                  }
                  className={fieldClassName}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                上位候補数
                <input
                  name="candidateLimit"
                  type="number"
                  min={1}
                  max={8}
                  step={1}
                  className={fieldClassName}
                  placeholder="5"
                />
              </label>

              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-950/5 p-4 text-sm text-slate-600">
                `toto13 = 13試合 / mini toto風 = 5試合 / WINNER風 = 1試合 / custom = 任意` を目安にしてください。
                現在の requiredMatchCount は {requiredMatchCountHint} 試合として扱います。
                金銭、配当、代理購入、精算は扱いません。ここでの上位候補数は、候補配分画面で何案まで並べるかの目安です。
              </div>

              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                sourceNote
                <input
                  name="sourceNote"
                  className={fieldClassName}
                  placeholder="手入力で作る仮想Round / 友人会テスト用 など"
                />
              </label>

              {data.users.length > 0 ? (
                <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50/88 p-4 text-sm text-slate-700 md:col-span-2">
                  <div>
                    <div className="font-medium text-slate-900">この回で使うメンバー</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">
                      参加者だけを選ぶと、その回の支持 / 予想 / 予想者カードの必要件数もこの人数で計算します。
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {data.users.map((user) => (
                      <label
                        key={`create-round-participant-${user.id}`}
                        className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/82 px-4 py-3"
                      >
                        <input
                          type="checkbox"
                          name="participantUserId"
                          value={user.id}
                          defaultChecked
                          className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-300"
                        />
                        <span className="text-sm font-medium text-slate-800">
                          {user.name}
                        </span>
                        <Badge tone={user.role === "admin" ? "teal" : "slate"}>
                          {userRoleLabel[user.role]}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {data.users.length === 0 ? (
                <label className="md:col-span-2 flex items-start gap-3 rounded-3xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="bootstrapMembers"
                    defaultChecked
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-300"
                  />
                  <span className="leading-6">
                    このラウンド作成時に、初回メンバーとして `hazi` を予想者、ほか 9 枠を `空き`
                    として一緒に準備する
                  </span>
                </label>
              ) : (
                <div className="md:col-span-2 rounded-3xl border border-dashed border-slate-300 bg-slate-950/5 p-4 text-sm text-slate-600">
                  メンバーはあとでラウンド詳細から入れ替えられます。まず全員で作って、不要な人だけ外す流れでも大丈夫です。
                </div>
              )}

              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                メモ
                <textarea
                  name="notes"
                  className={textAreaClassName}
                  placeholder="このラウンドで気にしたいテーマ、友人会の着眼点など"
                />
              </label>

              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  className={buttonClassName}
                  disabled={busy === "round"}
                >
                  {busy === "round" ? "作成中..." : "ラウンドを作成"}
                </button>
              </div>
            </form>
            {actionError ? <p className="text-sm text-rose-700">{actionError}</p> : null}
          </SectionCard>

          <section id="round-list" className="grid gap-5 xl:grid-cols-2">
            {inventoryRounds.length === 0 ? (
              <SectionCard
                title="本番ラウンド一覧"
                description="本番ラウンドはまだありません。デモとは別に、ここへ本番回が並びます。"
              >
                <p className="text-sm text-slate-600">
                  まずは `ラウンドを作成` から本番セットを始めてください。
                </p>
              </SectionCard>
            ) : inventoryRounds.map((round) => (
              (() => {
                const roundUsers = resolveRoundParticipantUsers(data.users, round.participantIds);
                const progress = deriveRoundProgressSummary({
                  matches: round.matches,
                  picks: round.picks,
                  resultedCount: round.resultedCount,
                  roundId: round.id,
                  scoutReports: round.scoutReports,
                  users: roundUsers,
                });

                return (
                  <SectionCard
                    key={round.id}
                    title={round.title}
                    description={round.notes ?? "ラウンドメモはまだありません。"}
                    actions={
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="slate">{roundUsers.length}人</Badge>
                        <Badge tone="teal">{productTypeLabel[round.productType as ProductType]}</Badge>
                        <Badge tone="slate">{roundSourceLabel[round.roundSource]}</Badge>
                        <Badge tone="slate">
                          要件 {round.requiredMatchCount ?? round.matchCount}試合
                        </Badge>
                        <Badge tone="sky">{roundStatusLabel[round.status]}</Badge>
                        <Link
                          href={buildRoundHref(appRoute.simpleView, round.id, {
                            user: roundUsers[0]?.id,
                          })}
                          className={secondaryButtonClassName}
                        >
                          Simple View
                        </Link>
                        <Link
                          href={buildRoundHref(appRoute.pickRoom, round.id, {
                            user: roundUsers[0]?.id,
                          })}
                          className={secondaryButtonClassName}
                        >
                          Pick Room
                        </Link>
                        <Link
                          href={buildRoundHref(appRoute.workspace, round.id)}
                          className={secondaryButtonClassName}
                        >
                          ラウンド詳細
                        </Link>
                      </div>
                    }
                  >
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      <StatCard
                        label="試合設定"
                        value={progressValue(progress.configuredMatches, round.matchCount)}
                        compact
                      />
                      <StatCard
                        label="支持 / 予想"
                        value={progressValue(round.pickCount, progress.expectedPickEntries)}
                        compact
                      />
                      <StatCard
                        label="予想者カード"
                        value={progressValue(round.scoutReports.length, progress.expectedScoutEntries)}
                        compact
                      />
                      <StatCard
                        label="結果入力"
                        value={progressValue(round.resultedCount, round.matchCount)}
                        compact
                      />
                      <StatCard
                        label="候補カード"
                        value={round.candidateTicketCount}
                        compact
                      />
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
                      <div className="rounded-3xl border border-white/60 bg-white/80 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold text-slate-900">
                            合成優位が大きい候補トップ3
                          </h3>
                          <span className="text-xs text-slate-500">
                            候補上限 {candidateLimitFromBudget(round.budgetYen ?? 500)} 案
                          </span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {round.topSignals.length === 0 ? (
                            <p className="text-sm text-slate-500">
                              AI・予想者・ウォッチ支持が入るとここに表示されます。
                            </p>
                          ) : (
                            round.topSignals.map((signal) => (
                              <div
                                key={`${signal.matchId}-${signal.outcome}`}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-950/5 px-3 py-2"
                              >
                                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
                                  <span>
                                    #{signal.matchNo} {signal.fixture} / {signal.outcome}
                                  </span>
                                  <Badge tone={signal.bucket === "darkhorse" ? "amber" : signal.bucket === "core" ? "teal" : "sky"}>
                                    {advantageBucketLabel[signal.bucket]}
                                  </Badge>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-semibold text-emerald-700">
                                    {formatSignedPercent(signal.compositeAdvantage)}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    注目配分 {formatPercent(signal.attentionShare)}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-slate-200 bg-slate-50/92 p-4">
                        <div className="flex items-center gap-2">
                          <Badge tone={progress.nextStep.tone}>次にやること</Badge>
                          <h3 className="text-sm font-semibold text-slate-900">
                            {progress.nextStep.label}
                          </h3>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {progress.nextStep.description}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link href={progress.nextStep.href} className={buttonClassName}>
                            {progress.nextStep.label}
                          </Link>
                          <Link
                            href={buildRoundHref(appRoute.workspace, round.id)}
                            className={secondaryButtonClassName}
                          >
                            ラウンドを開く
                          </Link>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>設定 {formatPercent(progress.setupCompletion)}</span>
                          <span>予想 {formatPercent(progress.pickCompletion)}</span>
                          <span>根拠 {formatPercent(progress.scoutCompletion)}</span>
                          <span>結果 {formatPercent(progress.resultCompletion)}</span>
                        </div>
                      </div>
                    </div>
                  </SectionCard>
                );
              })()
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
