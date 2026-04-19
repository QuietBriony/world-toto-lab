"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

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
  aiRecommendedOutcomes,
  buildMatchBadges,
  favoriteOutcomeForBucket,
  categoryLabel,
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatOutcomeSet,
  formatPercent,
  formatSignedPercent,
  humanConsensusOutcomes,
  humanOverlayBadge,
  roundStatusLabel,
  roundStatusOptions,
} from "@/lib/domain";
import {
  AI_MODEL_LABEL,
  AI_MODEL_VERSION,
  canEstimateAiModel,
  describeAiEstimator,
  estimateAiModel,
} from "@/lib/ai-estimator";
import { deriveRoundProgressSummary, matchHasSetupInput } from "@/lib/round-progress";
import {
  nullableString,
  parseIntOrNull,
  parseRoundStatus,
  stringValue,
} from "@/lib/forms";
import { fixtureImportTemplate, parseFixtureImportText } from "@/lib/fixture-import";
import { appRoute, buildRoundHref, getSingleSearchParam } from "@/lib/round-links";
import { bulkUpdateRoundMatches, estimateRoundAiModel, updateRound } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useRoundWorkspace } from "@/lib/use-app-data";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "不明なエラーです。";
}

function progressValue(done: number, total: number) {
  return total > 0 ? `${done}/${total}` : "未設定";
}

function strongestPositiveEdge(match: {
  modelProb0: number | null;
  modelProb1: number | null;
  modelProb2: number | null;
  officialVote0: number | null;
  officialVote1: number | null;
  officialVote2: number | null;
}) {
  const candidates = [
    {
      edge:
        match.modelProb1 !== null && match.officialVote1 !== null
          ? match.modelProb1 - match.officialVote1
          : null,
      outcome: "1",
    },
    {
      edge:
        match.modelProb0 !== null && match.officialVote0 !== null
          ? match.modelProb0 - match.officialVote0
          : null,
      outcome: "0",
    },
    {
      edge:
        match.modelProb2 !== null && match.officialVote2 !== null
          ? match.modelProb2 - match.officialVote2
          : null,
      outcome: "2",
    },
  ].filter(
    (
      candidate,
    ): candidate is {
      edge: number;
      outcome: "1" | "0" | "2";
    } => candidate.edge !== null && candidate.edge > 0,
  );

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort((left, right) => right.edge - left.edge)[0];
}

function WorkspacePageContent() {
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
        userCount: data.users.length,
      })
    : null;
  const estimableMatchCount =
    data?.round.matches.filter((match) => canEstimateAiModel(match)).length ?? 0;
  const missingAiCount =
    data?.round.matches.filter(
      (match) => match.modelProb1 === null && match.modelProb0 === null && match.modelProb2 === null,
    ).length ?? 0;
  const setupPendingMatches = data?.round.matches.filter((match) => !matchHasSetupInput(match)) ?? [];
  const aiGapMatches =
    data?.round.matches
      .map((match) => {
        const strongestEdge = strongestPositiveEdge(match);
        return strongestEdge ? { match, strongestEdge } : null;
      })
      .filter(
        (
          entry,
        ): entry is {
          match: (typeof data.round.matches)[number];
          strongestEdge: NonNullable<ReturnType<typeof strongestPositiveEdge>>;
        } => entry !== null,
      )
      .sort((left, right) => right.strongestEdge.edge - left.strongestEdge.edge)
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
      .filter((match) => canEstimateAiModel(match))
      .slice(0, 4)
      .map((match) => ({
        estimated: estimateAiModel(match),
        match,
      }))
      .filter(
        (
          entry,
        ): entry is {
          estimated: NonNullable<ReturnType<typeof estimateAiModel>>;
          match: (typeof data.round.matches)[number];
        } => entry.estimated !== null,
      ) ?? [];
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

  const handleSaveRound = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!data) {
      return;
    }

    setSaving(true);
    setSubmitError(null);

    try {
      const formData = new FormData(event.currentTarget);
      await updateRound({
        roundId: data.round.id,
        title: stringValue(formData, "title") || "無題のラウンド",
        status: parseRoundStatus(stringValue(formData, "status")),
        budgetYen: parseIntOrNull(stringValue(formData, "budgetYen")),
        notes: nullableString(formData, "notes"),
      });
      await refresh();
    } catch (nextError) {
      setSubmitError(errorMessage(nextError));
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
          ? `${result.updatedCount} 試合の AI確率を${overwriteExisting ? "再" : ""}試算しました。`
          : "試算できる試合がありませんでした。先に公式人気か市場確率を入れてください。",
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
        description="13試合の分析入力状況を、AI基準線を土台にして人力上書きと差分候補まで一気に俯瞰できます。"
        actions={
          data ? <Badge tone="sky">{roundStatusLabel[data.round.status]}</Badge> : undefined
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
                  label="人力予想"
                  value={
                    progressValue(
                      data.round.picks.length,
                      progress?.expectedMemberEntries ?? 0,
                    )
                  }
                  hint="全メンバーぶんの 1 / 0 / 2 入力状況"
                  compact
                />
                <StatCard
                  label="根拠カード"
                  value={
                    progressValue(
                      data.round.scoutReports.length,
                      progress?.expectedMemberEntries ?? 0,
                    )
                  }
                  hint="根拠スコアとメモの入力状況"
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
                    "試合設定、人力予想、根拠カード、振り返りの順で進めるとまとまりやすいです。"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {progress ? (
                    <Link href={progress.nextStep.href} className={buttonClassName}>
                      {progress.nextStep.label}
                    </Link>
                  ) : null}
                  <Link
                    href={buildRoundHref(appRoute.picks, data.round.id, {
                      user: data.users[0]?.id,
                    })}
                    className={secondaryButtonClassName}
                  >
                    人力予想へ
                  </Link>
                  <Link
                    href={buildRoundHref(appRoute.scoutCards, data.round.id, {
                      user: data.users[0]?.id,
                    })}
                    className={secondaryButtonClassName}
                  >
                    根拠カードへ
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
                  基本の順番: 試合設定 → 人力予想 → 根拠カード → コンセンサス → 差分 / 候補チケット → 振り返り
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
                  <Badge tone="positive">差分大</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    AIが強めに見ている試合
                  </h3>
                </div>
                <div className="mt-4 space-y-3">
                  {aiGapMatches.length === 0 ? (
                    <p className="text-sm leading-6 text-slate-600">
                      公式人気と AI が両方入ると、ここに差分の大きい試合が出ます。
                    </p>
                  ) : (
                    aiGapMatches.map(({ match, strongestEdge }) => (
                      <div
                        key={match.id}
                        className="rounded-[18px] border border-emerald-200 bg-white/75 p-3"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          #{match.matchNo} {match.homeTeam} 対 {match.awayTeam}
                        </div>
                        <div className="mt-1 text-sm text-slate-700">
                          {strongestEdge.outcome} が {formatSignedPercent(strongestEdge.edge)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge tone="amber">
                            AI基準線 {formatOutcomeSet(aiRecommendedOutcomes(match))}
                          </Badge>
                          <Badge tone="slate">
                            人力 {formatOutcomeSet(humanConsensusOutcomes(match))}
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
                      カテゴリや AI で引き分け寄りになる試合があると、ここに出ます。
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
                          AI {formatOutcomeSet(aiRecommendedOutcomes(match))} / 人力{" "}
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
            description="予算やステータス、当日の観戦メモをここで更新します。"
          >
            <form
              key={data.round.updatedAt}
              onSubmit={handleSaveRound}
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
                予算
                <input
                  name="budgetYen"
                  type="number"
                  min={0}
                  step={100}
                  defaultValue={data.round.budgetYen ?? ""}
                  className={fieldClassName}
                />
              </label>

              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-950/5 p-4 text-sm text-slate-600">
                候補チケットの枚数は 100円単位の予算から計算します。
                現在の設定: {formatCurrency(data.round.budgetYen)}
              </div>

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
            {submitError ? <p className="text-sm text-rose-700">{submitError}</p> : null}
          </SectionCard>

          <CollapsibleSectionCard
            title="試合日程をまとめて入れる"
            description="FIFA公式日程や手元の表から、13試合ぶんをまとめて貼り付けできます。ホーム / アウェイ / 日時 / 会場 / ステージを一気に反映します。"
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
                    まず FIFA公式の日程ページやスプレッドシートから 13 行を持ってきて、ここに貼るのがいちばん速いです。
                  </p>
                </div>
                <ul className="space-y-2 text-sm leading-7 text-slate-700">
                  <li>日時は `2026-06-11 19:00` のように入れると読み取りやすいです。</li>
                  <li>会場やステージが空でも反映できます。後で試合編集で追記できます。</li>
                  <li>AI確率までは自動で入りません。日程を入れた後に、必要な試合だけ AI 1/0/2 を足してください。</li>
                </ul>
              </div>
            </div>
          </CollapsibleSectionCard>

          <CollapsibleSectionCard
            title="AI予想をまとめて試算する"
            description="公式人気と市場確率が入っている試合を対象に、このアプリ内の暫定モデルで AI 1 / 0 / 2 を自動計算します。あとで試合編集で上書きできます。"
            badge={<Badge tone="sky">AI試算</Badge>}
          >
            <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatCard
                    label="AI未設定"
                    value={`${missingAiCount}`}
                    hint="まだ AI 1 / 0 / 2 が空の試合数"
                    compact
                  />
                  <StatCard
                    label="試算できる試合"
                    value={`${estimableMatchCount}`}
                    hint="公式人気か市場確率が入っている試合数"
                    compact
                  />
                  <StatCard
                    label="今のAI本命"
                    value={`${data.round.matches.filter((match) => favoriteOutcomeForBucket(match, "model")).length}`}
                    hint="AI本命が表示できる試合数"
                    compact
                  />
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50/85 p-5">
                  <p className="text-sm leading-7 text-slate-700">
                    これは外部モデルではなく、`公式人気 + 市場確率 + カテゴリ補正` から作る暫定の AI基準線です。
                    人力の前段でたたき台を作る用途として使う想定です。
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge tone="slate">{AI_MODEL_LABEL}</Badge>
                    <Badge tone="slate">{AI_MODEL_VERSION}</Badge>
                    <span className="text-xs text-slate-500">
                      ロジック更新後に再試算して育てていけます
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={buttonClassName}
                      onClick={() => void handleEstimateAi()}
                      disabled={estimatingAi}
                    >
                      {estimatingAi ? "AI試算中..." : "AI未設定を試算する"}
                    </button>
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      onClick={() => void handleEstimateAi(true)}
                      disabled={estimatingAi}
                    >
                      既存AIも再試算
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
                  <li>市場確率を強め、公式人気を補助的に混ぜています。</li>
                  <li>ホーム / アウェイ差が小さい試合は、引き分けをやや持ち上げます。</li>
                  <li>`固定寄り` や `引き分け候補` などのカテゴリも少しだけ反映します。</li>
                  <li>本番用の予測モデルではないので、最後は試合編集で微調整してください。</li>
                </ul>
                <div className="rounded-[20px] border border-slate-200 bg-white/80 p-4">
                  <div className="flex items-center gap-2">
                    <Badge tone="sky">プレビュー</Badge>
                    <h4 className="text-sm font-semibold text-slate-900">いま試算できる試合</h4>
                  </div>
                  <div className="mt-3 space-y-3">
                    {aiPreviewMatches.length === 0 ? (
                      <p className="text-sm leading-6 text-slate-600">
                        公式人気か市場確率を入れると、ここに試算プレビューが出ます。
                      </p>
                    ) : (
                      aiPreviewMatches.map(({ match, estimated }) => (
                        <div
                          key={match.id}
                          className="rounded-[18px] border border-slate-200 bg-slate-50/85 p-3"
                        >
                          <div className="text-sm font-semibold text-slate-900">
                            #{match.matchNo} {match.homeTeam} 対 {match.awayTeam}
                          </div>
                          <div className="mt-2 text-sm text-slate-700">
                            AI {formatPercent(estimated.modelProb1)} /{" "}
                            {formatPercent(estimated.modelProb0)} /{" "}
                            {formatPercent(estimated.modelProb2)} | 候補{" "}
                            {estimated.recommendedOutcomes ?? "—"}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {describeAiEstimator(match).map((note) => (
                              <Badge key={`${match.id}-${note}`} tone="slate">
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
            title="13試合の確認カード"
            description="まずはここで全体をざっと見ます。細かい数値表は下の `詳細表を開く` に残しています。"
          >
            <div className="grid gap-4 xl:grid-cols-2">
              {orderedOverviewMatches.map((match) => {
                const aiBase = aiRecommendedOutcomes(match);
                const humanBase = humanConsensusOutcomes(match);
                const badges = buildMatchBadges(match);
                const overlayBadge = humanOverlayBadge(match);
                const setupReady = matchHasSetupInput(match);
                const strongestEdge = strongestPositiveEdge(match);

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
                          AI基準線
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {aiBase.length === 0 ? (
                            <Badge tone="slate">AI未設定</Badge>
                          ) : (
                            aiBase.map((outcome) => (
                              <Badge key={`${match.id}-overview-ai-${outcome}`} tone="amber">
                                {outcome}
                              </Badge>
                            ))
                          )}
                        </div>
                        <div className="mt-2 text-sm text-slate-600">
                          AI {formatPercent(match.modelProb1)} / {formatPercent(match.modelProb0)} /{" "}
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
                      {strongestEdge ? (
                        <Badge tone="positive">
                          差分大 {strongestEdge.outcome} {formatSignedPercent(strongestEdge.edge)}
                        </Badge>
                      ) : (
                        <Badge tone="slate">差分はまだ小さめ</Badge>
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
            title="13試合の詳細表"
            description="細かい数値を確認したいときだけ開いて使います。横スクロール対応で、差分は AI - 公式人気 です。"
            badge={<Badge tone="slate">詳細</Badge>}
          >
            <div className="overflow-x-auto">
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
                    <th className="px-3 py-3">AI 1/0/2</th>
                    <th className="px-3 py-3">AI基準線</th>
                    <th className="px-3 py-3">人力F</th>
                    <th className="px-3 py-3">人力D</th>
                    <th className="px-3 py-3">人力上書き</th>
                    <th className="px-3 py-3">差分 1/0/2</th>
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
                              <Badge tone="slate">AI未設定</Badge>
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
            </div>
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
