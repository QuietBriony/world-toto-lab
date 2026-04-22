"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import {
  ConfigurationNotice,
  ErrorNotice,
  LoadingNotice,
} from "@/components/app/states";
import { FeedbackBoard } from "@/components/feedback-board";
import {
  ArtBannerPanel,
  Badge,
  buttonClassName,
  CollapsibleSectionCard,
  cx,
  fieldClassName,
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
  parseCompetitionType,
  parseDataProfile,
  parseProductType,
  parsePrimaryUse,
  parseRoundStatus,
  parseSportContext,
  stringValue,
  stringValues,
  nullableString,
} from "@/lib/forms";
import {
  advantageBucketLabel,
  competitionTypeLabel,
  dataProfileLabel,
  formatDateTime,
  formatCurrency,
  formatPercent,
  formatSignedPercent,
  primaryUseLabel,
  productTypeLabel,
  roundSourceLabel,
  roundStatusLabel,
  roundStatusOptions,
  sportContextLabel,
} from "@/lib/domain";
import { defaultRequiredMatchCount, productTypeOptions } from "@/lib/product-rules";
import {
  buildGoal3EventWatch,
  isGoal3LibraryEntry,
  pickFeaturedGoal3Entry,
} from "@/lib/goal3";
import {
  buildBigCarryoverQueryFromOfficialSnapshot,
  buildBigOfficialWatch,
  pickFeaturedBigOfficialSnapshot,
} from "@/lib/big-official";
import {
  bigCarryoverPresets,
  buildBigShockAlert,
  calculateBigCarryoverSummary,
  classifyBigHeatBand,
} from "@/lib/big-carryover";
import { resolveRoundParticipantUsers } from "@/lib/round-participants";
import { deriveRoundProgressSummary, matchHasSetupInput } from "@/lib/round-progress";
import { appRoute, buildHref, buildOfficialRoundImportHref, buildRoundHref } from "@/lib/round-links";
import {
  createDemoRound,
  createInitialUsers,
  createRound,
  deleteRound,
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
import { useBigOfficialWatch, useDashboardData, useTotoOfficialRoundLibrary } from "@/lib/use-app-data";
import { isWinnerLikeRound } from "@/lib/winner-value";
import { resolveWorldTotoProductLabel } from "@/lib/world-toto";
import { candidateStrategyArt, demoLabArt, resolveArtAsset } from "@/lib/ui-art";

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
  const pathname = usePathname();
  const router = useRouter();
  const { data, error, loading, refresh } = useDashboardData();
  const goal3Library = useTotoOfficialRoundLibrary({ productType: "custom" });
  const bigOfficialWatch = useBigOfficialWatch();
  const [busy, setBusy] = useState<"demo" | "members" | "round" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState(false);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [removingRoundId, setRemovingRoundId] = useState<string | null>(null);
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
        competitionType: parseCompetitionType(stringValue(formData, "competitionType")),
        dataProfile: parseDataProfile(stringValue(formData, "dataProfile")),
        matchCount,
        notes: nullableString(formData, "notes"),
        participantIds,
        primaryUse: parsePrimaryUse(stringValue(formData, "primaryUse")),
        productType,
        requiredMatchCount: productType === "custom" ? matchCount : null,
        roundSource: "user_manual",
        sourceNote: nullableString(formData, "sourceNote"),
        sportContext: parseSportContext(stringValue(formData, "sportContext")),
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

  const handleDeleteRound = async (roundId: string, title: string) => {
    if (!window.confirm(`「${title}」を削除します。関連する試合・支持・予想・候補カードも一緒に消えます。続けますか？`)) {
      return;
    }

    setRemovingRoundId(roundId);
    setActionError(null);

    try {
      await deleteRound(roundId);
      await refresh();
    } catch (nextError) {
      setActionError(errorMessage(nextError));
    } finally {
      setRemovingRoundId(null);
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
  const createRoundAnchor = "#create-round";
  const roundListAnchor = "#round-list";
  const latestRoundUsers =
    data && latestRound ? resolveRoundParticipantUsers(data.users, latestRound.participantIds) : [];
  const latestPrimaryUserId = latestRoundUsers[0]?.id;
  const latestPlayHref = latestRound
    ? buildRoundHref(appRoute.play, latestRound.id, {
        user: latestPrimaryUserId,
      })
    : createRoundAnchor;
  const latestPickRoomHref = latestRound
    ? buildRoundHref(appRoute.pickRoom, latestRound.id, {
        user: latestPrimaryUserId,
      })
    : createRoundAnchor;
  const latestSimpleViewHref = latestRound
    ? buildRoundHref(appRoute.simpleView, latestRound.id, {
        user: latestPrimaryUserId,
      })
    : createRoundAnchor;
  const spotlightProgressPercent = latestRoundProgress
    ? Math.round(
        ((latestRoundProgress.setupCompletion +
          latestRoundProgress.pickCompletion +
          latestRoundProgress.scoutCompletion +
          latestRoundProgress.resultCompletion) /
          4) *
          100,
      )
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
  const createRoundJourneyCards = [
    {
      body: "売り出しが始まったら、公式対象回を同期してそのまま toto / mini toto の Round に流し込みます。",
      ctaHref: buildOfficialRoundImportHref(undefined, {
        autoSync: true,
        productType: "toto13",
        sourcePreset: "yahoo_toto_schedule",
      }),
      ctaLabel: "toto を同期して選ぶ",
      secondaryHref: buildOfficialRoundImportHref(undefined, {
        autoSync: true,
        productType: "mini_toto",
        sourcePreset: "yahoo_toto_schedule",
      }),
      secondaryLabel: "mini toto で始める",
      title: "販売後に始める",
      tone: "sky" as const,
    },
    {
      body: "1試合の WINNER は、開催一覧より公式くじ情報URLから入るほうが安定します。BIG は別監視ページに切っています。",
      ctaHref: buildOfficialRoundImportHref(undefined, {
        productType: "winner",
        sourcePreset: "toto_official_detail",
      }),
      ctaLabel: "WINNER で始める",
      secondaryHref: appRoute.bigCarryover,
      secondaryLabel: "BIGウォッチ",
      title: "1試合や別商品で見る",
      tone: "amber" as const,
    },
    {
      body: "FIFA全試合の取り込みは、公式対象回がまだ出ていない時だけ使う補助導線です。発売前に遊び用Roundを先に作りたいときだけ開けば十分です。",
      ctaHref: appRoute.officialScheduleImport,
      ctaLabel: "発売前の手動準備へ",
      secondaryHref: appRoute.fixtureSelector,
      secondaryLabel: "13試合を手で選ぶ",
      title: "発売前に先に遊ぶ",
      tone: "teal" as const,
    },
  ];
  const goal3Entries = useMemo(
    () => (goal3Library.data ?? []).filter(isGoal3LibraryEntry),
    [goal3Library.data],
  );
  const featuredGoal3Entry = useMemo(
    () => pickFeaturedGoal3Entry(goal3Entries),
    [goal3Entries],
  );
  const featuredGoal3Watch = featuredGoal3Entry
    ? buildGoal3EventWatch(featuredGoal3Entry)
    : null;
  const goal3AttentionCount = goal3Entries.filter((entry) =>
    buildGoal3EventWatch(entry).requiresAttention,
  ).length;
  const winnerWatchRound =
    inventoryRounds.find((round) =>
      isWinnerLikeRound({
        matchCount: round.matchCount,
        productType: round.productType,
        requiredMatchCount: round.requiredMatchCount,
      }),
    ) ?? null;
  const winnerWatchUsers =
    data && winnerWatchRound
      ? resolveRoundParticipantUsers(data.users, winnerWatchRound.participantIds)
      : [];
  const featuredBigPreset = bigCarryoverPresets[0];
  const featuredBigSummary = calculateBigCarryoverSummary({
    carryoverYen: featuredBigPreset.carryoverYen,
    returnRate: featuredBigPreset.returnRatePercent / 100,
    salesYen: featuredBigPreset.salesYen,
    spendYen: featuredBigPreset.spendYen,
  });
  const featuredBigHeat = classifyBigHeatBand(featuredBigSummary);
  const featuredBigHref = buildHref(appRoute.bigCarryover, {
    carryover: featuredBigPreset.carryoverYen,
    eventType: featuredBigPreset.eventType,
    label: featuredBigPreset.eventLabel,
    returnRate: featuredBigPreset.returnRatePercent,
    sales: featuredBigPreset.salesYen,
    spend: featuredBigPreset.spendYen,
  });
  const bigOfficialSnapshots = useMemo(
    () => bigOfficialWatch.data?.snapshots ?? [],
    [bigOfficialWatch.data],
  );
  const featuredBigOfficialSnapshot = useMemo(
    () => pickFeaturedBigOfficialSnapshot(bigOfficialSnapshots),
    [bigOfficialSnapshots],
  );
  const featuredBigOfficial = featuredBigOfficialSnapshot
    ? buildBigOfficialWatch(featuredBigOfficialSnapshot)
    : null;
  const featuredBigOfficialHref = featuredBigOfficialSnapshot
    ? buildHref(
        appRoute.bigCarryover,
        buildBigCarryoverQueryFromOfficialSnapshot(featuredBigOfficialSnapshot),
      )
    : null;
  const bigOfficialAttentionCount = useMemo(
    () =>
      bigOfficialSnapshots.filter((snapshot) => buildBigOfficialWatch(snapshot).requiresAttention)
        .length,
    [bigOfficialSnapshots],
  );
  const bigOfficialShockCount = useMemo(
    () =>
      bigOfficialSnapshots.filter((snapshot) => buildBigOfficialWatch(snapshot).shockSignal !== "none")
        .length,
    [bigOfficialSnapshots],
  );
  const featuredBigShockAlert = featuredBigOfficial
    ? buildBigShockAlert({
        signal: featuredBigOfficial.shockSignal,
        summary: featuredBigOfficial.summary,
      })
    : null;
  const spotlightHeroImageSrc = resolveArtAsset(
    pathname,
    candidateStrategyArt.public_favorite.src,
  );
  const demoLabImageSrc = resolveArtAsset(pathname, demoLabArt.src);

  return (
    <div className="space-y-6">
      {!isSupabaseConfigured() ? (
        <ConfigurationNotice />
      ) : loading && !data ? (
        <LoadingNotice title="ダッシュボードを読み込み中" />
      ) : error && !data ? (
        <ErrorNotice error={error} onRetry={() => void refresh()} />
      ) : data ? (
        <>
          <SectionCard
            title="本番ラウンド"
            description="まずは直近の本番回を開くか、新しく1回作るだけで十分です。補助機能は下にまとめています。"
          >
            <ArtBannerPanel
              badge={<Badge tone="teal">{latestRound ? "進行中の本番回" : "最初の1回を作る"}</Badge>}
              className="border-emerald-200/55"
              backgroundGradient="linear-gradient(102deg,rgba(5,10,16,0.48),rgba(5,10,16,0.14)_52%,rgba(5,10,16,0.38))"
              contentClassName="min-h-[320px] gap-6 px-4 py-4 sm:min-h-[360px] sm:px-6 sm:py-6 lg:min-h-[392px]"
              bodyClassName="max-w-[44rem] space-y-4 drop-shadow-[0_18px_40px_rgba(0,0,0,0.48)]"
              description={
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="amber">{data.users.length}人</Badge>
                    <Badge tone="slate">
                      {latestRound ? `${latestRound.matchCount}試合` : "13試合から始める"}
                    </Badge>
                    {latestRoundProgress ? (
                      <Badge tone={latestRoundProgress.nextStep.tone}>
                        次: {latestRoundProgress.nextStep.label}
                      </Badge>
                    ) : null}
                    <Badge tone="sky">入力 {formatPercent(latestRoundProgress?.pickCompletion ?? 0)}</Badge>
                  </div>
                  <p className="max-w-[36rem] text-sm leading-6 text-white/88 sm:text-base">
                    {latestRound
                      ? `${latestRound.title} の続きから入り、候補カード、自分の予想、振り返りまでつなげられます。`
                      : "まずはラウンドを1つ作り、試合を入れて、候補カードと自分の予想が見える状態まで進めます。"}
                  </p>
                </div>
              }
              imageSrc={spotlightHeroImageSrc}
              overlayClassName="bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_28%,rgba(4,9,15,0.16))]"
              title={
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/35 bg-emerald-400/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-50">
                      <span className="h-2 w-2 rounded-full bg-emerald-300" />
                      LIVE
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.26em] text-white/74">
                      本番ラウンド
                    </span>
                  </div>
                  <div className="font-display text-[2.15rem] font-semibold tracking-[-0.08em] text-white sm:text-[2.8rem] lg:text-[3.35rem]">
                    {latestRound ? latestRound.title : "最初の本番回を作る"}
                  </div>
                </div>
              }
              actions={
                <Badge tone="slate">{liveRoundCount}本番回</Badge>
              }
              footer={
                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/78">
                      <span>
                        {latestRound ? `参加 ${latestRoundUsers.length || data.users.length}人` : "最初の1回から始める"}
                      </span>
                      <span>
                        {latestRound ? `候補 ${latestRound.candidateTicketCount}枚` : "候補カードは後から自動で並びます"}
                      </span>
                      <span>
                        {latestRound ? `入力 ${progressValue(latestRound.pickCount, latestRoundProgress?.expectedPickEntries ?? 0)}` : "予想入力は作成後に始めます"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={latestRound ? buildRoundHref(appRoute.workspace, latestRound.id) : createRoundAnchor}
                        className={buttonClassName}
                      >
                        {latestRound ? "本番回を開く" : "本番回を作る"}
                      </Link>
                      <Link href={latestPickRoomHref} className={secondaryButtonClassName}>
                        候補カード
                      </Link>
                      <Link href={latestSimpleViewHref} className={secondaryButtonClassName}>
                        自分の予想
                      </Link>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-[24px] border border-white/18 bg-[linear-gradient(145deg,rgba(8,14,22,0.52),rgba(8,14,22,0.24))] p-4 shadow-[0_22px_54px_-34px_rgba(0,0,0,0.45)] backdrop-blur-md md:hidden">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
                            進み具合
                          </p>
                          <p className="mt-2 text-sm text-white/76">
                            {latestRoundProgress?.nextStep.label ?? "まずはラウンド作成"}
                          </p>
                        </div>
                        <div className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-center">
                          <div className="font-display text-[1.6rem] font-semibold tracking-[-0.08em] text-white">
                            {spotlightProgressPercent !== null ? `${spotlightProgressPercent}%` : "0%"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-[18px] border border-white/8 bg-white/8 px-3 py-3 text-sm text-white/80">
                          試合設定 {latestRound ? progressValue(latestRoundProgress?.configuredMatches ?? 0, latestRound.matchCount) : "未作成"}
                        </div>
                        <div className="rounded-[18px] border border-white/8 bg-white/8 px-3 py-3 text-sm text-white/80">
                          候補カード {latestRound ? `${latestRound.candidateTicketCount}` : "未作成"}
                        </div>
                      </div>
                    </div>

                    <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-1">
                      <div className="rounded-[28px] border border-white/18 bg-[linear-gradient(145deg,rgba(8,14,22,0.52),rgba(8,14,22,0.24))] p-5 shadow-[0_22px_54px_-34px_rgba(0,0,0,0.45)] backdrop-blur-md">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
                            ラウンド進み具合
                          </p>
                          <p className="mt-2 text-sm text-white/72">
                            {latestRoundProgress
                              ? `${latestRoundProgress.nextStep.label} まで進んでいます`
                              : "まだ本番回はありません"}
                          </p>
                        </div>
                        <div className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-center">
                          <div className="font-display text-[1.8rem] font-semibold tracking-[-0.08em] text-white">
                            {spotlightProgressPercent !== null ? `${spotlightProgressPercent}%` : "0%"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
                        <div className="rounded-[18px] border border-white/8 bg-white/8 px-3 py-3 text-sm text-white/80">
                          試合設定 {latestRound ? progressValue(latestRoundProgress?.configuredMatches ?? 0, latestRound.matchCount) : "未作成"}
                        </div>
                        <div className="rounded-[18px] border border-white/8 bg-white/8 px-3 py-3 text-sm text-white/80">
                          支持 / 予想 {latestRound ? progressValue(latestRound.pickCount, latestRoundProgress?.expectedPickEntries ?? 0) : "未作成"}
                        </div>
                        <div className="rounded-[18px] border border-white/8 bg-white/8 px-3 py-3 text-sm text-white/80">
                          予想者カード {latestRound ? progressValue(latestRound.scoutReports.length, latestRoundProgress?.expectedScoutEntries ?? 0) : "未作成"}
                        </div>
                        <div className="rounded-[18px] border border-white/8 bg-white/8 px-3 py-3 text-sm text-white/80">
                          候補カード {latestRound ? `${latestRound.candidateTicketCount}` : "未作成"}
                        </div>
                      </div>
                    </div>

                      <div className="rounded-[28px] border border-white/18 bg-[linear-gradient(145deg,rgba(8,14,22,0.48),rgba(8,14,22,0.18))] p-5 shadow-[0_22px_54px_-34px_rgba(0,0,0,0.45)] backdrop-blur-md">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
                          今やること
                        </p>
                        <h3 className="mt-2 font-display text-xl font-semibold tracking-[-0.05em] text-white">
                          {latestRoundProgress?.nextStep.label ?? "まずはラウンド作成"}
                        </h3>
                        <p className="mt-3 text-sm leading-6 text-white/76">
                          {latestRoundProgress?.nextStep.description ??
                            "13試合の本番回を作って、試合設定から順に進めれば大丈夫です。"}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            href={latestRoundProgress?.nextStep.href ?? createRoundAnchor}
                            className={buttonClassName}
                          >
                            {latestRoundProgress?.nextStep.label ?? "ラウンドを作成"}
                          </Link>
                          {latestRound ? (
                            <a href={roundListAnchor} className={secondaryButtonClassName}>
                              一覧を見る
                            </a>
                          ) : (
                            <button
                              type="button"
                              className={secondaryButtonClassName}
                              onClick={handleOpenDemo}
                              disabled={busy === "demo"}
                            >
                              {busy === "demo" ? "準備中..." : "デモで流れを見る"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              }
            />

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {[
                {
                  body: "候補カードと自分の予想を、ひとつの流れで見ます。",
                  href: latestPlayHref,
                  label: "みんなで見る",
                  strategy: "orthodox_model" as const,
                },
                {
                  body: "王道・公式人気・人力推し・EV狙いを見比べます。",
                  href: latestPickRoomHref,
                  label: "候補カード",
                  strategy: "public_favorite" as const,
                },
                {
                  body: "1 / 0 / 2 を入れるだけの、やさしい入力画面です。",
                  href: latestSimpleViewHref,
                  label: "自分の予想",
                  strategy: "draw_alert" as const,
                },
              ].map((item) => {
                const artwork = candidateStrategyArt[item.strategy];
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="group overflow-hidden rounded-[26px] border border-white/60 bg-white/90 shadow-[0_22px_56px_-36px_rgba(15,23,42,0.42)]"
                  >
                    <div className="relative min-h-[220px] bg-slate-950">
                      <img
                        alt=""
                        aria-hidden="true"
                        src={resolveArtAsset(pathname, artwork.src)}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,12,18,0.04),rgba(7,12,18,0.28)_52%,rgba(7,12,18,0.64))]" />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_34%)]" />
                      <div className="relative z-10 flex min-h-[220px] flex-col justify-between gap-4 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="slate">{artwork.accentLabel}</Badge>
                        </div>
                        <div className="rounded-[22px] border border-white/16 bg-[linear-gradient(145deg,rgba(8,14,22,0.4),rgba(8,14,22,0.14))] p-4 shadow-[0_18px_44px_-34px_rgba(0,0,0,0.42)] backdrop-blur-sm">
                          <h3 className="font-display text-[1.35rem] font-semibold tracking-[-0.05em] text-white">
                            {item.label}
                          </h3>
                          <p className="mt-2 max-w-[22rem] text-sm leading-6 text-white/84">
                            {item.body}
                          </p>
                          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition-transform duration-200 group-hover:translate-x-1">
                            開く
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
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
                <div className="relative mb-4 overflow-hidden rounded-[22px] border border-slate-200 bg-slate-950">
                  <img
                    alt=""
                    aria-hidden="true"
                    src={demoLabImageSrc}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,12,18,0.08),rgba(7,12,18,0.54))]" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_35%)]" />
                  <div className="relative z-10 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/72">
                      {demoLabArt.title}
                    </p>
                    <p className="mt-2 max-w-[28rem] text-sm leading-6 text-white/82">
                      {demoLabArt.description}
                    </p>
                  </div>
                </div>
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
            title="はじめての人へ"
            description="初回はこの順で進めれば十分です。細かい設計や運用の話は、さらに下の補助欄に寄せています。"
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
                  body: "予想者は 1/0/2 とカードを入れ、ウォッチ担当は モデル か予想者のどちらに乗るかを選びます。",
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

          <CollapsibleSectionCard
            title="今できること"
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
            title="公開前の注意"
            description="公開サイトとして使う前に気をつけたい点だけを、必要なときに開けるようにしています。"
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
                  body: "この UI は モデル試算と人力判断を比べて、予想の根拠や振り返りを残すためのものです。金銭の受け渡しや代理購入のフローは入れていませんし、今後も別物として扱う想定です。",
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

          <CollapsibleSectionCard
            title="対象回の今後予定と入力状況"
            description="対象ラウンドの試合予定を近い順にまとめています。キックオフ時刻や試合情報、モデル試算の入り具合を確認したいときだけ開く想定です。"
            badge={<Badge tone="slate">{upcomingMatches.length}件</Badge>}
            defaultOpen={false}
          >
            {upcomingMatches.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/88 p-5 text-sm leading-7 text-slate-600">
                まだ対象回の今後予定はありません。ラウンド詳細の「試合編集」でキックオフ日時を入れると、ここに次の試合が出ます。
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
                            : "モデル確率はまだ入っていません"}
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
          </CollapsibleSectionCard>

          <CollapsibleSectionCard
            title="試合データとモデル試算の入り方"
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
                  <li>デモラウンドには試合情報、モデル確率、予想者ライン、支持入力、予想者カード、レビューが最初から入っています。</li>
                  <li>新規ラウンドでも、試合編集に入れた日時、会場、ステージ、公式人気、市場、モデル確率は各画面に反映されます。</li>
                  <li>モデル試算として見えているのは、いまは `1 / 0 / 2` の確率と、そこから作る試算ライン・優位差計算です。</li>
                </ul>
              </div>

              <div className="rounded-[24px] border border-amber-200 bg-amber-50/88 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone="amber">まだない</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    本格モデル自動運用と全面自動化はまだ未対応
                  </h3>
                </div>
                <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                  <li>FIFA日程取得、公式回一覧の半自動同期、BIG / GOAL3 の watch はありますが、全部が無人で埋まり続ける構成ではありません。</li>
                  <li>モデル確率は補助的な試算までで、本格モデルをこのサイト内で自動運用する段階ではありません。</li>
                  <li>なので現状は、公式取り込みを主導線にしつつ、必要なところだけ手入力や確認を差し込む MVP です。</li>
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

          <CollapsibleSectionCard
            id="create-round"
            title="別の始め方と細かい作成"
            description="主導線は toto公式の対象回取り込みです。FIFA全試合から組む流れは、発売前に先に遊ぶときだけ使う補助導線に寄せています。"
            defaultOpen={inventoryRounds.length === 0}
            badge={<Badge tone="slate">補助導線</Badge>}
          >
            <div className="mb-6 space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 px-5 py-4 text-sm leading-6 text-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="teal">状況で入口を分ける</Badge>
                  <Badge tone="slate">迷ったらここ</Badge>
                </div>
                <p className="mt-3">
                  ふだんは「販売後」か「1試合 / 別商品」から入れば十分です。
                  まだ公式対象回が出ていない時だけ「発売前に先に遊ぶ」を使い、URLや同期を使わずに細かく作りたいときだけ、下の `手入力で細かく作る`
                  を開けば大丈夫です。
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {createRoundJourneyCards.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={card.tone}>{card.title}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{card.body}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={card.ctaHref} className={buttonClassName}>
                        {card.ctaLabel}
                      </Link>
                      <Link href={card.secondaryHref} className={secondaryButtonClassName}>
                        {card.secondaryLabel}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 px-4 py-4 text-sm leading-6 text-slate-600">
                上の 3 枚で入口は足ります。ふだんは `toto / mini toto を選ぶ`、1試合商品は
                `WINNER`、まだ公式対象回が出ていない時だけ `発売前に先に遊ぶ` を開けば十分です。
              </div>
            </div>

            <CollapsibleSectionCard
              title="手入力で細かく作る"
              description="同期やURL取り込みを使わず、Round名・試合数・参加メンバーを手で決めたいときだけ開きます。"
              defaultOpen={false}
              badge={<Badge tone="slate">詳細設定</Badge>}
            >
              <form onSubmit={handleCreateRound} className="grid gap-5 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  ラウンド名
                  <input
                    name="title"
                    className={fieldClassName}
                    placeholder="2026 6 ワールドtoto本番"
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
                  商品タイプ
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
                  モード
                  <select name="competitionType" className={fieldClassName} defaultValue="world_cup">
                    {(
                      ["world_cup", "domestic_toto", "winner", "custom"] as const
                    ).map((competitionType) => (
                      <option key={competitionType} value={competitionType}>
                        {competitionTypeLabel[competitionType]}
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
                  データの厚み
                  <select name="dataProfile" className={fieldClassName} defaultValue="worldcup_rich">
                    {(
                      ["worldcup_rich", "domestic_standard", "manual_light", "demo"] as const
                    ).map((dataProfile) => (
                      <option key={dataProfile} value={dataProfile}>
                        {dataProfileLabel[dataProfile]}
                      </option>
                    ))}
                  </select>
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

                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  主な使い方
                  <select name="primaryUse" className={fieldClassName} defaultValue="friend_game">
                    {(
                      ["real_round_research", "practice", "demo", "friend_game"] as const
                    ).map((primaryUse) => (
                      <option key={primaryUse} value={primaryUse}>
                        {primaryUseLabel[primaryUse]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  競技文脈
                  <select name="sportContext" className={fieldClassName} defaultValue="national_team">
                    {(
                      ["national_team", "j_league", "club", "other"] as const
                    ).map((sportContext) => (
                      <option key={sportContext} value={sportContext}>
                        {sportContextLabel[sportContext]}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-950/5 p-4 text-sm text-slate-600">
                  `toto = 13試合 / mini toto = 5試合 / WINNER = 1試合 / カスタム = 任意` を目安にしてください。
                  現在の requiredMatchCount は {requiredMatchCountHint} 試合として扱います。
                  金銭、配当、代理購入、精算は扱いません。ここでの上位候補数は、候補配分画面で何案まで並べるかの目安です。
                </div>

                <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                  取り込みメモ
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
            </CollapsibleSectionCard>
            {actionError ? <p className="text-sm text-rose-700">{actionError}</p> : null}
          </CollapsibleSectionCard>

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
            ) : (
              <>
                <SectionCard
                  title="本番ラウンド一覧"
                  description="新規作成はいつでも上の `新規ラウンドを作成` から進められます。ここでは既に作った本番ラウンドを選びます。"
                >
                  <div className="flex flex-wrap gap-2">
                    <a href={createRoundAnchor} className={buttonClassName}>
                      新規ラウンドを作成
                    </a>
                    {inventoryRounds.map((round) => (
                      <Link
                        key={`round-shortcut-${round.id}`}
                        href={buildRoundHref(appRoute.workspace, round.id)}
                        className={secondaryButtonClassName}
                      >
                        {round.title}
                      </Link>
                    ))}
                  </div>
                </SectionCard>
                {inventoryRounds.map((round) => (
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
                const winnerLike = isWinnerLikeRound({
                  matchCount: round.matchCount,
                  productType: round.productType,
                  requiredMatchCount: round.requiredMatchCount,
                });
                const roundProductLabel = resolveWorldTotoProductLabel({
                  matchCount: round.matchCount,
                  matches: round.matches,
                  notes: round.notes,
                  productType: round.productType,
                  sourceNote: round.sourceNote,
                  title: round.title,
                }, productTypeLabel[round.productType as ProductType]);

                return (
                  <SectionCard
                    key={round.id}
                    title={round.title}
                    description={round.notes ?? "ラウンドメモはまだありません。"}
                  >
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 px-4 py-4 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.16)]">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="slate">{roundUsers.length}人</Badge>
                        <Badge tone="teal">{roundProductLabel}</Badge>
                        <Badge tone="info">{competitionTypeLabel[round.competitionType]}</Badge>
                        <Badge tone="slate">{dataProfileLabel[round.dataProfile]}</Badge>
                        <Badge tone="slate">{roundSourceLabel[round.roundSource]}</Badge>
                        <Badge tone="slate">
                          要件 {round.requiredMatchCount ?? round.matchCount}試合
                        </Badge>
                        <Badge tone="sky">{roundStatusLabel[round.status]}</Badge>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={buildRoundHref(appRoute.play, round.id, {
                            user: roundUsers[0]?.id,
                          })}
                          className={buttonClassName}
                        >
                          みんなで見る
                        </Link>
                        <Link
                          href={buildRoundHref(appRoute.pickRoom, round.id, {
                            user: roundUsers[0]?.id,
                          })}
                          className={secondaryButtonClassName}
                        >
                          候補カード
                        </Link>
                        <Link
                          href={buildRoundHref(appRoute.practiceLab, round.id)}
                          className={secondaryButtonClassName}
                        >
                          練習ラボ
                        </Link>
                        <Link
                          href={buildRoundHref(appRoute.workspace, round.id)}
                          className={secondaryButtonClassName}
                        >
                          ラウンド詳細
                        </Link>
                        <button
                          type="button"
                          className={cx(
                            secondaryButtonClassName,
                            "border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50",
                          )}
                          disabled={removingRoundId !== null}
                          onClick={() => void handleDeleteRound(round.id, round.title)}
                        >
                          {removingRoundId === round.id ? "削除中..." : "削除"}
                        </button>
                      </div>
                    </div>

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
                        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-xs text-slate-500">
                          <span>補助導線:</span>
                          <Link
                            href={buildRoundHref(appRoute.simpleView, round.id, {
                              user: roundUsers[0]?.id,
                            })}
                            className="font-medium text-slate-700 underline underline-offset-2"
                          >
                            自分の予想
                          </Link>
                          {winnerLike ? (
                            <Link
                              href={buildRoundHref(appRoute.winnerValue, round.id, {
                                user: roundUsers[0]?.id,
                              })}
                              className="font-medium text-slate-700 underline underline-offset-2"
                            >
                              WINNERボード
                            </Link>
                          ) : null}
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
              </>
            )}
          </section>

          <FeedbackBoard />

          <CollapsibleSectionCard
            title="期待値ウォッチ"
            description="GOAL3 / BIG / WINNER の別商品で、いま見ておきたい回だけをまとめています。ふだんは閉じたままで大丈夫です。"
            badge={
              <Badge
                tone={
                  goal3AttentionCount > 0 || bigOfficialAttentionCount > 0 || bigOfficialShockCount > 0
                    ? "teal"
                    : "slate"
                }
              >
                {goal3AttentionCount > 0 || bigOfficialAttentionCount > 0 || bigOfficialShockCount > 0
                  ? "要確認あり"
                  : "補助機能"}
              </Badge>
            }
            defaultOpen={false}
          >
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={featuredGoal3Watch?.requiresAttention ? "teal" : "sky"}>
                    {featuredGoal3Watch?.requiresAttention ? "期待値大" : "GOAL3 ウォッチ"}
                  </Badge>
                  <Badge tone="slate">{goal3Entries.length}回</Badge>
                </div>
                <h3 className="mt-3 font-display text-[1.35rem] font-semibold tracking-[-0.05em] text-slate-950">
                  {featuredGoal3Entry?.title ?? "totoGOAL3 を別枠で監視"}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {featuredGoal3Entry
                    ? featuredGoal3Watch?.snapshot.headline
                    : "Yahoo! toto 販売スケジュールに GOAL3 回が載っている時期だけ、専用ボードへ集約して表示します。"}
                </p>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>要確認 {goal3AttentionCount}</span>
                  <span>概算倍率 {formatPercent(featuredGoal3Watch?.summary.approxEvMultiple)}</span>
                  <span>売上 {formatCurrency(featuredGoal3Entry?.totalSalesYen ?? null)}</span>
                </div>
                {goal3Library.error ? (
                  <p className="mt-3 text-xs text-rose-700">GOAL3一覧取得: {goal3Library.error}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={appRoute.goal3Value} className={buttonClassName}>
                    GOAL3ボード
                  </Link>
                  <Link
                    href={buildOfficialRoundImportHref(undefined, {
                      productType: "custom",
                      sourcePreset: "yahoo_toto_schedule",
                    })}
                    className={secondaryButtonClassName}
                  >
                    GOAL3 を一覧で探す
                  </Link>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="amber">BIG ウォッチ</Badge>
                  <Badge tone={featuredBigOfficial ? featuredBigOfficial.heatBand.badgeTone : "info"}>
                    {featuredBigOfficial?.heatBand.label ?? "テンプレ比較"}
                  </Badge>
                  <Badge tone="slate">
                    {bigOfficialWatch.data ? `同期 ${bigOfficialSnapshots.length}商品` : "テンプレ"}
                  </Badge>
                  {featuredBigOfficial?.shockSignal !== "none" && featuredBigShockAlert ? (
                    <Badge tone={featuredBigShockAlert.badgeTone}>{featuredBigShockAlert.label}</Badge>
                  ) : null}
                </div>
                <h3 className="mt-3 font-display text-[1.35rem] font-semibold tracking-[-0.05em] text-slate-950">
                  {featuredBigOfficialSnapshot
                    ? `${featuredBigOfficialSnapshot.officialRoundName ?? featuredBigOfficialSnapshot.productLabel}`
                    : "BIGウォッチ"}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {featuredBigOfficial
                    ? featuredBigOfficial.eventSnapshot.headline
                    : "BIG は売上とキャリーから `特大上振れ候補 / 期待値大 / 分岐付近 / キャリーなし` を見ます。公式同期が取れないときはテンプレ条件で比較できます。"}
                </p>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>
                    {featuredBigOfficialSnapshot
                      ? `要確認 ${bigOfficialAttentionCount}商品`
                      : `例: ${featuredBigPreset.eventLabel}`}
                  </span>
                  {bigOfficialShockCount > 0 ? <span>ショック候補 {bigOfficialShockCount}商品</span> : null}
                  <span>
                    概算倍率{" "}
                    {formatPercent(
                      featuredBigOfficial?.summary.approxEvMultiple ?? featuredBigSummary.approxEvMultiple,
                    )}
                  </span>
                  <span>
                    売上{" "}
                    {formatCurrency(
                      featuredBigOfficialSnapshot?.totalSalesYen ?? featuredBigPreset.salesYen,
                    )}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  {featuredBigOfficial?.heatBand.hint ?? featuredBigHeat.hint}
                </p>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  {featuredBigOfficial?.shockSignal !== "none" && featuredBigShockAlert
                    ? featuredBigShockAlert.hint
                    : "いまの判定は主に `売上 + キャリー` 由来です。台風などの中止・成立条件の上振れは、別ロジックで追加する前提です。"}
                </p>
                {bigOfficialWatch.error ? (
                  <p className="mt-3 text-xs text-rose-700">BIG公式同期: {bigOfficialWatch.error}</p>
                ) : bigOfficialWatch.loading && !bigOfficialWatch.data ? (
                  <p className="mt-3 text-xs text-slate-500">BIG公式同期を確認中です...</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={appRoute.bigCarryover} className={buttonClassName}>
                    BIGウォッチ
                  </Link>
                  <Link
                    href={featuredBigOfficialHref ?? featuredBigHref}
                    className={secondaryButtonClassName}
                  >
                    {featuredBigOfficialHref ? "公式同期で開く" : "テンプレで開く"}
                  </Link>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="sky">WINNER</Badge>
                  <Badge tone="slate">1試合</Badge>
                </div>
                <h3 className="mt-3 font-display text-[1.35rem] font-semibold tracking-[-0.05em] text-slate-950">
                  1試合の妙味は WINNERボード
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {winnerWatchRound
                    ? `直近は「${winnerWatchRound.title}」をそのまま見に行けます。`
                    : "WINNER round がまだ無いときは、公式くじ情報URLから 1試合回を作るのが速いです。"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {winnerWatchRound ? (
                    <Link
                      href={buildRoundHref(appRoute.winnerValue, winnerWatchRound.id, {
                        user: winnerWatchUsers[0]?.id,
                      })}
                      className={buttonClassName}
                    >
                      WINNERボード
                    </Link>
                  ) : (
                    <Link
                      href={buildOfficialRoundImportHref(undefined, {
                        productType: "winner",
                        sourcePreset: "toto_official_detail",
                      })}
                      className={buttonClassName}
                    >
                      WINNER を作る
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </CollapsibleSectionCard>

          <CollapsibleSectionCard
            title="GitHub 共同開発で遊ぼう"
            description="GitHub 招待から branch と PR の作り方まで、共同開発の最初の流れだけをまとめています。必要なときだけ開けば十分です。"
            badge={<Badge tone="sky">共同開発</Badge>}
            defaultOpen={false}
            action={
              <Link href={appRoute.devPlaybook} className={buttonClassName}>
                共同開発ガイドを見る
              </Link>
            }
          >
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="grid gap-3">
                <div className="flex items-start gap-3 rounded-[24px] border border-slate-200 bg-white/84 px-4 py-4">
                  <Badge tone="teal">1</Badge>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">GitHub に参加してローカル起動</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      招待を受けたら clone して、`.env` を入れ、`npm ci` と `npm run dev` でまず動かします。
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-[24px] border border-slate-200 bg-white/84 px-4 py-4">
                  <Badge tone="sky">2</Badge>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">1タスク 1ブランチで小さく進める</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      `main` へ直接 push はせず、目的を 1 つに絞った branch と PR で進めます。
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-[24px] border border-slate-200 bg-white/84 px-4 py-4">
                  <Badge tone="amber">3</Badge>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Codex に狭い範囲で依頼する</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Codex を基本実装担当にし、同じファイルを複数 AI に同時編集させないようにします。
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-emerald-200 bg-emerald-50/80 p-5 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.16)]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="teal">はじめて向け</Badge>
                  <Badge tone="slate">5分で読める</Badge>
                </div>
                <h3 className="mt-3 font-display text-[1.35rem] font-semibold tracking-[-0.05em] text-slate-950">
                  共同開発の最初の約束
                </h3>
                <div className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                  <p>main 直接 push 禁止</p>
                  <p>1PR 1目的</p>
                  <p>PR にテスト / スクショ / 影響範囲を書く</p>
                  <p>DB migration は最小差分、Supabase 本番データは消さない</p>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href={appRoute.devPlaybook} className={buttonClassName}>
                    共同開発ガイド
                  </Link>
                  <a href="#create-round" className={secondaryButtonClassName}>
                    アプリも触ってみる
                  </a>
                </div>
              </div>
            </div>
          </CollapsibleSectionCard>
        </>
      ) : null}
    </div>
  );
}
