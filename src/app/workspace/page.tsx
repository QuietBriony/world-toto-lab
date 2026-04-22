"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";

import {
  EditingStatusNotice,
} from "@/components/app/editing-status";
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
  CollapsibleSectionCard,
  fieldClassName,
  HorizontalScrollTable,
  PageHeader,
  secondaryButtonClassName,
  SectionCard,
  StatCard,
  textAreaClassName,
} from "@/components/ui";
import {
  aiRecommendedOutcomes,
  advantageBucketLabel,
  buildAdvantageRows,
  buildMatchBadges,
  favoriteOutcomeForBucket,
  categoryLabel,
  competitionTypeLabel,
  dataProfileLabel,
  formatDateTime,
  formatNumber,
  formatOutcomeSet,
  formatPercent,
  formatSignedPercent,
  humanConsensusOutcomes,
  humanOverlayBadge,
  primaryUseLabel,
  productTypeLabel,
  probabilityConfidenceLabel,
  probabilityReadinessLabel,
  roundSourceLabel,
  roundStatusLabel,
  roundStatusOptions,
  sportContextLabel,
} from "@/lib/domain";
import {
  demoFocusMatches,
  demoWalkthroughSteps,
  isDemoRoundTitle,
} from "@/lib/demo-data";
import { calculateModelProbabilities } from "@/lib/probability/engine";
import { evaluateMatchReadiness } from "@/lib/probability/readiness";
import { deriveRoundProgressSummary, matchHasSetupInput } from "@/lib/round-progress";
import {
  nullableString,
  parseCompetitionType,
  parseDataProfile,
  parseIntOrNull,
  parsePrimaryUse,
  parseProductType,
  parseSportContext,
  parseRoundSource,
  parseRoundStatus,
  parseVoidHandling,
  stringValue,
  stringValues,
} from "@/lib/forms";
import { productTypeOptions, voidHandlingLabel, voidHandlingOptions } from "@/lib/product-rules";
import { fixtureImportTemplate, parseFixtureImportText } from "@/lib/fixture-import";
import {
  appRoute,
  buildOfficialRoundImportHref,
  buildRoundHref,
  getSingleSearchParam,
} from "@/lib/round-links";
import { bulkUpdateRoundMatches, estimateRoundAiModel, updateRound } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { budgetFromCandidateLimit, candidateLimitFromBudget } from "@/lib/tickets";
import type { Match } from "@/lib/types";
import { useRoundWorkspace } from "@/lib/use-app-data";
import { filterPredictors } from "@/lib/users";
import { isWinnerLikeRound } from "@/lib/winner-value";
import { resolveWorldTotoProductLabel } from "@/lib/world-toto";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "不明なエラーです。";
}

function progressValue(done: number, total: number) {
  return total > 0 ? `${done}/${total}` : "未設定";
}

function previewNotes(value: string | null | undefined, maxSentences = 2) {
  if (!value) {
    return null;
  }

  const sentences = value
    .split("。")
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, maxSentences);

  return sentences.length > 0 ? `${sentences.join("。")}。` : null;
}

function canCalculateModelPreview(match: Match) {
  return (
    match.marketProb1 !== null ||
    match.marketProb0 !== null ||
    match.marketProb2 !== null ||
    match.consensusF !== null ||
    match.consensusD !== null
  );
}

function previewRecommendedOutcomes(input: {
  modelProb0: number;
  modelProb1: number;
  modelProb2: number;
}) {
  const outcomes = [
    { outcome: "1", value: input.modelProb1 },
    { outcome: "0", value: input.modelProb0 },
    { outcome: "2", value: input.modelProb2 },
  ];

  return [...outcomes]
    .sort((left, right) => right.value - left.value)
    .slice(0, 2)
    .map((entry) => entry.outcome)
    .join(",");
}

function trimTrailingSlash(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function detectWorkspaceBasePath(pathname: string) {
  const normalizedPathname = trimTrailingSlash(pathname);
  const normalizedWorkspacePath = trimTrailingSlash(appRoute.workspace);
  const workspaceIndex = normalizedPathname.lastIndexOf(normalizedWorkspacePath);

  if (workspaceIndex <= 0) {
    return "";
  }

  return normalizedPathname.slice(0, workspaceIndex);
}

function resolveDebugHref(href: string, basePath: string) {
  return basePath ? `${basePath}${href}` : href;
}

type ScopedMessage = {
  message: string;
  scope: string;
};

function WorkspacePageContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const debugMode = getSingleSearchParam(searchParams.get("debug")) === "1";
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<ScopedMessage | null>(null);
  const [saveMessage, setSaveMessage] = useState<ScopedMessage | null>(null);
  const [dirtyScope, setDirtyScope] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);
  const [estimatingAi, setEstimatingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState<string | null>(null);
  const progress = data
    ? deriveRoundProgressSummary({
        matches: data.round.matches,
        picks: data.round.picks,
        roundId: data.round.id,
        scoutReports: data.round.scoutReports,
        users: data.users,
      })
    : null;
  const advantageRows = data
    ? buildAdvantageRows({
        matches: data.round.matches,
        picks: data.round.picks,
        users: data.users,
      })
    : [];
  const topAdvantageByMatchId = new Map(
    advantageRows.filter((row) => row.include).map((row) => [row.matchId, row] as const),
  );
  const predictorUsers = data ? filterPredictors(data.users) : [];
  const estimableMatchCount =
    data?.round.matches.filter((match) => canCalculateModelPreview(match)).length ?? 0;
  const missingAiCount =
    data?.round.matches.filter(
      (match) => match.modelProb1 === null && match.modelProb0 === null && match.modelProb2 === null,
    ).length ?? 0;
  const setupPendingMatches = data?.round.matches.filter((match) => !matchHasSetupInput(match)) ?? [];
  const aiGapMatches =
    data?.round.matches
      .map((match) => {
        const topSignal = topAdvantageByMatchId.get(match.id);
        return topSignal ? { match, topSignal } : null;
      })
      .filter(
        (
          entry,
        ): entry is {
          match: (typeof data.round.matches)[number];
          topSignal: (typeof advantageRows)[number];
        } => entry !== null,
      )
      .sort(
        (left, right) =>
          (right.topSignal.compositeAdvantage ?? 0) - (left.topSignal.compositeAdvantage ?? 0),
      )
      .slice(0, 4) ?? [];
  const drawWatchMatches =
    data?.round.matches
      .filter((match) => {
        const aiBase = aiRecommendedOutcomes(match);
        const humanBase = humanConsensusOutcomes(match);
        return (
          match.category === "draw_candidate" ||
          aiBase.includes("0") ||
          humanBase.includes("0")
        );
      })
      .slice(0, 4) ?? [];
  const aiPreviewMatches =
    data?.round.matches
      .filter((match) => canCalculateModelPreview(match))
      .slice(0, 4)
      .map((match) => ({
        estimated: calculateModelProbabilities({
          ...match,
          competitionType: data.round.competitionType,
          dataProfile: data.round.dataProfile,
        }),
        readiness: evaluateMatchReadiness({ match }),
        match,
      }))
      .filter((entry) => entry.estimated !== null) ?? [];
  const orderedOverviewMatches =
    data?.round.matches
      .slice()
      .sort((left, right) => {
        const leftReady = matchHasSetupInput(left) ? 1 : 0;
        const rightReady = matchHasSetupInput(right) ? 1 : 0;

        if (leftReady !== rightReady) {
          return leftReady - rightReady;
        }

        return left.matchNo - right.matchNo;
      }) ?? [];
  const isDemoRound = isDemoRoundTitle(data?.round.title);
  const demoNotePreview = isDemoRound ? previewNotes(data?.round.notes) : null;
  const demoFocusEntries = isDemoRound
    ? demoFocusMatches.map((item) => ({
        ...item,
        match: data?.round.matches.find((match) => match.matchNo === item.matchNo) ?? null,
      }))
    : [];
  const sharedMembersHref = `${appRoute.dashboard}#shared-members`;
  const picksEntryHref =
    data && data.users.length > 0
      ? buildRoundHref(appRoute.picks, data.round.id, {
          user: predictorUsers[0]?.id ?? data.users[0]?.id,
        })
      : sharedMembersHref;
  const scoutCardsEntryHref =
    data && predictorUsers.length > 0
      ? buildRoundHref(appRoute.scoutCards, data.round.id, {
          user: predictorUsers[0].id,
        })
      : sharedMembersHref;
  const detectedBasePath = detectWorkspaceBasePath(pathname);
  const currentRoundScope = data?.round.id ?? "none";
  const winnerLike = data
    ? isWinnerLikeRound({
        activeMatchCount: data.round.activeMatchCount,
        matchCount: data.round.matches.length,
        productType: data.round.productType,
        requiredMatchCount: data.round.requiredMatchCount,
      })
    : false;
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
  const hasVisibleUnsavedChanges = dirtyScope === currentRoundScope;
  const visibleSubmitError =
    submitError?.scope === currentRoundScope ? submitError.message : null;
  const visibleSaveMessage =
    saveMessage?.scope === currentRoundScope ? saveMessage.message : null;
  const roundBuilderLinks = data
    ? [
        {
          href: buildRoundHref(appRoute.officialScheduleImport, data.round.id),
          label: "official-schedule-import",
        },
        {
          href: buildRoundHref(appRoute.fixtureSelector, data.round.id),
          label: "fixture-selector",
        },
        {
          href: buildOfficialRoundImportHref(data.round.id, {
            autoApply: true,
            autoSync: true,
            productType: "toto13",
            sourcePreset: "yahoo_toto_schedule",
          }),
          label: "toto13-official-import",
        },
        {
          href: buildOfficialRoundImportHref(data.round.id, {
            autoApply: true,
            autoSync: true,
            productType: "mini_toto",
            sourcePreset: "yahoo_toto_schedule",
          }),
          label: "mini-toto-official-import",
        },
        ...(winnerLike
          ? [
              {
                href: buildOfficialRoundImportHref(data.round.id, {
                  autoApply: true,
                  productType: "winner",
                  sourcePreset: "toto_official_detail",
                }),
                label: "winner-official-import",
              },
            ]
          : []),
        {
          href: buildRoundHref(appRoute.simpleView, data.round.id, {
            user: data.users[0]?.id,
          }),
          label: "simple-view",
        },
        {
          href: buildRoundHref(appRoute.pickRoom, data.round.id, {
            user: data.users[0]?.id,
          }),
          label: "pick-room",
        },
        ...(winnerLike
          ? [
              {
                href: buildRoundHref(appRoute.winnerValue, data.round.id, {
                  user: data.users[0]?.id,
                }),
                label: "winner-value",
              },
            ]
          : []),
      ]
    : [];
  const roundBuilderSpotlightCards = data
    ? (() => {
        const materialCard = {
          badge: data.round.matches.length === 0 ? "まずここ" : "素材更新",
          body:
            data.round.matches.length === 0
              ? data.round.productType === "winner"
                ? "この Round にはまだ試合が入っていません。WINNER は公式くじ情報URLから入れるのが最短です。"
                : "この Round にはまだ試合が入っていません。まずは公式対象回を取り込み、まだ未発表なら確定日程ベースの手動準備へ回ります。"
              : "試合素材を入れ直したいときの入口です。ふだんは公式対象回で更新し、発売前の仮Roundだけ確定日程ベースを使います。",
          ctaHref:
            data.round.matches.length === 0
              ? buildOfficialRoundImportHref(data.round.id, {
                  autoSync: data.round.productType === "winner" ? false : true,
                  productType: data.round.productType,
                  sourcePreset:
                    data.round.productType === "winner"
                      ? "toto_official_detail"
                      : "yahoo_toto_schedule",
                })
              : buildOfficialRoundImportHref(data.round.id, {
                  autoSync: data.round.productType === "winner" ? false : true,
                  productType: data.round.productType,
                  sourcePreset:
                    data.round.productType === "winner"
                      ? "toto_official_detail"
                      : "yahoo_toto_schedule",
                }),
          ctaLabel:
            data.round.productType === "winner"
              ? "公式URLから更新する"
              : data.round.matches.length === 0
                ? "公式対象回から始める"
                : "公式回を同期して更新する",
          secondaryHref:
            data.round.matches.length === 0
              ? buildRoundHref(appRoute.officialScheduleImport, data.round.id)
              : buildRoundHref(appRoute.officialScheduleImport, data.round.id),
          secondaryLabel:
            data.round.matches.length === 0
              ? "発売前の手動準備へ"
              : "確定日程ベースで見直す",
          title: data.round.matches.length === 0 ? "試合素材を入れる" : "ラウンド素材を整える",
          tone: "teal" as const,
        };
        const productCard = {
          badge: roundProductLabel ?? productTypeLabel[data.round.productType],
          body:
            data.round.productType === "winner"
              ? "WINNER は公式くじ情報URLを直接読む導線がいちばん安定です。"
              : "今の商品に合った公式回の一覧を開き、そのままこのラウンドに反映できます。",
          ctaHref: buildOfficialRoundImportHref(data.round.id, {
            autoSync: data.round.productType === "winner" ? false : true,
            productType: data.round.productType,
            sourcePreset:
              data.round.productType === "winner"
                ? "toto_official_detail"
                : "yahoo_toto_schedule",
          }),
          ctaLabel:
            data.round.productType === "winner"
              ? "WINNER 公式URLを開く"
              : "この商品で公式回を見る",
          secondaryHref:
            data.round.productType === "winner"
              ? buildRoundHref(appRoute.pickRoom, data.round.id, {
                  user: data.users[0]?.id,
                })
              : buildRoundHref(appRoute.fixtureSelector, data.round.id),
          secondaryLabel:
            data.round.productType === "winner" ? "候補カードへ" : "試合を選んで保存",
          title: "いまの商品で進める",
          tone: "sky" as const,
        };
        const sharingCard = {
          badge: data.round.matches.length > 0 ? "共有導線" : "準備後に使う",
          body:
            data.round.matches.length > 0
              ? "素材が入っているので、ここからは見る・投票する段階です。"
              : "試合素材を入れたあとに、自分の予想と候補カードで共有に進みます。",
          ctaHref: buildRoundHref(appRoute.pickRoom, data.round.id, {
            user: data.users[0]?.id,
          }),
          ctaLabel: "候補カードを開く",
          secondaryHref: buildRoundHref(appRoute.simpleView, data.round.id, {
            user: data.users[0]?.id,
          }),
          secondaryLabel: "自分の予想で確認",
          title: "みんなで見る・投票する",
          tone: "amber" as const,
        };

        return data.round.matches.length > 0
          ? [sharingCard, productCard, materialCard]
          : [materialCard, productCard, sharingCard];
      })()
    : [];

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

  const handleSaveRound = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!data) {
      return;
    }

    setSaving(true);
    setSubmitError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const candidateLimit = parseIntOrNull(stringValue(formData, "candidateLimit"));
      const productType = parseProductType(stringValue(formData, "productType"));
      const participantIds = stringValues(formData, "participantUserId");

      if (!isDemoRound && data.availableUsers.length > 0 && participantIds.length === 0) {
        throw new Error("この回で使うメンバーを1人以上選んでください。");
      }

      await updateRound({
        roundId: data.round.id,
        title: stringValue(formData, "title") || "無題のラウンド",
        status: parseRoundStatus(stringValue(formData, "status")),
        budgetYen:
          candidateLimit !== null ? budgetFromCandidateLimit(candidateLimit) : null,
        competitionType: parseCompetitionType(stringValue(formData, "competitionType")),
        dataProfile: parseDataProfile(stringValue(formData, "dataProfile")),
        notes: nullableString(formData, "notes"),
        participantIds,
        primaryUse: parsePrimaryUse(stringValue(formData, "primaryUse")),
        productType,
        requiredMatchCount: parseIntOrNull(stringValue(formData, "requiredMatchCount")),
        roundSource: parseRoundSource(stringValue(formData, "roundSource")),
        sourceNote: nullableString(formData, "sourceNote"),
        sportContext: parseSportContext(stringValue(formData, "sportContext")),
        voidHandling: parseVoidHandling(stringValue(formData, "voidHandling")),
      });
      setDirtyScope(null);
      setSaveMessage({
        scope: currentRoundScope,
        message: "ラウンド設定を保存しました。参加メンバーと進行表示に反映されます。",
      });
      await refresh();
    } catch (nextError) {
      setSubmitError({
        scope: currentRoundScope,
        message: errorMessage(nextError),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!data) {
      return;
    }

    setBulkSaving(true);
    setBulkError(null);
    setBulkSuccess(null);

    try {
      const formData = new FormData(event.currentTarget);
      const importedText = stringValue(formData, "fixtureImport");
      const parsed = parseFixtureImportText(importedText);

      if (parsed.rows.length === 0) {
        throw new Error(parsed.warnings[0] ?? "読み込める試合日程がありませんでした。");
      }

      if (parsed.rows.some((row) => row.matchNo < 1 || row.matchNo > data.round.matches.length)) {
        throw new Error(`試合番号は 1 から ${data.round.matches.length} の範囲で入れてください。`);
      }

      await bulkUpdateRoundMatches({
        roundId: data.round.id,
        rows: parsed.rows,
      });

      await refresh();

      setBulkSuccess(
        parsed.warnings.length > 0
          ? `${parsed.rows.length} 試合を反映しました。注意: ${parsed.warnings.join(" / ")}`
          : `${parsed.rows.length} 試合をまとめて反映しました。`,
      );
    } catch (nextError) {
      setBulkError(errorMessage(nextError));
    } finally {
      setBulkSaving(false);
    }
  };

  const handleEstimateAi = async (overwriteExisting = false) => {
    if (!data) {
      return;
    }

    setEstimatingAi(true);
    setAiError(null);
    setAiSuccess(null);

    try {
      const result = await estimateRoundAiModel({
        overwriteExisting,
        roundId: data.round.id,
      });
      await refresh();
      setAiSuccess(
        result.updatedCount > 0
          ? `${result.updatedCount} 試合のモデル確率を${overwriteExisting ? "再" : ""}計算しました。`
          : "試算できる試合がありませんでした。先に市場確率か Human Scout を入れてください。",
      );
    } catch (nextError) {
      setAiError(errorMessage(nextError));
    } finally {
      setEstimatingAi(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="ラウンド詳細"
        title={data?.round.title ?? "ラウンド詳細"}
        description={
          isDemoRound
            ? "このデモは、確認カード → 支持 / 予想 → コンセンサス → 振り返り の順で触ると全体像をつかみやすいです。"
            : `${data?.round.matches.length ?? 0}試合の分析入力状況を、モデル試算と予想者ラインを土台にして支持分布まで一気に俯瞰できます。`
        }
        actions={
          data ? (
            <div className="flex flex-col gap-3 sm:items-end">
              <div className="flex flex-wrap gap-2">
                {data.round.matches.length === 0 ? (
                  <>
                    <Link
                      href={buildRoundHref(appRoute.officialScheduleImport, data.round.id)}
                      className={buttonClassName}
                    >
                      試合素材を入れる
                    </Link>
                    <Link
                      href={buildRoundHref(appRoute.fixtureSelector, data.round.id)}
                      className={secondaryButtonClassName}
                    >
                      試合を選んで保存
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href={buildRoundHref(appRoute.play, data.round.id, {
                        user: data.users[0]?.id,
                      })}
                      className={secondaryButtonClassName}
                    >
                      みんなで見る
                    </Link>
                    <Link
                      href={buildRoundHref(appRoute.pickRoom, data.round.id, {
                        user: data.users[0]?.id,
                      })}
                      className={buttonClassName}
                    >
                      候補カード
                    </Link>
                    {winnerLike ? (
                      <Link
                        href={buildRoundHref(appRoute.winnerValue, data.round.id, {
                          user: data.users[0]?.id,
                        })}
                        className={secondaryButtonClassName}
                      >
                        WINNERボード
                      </Link>
                    ) : null}
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isDemoRound ? <Badge tone="amber">デモ</Badge> : null}
                <Badge tone="teal">{roundProductLabel ?? productTypeLabel[data.round.productType]}</Badge>
                <Badge tone="slate">{probabilityReadinessLabel[data.round.probabilityReadiness]}</Badge>
                <Badge tone="sky">{roundStatusLabel[data.round.status]}</Badge>
              </div>
            </div>
          ) : undefined
        }
      />

      {!isSupabaseConfigured() ? (
        <ConfigurationNotice />
      ) : !roundId ? (
        <RoundRequiredNotice />
      ) : loading && !data ? (
        <LoadingNotice title="ラウンドを読み込み中" />
      ) : error && !data ? (
        <ErrorNotice error={error} onRetry={() => void refresh()} />
      ) : data ? (
        <>
          <RoundNav
            roundId={data.round.id}
            roundTitle={data.round.title}
            roundStatus={roundStatusLabel[data.round.status]}
            currentPath={appRoute.workspace}
          />

          <CollapsibleSectionCard
            title="モードと試算条件"
            description="W杯と通常totoで材料の厚みは違いますが、確率・Edge・EV のロジックは共通です。細かい前提を確認したいときだけ開く想定です。"
            badge={
              <Badge
                tone={
                  data.round.probabilityReadiness === "ready"
                    ? "teal"
                    : data.round.probabilityReadiness === "partial"
                      ? "amber"
                      : "slate"
                }
              >
                {probabilityReadinessLabel[data.round.probabilityReadiness]}
              </Badge>
            }
            defaultOpen={data.round.probabilityReadiness !== "ready"}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="モード"
                value={competitionTypeLabel[data.round.competitionType]}
                compact
                hint={sportContextLabel[data.round.sportContext]}
                tone="positive"
              />
              <StatCard
                label="データの厚み"
                value={dataProfileLabel[data.round.dataProfile]}
                compact
                hint={primaryUseLabel[data.round.primaryUse]}
              />
              <StatCard
                label="試算状態"
                value={probabilityReadinessLabel[data.round.probabilityReadiness]}
                compact
                hint="試算可能 / 部分試算 / 低信頼 / 未設定"
                tone={
                  data.round.probabilityReadiness === "ready"
                    ? "positive"
                    : data.round.probabilityReadiness === "partial"
                      ? "draw"
                      : "warning"
                }
              />
              <StatCard
                label="遊ぶ導線"
                value={data.round.primaryUse === "practice" ? "練習ラボ" : "みんなで見る"}
                compact
                hint={
                  data.round.primaryUse === "practice"
                    ? "通常totoの練習回として振り返りに寄せます。"
                    : "友人向けは みんなで見る と候補カードを使います。"
                }
              />
            </div>
          </CollapsibleSectionCard>

      <CollapsibleSectionCard
        title="ラウンド作成と取り込み"
        description="主導線は toto公式の対象回取り込みです。FIFA全試合から組む流れは、発売前に先に遊ぶ時だけ使う補助導線に寄せています。"
        defaultOpen={data.round.matches.length === 0}
        badge={<Badge tone="sky">導線</Badge>}
      >
            <div className="space-y-6">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 px-5 py-4 text-sm leading-6 text-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={data.round.matches.length === 0 ? "amber" : "teal"}>
                    {data.round.matches.length === 0 ? "素材待ち" : "共有に進める状態"}
                  </Badge>
                  <Badge tone="slate">{roundProductLabel ?? productTypeLabel[data.round.productType]}</Badge>
                </div>
                <p className="mt-3">
                  {data.round.matches.length === 0
                    ? "この Round はまだ材料が入っていません。まずは公式対象回を試し、まだ未発表なら確定日程ベースの手動準備へ回るのが自然です。"
                    : "このラウンドには試合素材があります。更新したいときだけ取り込みへ戻り、ふだんは自分の予想と候補カードを使えば十分です。"}
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {roundBuilderSpotlightCards.map((entry) => (
                  <div
                    key={entry.title}
                    className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={entry.tone}>{entry.badge}</Badge>
                    </div>
                    <h3 className="mt-3 font-semibold text-slate-950">{entry.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{entry.body}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={entry.ctaHref} className={buttonClassName}>
                        {entry.ctaLabel}
                      </Link>
                      <Link href={entry.secondaryHref} className={secondaryButtonClassName}>
                        {entry.secondaryLabel}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              <details className="rounded-[24px] border border-slate-200 bg-slate-50/90 px-4 py-4">
                <summary className="cursor-pointer list-none font-semibold text-slate-900">
                  進め方メモ
                </summary>
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[22px] border border-teal-200 bg-teal-50 px-4 py-4">
                      <p className="text-sm font-semibold text-teal-950">発売前の補助導線</p>
                      <p className="mt-2 text-sm leading-6 text-teal-900">
                        公式対象回がまだ出ていない時だけ{" "}
                        <span className="font-medium">公式日程を取り込む → 試合を選んで保存</span>{" "}
                        の順で仮Roundを組みます。
                      </p>
                    </div>
                    <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4">
                      <p className="text-sm font-semibold text-amber-950">ふだんの主導線</p>
                      <p className="mt-2 text-sm leading-6 text-amber-900">
                        売り出し後は{" "}
                        <span className="font-medium">公式回を同期して選ぶ</span>{" "}
                        で対象試合と売上前提を取り込みます。
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-slate-200 bg-white/85 px-4 py-4 text-sm leading-6 text-slate-600">
                    上の 3 枚から入れば十分です。発売前は `試合素材を入れる`、販売後は
                    `いまの商品で進める`、素材がそろったら `みんなで見る・投票する`
                    を開く、の順でほとんどの作業が済みます。
                  </div>
                </div>
              </details>
            </div>

            {debugMode ? (
              <details className="rounded-[24px] border border-slate-200 bg-slate-50/90 px-4 py-4">
                <summary className="cursor-pointer list-none font-semibold text-slate-900">
                  Debug Panel
                </summary>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="slate">current path {pathname}</Badge>
                    <Badge tone="slate">detected base path {detectedBasePath || "(root)"}</Badge>
                    <Badge tone="info">round {data.round.id}</Badge>
                  </div>
                  <div className="space-y-2 rounded-[20px] border border-slate-200 bg-white/85 p-4">
                    {roundBuilderLinks.map((entry) => (
                      <p key={entry.label} className="break-all">
                        <span className="font-semibold text-slate-900">{entry.label}</span>:{" "}
                        {resolveDebugHref(entry.href, detectedBasePath)}
                      </p>
                    ))}
                  </div>
                </div>
              </details>
            ) : null}
          </CollapsibleSectionCard>

          <RoundProgressCallout
            currentPath={appRoute.workspace}
            matches={data.round.matches}
            picks={data.round.picks}
            roundId={data.round.id}
            scoutReports={data.round.scoutReports}
            users={data.users}
          />

          <RouteGlossaryCard
            currentPath={appRoute.workspace}
            defaultOpen={false}
          />

          {visibleSubmitError ? (
            <EditingStatusNotice
              tone="rose"
              title="保存に失敗しました"
              description={visibleSubmitError}
            />
          ) : hasVisibleUnsavedChanges ? (
            <EditingStatusNotice
              tone="amber"
              title="未保存の変更があります"
              description="ラウンド名、参加メンバー、候補上限の変更は、保存するまでは他画面に反映されません。"
              action={
                <button
                  type="submit"
                  form="workspace-round-form"
                  className={buttonClassName}
                  disabled={saving}
                >
                  {saving ? "保存中..." : "ラウンドを保存"}
                </button>
              }
            />
          ) : visibleSaveMessage ? (
            <EditingStatusNotice
              tone="teal"
              title="保存済み"
              description={visibleSaveMessage}
            />
          ) : null}

          {isDemoRound ? (
            <CollapsibleSectionCard
              title="このデモで最初に見る順番"
              description={
                demoNotePreview ??
                "モデル試算と人力判断の流れを、実データ入りの 1 ラウンドでそのまま追えます。"
              }
              defaultOpen
              badge={<Badge tone="amber">デモガイド</Badge>}
            >
              <div className="flex flex-wrap gap-2">
                <a href="#overview-cards" className={secondaryButtonClassName}>
                  確認カードへ
                </a>
              </div>
              <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
                <div className="grid gap-3 sm:grid-cols-2">
                  {demoWalkthroughSteps.map((step, index) => {
                    const href =
                      step.key === "overview"
                        ? "#overview-cards"
                        : step.key === "picks"
                          ? buildRoundHref(appRoute.picks, data.round.id, {
                              user: data.users[0]?.id,
                            })
                          : step.key === "consensus"
                            ? buildRoundHref(appRoute.consensus, data.round.id)
                            : buildRoundHref(appRoute.review, data.round.id);

                    return (
                      <div
                        key={step.key}
                        className="rounded-[22px] border border-white/80 bg-white/78 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.36)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-display text-[11px] uppercase tracking-[0.34em] text-teal-800/72">
                              手順 {String(index + 1).padStart(2, "0")}
                            </div>
                            <h3 className="mt-3 font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                              {step.title}
                            </h3>
                          </div>
                          {step.key === "overview" ? (
                            <a href={href} className={secondaryButtonClassName}>
                              開く
                            </a>
                          ) : (
                            <Link href={href} className={secondaryButtonClassName}>
                              開く
                            </Link>
                          )}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{step.body}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50/82 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="amber">教材</Badge>
                    <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                      まず見る代表例
                    </h3>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge tone="slate">{data.round.matches.length}試合</Badge>
                    <Badge tone="slate">{data.users.length}人</Badge>
                    <Badge tone="slate">{data.round.picks.length}予想</Badge>
                    <Badge tone="slate">{data.round.scoutReports.length}根拠</Badge>
                    <Badge tone="slate">{data.round.reviewNotes.length}振り返り</Badge>
                  </div>
                  <div className="mt-4 space-y-3">
                    {demoFocusEntries.map((item) => (
                      <div
                        key={`demo-focus-${item.matchNo}`}
                        className="rounded-[18px] border border-slate-200 bg-white/78 p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="sky">
                            #{item.matchNo} {item.label}
                          </Badge>
                          {item.match?.actualResult ? (
                            <Badge tone="slate">
                              結果{" "}
                              {item.match.actualResult
                                .replace("ONE", "1")
                                .replace("DRAW", "0")
                                .replace("TWO", "2")}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">
                          {item.title}
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {item.match ? `${item.match.homeTeam} 対 ${item.match.awayTeam}。` : ""}
                          {item.body}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CollapsibleSectionCard>
          ) : null}

          <SectionCard
            title="進行チェック"
            description="今どこまで進んでいるかと、次にやることを先に確認できます。"
          >
            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard
                  label="試合設定"
                  value={
                    progressValue(progress?.configuredMatches ?? 0, data.round.matches.length)
                  }
                  hint="キックオフ、確率、メモなどが入った試合数"
                  compact
                />
                <StatCard
                  label="支持 / 予想"
                  value={
                    progressValue(
                      data.round.picks.length,
                      progress?.expectedPickEntries ?? 0,
                    )
                  }
                  hint="予想者の入力とウォッチの支持先が入った件数"
                  compact
                />
                <StatCard
                  label="予想者カード"
                  value={
                    progressValue(
                      data.round.scoutReports.length,
                      progress?.expectedScoutEntries ?? 0,
                    )
                  }
                  hint="予想者だけが入れる根拠スコアとメモ"
                  compact
                />
                <StatCard
                  label="結果入力"
                  value={progressValue(
                    data.round.matches.filter((match) => match.actualResult !== null).length,
                    data.round.matches.length,
                  )}
                  hint="試合結果の入力状況"
                  compact
                />
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={progress?.nextStep.tone ?? "sky"}>今やること</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    {progress?.nextStep.label ?? "ラウンドを進める"}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {progress?.nextStep.description ??
                    "試合設定、AIと予想者の比較、支持 / 予想、予想者カード、振り返りの順で進めるとまとまりやすいです。"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {progress ? (
                    <Link href={progress.nextStep.href} className={buttonClassName}>
                      {progress.nextStep.label}
                    </Link>
                  ) : null}
                  <Link href={picksEntryHref} className={secondaryButtonClassName}>
                    {data.users.length > 0 ? "支持 / 予想へ" : "共有メンバーを作成"}
                  </Link>
                  <Link href={scoutCardsEntryHref} className={secondaryButtonClassName}>
                    {predictorUsers.length > 0 ? "予想者カードへ" : "予想者を設定"}
                  </Link>
                  <Link
                    href={buildRoundHref(appRoute.review, data.round.id)}
                    className={secondaryButtonClassName}
                  >
                    振り返りへ
                  </Link>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>設定 {formatPercent(progress?.setupCompletion ?? 0)}</span>
                  <span>予想 {formatPercent(progress?.pickCompletion ?? 0)}</span>
                  <span>根拠 {formatPercent(progress?.scoutCompletion ?? 0)}</span>
                  <span>結果 {formatPercent(progress?.resultCompletion ?? 0)}</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  基本の順番: 試合設定 → AIと予想者の比較 → 支持 / 予想入力 → 予想者カード → コンセンサス → 振り返り
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="まず見るところ"
            description="細かい表を見る前に、設定不足と注目試合だけ先に拾えます。"
          >
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-[24px] border border-amber-200 bg-amber-50/75 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone="amber">要設定</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    まず埋める試合
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  日時、人気、AIの土台が足りない試合です。
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {setupPendingMatches.length === 0 ? (
                    <Badge tone="positive">全試合ひと通り設定済み</Badge>
                  ) : (
                    setupPendingMatches.slice(0, 5).map((match) => (
                      <Badge key={match.id} tone="amber">
                        #{match.matchNo} {match.homeTeam} 対 {match.awayTeam}
                      </Badge>
                    ))
                  )}
                </div>
                <div className="mt-4">
                  <Link
                    href={buildRoundHref(appRoute.matchEditor, data.round.id, {
                      match: setupPendingMatches[0]?.id ?? data.round.matches[0]?.id,
                    })}
                    className={secondaryButtonClassName}
                  >
                    試合編集へ
                  </Link>
                </div>
              </div>

              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/70 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone="positive">優位差大</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    合成優位が強い試合
                  </h3>
                </div>
                <div className="mt-4 space-y-3">
                  {aiGapMatches.length === 0 ? (
                    <p className="text-sm leading-6 text-slate-600">
                      AI・予想者・ウォッチ支持が揃うと、ここに注目候補が出ます。
                    </p>
                  ) : (
                    aiGapMatches.map(({ match, topSignal }) => (
                      <div
                        key={match.id}
                        className="rounded-[18px] border border-emerald-200 bg-white/75 p-3"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          #{match.matchNo} {match.homeTeam} 対 {match.awayTeam}
                        </div>
                        <div className="mt-1 text-sm text-slate-700">
                          {topSignal.outcome} が {formatSignedPercent(topSignal.compositeAdvantage)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge
                            tone={
                              topSignal.bucket === "darkhorse"
                                ? "amber"
                                : topSignal.bucket === "core"
                                  ? "teal"
                                  : "sky"
                            }
                          >
                            {advantageBucketLabel[topSignal.bucket]}
                          </Badge>
                          <Badge tone="slate">
                            注目配分 {formatPercent(topSignal.attentionShare)}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-sky-200 bg-sky-50/70 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone="sky">0候補</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    引き分けを見たい試合
                  </h3>
                </div>
                <div className="mt-4 space-y-3">
                  {drawWatchMatches.length === 0 ? (
                    <p className="text-sm leading-6 text-slate-600">
                      カテゴリやモデル試算で引き分け寄りになる試合があると、ここに出ます。
                    </p>
                  ) : (
                    drawWatchMatches.map((match) => (
                      <div
                        key={match.id}
                        className="rounded-[18px] border border-sky-200 bg-white/75 p-3"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          #{match.matchNo} {match.homeTeam} 対 {match.awayTeam}
                        </div>
                        <div className="mt-1 text-sm text-slate-700">
                          試算 {formatOutcomeSet(aiRecommendedOutcomes(match))} / 人力{" "}
                          {formatOutcomeSet(humanConsensusOutcomes(match))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {match.category ? (
                            <Badge tone="sky">{categoryLabel[match.category]}</Badge>
                          ) : null}
                          {match.consensusCall ? (
                            <Badge tone="slate">{match.consensusCall}</Badge>
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
            title="ラウンド設定"
            description="商品タイプ、試合数要件、取り込み元、候補上限、参加メンバー、ステータス、当日の観戦メモをここで更新します。"
          >
            <form
              id="workspace-round-form"
              key={data.round.updatedAt}
              onSubmit={handleSaveRound}
              onChangeCapture={() => {
                setSubmitError(null);
                setSaveMessage(null);
                setDirtyScope(currentRoundScope);
              }}
              className="grid gap-5 md:grid-cols-2"
            >
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                ラウンド名
                <input
                  name="title"
                  defaultValue={data.round.title}
                  className={fieldClassName}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                ステータス
                <select
                  name="status"
                  className={fieldClassName}
                  defaultValue={data.round.status}
                >
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
                  defaultValue={data.round.productType}
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
                <select
                  name="competitionType"
                  className={fieldClassName}
                  defaultValue={data.round.competitionType}
                >
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
                必要試合数
                <input
                  name="requiredMatchCount"
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  defaultValue={data.round.requiredMatchCount ?? data.round.matches.length}
                  className={fieldClassName}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                データの厚み
                <select
                  name="dataProfile"
                  className={fieldClassName}
                  defaultValue={data.round.dataProfile}
                >
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
                  defaultValue={candidateLimitFromBudget(data.round.budgetYen ?? 500)}
                  className={fieldClassName}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                主な使い方
                <select
                  name="primaryUse"
                  className={fieldClassName}
                  defaultValue={data.round.primaryUse}
                >
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
                <select
                  name="sportContext"
                  className={fieldClassName}
                  defaultValue={data.round.sportContext}
                >
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
                候補配分は、ここで決めた上位候補数をもとに並びます。
                現在の設定: {candidateLimitFromBudget(data.round.budgetYen ?? 500)} 案
              </div>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                取り込み元
                <select
                  name="roundSource"
                  className={fieldClassName}
                  defaultValue={data.round.roundSource}
                >
                  {(
                    [
                      "fixture_master",
                      "toto_official_manual",
                      "user_manual",
                      "demo_sample",
                    ] as const
                  ).map((source) => (
                    <option key={source} value={source}>
                      {roundSourceLabel[source]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                中止時の扱い
                <select
                  name="voidHandling"
                  className={fieldClassName}
                  defaultValue={data.round.voidHandling}
                >
                  {voidHandlingOptions.map((voidHandling) => (
                    <option key={voidHandling} value={voidHandling}>
                      {voidHandlingLabel[voidHandling]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-950/5 p-4 text-sm text-slate-600 md:col-span-2">
                現在の試合数 {data.round.activeMatchCount ?? data.round.matches.length} / 選択肢{" "}
                {data.round.outcomeSetJson?.join(" / ") ?? "1 / 0 / 2"}
              </div>

              {!isDemoRound ? (
                <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50/88 p-4 text-sm text-slate-700 md:col-span-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium text-slate-900">この回で使うメンバー</div>
                    <Badge tone="slate">{data.users.length}人を選択中</Badge>
                  </div>
                  <div className="text-xs leading-5 text-slate-500">
                    ここで選んだ人だけを、この回の支持 / 予想 / 予想者カードの対象にします。
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {data.availableUsers.map((user) => {
                      const selectedByDefault =
                        data.round.participantIds.length === 0 ||
                        data.round.participantIds.includes(user.id);

                      return (
                        <label
                          key={`workspace-participant-${user.id}`}
                          className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/82 px-4 py-3"
                        >
                          <input
                            type="checkbox"
                            name="participantUserId"
                            value={user.id}
                            defaultChecked={selectedByDefault}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-300"
                          />
                          <span className="text-sm font-medium text-slate-800">
                            {user.name}
                          </span>
                          <Badge tone={user.role === "admin" ? "teal" : "slate"}>
                            {user.role === "admin" ? "予想者" : "ウォッチ"}
                          </Badge>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                取り込みメモ
                <input
                  name="sourceNote"
                  defaultValue={data.round.sourceNote ?? ""}
                  className={fieldClassName}
                  placeholder="試合を選んで保存 / toto公式貼り付け / 仮想ラウンド など"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                メモ
                <textarea
                  name="notes"
                  defaultValue={data.round.notes ?? ""}
                  className={textAreaClassName}
                />
              </label>

              <div className="md:col-span-2 flex justify-end">
                <button type="submit" className={buttonClassName} disabled={saving}>
                  {saving ? "保存中..." : "ラウンドを保存"}
                </button>
              </div>
            </form>
          </SectionCard>

          <CollapsibleSectionCard
            title="試合日程をまとめて入れる"
            description={`FIFA公式日程や手元の表から、${data.round.matches.length}試合ぶんをまとめて貼り付けできます。ホーム / アウェイ / 日時 / 会場 / ステージを一気に反映します。`}
            badge={<Badge tone="amber">時短入力</Badge>}
          >
            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <form onSubmit={handleBulkImport} className="space-y-4">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  貼り付け用テキスト
                  <textarea
                    name="fixtureImport"
                    className={textAreaClassName}
                    placeholder={fixtureImportTemplate}
                  />
                </label>
                <p className="text-sm leading-6 text-slate-600">
                  使える形式: `番号 / 開始日時 / ホーム / アウェイ / 会場 / ステージ / メモ`
                  をタブ区切り、`|` 区切り、またはカンマ区切りで貼れます。番号を省くと上から順に 1, 2, 3... と入ります。
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className={buttonClassName} disabled={bulkSaving}>
                    {bulkSaving ? "反映中..." : "日程をまとめて反映"}
                  </button>
                  <a
                    href="https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums"
                    target="_blank"
                    rel="noreferrer"
                    className={secondaryButtonClassName}
                  >
                    FIFA公式日程を見る
                  </a>
                </div>
                {bulkError ? <p className="text-sm text-rose-700">{bulkError}</p> : null}
                {bulkSuccess ? <p className="text-sm text-emerald-700">{bulkSuccess}</p> : null}
              </form>

              <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/85 p-5">
                <div>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    貼り付けのコツ
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    まず FIFA公式の日程ページやスプレッドシートから必要試合数ぶんの行を持ってきて、ここに貼るのがいちばん速いです。
                  </p>
                </div>
                <ul className="space-y-2 text-sm leading-7 text-slate-700">
                  <li>日時は `2026-06-11 19:00` のように入れると読み取りやすいです。</li>
                  <li>会場やステージが空でも反映できます。後で試合編集で追記できます。</li>
                  <li>モデル確率までは自動で入りません。日程を入れた後に、必要な試合だけ 1 / 0 / 2 試算を足してください。</li>
                </ul>
              </div>
            </div>
          </CollapsibleSectionCard>

          <CollapsibleSectionCard
            title="モデル確率をまとめて試算する"
            description="市場確率、Human Scout、手入力補正を見て、このアプリ内の共通 probability engine で 1 / 0 / 2 を試算します。あとで試合編集で上書きできます。"
            badge={<Badge tone="sky">モデル試算</Badge>}
          >
            <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatCard
                    label="試算未設定"
                    value={`${missingAiCount}`}
                    hint="まだ model 1 / 0 / 2 が空の試合数"
                    compact
                  />
                  <StatCard
                    label="試算できる試合"
                    value={`${estimableMatchCount}`}
                    hint="市場確率または Human Scout が入っていて、先に試算できる試合数"
                    compact
                  />
                  <StatCard
                    label="今の本命候補"
                    value={`${data.round.matches.filter((match) => favoriteOutcomeForBucket(match, "model")).length}`}
                    hint="モデル本命が表示できる試合数"
                    compact
                  />
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50/85 p-5">
                  <p className="text-sm leading-7 text-slate-700">
                    これは共通 probability engine で作る暫定のモデル試算です。
                    市場確率があればそれを土台にし、足りない時は competition ごとの fallback prior、Human Scout、手入力補正で補います。
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Badge tone="slate">共通試算ロジック</Badge>
                    <Badge tone="slate">{competitionTypeLabel[data.round.competitionType]}</Badge>
                    <Badge tone="slate">{dataProfileLabel[data.round.dataProfile]}</Badge>
                    <span>ロジック更新後に再計算して育てていけます。</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={buttonClassName}
                      onClick={() => void handleEstimateAi()}
                      disabled={estimatingAi}
                    >
                      {estimatingAi ? "試算中..." : "未設定の試合を試算する"}
                    </button>
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      onClick={() => void handleEstimateAi(true)}
                      disabled={estimatingAi}
                    >
                      既存試算も再計算
                    </button>
                    <Link
                      href={buildRoundHref(appRoute.matchEditor, data.round.id, {
                        match: data.round.matches[0]?.id,
                      })}
                      className={secondaryButtonClassName}
                    >
                      試合編集で確認
                    </Link>
                  </div>
                  {aiError ? <p className="mt-3 text-sm text-rose-700">{aiError}</p> : null}
                  {aiSuccess ? <p className="mt-3 text-sm text-emerald-700">{aiSuccess}</p> : null}
                </div>
              </div>

              <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/85 p-5">
                <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                  試算ルール
                </h3>
                <ul className="space-y-2 text-sm leading-7 text-slate-700">
                  <li>市場確率があれば、それを base にして 1 / 0 / 2 を正規化します。</li>
                  <li>市場確率がなければ、W杯 / 通常toto で fallback prior を分けて使います。</li>
                  <li>Human Scout の F / D と、手入力補正を上乗せします。</li>
                  <li>公式人気は crowd 比較と EV 用で、デフォルトではモデルに混ぜません。</li>
                </ul>
                <div className="rounded-[20px] border border-slate-200 bg-white/80 p-4">
                  <div className="flex items-center gap-2">
                    <Badge tone="sky">プレビュー</Badge>
                    <h4 className="text-sm font-semibold text-slate-900">いま試算できる試合</h4>
                  </div>
                  <div className="mt-3 space-y-3">
                    {aiPreviewMatches.length === 0 ? (
                      <p className="text-sm leading-6 text-slate-600">
                        市場確率か Human Scout が入ると、ここに試算プレビューが出ます。
                      </p>
                    ) : (
                      aiPreviewMatches.map(({ match, estimated, readiness }) => (
                        <div
                          key={match.id}
                          className="rounded-[18px] border border-slate-200 bg-slate-50/85 p-3"
                        >
                          <div className="text-sm font-semibold text-slate-900">
                            #{match.matchNo} {match.homeTeam} 対 {match.awayTeam}
                          </div>
                          <div className="mt-2 text-sm text-slate-700">
                            モデル {formatPercent(estimated.modelProb1)} /{" "}
                            {formatPercent(estimated.modelProb0)} /{" "}
                            {formatPercent(estimated.modelProb2)} | 候補{" "}
                            {previewRecommendedOutcomes(estimated)}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge tone="slate">
                              信頼度 {probabilityConfidenceLabel[estimated.probabilityConfidence]}
                            </Badge>
                            <Badge tone="slate">{readiness.message}</Badge>
                            {estimated.missingDataWarnings.slice(0, 2).map((note) => (
                              <Badge key={`${match.id}-${note}`} tone="amber">
                                {note}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleSectionCard>

          <SectionCard
            id="overview-cards"
            title={`${data.round.matches.length}試合の確認カード`}
            description="まずはここで全体をざっと見ます。細かい数値表は下の `詳細表を開く` に残しています。"
          >
            <div className="grid gap-4 xl:grid-cols-2">
              {orderedOverviewMatches.map((match) => {
                  const aiBase = aiRecommendedOutcomes(match);
                  const humanBase = humanConsensusOutcomes(match);
                  const badges = buildMatchBadges(match);
                  const overlayBadge = humanOverlayBadge(match);
                  const setupReady = matchHasSetupInput(match);
                  const topSignal = topAdvantageByMatchId.get(match.id) ?? null;

                return (
                  <article
                    key={`overview-${match.id}`}
                    className={
                      setupReady
                        ? "rounded-[24px] border border-white/80 bg-white/82 p-5 shadow-[0_20px_46px_-34px_rgba(15,23,42,0.35)]"
                        : "rounded-[24px] border border-amber-200 bg-amber-50/80 p-5 shadow-[0_20px_46px_-34px_rgba(15,23,42,0.28)]"
                    }
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={setupReady ? "slate" : "amber"}>第{match.matchNo}試合</Badge>
                          {!setupReady ? <Badge tone="amber">要設定</Badge> : null}
                          {match.actualResult ? (
                            <Badge tone="slate">
                              結果{" "}
                              {match.actualResult
                                .replace("ONE", "1")
                                .replace("DRAW", "0")
                                .replace("TWO", "2")}
                            </Badge>
                          ) : null}
                        </div>
                        <h3 className="mt-3 font-display text-xl font-semibold tracking-[-0.05em] text-slate-950">
                          {match.homeTeam} 対 {match.awayTeam}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {formatDateTime(match.kickoffTime)}
                          {match.venue ? ` / ${match.venue}` : ""}
                        </p>
                      </div>

                      <Link
                        href={buildRoundHref(appRoute.matchEditor, data.round.id, {
                          match: match.id,
                        })}
                        className={secondaryButtonClassName}
                      >
                        編集
                      </Link>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50/85 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          試算ライン
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {aiBase.length === 0 ? (
                            <Badge tone="slate">試算未設定</Badge>
                          ) : (
                            aiBase.map((outcome) => (
                              <Badge key={`${match.id}-overview-ai-${outcome}`} tone="amber">
                                {outcome}
                              </Badge>
                            ))
                          )}
                        </div>
                        <div className="mt-2 text-sm text-slate-600">
                          モデル {formatPercent(match.modelProb1)} / {formatPercent(match.modelProb0)} /{" "}
                          {formatPercent(match.modelProb2)}
                        </div>
                      </div>

                      <div className="rounded-[20px] border border-slate-200 bg-slate-50/85 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          人力上書き
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge tone={overlayBadge.tone}>{overlayBadge.label}</Badge>
                          <Badge tone="slate">{formatOutcomeSet(humanBase)}</Badge>
                        </div>
                        <div className="mt-2 text-sm text-slate-600">
                          F {formatNumber(match.consensusF, 1)} / D {formatNumber(match.consensusD, 1)} /{" "}
                          {match.consensusCall ?? "未集計"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {topSignal ? (
                        <Badge tone={topSignal.bucket === "darkhorse" ? "amber" : "positive"}>
                          {advantageBucketLabel[topSignal.bucket]} {topSignal.outcome}{" "}
                          {formatSignedPercent(topSignal.compositeAdvantage)}
                        </Badge>
                      ) : (
                        <Badge tone="slate">注目候補はまだ少なめ</Badge>
                      )}
                      {match.category ? (
                        <Badge tone="sky">{categoryLabel[match.category]}</Badge>
                      ) : null}
                      {badges.length === 0 ? (
                        <Badge tone="slate">注記なし</Badge>
                      ) : (
                        badges.slice(0, 3).map((badge) => (
                          <Badge key={`${match.id}-overview-${badge.label}`} tone={badge.tone}>
                            {badge.label}
                          </Badge>
                        ))
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </SectionCard>

          <CollapsibleSectionCard
            title={`${data.round.matches.length}試合の詳細表`}
            description="細かい数値を確認したいときだけ開いて使います。横スクロール対応で、優位差は モデル試算 - 公式人気 です。"
            badge={<Badge tone="slate">詳細</Badge>}
          >
            <HorizontalScrollTable hint="スマホでは横にスワイプすると、試算ライン、人力ライン、優位差、結果まで続けて見られます。">
              <table className="min-w-[1540px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-3 py-3">番号</th>
                    <th className="px-3 py-3">ホーム</th>
                    <th className="px-3 py-3">アウェイ</th>
                    <th className="px-3 py-3">開始</th>
                    <th className="px-3 py-3">会場</th>
                    <th className="px-3 py-3">公式人気 1/0/2</th>
                    <th className="px-3 py-3">市場 1/0/2</th>
                    <th className="px-3 py-3">モデル 1/0/2</th>
                    <th className="px-3 py-3">試算ライン</th>
                    <th className="px-3 py-3">人力F</th>
                    <th className="px-3 py-3">人力D</th>
                    <th className="px-3 py-3">人力上書き</th>
                    <th className="px-3 py-3">優位差 1/0/2</th>
                    <th className="px-3 py-3">カテゴリ</th>
                    <th className="px-3 py-3">注記</th>
                    <th className="px-3 py-3">結果</th>
                    <th className="px-3 py-3">編集</th>
                  </tr>
                </thead>
                <tbody>
                  {data.round.matches.map((match) => {
                    const aiBase = aiRecommendedOutcomes(match);
                    const badges = buildMatchBadges(match);
                    const overlayBadge = humanOverlayBadge(match);
                    const setupReady = matchHasSetupInput(match);

                    return (
                      <tr
                        key={match.id}
                        className={
                          setupReady
                            ? "border-b border-slate-100 align-top"
                            : "border-b border-amber-100 bg-amber-50/40 align-top"
                        }
                      >
                        <td className="px-3 py-4 font-semibold text-slate-900">
                          {match.matchNo}
                        </td>
                        <td className="px-3 py-4">{match.homeTeam}</td>
                        <td className="px-3 py-4">{match.awayTeam}</td>
                        <td className="px-3 py-4 text-slate-600">
                          {formatDateTime(match.kickoffTime)}
                        </td>
                        <td className="px-3 py-4 text-slate-600">{match.venue ?? "—"}</td>
                        <td className="px-3 py-4 text-slate-600">
                          {formatPercent(match.officialVote1)} / {formatPercent(match.officialVote0)} /{" "}
                          {formatPercent(match.officialVote2)}
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {formatPercent(match.marketProb1)} / {formatPercent(match.marketProb0)} /{" "}
                          {formatPercent(match.marketProb2)}
                        </td>
                        <td className="px-3 py-4 font-medium text-slate-700">
                          {formatPercent(match.modelProb1)} / {formatPercent(match.modelProb0)} /{" "}
                          {formatPercent(match.modelProb2)}
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex flex-wrap gap-2">
                            {aiBase.length === 0 ? (
                              <Badge tone="slate">試算未設定</Badge>
                            ) : (
                              aiBase.map((outcome) => (
                                <Badge key={`${match.id}-ai-${outcome}`} tone="amber">
                                  {outcome}
                                </Badge>
                              ))
                            )}
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            信頼度 {match.confidence !== null ? match.confidence.toFixed(2) : "—"}
                          </div>
                        </td>
                        <td className="px-3 py-4">{formatNumber(match.consensusF, 1)}</td>
                        <td className="px-3 py-4">{formatNumber(match.consensusD, 1)}</td>
                        <td className="px-3 py-4">
                          <div className="font-medium text-slate-800">
                            {formatOutcomeSet(humanConsensusOutcomes(match))}
                          </div>
                          <div className="mt-1">
                            <Badge tone={overlayBadge.tone}>{overlayBadge.label}</Badge>
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            {match.consensusCall ?? "未集計"}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="space-y-1">
                            {(["1", "0", "2"] as const).map((outcome) => {
                              const edge =
                                outcome === "1"
                                  ? match.modelProb1 !== null && match.officialVote1 !== null
                                    ? match.modelProb1 - match.officialVote1
                                    : null
                                  : outcome === "0"
                                    ? match.modelProb0 !== null && match.officialVote0 !== null
                                      ? match.modelProb0 - match.officialVote0
                                      : null
                                    : match.modelProb2 !== null &&
                                        match.officialVote2 !== null
                                      ? match.modelProb2 - match.officialVote2
                                      : null;

                              return (
                                <div
                                  key={outcome}
                                  className={
                                    edge !== null && edge > 0
                                      ? "font-semibold text-emerald-700"
                                      : "text-slate-500"
                                  }
                                >
                                  {outcome}: {formatSignedPercent(edge)}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {match.category ? categoryLabel[match.category] : "—"}
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex max-w-[240px] flex-wrap gap-2">
                            {!setupReady ? (
                              <Badge tone="amber">要設定</Badge>
                            ) : null}
                            {badges.length === 0 && setupReady ? (
                              <span className="text-xs text-slate-400">—</span>
                            ) : (
                              badges.map((badge) => (
                                <Badge key={`${match.id}-${badge.label}`} tone={badge.tone}>
                                  {badge.label}
                                </Badge>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <Badge tone="slate">
                            {match.actualResult
                              ? match.actualResult
                                  .replace("ONE", "1")
                                  .replace("DRAW", "0")
                                  .replace("TWO", "2")
                              : "—"}
                          </Badge>
                        </td>
                        <td className="px-3 py-4">
                          <Link
                            href={buildRoundHref(appRoute.matchEditor, data.round.id, {
                              match: match.id,
                            })}
                            className={secondaryButtonClassName}
                          >
                            編集
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </HorizontalScrollTable>
          </CollapsibleSectionCard>
        </>
      ) : null}
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<LoadingNotice title="ラウンドを準備中" />}>
      <WorkspacePageContent />
    </Suspense>
  );
}
