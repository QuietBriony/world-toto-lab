"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { ErrorNotice, LoadingNotice } from "@/components/app/states";
import { RoundNav } from "@/components/round-nav";
import {
  Badge,
  HorizontalScrollTable,
  InfoBanner,
  PageHeader,
  SectionCard,
  buttonClassName,
  cx,
  fieldClassName,
  secondaryButtonClassName,
} from "@/components/ui";
import { formatPercent, formatSignedPercent, roundStatusLabel } from "@/lib/domain";
import { appRoute, getSingleSearchParam } from "@/lib/round-links";
import { useRoundWorkspace } from "@/lib/use-app-data";
import {
  buildSignalBoard,
  calculateModelProbabilitiesWithUpstream,
  computeUpstreamTeamPriorAdjustments,
  createMarketNodeFromHyperliquidUrl,
  deleteMarketNode,
  fetchHyperliquidL2Book,
  listMarketNodes,
  marketNodeWarnings,
  previewHyperliquidUrl,
  saveMarketNode,
  updateMarketNode,
  MARKET_SOURCE_LABEL,
  MARKET_TYPE_LABEL,
  SIGNAL_LAYER_LABEL,
  type MarketNode,
  type SignalBoardRow,
} from "@/lib/market-sources";

const HYPERLIQUID_PLACEHOLDER =
  "https://app.hyperliquid.xyz/trade/2026-world-cup-champion-france-yes";

function parseProbabilityInput(raw: string): number | null {
  const cleaned = raw.replace(/[%％\s]/g, "");
  if (!cleaned) {
    return null;
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    return null;
  }
  const probability = value > 1 ? value / 100 : value;
  if (probability < 0 || probability > 1) {
    return null;
  }
  return probability;
}

function confidenceTone(confidence: MarketNode["dataConfidence"]) {
  if (confidence === "high") {
    return "teal" as const;
  }
  if (confidence === "medium") {
    return "sky" as const;
  }
  if (confidence === "low") {
    return "amber" as const;
  }
  return "slate" as const;
}

function PreviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 last:border-b-0">
      <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <span className="text-right text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function NodeCard({
  node,
  busy,
  onUpdate,
  onTryApi,
  onDelete,
}: {
  node: MarketNode;
  busy: boolean;
  onUpdate: (id: string, probability: number) => void;
  onTryApi: (node: MarketNode) => void;
  onDelete: (id: string) => void;
}) {
  const [priceInput, setPriceInput] = useState("");
  const warnings = useMemo(() => marketNodeWarnings(node), [node]);

  const handleManual = () => {
    const probability = parseProbabilityInput(priceInput);
    if (probability === null) {
      return;
    }
    onUpdate(node.id, probability);
    setPriceInput("");
  };

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white/85 p-4 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.25)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="sky">{MARKET_SOURCE_LABEL[node.source]}</Badge>
            <Badge tone="slate">{MARKET_TYPE_LABEL[node.marketType]}</Badge>
            {node.team ? <Badge tone="teal">{node.team}</Badge> : null}
          </div>
          <p className="mt-2 break-all text-sm font-semibold text-slate-900">
            {node.slug ?? node.externalUrl}
          </p>
          <a
            href={node.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block break-all text-xs text-sky-700 underline"
          >
            {node.externalUrl}
          </a>
        </div>
        <Badge tone={confidenceTone(node.dataConfidence)}>信頼度 {node.dataConfidence}</Badge>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        <PreviewRow label="シグナル層" value={SIGNAL_LAYER_LABEL[node.signalLayer]} />
        <PreviewRow label="Weight" value={node.weight.toFixed(2)} />
        <PreviewRow
          label="確率"
          value={node.probability !== null ? formatPercent(node.probability, 1) : "—"}
        />
        <PreviewRow label="mid" value={node.mid !== null ? node.mid.toFixed(3) : "—"} />
        <PreviewRow label="spread" value={node.spread !== null ? node.spread.toFixed(3) : "—"} />
        <PreviewRow
          label="流動性"
          value={node.liquidityScore !== null ? node.liquidityScore.toFixed(1) : "不明"}
        />
        <PreviewRow label="価格元" value={node.priceSource} />
        <PreviewRow label="coin" value={node.externalSymbol ?? "未マッピング"} />
        <PreviewRow
          label="最終取得"
          value={node.lastFetchedAt ? new Date(node.lastFetchedAt).toLocaleString("ja-JP") : "—"}
        />
      </dl>

      {warnings.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {warnings.map((warning) => (
            <li key={warning.code} className="flex items-start gap-2 text-xs leading-5">
              <span
                className={cx(
                  "mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full",
                  warning.tone === "amber" ? "bg-amber-500" : "bg-slate-400",
                )}
              />
              <span className={warning.tone === "amber" ? "text-amber-800" : "text-slate-600"}>
                {warning.message}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={priceInput}
          onChange={(event) => setPriceInput(event.target.value)}
          placeholder="価格を手入力（例: 18% または 0.18）"
          className={cx(fieldClassName, "h-10 max-w-[260px] flex-1")}
          inputMode="decimal"
        />
        <button type="button" onClick={handleManual} className={cx(secondaryButtonClassName, "h-10")}>
          価格を更新
        </button>
        <button
          type="button"
          onClick={() => onTryApi(node)}
          disabled={busy}
          className={cx(secondaryButtonClassName, "h-10")}
        >
          {busy ? "取得中…" : "APIで取得を試す"}
        </button>
        <button
          type="button"
          onClick={() => onDelete(node.id)}
          className="inline-flex h-10 items-center rounded-full border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-800 transition hover:bg-rose-100"
        >
          削除
        </button>
      </div>
    </div>
  );
}

function signalComment(row: SignalBoardRow): string {
  const parts: string[] = [];
  if (row.hyperliquidChampion !== null) {
    parts.push("Hyperliquidは上流シグナル。個別試合は別途1X2で確認。");
  }
  if (row.championProbSpread !== null && row.championProbSpread >= 0.05) {
    parts.push(`ソース間の差が大きめ（${formatPercent(row.championProbSpread, 1)}）。`);
  }
  if (row.officialVotePopularity !== null) {
    parts.push(row.officialVotePopularity >= 0.5 ? "公式投票は人気高。" : "公式投票は人気低。");
  }
  return parts.length > 0 ? parts.join(" ") : "—";
}

function MarketSourcesPageContent() {
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);

  const [urlInput, setUrlInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [nodes, setNodes] = useState<MarketNode[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busyNodeId, setBusyNodeId] = useState<string | null>(null);

  const reloadNodes = useCallback(() => {
    setNodes(listMarketNodes());
  }, []);

  useEffect(() => {
    // localStorage 読み出しは microtask へ逃がす（effect 内の同期 setState を避ける）。
    queueMicrotask(() => {
      setNodes(listMarketNodes());
    });
  }, []);

  const preview = useMemo(
    () => (urlInput.trim() ? previewHyperliquidUrl(urlInput.trim()) : null),
    [urlInput],
  );

  const tryFetch = useCallback(
    async (node: MarketNode) => {
      setBusyNodeId(node.id);
      try {
        if (!node.externalSymbol) {
          updateMarketNode(node.id, {
            lastApiError:
              "symbol mappingが無いため、coin名が不明で取得できません。価格は手入力してください。",
          });
          setMessage("mappingが無いためAPI取得できません。価格は手入力で扱います。");
          return;
        }
        const result = await fetchHyperliquidL2Book(node.externalSymbol);
        if (!result.ok) {
          updateMarketNode(node.id, { lastApiError: result.error });
          setMessage(`API取得に失敗しました: ${result.error}`);
          return;
        }
        updateMarketNode(node.id, {
          bid: result.bid,
          ask: result.ask,
          mid: result.mid,
          spread: result.spread,
          liquidityScore: result.liquidityScore,
          probability: result.mid,
          rawPrice: result.mid,
          priceSource: "api",
          lastApiError: null,
          lastFetchedAt: new Date().toISOString(),
          dataConfidence: "medium",
        });
        setMessage("APIから価格を取得しました。");
      } finally {
        setBusyNodeId(null);
        reloadNodes();
      }
    },
    [reloadNodes],
  );

  const handleAdd = useCallback(
    async (options: { withPrice?: boolean; tryApi?: boolean }) => {
      const trimmed = urlInput.trim();
      if (!trimmed) {
        setMessage("Hyperliquidのtrade URLを入力してください。");
        return;
      }
      let manualPrice: number | null = null;
      if (options.withPrice) {
        manualPrice = parseProbabilityInput(priceInput);
        if (manualPrice === null) {
          setMessage("価格（％ または 0..1）を入力してください。");
          return;
        }
      }
      const node = createMarketNodeFromHyperliquidUrl(
        trimmed,
        manualPrice !== null
          ? { manualPrice: { probability: manualPrice, mid: manualPrice } }
          : {},
      );
      if (!node) {
        setMessage("URLを解析できませんでした。Hyperliquidのtrade URLを確認してください。");
        return;
      }
      const saved = saveMarketNode(node);
      reloadNodes();
      setUrlInput("");
      setPriceInput("");
      setMessage(`市場を追加しました: ${saved.team ?? saved.slug ?? saved.externalUrl}`);
      if (options.tryApi) {
        await tryFetch(saved);
      }
    },
    [priceInput, reloadNodes, tryFetch, urlInput],
  );

  const handleManualUpdate = useCallback(
    (id: string, probability: number) => {
      const current = listMarketNodes().find((entry) => entry.id === id);
      updateMarketNode(id, {
        probability,
        mid: probability,
        rawPrice: probability,
        priceSource: "manual",
        lastFetchedAt: new Date().toISOString(),
        dataConfidence:
          current && current.dataConfidence !== "unknown" ? current.dataConfidence : "low",
      });
      reloadNodes();
      setMessage("価格を手入力で更新しました。");
    },
    [reloadNodes],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteMarketNode(id);
      reloadNodes();
      setMessage("市場を削除しました。");
    },
    [reloadNodes],
  );

  const signalBoard = useMemo(() => {
    if (!data) {
      return null;
    }
    return buildSignalBoard({ matches: data.round.matches, nodes });
  }, [data, nodes]);

  const modelPreviewRows = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.round.matches
      .map((match) => {
        const adjustments = computeUpstreamTeamPriorAdjustments(
          { homeTeam: match.homeTeam, awayTeam: match.awayTeam },
          nodes,
        );
        if (adjustments.contributions.length === 0) {
          return null;
        }
        const model = calculateModelProbabilitiesWithUpstream(
          {
            ...match,
            competitionType: data.round.competitionType,
            dataProfile: data.round.dataProfile,
          },
          { homeTeam: match.homeTeam, awayTeam: match.awayTeam },
          nodes,
        );
        return { match, model };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [data, nodes]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="市場ソース"
        title="Hyperliquid / Polymarket / Bookmaker を並べて見る"
        description="W杯の優勝市場などを上流シグナルとして取り込み、Human Scout や公式投票と並べて比較します。優勝市場は個別試合の1X2を直接決めず、チームの地力に weight 付きで軽く反映します。"
      />

      <InfoBanner
        tone="amber"
        title="この市場は上流シグナルです"
        body={
          <div className="space-y-2">
            <p>
              この市場はW杯優勝市場です。個別試合の90分1/0/2を直接決めるものではありません。Franceの地力・市場評価の上流シグナルとして軽く反映します（片側 最大 ±0.03）。
            </p>
            <p className="font-semibold">
              Hyperliquid連携はread-onlyです。売買、wallet接続、注文機能はありません。
            </p>
          </div>
        }
      />

      <SectionCard
        title="Hyperliquid 市場を追加"
        description="trade URL を貼り付けると、slug から競技・市場種別・チーム・YES/NO を解析します。mapping が無い場合は価格を手入力してください。"
      >
        <div className="flex flex-col gap-3">
          <input
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            placeholder={HYPERLIQUID_PLACEHOLDER}
            className={fieldClassName}
            inputMode="url"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={priceInput}
              onChange={(event) => setPriceInput(event.target.value)}
              placeholder="価格（例: 18% / 0.18）"
              className={cx(fieldClassName, "max-w-[200px]")}
              inputMode="decimal"
            />
            <button type="button" onClick={() => void handleAdd({})} className={buttonClassName}>
              市場を追加
            </button>
            <button
              type="button"
              onClick={() => void handleAdd({ withPrice: true })}
              className={secondaryButtonClassName}
            >
              価格を手入力で追加
            </button>
            <button
              type="button"
              onClick={() => void handleAdd({ tryApi: true })}
              className={secondaryButtonClassName}
            >
              追加してAPIで取得を試す
            </button>
          </div>

          {message ? (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
              {message}
            </p>
          ) : null}

          {preview ? (
            <div className="rounded-[22px] border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="teal">解析プレビュー</Badge>
                <Badge tone={preview.mappingStatus === "mapped" ? "teal" : "amber"}>
                  {preview.mappingStatus === "mapped" ? "mappingあり" : "mappingなし（手入力）"}
                </Badge>
              </div>
              <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
                <PreviewRow label="Source" value="Hyperliquid" />
                <PreviewRow label="Slug" value={preview.slug} />
                <PreviewRow
                  label="Market Type"
                  value={MARKET_TYPE_LABEL[preview.parsed.marketType]}
                />
                <PreviewRow label="Competition" value={preview.parsed.competition} />
                <PreviewRow label="Team" value={preview.parsed.team ?? "—"} />
                <PreviewRow label="Outcome" value={preview.parsed.outcomeLabel} />
                <PreviewRow
                  label="Signal Layer"
                  value={SIGNAL_LAYER_LABEL[preview.parsed.signalLayer]}
                />
                <PreviewRow label="Weight" value={preview.weight.toFixed(2)} />
              </div>
            </div>
          ) : urlInput.trim() ? (
            <p className="text-sm text-amber-800">
              URLを解析できませんでした。例: {HYPERLIQUID_PLACEHOLDER}
            </p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title={`保存済みの市場ソース（${nodes.length}）`}
        description="保存した市場ノード。優勝市場は上流シグナルとして扱われ、価格は手入力 / API 取得のいずれでも構いません。"
      >
        {nodes.length === 0 ? (
          <p className="text-sm leading-6 text-slate-600">
            まだ市場ソースがありません。上の入力欄から Hyperliquid の trade URL を追加してください。
          </p>
        ) : (
          <div className="space-y-3">
            {nodes.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                busy={busyNodeId === node.id}
                onUpdate={handleManualUpdate}
                onTryApi={(target) => void tryFetch(target)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {!roundId ? (
        <SectionCard
          title="Signal Board"
          description="ラウンドを選ぶと、そのラウンドのチームについて各ソースを並べた Signal Board と、試合への反映プレビューを表示します。"
        >
          <Link href={appRoute.dashboard} className={secondaryButtonClassName}>
            ダッシュボードでラウンドを選ぶ
          </Link>
        </SectionCard>
      ) : loading && !data ? (
        <LoadingNotice title="ラウンドを読み込み中" />
      ) : error && !data ? (
        <ErrorNotice error={error} onRetry={() => void refresh()} />
      ) : data ? (
        <>
          <RoundNav
            roundId={data.round.id}
            roundTitle={data.round.title}
            roundStatus={roundStatusLabel[data.round.status]}
            currentPath={appRoute.marketSources}
          />

          <SectionCard
            title="Signal Board"
            description="チームごとに Polymarket / Bookmaker / Hyperliquid の優勝確率、Human の地力(F)、公式投票の人気を並べます。優勝市場は上流シグナルとして比較用に置いています。"
          >
            {signalBoard && signalBoard.rows.length > 0 ? (
              <HorizontalScrollTable hint="横にスワイプすると、各ソースの優勝確率・Human・公式・ばらつきまで確認できます。">
                <table className="min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="px-3 py-3">チーム</th>
                      <th className="px-3 py-3">Hyperliquid 優勝</th>
                      <th className="px-3 py-3">Polymarket 優勝</th>
                      <th className="px-3 py-3">Bookmaker 優勝</th>
                      <th className="px-3 py-3">Human F</th>
                      <th className="px-3 py-3">公式投票</th>
                      <th className="px-3 py-3">ばらつき</th>
                      <th className="px-3 py-3">コメント</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signalBoard.rows.map((row) => (
                      <tr key={row.team} className="border-b border-slate-100 align-top">
                        <td className="px-3 py-3">
                          <div className="font-semibold text-slate-900">{row.team}</div>
                          <div className="text-xs text-slate-500">
                            #{row.matchNos.join(", #")}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {row.hyperliquidChampion !== null
                            ? formatPercent(row.hyperliquidChampion, 1)
                            : "—"}
                        </td>
                        <td className="px-3 py-3">
                          {row.polymarketChampion !== null
                            ? formatPercent(row.polymarketChampion, 1)
                            : "—"}
                        </td>
                        <td className="px-3 py-3">
                          {row.bookmakerChampion !== null
                            ? formatPercent(row.bookmakerChampion, 1)
                            : "—"}
                        </td>
                        <td className="px-3 py-3">
                          {row.humanStrengthF !== null ? row.humanStrengthF.toFixed(1) : "—"}
                        </td>
                        <td className="px-3 py-3">
                          {row.officialVotePopularity !== null
                            ? formatPercent(row.officialVotePopularity, 0)
                            : "—"}
                        </td>
                        <td className="px-3 py-3">
                          {row.championProbSpread !== null
                            ? formatPercent(row.championProbSpread, 1)
                            : "—"}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">{signalComment(row)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </HorizontalScrollTable>
            ) : (
              <p className="text-sm leading-6 text-slate-600">
                このラウンドのチームに紐づく市場ソースがまだありません。上で Hyperliquid 市場を追加すると、ここに並びます。
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="試合モデルへの反映プレビュー"
            description="優勝市場（上流シグナル）が、関係する個別試合のモデル確率をどれだけ動かすかの確認です。片側 最大 ±0.03 までしか動きません（個別試合の勝率を大きく上書きしません）。"
          >
            {modelPreviewRows.length === 0 ? (
              <p className="text-sm leading-6 text-slate-600">
                このラウンドの試合に紐づく上流シグナルがまだありません。
              </p>
            ) : (
              <div className="space-y-3">
                {modelPreviewRows.map(({ match, model }) => (
                  <div
                    key={match.id}
                    className="rounded-[20px] border border-slate-200 bg-white/85 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">
                        #{match.matchNo} {match.homeTeam} vs {match.awayTeam}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="slate">
                          home {formatSignedPercent(model.adjustments.homeStrengthDelta)}
                        </Badge>
                        <Badge tone="slate">
                          away {formatSignedPercent(model.adjustments.awayStrengthDelta)}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      {(["1", "0", "2"] as const).map((outcome) => {
                        const baseValue =
                          outcome === "1"
                            ? model.base.modelProb1
                            : outcome === "0"
                              ? model.base.modelProb0
                              : model.base.modelProb2;
                        const adjustedValue =
                          outcome === "1"
                            ? model.adjusted.modelProb1
                            : outcome === "0"
                              ? model.adjusted.modelProb0
                              : model.adjusted.modelProb2;
                        return (
                          <div
                            key={outcome}
                            className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-center"
                          >
                            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                              {outcome}
                            </div>
                            <div className="mt-1 text-slate-500">
                              {formatPercent(baseValue, 1)}
                            </div>
                            <div className="text-base font-semibold text-slate-900">
                              → {formatPercent(adjustedValue, 1)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}

export default function MarketSourcesPage() {
  return (
    <Suspense fallback={<LoadingNotice title="市場ソースを準備中" />}>
      <MarketSourcesPageContent />
    </Suspense>
  );
}
