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
  fieldClassName,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/ui";
import {
  disagreementFromCounts,
  enumToOutcome,
  favoriteOutcomeForBucket,
  formatPercent,
  majorityHumanOutcome,
  pickCounts,
  pickDistribution,
  roundStatusLabel,
} from "@/lib/domain";
import { nullableString, parseOutcome } from "@/lib/forms";
import { appRoute, buildRoundHref, getSingleSearchParam } from "@/lib/round-links";
import { replacePicks } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useRoundWorkspace } from "@/lib/use-app-data";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function PicksPageContent() {
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const requestedUserId = getSingleSearchParam(searchParams.get("user"));
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const activeUser =
    data?.users.find((user) => user.id === requestedUserId) ?? data?.users[0] ?? null;

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
        eyebrow="Human Picks"
        title="人力予想入力"
        description="自分の1/0/2入力と、全員の分布・割れ具合・AIとの一致率を並べて見られます。"
      />

      {!isSupabaseConfigured() ? (
        <ConfigurationNotice />
      ) : !roundId ? (
        <RoundRequiredNotice />
      ) : loading && !data ? (
        <LoadingNotice title="Human Picks を読み込み中" />
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
              description="Dashboard でサンプルメンバーを作成してから利用してください。"
            >
              <p className="text-sm text-slate-600">
                Human Picks は共有メンバー前提の入力画面です。
              </p>
            </SectionCard>
          ) : (
            <>
              <SectionCard
                title="入力ユーザー切り替え"
                description="認証はないMVPなので、見るユーザーを切り替えて入力します。"
              >
                <div className="flex flex-wrap gap-2">
                  {data.users.map((user) => (
                    <Link
                      key={user.id}
                      href={buildRoundHref(appRoute.picks, data.round.id, {
                        user: user.id,
                      })}
                      className={user.id === activeUser.id ? buttonClassName : fieldClassName}
                    >
                      {user.name}
                    </Link>
                  ))}
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

                  const splitSummary = data.round.matches
                    .map((match) => {
                      const counts = pickCounts(picksByMatch.get(match.id) ?? []);
                      return {
                        match,
                        counts,
                        score: disagreementFromCounts(counts),
                      };
                    })
                    .sort((left, right) => right.score - left.score)[0];

                  const agreementBase = data.round.matches.filter(
                    (match) => (picksByMatch.get(match.id) ?? []).length > 0,
                  );
                  const agreementMatches = agreementBase.filter((match) => {
                    const humanMajority = majorityHumanOutcome(picksByMatch.get(match.id) ?? []);
                    const aiPrimary = favoriteOutcomeForBucket(match, "model");
                    return humanMajority !== null && aiPrimary !== null && humanMajority === aiPrimary;
                  });

                  return (
                    <>
                      <StatCard
                        label="入力中ユーザー"
                        value={activeUser.name}
                        hint="この下のフォームはこのユーザーの予想です"
                      />
                      <StatCard
                        label="全体の予想数"
                        value={`${data.round.picks.length}`}
                        hint="10人 × 13試合の想定"
                      />
                      <StatCard
                        label="一番割れている試合"
                        value={splitSummary ? `#${splitSummary.match.matchNo}` : "—"}
                        hint={
                          splitSummary
                            ? `${splitSummary.match.homeTeam} vs ${splitSummary.match.awayTeam}`
                            : "まだ入力待ちです"
                        }
                      />
                      <StatCard
                        label="AI推奨との一致率"
                        value={
                          agreementBase.length > 0
                            ? formatPercent(agreementMatches.length / agreementBase.length)
                            : "—"
                        }
                        hint="多数派の人力予想と Model 本命の一致率"
                      />

                      <SectionCard
                        className="lg:col-span-4"
                        title={`${activeUser.name} の入力表`}
                        description="13試合をまとめて保存します。"
                      >
                        <form onSubmit={handleSave} className="space-y-5">
                          <div className="overflow-x-auto">
                            <table className="min-w-[760px] text-left text-sm">
                              <thead>
                                <tr className="border-b border-slate-200 text-slate-500">
                                  <th className="px-3 py-3">No.</th>
                                  <th className="px-3 py-3">Match</th>
                                  <th className="px-3 py-3">My Pick</th>
                                  <th className="px-3 py-3">AI本命</th>
                                  <th className="px-3 py-3">人力分布</th>
                                  <th className="px-3 py-3">Note</th>
                                </tr>
                              </thead>
                              <tbody>
                                {data.round.matches.map((match) => {
                                  const existing = pickByMatchUser.get(
                                    `${match.id}:${activeUser.id}`,
                                  );
                                  const counts = pickCounts(picksByMatch.get(match.id) ?? []);
                                  const distribution = pickDistribution(counts);

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
                                          {match.homeTeam} vs {match.awayTeam}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                          {match.consensusCall ?? "人力コンセンサス集計前"}
                                        </div>
                                      </td>
                                      <td className="px-3 py-4">
                                        <select
                                          name={`pick_${match.id}`}
                                          defaultValue={enumToOutcome(existing?.pick) ?? ""}
                                          className={fieldClassName}
                                        >
                                          <option value="">未入力</option>
                                          <option value="1">1</option>
                                          <option value="0">0</option>
                                          <option value="2">2</option>
                                        </select>
                                      </td>
                                      <td className="px-3 py-4">
                                        <Badge tone="amber">
                                          {favoriteOutcomeForBucket(match, "model") ?? "—"}
                                        </Badge>
                                      </td>
                                      <td className="px-3 py-4 text-slate-600">
                                        {counts["1"]} / {counts["0"]} / {counts["2"]}
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
                              {saving ? "Saving..." : "Save Picks"}
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
                        description="人間とAIの対立が見やすいよう、1試合ごとに全員の予想を並べます。"
                      >
                        <div className="overflow-x-auto">
                          <table className="min-w-[1100px] text-left text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-500">
                                <th className="px-3 py-3">No.</th>
                                <th className="px-3 py-3">Match</th>
                                {data.users.map((user) => (
                                  <th key={user.id} className="px-3 py-3">
                                    {user.name}
                                  </th>
                                ))}
                                <th className="px-3 py-3">分布</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.round.matches.map((match) => {
                                const counts = pickCounts(picksByMatch.get(match.id) ?? []);

                                return (
                                  <tr key={match.id} className="border-b border-slate-100">
                                    <td className="px-3 py-4 font-semibold text-slate-900">
                                      {match.matchNo}
                                    </td>
                                    <td className="px-3 py-4">
                                      <div className="font-medium text-slate-900">
                                        {match.homeTeam} vs {match.awayTeam}
                                      </div>
                                      <div className="text-xs text-slate-500">
                                        AI {favoriteOutcomeForBucket(match, "model") ?? "—"} /
                                        Human{" "}
                                        {majorityHumanOutcome(picksByMatch.get(match.id) ?? []) ??
                                          "—"}
                                      </div>
                                    </td>
                                    {data.users.map((user) => {
                                      const pick = pickByMatchUser.get(`${match.id}:${user.id}`);
                                      const value = enumToOutcome(pick?.pick) ?? "—";
                                      const aiPrimary = favoriteOutcomeForBucket(match, "model");
                                      const tone =
                                        value === aiPrimary
                                          ? "teal"
                                          : value === "0"
                                            ? "lime"
                                            : "slate";

                                      return (
                                        <td key={user.id} className="px-3 py-4">
                                          <Badge tone={tone}>{value}</Badge>
                                        </td>
                                      );
                                    })}
                                    <td className="px-3 py-4 text-slate-600">
                                      {counts["1"]} / {counts["0"]} / {counts["2"]}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
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
    <Suspense fallback={<LoadingNotice title="Human Picks を準備中" />}>
      <PicksPageContent />
    </Suspense>
  );
}
