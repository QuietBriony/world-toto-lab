"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { RouteGlossaryCard } from "@/components/app/round-guides";
import {
  ArtBannerPanel,
  Badge,
  buttonClassName,
  fieldClassName,
  PageHeader,
  SectionCard,
  secondaryButtonClassName,
  StatCard,
  textAreaClassName,
} from "@/components/ui";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/domain";
import {
  buildBigCarryoverQueryFromOfficialSnapshot,
  buildBigOfficialWatch,
  formatBigCarryoverDisplay,
  pickFeaturedBigOfficialSnapshot,
} from "@/lib/big-official";
import {
  bigCarryoverPresets,
  bigEventTypeDescription,
  bigEventTypeLabel,
  buildBigCarryoverEventSnapshot,
  buildBigShockAlert,
  calculateBigCarryoverSummary,
  classifyBigHeatBand,
  detectBigShockSignal,
  normalizeBigEventType,
} from "@/lib/big-carryover";
import {
  bigCarryoverProductDefaults,
  bigCarryoverProductTypeFromOfficialKey,
  bigTrueEvStatusLabel,
  buildBigCarryoverSalesScenarios,
  calculateBigCarryover,
  classifyBigCarryoverPosition,
  normalizeBigCarryoverProductType,
  type BigCarryoverProductType,
} from "@/lib/big-carryover/calculator";
import { appRoute, buildHref } from "@/lib/round-links";
import { boardHeroArt, emptyStateArt, resolveArtAsset } from "@/lib/ui-art";
import { useBigOfficialWatch } from "@/lib/use-app-data";

const productTypeOptions = Object.keys(
  bigCarryoverProductDefaults,
) as BigCarryoverProductType[];

function parseNumberInput(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const normalized = value.replaceAll(",", "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalNumberInput(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.replaceAll(",", "").trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCount(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined) {
    return "—";
  }

  return value.toLocaleString("ja-JP", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatOdds(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) {
    return "—";
  }

  return `1 / ${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatProxyPercent(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : formatPercent(value);
}

function BigCarryoverPageContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialProductType = normalizeBigCarryoverProductType(searchParams.get("productType"));
  const initialDefaults = bigCarryoverProductDefaults[initialProductType];
  const [eventType, setEventType] = useState(
    normalizeBigEventType(searchParams.get("eventType")),
  );
  const [eventLabel, setEventLabel] = useState(
    searchParams.get("label")?.trim() || "BIG キャリー圧ウォッチ",
  );
  const [snapshotDate, setSnapshotDate] = useState(
    searchParams.get("snapshotDate")?.trim() || "",
  );
  const [productType, setProductType] = useState<BigCarryoverProductType>(initialProductType);
  const [currentSalesYen, setCurrentSalesYen] = useState(
    String(parseNumberInput(searchParams.get("sales"), 8_000_000_000)),
  );
  const [projectedFinalSalesYen, setProjectedFinalSalesYen] = useState(
    String(
      parseNumberInput(
        searchParams.get("projectedSales"),
        parseNumberInput(searchParams.get("sales"), 8_000_000_000),
      ),
    ),
  );
  const [carryoverYen, setCarryoverYen] = useState(
    String(parseNumberInput(searchParams.get("carryover"), 3_000_000_000)),
  );
  const [returnRatePercent, setReturnRatePercent] = useState(
    String(parseNumberInput(searchParams.get("returnRate"), 50)),
  );
  const [ticketPriceYen, setTicketPriceYen] = useState(
    String(parseNumberInput(searchParams.get("ticketPrice"), initialDefaults.ticketPriceYen)),
  );
  const [firstPrizeOdds, setFirstPrizeOdds] = useState(
    String(
      parseNumberInput(
        searchParams.get("firstPrizeOdds"),
        initialDefaults.firstPrizeOdds ?? 0,
      ),
    ),
  );
  const [firstPrizeCapYen, setFirstPrizeCapYen] = useState(
    initialDefaults.firstPrizeCapYen === null
      ? searchParams.get("firstPrizeCap")?.trim() || ""
      : String(parseNumberInput(searchParams.get("firstPrizeCap"), initialDefaults.firstPrizeCapYen)),
  );
  const [sourceUrl, setSourceUrl] = useState(searchParams.get("sourceUrl")?.trim() || "");
  const [eventNote, setEventNote] = useState(searchParams.get("note")?.trim() || "");
  const officialWatch = useBigOfficialWatch();

  const productDefaults = bigCarryoverProductDefaults[productType];
  const numericCurrentSalesYen = parseOptionalNumberInput(currentSalesYen);
  const numericProjectedFinalSalesYen =
    parseOptionalNumberInput(projectedFinalSalesYen) ?? numericCurrentSalesYen;
  const numericCarryoverYen = parseOptionalNumberInput(carryoverYen);
  const numericReturnRatePercent = parseOptionalNumberInput(returnRatePercent);
  const numericReturnRate =
    numericReturnRatePercent !== null ? numericReturnRatePercent / 100 : null;
  const numericTicketPriceYen = parseOptionalNumberInput(ticketPriceYen);
  const numericFirstPrizeOdds = parseOptionalNumberInput(firstPrizeOdds);
  const numericFirstPrizeCapYen = parseOptionalNumberInput(firstPrizeCapYen);

  const calculation = useMemo(
    () =>
      calculateBigCarryover({
        carryoverYen: numericCarryoverYen,
        currentSalesYen: numericCurrentSalesYen,
        firstPrizeCapYen: numericFirstPrizeCapYen,
        firstPrizeOdds: numericFirstPrizeOdds,
        productType,
        projectedFinalSalesYen: numericProjectedFinalSalesYen,
        returnRate: numericReturnRate,
        ticketPriceYen: numericTicketPriceYen,
      }),
    [
      numericCarryoverYen,
      numericCurrentSalesYen,
      numericFirstPrizeCapYen,
      numericFirstPrizeOdds,
      numericProjectedFinalSalesYen,
      numericReturnRate,
      numericTicketPriceYen,
      productType,
    ],
  );

  const scenarioRows = useMemo(
    () =>
      buildBigCarryoverSalesScenarios({
        carryoverYen: numericCarryoverYen,
        currentSalesYen: numericCurrentSalesYen,
        firstPrizeCapYen: numericFirstPrizeCapYen,
        firstPrizeOdds: numericFirstPrizeOdds,
        productType,
        projectedFinalSalesYen: numericProjectedFinalSalesYen,
        returnRate: numericReturnRate,
        ticketPriceYen: numericTicketPriceYen,
      }),
    [
      numericCarryoverYen,
      numericCurrentSalesYen,
      numericFirstPrizeCapYen,
      numericFirstPrizeOdds,
      numericProjectedFinalSalesYen,
      numericReturnRate,
      numericTicketPriceYen,
      productType,
    ],
  );

  const summary = useMemo(
    () =>
      calculateBigCarryoverSummary({
        carryoverYen: numericCarryoverYen,
        returnRate: numericReturnRate ?? 0.5,
        salesYen: numericProjectedFinalSalesYen,
        spendYen: null,
      }),
    [numericCarryoverYen, numericProjectedFinalSalesYen, numericReturnRate],
  );
  const eventSnapshot = useMemo(
    () =>
      buildBigCarryoverEventSnapshot({
        eventLabel,
        eventType,
        summary,
      }),
    [eventLabel, eventType, summary],
  );
  const heatBand = classifyBigHeatBand(summary);
  const detectedShockSignal = useMemo(() => detectBigShockSignal(eventNote), [eventNote]);
  const shockAlert = useMemo(
    () =>
      buildBigShockAlert({
        signal: detectedShockSignal,
        summary,
      }),
    [detectedShockSignal, summary],
  );
  const positionLabel = classifyBigCarryoverPosition(calculation);

  const shareHref = buildHref(appRoute.bigCarryover, {
    carryover: numericCarryoverYen ?? undefined,
    eventType,
    firstPrizeCap: numericFirstPrizeCapYen ?? undefined,
    firstPrizeOdds: numericFirstPrizeOdds ?? undefined,
    label: eventLabel || undefined,
    note: eventNote || undefined,
    productType,
    projectedSales: numericProjectedFinalSalesYen ?? undefined,
    returnRate: numericReturnRatePercent ?? undefined,
    sales: numericCurrentSalesYen ?? undefined,
    snapshotDate: snapshotDate || undefined,
    sourceUrl: sourceUrl || undefined,
    ticketPrice: numericTicketPriceYen ?? undefined,
  });

  const officialSnapshots = useMemo(
    () => officialWatch.data?.snapshots ?? [],
    [officialWatch.data],
  );
  const featuredOfficialSnapshot = useMemo(
    () => pickFeaturedBigOfficialSnapshot(officialSnapshots),
    [officialSnapshots],
  );

  function applyProductDefaults(nextProductType: BigCarryoverProductType) {
    const nextDefaults = bigCarryoverProductDefaults[nextProductType];
    setProductType(nextProductType);
    setTicketPriceYen(String(nextDefaults.ticketPriceYen));
    setFirstPrizeOdds(nextDefaults.firstPrizeOdds ? String(nextDefaults.firstPrizeOdds) : "");
    setFirstPrizeCapYen(nextDefaults.firstPrizeCapYen ? String(nextDefaults.firstPrizeCapYen) : "");
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="BIGウォッチ"
        title="BIG / MEGA BIG キャリー圧ウォッチ"
        description="売上・キャリー・払戻率から粗い上振れ指標を見ます。真EVや利益を約束するものではなく、公式ルール確認前の比較メモとして扱います。"
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href={appRoute.dashboard} className={secondaryButtonClassName}>
              ダッシュボードへ
            </Link>
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className={secondaryButtonClassName}
              >
                元ソース
              </a>
            ) : null}
            <Link href={shareHref} className={buttonClassName}>
              この条件を共有
            </Link>
          </div>
        }
      />

      <ArtBannerPanel
        badge={<Badge tone="amber">{boardHeroArt.big.accentLabel}</Badge>}
        description={boardHeroArt.big.description}
        imageSrc={resolveArtAsset(pathname, boardHeroArt.big.src)}
        title={boardHeroArt.big.title}
      />

      <RouteGlossaryCard currentPath={appRoute.bigCarryover} defaultOpen />

      <SectionCard
        title="最初に確認"
        description="ここで出す大きな%はキャリー圧です。BIG/MEGA BIGの真EVとしては扱いません。"
      >
        <div className="grid gap-3 text-sm leading-6 text-slate-700">
          <p>
            この表示は、公式ルール・最終売上・当選上限・等級配分に依存します。キャリー額が大きくても、今回必ず全額払い出されるわけではありません。
          </p>
          <p>
            推定EVは的中や利益を保証しません。BIG/MEGA BIGはランダム発券であり、買い目選択によるエッジはありません。
          </p>
          <p>
            ほとんどの購入結果は外れになります。購入する場合は娯楽予算の範囲で行ってください。
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="公式同期一覧"
        description="スポーツくじオフィシャルの BIG 情報ページから、現在の BIG / MEGA BIG / 100円BIG / BIG1000 / mini BIG を半自動で読みます。"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="amber">BIG系5商品</Badge>
          <Badge tone="slate">
            {officialWatch.data ? `同期 ${officialSnapshots.length}商品` : "同期待ち"}
          </Badge>
          {featuredOfficialSnapshot ? (
            <Badge tone={buildBigOfficialWatch(featuredOfficialSnapshot).heatBand.badgeTone}>
              {buildBigOfficialWatch(featuredOfficialSnapshot).heatBand.label}
            </Badge>
          ) : null}
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          同期 snapshot のキャリー圧は現在売上ベースです。販売終了までに売上が増えると低下します。
        </p>
        {officialWatch.error ? (
          <p className="mt-3 text-sm text-rose-700">BIG公式同期: {officialWatch.error}</p>
        ) : null}
        {!officialWatch.error && officialWatch.loading && officialSnapshots.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">BIG公式ページから現在の5商品を同期しています...</p>
        ) : null}
        {!officialWatch.error && !officialWatch.loading && officialSnapshots.length === 0 ? (
          <div className="mt-4 space-y-4">
            <ArtBannerPanel
              badge={<Badge tone="amber">{emptyStateArt.bigWatch.accentLabel}</Badge>}
              description={emptyStateArt.bigWatch.description}
              imageSrc={resolveArtAsset(pathname, emptyStateArt.bigWatch.src)}
              title={emptyStateArt.bigWatch.title}
            />
            <p className="text-sm text-slate-500">
              現在の BIG 商品 snapshot をまだ取得できていません。少し待って再読み込みするか、下のテンプレ条件で先に比較できます。
            </p>
          </div>
        ) : null}
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {officialSnapshots.map((snapshot) => {
            const watch = buildBigOfficialWatch(snapshot);
            const snapshotProductType = bigCarryoverProductTypeFromOfficialKey(snapshot.productKey);
            const snapshotDefaults = bigCarryoverProductDefaults[snapshotProductType];
            const snapshotCalculation = calculateBigCarryover({
              carryoverYen: snapshot.carryoverYen,
              currentSalesYen: snapshot.totalSalesYen,
              firstPrizeCapYen: snapshotDefaults.firstPrizeCapYen,
              firstPrizeOdds: snapshotDefaults.firstPrizeOdds,
              productType: snapshotProductType,
              projectedFinalSalesYen: snapshot.totalSalesYen,
              returnRate: snapshot.returnRate,
              ticketPriceYen: snapshot.stakeYen || snapshotDefaults.ticketPriceYen,
            });
            const prefilledHref = buildHref(
              appRoute.bigCarryover,
              buildBigCarryoverQueryFromOfficialSnapshot(snapshot),
            );

            return (
              <div
                key={`${snapshot.productKey}-${snapshot.officialRoundNumber ?? "na"}`}
                className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={watch.heatBand.badgeTone}>{watch.heatBand.label}</Badge>
                  <Badge tone="slate">{snapshot.productLabel}</Badge>
                  <Badge tone="warning">{bigTrueEvStatusLabel[snapshotCalculation.trueEvStatus]}</Badge>
                </div>
                <h3 className="mt-3 font-display text-[1.15rem] font-semibold text-slate-950">
                  {snapshot.officialRoundName ?? snapshot.productLabel}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {watch.eventSnapshot.headline}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-slate-200 bg-white/80 px-4 py-3 text-sm">
                    <p className="text-slate-500">売上</p>
                    <p className="mt-1 font-semibold text-slate-950">
                      {formatCurrency(snapshot.totalSalesYen)}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-white/80 px-4 py-3 text-sm">
                    <p className="text-slate-500">キャリー</p>
                    <p className="mt-1 font-semibold text-slate-950">
                      {formatBigCarryoverDisplay(snapshot.carryoverYen)}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-white/80 px-4 py-3 text-sm">
                    <p className="text-slate-500">キャリー圧</p>
                    <p className="mt-1 font-semibold text-slate-950">
                      {formatProxyPercent(snapshotCalculation.naiveCarryPressure)}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-white/80 px-4 py-3 text-sm">
                    <p className="text-slate-500">1等発生確率</p>
                    <p className="mt-1 font-semibold text-slate-950">
                      {formatPercent(snapshotCalculation.probAtLeastOneFirstPrize, 2)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>払戻率 {formatPercent(snapshot.returnRate)}</span>
                  <span>取得 {formatDateTime(snapshot.snapshotAt)}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEventType(watch.eventType);
                      setEventLabel(snapshot.officialRoundName ?? `${snapshot.productLabel} キャリー圧ウォッチ`);
                      setSnapshotDate((snapshot.snapshotAt ?? snapshot.salesStartAt ?? "").slice(0, 10));
                      setProductType(snapshotProductType);
                      setCurrentSalesYen(String(snapshot.totalSalesYen ?? 0));
                      setProjectedFinalSalesYen(String(snapshot.totalSalesYen ?? 0));
                      setCarryoverYen(String(snapshot.carryoverYen));
                      setReturnRatePercent(String(Math.round(snapshot.returnRate * 100)));
                      setTicketPriceYen(String(snapshot.stakeYen || snapshotDefaults.ticketPriceYen));
                      setFirstPrizeOdds(snapshotDefaults.firstPrizeOdds ? String(snapshotDefaults.firstPrizeOdds) : "");
                      setFirstPrizeCapYen(snapshotDefaults.firstPrizeCapYen ? String(snapshotDefaults.firstPrizeCapYen) : "");
                      setSourceUrl(snapshot.sourceUrl);
                      setEventNote(snapshot.sourceText);
                    }}
                    className={buttonClassName}
                  >
                    この条件を反映
                  </button>
                  <Link href={prefilledHref} className={secondaryButtonClassName}>
                    別URLで開く
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="このページの前提"
        description="キャリー圧・1等発生確率・上限proxy・真EV未計算を分けて表示します。"
      >
        <div className="flex flex-wrap gap-2">
          <Badge tone="slate">運用ページ</Badge>
          <Badge tone="sky">{bigEventTypeLabel[eventType]}</Badge>
          <Badge tone={heatBand.badgeTone}>{heatBand.label}</Badge>
          <Badge tone="warning">{bigTrueEvStatusLabel[calculation.trueEvStatus]}</Badge>
          <Badge tone="info">購入代行や精算はしません</Badge>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 text-sm leading-6 text-slate-600">
            <p>
              キャリー圧は `(carryover + projectedFinalSalesYen * returnRate) / projectedFinalSalesYen` です。
              これは粗い上振れ指標であり、1等が出る確率や上限、複数当選時の分配、等級配分、繰越ルールを含みません。
            </p>
            <p>
              {productDefaults.note}
            </p>
          </div>
          <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 p-4 text-sm leading-7 text-amber-950">
            <p className="font-semibold">現在の判定</p>
            <p className="mt-2">{eventSnapshot.headline}</p>
            <p className="mt-2">{eventSnapshot.nextAction}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="テンプレ条件"
        description="固定条件はキャリー圧比較の出発点です。真EVとしては表示しません。"
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {bigCarryoverPresets.map((preset) => {
            const presetDefaults = bigCarryoverProductDefaults.BIG;
            const presetCalculation = calculateBigCarryover({
              carryoverYen: preset.carryoverYen,
              currentSalesYen: preset.salesYen,
              firstPrizeCapYen: presetDefaults.firstPrizeCapYen,
              firstPrizeOdds: presetDefaults.firstPrizeOdds,
              productType: "BIG",
              projectedFinalSalesYen: preset.salesYen,
              returnRate: preset.returnRatePercent / 100,
              ticketPriceYen: presetDefaults.ticketPriceYen,
            });
            const presetSummary = calculateBigCarryoverSummary({
              carryoverYen: preset.carryoverYen,
              returnRate: preset.returnRatePercent / 100,
              salesYen: preset.salesYen,
              spendYen: null,
            });
            const presetBand = classifyBigHeatBand(presetSummary);
            const presetHref = buildHref(appRoute.bigCarryover, {
              carryover: preset.carryoverYen,
              eventType: preset.eventType,
              firstPrizeCap: presetDefaults.firstPrizeCapYen ?? undefined,
              firstPrizeOdds: presetDefaults.firstPrizeOdds ?? undefined,
              label: preset.eventLabel,
              productType: "BIG",
              projectedSales: preset.salesYen,
              returnRate: preset.returnRatePercent,
              sales: preset.salesYen,
              ticketPrice: presetDefaults.ticketPriceYen,
            });

            return (
              <div
                key={preset.id}
                className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={presetBand.badgeTone}>{presetBand.label}</Badge>
                  <Badge tone="slate">{bigEventTypeLabel[preset.eventType]}</Badge>
                </div>
                <h3 className="mt-3 font-display text-[1.25rem] font-semibold text-slate-950">
                  {preset.eventLabel}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{preset.description}</p>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>キャリー圧 {formatProxyPercent(presetCalculation.naiveCarryPressure)}</span>
                  <span>1等発生確率 {formatPercent(presetCalculation.probAtLeastOneFirstPrize, 2)}</span>
                  <span>キャリー {formatBigCarryoverDisplay(preset.carryoverYen)}</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">{presetBand.hint}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={presetHref} className={buttonClassName}>
                    この条件で開く
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="入力"
        description="現在売上とユーザー入力の最終売上を分けます。旧URLの spend は表示計算に使いません。"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">イベント名</span>
            <input
              value={eventLabel}
              onChange={(event) => setEventLabel(event.currentTarget.value)}
              className={fieldClassName}
              placeholder="第xxxx回 MEGA BIG キャリー圧ウォッチ"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">商品タイプ</span>
            <select
              value={productType}
              onChange={(event) =>
                applyProductDefaults(normalizeBigCarryoverProductType(event.currentTarget.value))
              }
              className={fieldClassName}
            >
              {productTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {bigCarryoverProductDefaults[option].label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">イベント種別</span>
            <select
              value={eventType}
              onChange={(event) =>
                setEventType(normalizeBigEventType(event.currentTarget.value))
              }
              className={fieldClassName}
            >
              {Object.entries(bigEventTypeLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">現在売上 (円)</span>
            <input
              value={currentSalesYen}
              onChange={(event) => setCurrentSalesYen(event.currentTarget.value)}
              className={fieldClassName}
              inputMode="numeric"
              placeholder="191591400"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">ユーザー入力の最終売上 (円)</span>
            <input
              value={projectedFinalSalesYen}
              onChange={(event) => setProjectedFinalSalesYen(event.currentTarget.value)}
              className={fieldClassName}
              inputMode="numeric"
              placeholder="3000000000"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">キャリー (円)</span>
            <input
              value={carryoverYen}
              onChange={(event) => setCarryoverYen(event.currentTarget.value)}
              className={fieldClassName}
              inputMode="numeric"
              placeholder="6299582550"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">払戻率 (%)</span>
            <input
              value={returnRatePercent}
              onChange={(event) => setReturnRatePercent(event.currentTarget.value)}
              className={fieldClassName}
              inputMode="decimal"
              placeholder="50"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">1口価格 (円)</span>
            <input
              value={ticketPriceYen}
              onChange={(event) => setTicketPriceYen(event.currentTarget.value)}
              className={fieldClassName}
              inputMode="numeric"
              placeholder="300"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">1等オッズ</span>
            <input
              value={firstPrizeOdds}
              onChange={(event) => setFirstPrizeOdds(event.currentTarget.value)}
              className={fieldClassName}
              inputMode="numeric"
              placeholder="16777216"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">1等上限 (円)</span>
            <input
              value={firstPrizeCapYen}
              onChange={(event) => setFirstPrizeCapYen(event.currentTarget.value)}
              className={fieldClassName}
              inputMode="numeric"
              placeholder="1200000000"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">snapshot 日付</span>
            <input
              type="date"
              value={snapshotDate}
              onChange={(event) => setSnapshotDate(event.currentTarget.value)}
              className={fieldClassName}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">元ソースURL</span>
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.currentTarget.value)}
              className={fieldClassName}
              placeholder="https://..."
            />
          </label>
          <label className="space-y-2 text-sm md:col-span-2 xl:col-span-3">
            <span className="font-medium text-slate-700">特記事項メモ</span>
            <textarea
              value={eventNote}
              onChange={(event) => setEventNote(event.currentTarget.value)}
              className={textAreaClassName}
              rows={4}
              placeholder="例: 公式ルール確認前 / キャリー繰越条件を確認中 / 成立条件や返還の公式告知を確認中"
            />
          </label>
        </div>
      </SectionCard>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="キャリー圧"
          value={formatProxyPercent(calculation.naiveCarryPressure)}
          hint="粗い上振れ指標。真EVではありません。"
          tone={calculation.naiveCarryPressure !== null && calculation.naiveCarryPressure >= 1 ? "positive" : "warning"}
        />
        <StatCard
          label="1等発生確率"
          value={formatPercent(calculation.probAtLeastOneFirstPrize, 2)}
          hint={`1等オッズ ${formatOdds(numericFirstPrizeOdds)} / 口数 ${formatCount(calculation.ticketCountEstimate, 0)}`}
          tone="draw"
        />
        <StatCard
          label="上限調整後proxy"
          value={formatProxyPercent(calculation.capAdjustedNaiveCarryPressure)}
          hint="1等上限だけを入れた概算。真EVではありません。"
          tone="warning"
        />
        <StatCard
          label="真EV"
          value={bigTrueEvStatusLabel[calculation.trueEvStatus]}
          hint="等級配分・上限・キャリー反映ルールが揃うまで表示しません。"
          tone="warning"
        />
        <StatCard
          label="ポジション"
          value={positionLabel}
          hint="購入判断ではなく、確認状態のラベルです。"
          tone={positionLabel === "見送り" ? "warning" : positionLabel === "要公式確認" ? "warning" : "draw"}
        />
      </section>

      <SectionCard
        title="最終売上シナリオ"
        description="現在売上ベースだけで大きな%が出ても、最終売上が増えるとキャリー圧は下がります。"
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {scenarioRows.map((row) => (
            <div
              key={row.key}
              className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={row.key === "current" ? "warning" : row.key === "custom" ? "sky" : "slate"}>
                  {row.label}
                </Badge>
                <Badge tone="warning">{bigTrueEvStatusLabel[row.calculation.trueEvStatus]}</Badge>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">売上</span>
                  <span className="font-semibold text-slate-950">
                    {formatCurrency(row.projectedFinalSalesYen)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">キャリー圧</span>
                  <span className="font-semibold text-slate-950">
                    {formatProxyPercent(row.calculation.naiveCarryPressure)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">期待1等本数</span>
                  <span className="font-semibold text-slate-950">
                    {formatCount(row.calculation.expectedFirstPrizeWinners, 4)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">1等発生確率</span>
                  <span className="font-semibold text-slate-950">
                    {formatPercent(row.calculation.probAtLeastOneFirstPrize, 2)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">上限proxy</span>
                  <span className="font-semibold text-slate-950">
                    {formatProxyPercent(row.calculation.capAdjustedNaiveCarryPressure)}
                  </span>
                </div>
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">{row.note}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="警告と未確認事項"
        description="大きなキャリー圧を購入煽りに変換しないための確認リストです。"
      >
        <div className="flex flex-wrap gap-2">
          <Badge tone={shockAlert.badgeTone}>{shockAlert.label}</Badge>
          <Badge tone="slate">{bigEventTypeLabel[eventType]}</Badge>
          {snapshotDate ? <Badge tone="slate">{snapshotDate}</Badge> : null}
        </div>
        <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
          <p>{bigEventTypeDescription[eventType]}</p>
          <p>{shockAlert.hint}</p>
          {calculation.warnings.map((warning) => (
            <p key={warning}>・{warning}</p>
          ))}
          <p>
            True EVは、等級配分・上限・キャリー反映ルールが揃っている場合のみ扱います。現状は {bigTrueEvStatusLabel[calculation.trueEvStatus]} です。
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="計算式"
        description="表示上の大きな%はキャリー圧です。真EVとは別の値として扱います。"
      >
        <div className="rounded-[24px] border border-slate-200 bg-slate-950 px-5 py-5 text-sm leading-7 text-slate-100">
          <p>ticketCount = projectedFinalSalesYen / ticketPriceYen</p>
          <p>expectedFirstPrizeWinners = ticketCount / firstPrizeOdds</p>
          <p>probAtLeastOneFirstPrize = 1 - (1 - 1 / firstPrizeOdds) ^ ticketCount</p>
          <p>carryPressure = (carryoverYen + projectedFinalSalesYen * returnRate) / projectedFinalSalesYen</p>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          上限調整後proxyは1等上限だけを機械的に反映した目安です。複数当選時の分配、下位等級、繰越継続、公式ルールの詳細は含みません。
        </p>
      </SectionCard>
    </div>
  );
}

export default function BigCarryoverPage() {
  return (
    <Suspense
      fallback={
        <SectionCard
          title="BIGウォッチを読み込み中"
          description="条件を準備しています。"
        >
          <p className="text-sm text-slate-600">条件を準備しています。</p>
        </SectionCard>
      }
    >
      <BigCarryoverPageContent />
    </Suspense>
  );
}
