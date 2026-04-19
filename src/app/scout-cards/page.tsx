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
  SectionCard,
  textAreaClassName,
} from "@/components/ui";
import {
  computeDirectionScore,
  provisionalCallLabel,
  provisionalCallOptions,
  roundStatusLabel,
} from "@/lib/domain";
import {
  nullableString,
  parseBoundedInt,
  parseProvisionalCall,
} from "@/lib/forms";
import { appRoute, buildRoundHref, getSingleSearchParam } from "@/lib/round-links";
import { replaceScoutReports } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useRoundWorkspace } from "@/lib/use-app-data";

const scoreOptions = {
  strength: [-3, -2, -1, 0, 1, 2, 3],
  conditions: [-2, -1, 0, 1, 2],
  micro: [-1, 0, 1],
  draw: [0, 1, 2],
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "不明なエラーです。";
}

function ScoutCardsPageContent() {
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const requestedUserId = getSingleSearchParam(searchParams.get("user"));
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const activeUser =
    data?.users.find((user) => user.id === requestedUserId) ?? data?.users[0] ?? null;
  const reportByMatch = new Map(
    (data?.round.scoutReports ?? [])
      .filter((report) => report.userId === activeUser?.id)
      .map((report) => [report.matchId, report]),
  );

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!data || !activeUser) {
      return;
    }

    setSaving(true);
    setSubmitError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const reports = data.round.matches
        .map((match) => {
          const scoreStrengthForm = parseBoundedInt(
            String(formData.get(`scoreStrengthForm_${match.id}`) ?? ""),
            -3,
            3,
          );
          const scoreAvailability = parseBoundedInt(
            String(formData.get(`scoreAvailability_${match.id}`) ?? ""),
            -3,
            3,
          );
          const scoreConditions = parseBoundedInt(
            String(formData.get(`scoreConditions_${match.id}`) ?? ""),
            -2,
            2,
          );
          const scoreTacticalMatchup = parseBoundedInt(
            String(formData.get(`scoreTacticalMatchup_${match.id}`) ?? ""),
            -2,
            2,
          );
          const scoreMicro = parseBoundedInt(
            String(formData.get(`scoreMicro_${match.id}`) ?? ""),
            -1,
            1,
          );
          const drawAlert = parseBoundedInt(
            String(formData.get(`drawAlert_${match.id}`) ?? ""),
            0,
            2,
          );
          const provisionalCall = parseProvisionalCall(
            String(formData.get(`provisionalCall_${match.id}`) ?? ""),
          );
          const exceptionFlag =
            String(formData.get(`exceptionFlag_${match.id}`) ?? "") === "on";
          const noteStrengthForm = nullableString(formData, `noteStrengthForm_${match.id}`);
          const noteAvailability = nullableString(formData, `noteAvailability_${match.id}`);
          const noteConditions = nullableString(formData, `noteConditions_${match.id}`);
          const noteTacticalMatchup = nullableString(
            formData,
            `noteTacticalMatchup_${match.id}`,
          );
          const noteMicro = nullableString(formData, `noteMicro_${match.id}`);
          const noteDrawAlert = nullableString(formData, `noteDrawAlert_${match.id}`);
          const exceptionNote = nullableString(formData, `exceptionNote_${match.id}`);

          const hasMeaningfulInput =
            scoreStrengthForm !== 0 ||
            scoreAvailability !== 0 ||
            scoreConditions !== 0 ||
            scoreTacticalMatchup !== 0 ||
            scoreMicro !== 0 ||
            drawAlert !== 0 ||
            provisionalCall !== "double" ||
            exceptionFlag ||
            Boolean(
              noteStrengthForm ||
                noteAvailability ||
                noteConditions ||
                noteTacticalMatchup ||
                noteMicro ||
                noteDrawAlert ||
                exceptionNote,
            );

          if (!hasMeaningfulInput) {
            return null;
          }

          return {
            matchId: match.id,
            scoreStrengthForm,
            noteStrengthForm,
            scoreAvailability,
            noteAvailability,
            scoreConditions,
            noteConditions,
            scoreTacticalMatchup,
            noteTacticalMatchup,
            scoreMicro,
            noteMicro,
            drawAlert,
            noteDrawAlert,
            directionScoreF: computeDirectionScore({
              scoreStrengthForm,
              scoreAvailability,
              scoreConditions,
              scoreTacticalMatchup,
              scoreMicro,
            }),
            provisionalCall,
            exceptionFlag,
            exceptionNote,
          };
        })
        .filter((report): report is NonNullable<typeof report> => report !== null);

      await replaceScoutReports({
        roundId: data.round.id,
        userId: activeUser.id,
        reports,
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
        eyebrow="根拠カード"
        title="人力スコアリングカード"
        description="W杯toto予想の根拠を、試合ごとに点数化して残します。方向スコア F は保存時に自動計算されます。"
      />

      {!isSupabaseConfigured() ? (
        <ConfigurationNotice />
      ) : !roundId ? (
        <RoundRequiredNotice />
      ) : loading && !data ? (
        <LoadingNotice title="根拠カードを読み込み中" />
      ) : error && !data ? (
        <ErrorNotice error={error} onRetry={() => void refresh()} />
      ) : data ? (
        <>
          <RoundNav
            roundId={data.round.id}
            roundTitle={data.round.title}
            roundStatus={roundStatusLabel[data.round.status]}
            currentPath={appRoute.scoutCards}
            userId={activeUser?.id}
          />

          {data.users.length === 0 || !activeUser ? (
            <SectionCard
              title="共有メンバーがまだありません"
              description="ダッシュボードでサンプルメンバーを作成してから利用してください。"
            >
              <p className="text-sm text-slate-600">
                根拠カードは共有メンバー前提の入力画面です。
              </p>
            </SectionCard>
          ) : (
            <>
              <SectionCard
                title="入力ユーザー切り替え"
                description="メンバーごとの視点を残す前提なので、入力対象を切り替えて使います。"
              >
                <div className="flex flex-wrap gap-2">
                  {data.users.map((user) => (
                    <Link
                      key={user.id}
                      href={buildRoundHref(appRoute.scoutCards, data.round.id, {
                        user: user.id,
                      })}
                      className={user.id === activeUser.id ? buttonClassName : fieldClassName}
                    >
                      {user.name}
                    </Link>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="入力ルール" description="表示文言は要件に合わせています。">
                <div className="space-y-2 text-sm leading-7 text-slate-700">
                  <p>W杯toto予想。上から重要考慮要素。</p>
                  <p>
                    ①地力・直近内容（-3～+3） / ②出場可能戦力（-3～+3） /
                    ③開催条件：ホーム・休養・移動（-2～+2）
                  </p>
                  <p>
                    ④戦術相性（-2～+2） / ⑤微修正 M（-1 / 0 / +1） /
                    引き分け警戒 D（0 / 1 / 2）
                  </p>
                  <p>
                    方向スコア F = ① + ② + ③ + ④ + M。F がプラスなら Home / 1
                    寄り、マイナスなら Away / 2 寄りです。
                  </p>
                  <p>
                    F が ±1 以内で D が高い場合は Draw / 0 候補、D = 2
                    なら引き分け警戒を強調します。
                  </p>
                </div>
              </SectionCard>

              <form onSubmit={handleSave} className="space-y-6">
                {data.round.matches.map((match) => {
                  const report = reportByMatch.get(match.id);

                  return (
                    <details
                      key={match.id}
                      open={match.matchNo <= 2}
                      className="overflow-hidden rounded-[30px] border border-white/60 bg-white/85 shadow-[0_20px_50px_rgba(15,23,42,0.08)]"
                    >
                      <summary className="cursor-pointer list-none px-5 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                              第{match.matchNo}試合
                            </div>
                            <div className="text-lg font-semibold text-slate-900">
                              {match.homeTeam} 対 {match.awayTeam}
                            </div>
                          </div>
                          <div className="text-sm text-slate-500">
                            現在のF {report?.directionScoreF ?? 0} / 仮結論{" "}
                            {report ? provisionalCallLabel[report.provisionalCall] : "未入力"}
                          </div>
                        </div>
                      </summary>

                      <div className="grid gap-5 border-t border-slate-100 px-5 py-5 lg:grid-cols-2">
                        {[
                          [
                            "scoreStrengthForm",
                            "①地力・直近内容（-3～+3）",
                            scoreOptions.strength,
                            report?.scoreStrengthForm ?? 0,
                            "noteStrengthForm",
                            report?.noteStrengthForm ?? "",
                          ],
                          [
                            "scoreAvailability",
                            "②出場可能戦力（-3～+3）",
                            scoreOptions.strength,
                            report?.scoreAvailability ?? 0,
                            "noteAvailability",
                            report?.noteAvailability ?? "",
                          ],
                          [
                            "scoreConditions",
                            "③開催条件：ホーム / 休養 / 移動（-2～+2）",
                            scoreOptions.conditions,
                            report?.scoreConditions ?? 0,
                            "noteConditions",
                            report?.noteConditions ?? "",
                          ],
                          [
                            "scoreTacticalMatchup",
                            "④戦術相性（-2～+2）",
                            scoreOptions.conditions,
                            report?.scoreTacticalMatchup ?? 0,
                            "noteTacticalMatchup",
                            report?.noteTacticalMatchup ?? "",
                          ],
                          [
                            "scoreMicro",
                            "⑤微修正 M（-1 / 0 / +1）",
                            scoreOptions.micro,
                            report?.scoreMicro ?? 0,
                            "noteMicro",
                            report?.noteMicro ?? "",
                          ],
                          [
                            "drawAlert",
                            "引き分け警戒 D（0 / 1 / 2）",
                            scoreOptions.draw,
                            report?.drawAlert ?? 0,
                            "noteDrawAlert",
                            report?.noteDrawAlert ?? "",
                          ],
                        ].map(([name, label, options, value, noteName, noteValue]) => (
                          <div
                            key={String(name)}
                            className="rounded-3xl border border-slate-200 bg-slate-950/5 p-4"
                          >
                            <label className="grid gap-2 text-sm font-medium text-slate-700">
                              {String(label)}
                              <select
                                name={`${String(name)}_${match.id}`}
                                defaultValue={String(value)}
                                className={fieldClassName}
                              >
                                {(options as number[]).map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="mt-3 grid gap-2 text-sm font-medium text-slate-700">
                              根拠
                              <textarea
                                name={`${String(noteName)}_${match.id}`}
                                defaultValue={String(noteValue)}
                                className={textAreaClassName}
                              />
                            </label>
                          </div>
                        ))}

                        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
                          <label className="grid gap-2 text-sm font-medium text-slate-700">
                            仮結論
                            <select
                              name={`provisionalCall_${match.id}`}
                              defaultValue={report?.provisionalCall ?? "double"}
                              className={fieldClassName}
                            >
                              {provisionalCallOptions.map((call) => (
                                <option key={call} value={call}>
                                  {provisionalCallLabel[call]}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="mt-4 flex items-center gap-3 text-sm font-medium text-slate-700">
                            <input
                              type="checkbox"
                              name={`exceptionFlag_${match.id}`}
                              defaultChecked={report?.exceptionFlag ?? false}
                              className="h-4 w-4 rounded border-slate-300 text-amber-600"
                            />
                            例外フラグを立てる
                          </label>

                          <label className="mt-3 grid gap-2 text-sm font-medium text-slate-700">
                            理由
                            <textarea
                              name={`exceptionNote_${match.id}`}
                              defaultValue={report?.exceptionNote ?? ""}
                              className={textAreaClassName}
                            />
                          </label>
                        </div>

                        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-7 text-emerald-950">
                          <p>保存後に方向スコア F を自動計算します。</p>
                          <p>現在値: {report?.directionScoreF ?? 0}</p>
                          <p>F がプラスなら Home / 1 寄り、マイナスなら Away / 2 寄り。</p>
                          <p>F が小さく D が高い場合は Draw / 0 候補として扱います。</p>
                        </div>
                      </div>
                    </details>
                  );
                })}

                <div className="flex justify-end">
                  <button type="submit" className={buttonClassName} disabled={saving}>
                    {saving ? "保存中..." : "カードを保存"}
                  </button>
                </div>
              </form>
              {submitError ? <p className="text-sm text-rose-700">{submitError}</p> : null}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

export default function ScoutCardsPage() {
  return (
    <Suspense fallback={<LoadingNotice title="根拠カードを準備中" />}>
      <ScoutCardsPageContent />
    </Suspense>
  );
}
