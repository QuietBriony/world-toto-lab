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
  buttonClassName,
  fieldClassName,
  PageHeader,
  secondaryButtonClassName,
  SectionCard,
  textAreaClassName,
} from "@/components/ui";
import {
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
  return error instanceof Error ? error.message : "Unknown error";
}

function percentInput(value: number | null) {
  return value === null ? "" : (value * 100).toFixed(1);
}

function MatchEditorPageContent() {
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const matchId = getSingleSearchParam(searchParams.get("match"));
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const match = data?.round.matches.find((entry) => entry.id === matchId) ?? null;

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
        homeTeam: stringValue(formData, "homeTeam") || "TBD Home",
        awayTeam: stringValue(formData, "awayTeam") || "TBD Away",
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
        eyebrow={match ? `Match ${match.matchNo}` : "Match Editor"}
        title={match ? `${match.homeTeam} vs ${match.awayTeam}` : "Match Editor"}
        description={
          match
            ? `Kickoff ${formatDateTime(match.kickoffTime)} / 現在結果 ${
                enumToOutcome(match.actualResult) ?? "—"
              }`
            : "Round から対象試合を選んで編集します。"
        }
      />

      {!isSupabaseConfigured() ? (
        <ConfigurationNotice />
      ) : !roundId ? (
        <RoundRequiredNotice />
      ) : loading && !data ? (
        <LoadingNotice title="Match Editor を読み込み中" />
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
              description="Round Detail から Edit を押して対象試合を選んでください。"
              actions={
                <Link
                  href={buildRoundHref(appRoute.workspace, data.round.id)}
                  className={secondaryButtonClassName}
                >
                  Round Detail へ戻る
                </Link>
              }
            >
              <p className="text-sm text-slate-600">
                URL の `?match=` に対象試合 ID が入る構成です。
              </p>
            </SectionCard>
          ) : (
            <SectionCard
              title="Match Editor"
              description="確率は 0〜1 保存ですが、画面では % 入力です。"
            >
              <form
                key={match.updatedAt}
                onSubmit={handleSave}
                className="grid gap-5 lg:grid-cols-2"
              >
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Home Team
                  <input name="homeTeam" defaultValue={match.homeTeam} className={fieldClassName} />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Away Team
                  <input name="awayTeam" defaultValue={match.awayTeam} className={fieldClassName} />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Kickoff
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
                  Venue
                  <input name="venue" defaultValue={match.venue ?? ""} className={fieldClassName} />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Stage
                  <input name="stage" defaultValue={match.stage ?? ""} className={fieldClassName} />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Confidence
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

                <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-950/5 p-4 lg:col-span-2 lg:grid-cols-3">
                  {[
                    ["officialVote1", "Official 1", percentInput(match.officialVote1)],
                    ["officialVote0", "Official 0", percentInput(match.officialVote0)],
                    ["officialVote2", "Official 2", percentInput(match.officialVote2)],
                    ["marketProb1", "Market 1", percentInput(match.marketProb1)],
                    ["marketProb0", "Market 0", percentInput(match.marketProb0)],
                    ["marketProb2", "Market 2", percentInput(match.marketProb2)],
                    ["modelProb1", "Model 1", percentInput(match.modelProb1)],
                    ["modelProb0", "Model 0", percentInput(match.modelProb0)],
                    ["modelProb2", "Model 2", percentInput(match.modelProb2)],
                  ].map(([name, label, value]) => (
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
                      />
                    </label>
                  ))}
                </div>

                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Category
                  <select
                    name="category"
                    className={fieldClassName}
                    defaultValue={match.category ?? ""}
                  >
                    <option value="">未設定</option>
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Recommended Outcomes
                  <input
                    name="recommendedOutcomes"
                    defaultValue={match.recommendedOutcomes ?? ""}
                    className={fieldClassName}
                    placeholder="1,0"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-700 lg:col-span-2">
                  Tactical Note
                  <textarea
                    name="tacticalNote"
                    defaultValue={match.tacticalNote ?? ""}
                    className={textAreaClassName}
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Injury Note
                  <textarea
                    name="injuryNote"
                    defaultValue={match.injuryNote ?? ""}
                    className={textAreaClassName}
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Motivation Note
                  <textarea
                    name="motivationNote"
                    defaultValue={match.motivationNote ?? ""}
                    className={textAreaClassName}
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-700 lg:col-span-2">
                  Admin Note
                  <textarea
                    name="adminNote"
                    defaultValue={match.adminNote ?? ""}
                    className={textAreaClassName}
                  />
                </label>

                <div className="rounded-3xl border border-dashed border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 lg:col-span-2">
                  現在の表示: Official {formatPercent(match.officialVote1)} /{" "}
                  {formatPercent(match.officialVote0)} / {formatPercent(match.officialVote2)}、 Model{" "}
                  {formatPercent(match.modelProb1)} / {formatPercent(match.modelProb0)} /{" "}
                  {formatPercent(match.modelProb2)}
                </div>

                <div className="flex justify-end lg:col-span-2">
                  <button type="submit" className={buttonClassName} disabled={saving}>
                    {saving ? "Saving..." : "Save Match"}
                  </button>
                </div>
              </form>
              {submitError ? <p className="text-sm text-rose-700">{submitError}</p> : null}
            </SectionCard>
          )}
        </>
      ) : null}
    </div>
  );
}

export default function MatchEditorPage() {
  return (
    <Suspense fallback={<LoadingNotice title="Match Editor を準備中" />}>
      <MatchEditorPageContent />
    </Suspense>
  );
}
