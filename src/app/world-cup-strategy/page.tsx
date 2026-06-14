"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";

import { ErrorNotice, LoadingNotice } from "@/components/app/states";
import {
  Badge,
  buttonClassName,
  PageHeader,
  SectionCard,
  secondaryButtonClassName,
  StatCard,
  cx,
} from "@/components/ui";
import { isDemoRoundTitle } from "@/lib/demo-data";
import { formatCurrency, formatPercent } from "@/lib/domain";
import { appRoute, buildOfficialRoundImportHref, buildRoundHref } from "@/lib/round-links";
import { resolveArtAsset } from "@/lib/ui-art";
import { useDashboardData } from "@/lib/use-app-data";
import {
  buildWorldCupStrategyDashboard,
  type WorldCupFinalSnapshotSummary,
  type WorldCupPortfolioPlan,
  type WorldCupPositiveEvCombo,
  type WorldCupRoundStrategy,
  type WorldCupTimingChecklistItem,
  type WorldCupRoundWindowStatus,
  type WorldCupStrategyLine,
  type WorldCupStrategyPick,
} from "@/lib/world-cup-strategy";

const reportFileName = "world-cup-toto-1634-close-report.pdf";

function statusTone(status: WorldCupRoundWindowStatus) {
  if (status === "selling") {
    return "positive" as const;
  }

  if (status === "upcoming") {
    return "sky" as const;
  }

  return "slate" as const;
}

function formatMultiple(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : `${value.toFixed(2)}倍`;
}

function formatCount(value: number | null | undefined) {
  return value === null || value === undefined ? "未確定" : value.toLocaleString("ja-JP");
}

function formatSignedCurrency(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${formatCurrency(value)}`;
}

function formatPayoutRange(plan: WorldCupPortfolioPlan) {
  if (plan.minPayoutIfHitYen === plan.maxPayoutIfHitYen) {
    return formatCurrency(plan.maxPayoutIfHitYen);
  }

  return `${formatCurrency(plan.minPayoutIfHitYen)} - ${formatCurrency(plan.maxPayoutIfHitYen)}`;
}

function pickSignature(picks: WorldCupStrategyPick[]) {
  return [...picks]
    .sort((left, right) => left.matchNo - right.matchNo)
    .map((pick) => pick.pick)
    .join("-");
}

function pickDetail(picks: WorldCupStrategyPick[]) {
  return [...picks]
    .sort((left, right) => left.matchNo - right.matchNo)
    .map((pick) => `${pick.matchNo}:${pick.pick}`)
    .join(" ");
}

function selectedPlan(round: WorldCupRoundStrategy, budgetYen: number) {
  return round.portfolioPlans.find((plan) => plan.budgetYen === budgetYen) ?? null;
}

function commandTone(round: WorldCupRoundStrategy) {
  if (round.windowStatus === "selling" && round.strictEvReady) {
    return "teal" as const;
  }

  if (round.windowStatus === "selling") {
    return "amber" as const;
  }

  return "slate" as const;
}

function MiniFact({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white/86 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-normal text-slate-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>
    </div>
  );
}

function PlainNotice({
  tone = "slate",
  title,
  children,
}: {
  children: ReactNode;
  title: string;
  tone?: "amber" | "slate" | "teal";
}) {
  const className =
    tone === "teal"
      ? "border-emerald-200 bg-emerald-50/82 text-emerald-950"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50/82 text-amber-950"
        : "border-slate-200 bg-slate-50/88 text-slate-800";

  return (
    <div className={cx("rounded-[22px] border px-5 py-4", className)}>
      <p className="font-semibold">{title}</p>
      <div className="mt-2 text-sm leading-6 opacity-85">{children}</div>
    </div>
  );
}

function TimingChecklist({ items }: { items: WorldCupTimingChecklistItem[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {items.map((item) => (
        <div
          key={`${item.timingLabel}-${item.actionLabel}`}
          className={cx(
            "rounded-[18px] border px-3 py-3",
            item.enabled
              ? "border-emerald-300 bg-emerald-50 text-emerald-950"
              : "border-slate-200 bg-white/78 text-slate-700",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={item.enabled ? "positive" : "slate"}>
              {item.enabled ? "今ここ" : item.timingLabel}
            </Badge>
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {item.label}
          </p>
          <p className="mt-1 text-sm font-semibold leading-5">{item.actionLabel}</p>
          {item.enabled ? (
            <p className="mt-1 text-xs leading-5 opacity-80">{item.timingLabel}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function CommandCenterPanel({ round }: { round: WorldCupRoundStrategy }) {
  const reviewHref = round.roundId ? buildRoundHref(appRoute.review, round.roundId) : null;
  const memoHref = round.roundId ? buildRoundHref(appRoute.matchEditor, round.roundId) : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <PlainNotice tone={commandTone(round)} title="今の状態">
          <p className="text-lg font-semibold text-slate-950">{round.commandStatusLabel}</p>
          <p className="mt-1">{round.recommendedActionDetail}</p>
        </PlainNotice>
        <PlainNotice tone={round.orthodoxDecisionLabel.includes("外す") ? "amber" : "slate"} title="王道判断">
          <p className="text-lg font-semibold text-slate-950">{round.orthodoxDecisionLabel}</p>
          <p className="mt-1">{round.orthodoxDecisionDetail}</p>
        </PlainNotice>
        <PlainNotice tone="teal" title="次にやること">
          <p className="text-lg font-semibold text-slate-950">{round.recommendedActionLabel}</p>
          {!memoHref ? (
            <p className="mt-2 text-sm leading-6">
              Round作成後、ここからボイスメモ文字起こしを貼って、Haziロジックの材料にできます。
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {memoHref ? (
              <Link href={memoHref} className={secondaryButtonClassName}>
                ボイスメモ文字起こしを貼る
              </Link>
            ) : (
              <Link
                href={buildOfficialRoundImportHref(null, {
                  productType: "toto13",
                  sourcePreset: "sp_toto_1634",
                })}
                className={secondaryButtonClassName}
              >
                公式回から作る
              </Link>
            )}
            {reviewHref ? (
              <Link href={reviewHref} className={secondaryButtonClassName}>
                感想戦を開く
              </Link>
            ) : null}
          </div>
        </PlainNotice>
      </div>

      <TimingChecklist items={round.timingChecklist} />
    </div>
  );
}

function PortfolioAnswerCard({ plan }: { plan: WorldCupPortfolioPlan }) {
  return (
    <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/82 px-5 py-4 shadow-[0_20px_54px_-38px_rgba(15,23,42,0.34)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            {plan.label}の答え
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">
            {plan.lineCount}通りを1口ずつ買う
          </h3>
        </div>
        <Badge tone={plan.meetsBudget ? "positive" : "warning"}>
          {plan.meetsBudget ? "購入額以上" : "購入額未満"}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MiniFact label="購入額" value={formatCurrency(plan.costYen)} hint={`${plan.lineCount}口 x ${formatCurrency(plan.stakeYen)}`} />
        <MiniFact label="期待回収" value={formatCurrency(plan.expectedReturnYen)} hint={`期待損益 ${formatSignedCurrency(plan.expectedProfitYen)}`} />
        <MiniFact label="13試合当たったら" value={formatPayoutRange(plan)} hint="選んだ出目ごとに払戻見込みは変わる" />
        <MiniFact label="100円が期待値で" value={formatCurrency(plan.expectedReturnYen / plan.lineCount)} hint={`EV ${formatMultiple(plan.evMultiple)}`} />
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-700">{plan.description}</p>
      {plan.unallocatedBudgetYen > 0 ? (
        <p className="mt-2 text-sm leading-6 text-amber-900">
          プラス期待値候補だけに絞るため、{formatCurrency(plan.unallocatedBudgetYen)}は無理に使いません。
        </p>
      ) : null}
    </div>
  );
}

function FirstAnswerPanel({ round, reportHref }: { reportHref: string; round: WorldCupRoundStrategy }) {
  const plan1000 = selectedPlan(round, 1000);
  const plan10000 = selectedPlan(round, 10000);

  return (
    <SectionCard
      title="まず答え"
      description="このページは購入履歴ではなく、公開データからの買い方試算です。誰が何を買ったか、決済情報、購入済み履歴は扱いません。"
      actions={
        <div className="flex flex-wrap gap-2">
          <a href={reportHref} className={buttonClassName}>
            PDFを見る
          </a>
          <a href={round.finalSnapshot?.sourceUrl ?? round.featured.sourceUrl} className={secondaryButtonClassName} target="_blank" rel="noreferrer">
            公式データ
          </a>
        </div>
      }
    >
      <CommandCenterPanel round={round} />

      <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <MiniFact label="一口" value={formatCurrency(round.stakeYen)} hint="toto13の1通りあたりの購入額" />
          <MiniFact label="10口" value={formatCurrency(round.stakeYen * 10)} hint="10通りを1口ずつ買う" />
          <MiniFact label="1万円" value={`${Math.floor(10000 / round.stakeYen)}口`} hint="100通りを1口ずつ買える" />
          <MiniFact label="買えた最後" value={round.lastBuyableAtLabel} hint={round.windowStatusLabel} />
        </div>

        <div className="space-y-4">
          {plan10000 ? <PortfolioAnswerCard plan={plan10000} /> : (
            <PlainNotice tone="amber" title="1万円プランはまだ出せません">
              <p>{round.strictEvMissingReasons.length > 0 ? round.strictEvMissingReasons.join(" / ") : "購入額を超える期待値候補がありません。"}</p>
            </PlainNotice>
          )}

          {plan1000 ? (
            <div className="rounded-[22px] border border-slate-200 bg-white/86 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-950">10口なら</h3>
                <Badge tone={plan1000.meetsBudget ? "positive" : "warning"}>
                  期待回収 {formatCurrency(plan1000.expectedReturnYen)}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                上位{plan1000.lineCount}通りを1口ずつ。購入額{formatCurrency(plan1000.costYen)}に対して、
                期待損益は{formatSignedCurrency(plan1000.expectedProfitYen)}です。
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}

function FinalSnapshotPanel({ snapshot }: { snapshot: WorldCupFinalSnapshotSummary }) {
  const topRows = [...snapshot.voteDriftRows]
    .sort((left, right) => Math.abs(right.maxDeltaPt) - Math.abs(left.maxDeltaPt))
    .slice(0, 6);

  return (
    <div className="rounded-[22px] border border-teal-200 bg-teal-50/78 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone="teal">確定値あり</Badge>
        <Badge tone="slate">{snapshot.sourceAsOfLabel}</Badge>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <MiniFact label="確定売上" value={formatCurrency(snapshot.totalSalesYen)} hint="1等払戻推定の土台" />
        <MiniFact label="初期比" value={snapshot.salesMultiple ? `${snapshot.salesMultiple.toFixed(2)}倍` : "-"} hint="保存時点からの売上増加" />
        <MiniFact label="最大ズレ" value={`${snapshot.maxAbsVoteShareDeltaPt.toFixed(2)}pt`} hint="公式人気率の変化" />
      </div>

      <div className="mt-4 overflow-x-auto pb-2">
        <table className="min-w-[760px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
              <th className="rounded-l-2xl bg-white/85 px-3 py-3">No</th>
              <th className="bg-white/85 px-3 py-3">試合</th>
              <th className="bg-white/85 px-3 py-3">初期本命</th>
              <th className="bg-white/85 px-3 py-3">確定本命</th>
              <th className="bg-white/85 px-3 py-3">最大ズレ</th>
              <th className="rounded-r-2xl bg-white/85 px-3 py-3">比率</th>
            </tr>
          </thead>
          <tbody>
            {topRows.map((row) => (
              <tr key={row.matchNo}>
                <td className="px-3 py-3 font-semibold text-slate-500">{row.matchNo}</td>
                <td className="px-3 py-3 font-semibold text-slate-900">{row.fixture}</td>
                <td className="px-3 py-3">{row.initialFavorite}</td>
                <td className="px-3 py-3">{row.finalFavorite}</td>
                <td className="px-3 py-3 font-semibold text-teal-700">
                  {row.maxDeltaOutcome} {row.maxDeltaPt >= 0 ? "+" : ""}
                  {row.maxDeltaPt.toFixed(2)}pt
                </td>
                <td className="px-3 py-3">
                  {formatPercent(row.initialShare, 2)} - {formatPercent(row.finalShare, 2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StrategyLineCard({ line }: { line: WorldCupStrategyLine }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white/82 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone={line.key === "value" ? "teal" : line.key === "orthodox" ? "amber" : "sky"}>
          {line.label}
        </Badge>
        <Badge tone={line.evMultiple !== null && line.evMultiple >= 1 ? "positive" : "slate"}>
          {formatMultiple(line.evMultiple)}
        </Badge>
      </div>
      <p className="mt-3 font-mono text-sm font-semibold tracking-normal text-slate-950">
        {pickSignature(line.picks)}
      </p>
      <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
        <p>13試合当たったら: {formatCurrency(line.estimatedPayoutYen)}</p>
        <p>1口あたり期待回収: {formatCurrency(line.expectedReturnYen)}</p>
        <p>的中率見込み: {formatPercent(line.hitProbability, 4)}</p>
        <p>公式人気順からのズレ: {line.deviationCount}試合</p>
      </div>
    </div>
  );
}

function TicketsTable({
  maxRows,
  rows,
}: {
  maxRows?: number;
  rows: WorldCupPositiveEvCombo[];
}) {
  const visibleRows = maxRows ? rows.slice(0, maxRows) : rows;

  return (
    <div className="space-y-3">
      <p className="text-xs leading-5 text-slate-500">
        横に長い場合はスクロールできます。出目はNo.1からNo.13までの順です。
      </p>
      <div className="overflow-x-auto pb-2">
        <table className="min-w-[1040px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
              <th className="rounded-l-2xl bg-slate-100 px-3 py-3">順</th>
              <th className="bg-slate-100 px-3 py-3">出目</th>
              <th className="bg-slate-100 px-3 py-3">買い方</th>
              <th className="bg-slate-100 px-3 py-3">期待回収</th>
              <th className="bg-slate-100 px-3 py-3">100円が期待値で</th>
              <th className="bg-slate-100 px-3 py-3">13試合当たったら</th>
              <th className="bg-slate-100 px-3 py-3">的中率</th>
              <th className="rounded-r-2xl bg-slate-100 px-3 py-3">人気重複</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr key={row.signature} className="border-b border-slate-100">
                <td className="px-3 py-3 font-semibold text-slate-500">{index + 1}</td>
                <td className="px-3 py-3">
                  <p className="font-mono font-semibold tracking-normal text-slate-950">
                    {pickSignature(row.picks)}
                  </p>
                  <p className="mt-1 font-mono text-xs tracking-normal text-slate-500">
                    {pickDetail(row.picks)}
                  </p>
                </td>
                <td className="px-3 py-3">1口 / 100円</td>
                <td className="px-3 py-3 font-semibold text-emerald-700">
                  {formatCurrency(row.expectedReturnYen)}
                </td>
                <td className="px-3 py-3">{formatCurrency(row.expectedReturnYen)}</td>
                <td className="px-3 py-3">{formatCurrency(row.estimatedPayoutYen)}</td>
                <td className="px-3 py-3">{formatPercent(row.hitProbability, 5)}</td>
                <td className="px-3 py-3">{formatPercent(row.publicProbability, 5)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoundStrategyCard({
  round,
  showCommandCenter = true,
}: {
  round: WorldCupRoundStrategy;
  showCommandCenter?: boolean;
}) {
  const roundHref = round.roundId ? buildRoundHref(appRoute.workspace, round.roundId) : null;
  const positiveCount = round.positiveEv.totalPositiveCount;
  const plan10000 = selectedPlan(round, 10000);

  return (
    <SectionCard
      title={`第${round.featured.roundNumber}回 toto`}
      description={round.roundTitle}
      actions={
        <div className="flex flex-wrap gap-2">
          <Badge tone={statusTone(round.windowStatus)}>{round.windowStatusLabel}</Badge>
          <Badge tone={round.strictEvReady ? "positive" : "slate"}>
            {round.strictEvReady ? "計算可" : "計算待ち"}
          </Badge>
          <Badge tone={round.usingFeaturedFallback ? "amber" : "teal"}>
            {round.calculationSourceLabel}
          </Badge>
        </div>
      }
    >
      {showCommandCenter ? <CommandCenterPanel round={round} /> : null}

      <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard
              compact
              label="買えた最後"
              value={round.lastBuyableAtLabel}
              hint={`発売 ${round.featured.salesStartAt.slice(5, 16).replace("T", " ")}`}
              tone={round.windowStatus === "closed" ? "default" : "positive"}
            />
            <StatCard
              compact
              label="購入額超え候補"
              value={formatCount(positiveCount)}
              hint={round.positiveEv.ready ? `${formatCount(round.positiveEv.evaluatedCount)}通り評価` : "未評価"}
              tone={positiveCount && positiveCount > 0 ? "positive" : "warning"}
            />
          </div>

          <PlainNotice tone={round.windowStatus === "closed" ? "slate" : "teal"} title={round.driftLabel}>
            <p>{round.driftDetail}</p>
            <p className="mt-1">
              保存時点: {round.snapshotLabel} / {round.snapshotGapToCloseLabel}
            </p>
          </PlainNotice>

          {round.finalSnapshot ? <FinalSnapshotPanel snapshot={round.finalSnapshot} /> : null}

          <div className="rounded-[22px] border border-slate-200 bg-white/82 px-4 py-4">
            <div className="grid gap-2 text-sm leading-6 text-slate-700">
              <p>試合数: {round.matchCount}/13</p>
              <p>公式投票率: {round.officialReadyCount}/{round.matchCount}</p>
              <p>モデル確率: {round.modelReadyCount}/{round.matchCount}</p>
              <p>EV計算売上: {formatCurrency(round.evAssumption?.totalSalesYen)}</p>
              <p>1口: {formatCurrency(round.stakeYen)}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {roundHref ? (
                <Link href={roundHref} className={secondaryButtonClassName}>
                  Roundを見る
                </Link>
              ) : (
                <Link
                  href={buildOfficialRoundImportHref(null, {
                    productType: "toto13",
                    sourcePreset: "sp_toto_1634",
                  })}
                  className={secondaryButtonClassName}
                >
                  公式回から作る
                </Link>
              )}
              <a
                href={round.featured.sourceUrl}
                className={secondaryButtonClassName}
                target="_blank"
                rel="noreferrer"
              >
                公式ソース
              </a>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {plan10000 ? (
            <PortfolioAnswerCard plan={plan10000} />
          ) : (
            <PlainNotice tone="amber" title="買う候補はまだ出せません">
              <p>{round.strictEvMissingReasons.join(" / ") || "購入額を上回る候補がありません。"}</p>
            </PlainNotice>
          )}

          {round.orthodoxLine ? (
            <div className="rounded-[24px] border border-amber-200 bg-amber-50/75 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone="amber">公式人気順で全部当たった場合</Badge>
                <Badge tone={round.orthodoxLine.evMultiple !== null && round.orthodoxLine.evMultiple >= 1 ? "positive" : "slate"}>
                  {formatMultiple(round.orthodoxLine.evMultiple)}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                <p>13試合当たったら: {formatCurrency(round.orthodoxLine.estimatedPayoutYen)}</p>
                <p>1口あたり期待回収: {formatCurrency(round.orthodoxLine.expectedReturnYen)}</p>
                <p>出目: {pickSignature(round.orthodoxLine.picks)}</p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            {round.lines.map((line) => (
              <StrategyLineCard key={line.key} line={line} />
            ))}
          </div>

          {round.strictEvMissingReasons.length > 0 ? (
            <PlainNotice tone="amber" title="足りない入力">
              <p>{round.strictEvMissingReasons.join(" / ")}</p>
            </PlainNotice>
          ) : null}
        </div>
      </div>

      {round.portfolioPlans.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {round.portfolioPlans.map((plan) => (
            <PortfolioAnswerCard key={plan.label} plan={plan} />
          ))}
        </div>
      ) : null}

      {round.primaryPortfolioPlan ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="positive">買うならこの順</Badge>
            <p className="text-sm text-slate-600">
              {round.primaryPortfolioPlan.label}プランの{round.primaryPortfolioPlan.lineCount}通り。すべて1口ずつです。
            </p>
          </div>
          <TicketsTable rows={round.primaryPortfolioPlan.rows} />
        </div>
      ) : round.positiveEv.ready ? (
        <PlainNotice tone="slate" title="購入額を超える候補なし">
          <p>この前提では、1口100円を期待回収で上回る組み合わせは見つかっていません。</p>
        </PlainNotice>
      ) : null}
    </SectionCard>
  );
}

export default function WorldCupStrategyPage() {
  const pathname = usePathname();
  const { data, error, loading, refresh } = useDashboardData();
  const strategy = useMemo(() => {
    if (!data) {
      return null;
    }

    return buildWorldCupStrategyDashboard({
      includePositiveCombos: true,
      positiveComboLimit: 120,
      rounds: data.rounds.filter((round) => !isDemoRoundTitle(round.title)),
    });
  }, [data]);

  if (loading && !data) {
    return <LoadingNotice title="W杯toto EV司令塔を読み込み中" />;
  }

  if (error && !data) {
    return <ErrorNotice error={error} onRetry={() => void refresh()} />;
  }

  if (!strategy) {
    return <LoadingNotice title="W杯toto EV司令塔を準備中" />;
  }

  const primaryRound = strategy.rounds.find((round) => round.featured.roundNumber === 1634) ?? strategy.rounds[0];
  const reportHref = resolveArtAsset(pathname, `/reports/${reportFileName}`);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="World Cup Toto"
        title="W杯toto EV司令塔"
        description="いつまで買えるか、どのタイミングで公式データを取り直すか、王道を外すか、10口や1万円ならどう置くかを先に見ます。"
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href={appRoute.dashboard} className={secondaryButtonClassName}>
              ダッシュボードへ
            </Link>
            <Link href={appRoute.hazi} className={secondaryButtonClassName}>
              Haziレビュー
            </Link>
            <a href={reportHref} className={buttonClassName}>
              PDF
            </a>
          </div>
        }
      />

      <FirstAnswerPanel round={primaryRound} reportHref={reportHref} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="W杯回作成"
          value={`${strategy.createdCount}/4`}
          hint="保存済みRound数。未作成でも内蔵プリセットで第1634回は試算します。"
          tone={strategy.createdCount === 4 ? "positive" : "warning"}
        />
        <StatCard
          label="買える回"
          value={strategy.buyableCount}
          hint={`${strategy.closedCount}回は販売終了`}
          tone={strategy.buyableCount > 0 ? "positive" : "default"}
        />
        <StatCard
          label="EV計算可"
          value={strategy.strictReadyCount}
          hint="売上・公式投票率・モデル確率が揃った回"
          tone={strategy.strictReadyCount > 0 ? "positive" : "warning"}
        />
        <StatCard
          label="購入額超え候補"
          value={formatCount(strategy.positiveEvComboCount)}
          hint={`保存時点 ${strategy.snapshotLabel}`}
          tone={strategy.positiveEvComboCount && strategy.positiveEvComboCount > 0 ? "positive" : "warning"}
        />
      </section>

      <PlainNotice tone="amber" title="読み方">
        <p>
          「期待回収」は平均的に何円戻る見込みかです。実際の利益を保証しません。
          今回は1等、つまり13試合すべて的中した場合だけで見ています。2等・3等はまだ足していません。
        </p>
      </PlainNotice>

      <div className="space-y-6">
        {strategy.rounds.map((round) => (
          <RoundStrategyCard
            key={round.featured.roundNumber}
            round={round}
            showCommandCenter={round.featured.roundNumber !== primaryRound.featured.roundNumber}
          />
        ))}
      </div>
    </div>
  );
}
