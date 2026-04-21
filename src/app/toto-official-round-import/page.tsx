"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { RoundContextCard } from "@/components/app/round-context-card";
import {
  ConfigurationNotice,
  ErrorNotice,
  LoadingNotice,
} from "@/components/app/states";
import {
  Badge,
  buttonClassName,
  CollapsibleSectionCard,
  fieldClassName,
  HorizontalScrollTable,
  PageHeader,
  SectionCard,
  secondaryButtonClassName,
  textAreaClassName,
} from "@/components/ui";
import { formatCurrency, formatDateTime, formatPercent, productTypeLabel } from "@/lib/domain";
import { productTypeOptions } from "@/lib/product-rules";
import { appRoute, buildRoundHref, getSingleSearchParam } from "@/lib/round-links";
import {
  instantiateTotoOfficialRoundLibraryEntry,
  listTotoOfficialRoundLibrary as loadTotoOfficialRoundLibraryEntries,
  syncTotoOfficialRoundListFromOfficial,
  refreshCandidateTicketsForRound,
  saveTotoOfficialRoundImport,
  saveTotoOfficialRoundLibraryEntry,
  upsertTotoOfficialRoundLibraryFromSync,
} from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  matchOfficialRowsToFixtures,
  parseTotoOfficialRoundCsv,
  type TotoOfficialImportRow,
} from "@/lib/toto-official-import";
import { useFixtureMaster, useTotoOfficialRoundLibrary } from "@/lib/use-app-data";
import type { ProductType, TotoOfficialRoundLibraryEntry } from "@/lib/types";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "不明なエラーです。";
}

const csvSample = [
  "official_match_no,home_team,away_team,kickoff_time,venue,stage,official_vote_1,official_vote_0,official_vote_2",
  "1,Mexico,South Africa,2026-06-11 19:00,Mexico City Stadium,Group A,0.58,0.24,0.18",
  "2,Korea Republic,Czechia,2026-06-11 22:00,Estadio Guadalajara,Group A,32,28,40",
].join("\n");

const officialSourcePresets = [
  {
    blurb: "開催回一覧から公式くじ情報ページを辿って、販売中 / これからの回をライブラリへ同期します。おすすめです。",
    id: "yahoo_toto_schedule",
    label: "Yahoo! toto 販売スケジュール",
    sourceUrl: "https://toto.yahoo.co.jp/schedule/toto",
  },
  {
    blurb: "1回分の公式詳細ページを直接読む補助用です。個別の holdCntId URL を入れたいときに使います。",
    id: "toto_official_detail",
    label: "スポーツくじオフィシャル くじ情報URL",
    sourceUrl:
      "https://store.toto-dream.com/dcs/subos/screen/pi01/spin000/PGSPIN00001DisptotoLotInfo.form?holdCntId=1624",
  },
] as const;

const officialProductFocusCards: Array<{
  badgeTone: "sky" | "teal";
  body: string;
  productType: ProductType;
  title: string;
}> = [
  {
    badgeTone: "teal",
    body: "13試合の本命導線です。公式回を選んで、そのまま Candidate Cards と Friend Pick Room まで進めます。",
    productType: "toto13",
    title: "toto を選ぶ",
  },
  {
    badgeTone: "sky",
    body: "5試合で軽く回せるので、友人会の試運転や短時間の投票会に向いています。",
    productType: "mini_toto",
    title: "mini toto を選ぶ",
  },
];

function resolveOfficialSourcePreset(id: string | null) {
  return officialSourcePresets.find((preset) => preset.id === id) ?? null;
}

function hostLabel(url: string | null) {
  if (!url) {
    return "未設定";
  }

  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function buildSourceText(rows: Array<{
  awayTeam: string;
  homeTeam: string;
  kickoffTime: string | null;
  officialMatchNo: number;
  officialVote0: number | null;
  officialVote1: number | null;
  officialVote2: number | null;
  stage: string | null;
  venue: string | null;
}>) {
  return [
    "official_match_no,home_team,away_team,kickoff_time,venue,stage,official_vote_1,official_vote_0,official_vote_2",
    ...rows.map((row) =>
      [
        row.officialMatchNo,
        row.homeTeam,
        row.awayTeam,
        row.kickoffTime ?? "",
        row.venue ?? "",
        row.stage ?? "",
        row.officialVote1 ?? "",
        row.officialVote0 ?? "",
        row.officialVote2 ?? "",
      ].join(","),
    ),
  ].join("\n");
}

function hydrateRowsFromLibraryEntry(
  entry: TotoOfficialRoundLibraryEntry,
  fixtures: ReturnType<typeof useFixtureMaster>["data"],
) {
  return matchOfficialRowsToFixtures(
    entry.matches.map((row) => ({
      ...row,
      fixtureCandidates: [],
      warnings: [],
    })),
    fixtures ?? [],
  );
}

function TotoOfficialRoundImportPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const sourcePresetId = getSingleSearchParam(searchParams.get("sourcePreset"));
  const autoSyncRequested = getSingleSearchParam(searchParams.get("autoSync")) === "1";
  const requestedProductType = (() => {
    const raw = getSingleSearchParam(searchParams.get("productType"));
    return productTypeOptions.includes((raw ?? "") as ProductType)
      ? ((raw ?? "toto13") as ProductType)
      : "toto13";
  })();
  const initialSourcePreset = resolveOfficialSourcePreset(sourcePresetId);
  const [title, setTitle] = useState("toto公式対象回");
  const [productType, setProductType] = useState<ProductType>(requestedProductType);
  const [officialRoundName, setOfficialRoundName] = useState("");
  const [officialRoundNumber, setOfficialRoundNumber] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [stakeYen, setStakeYen] = useState("100");
  const [totalSalesYen, setTotalSalesYen] = useState("");
  const [carryoverYen, setCarryoverYen] = useState("0");
  const [syncSourceUrl, setSyncSourceUrl] = useState<string>(
    initialSourcePreset?.sourceUrl ?? "https://toto.yahoo.co.jp/schedule/toto",
  );
  const [includeMatchesInSync, setIncludeMatchesInSync] = useState(true);
  const [autoApplyAfterSync, setAutoApplyAfterSync] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState<{
    fetchedAt: string | null;
    insertedCount: number;
    updatedCount: number;
    skippedCount: number;
    warnings: string[];
  } | null>(null);
  const [syncWarnings, setSyncWarnings] = useState<string[]>([]);
  const [rows, setRows] = useState<TotoOfficialImportRow[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingLibraryEntryId, setEditingLibraryEntryId] = useState<string | null>(null);
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");
  const [libraryProductType, setLibraryProductType] = useState<"all" | ProductType>(
    requestedProductType,
  );
  const [libraryBusyId, setLibraryBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [savedRoundId, setSavedRoundId] = useState<string | null>(roundId);
  const autoSyncTriggeredRef = useRef(false);
  const fixtures = useFixtureMaster({ competition: "fifa_world_cup_2026" });
  const library = useTotoOfficialRoundLibrary({
    productType: libraryProductType === "all" ? null : libraryProductType,
    searchQuery: librarySearchQuery,
  });
  const roundContextId = savedRoundId ?? roundId;
  const roundDetailHref = roundContextId
    ? buildRoundHref(appRoute.workspace, roundContextId)
    : null;
  const filterLabel =
    libraryProductType === "all" ? "すべて" : productTypeLabel[libraryProductType];

  const parsedPreview = useMemo(
    () =>
      parseTotoOfficialRoundCsv({
        fixtures: fixtures.data ?? undefined,
        sourceText,
      }),
    [fixtures.data, sourceText],
  );

  const handleParse = () => {
    setRows(parsedPreview.rows);
    setParseWarnings([
      ...parsedPreview.warnings,
      ...parsedPreview.rows.flatMap((row) => row.warnings),
    ]);
    setActionError(null);
    setActionMessage(null);
  };

  const hydrateFromLibraryEntry = (entry: TotoOfficialRoundLibraryEntry) => {
    const matchedRows = hydrateRowsFromLibraryEntry(entry, fixtures.data);

    setEditingLibraryEntryId(entry.id);
    setTitle(entry.title);
    setProductType(entry.productType);
    setOfficialRoundName(entry.officialRoundName ?? entry.sourceNote ?? entry.title);
    setOfficialRoundNumber(entry.officialRoundNumber?.toString() ?? "");
    setSourceUrl(entry.sourceUrl ?? "");
    setSourceText(entry.sourceText ?? buildSourceText(entry.matches));
    setStakeYen(String(entry.stakeYen ?? 100));
    setTotalSalesYen(entry.totalSalesYen?.toString() ?? "");
    setCarryoverYen(String(entry.carryoverYen ?? 0));
    setRows(matchedRows);
    setParseWarnings(matchedRows.flatMap((row) => row.warnings));
    setActionError(null);
    setActionMessage(`「${entry.title}」を編集フォームに読み込みました。`);
  };

  const handleUseLibraryEntry = async (
    entry: TotoOfficialRoundLibraryEntry,
    mode: "apply" | "load",
  ) => {
    if (mode === "load") {
      hydrateFromLibraryEntry(entry);
      return;
    }

    setLibraryBusyId(entry.id);
    setActionError(null);
    setActionMessage(null);

    try {
      const nextRoundId = await instantiateTotoOfficialRoundLibraryEntry({
        entryId: entry.id,
        roundId,
        status: "analyzing",
        title: entry.title,
      });
      await refreshCandidateTicketsForRound({
        force: true,
        roundId: nextRoundId,
      });
      setSavedRoundId(nextRoundId);
      router.push(buildRoundHref(appRoute.pickRoom, nextRoundId));
    } catch (nextError) {
      setActionError(errorMessage(nextError));
    } finally {
      setLibraryBusyId(null);
    }
  };

  const handleSyncOfficialRounds = async (options?: { autoApplyToPickRoom?: boolean }) => {
    const shouldAutoApply = options?.autoApplyToPickRoom ?? autoApplyAfterSync;
    setSyncing(true);
    setLibraryBusyId(shouldAutoApply ? "sync-auto" : null);
    setActionError(null);
    setActionMessage(null);
    setSyncWarnings([]);
    setSyncSummary(null);

    try {
      const syncResult = await syncTotoOfficialRoundListFromOfficial({
        includeMatches: includeMatchesInSync,
        sourceUrl: syncSourceUrl || undefined,
      });
      const upsertResult = await upsertTotoOfficialRoundLibraryFromSync({
        entries: syncResult.rounds,
        sourceUrl: syncResult.sourceUrl || syncSourceUrl || null,
      });

      const combinedWarnings = [...syncResult.warnings, ...upsertResult.warnings];
      setSyncSummary({
        fetchedAt: syncResult.fetchedAt,
        insertedCount: upsertResult.insertedCount,
        updatedCount: upsertResult.updatedCount,
        skippedCount: upsertResult.skippedCount,
        warnings: combinedWarnings,
      });
      setSyncWarnings(combinedWarnings);
      await library.refresh();
      if (shouldAutoApply) {
        const syncedEntries = await loadTotoOfficialRoundLibraryEntries({
          productType: libraryProductType === "all" ? null : libraryProductType,
          searchQuery: librarySearchQuery,
        });
        const latestEntry = syncedEntries[0] ?? null;

        if (!latestEntry) {
          throw new Error("同期結果を Pick Room に反映するための公式回がありませんでした。");
        }

        setActionMessage(
          `公式一覧を同期しました。最新の「${latestEntry.title}」で Pick Room を開きます。`,
        );
        await handleUseLibraryEntry(latestEntry, "apply");
        return;
      }
      setActionMessage(
        `公式一覧を反映しました。追加 ${upsertResult.insertedCount} / 更新 ${upsertResult.updatedCount} / 未変更 ${upsertResult.skippedCount}`,
      );
    } catch (nextError) {
      setActionError(errorMessage(nextError));
    } finally {
      setLibraryBusyId(null);
      setSyncing(false);
    }
  };

  const runAutoSync = useEffectEvent(() => {
    void handleSyncOfficialRounds();
  });

  useEffect(() => {
    if (!autoSyncRequested || autoSyncTriggeredRef.current || syncing) {
      return;
    }

    autoSyncTriggeredRef.current = true;
    runAutoSync();
  }, [autoSyncRequested, syncing]);

  if (!isSupabaseConfigured()) {
    return <ConfigurationNotice />;
  }

  if (fixtures.error) {
    return <ErrorNotice error={fixtures.error} onRetry={() => void fixtures.refresh()} />;
  }

  const handleSave = async () => {
    setSaving(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const payload = {
        carryoverYen: Number(carryoverYen || 0),
        firstPrizeShare: 0.7,
        notes: null,
        officialRoundName: officialRoundName || null,
        officialRoundNumber: officialRoundNumber ? Number(officialRoundNumber) : null,
        payoutCapYen: null,
        productType,
        resultStatus: "selling",
        returnRate: 0.5,
        roundId,
        rows: rows.map((row) => ({
          actualResult: row.actualResult,
          awayTeam: row.awayTeam,
          fixtureMasterId: row.fixtureMasterId,
          homeTeam: row.homeTeam,
          kickoffTime: row.kickoffTime,
          matchStatus: row.matchStatus,
          officialMatchNo: row.officialMatchNo,
          officialVote0: row.officialVote0,
          officialVote1: row.officialVote1,
          officialVote2: row.officialVote2,
          sourceText: row.sourceText,
          stage: row.stage,
          venue: row.venue,
        })),
        salesEndAt: null,
        salesStartAt: null,
        sourceText,
        sourceUrl: sourceUrl || null,
        stakeYen: Number(stakeYen || 100),
        status: "analyzing",
        title,
        totalSalesYen: totalSalesYen ? Number(totalSalesYen) : null,
      } as const;
      const savedLibraryEntry = await saveTotoOfficialRoundLibraryEntry({
        id: editingLibraryEntryId,
        ...payload,
      });
      const nextRoundId = await saveTotoOfficialRoundImport(payload);
      await refreshCandidateTicketsForRound({
        force: true,
        roundId: nextRoundId,
      });
      await library.refresh();
      setEditingLibraryEntryId(savedLibraryEntry.id);
      setSavedRoundId(nextRoundId);
      setActionMessage("公式回ライブラリと Round を更新しました。");
    } catch (nextError) {
      setActionError(errorMessage(nextError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Toto Official Round Import"
        description="公式ソースから開催回を同期して一覧から選ぶか、CSV / TSV で足りない回だけ追加して Round に反映します。"
        actions={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setEditingLibraryEntryId(null);
                setActionMessage(null);
                setSourceText(csvSample);
              }}
              className={secondaryButtonClassName}
            >
              サンプルCSV
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingLibraryEntryId(null);
                setActionMessage("次の保存は新規ライブラリとして扱います。");
              }}
              className={secondaryButtonClassName}
            >
              新規ライブラリとして入力
            </button>
            {roundDetailHref ? (
              <Link href={roundDetailHref} className={secondaryButtonClassName}>
                Round Detailへ戻る
              </Link>
            ) : null}
            {savedRoundId ? (
              <Link href={buildRoundHref(appRoute.workspace, savedRoundId)} className={secondaryButtonClassName}>
                Round を開く
              </Link>
            ) : null}
            {savedRoundId ? (
              <Link href={buildRoundHref(appRoute.pickRoom, savedRoundId)} className={buttonClassName}>
                Friend Pick Room
              </Link>
            ) : null}
          </div>
        }
      />

      <RoundContextCard
        roundId={roundContextId}
        backHref={roundDetailHref}
        description="この取り込みが、どの Round の公式対象回データとして使われるかを先に確認できます。"
      />

      <SectionCard
        title="おすすめ導線"
        description="まずは toto か mini toto のどちらで回すか決めて、その商品だけ一覧を見にいくのが最短です。"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {officialProductFocusCards.map((card) => {
            const isActive = libraryProductType === card.productType && productType === card.productType;

            return (
              <div
                key={card.productType}
                className={`rounded-[24px] border px-5 py-5 ${
                  isActive ? "border-teal-300 bg-teal-50/80" : "border-slate-200 bg-slate-50/90"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={card.badgeTone}>{productTypeLabel[card.productType]}</Badge>
                  {isActive ? <Badge tone="slate">現在の表示</Badge> : null}
                </div>
                <h3 className="mt-3 font-semibold text-slate-950">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setProductType(card.productType);
                      setLibraryProductType(card.productType);
                      setEditingLibraryEntryId(null);
                      setActionMessage(`${productTypeLabel[card.productType]} の一覧に切り替えました。`);
                    }}
                    className={buttonClassName}
                  >
                    この商品で一覧を見る
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {actionMessage ? (
        <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
          {actionMessage}
        </div>
      ) : null}
      {actionError ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {actionError}
        </div>
      ) : null}

      <SectionCard
        title="公式一覧を同期"
        description="おすすめは Yahoo! toto 販売スケジュールです。開催回一覧から公式くじ情報ページを辿って、Round Builder で選べるライブラリを更新します。"
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {officialSourcePresets.map((preset) => {
            const isActive = syncSourceUrl === preset.sourceUrl;

            return (
              <div
                key={preset.id}
                className={`rounded-[24px] border px-4 py-4 ${isActive ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-slate-50/90"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={preset.id === "yahoo_toto_schedule" ? "teal" : "slate"}>
                    {preset.id === "yahoo_toto_schedule" ? "おすすめ" : "補助"}
                  </Badge>
                  <span className="font-semibold text-slate-950">{preset.label}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{preset.blurb}</p>
                <p className="mt-3 break-all text-xs leading-5 text-slate-500">{preset.sourceUrl}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSyncSourceUrl(preset.sourceUrl);
                      setActionMessage(`同期元を「${preset.label}」に切り替えました。`);
                    }}
                    className={secondaryButtonClassName}
                  >
                    このソースを使う
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSyncSourceUrl(preset.sourceUrl);
                      void handleSyncOfficialRounds();
                    }}
                    className={buttonClassName}
                    disabled={syncing}
                  >
                    {syncing && isActive ? "同期中..." : "このソースで同期"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">sourceUrl</span>
            <input
              value={syncSourceUrl}
              onChange={(event) => setSyncSourceUrl(event.currentTarget.value)}
              className={fieldClassName}
              placeholder="https://..."
            />
          </label>
          <label className="flex items-center justify-start gap-2 text-sm pt-7">
            <input
              type="checkbox"
              checked={includeMatchesInSync}
              onChange={(event) => setIncludeMatchesInSync(event.currentTarget.checked)}
              className="h-4 w-4"
            />
            <span>試合明細まで取り込む</span>
          </label>
          <div className="pt-7">
            <button
              type="button"
              onClick={() => void handleSyncOfficialRounds()}
              className={buttonClassName}
              disabled={syncing}
            >
              {syncing ? "同期中..." : "公式一覧を同期"}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <label className="flex items-center gap-2 rounded-3xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={autoApplyAfterSync}
              onChange={(event) => setAutoApplyAfterSync(event.currentTarget.checked)}
              className="h-4 w-4"
            />
            <span>保存後に最新1件をそのまま Pick Room を開く</span>
          </label>
          <button
            type="button"
            onClick={() => void handleSyncOfficialRounds({ autoApplyToPickRoom: true })}
            className={buttonClassName}
            disabled={syncing}
          >
            {syncing ? "同期しつつ反映中..." : "公式一覧を同期してPick Roomへ"}
          </button>
        </div>

        {autoApplyAfterSync ? (
          <p className="mt-3 rounded-[20px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs leading-6 text-emerald-950">
            「保存後に最新1件をそのまま Pick Room 開く」をONにすると、通常の `公式一覧を同期` でも同期した最新回をそのまま反映して Pick Room まで進みます。
          </p>
        ) : null}

        {syncSummary ? (
          <div className="mt-4 rounded-[22px] border border-teal-200 bg-teal-50 px-4 py-4 text-sm text-teal-950">
            <p>
              同期結果: 追加 {syncSummary.insertedCount} / 更新 {syncSummary.updatedCount} / 未変更{" "}
              {syncSummary.skippedCount}
            </p>
            {syncSummary.fetchedAt ? <p>取得時刻: {syncSummary.fetchedAt}</p> : null}
            <p>
              対象件数: {syncSummary.insertedCount + syncSummary.updatedCount + syncSummary.skippedCount}
            </p>
          </div>
        ) : null}

        {syncWarnings.length > 0 ? (
          <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
            {syncWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="公式回ライブラリ"
        description={
          roundId
            ? `同期済みの ${filterLabel} から、この Round にそのまま反映して Pick Room まで進めます。`
            : `同期済みの ${filterLabel} から、新しい Round を作ってそのまま Pick Room へ進めます。`
        }
      >
        <div className="grid gap-4 lg:grid-cols-[0.8fr_0.35fr]">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">検索</span>
            <input
              value={librarySearchQuery}
              onChange={(event) => setLibrarySearchQuery(event.currentTarget.value)}
              className={fieldClassName}
              placeholder="回名 / source / URL で検索"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">productType</span>
            <select
              value={libraryProductType}
              onChange={(event) =>
                setLibraryProductType(event.currentTarget.value as "all" | ProductType)
              }
              className={fieldClassName}
            >
              <option value="all">すべて</option>
              {productTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {productTypeLabel[option]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {library.error ? (
          <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            一覧の読み込みに失敗しました: {library.error}
          </div>
        ) : library.loading && !library.data ? (
          <LoadingNotice title="公式回ライブラリを読み込み中" />
        ) : (library.data?.length ?? 0) === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/90 px-5 py-5 text-sm leading-7 text-slate-600">
            {filterLabel} の保存済み公式回がまだありません。まず上の `公式一覧を同期` でソースサイトから取り込むのがおすすめです。未取得の回だけ、下の CSV / TSV で補完できます。
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {library.data?.map((entry) => {
              const isBusy = libraryBusyId === entry.id;
              const kickoff = entry.matches.find((match) => match.kickoffTime)?.kickoffTime ?? null;

              return (
                <div
                  key={entry.id}
                  className="rounded-[26px] border border-slate-200 bg-white/90 p-5 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.35)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="teal">{productTypeLabel[entry.productType]}</Badge>
                        <Badge tone="slate">{entry.matchCount}試合</Badge>
                        {entry.officialRoundNumber !== null ? (
                          <Badge tone="sky">第{entry.officialRoundNumber}回</Badge>
                        ) : null}
                        {entry.resultStatus === "selling" ? <Badge tone="positive">販売中</Badge> : null}
                        {entry.resultStatus === "draft" ? <Badge tone="amber">これから</Badge> : null}
                        {entry.resultStatus === "closed" ? <Badge tone="slate">終了</Badge> : null}
                      </div>
                      <h3 className="mt-3 font-semibold text-slate-950">{entry.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {entry.sourceNote ?? entry.notes ?? "toto公式から取り込んだ再利用用の公式回です。"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <div>開始目安: {kickoff ? formatDateTime(kickoff) : "未設定"}</div>
                    <div>販売終了: {entry.salesEndAt ? formatDateTime(entry.salesEndAt) : "未設定"}</div>
                    <div>売上想定: {formatCurrency(entry.totalSalesYen)}</div>
                    <div>ソース: {hostLabel(entry.sourceUrl)}</div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleUseLibraryEntry(entry, "apply")}
                      className={buttonClassName}
                      disabled={Boolean(libraryBusyId)}
                    >
                      {isBusy
                        ? "反映中..."
                        : roundId
                          ? "このRoundに反映してPick Roomへ"
                          : "この回でPick Roomを開く"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleUseLibraryEntry(entry, "load")}
                      className={secondaryButtonClassName}
                      disabled={Boolean(libraryBusyId)}
                    >
                      {isBusy ? "読込中..." : "編集に読み込む"}
                    </button>
                    {entry.sourceUrl ? (
                      <a
                        href={entry.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={secondaryButtonClassName}
                      >
                        公式ページ
                      </a>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>回名 {entry.officialRoundName ?? "未設定"}</span>
                    <span>払戻率 {formatPercent(entry.returnRate, 0)}</span>
                    <span>キャリー {formatCurrency(entry.carryoverYen)}</span>
                    <span>更新 {formatDateTime(entry.updatedAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <CollapsibleSectionCard
        title="実データ1回分ならこの順です"
        description="1. ライブラリ一覧から 1クリック反映  2. まだない回だけ CSV / TSV で追加、の順で使うのがいちばん速いです。"
        defaultOpen={!sourceText.trim() && rows.length === 0}
        badge={<Badge tone="sky">はじめに</Badge>}
      >
        <div className="grid gap-3 md:grid-cols-3">
          {[
            [
              "1",
              "リストから 1 クリック適用",
              "保存済みの公式回があれば、そのまま今の Round か新規 Round に反映して Pick Room まで進めます。",
            ],
            [
              "2",
              "まだない回だけ CSV を貼る",
              "match no と vote 1/0/2 が入った表を貼れば大丈夫です。52 や 52% も受け付けます。",
            ],
            [
              "3",
              "ライブラリ保存と Round 反映",
              "手入力した回も保存時にライブラリへ残るので、次回からは一覧から 1クリックで使い回せます。",
            ],
          ].map(([step, title, body]) => (
            <div
              key={step}
              className="rounded-[22px] border border-slate-200 bg-slate-50/90 px-4 py-4"
            >
              <Badge tone="slate">Step {step}</Badge>
              <p className="mt-3 font-semibold text-slate-950">{title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </CollapsibleSectionCard>

      <SectionCard title="Round Meta" description="round-level の公式情報を先に入れます。">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            className={fieldClassName}
            placeholder="title"
          />
          <select
            value={productType}
            onChange={(event) => setProductType(event.currentTarget.value as ProductType)}
            className={fieldClassName}
          >
            {productTypeOptions.map((option) => (
              <option key={option} value={option}>
                {productTypeLabel[option]}
              </option>
            ))}
          </select>
          <input
            value={officialRoundName}
            onChange={(event) => setOfficialRoundName(event.currentTarget.value)}
            className={fieldClassName}
            placeholder="official round name"
          />
          <input
            value={officialRoundNumber}
            onChange={(event) => setOfficialRoundNumber(event.currentTarget.value)}
            className={fieldClassName}
            placeholder="official round no"
          />
          <input
            value={stakeYen}
            onChange={(event) => setStakeYen(event.currentTarget.value)}
            className={fieldClassName}
            placeholder="stakeYen"
          />
          <input
            value={totalSalesYen}
            onChange={(event) => setTotalSalesYen(event.currentTarget.value)}
            className={fieldClassName}
            placeholder="totalSalesYen"
          />
          <input
            value={carryoverYen}
            onChange={(event) => setCarryoverYen(event.currentTarget.value)}
            className={fieldClassName}
            placeholder="carryoverYen"
          />
          <input
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.currentTarget.value)}
            className={fieldClassName}
            placeholder="sourceUrl"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="CSV / TSV"
        description="official_match_no, home_team, away_team, kickoff_time, venue, stage, official_vote_1, official_vote_0, official_vote_2 の順を基本にします。"
        actions={
          <button type="button" onClick={handleParse} className={buttonClassName}>
            Parse Preview
          </button>
        }
      >
        <textarea
          value={sourceText}
          onChange={(event) => setSourceText(event.currentTarget.value)}
          className={textAreaClassName}
          placeholder="official_match_no,home_team,away_team..."
        />
      </SectionCard>

      <SectionCard
        title="Preview"
        description={`抽出 ${rows.length} 件。fixture master 候補も併記します。`}
        actions={
          <button
            type="button"
            onClick={() => void handleSave()}
            className={buttonClassName}
            disabled={saving || rows.length === 0}
          >
            {saving
              ? "保存中..."
              : editingLibraryEntryId
                ? "一覧を更新してRound反映"
                : "一覧に保存してRound反映"}
          </button>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Badge tone="slate">rows {rows.length}</Badge>
          {roundId ? <Badge tone="warning">既存Roundを上書き</Badge> : <Badge tone="teal">新規Round作成</Badge>}
          {editingLibraryEntryId ? <Badge tone="info">既存ライブラリを更新</Badge> : <Badge tone="sky">新規ライブラリ追加</Badge>}
        </div>

        {parseWarnings.length > 0 ? (
          <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
            {parseWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
        {actionError ? (
          <div className="mt-4 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            {actionError}
          </div>
        ) : null}

        <HorizontalScrollTable className="mt-4">
          <table className="min-w-[1380px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-3 py-3">no</th>
                <th className="px-3 py-3">fixture</th>
                <th className="px-3 py-3">kickoff</th>
                <th className="px-3 py-3">stage</th>
                <th className="px-3 py-3">vote1/0/2</th>
                <th className="px-3 py-3">fixture match</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.officialMatchNo}-${index}`} className="border-b border-slate-100">
                  <td className="px-3 py-3">{row.officialMatchNo}</td>
                  <td className="px-3 py-3">
                    <div className="space-y-2">
                      <input
                        value={row.homeTeam}
                        onChange={(event) =>
                          setRows((current) =>
                            current.map((entry, currentIndex) =>
                              currentIndex === index ? { ...entry, homeTeam: event.currentTarget.value } : entry,
                            ),
                          )
                        }
                        className={fieldClassName}
                      />
                      <input
                        value={row.awayTeam}
                        onChange={(event) =>
                          setRows((current) =>
                            current.map((entry, currentIndex) =>
                              currentIndex === index ? { ...entry, awayTeam: event.currentTarget.value } : entry,
                            ),
                          )
                        }
                        className={fieldClassName}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <input
                      value={row.kickoffTime ?? ""}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((entry, currentIndex) =>
                            currentIndex === index
                              ? { ...entry, kickoffTime: event.currentTarget.value || null }
                              : entry,
                          ),
                        )
                      }
                      className={fieldClassName}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      value={row.stage ?? ""}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((entry, currentIndex) =>
                            currentIndex === index ? { ...entry, stage: event.currentTarget.value || null } : entry,
                          ),
                        )
                      }
                      className={fieldClassName}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="space-y-2">
                      <input
                        value={row.officialVote1 ?? ""}
                        onChange={(event) =>
                          setRows((current) =>
                            current.map((entry, currentIndex) =>
                              currentIndex === index
                                ? { ...entry, officialVote1: event.currentTarget.value ? Number(event.currentTarget.value) : null }
                                : entry,
                            ),
                          )
                        }
                        className={fieldClassName}
                      />
                      <input
                        value={row.officialVote0 ?? ""}
                        onChange={(event) =>
                          setRows((current) =>
                            current.map((entry, currentIndex) =>
                              currentIndex === index
                                ? { ...entry, officialVote0: event.currentTarget.value ? Number(event.currentTarget.value) : null }
                                : entry,
                            ),
                          )
                        }
                        className={fieldClassName}
                      />
                      <input
                        value={row.officialVote2 ?? ""}
                        onChange={(event) =>
                          setRows((current) =>
                            current.map((entry, currentIndex) =>
                              currentIndex === index
                                ? { ...entry, officialVote2: event.currentTarget.value ? Number(event.currentTarget.value) : null }
                                : entry,
                            ),
                          )
                        }
                        className={fieldClassName}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={row.fixtureMasterId ?? ""}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((entry, currentIndex) =>
                            currentIndex === index
                              ? { ...entry, fixtureMasterId: event.currentTarget.value || null }
                              : entry,
                          ),
                        )
                      }
                      className={fieldClassName}
                    >
                      <option value="">未選択</option>
                      {row.fixtureCandidates.map((fixture) => (
                        <option key={fixture.id} value={fixture.id}>
                          {fixture.matchDate ?? "—"} {fixture.homeTeam} vs {fixture.awayTeam}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </HorizontalScrollTable>
      </SectionCard>
    </div>
  );
}

export default function TotoOfficialRoundImportPage() {
  return (
    <Suspense fallback={<LoadingNotice title="Toto Official Round Import を準備中" />}>
      <TotoOfficialRoundImportPageContent />
    </Suspense>
  );
}
