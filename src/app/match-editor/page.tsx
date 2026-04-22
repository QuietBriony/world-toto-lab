"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  PageHeader,
  secondaryButtonClassName,
  SectionCard,
  StatCard,
  textAreaClassName,
} from "@/components/ui";
import {
  categoryLabel,
  categoryOptions,
  enumToOutcome,
  formatDateTime,
  formatPercent,
  probabilityConfidenceLabel,
  researchMemoConfidenceLabel,
  researchMemoTypeLabel,
  parseOutcomeList,
  roundStatusLabel,
  serializeOutcomeList,
} from "@/lib/domain";
import {
  nullableString,
  parseCategory,
  parseFloatOrNull,
  parseProbabilityPercent,
  parseResearchMemoConfidence,
  parseResearchMemoType,
  stringValue,
} from "@/lib/forms";
import { evaluateMatchReadiness } from "@/lib/probability/readiness";
import { appRoute, buildRoundHref, getSingleSearchParam } from "@/lib/round-links";
import { buildResearchMemoPayload, filterResearchMemosForMatch } from "@/lib/research-memos";
import { competitionTypeModeLabel, probabilityReadinessStatusLabel } from "@/lib/round-mode";
import { deleteResearchMemo, saveResearchMemo, updateMatch } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useRoundWorkspace } from "@/lib/use-app-data";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "不明なエラーです。";
}

function percentInput(value: number | null) {
  return value === null ? "" : (value * 100).toFixed(1);
}

function buildProbabilityDraft(match: {
  marketProb0: number | null;
  marketProb1: number | null;
  marketProb2: number | null;
  modelProb0: number | null;
  modelProb1: number | null;
  modelProb2: number | null;
  officialVote0: number | null;
  officialVote1: number | null;
  officialVote2: number | null;
}) {
  return {
    official: [
      percentInput(match.officialVote1),
      percentInput(match.officialVote0),
      percentInput(match.officialVote2),
    ],
    market: [
      percentInput(match.marketProb1),
      percentInput(match.marketProb0),
      percentInput(match.marketProb2),
    ],
    model: [
      percentInput(match.modelProb1),
      percentInput(match.modelProb0),
      percentInput(match.modelProb2),
    ],
  };
}

function parsePercentDraft(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function summarizePercentGroup(values: string[]) {
  const parsed = values.map((value) => parsePercentDraft(value)).filter((value): value is number => value !== null);
  const total = parsed.reduce((sum, value) => sum + value, 0);
  const allFilled = values.every((value) => value.trim().length > 0);
  const closeToHundred = Math.abs(total - 100) <= 1;

  return {
    allFilled,
    closeToHundred,
    total,
  };
}

type ScopedMessage = {
  message: string;
  scope: string;
};

function MatchEditorPageContent() {
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const matchId = getSingleSearchParam(searchParams.get("match"));
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<ScopedMessage | null>(null);
  const [saveMessage, setSaveMessage] = useState<ScopedMessage | null>(null);
  const [dirtyScope, setDirtyScope] = useState<string | null>(null);
  const [probabilityDraftState, setProbabilityDraftState] = useState({
    matchId: "",
    market: ["", "", ""],
    model: ["", "", ""],
    official: ["", "", ""],
  });

  const match = data?.round.matches.find((entry) => entry.id === matchId) ?? null;
  const orderedMatches = data?.round.matches.slice().sort((left, right) => left.matchNo - right.matchNo) ?? [];
  const currentMatchIndex = match
    ? orderedMatches.findIndex((entry) => entry.id === match.id)
    : -1;
  const previousMatch =
    currentMatchIndex > 0 ? orderedMatches[currentMatchIndex - 1] : null;
  const nextMatch =
    currentMatchIndex >= 0 && currentMatchIndex < orderedMatches.length - 1
      ? orderedMatches[currentMatchIndex + 1]
      : null;
  const hasOfficialInputs = Boolean(
    match &&
      (match.officialVote1 !== null ||
        match.officialVote0 !== null ||
        match.officialVote2 !== null),
  );
  const hasMarketInputs = Boolean(
    match &&
      (match.marketProb1 !== null || match.marketProb0 !== null || match.marketProb2 !== null),
  );
  const hasAiInputs = Boolean(
    match &&
      (match.modelProb1 !== null || match.modelProb0 !== null || match.modelProb2 !== null),
  );
  const noteCount = match
    ? [
        match.tacticalNote,
        match.injuryNote,
        match.motivationNote,
        match.adminNote,
      ].filter(Boolean).length
    : 0;
  const formId = match ? `match-editor-form-${match.id}` : "match-editor-form";
  const probabilityDraft =
    match && probabilityDraftState.matchId === match.id
      ? probabilityDraftState
      : {
          matchId: match?.id ?? "",
          ...buildProbabilityDraft(
            match ?? {
              officialVote1: null,
              officialVote0: null,
              officialVote2: null,
              marketProb1: null,
              marketProb0: null,
              marketProb2: null,
              modelProb1: null,
              modelProb0: null,
              modelProb2: null,
            },
          ),
        };
  const officialSummary = summarizePercentGroup(probabilityDraft.official);
  const marketSummary = summarizePercentGroup(probabilityDraft.market);
  const modelSummary = summarizePercentGroup(probabilityDraft.model);
  const currentFormScope = match?.id ?? "none";
  const hasVisibleUnsavedChanges = dirtyScope === currentFormScope;
  const visibleSubmitError =
    submitError?.scope === currentFormScope ? submitError.message : null;
  const visibleSaveMessage =
    saveMessage?.scope === currentFormScope ? saveMessage.message : null;
  const activeAuthor =
    data?.users.find((user) => user.role === "admin") ??
    data?.users[0] ??
    null;
  const scopedResearchMemos = filterResearchMemosForMatch(data?.round.researchMemos ?? [], match);
  const readiness = match
    ? evaluateMatchReadiness({
        match,
        researchMemos: scopedResearchMemos,
      })
    : null;

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

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!data || !match) {
      return;
    }

    setSaving(true);
    setSubmitError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const confidenceRaw = parseFloatOrNull(stringValue(formData, "confidence"));
      await updateMatch({
        roundId: data.round.id,
        matchId: match.id,
        homeTeam: stringValue(formData, "homeTeam") || "仮ホーム",
        awayTeam: stringValue(formData, "awayTeam") || "仮アウェイ",
        kickoffTime: (() => {
          const value = stringValue(formData, "kickoffTime");
          return value ? new Date(value).toISOString() : null;
        })(),
        venue: nullableString(formData, "venue"),
        stage: nullableString(formData, "stage"),
        officialVote1: parseProbabilityPercent(stringValue(formData, "officialVote1")),
        officialVote0: parseProbabilityPercent(stringValue(formData, "officialVote0")),
        officialVote2: parseProbabilityPercent(stringValue(formData, "officialVote2")),
        marketProb1: parseProbabilityPercent(stringValue(formData, "marketProb1")),
        marketProb0: parseProbabilityPercent(stringValue(formData, "marketProb0")),
        marketProb2: parseProbabilityPercent(stringValue(formData, "marketProb2")),
        modelProb1: parseProbabilityPercent(stringValue(formData, "modelProb1")),
        modelProb0: parseProbabilityPercent(stringValue(formData, "modelProb0")),
        modelProb2: parseProbabilityPercent(stringValue(formData, "modelProb2")),
        tacticalNote: nullableString(formData, "tacticalNote"),
        injuryNote: nullableString(formData, "injuryNote"),
        motivationNote: nullableString(formData, "motivationNote"),
        adminNote: nullableString(formData, "adminNote"),
        recentFormNote: nullableString(formData, "recentFormNote"),
        availabilityInfo: nullableString(formData, "availabilityInfo"),
        conditionsInfo: nullableString(formData, "conditionsInfo"),
        homeStrengthAdjust: parseFloatOrNull(stringValue(formData, "homeStrengthAdjust")),
        awayStrengthAdjust: parseFloatOrNull(stringValue(formData, "awayStrengthAdjust")),
        availabilityAdjust: parseFloatOrNull(stringValue(formData, "availabilityAdjust")),
        conditionsAdjust: parseFloatOrNull(stringValue(formData, "conditionsAdjust")),
        tacticalAdjust: parseFloatOrNull(stringValue(formData, "tacticalAdjust")),
        motivationAdjust: parseFloatOrNull(stringValue(formData, "motivationAdjust")),
        adminAdjust1: parseFloatOrNull(stringValue(formData, "adminAdjust1")),
        adminAdjust0: parseFloatOrNull(stringValue(formData, "adminAdjust0")),
        adminAdjust2: parseFloatOrNull(stringValue(formData, "adminAdjust2")),
        homeAdvantageAdjust: parseFloatOrNull(stringValue(formData, "homeAdvantageAdjust")),
        restDaysAdjust: parseFloatOrNull(stringValue(formData, "restDaysAdjust")),
        travelAdjust: parseFloatOrNull(stringValue(formData, "travelAdjust")),
        leagueTableMotivationAdjust: parseFloatOrNull(
          stringValue(formData, "leagueTableMotivationAdjust"),
        ),
        injurySuspensionAdjust: parseFloatOrNull(
          stringValue(formData, "injurySuspensionAdjust"),
        ),
        rotationRiskAdjust: parseFloatOrNull(stringValue(formData, "rotationRiskAdjust")),
        groupStandingMotivationAdjust: parseFloatOrNull(
          stringValue(formData, "groupStandingMotivationAdjust"),
        ),
        travelClimateAdjust: parseFloatOrNull(stringValue(formData, "travelClimateAdjust")),
        altitudeHumidityAdjust: parseFloatOrNull(
          stringValue(formData, "altitudeHumidityAdjust"),
        ),
        squadDepthAdjust: parseFloatOrNull(stringValue(formData, "squadDepthAdjust")),
        tournamentPressureAdjust: parseFloatOrNull(
          stringValue(formData, "tournamentPressureAdjust"),
        ),
        category: parseCategory(stringValue(formData, "category")),
        confidence: confidenceRaw === null ? null : Math.min(Math.max(confidenceRaw, 0), 1),
        recommendedOutcomes: serializeOutcomeList(
          parseOutcomeList(stringValue(formData, "recommendedOutcomes")),
        ),
      });
      setDirtyScope(null);
      setSaveMessage({
        scope: currentFormScope,
        message: "試合設定を保存しました。AI比較と各集計に反映されます。",
      });
      await refresh();
    } catch (nextError) {
      setSubmitError({
        scope: currentFormScope,
        message: errorMessage(nextError),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMemo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!data || !match || !activeAuthor) {
      setSubmitError({
        scope: currentFormScope,
        message: "メモを書けるメンバーが見つかりません。",
      });
      return;
    }

    const formData = new FormData(event.currentTarget);

    try {
      const payload = buildResearchMemoPayload({
        confidence: parseResearchMemoConfidence(stringValue(formData, "memoConfidence")),
        createdBy: activeAuthor.id,
        matchId: match.id,
        memoId: nullableString(formData, "memoId"),
        memoType: parseResearchMemoType(stringValue(formData, "memoType")),
        roundId: data.round.id,
        sourceDate: nullableString(formData, "memoSourceDate"),
        sourceName: nullableString(formData, "memoSourceName"),
        sourceUrl: nullableString(formData, "memoSourceUrl"),
        summary: stringValue(formData, "memoSummary"),
        team: nullableString(formData, "memoTeam"),
        title: stringValue(formData, "memoTitle"),
      });

      if (!payload.title || !payload.summary) {
        throw new Error("メモのタイトルと要約を入れてください。");
      }

      await saveResearchMemo(payload);
      setSaveMessage({
        scope: currentFormScope,
        message: "Research Memo を保存しました。",
      });
      await refresh();
      event.currentTarget.reset();
    } catch (nextError) {
      setSubmitError({
        scope: currentFormScope,
        message: errorMessage(nextError),
      });
    }
  };

  const handleDeleteMemo = async (memoId: string) => {
    if (!window.confirm("この Research Memo を削除しますか？")) {
      return;
    }

    try {
      await deleteResearchMemo(memoId);
      setSaveMessage({
        scope: currentFormScope,
        message: "Research Memo を削除しました。",
      });
      await refresh();
    } catch (nextError) {
      setSubmitError({
        scope: currentFormScope,
        message: errorMessage(nextError),
      });
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={match ? `第${match.matchNo}試合` : "試合編集"}
        title={match ? `${match.homeTeam} 対 ${match.awayTeam}` : "試合編集"}
        description={
          match
            ? `開始 ${formatDateTime(match.kickoffTime)} / 現在結果 ${
                enumToOutcome(match.actualResult) ?? "—"
              } / まずは基本情報とカテゴリだけ先に入れると進めやすいです。`
            : "ラウンドから対象試合を選んで編集します。"
        }
        actions={
          match && data ? (
            <div className="flex flex-wrap gap-2">
              {previousMatch ? (
                <Link
                  href={buildRoundHref(appRoute.matchEditor, data.round.id, {
                    match: previousMatch.id,
                  })}
                  className={secondaryButtonClassName}
                >
                  前の試合
                </Link>
              ) : null}
              {nextMatch ? (
                <Link
                  href={buildRoundHref(appRoute.matchEditor, data.round.id, {
                    match: nextMatch.id,
                  })}
                  className={secondaryButtonClassName}
                >
                  次の試合
                </Link>
              ) : null}
            </div>
          ) : undefined
        }
      />

      {!isSupabaseConfigured() ? (
        <ConfigurationNotice />
      ) : !roundId ? (
        <RoundRequiredNotice />
      ) : loading && !data ? (
        <LoadingNotice title="試合編集を読み込み中" />
      ) : error && !data ? (
        <ErrorNotice error={error} onRetry={() => void refresh()} />
      ) : data ? (
        <>
          <RoundNav
            roundId={data.round.id}
            roundTitle={data.round.title}
            roundStatus={roundStatusLabel[data.round.status]}
            currentPath={appRoute.matchEditor}
          />

          <RoundProgressCallout
            currentPath={appRoute.matchEditor}
            matches={data.round.matches}
            picks={data.round.picks}
            roundId={data.round.id}
            scoutReports={data.round.scoutReports}
            users={data.users}
          />

          <RouteGlossaryCard
            currentPath={appRoute.matchEditor}
            defaultOpen={
              !match ||
              (!hasOfficialInputs && !hasMarketInputs && !hasAiInputs && noteCount === 0)
            }
          />

          {visibleSubmitError ? (
            <EditingStatusNotice
              tone="rose"
              title="保存に失敗しました"
              description={visibleSubmitError}
            />
          ) : match && hasVisibleUnsavedChanges ? (
            <EditingStatusNotice
              tone="amber"
              title="未保存の変更があります"
              description="試合設定を変えたあとは、保存するまではモデル比較や候補配分に反映されません。"
              action={
                <button type="submit" form={formId} className={buttonClassName} disabled={saving}>
                  {saving ? "保存中..." : "試合を保存"}
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

          {!match ? (
            <SectionCard
              title="対象試合が選ばれていません"
              description="ラウンド詳細から「編集」を押して対象試合を選んでください。"
              actions={
                <Link
                  href={buildRoundHref(appRoute.workspace, data.round.id)}
                  className={secondaryButtonClassName}
                >
                  ラウンド詳細へ戻る
                </Link>
              }
            >
              <p className="text-sm text-slate-600">
                URL の `?match=` に対象試合 ID が入る構成です。
              </p>
            </SectionCard>
          ) : (
            <form
              id={formId}
              key={match.updatedAt}
              onSubmit={handleSave}
              onChangeCapture={() => {
                setSubmitError(null);
                setSaveMessage(null);
                setDirtyScope(currentFormScope);
              }}
              className="space-y-6"
            >
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="基本情報"
                  value={match.kickoffTime ? "入力あり" : "未入力"}
                  hint={match.venue ?? "会場はまだ未入力です"}
                  tone={match.kickoffTime ? "positive" : "warning"}
                  compact
                />
                <StatCard
                  label="公式人気"
                  value={hasOfficialInputs ? "あり" : "未入力"}
                  hint="1 / 0 / 2 の公式人気"
                  tone={hasOfficialInputs ? "positive" : "warning"}
                  compact
                />
                <StatCard
                  label="市場 / AI"
                  value={hasMarketInputs || hasAiInputs ? "あり" : "未入力"}
                  hint={`市場 ${hasMarketInputs ? "あり" : "なし"} / モデル ${hasAiInputs ? "あり" : "なし"}`}
                  tone={hasMarketInputs || hasAiInputs ? "positive" : "warning"}
                  compact
                />
                <StatCard
                  label="メモ"
                  value={`${noteCount}`}
                  hint={noteCount > 0 ? "入力済みメモ数" : "まだメモはありません"}
                  compact
                />
                {readiness ? (
                  <>
                    <StatCard
                      label="試算状態"
                      value={probabilityReadinessStatusLabel[data.round.probabilityReadiness]}
                      hint={competitionTypeModeLabel[data.round.competitionType]}
                      compact
                      tone={
                        data.round.probabilityReadiness === "ready"
                          ? "positive"
                          : data.round.probabilityReadiness === "partial"
                            ? "draw"
                            : "warning"
                      }
                    />
                    <StatCard
                      label="Match Readiness"
                      value={probabilityConfidenceLabel[readiness.level]}
                      hint={readiness.message}
                      compact
                      tone={
                        readiness.level === "high"
                          ? "positive"
                          : readiness.level === "medium"
                            ? "draw"
                            : "warning"
                      }
                    />
                  </>
                ) : null}
              </section>

              {readiness ? (
                <SectionCard
                  title="この試合の試算材料"
                  description="通常totoでもW杯でも、共通確率エンジンがどこまで素直に回せるかをここで見ます。"
                >
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: "市場確率", ready: readiness.hasMarketProb },
                      { label: "公式人気", ready: readiness.hasOfficialVote },
                      { label: "Human Scout", ready: readiness.hasHumanScout },
                      { label: "直近成績", ready: readiness.hasRecentForm },
                      { label: "戦力情報", ready: readiness.hasAvailabilityInfo },
                      { label: "条件情報", ready: readiness.hasConditionsInfo },
                      { label: "モチベーション", ready: readiness.hasMotivationInfo },
                      { label: "手入力補正", ready: readiness.hasManualAdjust },
                    ].map(({ label, ready }) => (
                      <div
                        key={label}
                        className="rounded-[20px] border border-slate-200 bg-white/88 px-4 py-3"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          {label}
                        </p>
                        <p className="mt-2 text-base font-semibold text-slate-950">
                          {ready ? "あり" : "不足"}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50/90 px-4 py-4 text-sm leading-6 text-slate-700">
                    {readiness.message}
                  </div>
                </SectionCard>
              ) : null}

              <SectionCard
                title="まずここだけ入れる"
                description="チーム名、開始、カテゴリ、信頼度が先に入っていれば、他の画面でもかなり読めるようになります。確率は下の詳細で % 入力、信頼度だけ 0〜1 入力です。"
                actions={
                  <button type="submit" form={formId} className={buttonClassName} disabled={saving}>
                    {saving ? "保存中..." : "試合を保存"}
                  </button>
                }
              >
                <div className="grid gap-5 lg:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    ホームチーム
                    <input name="homeTeam" defaultValue={match.homeTeam} className={fieldClassName} />
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    アウェイチーム
                    <input name="awayTeam" defaultValue={match.awayTeam} className={fieldClassName} />
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    試合開始
                    <input
                      name="kickoffTime"
                      type="datetime-local"
                      defaultValue={
                        match.kickoffTime
                          ? new Date(match.kickoffTime).toISOString().slice(0, 16)
                          : ""
                      }
                      className={fieldClassName}
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    会場
                    <input name="venue" defaultValue={match.venue ?? ""} className={fieldClassName} />
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    ステージ
                    <input name="stage" defaultValue={match.stage ?? ""} className={fieldClassName} />
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    カテゴリ
                    <select
                      name="category"
                      className={fieldClassName}
                      defaultValue={match.category ?? ""}
                    >
                      <option value="">未設定</option>
                      {categoryOptions.map((category) => (
                        <option key={category} value={category}>
                          {categoryLabel[category]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    信頼度（0〜1）
                    <input
                      name="confidence"
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      defaultValue={match.confidence ?? ""}
                      className={fieldClassName}
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    AI推奨候補
                    <input
                      name="recommendedOutcomes"
                      defaultValue={match.recommendedOutcomes ?? ""}
                      className={fieldClassName}
                      placeholder="1,0"
                    />
                  </label>

                  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/85 p-4 text-sm leading-6 text-slate-600 lg:col-span-2">
                    単位のルール: `公式 / 市場 / AI` は下の詳細で `%` 入力、`信頼度` だけ `0〜1` 入力です。
                  </div>
                </div>
              </SectionCard>

              <CollapsibleSectionCard
                title="確率入力"
                description="ここは % 入力です。公式人気、市場、AI を必要な範囲だけ埋めれば大丈夫です。"
                badge={<Badge tone="sky">詳細</Badge>}
                defaultOpen={!hasOfficialInputs && !hasMarketInputs && !hasAiInputs}
              >
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    {
                      key: "official",
                      summary: officialSummary,
                      title: "公式人気",
                    },
                    {
                      key: "market",
                      summary: marketSummary,
                      title: "市場",
                    },
                    {
                      key: "model",
                      summary: modelSummary,
                      title: "AI",
                    },
                  ].map((group) => (
                    <div
                      key={`summary-${group.key}`}
                      className="rounded-[22px] border border-slate-200 bg-white/82 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          tone={
                            !group.summary.allFilled
                              ? "amber"
                              : group.summary.closeToHundred
                                ? "teal"
                                : "rose"
                          }
                        >
                          {!group.summary.allFilled
                            ? "未入力あり"
                            : group.summary.closeToHundred
                              ? "合計OK"
                              : "要確認"}
                        </Badge>
                        <h3 className="text-sm font-semibold text-slate-900">{group.title}</h3>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        合計 {group.summary.total.toFixed(1)}%
                        {!group.summary.allFilled
                          ? " / 3項目そろうと確認しやすいです。"
                          : group.summary.closeToHundred
                            ? " / ほぼ100%です。"
                            : " / 100%から少しずれています。"}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  {[
                    {
                      key: "official",
                      title: "公式人気",
                      tone: hasOfficialInputs ? "teal" : "amber",
                      rows: [
                        ["officialVote1", "公式 1", percentInput(match.officialVote1)],
                        ["officialVote0", "公式 0", percentInput(match.officialVote0)],
                        ["officialVote2", "公式 2", percentInput(match.officialVote2)],
                      ],
                    },
                    {
                      key: "market",
                      title: "市場",
                      tone: hasMarketInputs ? "teal" : "amber",
                      rows: [
                        ["marketProb1", "市場 1", percentInput(match.marketProb1)],
                        ["marketProb0", "市場 0", percentInput(match.marketProb0)],
                        ["marketProb2", "市場 2", percentInput(match.marketProb2)],
                      ],
                    },
                    {
                      key: "model",
                      title: "AI",
                      tone: hasAiInputs ? "teal" : "amber",
                      rows: [
                        ["modelProb1", "AI 1", percentInput(match.modelProb1)],
                        ["modelProb0", "AI 0", percentInput(match.modelProb0)],
                        ["modelProb2", "AI 2", percentInput(match.modelProb2)],
                      ],
                    },
                  ].map((group) => (
                    <div
                      key={group.title}
                      className="rounded-[24px] border border-slate-200 bg-slate-50/85 p-5"
                    >
                      <div className="flex items-center gap-2">
                        <Badge tone={group.tone as "amber" | "teal"}>
                          {group.tone === "teal" ? "入力あり" : "未入力"}
                        </Badge>
                        <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                          {group.title}
                        </h3>
                      </div>
                      <div className="mt-4 grid gap-3">
                        {group.rows.map(([name, label, value]) => (
                          <label key={name} className="grid gap-2 text-sm font-medium text-slate-700">
                            {label}
                            <input
                              name={name}
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              defaultValue={value}
                              className={fieldClassName}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                setProbabilityDraftState((current) => {
                                  const source =
                                    current.matchId === match.id ? current : probabilityDraft;
                                  const nextGroup = [...source[group.key as "official" | "market" | "model"]];
                                  const index =
                                    String(name).endsWith("1")
                                      ? 0
                                      : String(name).endsWith("0")
                                        ? 1
                                        : 2;
                                  nextGroup[index] = nextValue;

                                  return {
                                    ...source,
                                    matchId: match.id,
                                    [group.key]: nextGroup,
                                  };
                                });
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                title="試算材料と手入力補正"
                description="通常totoは休養・移動・怪我、W杯はグループ状況や気候などを手で足して低信頼を少しずつ改善します。"
                badge={<Badge tone="teal">共通試算</Badge>}
                defaultOpen={!hasMarketInputs}
              >
                <div className="grid gap-5 lg:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-slate-700 lg:col-span-2">
                    直近成績メモ
                    <textarea
                      name="recentFormNote"
                      defaultValue={match.recentFormNote ?? ""}
                      className={textAreaClassName}
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    戦力 / 出場可否
                    <textarea
                      name="availabilityInfo"
                      defaultValue={match.availabilityInfo ?? ""}
                      className={textAreaClassName}
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    条件 / 天候 / 会場
                    <textarea
                      name="conditionsInfo"
                      defaultValue={match.conditionsInfo ?? ""}
                      className={textAreaClassName}
                    />
                  </label>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-3">
                  {[
                    { name: "homeStrengthAdjust", label: "地力補正 1", value: match.homeStrengthAdjust },
                    { name: "awayStrengthAdjust", label: "地力補正 2", value: match.awayStrengthAdjust },
                    { name: "availabilityAdjust", label: "戦力補正", value: match.availabilityAdjust },
                    { name: "conditionsAdjust", label: "条件補正", value: match.conditionsAdjust },
                    { name: "tacticalAdjust", label: "戦術補正", value: match.tacticalAdjust },
                    { name: "motivationAdjust", label: "モチベ補正", value: match.motivationAdjust },
                    { name: "adminAdjust1", label: "管理補正 1", value: match.adminAdjust1 },
                    { name: "adminAdjust0", label: "管理補正 0", value: match.adminAdjust0 },
                    { name: "adminAdjust2", label: "管理補正 2", value: match.adminAdjust2 },
                  ].map(({ name, label, value }) => (
                    <label key={name} className="grid gap-2 text-sm font-medium text-slate-700">
                      {label}
                      <input
                        name={name}
                        type="number"
                        min={-0.1}
                        max={0.1}
                        step={0.01}
                        defaultValue={value ?? ""}
                        className={fieldClassName}
                      />
                    </label>
                  ))}
                </div>

                {data.round.competitionType === "domestic_toto" ? (
                  <div className="mt-5 grid gap-4 xl:grid-cols-3">
                    {[
                      { name: "homeAdvantageAdjust", label: "ホーム補正", value: match.homeAdvantageAdjust },
                      { name: "restDaysAdjust", label: "休養日数補正", value: match.restDaysAdjust },
                      { name: "travelAdjust", label: "移動補正", value: match.travelAdjust },
                      {
                        name: "leagueTableMotivationAdjust",
                        label: "順位/勝点モチベ補正",
                        value: match.leagueTableMotivationAdjust,
                      },
                      {
                        name: "injurySuspensionAdjust",
                        label: "怪我/出停補正",
                        value: match.injurySuspensionAdjust,
                      },
                      { name: "rotationRiskAdjust", label: "ローテ補正", value: match.rotationRiskAdjust },
                    ].map(({ name, label, value }) => (
                      <label key={name} className="grid gap-2 text-sm font-medium text-slate-700">
                        {label}
                        <input
                          name={name}
                          type="number"
                          min={-0.1}
                          max={0.1}
                          step={0.01}
                          defaultValue={value ?? ""}
                          className={fieldClassName}
                        />
                      </label>
                    ))}
                  </div>
                ) : null}

                {data.round.competitionType === "world_cup" ? (
                  <div className="mt-5 grid gap-4 xl:grid-cols-3">
                    {[
                      {
                        name: "groupStandingMotivationAdjust",
                        label: "勝点状況補正",
                        value: match.groupStandingMotivationAdjust,
                      },
                      { name: "travelClimateAdjust", label: "移動/気候補正", value: match.travelClimateAdjust },
                      { name: "altitudeHumidityAdjust", label: "高度/湿度補正", value: match.altitudeHumidityAdjust },
                      { name: "squadDepthAdjust", label: "選手層補正", value: match.squadDepthAdjust },
                      { name: "rotationRiskAdjust", label: "ローテ補正", value: match.rotationRiskAdjust },
                      {
                        name: "tournamentPressureAdjust",
                        label: "大会プレッシャー補正",
                        value: match.tournamentPressureAdjust,
                      },
                    ].map(({ name, label, value }) => (
                      <label key={name} className="grid gap-2 text-sm font-medium text-slate-700">
                        {label}
                        <input
                          name={name}
                          type="number"
                          min={-0.1}
                          max={0.1}
                          step={0.01}
                          defaultValue={value ?? ""}
                          className={fieldClassName}
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                title="メモ"
                description="長文メモは必要なときだけ。迷う試合だけ短く残す運用でも十分です。"
                badge={<Badge tone="slate">補足</Badge>}
              >
                <div className="grid gap-5 lg:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-slate-700 lg:col-span-2">
                    戦術メモ
                    <textarea
                      name="tacticalNote"
                      defaultValue={match.tacticalNote ?? ""}
                      className={textAreaClassName}
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    負傷情報メモ
                    <textarea
                      name="injuryNote"
                      defaultValue={match.injuryNote ?? ""}
                      className={textAreaClassName}
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    モチベーションメモ
                    <textarea
                      name="motivationNote"
                      defaultValue={match.motivationNote ?? ""}
                      className={textAreaClassName}
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-slate-700 lg:col-span-2">
                    運営メモ
                    <textarea
                      name="adminNote"
                      defaultValue={match.adminNote ?? ""}
                      className={textAreaClassName}
                    />
                  </label>
                </div>
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                title="Research Memo"
                description="検索して分かったことをここにメモし、AI/人力補正に反映します。MVPでは手入力中心です。"
                badge={<Badge tone="info">通常toto向け</Badge>}
                defaultOpen={scopedResearchMemos.length === 0}
              >
                <div className="space-y-4">
                  {scopedResearchMemos.length > 0 ? (
                    <div className="grid gap-3">
                      {scopedResearchMemos.map((memo) => (
                        <div
                          key={memo.id}
                          className="rounded-[22px] border border-slate-200 bg-white/88 px-4 py-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap gap-2">
                                <Badge tone="info">{researchMemoTypeLabel[memo.memoType]}</Badge>
                                <Badge tone="slate">
                                  {researchMemoConfidenceLabel[memo.confidence]}
                                </Badge>
                              </div>
                              <h3 className="mt-3 font-semibold text-slate-950">{memo.title}</h3>
                              <p className="mt-2 text-sm leading-6 text-slate-700">{memo.summary}</p>
                              <p className="mt-2 text-xs text-slate-500">
                                {memo.team ? `${memo.team} / ` : ""}
                                {memo.sourceName ?? "手入力"}{memo.sourceDate ? ` / ${memo.sourceDate}` : ""}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleDeleteMemo(memo.id)}
                              className={secondaryButtonClassName}
                            >
                              削除
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/90 px-4 py-4 text-sm leading-6 text-slate-600">
                      まだメモはありません。通常totoではここに検索メモを残すと、後で「何を根拠に補正したか」を振り返りやすくなります。
                    </div>
                  )}

                  <form onSubmit={handleSaveMemo} className="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50/90 p-5">
                    <input type="hidden" name="memoId" value="" />
                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        メモ種別
                        <select name="memoType" className={fieldClassName} defaultValue="recent_form">
                          {Object.entries(researchMemoTypeLabel).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        信頼度
                        <select name="memoConfidence" className={fieldClassName} defaultValue="medium">
                          {Object.entries(researchMemoConfidenceLabel).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        タイトル
                        <input name="memoTitle" className={fieldClassName} placeholder="例: 直近3試合の失点が重い" />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        チーム
                        <input name="memoTeam" className={fieldClassName} placeholder={`${match.homeTeam} / ${match.awayTeam}`} />
                      </label>
                    </div>

                    <label className="grid gap-2 text-sm font-medium text-slate-700">
                      要約
                      <textarea name="memoSummary" className={textAreaClassName} />
                    </label>

                    <div className="grid gap-4 lg:grid-cols-3">
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Source 名
                        <input name="memoSourceName" className={fieldClassName} placeholder="ニュース / J公式 / 手入力" />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Source 日付
                        <input name="memoSourceDate" type="date" className={fieldClassName} />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Source URL
                        <input name="memoSourceUrl" className={fieldClassName} placeholder="https://..." />
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button type="submit" className={buttonClassName}>
                        Research Memo を保存
                      </button>
                      <p className="text-sm leading-6 text-slate-600">
                        保存者: {activeAuthor?.name ?? "未選択"}
                      </p>
                    </div>
                  </form>
                </div>
              </CollapsibleSectionCard>

              <SectionCard
                title="現在の表示"
                description="保存前のざっくり確認です。公式とモデルの入り具合だけ見ておけば大丈夫です。"
                actions={
                  <button type="submit" form={formId} className={buttonClassName} disabled={saving}>
                    {saving ? "保存中..." : "試合を保存"}
                  </button>
                }
              >
                <div className="rounded-3xl border border-dashed border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
                  現在の表示: 公式 {formatPercent(match.officialVote1)} /{" "}
                  {formatPercent(match.officialVote0)} / {formatPercent(match.officialVote2)}、 AI{" "}
                  {formatPercent(match.modelProb1)} / {formatPercent(match.modelProb0)} /{" "}
                  {formatPercent(match.modelProb2)}
                </div>
              </SectionCard>
            </form>
          )}
        </>
      ) : null}
    </div>
  );
}

export default function MatchEditorPage() {
  return (
    <Suspense fallback={<LoadingNotice title="試合編集を準備中" />}>
      <MatchEditorPageContent />
    </Suspense>
  );
}
