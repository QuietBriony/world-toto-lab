"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { RouteGlossaryCard } from "@/components/app/round-guides";
import { ConfigurationNotice, ErrorNotice, LoadingNotice } from "@/components/app/states";
import {
  Badge,
  buttonClassName,
  HorizontalScrollTable,
  PageHeader,
  SectionCard,
  secondaryButtonClassName,
  StatCard,
} from "@/components/ui";
import {
  buildGoal3EventWatch,
  buildGoal3VoteRows,
  deriveGoal3VoteRateUrl,
  isGoal3LibraryEntry,
  pickFeaturedGoal3Entry,
  type Goal3OutcomeValue,
} from "@/lib/goal3";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/domain";
import { appRoute, buildOfficialRoundImportHref } from "@/lib/round-links";
import {
  syncTotoOfficialRoundListFromOfficial,
  upsertTotoOfficialRoundLibraryFromSync,
  type SyncedTotoOfficialRoundEntry,
} from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useBigOfficialWatch, useTotoOfficialRoundLibrary } from "@/lib/use-app-data";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "不明なエラーです。";
}

function proxyOutcomeLabel(outcome: Goal3OutcomeValue | null) {
  return outcome ? `${outcome} が薄め` : "—";
}

export default function Goal3ValuePage() {
  const library = useTotoOfficialRoundLibrary({ productType: "custom" });
  const bigOfficialWatch = useBigOfficialWatch();
  const [syncing, setSyncing] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [selectedEntryParam, setSelectedEntryParam] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return new URL(window.location.href).searchParams.get("entry");
  });
  const [liveSnapshotsByEntryId, setLiveSnapshotsByEntryId] = useState<
    Record<string, SyncedTotoOfficialRoundEntry>
  >({});
  const [attemptedSnapshotEntryIds, setAttemptedSnapshotEntryIds] = useState<
    Record<string, true>
  >({});

  const goal3Entries = useMemo(
    () => (library.data ?? []).filter(isGoal3LibraryEntry),
    [library.data],
  );
  const featuredEntry = useMemo(() => pickFeaturedGoal3Entry(goal3Entries), [goal3Entries]);
  const bigOfficialSnapshots = useMemo(
    () => bigOfficialWatch.data?.snapshots ?? [],
    [bigOfficialWatch.data],
  );

  const effectiveSelectedEntryId =
    selectedEntryParam && goal3Entries.some((entry) => entry.id === selectedEntryParam)
      ? selectedEntryParam
      : featuredEntry?.id ?? null;

  const selectedEntry =
    goal3Entries.find((entry) => entry.id === effectiveSelectedEntryId) ??
    featuredEntry ??
    null;
  const selectedWatch = selectedEntry ? buildGoal3EventWatch(selectedEntry) : null;
  const selectedVoteRateUrl = deriveGoal3VoteRateUrl(selectedEntry?.sourceUrl ?? null);
  const liveSnapshot = selectedEntry ? liveSnapshotsByEntryId[selectedEntry.id] ?? null : null;
  const voteRows = useMemo(
    () =>
      selectedEntry
        ? buildGoal3VoteRows({
            entry: selectedEntry,
            liveEntry: liveSnapshot,
          })
        : [],
    [liveSnapshot, selectedEntry],
  );

  const handleSelectEntry = (entryId: string) => {
    setSelectedEntryParam(entryId);

    if (typeof window === "undefined") {
      return;
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("entry", entryId);
    window.history.replaceState({}, "", nextUrl.toString());
  };

  useEffect(() => {
    if (
      !selectedEntry ||
      !selectedVoteRateUrl ||
      voteRows.length > 0 ||
      loadingSnapshot ||
      attemptedSnapshotEntryIds[selectedEntry.id]
    ) {
      return;
    }

    let active = true;

    const loadSnapshot = async () => {
      setLoadingSnapshot(true);
      setAttemptedSnapshotEntryIds((current) => ({
        ...current,
        [selectedEntry.id]: true,
      }));
      setActionError(null);

      try {
        const response = await syncTotoOfficialRoundListFromOfficial({
          includeMatches: true,
          sourceUrl: selectedVoteRateUrl,
        });
        const round =
          response.rounds.find((entry) => entry.outcomeSetJson?.includes("3+")) ?? null;

        if (active) {
          if (!round) {
            setActionError("GOAL3 の投票状況を解釈できませんでした。");
          } else {
            setLiveSnapshotsByEntryId((current) => ({
              ...current,
              [selectedEntry.id]: round,
            }));
          }
        }
      } catch (error) {
        if (active) {
          setActionError(errorMessage(error));
        }
      } finally {
        if (active) {
          setLoadingSnapshot(false);
        }
      }
    };

    void loadSnapshot();

    return () => {
      active = false;
    };
  }, [attemptedSnapshotEntryIds, loadingSnapshot, selectedEntry, selectedVoteRateUrl, voteRows.length]);

  if (!isSupabaseConfigured()) {
    return <ConfigurationNotice />;
  }

  const handleSync = async () => {
    setSyncing(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const syncResult = await syncTotoOfficialRoundListFromOfficial({
        includeMatches: true,
        sourceUrl: "https://toto.yahoo.co.jp/schedule/toto",
      });
      const upsert = await upsertTotoOfficialRoundLibraryFromSync({
        entries: syncResult.rounds,
        sourceUrl: syncResult.sourceUrl,
      });
      await library.refresh();
      setActionMessage(
        `GOAL3 を含む公式一覧を同期しました。追加 ${upsert.insertedCount} / 更新 ${upsert.updatedCount} / 未変更 ${upsert.skippedCount}`,
      );
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setSyncing(false);
    }
  };

  if (library.loading && !library.data) {
    return <LoadingNotice title="GOAL3ボードを読み込み中" />;
  }

  if (library.error && !library.data) {
    return <ErrorNotice error={library.error} onRetry={() => void library.refresh()} />;
  }

  const attentionCount = goal3Entries.filter((entry) => buildGoal3EventWatch(entry).requiresAttention).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="GOAL3ボード"
        title="totoGOAL3 は別ボードで見る"
        description="ラウンド作成画面には混ぜず、公式同期した GOAL3 回だけを集めて、イベント熱と 6チーム x 0/1/2/3+ の人気分布を確認します。"
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href={appRoute.dashboard} className={secondaryButtonClassName}>
              ダッシュボードへ
            </Link>
            <Link href={appRoute.totoOfficialRoundImport} className={secondaryButtonClassName}>
              公式回ライブラリ
            </Link>
            <button type="button" onClick={() => void handleSync()} className={buttonClassName} disabled={syncing}>
              {syncing ? "同期中..." : "GOAL3 を含めて同期"}
            </button>
          </div>
        }
      />

      <RouteGlossaryCard currentPath={appRoute.goal3Value} defaultOpen />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="同期済み GOAL3"
          value={goal3Entries.length}
          hint="公式一覧から拾えた GOAL3 回"
          tone="default"
        />
        <StatCard
          label="要確認イベント"
          value={attentionCount}
          hint="分岐付近かプラス圏の回"
          tone={attentionCount > 0 ? "positive" : "warning"}
        />
        <StatCard
          label="最新回"
          value={featuredEntry?.officialRoundNumber ?? "—"}
          hint={featuredEntry?.title ?? "未同期"}
          tone="draw"
        />
        <StatCard
          label="イベント期待値"
          value={
            featuredEntry
              ? formatPercent(buildGoal3EventWatch(featuredEntry).summary.approxEvMultiple)
              : "—"
          }
          hint="売上とキャリーから見たざっくり倍率"
          tone={featuredEntry && buildGoal3EventWatch(featuredEntry).requiresAttention ? "positive" : "default"}
        />
      </section>

      <SectionCard
        title="期待値ウォッチ"
        description="キャリーが大きい回を先に拾い、GOAL3 専用ページで見ます。選んだ回は URL に残るので、そのまま共有や再訪にも使えます。"
      >
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={featuredEntry && buildGoal3EventWatch(featuredEntry).requiresAttention ? "teal" : "sky"}>
                {featuredEntry && buildGoal3EventWatch(featuredEntry).requiresAttention
                  ? "期待値大"
                  : "GOAL3 ウォッチ"}
              </Badge>
              {featuredEntry ? <Badge tone="slate">第{featuredEntry.officialRoundNumber}回</Badge> : null}
            </div>
            <h3 className="mt-3 font-display text-[1.35rem] font-semibold tracking-[-0.05em] text-slate-950">
              {featuredEntry?.title ?? "まだ GOAL3 回が同期されていません"}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {featuredEntry
                ? buildGoal3EventWatch(featuredEntry).snapshot.headline
                : "Yahoo! toto 販売スケジュールに GOAL3 回が載っている時期だけ、ここへ同期して並べます。"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (featuredEntry) {
                    handleSelectEntry(featuredEntry.id);
                  }
                }}
                className={buttonClassName}
                disabled={!featuredEntry || selectedEntry?.id === featuredEntry.id}
              >
                {!featuredEntry
                  ? "GOAL3 回を待つ"
                  : selectedEntry?.id === featuredEntry.id
                    ? "この回を表示中"
                    : "この回を詳しく見る"}
              </button>
              <button type="button" onClick={() => void handleSync()} className={secondaryButtonClassName} disabled={syncing}>
                公式一覧を同期して GOAL3 を探す
              </button>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="amber">BIG ウォッチ</Badge>
              <Badge tone="slate">
                {bigOfficialWatch.data ? `公式同期 ${bigOfficialSnapshots.length}商品` : "テンプレ比較"}
              </Badge>
            </div>
            <h3 className="mt-3 font-display text-[1.35rem] font-semibold tracking-[-0.05em] text-slate-950">
              BIG の激アツ回は別監視ページ
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              BIG は公式同期ウォッチに対応済みで、同期エラーや取得失敗のときだけテンプレ条件へ切り替えて比較します。
              売上・キャリーが取れれば、高還元ウォッチとしてプラス圏かどうかをすぐ見られます。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={appRoute.bigCarryover} className={secondaryButtonClassName}>
                BIGウォッチ
              </Link>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="sky">WINNER</Badge>
              <Badge tone="slate">1試合</Badge>
            </div>
            <h3 className="mt-3 font-display text-[1.35rem] font-semibold tracking-[-0.05em] text-slate-950">
              1試合の妙味は WINNERボード
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              公式人気との差は WINNER 側のボードで見るのが自然です。GOAL3 と混ぜず、別の導線に分けています。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={buildOfficialRoundImportHref(undefined, {
                  productType: "winner",
                  sourcePreset: "toto_official_detail",
                })}
                className={secondaryButtonClassName}
              >
                WINNER を作る
              </Link>
            </div>
          </div>
        </div>
      </SectionCard>

      {actionError ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {actionError}
        </div>
      ) : null}
      {actionMessage ? (
        <div className="rounded-[24px] border border-teal-200 bg-teal-50 px-4 py-4 text-sm text-teal-900">
          {actionMessage}
        </div>
      ) : null}

      {goal3Entries.length === 0 ? (
        <SectionCard
          title="まだ GOAL3 回がありません"
          description="公式一覧を同期して、その中に GOAL3 回が載っている時だけここへ分けて表示します。"
        >
          <button type="button" onClick={() => void handleSync()} className={buttonClassName} disabled={syncing}>
            {syncing ? "同期中..." : "公式一覧を同期して GOAL3 を探す"}
          </button>
        </SectionCard>
      ) : (
        <>
          <SectionCard
            title="GOAL3 ライブラリ"
            description="ラウンド作成画面へは流さず、ここで GOAL3 回だけ選びます。"
          >
            <div className="grid gap-4 xl:grid-cols-3">
              {goal3Entries.map((entry) => {
                const watch = buildGoal3EventWatch(entry);
                const isSelected = entry.id === selectedEntry?.id;

                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => handleSelectEntry(entry.id)}
                    className={`rounded-[24px] border px-5 py-5 text-left transition ${
                      isSelected
                        ? "border-teal-300 bg-teal-50/80"
                        : "border-slate-200 bg-slate-50/90 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={watch.requiresAttention ? "teal" : "sky"}>
                        {watch.requiresAttention ? "要確認イベント" : "監視中"}
                      </Badge>
                      <Badge tone="slate">第{entry.officialRoundNumber ?? "—"}回</Badge>
                    </div>
                    <h3 className="mt-3 font-display text-[1.2rem] font-semibold tracking-[-0.05em] text-slate-950">
                      {entry.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{watch.snapshot.headline}</p>
                    <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>概算倍率 {formatPercent(watch.summary.approxEvMultiple)}</span>
                      <span>売上 {formatCurrency(entry.totalSalesYen)}</span>
                      <span>キャリー {formatCurrency(entry.carryoverYen)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {selectedEntry ? (
            <>
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="イベント期待値"
                  value={formatPercent(selectedWatch?.summary.approxEvMultiple)}
                  hint="売上とキャリーから見たざっくり倍率"
                  tone={selectedWatch?.requiresAttention ? "positive" : "default"}
                />
                <StatCard
                  label="売上"
                  value={formatCurrency(selectedEntry.totalSalesYen)}
                  hint="公式回に入っている売上"
                  tone="default"
                />
                <StatCard
                  label="キャリー"
                  value={formatCurrency(selectedEntry.carryoverYen)}
                  hint="大きい回だけ要確認イベントに寄ります"
                  tone={selectedEntry.carryoverYen > 0 ? "draw" : "warning"}
                />
                <StatCard
                  label="投票状況"
                  value={loadingSnapshot ? "取得中" : voteRows.length > 0 ? `${voteRows.length}/6` : "未取得"}
                  hint="6チーム x 0/1/2/3+"
                  tone={voteRows.length > 0 ? "positive" : "warning"}
                />
              </section>

              <SectionCard
                title={selectedEntry.title}
                description="イベント熱は回単位で、人気の偏りは 6チーム x 0/1/2/3+ で見ます。"
                actions={
                  <div className="flex flex-wrap gap-3">
                    {selectedEntry.sourceUrl ? (
                      <a href={selectedEntry.sourceUrl} target="_blank" rel="noreferrer" className={secondaryButtonClassName}>
                        公式くじ情報
                      </a>
                    ) : null}
                    {selectedVoteRateUrl ? (
                      <button
                        type="button"
                        onClick={async () => {
                          setLoadingSnapshot(true);
                          setActionError(null);

                          try {
                            const response = await syncTotoOfficialRoundListFromOfficial({
                              includeMatches: true,
                              sourceUrl: selectedVoteRateUrl,
                            });
                            const round =
                              response.rounds.find((entry) => entry.outcomeSetJson?.includes("3+")) ?? null;
                            if (!round) {
                              throw new Error("GOAL3 の投票状況を解釈できませんでした。");
                            }
                            setAttemptedSnapshotEntryIds((current) => ({
                              ...current,
                              [selectedEntry.id]: true,
                            }));
                            setLiveSnapshotsByEntryId((current) => ({
                              ...current,
                              [selectedEntry.id]: round,
                            }));
                          } catch (error) {
                            setActionError(errorMessage(error));
                          } finally {
                            setLoadingSnapshot(false);
                          }
                        }}
                        className={buttonClassName}
                        disabled={loadingSnapshot}
                      >
                        {loadingSnapshot ? "取得中..." : "投票状況を更新"}
                      </button>
                    ) : null}
                  </div>
                }
              >
                <div className="flex flex-wrap gap-2">
                  <Badge tone={selectedWatch?.requiresAttention ? "teal" : "sky"}>
                    {selectedWatch?.snapshot.statusLabel ?? "監視中"}
                  </Badge>
                  <Badge tone="slate">売上 {formatCurrency(selectedEntry.totalSalesYen)}</Badge>
                  <Badge tone="slate">キャリー {formatCurrency(selectedEntry.carryoverYen)}</Badge>
                  {selectedEntry.salesEndAt ? (
                    <Badge tone="slate">締切 {formatDateTime(selectedEntry.salesEndAt)}</Badge>
                  ) : null}
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-700">
                  {selectedWatch?.snapshot.nextAction}
                </p>

                {voteRows.length === 0 ? (
                  <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50/90 px-4 py-4 text-sm text-slate-600">
                    投票状況を取ると、6チーム x 0/1/2/3+ の人気分布と配当 proxy をここに表示します。
                  </div>
                ) : (
                  <>
                    <div className="mt-6 grid gap-4 lg:hidden">
                      {voteRows.map((row) => (
                        <div key={`goal3-row-${row.officialMatchNo}`} className="rounded-[24px] border border-slate-200 bg-slate-50/90 px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="slate">No.{row.officialMatchNo}</Badge>
                            <Badge tone={row.teamRole === "home" ? "teal" : "sky"}>
                              {row.teamRole === "home" ? "ホーム" : "アウェイ"}
                            </Badge>
                            <Badge tone="amber">{proxyOutcomeLabel(row.leanWatchOutcome)}</Badge>
                          </div>
                          <h3 className="mt-3 font-display text-[1.2rem] font-semibold tracking-[-0.05em] text-slate-950">
                            {row.teamName}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            vs {row.opponentTeam ?? "未設定"} / {formatDateTime(row.kickoffTime)} / {row.venue ?? "会場未設定"}
                          </p>
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            {(["0", "1", "2", "3+"] as Goal3OutcomeValue[]).map((outcome) => (
                              <div key={`${row.officialMatchNo}-${outcome}`} className="rounded-[18px] border border-white/80 bg-white/92 px-3 py-3 text-sm">
                                <div className="font-semibold text-slate-900">{outcome}</div>
                                <div className="mt-1 text-slate-600">人気 {formatPercent(row.votes[outcome], 1)}</div>
                                <div className="text-slate-500">proxy {formatPercent(row.payoutProxy[outcome], 0)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden lg:block">
                      <HorizontalScrollTable className="mt-4">
                        <table className="min-w-[1080px] text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="px-3 py-3">No</th>
                              <th className="px-3 py-3">team</th>
                              <th className="px-3 py-3">fixture</th>
                              <th className="px-3 py-3">kickoff / venue</th>
                              <th className="px-3 py-3">0</th>
                              <th className="px-3 py-3">1</th>
                              <th className="px-3 py-3">2</th>
                              <th className="px-3 py-3">3+</th>
                              <th className="px-3 py-3">注目</th>
                            </tr>
                          </thead>
                          <tbody>
                            {voteRows.map((row) => (
                              <tr key={`goal3-table-${row.officialMatchNo}`} className="border-b border-slate-100">
                                <td className="px-3 py-3">{row.officialMatchNo}</td>
                                <td className="px-3 py-3">
                                  <div className="font-semibold text-slate-900">{row.teamName}</div>
                                  <div className="text-xs text-slate-500">
                                    {row.teamRole === "home" ? "ホーム" : "アウェイ"}
                                  </div>
                                </td>
                                <td className="px-3 py-3">
                                  {row.opponentTeam ? `vs ${row.opponentTeam}` : "—"}
                                </td>
                                <td className="px-3 py-3 text-xs text-slate-500">
                                  {formatDateTime(row.kickoffTime)}
                                  <br />
                                  {row.venue ?? "会場未設定"}
                                </td>
                                {(["0", "1", "2", "3+"] as Goal3OutcomeValue[]).map((outcome) => (
                                  <td key={`${row.officialMatchNo}-${outcome}`} className="px-3 py-3">
                                    <div className="font-medium text-slate-900">{formatPercent(row.votes[outcome], 1)}</div>
                                    <div className="text-xs text-slate-500">proxy {formatPercent(row.payoutProxy[outcome], 0)}</div>
                                  </td>
                                ))}
                                <td className="px-3 py-3">
                                  <Badge tone="amber">{proxyOutcomeLabel(row.leanWatchOutcome)}</Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </HorizontalScrollTable>
                    </div>
                  </>
                )}
              </SectionCard>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
