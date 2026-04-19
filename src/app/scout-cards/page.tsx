"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";

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
import { filterPredictors, userRoleLabel } from "@/lib/users";

const scoreOptions = {
  strength: [-3, -2, -1, 0, 1, 2, 3],
  conditions: [-2, -1, 0, 1, 2],
  micro: [-1, 0, 1],
  draw: [0, 1, 2],
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "不明なエラーです。";
}

function reportHasMeaningfulInput(
  report:
    | {
        drawAlert: number;
        exceptionFlag: boolean;
        exceptionNote: string | null;
        noteAvailability: string | null;
        noteConditions: string | null;
        noteDrawAlert: string | null;
        noteMicro: string | null;
        noteStrengthForm: string | null;
        noteTacticalMatchup: string | null;
        provisionalCall: string;
        scoreAvailability: number;
        scoreConditions: number;
        scoreMicro: number;
        scoreStrengthForm: number;
        scoreTacticalMatchup: number;
      }
    | undefined,
) {
  if (!report) {
    return false;
  }

  return (
    report.scoreStrengthForm !== 0 ||
    report.scoreAvailability !== 0 ||
    report.scoreConditions !== 0 ||
    report.scoreTacticalMatchup !== 0 ||
    report.scoreMicro !== 0 ||
    report.drawAlert !== 0 ||
    report.provisionalCall !== "double" ||
    report.exceptionFlag ||
    Boolean(
      report.noteStrengthForm ||
        report.noteAvailability ||
        report.noteConditions ||
        report.noteTacticalMatchup ||
        report.noteMicro ||
        report.noteDrawAlert ||
        report.exceptionNote,
    )
  );
}

function ScoutCardsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const requestedUserId = getSingleSearchParam(searchParams.get("user"));
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const predictorUsers = data ? filterPredictors(data.users) : [];
  const activeUser =
    predictorUsers.find((user) => user.id === requestedUserId) ?? predictorUsers[0] ?? null;
  const reportByMatch = new Map(
    (data?.round.scoutReports ?? [])
      .filter((report) => report.userId === activeUser?.id)
      .map((report) => [report.matchId, report]),
  );
  const completedReportCount =
    data?.round.matches.filter((match) => reportHasMeaningfulInput(reportByMatch.get(match.id)))
      .length ?? 0;
  const pendingReportCount = data ? Math.max(data.round.matches.length - completedReportCount, 0) : 0;
  const drawAlertCount =
    data?.round.matches.filter((match) => (reportByMatch.get(match.id)?.drawAlert ?? 0) >= 1)
      .length ?? 0;
  const exceptionCount =
    data?.round.matches.filter((match) => reportByMatch.get(match.id)?.exceptionFlag).length ?? 0;
  const orderedMatches =
    data?.round.matches
      .slice()
      .sort((left, right) => {
        const leftDone = reportHasMeaningfulInput(reportByMatch.get(left.id)) ? 1 : 0;
        const rightDone = reportHasMeaningfulInput(reportByMatch.get(right.id)) ? 1 : 0;

        if (leftDone !== rightDone) {
          return leftDone - rightDone;
        }

        const leftDraw = reportByMatch.get(left.id)?.drawAlert ?? 0;
        const rightDraw = reportByMatch.get(right.id)?.drawAlert ?? 0;
        if (leftDraw !== rightDraw) {
          return rightDraw - leftDraw;
        }

        return left.matchNo - right.matchNo;
      }) ?? [];
  const focusMatches = orderedMatches.slice(0, 4);
  const formId = activeUser ? `scout-form-${activeUser.id}` : "scout-form";

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleSwitchUser = (userId: string) => {
    if (
      hasUnsavedChanges &&
      !window.confirm("未保存の変更があります。保存せずにユーザーを切り替えますか？")
    ) {
      return;
    }

    router.push(
      buildRoundHref(appRoute.scoutCards, data?.round.id ?? roundId, {
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
        eyebrow="根拠カード"
        title="予想者カード"
        description="AIと比較したい予想者だけが、試合ごとの根拠を点数化して残します。方向スコア F は保存時に自動計算されます。"
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

          {data.users.length === 0 ? (
            <SectionCard
              title="共有メンバーがまだありません"
              description="ダッシュボードでサンプルメンバーを作成してから利用してください。"
            >
              <p className="text-sm text-slate-600">
                予想者カードは共有メンバー前提の入力画面です。
              </p>
            </SectionCard>
          ) : predictorUsers.length === 0 || !activeUser ? (
            <SectionCard
              title="予想者がまだいません"
              description="ダッシュボードの共有メンバーで、少なくとも1人を予想者に変更してください。"
            >
              <p className="text-sm leading-6 text-slate-600">
                ウォッチ担当はここでは入力せず、支持 / 予想画面で AI か予想者のどちらに乗るかを選びます。
              </p>
            </SectionCard>
          ) : (
            <>
              <SectionCard
                title="入力ユーザー切り替え"
                description="予想者ごとの視点を残す前提なので、入力対象を切り替えて使います。"
              >
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div className="flex flex-wrap gap-2">
                    {predictorUsers.map((user) => (
                      <button
                        type="button"
                        key={user.id}
                        onClick={() => handleSwitchUser(user.id)}
                        className={user.id === activeUser.id ? buttonClassName : fieldClassName}
                      >
                        {user.name}
                      </button>
                    ))}
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/85 p-4 text-sm text-slate-600">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="sky">いま入力中</Badge>
                      <span className="font-semibold text-slate-900">{activeUser.name}</span>
                      <Badge tone="teal">{userRoleLabel[activeUser.role]}</Badge>
                    </div>
                    <p className="mt-2 leading-6">
                      保存してから切り替えると、根拠メモの取りこぼしを防げます。
                    </p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="入力ルール" description="予想者だけが使う補助カードです。">
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
                    方向スコア F = ① + ② + ③ + ④ + M。F がプラスならホーム / 1
                    寄り、マイナスならアウェイ / 2 寄りです。
                  </p>
                  <p>
                    F が ±1 以内で D が高い場合は引き分け / 0 候補、D = 2
                    なら引き分け警戒を強調します。
                  </p>
                </div>
              </SectionCard>

              <section className="grid gap-4 lg:grid-cols-4">
                <StatCard
                  label="入力済みカード"
                  value={`${completedReportCount}/${data.round.matches.length}`}
                  hint={`${activeUser.name} が根拠を入れた試合数`}
                />
                <StatCard
                  label="未入力"
                  value={`${pendingReportCount}`}
                  hint="まずここから埋めると進めやすいです"
                />
                <StatCard
                  label="引き分け警戒あり"
                  value={`${drawAlertCount}`}
                  hint="D が 1 以上の試合数"
                />
                <StatCard
                  label="例外フラグ"
                  value={`${exceptionCount}`}
                  hint="通常判断から外して見たい試合数"
                />
              </section>

              <SectionCard
                title="先に見る 4 試合"
                description="未入力の試合が先頭です。まずここから順に埋めると、全体を速く回せます。"
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={pendingReportCount === 0 ? "teal" : "amber"}>
                      未入力 {pendingReportCount}
                    </Badge>
                    <button
                      type="submit"
                      form={formId}
                      className={buttonClassName}
                      disabled={saving}
                    >
                      {saving ? "保存中..." : "予想者カードを保存"}
                    </button>
                  </div>
                }
              >
                <div className="grid gap-3 lg:grid-cols-2">
                  {focusMatches.map((match) => {
                    const report = reportByMatch.get(match.id);
                    const isFilled = reportHasMeaningfulInput(report);

                    return (
                      <div
                        key={match.id}
                        className="rounded-[22px] border border-white/80 bg-white/76 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)]"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={isFilled ? "teal" : "amber"}>
                            {isFilled ? "入力あり" : "未入力"}
                          </Badge>
                          <Badge tone="slate">第{match.matchNo}試合</Badge>
                        </div>
                        <h3 className="mt-3 font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                          {match.homeTeam} 対 {match.awayTeam}
                        </h3>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>F {report?.directionScoreF ?? 0}</span>
                          <span>D {report?.drawAlert ?? 0}</span>
                          <span>
                            仮結論 {report ? provisionalCallLabel[report.provisionalCall] : "未入力"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>

              <SectionCard
                title="入力のコツ"
                description="全部を長文で書くより、数値で方向を出してから短い根拠を足すのが使いやすいです。"
              >
                <div className="grid gap-3 lg:grid-cols-3">
                  <div className="rounded-[22px] border border-white/80 bg-white/76 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)]">
                    <div className="font-display text-[11px] uppercase tracking-[0.34em] text-amber-800/75">
                      1
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      まず ①〜⑤ をざっくり入れて F の向きを決めます。
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/80 bg-white/76 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)]">
                    <div className="font-display text-[11px] uppercase tracking-[0.34em] text-sky-800/75">
                      2
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      引き分けを見たい試合だけ D を上げて、仮結論で整理します。
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/80 bg-white/76 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)]">
                    <div className="font-display text-[11px] uppercase tracking-[0.34em] text-teal-800/75">
                      3
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      迷う試合だけ理由を短く残せば、後で見返しやすくなります。
                    </p>
                  </div>
                </div>
              </SectionCard>

              <form
                id={formId}
                onSubmit={handleSave}
                onChange={() => setHasUnsavedChanges(true)}
                className="space-y-6"
              >
                {orderedMatches.map((match, index) => {
                  const report = reportByMatch.get(match.id);
                  const isFilled = reportHasMeaningfulInput(report);

                  return (
                    <details
                      key={match.id}
                      open={index < 3 && !isFilled}
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
                          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                            <Badge tone={isFilled ? "teal" : "amber"}>
                              {isFilled ? "入力あり" : "未入力"}
                            </Badge>
                            <span>F {report?.directionScoreF ?? 0}</span>
                            <span>D {report?.drawAlert ?? 0}</span>
                            <span>
                              仮結論{" "}
                              {report ? provisionalCallLabel[report.provisionalCall] : "未入力"}
                            </span>
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
                          <p>F がプラスならホーム / 1 寄り、マイナスならアウェイ / 2 寄り。</p>
                          <p>F が小さく D が高い場合は引き分け / 0 候補として扱います。</p>
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
