"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { ErrorNotice, LoadingNotice } from "@/components/app/states";
import {
  ArtBannerPanel,
  Badge,
  buttonClassName,
  HorizontalScrollTable,
  InfoBanner,
  PageHeader,
  SectionCard,
  secondaryButtonClassName,
  StatCard,
} from "@/components/ui";
import { isDemoRoundTitle } from "@/lib/demo-data";
import { formatCurrency, formatPercent } from "@/lib/domain";
import { appRoute, buildOfficialRoundImportHref, buildRoundHref } from "@/lib/round-links";
import { candidateStrategyArt, resolveArtAsset } from "@/lib/ui-art";
import { useDashboardData } from "@/lib/use-app-data";
import {
  buildWorldCupStrategyDashboard,
  type WorldCupFinalSnapshotSummary,
  type WorldCupPositiveEvCombo,
  type WorldCupRoundStrategy,
  type WorldCupRoundWindowStatus,
  type WorldCupStrategyLine,
  type WorldCupStrategyPick,
} from "@/lib/world-cup-strategy";

function statusTone(status: WorldCupRoundWindowStatus) {
  if (status === "selling") {
    return "positive" as const;
  }

  if (status === "upcoming") {
    return "sky" as const;
  }

  return "slate" as const;
}

function evTone(value: number | null) {
  return value !== null && value > 1 ? "positive" : "slate";
}

function formatMultiple(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${value.toFixed(2)}x`;
}

function formatCount(value: number | null | undefined) {
  return value === null || value === undefined ? "未確定" : value.toLocaleString("ja-JP");
}

function formatSignedPt(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}pt`;
}

function pickSignature(picks: WorldCupStrategyPick[]) {
  return [...picks]
    .sort((left, right) => left.matchNo - right.matchNo)
    .map((pick) => pick.pick)
    .join("-");
}

function lineHint(line: WorldCupStrategyLine) {
  if (!line.strictEvReady) {
    return "厳密EV待ち";
  }

  return `的中率 ${formatPercent(line.hitProbability, 4)} / 人気重複 ${formatPercent(line.publicProbability, 4)}`;
}

function FinalSnapshotPanel({ snapshot }: { snapshot: WorldCupFinalSnapshotSummary }) {
  const topRows = [...snapshot.voteDriftRows]
    .sort((left, right) => Math.abs(right.maxDeltaPt) - Math.abs(left.maxDeltaPt))
    .slice(0, 6);

  return (
    <div className="rounded-[22px] border border-teal-200 bg-teal-50/78 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone="teal">公式確定値</Badge>
        <Badge tone="slate">{snapshot.sourceAsOfLabel}</Badge>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">確定売上</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">
            {formatCurrency(snapshot.totalSalesYen)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">初期比</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">
            {snapshot.salesMultiple ? `${snapshot.salesMultiple.toFixed(2)}x` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">最大人気ズレ</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">
            {snapshot.maxAbsVoteShareDeltaPt.toFixed(2)}pt
          </p>
        </div>
      </div>
      <div className="mt-4">
        <HorizontalScrollTable hint="初期スナップショットから販売終了時点までの代表ズレです。">
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
                    {row.maxDeltaOutcome} {formatSignedPt(row.maxDeltaPt)}
                  </td>
                  <td className="px-3 py-3">
                    {formatPercent(row.initialShare, 2)} → {formatPercent(row.finalShare, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </HorizontalScrollTable>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={snapshot.sourceUrl} className={secondaryButtonClassName} target="_blank" rel="noreferrer">
          確定ページ
        </a>
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
        <Badge tone={evTone(line.evMultiple)}>{formatMultiple(line.evMultiple)}</Badge>
      </div>
      <p className="mt-3 font-mono text-sm font-semibold tracking-normal text-slate-950">
        {pickSignature(line.picks)}
      </p>
      <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
        <p>1等推定払戻: {formatCurrency(line.estimatedPayoutYen)}</p>
        <p>100円あたり期待値: {formatCurrency(line.expectedReturnYen)}</p>
        <p>{lineHint(line)}</p>
        <p>王道からのズレ: {line.deviationCount}試合</p>
      </div>
    </div>
  );
}

function PortfolioPlanCard({ plan }: { plan: WorldCupRoundStrategy["portfolioPlans"][number] }) {
  return (
    <div className="rounded-[22px] border border-emerald-200 bg-emerald-50/75 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-950">{plan.label}</h4>
        <Badge tone="teal">{formatMultiple(plan.evMultiple)}</Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{plan.description}</p>
      <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
        <p>
          {plan.lineCount}口 / コスト {formatCurrency(plan.costYen)}
        </p>
        <p>期待回収: {formatCurrency(plan.expectedReturnYen)}</p>
        <p>的中率上限: {formatPercent(plan.hitProbabilityUpperBound, 4)}</p>
      </div>
    </div>
  );
}

function PositiveComboTable({ rows }: { rows: WorldCupPositiveEvCombo[] }) {
  return (
    <HorizontalScrollTable hint="スマホでは横にスワイプすると、払戻・的中率・王道差分まで続けて確認できます。">
      <table className="min-w-[980px] border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
            <th className="rounded-l-2xl bg-slate-100 px-3 py-3">#</th>
            <th className="bg-slate-100 px-3 py-3">組み合わせ</th>
            <th className="bg-slate-100 px-3 py-3">EV倍率</th>
            <th className="bg-slate-100 px-3 py-3">100円期待値</th>
            <th className="bg-slate-100 px-3 py-3">1等推定払戻</th>
            <th className="bg-slate-100 px-3 py-3">的中率</th>
            <th className="bg-slate-100 px-3 py-3">公式人気重複</th>
            <th className="rounded-r-2xl bg-slate-100 px-3 py-3">王道差分</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.signature} className="border-b border-slate-100">
              <td className="px-3 py-3 font-semibold text-slate-500">{index + 1}</td>
              <td className="px-3 py-3 font-mono font-semibold tracking-normal text-slate-950">
                {pickSignature(row.picks)}
              </td>
              <td className="px-3 py-3 font-semibold text-emerald-700">
                {formatMultiple(row.evMultiple)}
              </td>
              <td className="px-3 py-3">{formatCurrency(row.expectedReturnYen)}</td>
              <td className="px-3 py-3">{formatCurrency(row.estimatedPayoutYen)}</td>
              <td className="px-3 py-3">{formatPercent(row.hitProbability, 5)}</td>
              <td className="px-3 py-3">{formatPercent(row.publicProbability, 5)}</td>
              <td className="px-3 py-3">{row.deviationCount}試合</td>
            </tr>
          ))}
        </tbody>
      </table>
    </HorizontalScrollTable>
  );
}

function RoundStrategyCard({ round }: { round: WorldCupRoundStrategy }) {
  const roundHref = round.roundId ? buildRoundHref(appRoute.workspace, round.roundId) : null;
  const positiveCount = round.positiveEv.totalPositiveCount;

  return (
    <SectionCard
      title={`第${round.featured.roundNumber}回 toto`}
      description={round.roundTitle}
      actions={
        <div className="flex flex-wrap gap-2">
          <Badge tone={statusTone(round.windowStatus)}>{round.windowStatusLabel}</Badge>
          <Badge tone={round.isCreated ? "teal" : "amber"}>
            {round.isCreated ? "作成済み" : "未作成"}
          </Badge>
          <Badge tone={round.strictEvReady ? "positive" : "slate"}>
            {round.strictEvReady ? "厳密EV可" : "EV待ち"}
          </Badge>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard
              compact
              label="いつまで買えたか"
              value={round.lastBuyableAtLabel}
              hint={`販売開始 ${round.featured.salesStartAt.slice(5, 16).replace("T", " ")}`}
              tone={round.windowStatus === "closed" ? "default" : "positive"}
            />
            <StatCard
              compact
              label="EV>100%候補"
              value={formatCount(positiveCount)}
              hint={round.positiveEv.ready ? `${formatCount(round.positiveEv.evaluatedCount)}通り評価` : "未評価"}
              tone={positiveCount && positiveCount > 0 ? "positive" : "warning"}
            />
          </div>

          <InfoBanner
            tone={round.windowStatus === "closed" ? "slate" : "teal"}
            title={round.driftLabel}
            body={
              <div className="space-y-2">
                <p>{round.driftDetail}</p>
                <p>
                  保存時点: {round.snapshotLabel} / {round.snapshotGapToCloseLabel}
                </p>
              </div>
            }
          />

          {round.finalSnapshot ? <FinalSnapshotPanel snapshot={round.finalSnapshot} /> : null}

          <div className="rounded-[22px] border border-slate-200 bg-white/82 px-4 py-4">
            <div className="grid gap-2 text-sm leading-6 text-slate-700">
              <p>試合数: {round.matchCount}/13</p>
              <p>公式人気: {round.officialReadyCount}/{round.matchCount}</p>
              <p>モデル確率: {round.modelReadyCount}/{round.matchCount}</p>
              <p>売上総額: {formatCurrency(round.featured.totalSalesYen)}</p>
              <p>候補チケット保存数: {round.candidateTicketCount}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {roundHref ? (
                <Link href={roundHref} className={secondaryButtonClassName}>
                  ラウンド詳細
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
          {round.orthodoxLine ? (
            <div className="rounded-[24px] border border-amber-200 bg-amber-50/75 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone="amber">王道で勝った場合</Badge>
                <Badge tone={evTone(round.orthodoxLine.evMultiple)}>
                  {formatMultiple(round.orthodoxLine.evMultiple)}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                <p>1等推定払戻: {formatCurrency(round.orthodoxLine.estimatedPayoutYen)}</p>
                <p>購入100円あたり期待値: {formatCurrency(round.orthodoxLine.expectedReturnYen)}</p>
                <p>組み合わせ: {pickSignature(round.orthodoxLine.picks)}</p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            {round.lines.map((line) => (
              <StrategyLineCard key={line.key} line={line} />
            ))}
          </div>

          {round.strictEvMissingReasons.length > 0 ? (
            <div className="rounded-[22px] border border-amber-200 bg-amber-50/75 px-4 py-4">
              <Badge tone="amber">厳密EVの不足</Badge>
              <p className="mt-3 text-sm leading-6 text-amber-950">
                {round.strictEvMissingReasons.join(" / ")}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {round.portfolioPlans.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {round.portfolioPlans.map((plan) => (
            <PortfolioPlanCard key={plan.label} plan={plan} />
          ))}
        </div>
      ) : null}

      {round.positiveEv.rows.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="positive">購入額超え候補</Badge>
            <p className="text-sm text-slate-600">
              {round.positiveEv.truncated
                ? `上位${round.positiveEv.rows.length}件を表示`
                : "該当候補を表示"}
            </p>
          </div>
          <PositiveComboTable rows={round.positiveEv.rows} />
        </div>
      ) : round.positiveEv.ready ? (
        <div className="rounded-[22px] border border-slate-200 bg-white/82 px-4 py-4">
          <Badge tone="slate">購入額超え候補なし</Badge>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            この前提では、1等EVが100円を超える組み合わせは見つかっていません。
          </p>
        </div>
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
      positiveComboLimit: 80,
      rounds: data.rounds.filter((round) => !isDemoRoundTitle(round.title)),
    });
  }, [data]);

  if (loading && !data) {
    return <LoadingNotice title="W杯締切EV戦略を読み込み中" />;
  }

  if (error && !data) {
    return <ErrorNotice error={error} onRetry={() => void refresh()} />;
  }

  if (!strategy) {
    return <LoadingNotice title="W杯締切EV戦略を準備中" />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="World Cup Toto"
        title="W杯締切EV戦略"
        description="第1634〜1637回totoの買える期限、保存時点から締切までのズレ余地、王道ラインの推定払戻、購入100円を超えるEV候補を同じ画面で見ます。"
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href={appRoute.dashboard} className={secondaryButtonClassName}>
              ダッシュボードへ
            </Link>
            <Link href={appRoute.hazi} className={secondaryButtonClassName}>
              Haziレビュー
            </Link>
            <Link href={`${appRoute.dashboard}#world-cup-strategy`} className={buttonClassName}>
              W杯カードへ
            </Link>
          </div>
        }
      />

      <ArtBannerPanel
        badge={<Badge tone="teal">{candidateStrategyArt.ev_hunter.accentLabel}</Badge>}
        description="締切直前に近い公式人気と売上を使い、王道で勝った場合と期待値狙いの候補を分けて確認します。"
        imageSrc={resolveArtAsset(pathname, candidateStrategyArt.ev_hunter.src)}
        title="買える時間の最後に近い情報で比べる"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="W杯回作成"
          value={`${strategy.createdCount}/4`}
          hint="第1634〜1637回の作成状態"
          tone={strategy.createdCount === 4 ? "positive" : "warning"}
        />
        <StatCard
          label="買える回"
          value={strategy.buyableCount}
          hint={`${strategy.closedCount}回は販売終了`}
          tone={strategy.buyableCount > 0 ? "positive" : "default"}
        />
        <StatCard
          label="厳密EV可能"
          value={strategy.strictReadyCount}
          hint="売上・公式人気・モデル確率が揃った回"
          tone={strategy.strictReadyCount > 0 ? "positive" : "warning"}
        />
        <StatCard
          label="EV>100%候補"
          value={formatCount(strategy.positiveEvComboCount)}
          hint={`保存時点 ${strategy.snapshotLabel}`}
          tone={strategy.positiveEvComboCount && strategy.positiveEvComboCount > 0 ? "positive" : "warning"}
        />
      </section>

      <InfoBanner
        tone="amber"
        title="購入・精算は扱いません"
        body="このページは期待値の研究用です。締切後の最終公式人気や最終売上が未保存の回は、保存時点から締切までの差分を未確定として表示します。"
      />

      <div className="space-y-6">
        {strategy.rounds.map((round) => (
          <RoundStrategyCard key={round.featured.roundNumber} round={round} />
        ))}
      </div>
    </div>
  );
}
