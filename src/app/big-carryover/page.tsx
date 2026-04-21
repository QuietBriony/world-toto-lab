"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { RouteGlossaryCard } from "@/components/app/round-guides";
import {
  Badge,
  buttonClassName,
  fieldClassName,
  PageHeader,
  SectionCard,
  secondaryButtonClassName,
  StatCard,
} from "@/components/ui";
import {
  formatCurrency,
  formatPercent,
  formatSignedPercent,
} from "@/lib/domain";
import {
  bigEventTypeDescription,
  bigEventTypeLabel,
  buildBigCarryoverEventSnapshot,
  buildBigCarryoverScenarioRows,
  calculateBigCarryoverSummary,
  normalizeBigEventType,
} from "@/lib/big-carryover";
import { appRoute, buildHref } from "@/lib/round-links";

function parseNumberInput(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const normalized = value.replaceAll(",", "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function BigCarryoverPageContent() {
  const searchParams = useSearchParams();
  const [eventType, setEventType] = useState(
    normalizeBigEventType(searchParams.get("eventType")),
  );
  const [eventLabel, setEventLabel] = useState(
    searchParams.get("label")?.trim() || "BIG 高還元イベント",
  );
  const [snapshotDate, setSnapshotDate] = useState(
    searchParams.get("snapshotDate")?.trim() || "",
  );
  const [salesYen, setSalesYen] = useState(
    String(parseNumberInput(searchParams.get("sales"), 8_000_000_000)),
  );
  const [carryoverYen, setCarryoverYen] = useState(
    String(parseNumberInput(searchParams.get("carryover"), 3_000_000_000)),
  );
  const [returnRatePercent, setReturnRatePercent] = useState(
    String(parseNumberInput(searchParams.get("returnRate"), 50)),
  );
  const [spendYen, setSpendYen] = useState(
    String(parseNumberInput(searchParams.get("spend"), 10_000)),
  );
  const [sourceUrl, setSourceUrl] = useState(searchParams.get("sourceUrl")?.trim() || "");

  const numericSalesYen = Number(salesYen.replaceAll(",", "")) || 0;
  const numericCarryoverYen = Number(carryoverYen.replaceAll(",", "")) || 0;
  const numericReturnRate = (Number(returnRatePercent) || 0) / 100;
  const numericSpendYen = Number(spendYen.replaceAll(",", "")) || 0;

  const summary = useMemo(
    () =>
      calculateBigCarryoverSummary({
        carryoverYen: numericCarryoverYen,
        returnRate: numericReturnRate,
        salesYen: numericSalesYen,
        spendYen: numericSpendYen,
      }),
    [numericCarryoverYen, numericReturnRate, numericSalesYen, numericSpendYen],
  );

  const scenarioRows = useMemo(
    () =>
      buildBigCarryoverScenarioRows({
        approxEvMultiple: summary.approxEvMultiple,
        eventType,
      }),
    [eventType, summary.approxEvMultiple],
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

  const shareHref = buildHref(appRoute.bigCarryover, {
    carryover: numericCarryoverYen || undefined,
    eventType,
    label: eventLabel || undefined,
    returnRate: Number.isFinite(Number(returnRatePercent))
      ? Number(returnRatePercent)
      : undefined,
    sales: numericSalesYen || undefined,
    snapshotDate: snapshotDate || undefined,
    sourceUrl: sourceUrl || undefined,
    spend: numericSpendYen || undefined,
  });

  const statusBadge =
    summary.approxEvMultiple === null
      ? { label: "要入力", tone: "warning" as const }
      : summary.approxEvMultiple >= 1
        ? { label: "期待値プラス圏", tone: "teal" as const }
        : summary.approxEvMultiple >= 0.9
          ? { label: "ほぼ拮抗", tone: "info" as const }
          : { label: "還元不足", tone: "warning" as const };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="BIG Carryover Monitor"
        title="BIG の高還元イベントをざっくり測る"
        description="BIG は outcome を選ぶ商品ではない前提で、売上・キャリー・還元率からどれくらいアッパーかを概説する運用ページです。的中や利益の保証ではなく、参考比較として使います。"
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

      <RouteGlossaryCard currentPath={appRoute.bigCarryover} defaultOpen />

      <SectionCard
        title="このページの前提"
        description="当たりやすさではなく、還元率ベースで見て『今はどれくらいアッパーか』を素早く見る用途です。"
      >
        <div className="flex flex-wrap gap-2">
          <Badge tone="slate">運用ページ</Badge>
          <Badge tone="sky">{bigEventTypeLabel[eventType]}</Badge>
          <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>
          <Badge tone="info">分析・記録用</Badge>
          <Badge tone="warning">購入代行や精算はしません</Badge>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 text-sm leading-6 text-slate-600">
            <p>
              `BIG` はどの目を選ぶかではなく、`キャリー / 売上 / 還元率` から
              「理論上どれくらい上振れしているか」を見る方が自然です。
            </p>
            <p>
              ここでは簡易式として `EV倍率 ≈ returnRate + carryover / totalSales` を使います。
              等級別配分や上限の完全再現ではなく、まずイベントの熱さをざっくり把握するための近似です。
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4 text-sm leading-7 text-slate-700">
            <p className="font-semibold text-slate-950">使いどころ</p>
            <p className="mt-2">
              `造船太郎イベント` のような「高還元かもしれない回」が話題になったとき、
              売上とキャリーを入れて、平時の 50% 還元からどれだけ上に乗っているかをすぐ確認できます。
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="イベント管理"
        description="BIG を Round import に混ぜず、話題回やキャリー回を独立した event snapshot として管理します。"
      >
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-4 md:grid-cols-2">
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
              <span className="font-medium text-slate-700">snapshot 日付</span>
              <input
                type="date"
                value={snapshotDate}
                onChange={(event) => setSnapshotDate(event.currentTarget.value)}
                className={fieldClassName}
              />
            </label>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setEventType("carryover_event");
                  setEventLabel("BIG キャリーイベント");
                }}
                className={secondaryButtonClassName}
              >
                キャリー監視
              </button>
              <button
                type="button"
                onClick={() => {
                  setEventType("high_return_watch");
                  setEventLabel("BIG 高還元ウォッチ");
                }}
                className={secondaryButtonClassName}
              >
                高還元ウォッチ
              </button>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="sky">{bigEventTypeLabel[eventType]}</Badge>
              <Badge tone={eventSnapshot.tone}>{eventSnapshot.statusLabel}</Badge>
              {snapshotDate ? <Badge tone="slate">{snapshotDate}</Badge> : null}
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <p>{bigEventTypeDescription[eventType]}</p>
              <p className="font-semibold text-slate-950">{eventSnapshot.headline}</p>
              <p>{eventSnapshot.nextAction}</p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="入力"
        description="公式発表や話題回のメモをそのまま入れて、ざっくり利回りを見ます。"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">イベント名</span>
            <input
              value={eventLabel}
              onChange={(event) => setEventLabel(event.currentTarget.value)}
              className={fieldClassName}
              placeholder="第xxxx回 BIG 高還元イベント"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">売上想定 (円)</span>
            <input
              value={salesYen}
              onChange={(event) => setSalesYen(event.currentTarget.value)}
              className={fieldClassName}
              inputMode="numeric"
              placeholder="8000000000"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">キャリー (円)</span>
            <input
              value={carryoverYen}
              onChange={(event) => setCarryoverYen(event.currentTarget.value)}
              className={fieldClassName}
              inputMode="numeric"
              placeholder="3000000000"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">還元率 (%)</span>
            <input
              value={returnRatePercent}
              onChange={(event) => setReturnRatePercent(event.currentTarget.value)}
              className={fieldClassName}
              inputMode="decimal"
              placeholder="50"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">投下額 (円)</span>
            <input
              value={spendYen}
              onChange={(event) => setSpendYen(event.currentTarget.value)}
              className={fieldClassName}
              inputMode="numeric"
              placeholder="10000"
            />
          </label>
          <label className="space-y-2 text-sm md:col-span-2 xl:col-span-1">
            <span className="font-medium text-slate-700">元ソースURL</span>
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.currentTarget.value)}
              className={fieldClassName}
              placeholder="https://..."
            />
          </label>
        </div>
      </SectionCard>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="概算EV"
          value={summary.approxEvMultiple !== null ? formatPercent(summary.approxEvMultiple) : "—"}
          hint="returnRate + carryover / totalSales"
          tone={summary.approxEvMultiple !== null && summary.approxEvMultiple >= 1 ? "positive" : "warning"}
        />
        <StatCard
          label="還元率からの上振れ"
          value={formatSignedPercent(summary.overReturnRate)}
          hint="キャリーがどれだけベース還元率を押し上げているか"
          tone="draw"
        />
        <StatCard
          label="損益分岐との差"
          value={
            summary.overBreakEven !== null ? formatSignedPercent(summary.overBreakEven) : "—"
          }
          hint="100% をどれだけ上回るか"
          tone={summary.overBreakEven !== null && summary.overBreakEven >= 0 ? "positive" : "warning"}
        />
        <StatCard
          label="投下額の期待損益"
          value={formatCurrency(summary.expectedProfitYen)}
          hint={`${formatCurrency(numericSpendYen)} を入れたときの概算`}
          tone="default"
        />
      </section>

      <SectionCard
        title="判断メモ"
        description="ベース還元率との差と、損益分岐まで届いているかを分けて見ます。"
      >
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[24px] border border-teal-200 bg-teal-50/80 p-5">
            <div className="flex items-center gap-2">
              <Badge tone="teal">ざっくり判定</Badge>
              <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                {eventLabel || "BIG イベント"}
              </h3>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <p>
                売上 {formatCurrency(numericSalesYen)} に対して、キャリー {formatCurrency(numericCarryoverYen)}
                は {formatPercent(summary.carryoverUplift)} の上乗せです。
              </p>
              <p>
                還元率 {formatPercent(numericReturnRate)} ベースだと、概算 EV は{" "}
                <span className="font-semibold text-slate-950">
                  {formatPercent(summary.approxEvMultiple)}
                </span>
                。損益分岐を超えるには、キャリー {formatCurrency(summary.breakEvenCarryoverYen)} が目安です。
              </p>
              <p>
                いまの差分は {formatCurrency(summary.breakEvenGapYen)} で、
                `平時の50%` に対しては {formatSignedPercent(summary.overReturnRate)}、
                `損益分岐100%` に対しては {formatSignedPercent(summary.overBreakEven)} です。
              </p>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5">
            <div className="flex items-center gap-2">
              <Badge tone="sky">シナリオ</Badge>
              <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                投下額ごとの概算
              </h3>
            </div>
            <div className="mt-4 space-y-3">
              {scenarioRows.map((row) => (
                <div
                  key={`scenario-${row.spendYen}`}
                  className="rounded-[18px] border border-white/80 bg-white/88 px-4 py-3 text-sm"
                >
                  <div className="font-semibold text-slate-900">{formatCurrency(row.spendYen)}</div>
                  <div className="mt-1 text-slate-600">
                    期待損益 {formatCurrency(row.expectedProfitYen)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="計算式"
        description="この monitor では、まず簡易式でイベントの熱さを掴みます。"
      >
        <div className="rounded-[24px] border border-slate-200 bg-slate-950 px-5 py-5 text-sm leading-7 text-slate-100">
          <p>EV倍率 ≈ returnRate + carryover / totalSales</p>
          <p>期待損益 ≈ 投下額 × (EV倍率 - 1)</p>
          <p>損益分岐キャリー ≈ totalSales × (1 - returnRate)</p>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          このページは、等級別配分や上限まで完全再現する厳密計算ではありません。まず
          `高還元イベントかどうか` を見極める一次判断用です。
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
          title="BIG Carryover Monitor を読み込み中"
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
