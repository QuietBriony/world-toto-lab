"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { ErrorNotice, LoadingNotice } from "@/components/app/states";
import { AppFlowShortcuts } from "@/components/app/app-flow-shortcuts";
import {
  ArtBannerPanel,
  Badge,
  buttonClassName,
  HorizontalScrollTable,
  PageHeader,
  SectionCard,
  StatCard,
  cx,
  secondaryButtonClassName,
} from "@/components/ui";
import { isDemoRoundTitle } from "@/lib/demo-data";
import {
  buildEvOpportunityCards,
  evOpportunityCategoryLabel,
  evOpportunityStatusLabel,
  publicGamblingWatchItems,
  type EvOpportunityCard,
  type EvOpportunityCategory,
  type EvOpportunityStatus,
} from "@/lib/ev-opportunities";
import { isGoal3LibraryEntry } from "@/lib/goal3";
import { appRoute } from "@/lib/round-links";
import { isWinnerLikeRound } from "@/lib/winner-value";
import { buildWorldCupStrategyDashboard } from "@/lib/world-cup-strategy";
import { candidateStrategyArt, resolveArtAsset } from "@/lib/ui-art";
import { useBigOfficialWatch, useDashboardData, useTotoOfficialRoundLibrary } from "@/lib/use-app-data";

const categoryTabs: Array<"all" | EvOpportunityCategory> = [
  "all",
  "toto",
  "big",
  "goal3",
  "winner",
  "public_gambling_watch",
];

const statusTone: Record<EvOpportunityStatus, "amber" | "positive" | "sky" | "slate" | "teal" | "warning"> = {
  closed: "slate",
  data_missing: "amber",
  hot: "positive",
  research_only: "sky",
  watch: "teal",
};

const categoryTone: Record<EvOpportunityCategory, "amber" | "draw" | "sky" | "slate" | "teal"> = {
  big: "amber",
  goal3: "draw",
  public_gambling_watch: "slate",
  toto: "teal",
  winner: "sky",
};

function tabLabel(value: "all" | EvOpportunityCategory) {
  return value === "all" ? "全部" : evOpportunityCategoryLabel[value];
}

function statusCount(cards: EvOpportunityCard[], status: EvOpportunityStatus) {
  return cards.filter((card) => card.status === status).length;
}

// trailingSlash:true のため usePathname と appRoute(href) で末尾スラッシュが食い違う。
// 正規化して「自ページへの自己リンク」を判定する。
function isSelfLink(href: string, currentPath: string) {
  return href.replace(/\/+$/, "") === currentPath.replace(/\/+$/, "");
}

function OpportunityCard({
  card,
  currentPath,
}: {
  card: EvOpportunityCard;
  currentPath: string;
}) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white/88 p-5 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.38)]">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={statusTone[card.status]}>{evOpportunityStatusLabel[card.status]}</Badge>
        <Badge tone={categoryTone[card.category]}>{evOpportunityCategoryLabel[card.category]}</Badge>
        <Badge tone="slate">{card.productLabel}</Badge>
      </div>

      <h2 className="mt-4 text-lg font-semibold tracking-tight text-slate-950">
        {card.title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{card.whyItMatters}</p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border border-slate-200 bg-slate-50/85 px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">EV / proxy</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-950">{card.evLabel}</dd>
        </div>
        <div className="rounded-[18px] border border-slate-200 bg-slate-50/85 px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">還元構造</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-950">{card.returnRateLabel}</dd>
        </div>
        <div className="rounded-[18px] border border-slate-200 bg-slate-50/85 px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">1口</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-950">{card.stakeLabel}</dd>
        </div>
        <div className="rounded-[18px] border border-slate-200 bg-slate-50/85 px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">信頼度</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-950">{card.confidenceLabel}</dd>
        </div>
      </dl>

      {card.warningLabel ? (
        <p className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-950">
          {card.warningLabel}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {isSelfLink(card.href, currentPath) ? (
          // 自ページへの自己リンク（公営ウォッチ等、実遷移先が無い研究ネタ）は
          // 押せる主ボタンにすると no-op のデッドエンドになるため、情報チップにする。
          <span className="inline-flex items-center rounded-2xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500">
            {card.nextActionLabel}
          </span>
        ) : (
          <Link href={card.href} className={buttonClassName}>
            {card.nextActionLabel}
          </Link>
        )}
        {card.sourceUrl ? (
          <a href={card.sourceUrl} target="_blank" rel="noreferrer" className={secondaryButtonClassName}>
            根拠を見る
          </a>
        ) : null}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">Source: {card.sourceLabel}</p>
    </article>
  );
}

function OpportunityTable({
  cards,
  currentPath,
}: {
  cards: EvOpportunityCard[];
  currentPath: string;
}) {
  return (
    <HorizontalScrollTable>
      <table className="min-w-[980px] border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-[0.14em] text-slate-500">
            <th className="rounded-l-2xl bg-slate-100 px-3 py-3">ネタ</th>
            <th className="bg-slate-100 px-3 py-3">状態</th>
            <th className="bg-slate-100 px-3 py-3">EV / proxy</th>
            <th className="bg-slate-100 px-3 py-3">還元構造</th>
            <th className="bg-slate-100 px-3 py-3">1口</th>
            <th className="bg-slate-100 px-3 py-3">次アクション</th>
            <th className="rounded-r-2xl bg-slate-100 px-3 py-3">根拠</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => (
            <tr key={card.id} className="border-b border-slate-100">
              <td className="px-3 py-3 align-top">
                <p className="font-semibold text-slate-950">{card.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{card.productLabel}</p>
              </td>
              <td className="px-3 py-3 align-top">
                <Badge tone={statusTone[card.status]}>{evOpportunityStatusLabel[card.status]}</Badge>
              </td>
              <td className="px-3 py-3 align-top font-semibold text-slate-950">{card.evLabel}</td>
              <td className="px-3 py-3 align-top text-slate-600">{card.returnRateLabel}</td>
              <td className="px-3 py-3 align-top text-slate-600">{card.stakeLabel}</td>
              <td className="px-3 py-3 align-top">
                {isSelfLink(card.href, currentPath) ? (
                  <span className="font-semibold text-slate-500">{card.nextActionLabel}</span>
                ) : (
                  <Link
                    href={card.href}
                    className="inline-flex min-h-[44px] items-center font-semibold text-teal-700 hover:text-teal-900"
                  >
                    {card.nextActionLabel}
                  </Link>
                )}
              </td>
              <td className="px-3 py-3 align-top text-xs text-slate-500">
                {card.sourceUrl ? (
                  <a href={card.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-teal-700 hover:text-teal-900">
                    {card.sourceLabel}
                  </a>
                ) : (
                  card.sourceLabel
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </HorizontalScrollTable>
  );
}

export default function EvOpportunitiesPage() {
  const pathname = usePathname();
  const dashboard = useDashboardData();
  const goal3Library = useTotoOfficialRoundLibrary({ productType: "custom" });
  const bigOfficialWatch = useBigOfficialWatch();
  const [activeCategory, setActiveCategory] = useState<"all" | EvOpportunityCategory>("all");

  const inventoryRounds = useMemo(
    () => dashboard.data?.rounds.filter((round) => !isDemoRoundTitle(round.title)) ?? [],
    [dashboard.data],
  );
  const worldCupStrategy = useMemo(
    () =>
      buildWorldCupStrategyDashboard({
        includePositiveCombos: false,
        rounds: inventoryRounds,
      }),
    [inventoryRounds],
  );
  const goal3Entries = useMemo(
    () => (goal3Library.data ?? []).filter(isGoal3LibraryEntry),
    [goal3Library.data],
  );
  const bigOfficialSnapshots = useMemo(
    () => bigOfficialWatch.data?.snapshots ?? [],
    [bigOfficialWatch.data],
  );
  const domesticRound =
    inventoryRounds.find(
      (round) =>
        round.competitionType === "domestic_toto" ||
        round.productType === "mini_toto",
    ) ?? null;
  const winnerRound =
    inventoryRounds.find((round) =>
      isWinnerLikeRound({
        matchCount: round.matchCount,
        productType: round.productType,
        requiredMatchCount: round.requiredMatchCount,
      }),
    ) ?? null;
  const cards = useMemo(
    () =>
      buildEvOpportunityCards({
        bigOfficialSnapshots,
        domesticRoundCount: domesticRound ? 1 : 0,
        domesticRoundId: domesticRound?.id ?? null,
        domesticRoundTitle: domesticRound?.title ?? null,
        goal3Entries,
        winnerRoundId: winnerRound?.id ?? null,
        winnerRoundTitle: winnerRound?.title ?? null,
        worldCupStrategy,
      }),
    [bigOfficialSnapshots, domesticRound, goal3Entries, winnerRound, worldCupStrategy],
  );
  const visibleCards =
    activeCategory === "all"
      ? cards
      : cards.filter((card) => card.category === activeCategory);
  const heroImageSrc = resolveArtAsset(pathname, candidateStrategyArt.ev_hunter.src);
  const latestRoundId = dashboard.data?.rounds[0]?.id ?? null;

  if (dashboard.loading && !dashboard.data) {
    return <LoadingNotice title="EVネタ帳を読み込み中" />;
  }

  if (dashboard.error && !dashboard.data) {
    return <ErrorNotice error={dashboard.error} onRetry={() => void dashboard.refresh()} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="EV Opportunity Board"
        title="EVネタ帳"
        description="Toto系の実戦導線と、公営ギャンブルの研究ウォッチを一画面で並べます。購入指示ではなく、どこを見に行くべきかを決める管制塔です。"
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href={appRoute.dashboard} className={secondaryButtonClassName}>
              トップへ
            </Link>
            <Link href={appRoute.worldCupStrategy} className={buttonClassName}>
              W杯toto EV司令塔
            </Link>
          </div>
        }
      />

      <AppFlowShortcuts
        currentPath={appRoute.evOpportunities}
        latestRoundId={latestRoundId}
        variant="compact"
      />

      <ArtBannerPanel
        badge={<Badge tone="teal">EV / proxy / research</Badge>}
        description="友人と見る前提で、1口、戻り、根拠、次アクションだけを先に出します。細かい式は各ボードに逃がします。"
        imageSrc={heroImageSrc}
        title="いま見る価値があるネタだけを上から確認"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="全ネタ" value={`${cards.length}`} hint="Toto系 + 公営ウォッチ" tone="draw" />
        <StatCard label="要確認" value={`${statusCount(cards, "hot")}`} hint="EV/proxyが高い順に表示" tone="positive" />
        <StatCard label="監視" value={`${statusCount(cards, "watch")}`} hint="データが揃えば判断可能" tone="warning" />
        <StatCard label="研究ネタ" value={`${publicGamblingWatchItems.length}`} hint="購入候補生成はしない" tone="draw" />
        <StatCard label="データ待ち" value={`${statusCount(cards, "data_missing")}`} hint="同期や回作成が先" tone="default" />
      </section>

      <SectionCard
        title="見る順を絞る"
        description="友人に見せる時は、まず全部かtotoだけで十分です。公営ウォッチは別枠のネタ帳として扱います。"
      >
        <div
          data-horizontal-scroll
          className="-mx-1 min-w-0 max-w-full touch-pan-x overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]"
        >
          <div className="flex w-max gap-2 px-1 sm:w-auto sm:flex-wrap">
            {categoryTabs.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={cx(
                  "inline-flex h-11 items-center justify-center rounded-full border px-4 text-sm font-semibold transition",
                  activeCategory === category
                    ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                    : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50",
                )}
              >
                {tabLabel(category)}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      <section className="grid gap-4 xl:grid-cols-2">
        {visibleCards.slice(0, 6).map((card) => (
          <OpportunityCard key={card.id} card={card} currentPath={pathname} />
        ))}
      </section>

      <SectionCard
        title="一覧"
        description="カードに出していない候補も含めて、EV/proxyの高い順に並べます。"
      >
        <OpportunityTable cards={visibleCards} currentPath={pathname} />
      </SectionCard>
    </div>
  );
}
