"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";

import { useDataMode } from "@/components/app/data-mode-provider";
import { ErrorNotice, LoadingNotice } from "@/components/app/states";
import {
  Badge,
  buttonClassName,
  HorizontalScrollTable,
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
  worldCupTotoBacktestRounds,
  worldCupTotoBacktestSummary,
  worldCupTotoInstructionSystem,
  worldCupTotoOptimizationReadiness,
  worldCupTotoOperatingSystemStatus,
  worldCupTotoUniverseBacktestRows,
} from "@/lib/world-cup-toto-backtest";
import {
  buildWorldCupStrategyDashboard,
  worldCupEvGlossaryRows,
  type WorldCupEvSourceRow,
  type WorldCupFinalSnapshotSummary,
  type WorldCupMarketEvComparisonRow,
  type WorldCupPortfolioPlan,
  type WorldCupPositiveEvCombo,
  type WorldCupOutcomePolicy,
  type WorldCupPredictionLogicRow,
  type WorldCupRoundStrategy,
  type WorldCupSecondPrizeCoverage,
  type WorldCupSourceStatus,
  type WorldCupTimingChecklistItem,
  type WorldCupRoundWindowStatus,
  type WorldCupStrategyLine,
  type WorldCupStrategyPick,
} from "@/lib/world-cup-strategy";
import {
  TOTO13_STAKE_YEN,
  worldCupToto1634Review,
  worldCupToto1635Review,
  worldCupToto1636Matches,
  worldCupToto1636NextPlan,
  worldCupToto1636PhaseDecision,
  worldCupToto1636PurchaseRows,
  worldCupToto1637ContextModel,
  worldCupToto1637ExternalMarketOverlay,
  worldCupToto1637FinalLogic,
  worldCupToto1637Matches,
  worldCupToto1637MultiPlans,
  worldCupToto1637NextPlan,
  worldCupTotoLatestReportFileName,
  worldCupTotoLegacyPurchaseSheetFileName,
  worldCupTotoOfficialVoteInterpretation,
  worldCupTotoOfficialSales1637Url,
  worldCupTotoOfficialVote1637Url,
  worldCupTotoPhaseHeuristics,
  worldCupTotoReportVersion,
  worldCupTotoVersionedPurchaseSheet200FileName,
  worldCupTotoVersionedPurchaseSheet50FileName,
  worldCupTotoVersionedPurchaseSheetFileName,
  worldCupTotoVersionedReportFileName,
} from "@/lib/world-cup-toto-review-plan";

const reportFileName = worldCupTotoLatestReportFileName;

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

function formatSignedPercentPoint(value: number) {
  const sign = value > 0 ? "+" : "";

  return `${sign}${(value * 100).toFixed(1)}pt`;
}

function compactProbabilities(probabilities: { "0": number; "1": number; "2": number }) {
  return `${formatPercent(probabilities["1"], 1)} / ${formatPercent(probabilities["0"], 1)} / ${formatPercent(
    probabilities["2"],
    1,
  )}`;
}

function formatCount(value: number | null | undefined) {
  return value === null || value === undefined ? "未確定" : value.toLocaleString("ja-JP");
}

function formatSignedCurrency(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${formatCurrency(value)}`;
}

function formatMaybeSignedCurrency(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : formatSignedCurrency(value);
}

function formatSignedMultiple(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}倍`;
}

function formatPayoutRange(plan: WorldCupPortfolioPlan) {
  if (plan.minPayoutIfHitYen === plan.maxPayoutIfHitYen) {
    return formatCurrency(plan.maxPayoutIfHitYen);
  }

  return `${formatCurrency(plan.minPayoutIfHitYen)} - ${formatCurrency(plan.maxPayoutIfHitYen)}`;
}

function formatPrizeTierExpectedReturn(
  tiers: readonly { expectedReturnYen: number | null; label: string }[],
) {
  return tiers.map((tier) => `${tier.label} ${formatCurrency(tier.expectedReturnYen)}`).join(" / ");
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

function policyTone(policy: WorldCupOutcomePolicy) {
  if (policy.kind === "actual_fixed" || policy.kind === "model_lock") {
    return "positive" as const;
  }

  if (policy.kind === "spread" || policy.kind === "value_fade") {
    return "amber" as const;
  }

  return "slate" as const;
}

function sourceStatusTone(status: WorldCupSourceStatus) {
  if (status === "fixed") {
    return "positive" as const;
  }

  if (status === "live" || status === "model") {
    return "teal" as const;
  }

  if (status === "research") {
    return "sky" as const;
  }

  return "amber" as const;
}

function sourceStatusLabel(status: WorldCupSourceStatus) {
  if (status === "fixed") return "確定";
  if (status === "live") return "取得";
  if (status === "model") return "モデル";
  if (status === "research") return "研究";
  return "不足";
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

function outcomeLabel(value: string) {
  if (value === "1") return "ホーム勝ち";
  if (value === "0") return "引き分け";
  if (value === "2") return "アウェイ勝ち";
  return value;
}

function prizeTierLabel(value: string) {
  if (value === "1st") return "1等";
  if (value === "2nd") return "2等";
  if (value === "3rd") return "3等";
  return "外れ";
}

function coverageDistanceLabel(coverage: WorldCupSecondPrizeCoverage) {
  if (!coverage.ready) {
    return coverage.skippedReason ?? "未計算";
  }

  return coverage.worstDistanceToPortfolio === null
    ? "未計算"
    : `${coverage.worstDistanceToPortfolio}試合差以内`;
}

function SecondPrizeCoveragePanel({ coverage }: { coverage: WorldCupSecondPrizeCoverage }) {
  return (
    <div className="rounded-[24px] border border-cyan-200 bg-cyan-50/80 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-800">
            バラ買い2等保証チェック
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">{coverage.label}</h3>
        </div>
        <Badge tone={coverage.guaranteedSecondPrize ? "positive" : "sky"}>
          {coverage.guaranteedSecondPrize ? "2等保証" : "カバー率"}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniFact
          label="2等カバー"
          value={coverage.ready ? formatPercent(coverage.secondPrizeCoverageRate, 1) : "未計算"}
          hint={
            coverage.ready
              ? `${coverage.secondPrizeCoveredCount}/${coverage.universeCount}通りが距離1以内`
              : coverage.skippedReason ?? "候補不足"
          }
        />
        <MiniFact
          label="3等圏内"
          value={coverage.ready ? formatPercent(coverage.thirdPrizeCoverageRate, 1) : "未計算"}
          hint="距離2以内まで含めた面の広さ"
        />
        <MiniFact
          label="候補宇宙"
          value={coverage.ready ? `${coverage.universeCount.toLocaleString("ja-JP")}通り` : "未計算"}
          hint="結果固定/ロック/分散後の探索範囲"
        />
        <MiniFact
          label="最大ズレ"
          value={coverageDistanceLabel(coverage)}
          hint="100%なら候補宇宙内で最低2等"
        />
      </div>

      <p className="mt-4 text-sm leading-6 text-cyan-950/85">
        これは全3^13通りの万能保証ではなく、この画面で宣言した候補宇宙に対するカバー率です。
        買い目と合わせて、どの面を広げるべきかを感想戦で議論します。
      </p>
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

function StorageModeNotice({
  isChecking,
  mode,
}: {
  isChecking: boolean;
  mode: "cloudflare_d1" | "demo" | "local";
}) {
  const isShared = mode === "cloudflare_d1";

  return (
    <PlainNotice tone={isShared ? "teal" : "amber"} title="保存と友人の編集履歴">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={isShared ? "teal" : "amber"}>
          {isChecking ? "確認中" : isShared ? "共有D1保存" : mode === "demo" ? "デモ" : "ローカル保存"}
        </Badge>
        <span>
          {isShared
            ? "このラウンドは共有保存です。友人の編集やメモは同じ共有データに残ります。"
            : "この画面はこのブラウザ内の保存です。友人が別PC/別ブラウザで触った内容はここには出ません。JSON共有か共有D1リンクが必要です。"}
        </span>
      </div>
    </PlainNotice>
  );
}

function riskBucketLabel(bucket: "flex" | "lock" | "semi" | "spread") {
  if (bucket === "lock") return "固定";
  if (bucket === "semi") return "準固定";
  if (bucket === "spread") return "分散";
  return "柔軟";
}

function riskBucketTone(bucket: "flex" | "lock" | "semi" | "spread") {
  if (bucket === "lock") return "positive" as const;
  if (bucket === "semi") return "teal" as const;
  if (bucket === "spread") return "amber" as const;
  return "sky" as const;
}

function contextFactorLabelList(factors: readonly { label: string }[]) {
  return factors.map((factor) => factor.label).join(" / ");
}

function instructionStatusLabel(status: "implemented" | "next" | "partial") {
  if (status === "implemented") return "反映済み";
  if (status === "partial") return "途中";
  return "次に実装";
}

function instructionStatusTone(status: "implemented" | "next" | "partial") {
  if (status === "implemented") return "positive" as const;
  if (status === "partial") return "amber" as const;
  return "slate" as const;
}

function OperatingSystemBacktestPanel() {
  const implementedRows = worldCupTotoInstructionSystem.filter(
    (row) => row.implementationStatus === "implemented",
  );
  const remainingRows = worldCupTotoInstructionSystem.filter(
    (row) => row.implementationStatus !== "implemented",
  );

  return (
    <SectionCard
      title="指示の棚卸しとバックテスト"
      description="これまでの要望を、運用原則、実装状態、過去回検証に分けました。次はこの表を見ながら、Haziの感想戦を重みに変えます。"
      actions={
        <div className="flex flex-wrap gap-2">
          <Badge tone="teal">logic system</Badge>
          <Badge tone="amber">backtest</Badge>
          <Badge tone="slate">Hazi loop</Badge>
        </div>
      }
    >
      <div className="grid gap-3 md:grid-cols-4">
        <MiniFact
          label="整理状態"
          value={worldCupTotoOperatingSystemStatus.cleanScoreLabel}
          hint={worldCupTotoOperatingSystemStatus.summary}
        />
        <MiniFact
          label="反映済み"
          value={`${worldCupTotoOperatingSystemStatus.implementedCount}件`}
          hint={implementedRows.map((row) => row.label).join(" / ")}
        />
        <MiniFact
          label="次に詰める"
          value={`${worldCupTotoOperatingSystemStatus.nextCount}件`}
          hint={remainingRows.map((row) => row.label).join(" / ")}
        />
        <MiniFact
          label="検証済み回"
          value={`${worldCupTotoBacktestSummary.knownResultRoundCount}回`}
          hint="1634/1635は同じ評価関数で再現済み。1636/1637は結果確定後に追加する。"
        />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="min-w-0 overflow-x-auto rounded-[22px] border border-slate-200 bg-white/82">
          <table className="min-w-[720px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-3 py-3">指示</th>
                <th className="px-3 py-3">状態</th>
                <th className="px-3 py-3">運用ルール</th>
              </tr>
            </thead>
            <tbody>
              {worldCupTotoInstructionSystem.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 align-top">
                    <p className="font-semibold text-slate-950">{row.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{row.userNeed}</p>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <Badge tone={instructionStatusTone(row.implementationStatus)}>
                      {instructionStatusLabel(row.implementationStatus)}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 align-top text-slate-700">{row.operatingRule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="min-w-0 overflow-x-auto rounded-[22px] border border-slate-200 bg-white/82">
          <table className="min-w-[680px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-3 py-3">回</th>
                <th className="px-3 py-3">比較対象</th>
                <th className="px-3 py-3">最良ズレ</th>
                <th className="px-3 py-3">購入額</th>
                <th className="px-3 py-3">実戻り</th>
              </tr>
            </thead>
            <tbody>
              {worldCupTotoBacktestRounds.flatMap((round) =>
                round.portfolios.map((portfolio) => (
                  <tr key={`${round.roundNumber}-${portfolio.id}`} className="border-t border-slate-100">
                    <td className="px-3 py-3 align-top font-semibold text-slate-950">
                      {round.label}
                      <p className="mt-1 text-xs font-normal text-slate-500">
                        人気順 {round.publicFavoriteMisses}ズレ
                      </p>
                    </td>
                    <td className="px-3 py-3 align-top text-slate-700">{portfolio.label}</td>
                    <td className="px-3 py-3 align-top font-semibold text-slate-900">
                      {portfolio.bestMisses}試合
                    </td>
                    <td className="px-3 py-3 align-top text-slate-700">{formatCurrency(portfolio.costYen)}</td>
                    <td className="px-3 py-3 align-top font-semibold text-slate-900">
                      {formatCurrency(portfolio.actualReturnYen)}
                      <p className="mt-1 text-xs font-normal text-slate-500">
                        {portfolio.realizedMultiple.toFixed(2)}倍 / {portfolio.cashHitCount}本
                      </p>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 min-w-0 overflow-x-auto rounded-[22px] border border-slate-200 bg-white/82">
        <table className="min-w-[880px] text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <th className="px-3 py-3">回</th>
              <th className="px-3 py-3">局面</th>
              <th className="px-3 py-3">候補生成</th>
              <th className="px-3 py-3">候補数</th>
              <th className="px-3 py-3">全買い額</th>
              <th className="px-3 py-3">最良ズレ</th>
              <th className="px-3 py-3">実結果</th>
              <th className="px-3 py-3">ルール</th>
            </tr>
          </thead>
          <tbody>
            {worldCupTotoUniverseBacktestRows.map((row) => (
              <tr key={`${row.roundNumber}-${row.strategyKind}`} className="border-t border-slate-100">
                <td className="px-3 py-3 align-top font-semibold text-slate-950">第{row.roundNumber}回</td>
                <td className="px-3 py-3 align-top text-slate-700">{row.phaseLabel}</td>
                <td className="px-3 py-3 align-top font-semibold text-slate-900">{row.label}</td>
                <td className="px-3 py-3 align-top text-slate-700">
                  {row.universeLineCount.toLocaleString("ja-JP")}口
                </td>
                <td className="px-3 py-3 align-top text-slate-700">{formatCurrency(row.fullCoverageCostYen)}</td>
                <td className="px-3 py-3 align-top font-semibold text-slate-900">{row.bestMisses}試合</td>
                <td className="px-3 py-3 align-top">
                  <Badge tone={row.actualIncluded ? "positive" : "slate"}>
                    {row.actualIncluded ? "含んだ" : "外した"}
                  </Badge>
                </td>
                <td className="px-3 py-3 align-top text-slate-600">{row.policySummary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PlainNotice tone="amber" title={worldCupTotoOptimizationReadiness.statusLabel}>
        <p>{worldCupTotoOptimizationReadiness.summary}</p>
      </PlainNotice>

      <PlainNotice tone="teal" title="次の最適ロジック">
        <ul className="list-disc space-y-1 pl-5">
          {worldCupTotoBacktestSummary.nextOptimizationSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </PlainNotice>
    </SectionCard>
  );
}

function NextWorldCupToto1637Panel({
  reportHref,
  versionedPurchaseSheet200Href,
  versionedPurchaseSheet50Href,
  versionedPurchaseSheetHref,
  versionedReportHref,
}: {
  reportHref: string;
  versionedPurchaseSheet200Href: string;
  versionedPurchaseSheet50Href: string;
  versionedPurchaseSheetHref: string;
  versionedReportHref: string;
}) {
  const standardMultiPlan = worldCupToto1637MultiPlans.find((plan) => plan.label === "1万円級");
  const wideMultiPlan = worldCupToto1637MultiPlans.find((plan) => plan.label === "200口以内広め");
  const marketStandardPlan = worldCupToto1637ExternalMarketOverlay.marketAdjustedPlans.find(
    (plan) => plan.label === "市場補強108口",
  );
  const marketWidePlan = worldCupToto1637ExternalMarketOverlay.marketAdjustedPlans.find(
    (plan) => plan.label === "市場補強162口",
  );
  const externalPriorityRows = worldCupToto1637ExternalMarketOverlay.comparisonRows
    .filter(
      (row) =>
        row.actionLabel.includes("最優先") ||
        row.actionLabel.includes("全分散") ||
        row.actionLabel.includes("広げる") ||
        row.actionLabel.includes("日本人気") ||
        row.actionLabel.includes("0を足す") ||
        row.actionLabel.includes("薄め"),
    )
    .slice(0, 5);

  return (
    <SectionCard
      title="第1637回 いつ買う・何を買う"
      description="暫定結論は、今すぐ買わずに締切直前で再計算。買い方はCSV行ではなく、M01-M13のマルチ指定で口数と金額を確認します。"
      actions={
        <div className="flex flex-wrap gap-2">
          <a href={reportHref} className={buttonClassName}>
            最新PDF
          </a>
          <a href={worldCupTotoOfficialVote1637Url} className={secondaryButtonClassName} rel="noreferrer" target="_blank">
            公式投票率
          </a>
          <a href={worldCupTotoOfficialSales1637Url} className={secondaryButtonClassName} rel="noreferrer" target="_blank">
            販売期間
          </a>
        </div>
      }
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <MiniFact
          label="買う窓"
          value={worldCupToto1637NextPlan.recommendedPurchaseWindowLabel.replace("2026-06-25 ", "")}
          hint={`先に${worldCupToto1637NextPlan.purchaseFreezeLabel}で再計算`}
        />
        <MiniFact
          label="締切"
          value={worldCupToto1637NextPlan.purchaseDeadlineLabel.replace("2026-06-25 ", "")}
          hint={`${worldCupToto1637NextPlan.hardStopLabel}で操作を止める`}
        />
        <MiniFact
          label="暫定確定"
          value={`${marketStandardPlan?.unitCount ?? 108}口 / ${formatCurrency(
            marketStandardPlan?.budgetYen ?? 10_800,
          )}`}
          hint={worldCupToto1637FinalLogic.selectedPlanLabel}
        />
        <MiniFact
          label="標準マルチ"
          value={`${standardMultiPlan?.unitCount ?? 108}口 / ${formatCurrency(
            standardMultiPlan?.budgetYen ?? 10_800,
          )}`}
          hint="M04/M07/M10全分散 + M02/M05ドロー"
        />
        <MiniFact
          label="広めマルチ"
          value={`${wideMultiPlan?.unitCount ?? 162}口 / ${formatCurrency(
            wideMultiPlan?.budgetYen ?? 16_200,
          )}`}
          hint="200口以内でM05も全分散"
        />
        <MiniFact
          label="候補宇宙"
          value={`${worldCupToto1637NextPlan.coreLineCount.toLocaleString("ja-JP")}通り`}
          hint="ロック/準固定/分散で絞った後の全候補"
        />
        <MiniFact
          label="現時点売上"
          value={formatCurrency(worldCupToto1637NextPlan.totalSalesYen)}
          hint={`${worldCupToto1637NextPlan.salesAsOfLabel}時点`}
        />
        <MiniFact
          label="投票数"
          value={`${worldCupToto1637NextPlan.voteUnits.toLocaleString("ja-JP")}口`}
          hint={`${worldCupToto1637NextPlan.voteAsOfLabel}時点`}
        />
      </div>

      <PlainNotice tone="teal" title="なぜギリギリまで待つか">
        <p>
          totoは固定オッズではなく、同じ出目に何人いるかで払戻が変わります。
          公式投票率と売上が締切前に動くほど、早い時点のEV推定はズレます。
          だから 1637 は今のPDF/マルチ表をたたき台にして、6/25夕方に同じロジックで差し替えます。
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {worldCupTotoReportVersion.label} 固定リンク:{" "}
          <a className="font-semibold underline underline-offset-4" href={versionedReportHref}>
            PDF
          </a>{" "}
          / 補助CSV{" "}
          <a className="font-semibold underline underline-offset-4" href={versionedPurchaseSheet50Href}>
            50
          </a>{" "}
          /{" "}
          <a className="font-semibold underline underline-offset-4" href={versionedPurchaseSheetHref}>
            100
          </a>{" "}
          /{" "}
          <a className="font-semibold underline underline-offset-4" href={versionedPurchaseSheet200Href}>
            200
          </a>
        </p>
      </PlainNotice>

      <PlainNotice tone="teal" title={worldCupTotoOfficialVoteInterpretation.label}>
        <p>{worldCupTotoOfficialVoteInterpretation.note}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
          {worldCupTotoOfficialVoteInterpretation.signals.map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>
      </PlainNotice>

      <PlainNotice tone="teal" title={worldCupToto1637ContextModel.label}>
        <p>{worldCupToto1637ContextModel.summary}</p>
        <div className="mt-3 grid gap-2 md:grid-cols-5">
          {worldCupToto1637ContextModel.factors.map((factor) => (
            <div key={factor.key} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-sm font-semibold text-slate-950">{factor.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{factor.note}</p>
            </div>
          ))}
        </div>
      </PlainNotice>

      <PlainNotice tone="amber" title="外部市場補強: 公式とどれくらい違うか">
        <p>{worldCupToto1637ExternalMarketOverlay.summary}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <MiniFact
            label="外部ソース"
            value="Polymarket"
            hint={`${worldCupToto1637ExternalMarketOverlay.fetchedAtLabel}取得`}
          />
          <MiniFact
            label="標準反映"
            value={`${marketStandardPlan?.unitCount ?? 108}口 / ${formatCurrency(
              marketStandardPlan?.budgetYen ?? 10_800,
            )}`}
            hint="M01/M05/M13へ分散を移す"
          />
          <MiniFact
            label="広め反映"
            value={`${marketWidePlan?.unitCount ?? 162}口 / ${formatCurrency(marketWidePlan?.budgetYen ?? 16_200)}`}
            hint="200口以内の市場補強案"
          />
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Haziコメントなしの前提では、人間メモ重みは0にして、公式投票率、Polymarket価格、W杯コンテキストだけで見る。
          締切直前も同じ差分なら、通常の1万円級より市場補強108口を優先候補にする。
        </p>
      </PlainNotice>

      <PlainNotice tone="teal" title={worldCupToto1637FinalLogic.label}>
        <p>{worldCupToto1637FinalLogic.summary}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
          {worldCupToto1637FinalLogic.backtestSignals.map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>
        <p className="mt-2 text-sm leading-6 text-slate-700">{worldCupToto1637FinalLogic.deadlineAction}</p>
      </PlainNotice>

      <HorizontalScrollTable className="mt-5 min-w-0" contentClassName="rounded-[22px] border border-amber-200 bg-white/86">
        <table className="min-w-[920px] text-left text-sm">
          <thead className="bg-amber-50 text-xs uppercase tracking-[0.16em] text-amber-700">
            <tr>
              <th className="px-3 py-3">No</th>
              <th className="px-3 py-3">試合</th>
              <th className="px-3 py-3">公式 1/0/2</th>
              <th className="px-3 py-3">Polymarket 1/0/2</th>
              <th className="px-3 py-3">最大差分</th>
              <th className="px-3 py-3">最終選択への反映</th>
            </tr>
          </thead>
          <tbody>
            {externalPriorityRows.map((row) => (
              <tr key={row.matchNo} className="border-t border-amber-100">
                <td className="px-3 py-3 font-semibold text-slate-950">{row.matchNo}</td>
                <td className="px-3 py-3 text-slate-700">
                  {row.matchLabel}
                  <p className="mt-1 text-xs text-slate-500">
                    fav {outcomeLabel(row.officialFavoriteOutcome)} → {outcomeLabel(row.marketFavoriteOutcome)}
                  </p>
                </td>
                <td className="px-3 py-3 font-mono text-xs text-slate-600">{compactProbabilities(row.officialProb)}</td>
                <td className="px-3 py-3 font-mono text-xs text-slate-900">{compactProbabilities(row.marketProb)}</td>
                <td className="px-3 py-3 font-semibold text-amber-800">
                  {outcomeLabel(row.strongestPositiveDeltaOutcome)}{" "}
                  {formatSignedPercentPoint(row.delta[row.strongestPositiveDeltaOutcome])}
                </td>
                <td className="px-3 py-3 text-xs leading-relaxed text-slate-700">{row.actionLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </HorizontalScrollTable>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <HorizontalScrollTable className="min-w-0" contentClassName="rounded-[22px] border border-slate-200 bg-white/82">
          <table className="min-w-[600px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-3 py-3">時刻</th>
                <th className="px-3 py-3">やること</th>
                <th className="px-3 py-3">担当</th>
              </tr>
            </thead>
            <tbody>
              {worldCupToto1637NextPlan.workflow.map((step) => (
                <tr key={step.timeLabel} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-950">{step.timeLabel}</td>
                  <td className="px-3 py-3 text-slate-700">{step.action}</td>
                  <td className="px-3 py-3">
                    <Badge tone={step.owner === "system" ? "teal" : "slate"}>{step.owner}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </HorizontalScrollTable>

        <HorizontalScrollTable className="min-w-0" contentClassName="rounded-[22px] border border-slate-200 bg-white/82">
          <table className="min-w-[860px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-3 py-3">No</th>
                <th className="px-3 py-3">W杯補正</th>
                <th className="px-3 py-3">試合</th>
                <th className="px-3 py-3">公式 1/0/2</th>
                <th className="px-3 py-3">残す出目</th>
                <th className="px-3 py-3">区分</th>
              </tr>
            </thead>
            <tbody>
              {worldCupToto1637Matches.map((match) => (
                <tr key={match.matchNo} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-semibold text-slate-950">{match.matchNo}</td>
                  <td className="px-3 py-3 text-xs leading-relaxed text-slate-600">
                    <span className="font-semibold text-slate-800">{match.matchdayContextLabel}</span>
                    <p className="mt-1">{contextFactorLabelList(match.contextFactors)}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {match.home} vs {match.away}
                    <p className="mt-1 text-xs text-slate-500">{match.kickoffLabel} / {match.ruleLabel}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    {formatPercent(match.votes["1"], 1)} / {formatPercent(match.votes["0"], 1)} /{" "}
                    {formatPercent(match.votes["2"], 1)}
                  </td>
                  <td className="px-3 py-3 font-semibold text-slate-900">
                    {match.recommendedOutcomes.map(outcomeLabel).join(" / ")}
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={riskBucketTone(match.riskBucket)}>{riskBucketLabel(match.riskBucket)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </HorizontalScrollTable>
      </div>

      <HorizontalScrollTable className="mt-5 min-w-0" contentClassName="rounded-[22px] border border-slate-200 bg-white/82">
        <table className="min-w-[860px] text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <th className="px-3 py-3">プラン</th>
              <th className="px-3 py-3">M01-M04</th>
              <th className="px-3 py-3">M05-M08</th>
              <th className="px-3 py-3">M09-M13</th>
              <th className="px-3 py-3">計算</th>
              <th className="px-3 py-3">合計</th>
              <th className="px-3 py-3">金額</th>
              <th className="px-3 py-3">メモ</th>
            </tr>
          </thead>
          <tbody>
            {worldCupToto1637MultiPlans.map((plan) => (
              <tr key={plan.label} className="border-t border-slate-100">
                <td className="px-3 py-3 font-semibold text-slate-950">{plan.label}</td>
                <td className="px-3 py-3 font-mono text-sm text-slate-900">{plan.choices.slice(0, 4).join(" ")}</td>
                <td className="px-3 py-3 font-mono text-sm text-slate-900">{plan.choices.slice(4, 8).join(" ")}</td>
                <td className="px-3 py-3 font-mono text-sm text-slate-900">{plan.choices.slice(8, 13).join(" ")}</td>
                <td className="px-3 py-3 font-mono text-xs text-slate-600">{plan.formula}</td>
                <td className="px-3 py-3 font-semibold text-slate-900">{plan.unitCount.toLocaleString("ja-JP")}口</td>
                <td className="px-3 py-3 font-semibold text-slate-900">{formatCurrency(plan.budgetYen)}</td>
                <td className="px-3 py-3 text-xs leading-relaxed text-slate-600">{plan.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </HorizontalScrollTable>

      <HorizontalScrollTable className="mt-4 min-w-0" contentClassName="rounded-[22px] border border-amber-200 bg-white/86">
        <table className="min-w-[860px] text-left text-sm">
          <thead className="bg-amber-50 text-xs uppercase tracking-[0.16em] text-amber-700">
            <tr>
              <th className="px-3 py-3">市場反映プラン</th>
              <th className="px-3 py-3">M01-M04</th>
              <th className="px-3 py-3">M05-M08</th>
              <th className="px-3 py-3">M09-M13</th>
              <th className="px-3 py-3">合計</th>
              <th className="px-3 py-3">金額</th>
              <th className="px-3 py-3">メモ</th>
            </tr>
          </thead>
          <tbody>
            {worldCupToto1637ExternalMarketOverlay.marketAdjustedPlans.map((plan) => (
              <tr key={plan.label} className="border-t border-amber-100">
                <td className="px-3 py-3 font-semibold text-slate-950">{plan.label}</td>
                <td className="px-3 py-3 font-mono text-sm text-slate-900">{plan.choices.slice(0, 4).join(" ")}</td>
                <td className="px-3 py-3 font-mono text-sm text-slate-900">{plan.choices.slice(4, 8).join(" ")}</td>
                <td className="px-3 py-3 font-mono text-sm text-slate-900">{plan.choices.slice(8, 13).join(" ")}</td>
                <td className="px-3 py-3 font-semibold text-slate-900">{plan.unitCount.toLocaleString("ja-JP")}口</td>
                <td className="px-3 py-3 font-semibold text-slate-900">{formatCurrency(plan.budgetYen)}</td>
                <td className="px-3 py-3 text-xs leading-relaxed text-slate-700">{plan.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </HorizontalScrollTable>

      <PlainNotice tone="slate" title="共有リンクの使い分け">
        <p>
          友人と見る時は最新PDF/CSVで十分です。資料を磨いたら latest は差し替わります。
          感想戦で固定版を引用する時だけ{" "}
          <a className="font-semibold underline underline-offset-4" href={versionedReportHref}>
            固定PDF
          </a>{" "}
          /{" "}
          <a className="font-semibold underline underline-offset-4" href={versionedPurchaseSheetHref}>
            固定CSV
          </a>{" "}
          を使います。
        </p>
      </PlainNotice>
    </SectionCard>
  );
}

function LatestWorldCupTotoPanel({
  purchaseSheetHref,
  reportHref,
  versionedPurchaseSheetHref,
  versionedReportHref,
}: {
  purchaseSheetHref: string;
  reportHref: string;
  versionedPurchaseSheetHref: string;
  versionedReportHref: string;
}) {
  const previewRows = worldCupToto1636PurchaseRows.slice(0, 12);

  return (
    <SectionCard
      title="1634-1636 感想戦"
      description="1637へ進む前に、1634の反省、1635の確認、1636の買い方を見直します。"
      actions={
        <div className="flex flex-wrap gap-2">
          <a href={reportHref} className={buttonClassName}>
            最新PDF
          </a>
          <a href={versionedReportHref} className={secondaryButtonClassName}>
            固定版PDF
          </a>
          <a href={purchaseSheetHref} className={secondaryButtonClassName}>
            1636履歴CSV
          </a>
        </div>
      }
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <MiniFact label="1口" value={formatCurrency(TOTO13_STAKE_YEN)} hint="toto13は1通りを1口ずつバラで置くのが基本" />
        <MiniFact
          label="1634前PDF"
          value={`最良${worldCupToto1634Review.previousReportBestDistance}ズレ`}
          hint={`前PDFのEV候補${worldCupToto1634Review.previousReportPositiveLineCount}本は払戻圏外。強人気ドロー事故を拾えていない`}
        />
        <MiniFact
          label="1635回 人気順"
          value={`${prizeTierLabel(worldCupToto1635Review.publicFavoritePrize.label)} / ${formatCurrency(
            worldCupToto1635Review.publicFavoritePrize.payoutYen,
          )}`}
          hint={`人気順 ${worldCupToto1635Review.publicFavoriteSignature} は実結果から${worldCupToto1635Review.publicFavoriteMisses}試合ズレ`}
        />
        <MiniFact
          label="1636回 推奨"
          value={`${worldCupToto1636NextPlan.recommendedUnitCount}口 / ${formatCurrency(
            worldCupToto1636NextPlan.recommendedBudgetYen,
          )}`}
          hint={`ドロー20%以上を候補化。候補${worldCupToto1636NextPlan.coreLineCount}通り、表示シートは${formatCurrency(
            worldCupToto1636NextPlan.maxDiscussionBudgetYen,
          )}上限。締切 ${worldCupToto1636NextPlan.purchaseDeadlineLabel}`}
        />
        <MiniFact
          label="半自動"
          value="CSV転記"
          hint="公式ランダムは別戦略。ログイン/購入/決済の自動化はしない"
        />
        <MiniFact
          label="版管理"
          value={worldCupTotoReportVersion.label}
          hint="latestは差し替え用。固定版PDF/CSVは感想戦と比較用に残す"
        />
      </div>

      <PlainNotice tone="teal" title="Haziロジック: W杯の何戦目かで荒れ方を見る">
        <p>
          {worldCupToto1636PhaseDecision.summary}
          これは買い目を変える絶対ルールではなく、強人気を固定するか、ドローや逆側を残すかを決めるための補助線です。
        </p>
        <HorizontalScrollTable className="mt-3">
          <table className="min-w-[760px] text-left text-sm">
            <thead className="border-b border-emerald-900/15 text-xs uppercase tracking-[0.16em] text-emerald-950/60">
              <tr>
                <th className="px-2 py-2">対象</th>
                <th className="px-2 py-2">読み</th>
                <th className="px-2 py-2">使い方</th>
              </tr>
            </thead>
            <tbody>
              {worldCupTotoPhaseHeuristics.map((row) => (
                <tr key={row.phase} className="border-b border-emerald-900/10 last:border-0">
                  <td className="px-2 py-2 align-top">
                    <span className="font-semibold text-emerald-950">{row.appliesTo}</span>
                    <span className="mt-1 block text-xs text-emerald-900/65">{row.riskLabel}</span>
                  </td>
                  <td className="px-2 py-2 align-top text-emerald-950/80">{row.read}</td>
                  <td className="px-2 py-2 align-top text-emerald-950/80">{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </HorizontalScrollTable>
      </PlainNotice>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <HorizontalScrollTable className="min-w-0" contentClassName="rounded-[22px] border border-slate-200 bg-white/82">
          <table className="min-w-[720px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-3 py-3">順位</th>
                <th className="px-3 py-3">買い目</th>
                <th className="px-3 py-3">口数</th>
                <th className="px-3 py-3">区分</th>
                <th className="px-3 py-3">累計</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row) => (
                <tr key={row.signature} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-semibold text-slate-950">{row.rank}</td>
                  <td className="px-3 py-3 font-mono text-sm text-slate-900">{row.signature}</td>
                  <td className="px-3 py-3 font-semibold text-slate-900">{row.unitCount}</td>
                  <td className="px-3 py-3">
                    <Badge tone={row.bucket === "hot" || row.bucket === "core" ? "positive" : "slate"}>
                      {row.bucket === "hot" ? "激アツ2口" : row.bucket === "core" ? "推奨コア" : "追加ヘッジ"}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 font-semibold text-slate-900">
                    {formatCurrency(row.amountCumulativeYen)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </HorizontalScrollTable>

        <HorizontalScrollTable className="min-w-0" contentClassName="rounded-[22px] border border-slate-200 bg-white/82">
          <table className="min-w-[520px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-3 py-3">No</th>
                <th className="px-3 py-3">試合</th>
                <th className="px-3 py-3">残す出目</th>
              </tr>
            </thead>
            <tbody>
              {worldCupToto1636Matches.map((match) => (
                <tr key={match.matchNo} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-semibold text-slate-950">{match.matchNo}</td>
                  <td className="px-3 py-3 text-slate-700">
                    {match.home} vs {match.away}
                    <p className="mt-1 text-xs text-slate-500">{match.ruleLabel}</p>
                  </td>
                  <td className="px-3 py-3 font-semibold text-slate-900">
                    {match.recommendedOutcomes.map(outcomeLabel).join(" / ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </HorizontalScrollTable>
      </div>

      <PlainNotice tone="slate" title="買い方メモ">
        <p>
          CSVの <span className="font-semibold">unit_count=2</span> だけ同じ買い目を2口、残りは1口で転記します。
          公式のランダム/らくらく購入は使えますが、この推奨リストとは別物です。
          ログイン、購入確定、決済の自動化は行いません。
        </p>
      </PlainNotice>

      <PlainNotice tone="teal" title="PDF/CSVの見分け方">
        <p>
          友人へ共有する時は上の <span className="font-semibold">第1637回パネル</span> の最新PDF/CSVを使います。
          今後さらに磨いたら、このlatest URLは差し替わります。感想戦で「前に見た資料」と比較する時は{" "}
          <a className="font-semibold underline underline-offset-4" href={versionedReportHref}>
            固定版PDF
          </a>{" "}
          /{" "}
          <a className="font-semibold underline underline-offset-4" href={versionedPurchaseSheetHref}>
            固定版CSV
          </a>{" "}
          を使います。
        </p>
        <p className="mt-2 font-mono text-xs leading-5 text-emerald-950/70">
          PDF SHA256 {worldCupTotoReportVersion.pdfSha256.slice(0, 12)}... / CSV SHA256{" "}
          {worldCupTotoReportVersion.csvSha256.slice(0, 12)}...
        </p>
      </PlainNotice>
    </SectionCard>
  );
}

function SourceLink({
  row,
}: {
  row: Pick<
    WorldCupEvSourceRow | WorldCupMarketEvComparisonRow | WorldCupPredictionLogicRow,
    "sourceLabel" | "sourceUrl"
  >;
}) {
  if (!row.sourceUrl) {
    return <span>{row.sourceLabel}</span>;
  }

  return (
    <a
      className="font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-950"
      href={row.sourceUrl}
      rel="noreferrer"
      target="_blank"
    >
      {row.sourceLabel}
    </a>
  );
}

function MarketEvExplainerPanel({ round }: { round: WorldCupRoundStrategy }) {
  return (
    <SectionCard
      title="EVの見方と予測市場proxy"
      description="総当たりやランダムの期待値を基準にして、公式投票率とズラすことで理論上の期待回収が上がっているかを見ます。"
      actions={
        <div className="flex flex-wrap gap-2">
          <Badge tone="teal">p_model</Badge>
          <Badge tone="amber">p_public</Badge>
          <Badge tone="sky">market proxy</Badge>
        </div>
      }
    >
      <PlainNotice tone="teal" title="今回の読み">
        <p className="text-base font-semibold text-slate-950">{round.marketEvVerdict}</p>
        <p className="mt-2">
          大事なのは「当たりそう」だけではなく、「同じ出目を買っている人が少なそう」まで同時に見ることです。
          実オッズをまだ接続していない行は、利益保証ではなく議論用のproxyとして扱います。
        </p>
      </PlainNotice>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {worldCupEvGlossaryRows.map((row) => (
          <div key={row.term} className="rounded-[18px] border border-slate-200 bg-white/86 px-4 py-3">
            <p className="text-sm font-semibold text-slate-950">{row.term}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-emerald-800">{row.formula}</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">{row.plain}</p>
          </div>
        ))}
      </div>

      <HorizontalScrollTable className="mt-5">
        <table className="min-w-[980px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.14em] text-slate-500">
              <th className="rounded-l-2xl bg-slate-100 px-3 py-3">戦略</th>
              <th className="bg-slate-100 px-3 py-3">購入額</th>
              <th className="bg-slate-100 px-3 py-3">期待回収</th>
              <th className="bg-slate-100 px-3 py-3">期待損益</th>
              <th className="bg-slate-100 px-3 py-3">EV倍率</th>
              <th className="bg-slate-100 px-3 py-3">ランダム比</th>
              <th className="bg-slate-100 px-3 py-3">読み方</th>
              <th className="rounded-r-2xl bg-slate-100 px-3 py-3">根拠</th>
            </tr>
          </thead>
          <tbody>
            {round.marketEvComparisonRows.map((row) => (
              <tr key={row.key} className="border-b border-slate-100">
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={sourceStatusTone(row.status)}>{sourceStatusLabel(row.status)}</Badge>
                    <span className="font-semibold text-slate-950">{row.label}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{row.method}</p>
                </td>
                <td className="px-3 py-3 align-top font-semibold text-slate-900">
                  {formatCurrency(row.costYen)}
                </td>
                <td className="px-3 py-3 align-top font-semibold text-slate-900">
                  {formatCurrency(row.expectedReturnYen)}
                </td>
                <td className="px-3 py-3 align-top font-semibold text-slate-900">
                  {formatMaybeSignedCurrency(row.expectedProfitYen)}
                </td>
                <td className="px-3 py-3 align-top font-semibold text-emerald-700">
                  {row.evMultiple === null ? "-" : `${row.evMultiple.toFixed(2)}倍`}
                </td>
                <td className="px-3 py-3 align-top font-semibold text-slate-900">
                  {formatSignedMultiple(row.evLiftMultiple)}
                </td>
                <td className="px-3 py-3 align-top text-slate-600">{row.verdict}</td>
                <td className="px-3 py-3 align-top text-xs text-slate-500">
                  <SourceLink row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </HorizontalScrollTable>
    </SectionCard>
  );
}

function EvSourceTable({ rows }: { rows: WorldCupEvSourceRow[] }) {
  return (
    <HorizontalScrollTable>
      <table className="min-w-[920px] border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
            <th className="rounded-l-2xl bg-slate-100 px-3 py-3">材料</th>
            <th className="bg-slate-100 px-3 py-3">状態</th>
            <th className="bg-slate-100 px-3 py-3">今の値</th>
            <th className="bg-slate-100 px-3 py-3">ソース</th>
            <th className="rounded-r-2xl bg-slate-100 px-3 py-3">読み方</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="px-3 py-3 font-semibold text-slate-950">{row.label}</td>
              <td className="px-3 py-3">
                <Badge tone={sourceStatusTone(row.status)}>{sourceStatusLabel(row.status)}</Badge>
              </td>
              <td className="px-3 py-3 font-semibold text-slate-900">{row.value}</td>
              <td className="px-3 py-3 text-slate-700">
                <SourceLink row={row} />
              </td>
              <td className="px-3 py-3 leading-6 text-slate-600">{row.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </HorizontalScrollTable>
  );
}

function PredictionLogicGrid({ rows }: { rows: WorldCupPredictionLogicRow[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="rounded-[22px] border border-slate-200 bg-white/84 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-950">{row.label}</h3>
            <Badge tone={sourceStatusTone(row.status)}>{sourceStatusLabel(row.status)}</Badge>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-800">{row.currentUse}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{row.whyItMatters}</p>
          <div className="mt-3 rounded-[18px] border border-emerald-100 bg-emerald-50/72 px-3 py-3 text-sm leading-6 text-emerald-950">
            <p className="font-semibold">次に詰めること</p>
            <p className="mt-1">{row.nextRefinement}</p>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            参考: <SourceLink row={row} />
          </p>
        </div>
      ))}
    </div>
  );
}

function LogicWorkbenchPanel({ round }: { round: WorldCupRoundStrategy }) {
  return (
    <SectionCard
      title="期待値ソースとガチ予想ロジック"
      description="何を公式データとして固定し、どこを人間の予想で詰めるかを分けて見ます。感想戦では、この表に沿ってメモを残します。"
      actions={
        <div className="flex flex-wrap gap-2">
          <Badge tone="teal">EV材料</Badge>
          <Badge tone="sky">予想ロジック</Badge>
          <Badge tone="amber">感想戦</Badge>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[1.06fr_0.94fr]">
        <div className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-slate-950">期待値ソース</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              公式ルール、売上、投票率、モデル確率、結果固定、ポートフォリオを分けて確認します。
            </p>
          </div>
          <EvSourceTable rows={round.evSourceRows} />
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-slate-950">感想戦で拾う問い</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              ボイスメモはこの問いに沿って話すと、次回のrepo改善プロンプトに蒸留しやすくなります。
            </p>
          </div>
          <div className="grid gap-2">
            {round.postMortemPrompts.map((prompt, index) => (
              <div key={prompt} className="flex gap-3 rounded-[18px] border border-slate-200 bg-white/84 px-3 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-900 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <p className="text-sm leading-6 text-slate-700">{prompt}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">予想ロジックの改善レーン</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            今すぐ使っているルールと、web調査で拾った次の強化候補を同じ場所に置きます。
          </p>
        </div>
        <PredictionLogicGrid rows={round.predictionLogicRows} />
      </div>
    </SectionCard>
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
        <MiniFact label="1〜3等EV" value={formatCurrency(plan.expectedReturnYen)} hint={`期待損益 ${formatSignedCurrency(plan.expectedProfitYen)}`} />
        <MiniFact label="13試合当たったら" value={formatPayoutRange(plan)} hint="選んだ出目ごとに払戻見込みは変わる" />
        <MiniFact label="払戻圏内" value={formatPercent(plan.cashProbabilityUpperBound, 4)} hint="1等/2等/3等の合計目安" />
        <MiniFact
          label="2等カバー"
          value={plan.secondPrizeCoverage.ready ? formatPercent(plan.secondPrizeCoverage.secondPrizeCoverageRate, 1) : "未計算"}
          hint={plan.secondPrizeCoverage.guaranteedSecondPrize ? "候補宇宙内2等保証" : "距離1以内の面"}
        />
        <MiniFact label="100円が期待値で" value={formatCurrency(plan.expectedReturnYen / plan.lineCount)} hint={`EV ${formatMultiple(plan.evMultiple)} / 1等分 ${formatCurrency(plan.firstPrizeExpectedReturnYen / plan.lineCount)}`} />
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

          {plan10000 ? <SecondPrizeCoveragePanel coverage={plan10000.secondPrizeCoverage} /> : null}

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
                1〜3等込みの期待損益は{formatSignedCurrency(plan1000.expectedProfitYen)}です。
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

      <HorizontalScrollTable className="mt-4">
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
      </HorizontalScrollTable>
    </div>
  );
}

function OutcomePolicyPanel({ policies }: { policies: WorldCupOutcomePolicy[] }) {
  const fixedCount = policies.filter((policy) => policy.kind === "actual_fixed").length;
  const spreadCount = policies.filter((policy) => policy.kind === "spread").length;
  const lockCount = policies.filter((policy) => policy.kind === "model_lock").length;

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white/86 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-950">購入候補の絞り込み</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            確定済みは固定、65%以上はロック、割れ試合は分散。候補探索はこの出目だけで回します。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="positive">固定 {fixedCount}</Badge>
          <Badge tone="positive">65%+ {lockCount}</Badge>
          <Badge tone="amber">分散 {spreadCount}</Badge>
        </div>
      </div>

      <HorizontalScrollTable className="mt-4">
        <table className="min-w-[900px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
              <th className="rounded-l-2xl bg-slate-100 px-3 py-3">No</th>
              <th className="bg-slate-100 px-3 py-3">試合</th>
              <th className="bg-slate-100 px-3 py-3">判定</th>
              <th className="bg-slate-100 px-3 py-3">残す出目</th>
              <th className="bg-slate-100 px-3 py-3">モデル本命</th>
              <th className="bg-slate-100 px-3 py-3">公式人気</th>
              <th className="rounded-r-2xl bg-slate-100 px-3 py-3">理由</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((policy) => (
              <tr key={policy.matchNo}>
                <td className="px-3 py-3 font-semibold text-slate-500">{policy.matchNo}</td>
                <td className="px-3 py-3 font-semibold text-slate-900">{policy.fixture}</td>
                <td className="px-3 py-3">
                  <Badge tone={policyTone(policy)}>{policy.label}</Badge>
                </td>
                <td className="px-3 py-3 font-mono font-semibold tracking-normal text-slate-950">
                  {policy.allowedOutcomes.join(" / ")}
                </td>
                <td className="px-3 py-3">
                  {policy.modelFavorite ?? "-"} {formatPercent(policy.modelFavoriteProbability, 1)}
                </td>
                <td className="px-3 py-3">
                  {policy.officialFavorite ?? "-"} {formatPercent(policy.officialFavoriteProbability, 1)}
                </td>
                <td className="px-3 py-3 text-slate-600">{policy.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </HorizontalScrollTable>
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
      <p className="mt-3 rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm font-semibold tracking-normal text-slate-950">
        {pickSignature(line.picks)}
      </p>
      <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
        <p>13試合当たったら: {formatCurrency(line.estimatedPayoutYen)}</p>
        <p>1口あたり期待回収: {formatCurrency(line.expectedReturnYen)}</p>
        <p>1〜3等EV内訳: {formatPrizeTierExpectedReturn(line.prizeTiers)}</p>
        <p>払戻圏内: {formatPercent(line.cashProbability, 4)}</p>
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
      <HorizontalScrollTable>
        <table className="min-w-[1040px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
              <th className="rounded-l-2xl bg-slate-100 px-3 py-3">順</th>
              <th className="bg-slate-100 px-3 py-3">出目</th>
              <th className="bg-slate-100 px-3 py-3">戦略バケット</th>
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
                <td className="px-3 py-3">
                  <p className="font-semibold text-slate-950">{row.strategyBucket}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{row.strategyDetail}</p>
                </td>
                <td className="px-3 py-3">1口 / 100円</td>
                <td className="px-3 py-3 font-semibold text-emerald-700">
                  <p>{formatCurrency(row.expectedReturnYen)}</p>
                  <p className="mt-1 text-[11px] font-medium leading-4 text-slate-500">
                    {formatPrizeTierExpectedReturn(row.prizeTiers)}
                  </p>
                </td>
                <td className="px-3 py-3">{formatCurrency(row.expectedReturnYen)}</td>
                <td className="px-3 py-3">{formatCurrency(row.estimatedPayoutYen)}</td>
                <td className="px-3 py-3">{formatPercent(row.hitProbability, 5)}</td>
                <td className="px-3 py-3">{formatPercent(row.publicProbability, 5)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </HorizontalScrollTable>
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

          {round.outcomePolicies.length > 0 ? (
            <OutcomePolicyPanel policies={round.outcomePolicies} />
          ) : null}

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
          <SecondPrizeCoveragePanel coverage={round.primaryPortfolioPlan.secondPrizeCoverage} />
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={round.windowStatus === "closed" ? "slate" : "positive"}>
              {round.windowStatus === "closed" ? "感想戦用の候補" : "買うならこの順"}
            </Badge>
            <p className="text-sm text-slate-600">
              {round.windowStatus === "closed"
                ? `${round.primaryPortfolioPlan.label}プランの${round.primaryPortfolioPlan.lineCount}通り。締切後なので購入指示ではなく、確定試合込みの条件付き試算です。`
                : `${round.primaryPortfolioPlan.label}プランの${round.primaryPortfolioPlan.lineCount}通り。すべて1口ずつです。`}
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
  const dataMode = useDataMode();
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

  const primaryRound =
    strategy.rounds.find((round) => round.featured.roundNumber === 1637) ??
    strategy.rounds.find((round) => round.featured.roundNumber === 1636) ??
    strategy.rounds.find((round) => round.featured.roundNumber === 1635) ??
    strategy.rounds[0];
  const reportHref = resolveArtAsset(pathname, `/reports/${reportFileName}`);
  const legacyPurchaseSheetHref = resolveArtAsset(pathname, `/reports/${worldCupTotoLegacyPurchaseSheetFileName}`);
  const versionedReportHref = resolveArtAsset(pathname, `/reports/${worldCupTotoVersionedReportFileName}`);
  const versionedPurchaseSheet50Href = resolveArtAsset(
    pathname,
    `/reports/${worldCupTotoVersionedPurchaseSheet50FileName}`,
  );
  const versionedPurchaseSheetHref = resolveArtAsset(pathname, `/reports/${worldCupTotoVersionedPurchaseSheetFileName}`);
  const versionedPurchaseSheet200Href = resolveArtAsset(
    pathname,
    `/reports/${worldCupTotoVersionedPurchaseSheet200FileName}`,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="World Cup Toto"
        title="W杯toto EV司令塔"
        description="いつまで買えるか、どのタイミングで公式データを取り直すか、王道を外すか、10口や1万円ならどう置くかを先に見ます。"
        actions={
          <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
            <Link href={appRoute.dashboard} className={cx(secondaryButtonClassName, "justify-center")}>
              ダッシュボードへ
            </Link>
            <Link href={appRoute.hazi} className={cx(secondaryButtonClassName, "justify-center")}>
              Haziレビュー
            </Link>
            <a href={reportHref} className={cx(buttonClassName, "justify-center")}>
              PDF
            </a>
          </div>
        }
      />

      <StorageModeNotice isChecking={dataMode.isChecking} mode={dataMode.mode} />

      <OperatingSystemBacktestPanel />

      <NextWorldCupToto1637Panel
        reportHref={reportHref}
        versionedPurchaseSheet200Href={versionedPurchaseSheet200Href}
        versionedPurchaseSheet50Href={versionedPurchaseSheet50Href}
        versionedPurchaseSheetHref={versionedPurchaseSheetHref}
        versionedReportHref={versionedReportHref}
      />

      <LatestWorldCupTotoPanel
        purchaseSheetHref={legacyPurchaseSheetHref}
        reportHref={reportHref}
        versionedPurchaseSheetHref={versionedPurchaseSheetHref}
        versionedReportHref={versionedReportHref}
      />

      <FirstAnswerPanel round={primaryRound} reportHref={reportHref} />

      <MarketEvExplainerPanel round={primaryRound} />

      <LogicWorkbenchPanel round={primaryRound} />

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
          この画面では、toto13の1口100円に対して、1等・2等・3等の推定払戻を足したEVを表示します。
          13試合すべて当てる1等分は、内訳として別に出しています。
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
