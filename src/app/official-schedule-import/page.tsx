"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

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
  buildOfficialScheduleBookmarklet,
  buildOfficialScheduleExtractorScript,
  fetchOfficialScheduleFromFifaArticle,
  officialScheduleImportSample,
  officialScheduleImportSourceLabel,
  officialScheduleImportSourceUrl,
  parseOfficialScheduleText,
  parseOfficialScheduleTransferPayload,
  type OfficialScheduleDraft,
} from "@/lib/official-schedule";
import { appRoute, buildRoundHref, getSingleSearchParam } from "@/lib/round-links";
import { saveFixtureMasterEntries } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useFixtureMaster } from "@/lib/use-app-data";
import type { FixtureDataConfidence, FixtureSource } from "@/lib/types";

const fixtureSourceLabel: Record<FixtureSource, string> = {
  fifa_official_manual: "FIFA公式 手貼り",
  fifa_official_csv: "FIFA公式 CSV",
  fifa_official_api: "FIFA公式 API",
  user_manual: "手入力",
  demo_sample: "デモ",
};

const fixtureConfidenceLabel: Record<FixtureDataConfidence, string> = {
  official: "公式",
  manual_official_source: "公式由来",
  demo: "デモ",
  unknown: "不明",
};

const fixtureConfidenceTone: Record<
  FixtureDataConfidence,
  "slate" | "teal" | "warning"
> = {
  official: "teal",
  manual_official_source: "teal",
  demo: "warning",
  unknown: "slate",
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "不明なエラーです。";
}

function buildPreviewWarnings(preview: ReturnType<typeof parseOfficialScheduleText>) {
  return [
    ...preview.warnings,
    ...preview.duplicates.map((item) => `${item} は貼り付け内で重複しています。`),
  ];
}

function OfficialScheduleImportPageContent() {
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const defaultCompetition = "fifa_world_cup_2026";
  const transferredSchedule = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return parseOfficialScheduleTransferPayload(window.name);
  }, []);
  const initialTransferPreview = useMemo(
    () =>
      transferredSchedule
        ? parseOfficialScheduleText({
            competition: defaultCompetition,
            dataConfidence: "manual_official_source",
            source: "fifa_official_manual",
            sourceText: transferredSchedule.sourceText,
            sourceUrl: transferredSchedule.sourceUrl ?? officialScheduleImportSourceUrl,
          })
        : null,
    [defaultCompetition, transferredSchedule],
  );
  const [sourceText, setSourceText] = useState(
    () => transferredSchedule?.sourceText ?? "",
  );
  const [competition, setCompetition] = useState(defaultCompetition);
  const [sourceUrl, setSourceUrl] = useState(
    () => transferredSchedule?.sourceUrl ?? officialScheduleImportSourceUrl,
  );
  const [fixtureSource, setFixtureSource] = useState<FixtureSource>(() =>
    transferredSchedule ? "fifa_official_manual" : "fifa_official_api",
  );
  const [fixtureConfidence, setFixtureConfidence] = useState<FixtureDataConfidence>(() =>
    transferredSchedule ? "manual_official_source" : "official",
  );
  const [draftRows, setDraftRows] = useState<OfficialScheduleDraft[]>(
    () => initialTransferPreview?.fixtures ?? [],
  );
  const [parseWarnings, setParseWarnings] = useState<string[]>(
    () => (initialTransferPreview ? buildPreviewWarnings(initialTransferPreview) : []),
  );
  const [importMessage, setImportMessage] = useState<string | null>(() =>
    initialTransferPreview
      ? `FIFA公式ページから ${initialTransferPreview.fixtures.length} 件の候補行を取り込みました。必要な行だけ整えて Fixture Master に保存できます。`
      : null,
  );
  const [bookmarkletCopied, setBookmarkletCopied] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [fetchingFromFifa, setFetchingFromFifa] = useState(false);
  const [saving, setSaving] = useState(false);
  const fixtureMaster = useFixtureMaster({ competition });

  const parsedPreview = useMemo(
    () =>
      parseOfficialScheduleText({
        competition,
        dataConfidence: fixtureConfidence,
        source: fixtureSource,
        sourceText,
        sourceUrl,
      }),
    [competition, fixtureConfidence, fixtureSource, sourceText, sourceUrl],
  );
  const absoluteImportPageHref = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const importUrl = new URL(window.location.href);
    if (roundId) {
      importUrl.searchParams.set("round", roundId);
    } else {
      importUrl.searchParams.delete("round");
    }
    return importUrl.toString();
  }, [roundId]);
  const fifaBookmarkletHref = useMemo(
    () =>
      absoluteImportPageHref
        ? buildOfficialScheduleBookmarklet(absoluteImportPageHref)
        : null,
    [absoluteImportPageHref],
  );

  useEffect(() => {
    if (typeof window !== "undefined" && transferredSchedule) {
      window.name = "";
    }
  }, [transferredSchedule]);

  if (!isSupabaseConfigured()) {
    return <ConfigurationNotice />;
  }

  if (fixtureMaster.loading && !fixtureMaster.data) {
    return <LoadingNotice title="Official Schedule Import Wizard を準備中" />;
  }

  if (fixtureMaster.error) {
    return <ErrorNotice error={fixtureMaster.error} onRetry={() => void fixtureMaster.refresh()} />;
  }

  const handleParse = () => {
    setDraftRows(parsedPreview.fixtures);
    setParseWarnings(buildPreviewWarnings(parsedPreview));
    setSaveMessage(null);
    setActionError(null);
    setBookmarkletCopied(null);
    setImportMessage(
      parsedPreview.fixtures.length > 0
        ? `抽出プレビューを ${parsedPreview.fixtures.length} 件に更新しました。`
        : "貼り付け内容を見直して、もう一度 Parse Preview を押してください。",
    );
  };

  const handleCopyExtractorScript = async () => {
    if (!absoluteImportPageHref || typeof navigator === "undefined" || !navigator.clipboard) {
      setActionError(
        "抽出スクリプトのコピーに失敗しました。ブックマークレットを保存するか、対応ブラウザで開き直してください。",
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(
        buildOfficialScheduleExtractorScript(absoluteImportPageHref),
      );
      setBookmarkletCopied("抽出スクリプトをクリップボードへコピーしました。");
      setActionError(null);
    } catch (nextError) {
      setActionError(errorMessage(nextError));
    }
  };

  const handleFetchFromFifa = async () => {
    setFetchingFromFifa(true);
    setActionError(null);
    setSaveMessage(null);
    setBookmarkletCopied(null);

    try {
      const fetched = await fetchOfficialScheduleFromFifaArticle(
        sourceUrl.trim() || officialScheduleImportSourceUrl,
      );
      const preview = parseOfficialScheduleText({
        competition,
        dataConfidence: "official",
        source: "fifa_official_api",
        sourceText: fetched.sourceText,
        sourceUrl: fetched.sourceUrl,
      });

      setFixtureSource("fifa_official_api");
      setFixtureConfidence("official");
      setSourceUrl(fetched.sourceUrl);
      setSourceText(fetched.sourceText);
      setDraftRows(preview.fixtures);
      setParseWarnings([...fetched.warnings, ...buildPreviewWarnings(preview)]);
      setImportMessage(
        `FIFA公式 API から ${preview.fixtures.length} 件の候補行を取得しました。${fetched.articleTitle ? `記事: ${fetched.articleTitle}` : ""}`,
      );
    } catch (nextError) {
      setActionError(errorMessage(nextError));
    } finally {
      setFetchingFromFifa(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setActionError(null);
    setSaveMessage(null);

    try {
      const result = await saveFixtureMasterEntries({
        entries: draftRows.map((row) => ({
          awayTeam: row.awayTeam,
          city: null,
          competition: row.competition,
          country: null,
          dataConfidence: row.dataConfidence,
          externalFixtureId: null,
          groupName: row.groupName,
          homeTeam: row.homeTeam,
          kickoffTime: row.kickoffTime,
          matchDate: row.matchDate,
          source: row.source,
          sourceText: row.sourceText,
          sourceUrl: row.sourceUrl,
          stage: row.stage,
          timezone: row.timezone,
          venue: row.venue,
        })),
      });
      await fixtureMaster.refresh();
      setSaveMessage(
        `保存 ${result.insertedCount} 件 / 更新 ${result.updatedCount} 件 / スキップ ${result.skippedCount} 件`,
      );
      setParseWarnings(result.warnings);
    } catch (nextError) {
      setActionError(errorMessage(nextError));
    } finally {
      setSaving(false);
    }
  };
  const fixtureSelectorHref = buildRoundHref(appRoute.fixtureSelector, roundId);
  const roundDetailHref = roundId ? buildRoundHref(appRoute.workspace, roundId) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Official Schedule Import Wizard"
        description="FIFA公式由来の確定日程を貼り付けて、Fixture Master に取り込みます。toto発売前の本番準備は、この導線を main にしています。"
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href={fixtureSelectorHref} className={secondaryButtonClassName}>
              Fixture Selector
            </Link>
            {roundDetailHref ? (
              <Link href={roundDetailHref} className={secondaryButtonClassName}>
                Round Detailへ戻る
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setSourceUrl(officialScheduleImportSourceUrl);
                setSourceText(officialScheduleImportSample);
                setFixtureSource("demo_sample");
                setFixtureConfidence("demo");
                setImportMessage("サンプル日程をセットしました。Parse Preview を押すとプレビューできます。");
              }}
              className={buttonClassName}
            >
              サンプル貼り付け
            </button>
          </div>
        }
      />

      <RoundContextCard
        roundId={roundId}
        backHref={roundDetailHref}
        description="公式日程の貼り付けはできますが、いまどの Round の準備として開いているかを先にそろえます。"
      />

      <CollapsibleSectionCard
        title="FIFA公式から取得"
        description="スマホでは、この画面のまま FIFA公式 API から本文を取得できます。URL を変えたときも、その記事 URL から本文と対戦カードを抜きます。"
        defaultOpen
        badge={<Badge tone="teal">1タップ取得</Badge>}
      >
        <div className="grid gap-3 md:grid-cols-3">
          {[
            [
              "1",
              "URL を確認",
              "既定の FIFA公式日程 URL が入っています。別の記事URLでも、FIFA公式の記事ならそのまま使えます。",
            ],
            [
              "2",
              "この画面で取得",
              "FIFA公式 API から本文を直接読み、日付行と対戦カードをそのままプレビューへ入れます。",
            ],
            [
              "3",
              "確認して保存",
              "home / away / group / venue / kickoff を軽く整えて Fixture Master に保存します。",
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

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleFetchFromFifa()}
            className={buttonClassName}
            disabled={fetchingFromFifa}
          >
            {fetchingFromFifa ? "FIFA公式から取得中..." : "この画面で取得"}
          </button>
          <a
            href={officialScheduleImportSourceUrl}
            target="_blank"
            rel="noreferrer"
            className={secondaryButtonClassName}
          >
            FIFA公式ページを開く
          </a>
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
          <p className="font-medium text-slate-950">抽出ルール</p>
          <p className="mt-2">
            まず FIFA公式の記事本文 JSON を取り、本文内の date heading と match line を抜きます。
            記事に kickoff time が含まれていれば拾い、なければ null のまま保存します。ページ装飾や SNS
            埋め込みは捨てるので、多少ページ構成が変わっても `何日 / 何時 / home / away / venue`
            は維持しやすい構成です。
          </p>
        </div>
      </CollapsibleSectionCard>

      <CollapsibleSectionCard
        title="Fallback: FIFA URL から抜き出す"
        description="もしブラウザからの直接取得が通らないときは、FIFAページ上で本文を抜き出してこの画面へ戻す fallback も残しています。"
        defaultOpen={false}
        badge={<Badge tone="sky">fallback</Badge>}
      >
        <div className="grid gap-3 md:grid-cols-3">
          {[
            [
              "1",
              "ブックマークを保存",
              "下の FIFA抽出ブックマーク をブックマークバーへ置くか、抽出スクリプトをコピーします。",
            ],
            [
              "2",
              "FIFA公式ページで実行",
              "公式日程ページが開き切ってからブックマークを押すと、本文を window.name 経由で持ち帰ります。",
            ],
            [
              "3",
              "この画面へ戻って確認",
              "戻ってきたら自動で Parse Preview まで進むので、そのまま Fixture Master に保存できます。",
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

        <div className="flex flex-wrap gap-3">
          {fifaBookmarkletHref ? (
            <a href={fifaBookmarkletHref} className={buttonClassName}>
              FIFA抽出ブックマーク
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => void handleCopyExtractorScript()}
            className={secondaryButtonClassName}
          >
            抽出スクリプトをコピー
          </button>
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
          <p className="font-medium text-slate-950">運用メモ</p>
          <p className="mt-2">
            ブックマークレットが使いづらい端末では、コピーしたスクリプトをブラウザの DevTools Console
            で実行しても同じ動きになります。FIFA側の本文構造が変わっても、まずは body
            text を持ち帰るので、抽出処理をこちらで調整しやすいです。
          </p>
        </div>

        {bookmarkletCopied ? (
          <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
            {bookmarkletCopied}
          </div>
        ) : null}
        {importMessage ? (
          <div className="rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900">
            {importMessage}
          </div>
        ) : null}
      </CollapsibleSectionCard>

      <CollapsibleSectionCard
        title="手順"
        description="1. 公式ソースを貼る  2. Parse Preview で整える  3. Fixture Master に保存、の順で進めます。"
        defaultOpen={false}
        badge={<Badge tone="sky">はじめに</Badge>}
      >
        <p className="text-sm leading-6 text-slate-600">
          主導線は `この画面で取得 → Parse Preview → Save to Fixture Master` です。
          URL を手で貼りたいときや fallback が必要なときだけ、この下の Paste と Fallback を使います。
        </p>
      </CollapsibleSectionCard>

      <SectionCard
        title="Paste"
        description={`既存 Fixture Master: ${fixtureMaster.data?.length ?? 0} 件`}
        actions={
          <button type="button" onClick={handleParse} className={buttonClassName}>
            Parse Preview
          </button>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Badge tone="teal">{fixtureSourceLabel[fixtureSource]}</Badge>
          <Badge tone={fixtureConfidenceTone[fixtureConfidence]}>
            {fixtureConfidenceLabel[fixtureConfidence]}
          </Badge>
          <Badge tone="slate">{competition}</Badge>
          <Badge tone="info">{officialScheduleImportSourceLabel}</Badge>
          {!sourceUrl.trim() ? <Badge tone="warning">sourceUrl 未入力</Badge> : null}
        </div>

        <div className="rounded-[22px] border border-teal-200 bg-teal-50 px-4 py-4 text-sm leading-6 text-teal-950">
          <p className="font-medium">FIFA公式 手貼りの既定URL</p>
          <p className="mt-2 break-all">{officialScheduleImportSourceUrl}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSourceUrl(officialScheduleImportSourceUrl);
                setFixtureSource("fifa_official_api");
                setFixtureConfidence("official");
              }}
              className={buttonClassName}
            >
              このURLをセット
            </button>
            <a
              href={officialScheduleImportSourceUrl}
              target="_blank"
              rel="noreferrer"
              className={secondaryButtonClassName}
            >
              開いて本文を貼る
            </a>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">competition</span>
            <input
              value={competition}
              onChange={(event) => setCompetition(event.currentTarget.value)}
              className={fieldClassName}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">sourceUrl</span>
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.currentTarget.value)}
              className={fieldClassName}
              placeholder="https://..."
            />
          </label>
        </div>

        {!sourceUrl.trim() ? (
          <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-950">
            貼り付け元の URL がないと、あとで「この日程はどこから持ってきたか」を追いにくくなります。公開ページやメモの URL があれば一緒に残してください。
          </div>
        ) : null}

        <label className="block space-y-2 text-sm">
          <span className="font-medium text-slate-700">公式日程テキスト</span>
          <textarea
            value={sourceText}
            onChange={(event) => setSourceText(event.currentTarget.value)}
            className={textAreaClassName}
            placeholder="Thursday, 11 June 2026 ..."
          />
        </label>
      </SectionCard>

      <SectionCard
        title="Parse Preview"
        description="抽出された試合を保存前に編集できます。source と confidence もここで確認できます。"
        actions={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              className={buttonClassName}
              disabled={saving || draftRows.length === 0}
            >
              {saving ? "保存中..." : "Save to Fixture Master"}
            </button>
            <Link href={fixtureSelectorHref} className={secondaryButtonClassName}>
              次は Fixture Selector
            </Link>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Badge tone="slate">抽出 {draftRows.length} 件</Badge>
          <Badge tone="info">プレビュー {parsedPreview.fixtures.length} 件</Badge>
          {parsedPreview.duplicates.length > 0 ? <Badge tone="warning">重複候補あり</Badge> : null}
          {!sourceUrl.trim() ? <Badge tone="warning">sourceUrl 未入力</Badge> : null}
        </div>

        {parseWarnings.length > 0 ? (
          <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
            {parseWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
        {actionError ? (
          <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            {actionError}
          </div>
        ) : null}
        {saveMessage ? (
          <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
            {saveMessage}
          </div>
        ) : null}

        {draftRows.length === 0 ? (
          <p className="text-sm leading-6 text-slate-600">
            まだ保存対象の行がありません。テキストを貼って Parse Preview を押すとここに一覧が出ます。
          </p>
        ) : (
          <HorizontalScrollTable>
            <table className="min-w-[1460px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-3">date</th>
                  <th className="px-3 py-3">kickoff</th>
                  <th className="px-3 py-3">home</th>
                  <th className="px-3 py-3">away</th>
                  <th className="px-3 py-3">group</th>
                  <th className="px-3 py-3">stage</th>
                  <th className="px-3 py-3">venue</th>
                  <th className="px-3 py-3">source</th>
                  <th className="px-3 py-3">confidence</th>
                </tr>
              </thead>
              <tbody>
                {draftRows.map((row, index) => (
                  <tr key={`${row.homeTeam}-${row.awayTeam}-${index}`} className="border-b border-slate-100">
                    <td className="px-3 py-3">
                      <input
                        value={row.matchDate ?? ""}
                        onChange={(event) =>
                          setDraftRows((current) =>
                            current.map((entry, currentIndex) =>
                              currentIndex === index
                                ? { ...entry, matchDate: event.currentTarget.value || null }
                                : entry,
                            ),
                          )
                        }
                        className={fieldClassName}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        value={row.kickoffTime ?? ""}
                        onChange={(event) =>
                          setDraftRows((current) =>
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
                        value={row.homeTeam}
                        onChange={(event) =>
                          setDraftRows((current) =>
                            current.map((entry, currentIndex) =>
                              currentIndex === index
                                ? { ...entry, homeTeam: event.currentTarget.value }
                                : entry,
                            ),
                          )
                        }
                        className={fieldClassName}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        value={row.awayTeam}
                        onChange={(event) =>
                          setDraftRows((current) =>
                            current.map((entry, currentIndex) =>
                              currentIndex === index
                                ? { ...entry, awayTeam: event.currentTarget.value }
                                : entry,
                            ),
                          )
                        }
                        className={fieldClassName}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        value={row.groupName ?? ""}
                        onChange={(event) =>
                          setDraftRows((current) =>
                            current.map((entry, currentIndex) =>
                              currentIndex === index
                                ? { ...entry, groupName: event.currentTarget.value || null }
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
                          setDraftRows((current) =>
                            current.map((entry, currentIndex) =>
                              currentIndex === index
                                ? { ...entry, stage: event.currentTarget.value || null }
                                : entry,
                            ),
                          )
                        }
                        className={fieldClassName}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        value={row.venue ?? ""}
                        onChange={(event) =>
                          setDraftRows((current) =>
                            current.map((entry, currentIndex) =>
                              currentIndex === index
                                ? { ...entry, venue: event.currentTarget.value || null }
                                : entry,
                            ),
                          )
                        }
                        className={fieldClassName}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone="slate">{fixtureSourceLabel[row.source]}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={fixtureConfidenceTone[row.dataConfidence]}>
                        {fixtureConfidenceLabel[row.dataConfidence]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </HorizontalScrollTable>
        )}
      </SectionCard>
    </div>
  );
}

export default function OfficialScheduleImportPage() {
  return (
    <Suspense fallback={<LoadingNotice title="Official Schedule Import Wizard を準備中" />}>
      <OfficialScheduleImportPageContent />
    </Suspense>
  );
}
