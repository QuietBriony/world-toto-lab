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
  categoryLabel,
  categoryOptions,
  enumToOutcome,
  formatDateTime,
  formatPercent,
  parseOutcomeList,
  roundStatusLabel,
  serializeOutcomeList,
} from "@/lib/domain";
import {
  nullableString,
  parseCategory,
  parseFloatOrNull,
  parseProbabilityPercent,
  stringValue,
} from "@/lib/forms";
import { appRoute, buildRoundHref, getSingleSearchParam } from "@/lib/round-links";
import { updateMatch } from "@/lib/repository";
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

function MatchEditorPageContent() {
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const matchId = getSingleSearchParam(searchParams.get("match"));
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
        category: parseCategory(stringValue(formData, "category")),
        confidence: confidenceRaw === null ? null : Math.min(Math.max(confidenceRaw, 0), 1),
        recommendedOutcomes: serializeOutcomeList(
          parseOutcomeList(stringValue(formData, "recommendedOutcomes")),
        ),
      });
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
                  hint={`市場 ${hasMarketInputs ? "あり" : "なし"} / AI ${hasAiInputs ? "あり" : "なし"}`}
                  tone={hasMarketInputs || hasAiInputs ? "positive" : "warning"}
                  compact
                />
                <StatCard
                  label="メモ"
                  value={`${noteCount}`}
                  hint={noteCount > 0 ? "入力済みメモ数" : "まだメモはありません"}
                  compact
                />
              </section>

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

              <SectionCard
                title="現在の表示"
                description="保存前のざっくり確認です。公式と AI の入り具合だけ見ておけば大丈夫です。"
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
                {submitError ? <p className="text-sm text-rose-700">{submitError}</p> : null}
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
