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
} from "@/components/ui";
import {
  aiRecommendedOutcomes,
  enumToOutcome,
  favoriteOutcomeForBucket,
  formatOutcomeSet,
  formatPercent,
  humanConsensusOutcomes,
  humanOverlayBadge,
  majorityHumanOutcome,
  pickCounts,
  pickDistribution,
  roundStatusLabel,
  singlePickOverlayBadge,
  type OutcomeValue,
} from "@/lib/domain";
import { nullableString, parseOutcome } from "@/lib/forms";
import { appRoute, buildRoundHref, getSingleSearchParam } from "@/lib/round-links";
import { replacePicks } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useRoundWorkspace } from "@/lib/use-app-data";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "不明なエラーです。";
}

function buildDraftPickValues(input: {
  activeUserId: string;
  matches: Array<{ id: string }>;
  picks: Array<{ matchId: string; pick: "ONE" | "DRAW" | "TWO"; userId: string }>;
}): Record<string, OutcomeValue | ""> {
  const nextValues: Record<string, OutcomeValue | ""> = {};

  for (const match of input.matches) {
    const existing = input.picks.find(
      (pick) => pick.matchId === match.id && pick.userId === input.activeUserId,
    );
    nextValues[match.id] = enumToOutcome(existing?.pick) ?? "";
  }

  return nextValues;
}

function buildDraftPickIdentity(input: {
  activeUserId: string;
  picks: Array<{ id: string; pick: "ONE" | "DRAW" | "TWO"; updatedAt: Date | string; userId: string }>;
  roundId: string;
}) {
  return [
    input.roundId,
    input.activeUserId,
    ...input.picks
      .filter((pick) => pick.userId === input.activeUserId)
      .map((pick) => `${pick.id}:${pick.pick}:${String(pick.updatedAt)}`),
  ].join("|");
}

function PicksPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const requestedUserId = getSingleSearchParam(searchParams.get("user"));
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [draftPickState, setDraftPickState] = useState<{
    identity: string;
    values: Record<string, OutcomeValue | "">;
  }>({
    identity: "empty",
    values: {},
  });

  const activeUser =
    data?.users.find((user) => user.id === requestedUserId) ?? data?.users[0] ?? null;
  const draftPickIdentity =
    data && activeUser
      ? buildDraftPickIdentity({
          activeUserId: activeUser.id,
          picks: data.round.picks,
          roundId: data.round.id,
        })
      : "empty";
  const baseDraftPickValues =
    data && activeUser
      ? buildDraftPickValues({
          activeUserId: activeUser.id,
          matches: data.round.matches,
          picks: data.round.picks,
        })
      : {};
  const resolvedDraftPickValues =
    draftPickState.identity === draftPickIdentity
      ? draftPickState.values
      : baseDraftPickValues;
  const hasVisibleUnsavedChanges =
    hasUnsavedChanges && draftPickState.identity === draftPickIdentity;
  const filledPickCount =
    data && activeUser
      ? data.round.matches.filter((match) => Boolean(resolvedDraftPickValues[match.id])).length
      : 0;
  const pendingPickCount = data ? Math.max(data.round.matches.length - filledPickCount, 0) : 0;
  const formId = activeUser ? `picks-form-${activeUser.id}` : "picks-form";

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

  const handleSwitchUser = (userId: string) => {
    if (
      hasVisibleUnsavedChanges &&
      !window.confirm("未保存の変更があります。保存せずにユーザーを切り替えますか？")
    ) {
      return;
    }

    router.push(
      buildRoundHref(appRoute.picks, data?.round.id ?? roundId, {
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
      await replacePicks({
        roundId: data.round.id,
        userId: activeUser.id,
        picks: data.round.matches.map((match) => ({
          matchId: match.id,
          pick: parseOutcome(String(formData.get(`pick_${match.id}`) ?? "")),
          note: nullableString(formData, `note_${match.id}`),
        })),
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
        eyebrow="人力予想"
        title="人力予想入力"
        description="AIの基準線を先に見て、その上に自分や全体の別予想を重ねていく入力画面です。"
      />

      {!isSupabaseConfigured() ? (
        <ConfigurationNotice />
      ) : !roundId ? (
        <RoundRequiredNotice />
      ) : loading && !data ? (
        <LoadingNotice title="人力予想を読み込み中" />
      ) : error && !data ? (
        <ErrorNotice error={error} onRetry={() => void refresh()} />
      ) : data ? (
        <>
          <RoundNav
            roundId={data.round.id}
            roundTitle={data.round.title}
            roundStatus={roundStatusLabel[data.round.status]}
            currentPath={appRoute.picks}
            userId={activeUser?.id}
          />

          {data.users.length === 0 || !activeUser ? (
            <SectionCard
              title="共有メンバーがまだありません"
              description="ダッシュボードでサンプルメンバーを作成してから利用してください。"
            >
              <p className="text-sm text-slate-600">
                人力予想は共有メンバー前提の入力画面です。
              </p>
            </SectionCard>
          ) : (
            <>
              <SectionCard
                title="入力ユーザー切り替え"
                description="認証はないMVPなので、見るユーザーを切り替えて AI 基準線への上書きを入力します。"
              >
                <div className="flex flex-wrap gap-2">
                  {data.users.map((user) => (
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
                <p className="text-xs text-slate-500">
                  先に保存してから切り替えると、入力の取りこぼしを防げます。
                </p>
              </SectionCard>

              <SectionCard
                title="AIを土台にして入れる"
                description="この画面では、まず AI の推奨を見てから、人力でそのまま乗るか、0 を足すか、別筋へ振るかを決めます。"
              >
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-[22px] border border-white/80 bg-white/72 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)]">
                    <div className="font-display text-[11px] uppercase tracking-[0.34em] text-amber-800/75">
                      AI基準線
                    </div>
                    <h3 className="mt-3 font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                      まず AI 本線を見る
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      AI の 1 / 0 / 2 と推奨候補を基準線にします。ここが最初の叩き台です。
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/80 bg-white/72 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)]">
                    <div className="font-display text-[11px] uppercase tracking-[0.34em] text-sky-800/75">
                      人力上書き
                    </div>
                    <h3 className="mt-3 font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                      人力で別筋をかぶせる
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      AI に乗るだけでなく、引き分け追加や逆張りも人力の判断として重ねられます。
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/80 bg-white/72 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)]">
                    <div className="font-display text-[11px] uppercase tracking-[0.34em] text-teal-800/75">
                      全体シグナル
                    </div>
                    <h3 className="mt-3 font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                      全体の重なりを見る
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      最後に全員の分布を見ると、AI に沿った集まりか、人力でズレを作っているかが見えます。
                    </p>
                  </div>
                </div>
              </SectionCard>

              <section className="grid gap-4 lg:grid-cols-4">
                {(() => {
                  const picksByMatch = new Map<string, typeof data.round.picks>();
                  const pickByMatchUser = new Map<string, (typeof data.round.picks)[number]>();

                  for (const pick of data.round.picks) {
                    const current = picksByMatch.get(pick.matchId) ?? [];
                    current.push(pick);
                    picksByMatch.set(pick.matchId, current);
                    pickByMatchUser.set(`${pick.matchId}:${pick.userId}`, pick);
                  }

                  const agreementBase = data.round.matches.filter(
                    (match) => (picksByMatch.get(match.id) ?? []).length > 0,
                  );
                  const agreementMatches = agreementBase.filter((match) => {
                    const humanMajority = majorityHumanOutcome(picksByMatch.get(match.id) ?? []);
                    const aiPrimary = favoriteOutcomeForBucket(match, "model");
                    return humanMajority !== null && aiPrimary !== null && humanMajority === aiPrimary;
                  });

                  const activeEntries = data.round.matches.map((match) => {
                    const pickValue = resolvedDraftPickValues[match.id] ?? "";
                    return {
                      aiBase: aiRecommendedOutcomes(match),
                      aiPrimary: favoriteOutcomeForBucket(match, "model"),
                      match,
                      pickValue,
                    };
                  });

                  const aiPrimaryAlignedCount = activeEntries.filter(
                    (entry) => entry.pickValue && entry.pickValue === entry.aiPrimary,
                  ).length;

                  const drawOverlayCount = activeEntries.filter(
                    (entry) => entry.pickValue === "0" && !entry.aiBase.includes("0"),
                  ).length;

                  const alternateLineCount = activeEntries.filter(
                    (entry) => entry.pickValue && !entry.aiBase.includes(entry.pickValue),
                  ).length;

                  return (
                    <>
                      <StatCard
                        label="AI本線に重ねた数"
                        value={`${aiPrimaryAlignedCount}/${data.round.matches.length}`}
                        hint={`${activeUser.name} が AI 本命と同じ 1 / 0 / 2 を選んだ数`}
                      />
                      <StatCard
                        label="AIに0を追加した数"
                        value={`${drawOverlayCount}`}
                        hint="AI が 0 を含まない試合に、人力で 0 を足した件数"
                      />
                      <StatCard
                        label="AIと別筋で入れた数"
                        value={`${alternateLineCount}`}
                        hint={
                          alternateLineCount > 0
                            ? `${activeUser.name} が AI 推奨外を選んだ試合数`
                            : "今のところ AI 推奨の範囲内で入力しています"
                        }
                      />
                      <StatCard
                        label="人力全体のAI一致率"
                        value={
                          agreementBase.length > 0
                            ? formatPercent(agreementMatches.length / agreementBase.length)
                            : "—"
                        }
                        hint="多数派の人力予想と AI 本命の一致率"
                      />

                      <SectionCard
                        className="lg:col-span-4"
                        title={`${activeUser.name} の上書き入力表`}
                        description="AI 基準線を見ながら、13試合をまとめて保存します。"
                        actions={
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={pendingPickCount === 0 ? "teal" : "amber"}>
                              入力 {filledPickCount}/{data.round.matches.length}
                            </Badge>
                            {hasVisibleUnsavedChanges ? (
                              <Badge tone="rose">未保存あり</Badge>
                            ) : (
                              <Badge tone="slate">保存済み</Badge>
                            )}
                            <button
                              type="submit"
                              form={formId}
                              className={buttonClassName}
                              disabled={saving}
                            >
                              {saving ? "保存中..." : "予想を保存"}
                            </button>
                          </div>
                        }
                      >
                        <form
                          id={formId}
                          key={activeUser.id}
                          onSubmit={handleSave}
                          onChange={() => setHasUnsavedChanges(true)}
                          className="space-y-5"
                        >
                          <div className="overflow-x-auto">
                            <table className="min-w-[1120px] text-left text-sm">
                              <thead>
                                <tr className="border-b border-slate-200 text-slate-500">
                                  <th className="px-3 py-3">番号</th>
                                  <th className="px-3 py-3">試合</th>
                                  <th className="px-3 py-3">AI基準線</th>
                                  <th className="px-3 py-3">自分の上書き</th>
                                  <th className="px-3 py-3">AIとの差分</th>
                                  <th className="px-3 py-3">全体の重なり</th>
                                  <th className="px-3 py-3">メモ</th>
                                </tr>
                              </thead>
                              <tbody>
                                {data.round.matches.map((match) => {
                                  const existing = pickByMatchUser.get(
                                    `${match.id}:${activeUser.id}`,
                                  );
                                  const counts = pickCounts(picksByMatch.get(match.id) ?? []);
                                  const distribution = pickDistribution(counts);
                                  const aiBase = aiRecommendedOutcomes(match);
                                  const currentPick =
                                    resolvedDraftPickValues[match.id] ??
                                    enumToOutcome(existing?.pick) ??
                                    "";
                                  const pickBadge = singlePickOverlayBadge(
                                    match,
                                    currentPick || null,
                                  );
                                  const overlayBadge = humanOverlayBadge(match);

                                  return (
                                    <tr
                                      key={match.id}
                                      className="border-b border-slate-100 align-top"
                                    >
                                      <td className="px-3 py-4 font-semibold text-slate-900">
                                        {match.matchNo}
                                      </td>
                                      <td className="px-3 py-4">
                                        <div className="font-medium text-slate-900">
                                          {match.homeTeam} 対 {match.awayTeam}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                          第{match.matchNo}試合 /{" "}
                                          {match.consensusCall ?? "人力コンセンサス集計前"}
                                        </div>
                                      </td>
                                      <td className="px-3 py-4">
                                        <div className="flex flex-wrap gap-2">
                                          {aiBase.length === 0 ? (
                                            <Badge tone="slate">AI未設定</Badge>
                                          ) : (
                                            aiBase.map((outcome) => (
                                              <Badge key={`${match.id}-ai-${outcome}`} tone="amber">
                                                AI {outcome}
                                              </Badge>
                                            ))
                                          )}
                                        </div>
                                        <div className="mt-2 text-xs text-slate-500">
                                          AI {formatPercent(match.modelProb1)} /{" "}
                                          {formatPercent(match.modelProb0)} /{" "}
                                          {formatPercent(match.modelProb2)}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                          信頼度{" "}
                                          {match.confidence !== null
                                            ? match.confidence.toFixed(2)
                                            : "—"}
                                        </div>
                                      </td>
                                      <td className="px-3 py-4">
                                        <select
                                          name={`pick_${match.id}`}
                                          value={currentPick}
                                          className={fieldClassName}
                                          onChange={(event) => {
                                            setDraftPickState({
                                              identity: draftPickIdentity,
                                              values: {
                                                ...resolvedDraftPickValues,
                                                [match.id]:
                                                  event.target.value as OutcomeValue | "",
                                              },
                                            });
                                          }}
                                        >
                                          <option value="">未入力</option>
                                          <option value="1">1</option>
                                          <option value="0">0</option>
                                          <option value="2">2</option>
                                        </select>
                                      </td>
                                      <td className="px-3 py-4">
                                        <Badge tone={pickBadge.tone}>{pickBadge.label}</Badge>
                                      </td>
                                      <td className="px-3 py-4 text-slate-600">
                                        <div className="flex flex-wrap gap-2">
                                          <Badge tone={overlayBadge.tone}>
                                            {overlayBadge.label}
                                          </Badge>
                                          <Badge tone="slate">
                                            人力 {formatOutcomeSet(humanConsensusOutcomes(match))}
                                          </Badge>
                                        </div>
                                        <div className="mt-2">
                                          {counts["1"]} / {counts["0"]} / {counts["2"]}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                          {formatPercent(distribution["1"])} /{" "}
                                          {formatPercent(distribution["0"])} /{" "}
                                          {formatPercent(distribution["2"])}
                                        </div>
                                      </td>
                                      <td className="px-3 py-4">
                                        <input
                                          name={`note_${match.id}`}
                                          defaultValue={existing?.note ?? ""}
                                          className={fieldClassName}
                                          placeholder="一言メモ"
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          <div className="flex justify-end">
                            <button type="submit" className={buttonClassName} disabled={saving}>
                              {saving ? "保存中..." : "予想を保存"}
                            </button>
                          </div>
                        </form>
                        {submitError ? (
                          <p className="text-sm text-rose-700">{submitError}</p>
                        ) : null}
                      </SectionCard>

                      <SectionCard
                        className="lg:col-span-4"
                        title="全員の予想一覧"
                        description="必要なときだけ開いて、全体の重なり方を確認します。"
                      >
                        <details className="group rounded-[24px] border border-slate-200 bg-slate-50/85">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-sm font-medium text-slate-700 [&::-webkit-details-marker]:hidden">
                            <span>全員の予想分布を開く</span>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
                              クリックで表示
                            </span>
                          </summary>
                          <div className="overflow-x-auto border-t border-slate-200 px-4 py-4">
                            <table className="min-w-[1280px] text-left text-sm">
                              <thead>
                                <tr className="border-b border-slate-200 text-slate-500">
                                  <th className="px-3 py-3">番号</th>
                                  <th className="px-3 py-3">試合</th>
                                  <th className="px-3 py-3">AI基準線</th>
                                  {data.users.map((user) => (
                                    <th key={user.id} className="px-3 py-3">
                                      {user.name}
                                    </th>
                                  ))}
                                  <th className="px-3 py-3">人力上書き</th>
                                </tr>
                              </thead>
                              <tbody>
                                {data.round.matches.map((match) => {
                                  const counts = pickCounts(picksByMatch.get(match.id) ?? []);
                                  const aiBase = aiRecommendedOutcomes(match);
                                  const overlayBadge = humanOverlayBadge(match);

                                  return (
                                    <tr key={match.id} className="border-b border-slate-100">
                                      <td className="px-3 py-4 font-semibold text-slate-900">
                                        {match.matchNo}
                                      </td>
                                      <td className="px-3 py-4">
                                        <div className="font-medium text-slate-900">
                                          {match.homeTeam} 対 {match.awayTeam}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                          人力{" "}
                                          {majorityHumanOutcome(picksByMatch.get(match.id) ?? []) ??
                                            "—"}
                                        </div>
                                      </td>
                                      <td className="px-3 py-4">
                                        <div className="flex flex-wrap gap-2">
                                          {aiBase.length === 0 ? (
                                            <Badge tone="slate">AI未設定</Badge>
                                          ) : (
                                            aiBase.map((outcome) => (
                                              <Badge
                                                key={`${match.id}-all-ai-${outcome}`}
                                                tone="amber"
                                              >
                                                {outcome}
                                              </Badge>
                                            ))
                                          )}
                                        </div>
                                        <div className="mt-2 text-xs text-slate-500">
                                          AI {formatPercent(match.modelProb1)} /{" "}
                                          {formatPercent(match.modelProb0)} /{" "}
                                          {formatPercent(match.modelProb2)}
                                        </div>
                                      </td>
                                      {data.users.map((user) => {
                                        const pick = pickByMatchUser.get(`${match.id}:${user.id}`);
                                        const value = enumToOutcome(pick?.pick) ?? "—";
                                        const tone =
                                          value === "—"
                                            ? "slate"
                                            : singlePickOverlayBadge(match, value).tone;

                                        return (
                                          <td key={user.id} className="px-3 py-4">
                                            <Badge tone={tone}>{value}</Badge>
                                          </td>
                                        );
                                      })}
                                      <td className="px-3 py-4 text-slate-600">
                                        <div className="flex flex-wrap gap-2">
                                          <Badge tone={overlayBadge.tone}>
                                            {overlayBadge.label}
                                          </Badge>
                                          <Badge tone="slate">
                                            {match.consensusCall ?? "未集計"}
                                          </Badge>
                                        </div>
                                        <div className="mt-2">
                                          {counts["1"]} / {counts["0"]} / {counts["2"]}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      </SectionCard>
                    </>
                  );
                })()}
              </section>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

export default function PicksPage() {
  return (
    <Suspense fallback={<LoadingNotice title="人力予想を準備中" />}>
      <PicksPageContent />
    </Suspense>
  );
}
