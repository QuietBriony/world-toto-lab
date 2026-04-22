"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import {
  RouteGlossaryCard,
  RoundProgressCallout,
} from "@/components/app/round-guides";
import {
  ConfigurationNotice,
  ErrorNotice,
  LoadingNotice,
  RoundRequiredNotice,
} from "@/components/app/states";
import { RoundNav } from "@/components/round-nav";
import {
  ArtBannerPanel,
  Badge,
  buttonClassName,
  HorizontalScrollTable,
  PageHeader,
  SectionCard,
  secondaryButtonClassName,
  StatCard,
} from "@/components/ui";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatSignedPercent,
  productTypeBadgeTone,
  productTypeLabel,
  roundSourceLabel,
  roundStatusLabel,
} from "@/lib/domain";
import { buildOutcomeEdges } from "@/lib/outcome-edge";
import { appRoute, buildRoundHref, getSingleSearchParam } from "@/lib/round-links";
import { isSupabaseConfigured } from "@/lib/supabase";
import { boardHeroArt, resolveArtAsset } from "@/lib/ui-art";
import { useRoundWorkspace } from "@/lib/use-app-data";
import {
  buildWinnerOfficialSnapshot,
  isWinnerLikeRound,
  sortWinnerOutcomeEdges,
  summarizeWinnerOutcomeEdges,
  winnerOutcomeLabel,
  winnerReasonLabel,
} from "@/lib/winner-value";

function badgeToneForReason(reason: string) {
  if (reason === "popular_overweight") {
    return "warning" as const;
  }

  if (reason === "draw_alert") {
    return "draw" as const;
  }

  if (reason === "valueRatio>=1.35") {
    return "teal" as const;
  }

  return "info" as const;
}

function WinnerValuePageContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const requestedMatchId = getSingleSearchParam(searchParams.get("match"));
  const requestedUserId = getSingleSearchParam(searchParams.get("user"));
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);

  if (!isSupabaseConfigured()) {
    return <ConfigurationNotice />;
  }

  if (!roundId) {
    return <RoundRequiredNotice />;
  }

  if (loading && !data) {
    return <LoadingNotice title="WINNERボードを読み込み中" />;
  }

  if (error && !data) {
    return <ErrorNotice error={error} onRetry={() => void refresh()} />;
  }

  if (!data) {
    return <RoundRequiredNotice />;
  }

  const winnerLike = isWinnerLikeRound({
    activeMatchCount: data.round.activeMatchCount,
    matchCount: data.round.matches.length,
    productType: data.round.productType,
    requiredMatchCount: data.round.requiredMatchCount,
  });
  const edges = buildOutcomeEdges(data.round.matches);
  const edgesByMatchId = edges.reduce((map, edge) => {
    const current = map.get(edge.matchId) ?? [];
    current.push(edge);
    map.set(edge.matchId, current);
    return map;
  }, new Map<string, typeof edges>());
  const availableMatchIds = data.round.matches.map((match) => match.id);
  const activeMatchId =
    (requestedMatchId && availableMatchIds.includes(requestedMatchId) ? requestedMatchId : null) ??
    data.round.matches[0]?.id ??
    null;
  const activeMatch = data.round.matches.find((match) => match.id === activeMatchId) ?? null;
  const activeEdges = activeMatch
    ? sortWinnerOutcomeEdges(edgesByMatchId.get(activeMatch.id) ?? [])
    : [];
  const summary = summarizeWinnerOutcomeEdges(activeEdges);
  const officialSnapshot = buildWinnerOfficialSnapshot({
    activeEdges,
    evAssumption: data.round.evAssumption,
    officialRound: data.round.totoOfficialRound,
  });
  const sourceHref = data.round.totoOfficialRound?.sourceUrl ?? null;
  const activeUser = data.users.find((user) => user.id === requestedUserId) ?? data.users[0] ?? null;
  const topValueRows = activeEdges
    .filter((edge) => edge.reasons.some((reason) => reason !== "popular_overweight"))
    .slice(0, 2);
  const watchRows = activeEdges
    .filter((edge) => edge.reasons.includes("popular_overweight"))
    .slice(0, 2);
  const navItems = [
    { href: buildRoundHref(appRoute.workspace, data.round.id), label: "ラウンド詳細" },
    activeUser
      ? {
          href: buildRoundHref(appRoute.simpleView, data.round.id, { user: activeUser.id }),
          label: "自分の予想",
        }
      : null,
    {
      href: buildRoundHref(appRoute.winnerValue, data.round.id, {
        match: activeMatch?.id,
        user: activeUser?.id,
      }),
      label: "WINNERボード",
    },
    { href: buildRoundHref(appRoute.review, data.round.id), label: "振り返り" },
  ].filter(Boolean) as Array<{ href: string; label: string }>;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="WINNERボード"
        title={winnerLike ? "1試合の見どころを比較する" : "1試合ごとの差分を見る"}
        description={
          winnerLike
            ? "1 / 0 / 2 の3候補を、モデル確率と公式人気の差で見比べるボードです。的中や利益の保証ではなく、参考比較として使います。"
            : "この回は複数試合ですが、1試合ごとの 1 / 0 / 2 比較だけ切り出して見たいときの補助画面です。"
        }
        actions={
          <div className="flex flex-wrap gap-3">
            {activeUser ? (
              <Link
                href={buildRoundHref(appRoute.simpleView, data.round.id, { user: activeUser.id })}
                className={secondaryButtonClassName}
              >
                自分の予想
              </Link>
            ) : null}
            <Link
              href={buildRoundHref(appRoute.workspace, data.round.id)}
              className={secondaryButtonClassName}
            >
              ラウンド詳細
            </Link>
            {sourceHref ? (
              <a
                href={sourceHref}
                target="_blank"
                rel="noreferrer"
                className={buttonClassName}
              >
                元の公式ソース
              </a>
            ) : null}
          </div>
        }
      />

      <ArtBannerPanel
        badge={<Badge tone="sky">{boardHeroArt.winner.accentLabel}</Badge>}
        description={boardHeroArt.winner.description}
        imageSrc={resolveArtAsset(pathname, boardHeroArt.winner.src)}
        title={boardHeroArt.winner.title}
      />

      <RoundNav
        currentPath={appRoute.winnerValue}
        items={navItems}
        roundId={data.round.id}
        roundStatus={roundStatusLabel[data.round.status]}
        roundTitle={data.round.title}
        userId={activeUser?.id}
      />

      <RoundProgressCallout
        currentPath={appRoute.winnerValue}
        matches={data.round.matches}
        picks={data.round.picks}
        roundId={data.round.id}
        scoutReports={data.round.scoutReports}
        users={data.users}
      />

      <RouteGlossaryCard currentPath={appRoute.winnerValue} defaultOpen={!winnerLike} />

      <SectionCard
        title="このボードの前提"
        description="`WINNER` や 1試合ラウンド向けに、どの outcome に差がありそうかを短く比較します。"
      >
        <div className="flex flex-wrap gap-2">
          <Badge tone={productTypeBadgeTone[data.round.productType]}>
            {productTypeLabel[data.round.productType]}
          </Badge>
          <Badge tone="slate">試合数 {data.round.matches.length}</Badge>
          <Badge tone="info">出どころ {roundSourceLabel[data.round.roundSource]}</Badge>
          {winnerLike ? <Badge tone="teal">WINNER向け</Badge> : <Badge tone="warning">補助表示</Badge>}
        </div>
        {!winnerLike ? (
          <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-950">
            この round は `WINNER / 1試合回` ではないので、主導線としては
            `優位ボード` と `候補配分` の方が向いています。ここでは 1 試合だけ切り出して
            1 / 0 / 2 の差を見る補助画面として使ってください。
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={buildRoundHref(appRoute.edgeBoard, data.round.id)}
                className={secondaryButtonClassName}
              >
                優位ボードへ
              </Link>
              <Link
                href={buildRoundHref(appRoute.ticketGenerator, data.round.id)}
                className={secondaryButtonClassName}
              >
                詳細候補配分へ
              </Link>
            </div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="公式人気 / 配当前提 snapshot"
        description="この試合で見ている公式人気と、売上・キャリー・配当原資の参考 snapshot を同じ場所で確認します。"
      >
        <div className="grid gap-4 xl:grid-cols-[1fr_1.05fr]">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                tone={
                  officialSnapshot.sourceKind === "analysis"
                    ? "teal"
                    : officialSnapshot.sourceKind === "official"
                      ? "sky"
                      : "slate"
                }
              >
                {officialSnapshot.sourceKind === "analysis"
                  ? "分析前提 snapshot"
                  : officialSnapshot.sourceKind === "official"
                    ? "公式 snapshot"
                    : "snapshot 未設定"}
              </Badge>
              {officialSnapshot.officialRoundNumber !== null ? (
                <Badge tone="slate">第{officialSnapshot.officialRoundNumber}回</Badge>
              ) : null}
              {officialSnapshot.salesEndAt ? (
                <Badge tone="slate">締切 {formatDateTime(officialSnapshot.salesEndAt)}</Badge>
              ) : null}
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <p className="font-semibold text-slate-950">
                {officialSnapshot.officialRoundName ?? "この Round の公式スナップショット"}
              </p>
              <p>
                {officialSnapshot.hasAnalysisOverride
                  ? "売上やキャリーは、保存済みの EV 前提が優先されています。公式値ではなく分析用の snapshot として扱います。"
                  : "公式取り込み済みの売上・キャリー・締切をそのまま表示しています。"}
              </p>
              <p>
                WINNER の exact payout を再現するものではなく、今ある round 情報から見える
                `公式人気` と `配当原資の参考値` を並べた比較用カードです。
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge tone="info">
                  公式人気本命{" "}
                  {officialSnapshot.officialFavorite && activeMatch
                    ? winnerOutcomeLabel(officialSnapshot.officialFavorite.outcome, activeMatch)
                    : "—"}
                </Badge>
                {officialSnapshot.officialFavorite?.officialVote !== null ? (
                  <Badge tone="slate">
                    {formatPercent(officialSnapshot.officialFavorite?.officialVote)}
                  </Badge>
                ) : null}
                {officialSnapshot.topValueEdge && activeMatch ? (
                  <Badge tone="teal">
                    注目 {winnerOutcomeLabel(officialSnapshot.topValueEdge.outcome, activeMatch)}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>

          <section className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="公式人気本命"
              value={
                officialSnapshot.officialFavorite && activeMatch
                  ? winnerOutcomeLabel(officialSnapshot.officialFavorite.outcome, activeMatch)
                  : "—"
              }
              hint={
                officialSnapshot.officialFavorite &&
                officialSnapshot.officialFavorite.officialVote !== null
                  ? `公式人気 ${formatPercent(officialSnapshot.officialFavorite.officialVote)}`
                  : "公式人気の入力待ち"
              }
              tone="draw"
            />
            <StatCard
              label="注目 outcome"
              value={
                officialSnapshot.topValueEdge && activeMatch
                  ? winnerOutcomeLabel(officialSnapshot.topValueEdge.outcome, activeMatch)
                  : "—"
              }
              hint={
                officialSnapshot.topValueEdge
                  ? `edge ${formatSignedPercent(officialSnapshot.topValueEdge.edge)} / valueRatio ${formatNumber(officialSnapshot.topValueEdge.valueRatio, 2)}`
                  : "まだ明確な差が見えていません"
              }
              tone="positive"
            />
            <StatCard
              label="売上 snapshot"
              value={formatCurrency(officialSnapshot.totalSalesYen)}
              hint={
                officialSnapshot.stakeYen !== null
                  ? `stake ${formatCurrency(officialSnapshot.stakeYen)} / carryover ${formatCurrency(officialSnapshot.carryoverYen)}`
                  : `carryover ${formatCurrency(officialSnapshot.carryoverYen)}`
              }
            />
            <StatCard
              label="配当原資参考"
              value={formatCurrency(officialSnapshot.estimatedPoolYen)}
              hint={
                officialSnapshot.firstPrizeShare !== null
                  ? `firstPrizeShare ${formatPercent(officialSnapshot.firstPrizeShare)}`
                  : "share 未設定のため参考値なし"
              }
              tone={
                officialSnapshot.estimatedPoolYen !== null ? "positive" : "warning"
              }
            />
          </section>
        </div>
      </SectionCard>

      {data.round.matches.length > 1 ? (
        <SectionCard
          title="対象試合を選ぶ"
          description="複数試合ある場合は、見たい 1 試合だけを切り替えて outcome ごとの差を比較します。"
        >
          <div className="flex flex-wrap gap-2">
            {data.round.matches.map((match) => (
              <Link
                key={match.id}
                href={buildRoundHref(appRoute.winnerValue, data.round.id, {
                  match: match.id,
                  user: activeUser?.id,
                })}
                className={
                  match.id === activeMatch?.id ? buttonClassName : secondaryButtonClassName
                }
              >
                #{match.matchNo} {match.homeTeam} vs {match.awayTeam}
              </Link>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="見ている試合"
          value={activeMatch ? `#${activeMatch.matchNo}` : "未設定"}
          hint={activeMatch ? `${activeMatch.homeTeam} vs ${activeMatch.awayTeam}` : "試合がありません"}
        />
        <StatCard
          label="エッジ候補"
          value={`${summary.edgeCandidateCount}`}
          hint="人気差や倍率差で見ておきたい outcome 数"
          tone="positive"
        />
        <StatCard
          label="人気過多"
          value={`${summary.popularOverweightCount}`}
          hint="人気の割にモデル側が弱めに見ている outcome 数"
          tone="warning"
        />
        <StatCard
          label="最大 valueRatio"
          value={summary.bestValueRatio !== null ? formatNumber(summary.bestValueRatio, 2) : "—"}
          hint="modelProb / officialVote の最大値"
          tone="draw"
        />
      </section>

      <SectionCard
        title="まず見るところ"
        description="上振れ狙いの候補と、人気過多で慎重に見たい候補を先に分けて表示します。"
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-5">
            <div className="flex items-center gap-2">
              <Badge tone="teal">注目</Badge>
              <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                眠っていそうな outcome
              </h3>
            </div>
            <div className="mt-4 space-y-3">
              {topValueRows.length === 0 ? (
                <p className="text-sm leading-6 text-slate-600">
                  まだ強い差は見えていません。公式人気か AI 確率が揃うとここに候補が出ます。
                </p>
              ) : (
                topValueRows.map((row) => (
                  <div
                    key={`value-${row.matchId}-${row.outcome}`}
                    className="rounded-[18px] border border-emerald-200 bg-white/82 p-3"
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {activeMatch ? winnerOutcomeLabel(row.outcome, activeMatch) : row.outcome}
                    </div>
                    <div className="mt-1 text-sm text-slate-700">
                      edge {formatSignedPercent(row.edge)} / valueRatio{" "}
                      {row.valueRatio !== null ? formatNumber(row.valueRatio, 2) : "—"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {row.reasons.map((reason) => (
                        <Badge key={`${row.matchId}-${row.outcome}-${reason}`} tone={badgeToneForReason(reason)}>
                          {winnerReasonLabel(reason)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-amber-200 bg-amber-50/85 p-5">
            <div className="flex items-center gap-2">
              <Badge tone="warning">慎重確認</Badge>
              <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                人気過多で要確認
              </h3>
            </div>
            <div className="mt-4 space-y-3">
              {watchRows.length === 0 ? (
                <p className="text-sm leading-6 text-slate-600">
                  いまのところ、極端に人気が偏りすぎた outcome は出ていません。
                </p>
              ) : (
                watchRows.map((row) => (
                  <div
                    key={`watch-${row.matchId}-${row.outcome}`}
                    className="rounded-[18px] border border-amber-200 bg-white/82 p-3"
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {activeMatch ? winnerOutcomeLabel(row.outcome, activeMatch) : row.outcome}
                    </div>
                    <div className="mt-1 text-sm text-slate-700">
                      公式人気 {formatPercent(row.officialVote)} / edge {formatSignedPercent(row.edge)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone="warning">人気過多</Badge>
                      {row.publicOverweight !== null ? (
                        <Badge tone="slate">
                          publicOverweight {formatSignedPercent(row.publicOverweight)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Outcome 比較"
        description="1 / 0 / 2 ごとに model、公式人気、市場、差分、注意理由を並べます。"
      >
        {activeMatch ? (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Badge tone="slate">#{activeMatch.matchNo}</Badge>
            <span>{activeMatch.homeTeam}</span>
            <span>vs</span>
            <span>{activeMatch.awayTeam}</span>
          </div>
        ) : null}

        <HorizontalScrollTable hint="スマホでは横にスワイプすると、model・公式人気・倍率差・注意理由まで続けて確認できます。">
          <table className="min-w-[1120px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-3 py-3">outcome</th>
                <th className="px-3 py-3">model</th>
                <th className="px-3 py-3">公式人気</th>
                <th className="px-3 py-3">市場</th>
                <th className="px-3 py-3">edge</th>
                <th className="px-3 py-3">valueRatio</th>
                <th className="px-3 py-3">publicOverweight</th>
                <th className="px-3 py-3">判定</th>
              </tr>
            </thead>
            <tbody>
              {activeEdges.map((row) => (
                <tr key={`${row.matchId}-${row.outcome}`} className="border-b border-slate-100">
                  <td className="px-3 py-4">
                    <div className="font-semibold text-slate-900">
                      {activeMatch ? winnerOutcomeLabel(row.outcome, activeMatch) : row.outcome}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{row.fixture}</div>
                  </td>
                  <td className="px-3 py-4 text-slate-700">{formatPercent(row.modelProb)}</td>
                  <td className="px-3 py-4 text-slate-700">{formatPercent(row.officialVote)}</td>
                  <td className="px-3 py-4 text-slate-700">{formatPercent(row.marketProb)}</td>
                  <td className="px-3 py-4 text-slate-700">{formatSignedPercent(row.edge)}</td>
                  <td className="px-3 py-4 text-slate-700">
                    {row.valueRatio !== null ? formatNumber(row.valueRatio, 2) : "—"}
                  </td>
                  <td className="px-3 py-4 text-slate-700">
                    {row.publicOverweight !== null ? formatSignedPercent(row.publicOverweight) : "—"}
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex flex-wrap gap-2">
                      {row.modelFavorite ? <Badge tone="teal">モデル本命</Badge> : null}
                      {row.publicFavorite ? <Badge tone="slate">人気本命</Badge> : null}
                      {row.reasons.length === 0 ? (
                        <Badge tone="slate">中立</Badge>
                      ) : (
                        row.reasons.map((reason) => (
                          <Badge key={`${row.matchId}-${row.outcome}-${reason}`} tone={badgeToneForReason(reason)}>
                            {winnerReasonLabel(reason)}
                          </Badge>
                        ))
                      )}
                    </div>
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

export default function WinnerValuePage() {
  return (
    <Suspense fallback={<LoadingNotice title="WINNERボードを読み込み中" />}>
      <WinnerValuePageContent />
    </Suspense>
  );
}
