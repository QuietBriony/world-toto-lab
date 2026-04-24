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
import {
  formatCurrency,
  formatDateTime,
  formatPercent,
  productTypeBadgeTone,
  productTypeLabel,
} from "@/lib/domain";
import { productTypeOptions } from "@/lib/product-rules";
import { appRoute, buildRoundHref, getSingleSearchParam } from "@/lib/round-links";
import {
  estimateRoundAiModel,
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
  normalizeVote,
  parseTotoOfficialRoundCsv,
  type TotoOfficialImportRow,
} from "@/lib/toto-official-import";
import { useFixtureMaster, useTotoOfficialRoundLibrary } from "@/lib/use-app-data";
import { isLikelyWorldTotoLibraryEntry, looksLikeWorldTotoText } from "@/lib/world-toto";
import type { ProductType, TotoOfficialRoundLibraryEntry } from "@/lib/types";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "不明なエラーです。";
}

function dedupeWarnings(warnings: Array<string | null | undefined>) {
  return Array.from(new Set(warnings.filter((warning): warning is string => Boolean(warning))));
}

function normalizeEditableVoteValue(value: number | null) {
  if (value === null) {
    return null;
  }

  return normalizeVote(String(value)).normalized;
}

function collectRowWarnings(rows: TotoOfficialImportRow[]) {
  return dedupeWarnings(
    rows.flatMap((row) => {
      const warnings = [...row.warnings];
      const total =
        (normalizeEditableVoteValue(row.officialVote1) ?? 0) +
        (normalizeEditableVoteValue(row.officialVote0) ?? 0) +
        (normalizeEditableVoteValue(row.officialVote2) ?? 0);

      if (total > 0 && Math.abs(total - 1) > 0.04) {
        warnings.push(
          `No.${row.officialMatchNo} の公式投票率1/0/2の合計が1から大きくズレています。`,
        );
      }

      return warnings;
    }),
  );
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
    blurb:
      "1回分の公式詳細ページを直接読む補助用です。個別の holdCntId URL を入れたいときや、WINNER を直接読みたいときに使います。",
    id: "toto_official_detail",
    label: "スポーツくじオフィシャル くじ情報URL",
    sourceUrl:
      "https://store.toto-dream.com/dcs/subos/screen/pi01/spin000/PGSPIN00001DisptotoLotInfo.form?holdCntId=1624",
  },
] as const;

const defaultOfficialDetailSourceUrl =
  officialSourcePresets.find((preset) => preset.id === "toto_official_detail")?.sourceUrl ?? "";

const officialProductFocusCards: Array<{
  badgeLabel?: string;
  badgeTone: "amber" | "sky" | "teal";
  body: string;
  productType: ProductType;
  recommendedSourcePresetId?: (typeof officialSourcePresets)[number]["id"];
  title: string;
}> = [
  {
    badgeTone: "teal",
    body: "13試合の本命導線です。公式回を選んで、そのままRoundを作る流れに向いています。",
    productType: "toto13",
    title: "toto を選ぶ",
  },
  {
    badgeTone: "sky",
    body: "5試合で軽く回せるので、友人会の試運転や短時間の投票会に向いています。",
    productType: "mini_toto",
    title: "mini toto を選ぶ",
  },
  {
    badgeTone: "amber",
    body: "1試合商品です。開催一覧より、公式くじ情報URLを直接読ませる方が安定します。WINNERボードと併用すると流れがきれいです。",
    productType: "winner",
    recommendedSourcePresetId: "toto_official_detail",
    title: "WINNER を選ぶ",
  },
  {
    badgeLabel: "GOAL3",
    badgeTone: "amber",
    body: "ラウンド作成画面には混ぜず、公式一覧から拾えた GOAL3 回だけを別ボードと専用ライブラリで見ます。",
    productType: "custom",
    title: "GOAL3 を見る",
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

function isWorldTotoEntry(
  entry: Pick<
    TotoOfficialRoundLibraryEntry,
    "matchCount" | "matches" | "officialRoundName" | "productType" | "sourceNote" | "sourceText" | "title"
  >,
) {
  return isLikelyWorldTotoLibraryEntry(entry as TotoOfficialRoundLibraryEntry);
}

function libraryEntryProductDisplay(entry: TotoOfficialRoundLibraryEntry) {
  if (entry.outcomeSetJson?.includes("3+")) {
    return { label: "GOAL3", tone: "amber" as const };
  }

  if (isWorldTotoEntry(entry)) {
    return { label: "World Toto", tone: "teal" as const };
  }

  return {
    label: productTypeLabel[entry.productType],
    tone: productTypeBadgeTone[entry.productType],
  };
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
  const autoApplyRequested = getSingleSearchParam(searchParams.get("autoApply")) === "1";
  const sourcePresetId = getSingleSearchParam(searchParams.get("sourcePreset"));
  const autoSyncRequested = getSingleSearchParam(searchParams.get("autoSync")) === "1";
  const startMode = getSingleSearchParam(searchParams.get("start"));
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
  const [autoApplyAfterSync, setAutoApplyAfterSync] = useState(autoApplyRequested);
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
  const manualEntryHref = `${buildRoundHref(appRoute.totoOfficialRoundImport, roundId, {
    productType,
    start: "manual",
  })}#manual-entry`;
  const filterLabel =
    libraryProductType === "all"
      ? "すべて"
      : libraryProductType === "custom"
        ? "GOAL3 / カスタム"
        : productTypeLabel[libraryProductType];
  const manualEntryOpen = Boolean(
    startMode === "csv" ||
      startMode === "manual" ||
      editingLibraryEntryId ||
      sourceText.trim() ||
      rows.length > 0,
  );
  const activeSyncPreset =
    officialSourcePresets.find((preset) => preset.sourceUrl === syncSourceUrl) ?? null;
  const syncOptionsOpen =
    productType === "winner" ||
    !includeMatchesInSync ||
    autoApplyAfterSync ||
    activeSyncPreset === null;

  const parsedPreview = useMemo(
    () =>
      parseTotoOfficialRoundCsv({
        fixtures: fixtures.data ?? undefined,
        sourceText,
      }),
    [fixtures.data, sourceText],
  );
  const rowWarnings = useMemo(() => collectRowWarnings(rows), [rows]);
  const previewWarnings = useMemo(
    () => dedupeWarnings([...parseWarnings, ...rowWarnings]),
    [parseWarnings, rowWarnings],
  );

  const rematchRows = (nextRows: TotoOfficialImportRow[]) => {
    const matchedRows = matchOfficialRowsToFixtures(nextRows, fixtures.data ?? []);
    setRows(matchedRows);
    return matchedRows;
  };

  const updateRow = (
    index: number,
    patch: Partial<TotoOfficialImportRow>,
    options?: {
      rematch?: boolean;
    },
  ) => {
    setRows((current) => {
      const nextRows = current.map((entry, currentIndex) =>
        currentIndex === index ? { ...entry, ...patch } : entry,
      );
      return options?.rematch ? matchOfficialRowsToFixtures(nextRows, fixtures.data ?? []) : nextRows;
    });
  };

  const handleParse = () => {
    setRows(parsedPreview.rows);
    setParseWarnings(parsedPreview.warnings);
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
    setParseWarnings([]);
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
      await estimateRoundAiModel({
        overwriteExisting: false,
        roundId: nextRoundId,
      });
      await refreshCandidateTicketsForRound({
        force: true,
        roundId: nextRoundId,
      });
      setSavedRoundId(nextRoundId);
      router.push(buildRoundHref(appRoute.workspace, nextRoundId));
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
      if (
        productType === "winner" &&
        syncSourceUrl.trim() === defaultOfficialDetailSourceUrl
      ) {
        throw new Error(
          "WINNER は個別の公式くじ情報URLを貼ってから同期してください。既定のURLはサンプルです。",
        );
      }

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
          throw new Error("同期結果から回作成に使える公式回がありませんでした。");
        }

        setActionMessage(
          `公式一覧を同期しました。最新の「${latestEntry.title}」でRoundを作ります。`,
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
    void handleSyncOfficialRounds({
      autoApplyToPickRoom: autoApplyRequested,
    });
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
          officialVote0: normalizeEditableVoteValue(row.officialVote0),
          officialVote1: normalizeEditableVoteValue(row.officialVote1),
          officialVote2: normalizeEditableVoteValue(row.officialVote2),
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
      await estimateRoundAiModel({
        overwriteExisting: false,
        roundId: nextRoundId,
      });
      await refreshCandidateTicketsForRound({
        force: true,
        roundId: nextRoundId,
      });
      await library.refresh();
      setEditingLibraryEntryId(savedLibraryEntry.id);
      setSavedRoundId(nextRoundId);
      setActionMessage("公式回ライブラリとこの回を更新しました。");
    } catch (nextError) {
      setActionError(errorMessage(nextError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="管理者"
        title="回を作る"
        description="入口はここだけです。通常は公式toto回から作り、足りない時だけ W杯日程 や CSV / 手入力 を使います。"
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href={appRoute.goal3Value} className={secondaryButtonClassName}>
              GOAL3ボード
            </Link>
            {roundDetailHref ? (
              <Link href={roundDetailHref} className={secondaryButtonClassName}>
                ラウンド詳細へ戻る
              </Link>
            ) : null}
            {savedRoundId ? (
              <Link href={buildRoundHref(appRoute.workspace, savedRoundId)} className={secondaryButtonClassName}>
                作成した回を開く
              </Link>
            ) : null}
          </div>
        }
      />

      <RoundContextCard
        roundId={roundContextId}
        backHref={roundDetailHref}
        description="この取り込みが、どのRoundに入るかを先に確認できます。Round未指定なら新しく作成します。"
      />

      <SectionCard
        title="作り方を選ぶ"
        description="同じ意味の入口を増やさず、このページの中で必要な作り方だけ選べるようにしています。"
      >
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="teal">通常はこれ</Badge>
              <Badge tone="slate">主導線</Badge>
            </div>
            <h3 className="mt-3 font-semibold text-slate-950">公式toto回から作る</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              ふだんはこれで十分です。下の回一覧から選んで、そのまま1件作ります。
            </p>
            <div className="mt-5">
              <a href="#official-round-library" className={buttonClassName}>
                このまま進む
              </a>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="sky">発売前だけ</Badge>
              <Badge tone="slate">補助導線</Badge>
            </div>
            <h3 className="mt-3 font-semibold text-slate-950">W杯日程から作る</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              公式対象回がまだ出ていない時だけ使います。全試合日程から先に準備します。
            </p>
            <div className="mt-5">
              <Link href={buildRoundHref(appRoute.officialScheduleImport, roundId)} className={buttonClassName}>
                W杯日程から作る
              </Link>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="amber">一覧にない回だけ</Badge>
              <Badge tone="slate">補完入力</Badge>
            </div>
            <h3 className="mt-3 font-semibold text-slate-950">CSV / 手入力で作る</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              ライブラリにない回だけ、下の補完入力へ進みます。まずはホーム / アウェイだけでも大丈夫です。
            </p>
            <div className="mt-5">
              <Link href={manualEntryHref} className={buttonClassName}>
                CSV / 手入力で作る
              </Link>
            </div>
          </div>
        </div>
      </SectionCard>

      <CollapsibleSectionCard
        title="商品別の進め方"
        description="まずは toto / mini toto / WINNER / GOAL3 のどれを見るかだけ決めます。同期済み一覧があるときは、次のライブラリから選ぶだけで十分です。"
        defaultOpen={(library.data?.length ?? 0) === 0}
        badge={<Badge tone="sky">はじめに</Badge>}
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
                  <Badge tone={card.badgeTone}>{card.badgeLabel ?? productTypeLabel[card.productType]}</Badge>
                  {isActive ? <Badge tone="slate">現在の表示</Badge> : null}
                </div>
                <h3 className="mt-3 font-semibold text-slate-950">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const preset = card.recommendedSourcePresetId
                        ? resolveOfficialSourcePreset(card.recommendedSourcePresetId)
                        : null;
                      setProductType(card.productType);
                      setLibraryProductType(card.productType);
                      setEditingLibraryEntryId(null);
                      if (preset) {
                        setSyncSourceUrl(preset.sourceUrl);
                      }
                      setActionMessage(
                        card.productType === "winner" && preset
                          ? `WINNER 向けに切り替えました。同期元は「${preset.label}」の入力欄を開いています。サンプルURLは置き換えて、実際の公式くじ情報URLを貼ってください。`
                          : preset
                          ? `${card.badgeLabel ?? productTypeLabel[card.productType]} 向けに切り替えました。同期元も「${preset.label}」へ合わせています。`
                          : `${card.badgeLabel ?? productTypeLabel[card.productType]} の一覧に切り替えました。`,
                      );
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
        <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50/80 px-4 py-4 text-sm leading-6 text-amber-950">
          `totoGOAL3` も公式同期には含めますが、ラウンド作成画面へは流さず
          <Link href={appRoute.goal3Value} className="ml-2 font-semibold underline underline-offset-2">
            GOAL3ボード
          </Link>
          で別枠表示します。
        </div>
      </CollapsibleSectionCard>

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
        description="おすすめは Yahoo! toto 販売スケジュールです。開催回一覧から公式くじ情報ページを辿って、ラウンド作成画面で選べるライブラリを更新します。"
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

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="info">現在の同期元 {activeSyncPreset?.label ?? hostLabel(syncSourceUrl)}</Badge>
          <Badge tone="slate">試合明細 {includeMatchesInSync ? "含む" : "省略"}</Badge>
          <Badge tone={autoApplyAfterSync ? "teal" : "slate"}>
            {autoApplyAfterSync ? "同期後に最新の回で作る" : "一覧更新のみ"}
          </Badge>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleSyncOfficialRounds()}
            className={buttonClassName}
            disabled={syncing}
          >
            {syncing ? "同期中..." : "いまの設定で同期"}
          </button>
          <button
            type="button"
            onClick={() => void handleSyncOfficialRounds({ autoApplyToPickRoom: true })}
            className={secondaryButtonClassName}
            disabled={syncing}
          >
            {syncing ? "同期しつつ作成中..." : "公式一覧を同期してこの回で作る"}
          </button>
        </div>

        <CollapsibleSectionCard
          className="mt-4"
          title="同期オプション"
          description="URL を変えるとき、WINNER の公式詳細URLを入れるとき、または通常同期後に自動で回作成まで進めたいときだけ開きます。"
          defaultOpen={syncOptionsOpen}
          badge={<Badge tone="slate">オプション</Badge>}
        >
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">sourceUrl</span>
              <input
                value={syncSourceUrl}
                onChange={(event) => setSyncSourceUrl(event.currentTarget.value)}
                className={fieldClassName}
                placeholder="https://..."
              />
            </label>
            <div className="grid gap-3 text-sm md:pt-7">
              <label className="flex items-center gap-2 rounded-3xl border border-slate-200 bg-slate-50 px-3 py-2">
                <input
                  type="checkbox"
                  checked={includeMatchesInSync}
                  onChange={(event) => setIncludeMatchesInSync(event.currentTarget.checked)}
                  className="h-4 w-4"
                />
                <span>試合明細まで取り込む</span>
              </label>
              <label className="flex items-center gap-2 rounded-3xl border border-slate-200 bg-slate-50 px-3 py-2">
                <input
                  type="checkbox"
                  checked={autoApplyAfterSync}
                  onChange={(event) => setAutoApplyAfterSync(event.currentTarget.checked)}
                  className="h-4 w-4"
                />
                <span>通常同期でも最新1件で回を作る</span>
              </label>
            </div>
          </div>

          {productType === "winner" ? (
            <p className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-950">
              WINNER は開催一覧より、実際の公式くじ情報URLを直接入れる方が安定します。既定の detail URL はサンプルなので、実回の URL に置き換えてから同期してください。
            </p>
          ) : null}
        </CollapsibleSectionCard>

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
        {productType === "toto13" && !looksLikeWorldTotoText(title, officialRoundName, sourceUrl) ? (
          <p className="mt-4 rounded-[20px] border border-teal-200 bg-teal-50 px-4 py-3 text-xs leading-6 text-teal-950">
            公式側が generic な `toto` 表記のままでも、そのまま 13試合商品として読み込めます。あとで
            `title` か `official round name` に `World Toto` / `ワールドtoto` を含めると、一覧で
            `World Toto` badge が付きます。
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        id="official-round-library"
        title="回を選ぶ"
        description={
          roundId
            ? `同期済みの ${filterLabel} から、この回に反映します。`
            : `同期済みの ${filterLabel} から、新しい回を作ります。`
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
            <span className="font-medium text-slate-700">商品タイプ</span>
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
                  {option === "custom" ? "GOAL3 / カスタム" : productTypeLabel[option]}
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
              const productDisplay = libraryEntryProductDisplay(entry);

              return (
                <div
                  key={entry.id}
                  className="rounded-[26px] border border-slate-200 bg-white/90 p-5 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.35)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={productDisplay.tone}>{productDisplay.label}</Badge>
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
                          ? "この回に反映する"
                          : "この回で作る"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleUseLibraryEntry(entry, "load")}
                      className={secondaryButtonClassName}
                      disabled={Boolean(libraryBusyId)}
                    >
                      {isBusy ? "読込中..." : "下書きにする"}
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
        description="1. 回を選ぶ  2. この回で作る  3. 一覧にない回だけ CSV / TSV で追加、の順がいちばん速いです。"
        defaultOpen={false}
        badge={<Badge tone="sky">はじめに</Badge>}
      >
        <div className="grid gap-3 md:grid-cols-3">
          {[
            [
              "1",
              "回を選ぶ",
              "保存済みの公式回があれば、そのまま今のRoundか新規Roundに反映できます。",
            ],
            [
              "2",
              "この回で作る",
              "13試合が入っている回なら、そのまま回作成まで進めます。",
            ],
            [
              "3",
              "まだない回だけ CSV を貼る",
              "match no と vote 1/0/2 が入った表を貼れば大丈夫です。52 や 52% も受け付けます。",
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

      <CollapsibleSectionCard
        id="manual-entry"
        title="まだない回だけ CSV / 手入力で追加"
        description="ライブラリに無い回だけ、ここで手入力します。ふだんは上の一覧から 1 クリック反映で十分です。"
        defaultOpen={manualEntryOpen}
        badge={<Badge tone="slate">補完入力</Badge>}
      >
        <div className="flex flex-wrap gap-2">
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
        </div>

        <SectionCard title="回全体の情報" description="ラウンド全体にかかる公式情報を先に入れます。">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <input
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
              className={fieldClassName}
              placeholder="ラウンド名"
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
              placeholder="公式回名"
            />
            <input
              value={officialRoundNumber}
              onChange={(event) => setOfficialRoundNumber(event.currentTarget.value)}
              className={fieldClassName}
              placeholder="公式回番号"
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
              入力内容を確認
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
          title="確認して保存"
          description={`抽出 ${rows.length} 件。全試合リスト候補も併記します。`}
          actions={
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  const matchedRows = rematchRows(rows);
                  setActionError(null);
                  setActionMessage(
                    matchedRows.length > 0
                      ? "現在の入力内容で候補試合を照合し直しました。"
                      : "再照合する行がまだありません。",
                  );
                }}
                className={secondaryButtonClassName}
                disabled={rows.length === 0}
              >
                候補試合を照合し直す
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                className={buttonClassName}
                disabled={saving || rows.length === 0}
              >
                {saving
                  ? "保存中..."
                  : editingLibraryEntryId
                    ? "一覧を更新して回へ反映"
                    : "一覧に保存して回へ反映"}
              </button>
            </div>
          }
        >
          <div className="flex flex-wrap gap-2">
            <Badge tone="slate">行数 {rows.length}</Badge>
            {roundId ? <Badge tone="warning">既存の回を上書き</Badge> : <Badge tone="teal">新しい回を作成</Badge>}
            {editingLibraryEntryId ? <Badge tone="info">既存ライブラリを更新</Badge> : <Badge tone="sky">新規ライブラリ追加</Badge>}
          </div>

          <p className="mt-3 text-xs leading-6 text-slate-500">
            vote 1/0/2 は `0.52` / `52%` / `52` のどれでも扱えます。確認画面上で `52`
            と入れた値も、保存時には `0.52` としてそろえます。
          </p>

          {previewWarnings.length > 0 ? (
            <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              {previewWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
          {actionError ? (
            <div className="mt-4 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
              {actionError}
            </div>
          ) : null}

          <>
            <div className="mt-4 grid gap-4 lg:hidden">
              {rows.map((row, index) => (
                <div
                  key={`${row.officialMatchNo}-${index}`}
                  className="rounded-[24px] border border-slate-200 bg-slate-50/90 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="slate">No.{row.officialMatchNo}</Badge>
                    <Badge tone={row.fixtureMasterId ? "teal" : "warning"}>
                      {row.fixtureMasterId ? "fixture 候補あり" : "fixture 未選択"}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <label className="space-y-2 text-sm">
                      <span className="font-medium text-slate-700">home</span>
                      <input
                        value={row.homeTeam}
                        onChange={(event) =>
                          updateRow(index, { homeTeam: event.currentTarget.value }, { rematch: true })
                        }
                        className={fieldClassName}
                      />
                    </label>
                    <label className="space-y-2 text-sm">
                      <span className="font-medium text-slate-700">away</span>
                      <input
                        value={row.awayTeam}
                        onChange={(event) =>
                          updateRow(index, { awayTeam: event.currentTarget.value }, { rematch: true })
                        }
                        className={fieldClassName}
                      />
                    </label>
                    <label className="space-y-2 text-sm">
                      <span className="font-medium text-slate-700">kickoff</span>
                      <input
                        value={row.kickoffTime ?? ""}
                        onChange={(event) =>
                          updateRow(
                            index,
                            { kickoffTime: event.currentTarget.value || null },
                            { rematch: true },
                          )
                        }
                        className={fieldClassName}
                      />
                    </label>
                    <label className="space-y-2 text-sm">
                      <span className="font-medium text-slate-700">stage</span>
                      <input
                        value={row.stage ?? ""}
                        onChange={(event) =>
                          updateRow(index, { stage: event.currentTarget.value || null })
                        }
                        className={fieldClassName}
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="space-y-2 text-sm">
                        <span className="font-medium text-slate-700">vote 1</span>
                        <input
                          value={row.officialVote1 ?? ""}
                          onChange={(event) =>
                            updateRow(index, {
                              officialVote1: normalizeVote(event.currentTarget.value).normalized,
                            })
                          }
                          className={fieldClassName}
                          inputMode="decimal"
                        />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="font-medium text-slate-700">vote 0</span>
                        <input
                          value={row.officialVote0 ?? ""}
                          onChange={(event) =>
                            updateRow(index, {
                              officialVote0: normalizeVote(event.currentTarget.value).normalized,
                            })
                          }
                          className={fieldClassName}
                          inputMode="decimal"
                        />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="font-medium text-slate-700">vote 2</span>
                        <input
                          value={row.officialVote2 ?? ""}
                          onChange={(event) =>
                            updateRow(index, {
                              officialVote2: normalizeVote(event.currentTarget.value).normalized,
                            })
                          }
                          className={fieldClassName}
                          inputMode="decimal"
                        />
                      </label>
                    </div>
                    <label className="space-y-2 text-sm">
                      <span className="font-medium text-slate-700">fixture match</span>
                      <select
                        value={row.fixtureMasterId ?? ""}
                        onChange={(event) =>
                          updateRow(index, { fixtureMasterId: event.currentTarget.value || null })
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
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden lg:block">
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
                                updateRow(index, { homeTeam: event.currentTarget.value }, { rematch: true })
                              }
                              className={fieldClassName}
                            />
                            <input
                              value={row.awayTeam}
                              onChange={(event) =>
                                updateRow(index, { awayTeam: event.currentTarget.value }, { rematch: true })
                              }
                              className={fieldClassName}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <input
                            value={row.kickoffTime ?? ""}
                            onChange={(event) =>
                              updateRow(
                                index,
                                { kickoffTime: event.currentTarget.value || null },
                                { rematch: true },
                              )
                            }
                            className={fieldClassName}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            value={row.stage ?? ""}
                            onChange={(event) =>
                              updateRow(index, { stage: event.currentTarget.value || null })
                            }
                            className={fieldClassName}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-2">
                            <input
                              value={row.officialVote1 ?? ""}
                              onChange={(event) =>
                                updateRow(index, {
                                  officialVote1: normalizeVote(event.currentTarget.value).normalized,
                                })
                              }
                              className={fieldClassName}
                              inputMode="decimal"
                            />
                            <input
                              value={row.officialVote0 ?? ""}
                              onChange={(event) =>
                                updateRow(index, {
                                  officialVote0: normalizeVote(event.currentTarget.value).normalized,
                                })
                              }
                              className={fieldClassName}
                              inputMode="decimal"
                            />
                            <input
                              value={row.officialVote2 ?? ""}
                              onChange={(event) =>
                                updateRow(index, {
                                  officialVote2: normalizeVote(event.currentTarget.value).normalized,
                                })
                              }
                              className={fieldClassName}
                              inputMode="decimal"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={row.fixtureMasterId ?? ""}
                            onChange={(event) =>
                              updateRow(index, { fixtureMasterId: event.currentTarget.value || null })
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
            </div>
          </>
        </SectionCard>
      </CollapsibleSectionCard>
    </div>
  );
}

export default function TotoOfficialRoundImportPage() {
  return (
    <Suspense fallback={<LoadingNotice title="公式toto回の画面を準備中" />}>
      <TotoOfficialRoundImportPageContent />
    </Suspense>
  );
}
