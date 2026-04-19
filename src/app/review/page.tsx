"use client";

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
  fieldClassName,
  PageHeader,
  SectionCard,
  StatCard,
  textAreaClassName,
} from "@/components/ui";
import {
  enumToOutcome,
  formatPercent,
  roundStatusLabel,
  roundStatusOptions,
} from "@/lib/domain";
import { nullableString, parseOutcome, parseRoundStatus, stringValue } from "@/lib/forms";
import { appRoute, getSingleSearchParam } from "@/lib/round-links";
import { addReviewNote, saveResults } from "@/lib/repository";
import { buildReviewSummary } from "@/lib/review";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useRoundWorkspace } from "@/lib/use-app-data";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "不明なエラーです。";
}

function ReviewPageContent() {
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);
  const [savingResults, setSavingResults] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pendingResultsCount =
    data?.round.matches.filter((match) => match.actualResult === null).length ?? 0;

  const summary = data
    ? buildReviewSummary({
        matches: data.round.matches,
        picks: data.round.picks,
        scoutReports: data.round.scoutReports,
        users: data.users,
      })
    : null;

  const handleSaveResults = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!data) {
      return;
    }

    setSavingResults(true);
    setSubmitError(null);

    try {
      const formData = new FormData(event.currentTarget);
      await saveResults({
        roundId: data.round.id,
        status: parseRoundStatus(stringValue(formData, "status")),
        results: data.round.matches.map((match) => ({
          matchId: match.id,
          actualResult: parseOutcome(stringValue(formData, `actualResult_${match.id}`)),
        })),
      });
      await refresh();
    } catch (nextError) {
      setSubmitError(errorMessage(nextError));
    } finally {
      setSavingResults(false);
    }
  };

  const handleAddNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!data) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const note = stringValue(formData, "note");

    if (!note) {
      setSubmitError("反省ログの本文を入力してください。");
      return;
    }

    setSavingNote(true);
    setSubmitError(null);

    try {
      await addReviewNote({
        roundId: data.round.id,
        matchId: nullableString(formData, "matchId"),
        userId: nullableString(formData, "userId"),
        note,
      });
      event.currentTarget.reset();
      await refresh();
    } catch (nextError) {
      setSubmitError(errorMessage(nextError));
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="結果と振り返り"
        title="結果入力と反省ログ"
        description="賞金や配当は扱わず、予想精度・方向性・一致 / 対立パターンを振り返る画面です。"
      />

      {!isSupabaseConfigured() ? (
        <ConfigurationNotice />
      ) : !roundId ? (
        <RoundRequiredNotice />
      ) : loading && !data ? (
        <LoadingNotice title="振り返りを読み込み中" />
      ) : error && !data ? (
        <ErrorNotice error={error} onRetry={() => void refresh()} />
      ) : data && summary ? (
        <>
          <RoundNav
            roundId={data.round.id}
            roundTitle={data.round.title}
            roundStatus={roundStatusLabel[data.round.status]}
            currentPath={appRoute.review}
          />

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard label="結果入力の残り" value={`${pendingResultsCount}`} />
            <StatCard label="AI推奨の的中数" value={`${summary.aiHits}/${summary.completedMatches}`} />
            <StatCard
              label="人力コンセンサスの的中数"
              value={`${summary.humanHits}/${summary.completedMatches}`}
            />
            <StatCard label="公式本命の的中数" value={`${summary.officialHits}/${summary.completedMatches}`} />
            <StatCard label="市場本命の的中数" value={`${summary.marketHits}/${summary.completedMatches}`} />
          </section>

          <SectionCard
            title="結果入力"
            description="試合結果をまとめて更新できます。結果がすべて入ると、そのまま振り返りが見やすくなります。"
          >
            {pendingResultsCount > 0 ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50/90 p-4 text-sm leading-6 text-amber-950">
                まだ結果未入力の試合が {pendingResultsCount} 件あります。先にここを埋めると、下の集計とランキングが揃います。
              </div>
            ) : (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50/90 p-4 text-sm leading-6 text-emerald-950">
                13 試合ぶんの結果入力が揃っています。下の集計と反省ログをそのまま確認できます。
              </div>
            )}
            <form onSubmit={handleSaveResults} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                {data.round.matches.map((match) => (
                  <label
                    key={match.id}
                    className="grid gap-2 rounded-3xl border border-slate-200 bg-slate-50/80 p-4 text-sm font-medium text-slate-700"
                  >
                    <span>
                      #{match.matchNo} {match.homeTeam} 対 {match.awayTeam}
                    </span>
                    <select
                      name={`actualResult_${match.id}`}
                      defaultValue={enumToOutcome(match.actualResult) ?? ""}
                      className={fieldClassName}
                    >
                      <option value="">未確定</option>
                      <option value="1">1</option>
                      <option value="0">0</option>
                      <option value="2">2</option>
                    </select>
                  </label>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  ラウンドのステータス
                  <select
                    name="status"
                    defaultValue={data.round.status}
                    className={fieldClassName}
                  >
                    {roundStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {roundStatusLabel[status]}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-end justify-end">
                  <button
                    type="submit"
                    className={buttonClassName}
                    disabled={savingResults}
                  >
                    {savingResults ? "保存中..." : "結果を保存"}
                  </button>
                </div>
              </div>
            </form>
          </SectionCard>

          <SectionCard title="予想的中ランキング" description="賞金や配当ではなく、純粋に予想結果を並べます。">
            <div className="overflow-x-auto">
              <table className="min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-3 py-3">順位</th>
                    <th className="px-3 py-3">メンバー</th>
                    <th className="px-3 py-3">的中数</th>
                    <th className="px-3 py-3">F方向的中率</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rankings.map((entry, index) => (
                    <tr key={entry.userId} className="border-b border-slate-100">
                      <td className="px-3 py-4 font-semibold text-slate-900">#{index + 1}</td>
                      <td className="px-3 py-4">{entry.name}</td>
                      <td className="px-3 py-4">
                        <Badge tone="teal">
                          {entry.hits}/{entry.total}
                        </Badge>
                      </td>
                      <td className="px-3 py-4">{formatPercent(entry.directionHitRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <section className="grid gap-4 xl:grid-cols-4">
            <StatCard label="drawAlertが効いた試合" value={`${summary.drawAlertEffective}`} />
            <StatCard label="exceptionFlagが刺さった試合" value={`${summary.exceptionUseful}`} />
            <StatCard
              label="AIと人間が一致した試合の的中率"
              value={formatPercent(summary.agreementRate)}
            />
            <StatCard
              label="AIと人間が対立した試合の拾えた率"
              value={formatPercent(summary.conflictCoverageRate)}
            />
          </section>

          <SectionCard title="反省ログ" description="試合単位でもラウンド単位でもメモを残せます。">
            <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
              <form onSubmit={handleAddNote} className="space-y-4">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  試合
                  <select name="matchId" className={fieldClassName} defaultValue="">
                    <option value="">ラウンド全体メモ</option>
                    {data.round.matches.map((match) => (
                      <option key={match.id} value={match.id}>
                        #{match.matchNo} {match.homeTeam} 対 {match.awayTeam}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  記録者
                  <select name="userId" className={fieldClassName} defaultValue="">
                    <option value="">記録者なし</option>
                    {data.users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  メモ
                  <textarea
                    name="note"
                    className={textAreaClassName}
                    placeholder="例: drawAlert を軽く見すぎた。人気過多バッジの試合は次回もっと強くケアする。"
                  />
                </label>

                <div className="flex justify-end">
                  <button type="submit" className={buttonClassName} disabled={savingNote}>
                    {savingNote ? "保存中..." : "振り返りメモを追加"}
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                {data.round.reviewNotes.length === 0 ? (
                  <p className="text-sm text-slate-500">反省ログはまだありません。</p>
                ) : (
                  data.round.reviewNotes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{note.user?.name ?? "システム"}</span>
                        <span>•</span>
                        <span>
                          {note.match
                            ? `#${note.match.matchNo} ${note.match.homeTeam} 対 ${note.match.awayTeam}`
                            : "ラウンド全体"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-7 text-slate-700">{note.note}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
            {submitError ? <p className="text-sm text-rose-700">{submitError}</p> : null}
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<LoadingNotice title="振り返りを準備中" />}>
      <ReviewPageContent />
    </Suspense>
  );
}
